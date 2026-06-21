use std::collections::HashMap;
use std::fs;
use std::path::Path;

use image::{imageops, RgbaImage};

use crate::dat_writer::{read_thing, write_thing_neutral, FrameGroup, Reader, ThingType};
use crate::spr_manager::decompress_to_rgba;

const MAGIC: &[u8; 4] = b"SFPK";
const FORMAT_VERSION: u16 = 1;
const SPRITE_SIZE: u32 = 32;
pub const FLAG_TRANSPARENCY: u8 = 0b0000_0010;

pub struct SpriteInput {
    pub is_empty: bool,
    pub rle: Vec<u8>,
    pub rgba: Vec<u8>,
}

pub struct PackEntryInput {
    pub category: u8,
    pub name: String,
    pub thing: ThingType,
}

pub struct PoolSprite {
    pub hash: u64,
    pub is_empty: bool,
    pub rle: Vec<u8>,
}

pub struct StoredEntry {
    pub category: u8,
    pub name: String,
    pub thumb_w: u16,
    pub thumb_h: u16,
    pub thumb: Vec<u8>,
    pub thing: ThingType,
}

pub struct PackData {
    pub client_version: u16,
    pub flags: u8,
    pub entries: Vec<StoredEntry>,
    pub pool: Vec<PoolSprite>,
}

fn fnv1a_64(bytes: &[u8]) -> u64 {
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    for &b in bytes {
        hash ^= b as u64;
        hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
    }
    hash
}

fn group_sprite_index(g: &FrameGroup, w: u32, h: u32, layer: u32, px: u32, py: u32, pz: u32, frame: u32) -> usize {
    let gw = g.width as u32;
    let gh = g.height as u32;
    let gl = g.layers as u32;
    let gpx = g.pattern_x as u32;
    let gpy = g.pattern_y as u32;
    let gpz = g.pattern_z as u32;
    let gf = g.frames as u32;
    ((((((frame % gf) * gpz + pz) * gpy + py) * gpx + px) * gl + layer) * gh + h) as usize * gw as usize + w as usize
}

fn first_group(thing: &ThingType) -> FrameGroup {
    match &thing.frame_groups_data {
        Some(fgs) if !fgs.is_empty() => {
            fgs.iter().find(|g| g.r#type == 0).cloned().unwrap_or_else(|| fgs[0].clone())
        }
        _ => FrameGroup {
            r#type: 0,
            width: thing.width,
            height: thing.height,
            exact_size: thing.exact_size,
            layers: thing.layers,
            pattern_x: thing.pattern_x,
            pattern_y: thing.pattern_y,
            pattern_z: thing.pattern_z,
            frames: thing.frames,
            sprite_index: thing.sprite_index.clone(),
            is_animation: thing.frames > 1,
            animation_mode: Some(thing.animation_mode),
            loop_count: Some(thing.loop_count),
            start_frame: Some(thing.start_frame),
            frame_durations: Some(thing.frame_durations.clone()),
        },
    }
}

pub fn render_thing_thumb(thing: &ThingType, rgba_by_id: &HashMap<u32, Vec<u8>>) -> (u16, u16, Vec<u8>) {
    let g = first_group(thing);
    let width = (g.width as u32).max(1);
    let height = (g.height as u32).max(1);
    let canvas_w = width * SPRITE_SIZE;
    let canvas_h = height * SPRITE_SIZE;

    let mut sheet = RgbaImage::new(canvas_w, canvas_h);

    let is_outfit = thing.category == "outfit";
    let pattern_x = if is_outfit && g.pattern_x > 2 { 2u32 } else { 0u32 };
    let layer_count = if is_outfit { 1u32 } else { (g.layers as u32).max(1) };

    for layer in 0..layer_count {
        for h in 0..height {
            for w in 0..width {
                let idx = group_sprite_index(&g, w, h, layer, pattern_x, 0, 0, 0);
                if idx >= g.sprite_index.len() {
                    continue;
                }
                let sprite_id = g.sprite_index[idx];
                if sprite_id == 0 {
                    continue;
                }
                if let Some(rgba) = rgba_by_id.get(&sprite_id) {
                    if rgba.len() < (SPRITE_SIZE * SPRITE_SIZE * 4) as usize {
                        continue;
                    }
                    if let Some(tile) = RgbaImage::from_raw(SPRITE_SIZE, SPRITE_SIZE, rgba.clone()) {
                        let px = (width - w - 1) * SPRITE_SIZE;
                        let py = (height - h - 1) * SPRITE_SIZE;
                        imageops::overlay(&mut sheet, &tile, px as i64, py as i64);
                    }
                }
            }
        }
    }

    (canvas_w as u16, canvas_h as u16, sheet.into_raw())
}

fn collect_local_ids(thing: &ThingType, into: &mut Vec<u32>) {
    for &id in &thing.sprite_index {
        if id != 0 {
            into.push(id);
        }
    }
    if let Some(fgs) = &thing.frame_groups_data {
        for fg in fgs {
            for &id in &fg.sprite_index {
                if id != 0 {
                    into.push(id);
                }
            }
        }
    }
}

fn remap_thing(thing: &ThingType, map: &HashMap<u32, u32>) -> ThingType {
    let remap = |arr: &[u32]| -> Vec<u32> { arr.iter().map(|&id| if id == 0 { 0 } else { *map.get(&id).unwrap_or(&0) }).collect() };
    let mut out = thing.clone();
    out.sprite_index = remap(&thing.sprite_index);
    if let Some(fgs) = out.frame_groups_data.as_mut() {
        for fg in fgs.iter_mut() {
            fg.sprite_index = remap(&fg.sprite_index);
        }
    }
    out
}

pub fn count_entry_sprites(thing: &ThingType) -> u32 {
    let mut ids = Vec::new();
    collect_local_ids(thing, &mut ids);
    ids.sort_unstable();
    ids.dedup();
    ids.len() as u32
}

pub fn write_pack(
    out_path: &str,
    append_path: Option<&str>,
    client_version: u16,
    flags: u8,
    entries: Vec<PackEntryInput>,
    sprites: &HashMap<u32, SpriteInput>,
) -> Result<(), String> {
    let mut data = match append_path {
        Some(path) if Path::new(path).exists() => {
            let bytes = fs::read(path).map_err(|e| format!("Failed to read existing pack: {}", e))?;
            read_pack(&bytes)?
        }
        _ => PackData { client_version, flags, entries: Vec::new(), pool: Vec::new() },
    };

    let mut hash_index: HashMap<u64, u32> = HashMap::new();
    for (i, p) in data.pool.iter().enumerate() {
        hash_index.entry(p.hash).or_insert((i + 1) as u32);
    }

    let rgba_by_id: HashMap<u32, Vec<u8>> = sprites.iter().map(|(&id, s)| (id, s.rgba.clone())).collect();

    for entry in entries {
        let (thumb_w, thumb_h, thumb) = render_thing_thumb(&entry.thing, &rgba_by_id);

        let mut local_ids = Vec::new();
        collect_local_ids(&entry.thing, &mut local_ids);
        local_ids.sort_unstable();
        local_ids.dedup();

        let mut local_to_pool: HashMap<u32, u32> = HashMap::new();
        for local in local_ids {
            let s = match sprites.get(&local) {
                Some(s) => s,
                None => continue,
            };
            if s.is_empty {
                local_to_pool.insert(local, 0);
                continue;
            }
            let hash = fnv1a_64(&s.rle);
            let pool_id = match hash_index.get(&hash) {
                Some(&id) => id,
                None => {
                    data.pool.push(PoolSprite { hash, is_empty: false, rle: s.rle.clone() });
                    let id = data.pool.len() as u32;
                    hash_index.insert(hash, id);
                    id
                }
            };
            local_to_pool.insert(local, pool_id);
        }

        let stored_thing = remap_thing(&entry.thing, &local_to_pool);
        data.entries.push(StoredEntry {
            category: entry.category,
            name: entry.name,
            thumb_w,
            thumb_h,
            thumb,
            thing: stored_thing,
        });
    }

    data.client_version = client_version;
    data.flags = flags;

    let buffer = serialize_pack(&data);

    if let Some(parent) = Path::new(out_path).parent() {
        if !parent.as_os_str().is_empty() {
            let _ = fs::create_dir_all(parent);
        }
    }

    let tmp = format!("{}.tmp", out_path);
    fs::write(&tmp, &buffer).map_err(|e| format!("Failed to write pack: {}", e))?;
    fs::rename(&tmp, out_path).map_err(|e| format!("Failed to finalize pack: {}", e))?;
    Ok(())
}

fn serialize_pack(data: &PackData) -> Vec<u8> {
    let mut buf = Vec::with_capacity(1 << 16);
    buf.extend_from_slice(MAGIC);
    buf.extend_from_slice(&FORMAT_VERSION.to_le_bytes());
    buf.extend_from_slice(&data.client_version.to_le_bytes());
    buf.push(data.flags);
    buf.extend_from_slice(&(data.entries.len() as u32).to_le_bytes());

    for e in &data.entries {
        buf.push(e.category);
        let name = e.name.as_bytes();
        buf.extend_from_slice(&(name.len() as u16).to_le_bytes());
        buf.extend_from_slice(name);
        buf.extend_from_slice(&e.thumb_w.to_le_bytes());
        buf.extend_from_slice(&e.thumb_h.to_le_bytes());
        buf.extend_from_slice(&(e.thumb.len() as u32).to_le_bytes());
        buf.extend_from_slice(&e.thumb);

        let mut thing_bytes = Vec::new();
        write_thing_neutral(&mut thing_bytes, &e.thing);
        buf.extend_from_slice(&(thing_bytes.len() as u32).to_le_bytes());
        buf.extend_from_slice(&thing_bytes);
    }

    buf.extend_from_slice(&(data.pool.len() as u32).to_le_bytes());
    for p in &data.pool {
        buf.extend_from_slice(&p.hash.to_le_bytes());
        buf.push(if p.is_empty { 1 } else { 0 });
        buf.extend_from_slice(&(p.rle.len() as u32).to_le_bytes());
        buf.extend_from_slice(&p.rle);
    }

    buf
}

pub fn read_pack(bytes: &[u8]) -> Result<PackData, String> {
    if bytes.len() < 13 || &bytes[0..4] != MAGIC {
        return Err("Not a valid Sprite Forge Pack (.sfp) file".to_string());
    }

    let mut r = Reader::new(&bytes[4..]);
    let _fmt = r.u16()?;
    let client_version = r.u16()?;
    let flags = r.u8()?;
    let entry_count = r.u32()? as usize;

    let mut entries = Vec::with_capacity(entry_count);
    for _ in 0..entry_count {
        let category = r.u8()?;
        let name = r.string()?;
        let thumb_w = r.u16()?;
        let thumb_h = r.u16()?;
        let thumb_len = r.u32()? as usize;
        let thumb = r.take(thumb_len)?.to_vec();
        let thing_len = r.u32()? as usize;
        let thing_bytes = r.take(thing_len)?;
        let category_name = category_label(category);
        let thing = {
            let mut tr = Reader::new(thing_bytes);
            read_thing(&mut tr, category_name)?
        };
        entries.push(StoredEntry { category, name, thumb_w, thumb_h, thumb, thing });
    }

    let pool_count = r.u32()? as usize;
    let mut pool = Vec::with_capacity(pool_count);
    for _ in 0..pool_count {
        let hash = read_u64(&mut r)?;
        let is_empty = r.bool()?;
        let rle_len = r.u32()? as usize;
        let rle = r.take(rle_len)?.to_vec();
        pool.push(PoolSprite { hash, is_empty, rle });
    }

    Ok(PackData { client_version, flags, entries, pool })
}

fn category_label(value: u8) -> &'static str {
    match value {
        1 => "item",
        2 => "outfit",
        3 => "effect",
        4 => "missile",
        _ => "item",
    }
}

fn read_u64(r: &mut Reader) -> Result<u64, String> {
    let lo = r.u32()? as u64;
    let hi = r.u32()? as u64;
    Ok(lo | (hi << 32))
}

pub fn pool_rgba(pool: &PoolSprite, transparent: bool) -> Vec<u8> {
    if pool.is_empty {
        vec![0u8; (SPRITE_SIZE * SPRITE_SIZE * 4) as usize]
    } else {
        decompress_to_rgba(&pool.rle, transparent)
    }
}
