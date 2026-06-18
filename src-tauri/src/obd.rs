use std::collections::HashMap;
use std::io::Cursor;

use lzma_rs::{lzma_compress, lzma_decompress};

use crate::dat_writer::{FrameDuration, FrameGroup, ThingType};

const SPRITE_DATA_SIZE: usize = 4096;
const DEFAULT_SIZE: u8 = 32;

const OBD_VERSION_2: u16 = 200;
const OBD_VERSION_3: u16 = 300;

const GROUND: u8 = 0x00;
const GROUND_BORDER: u8 = 0x01;
const ON_BOTTOM: u8 = 0x02;
const ON_TOP: u8 = 0x03;
const CONTAINER: u8 = 0x04;
const STACKABLE: u8 = 0x05;
const FORCE_USE: u8 = 0x06;
const MULTI_USE: u8 = 0x07;
const WRITABLE: u8 = 0x08;
const WRITABLE_ONCE: u8 = 0x09;
const FLUID_CONTAINER: u8 = 0x0A;
const FLUID: u8 = 0x0B;
const UNPASSABLE: u8 = 0x0C;
const UNMOVEABLE: u8 = 0x0D;
const BLOCK_MISSILE: u8 = 0x0E;
const BLOCK_PATHFIND: u8 = 0x0F;
const NO_MOVE_ANIMATION: u8 = 0x10;
const PICKUPABLE: u8 = 0x11;
const HANGABLE: u8 = 0x12;
const HOOK_SOUTH: u8 = 0x13;
const HOOK_EAST: u8 = 0x14;
const ROTATABLE: u8 = 0x15;
const HAS_LIGHT: u8 = 0x16;
const DONT_HIDE: u8 = 0x17;
const TRANSLUCENT: u8 = 0x18;
const HAS_OFFSET: u8 = 0x19;
const HAS_ELEVATION: u8 = 0x1A;
const LYING_OBJECT: u8 = 0x1B;
const ANIMATE_ALWAYS: u8 = 0x1C;
const MINI_MAP: u8 = 0x1D;
const LENS_HELP: u8 = 0x1E;
const FULL_GROUND: u8 = 0x1F;
const IGNORE_LOOK: u8 = 0x20;
const CLOTH: u8 = 0x21;
const MARKET_ITEM: u8 = 0x22;
const DEFAULT_ACTION: u8 = 0x23;
const WRAPPABLE: u8 = 0x24;
const UNWRAPPABLE: u8 = 0x25;
const TOP_EFFECT: u8 = 0x26;
const HAS_CHARGES: u8 = 0xFC;
const FLOOR_CHANGE: u8 = 0xFD;
const USABLE: u8 = 0xFE;
const LAST_FLAG: u8 = 0xFF;

pub struct ObdSprite {
    pub id: u32,
    pub rgba: Vec<u8>,
}

pub struct ObdObject {
    pub client_version: u16,
    pub thing: ThingType,
    pub sprites: Vec<ObdSprite>,
}

struct Cur<'a> {
    buf: &'a [u8],
    pos: usize,
}

impl<'a> Cur<'a> {
    fn new(buf: &'a [u8]) -> Self {
        Self { buf, pos: 0 }
    }

    fn need(&self, n: usize) -> Result<(), String> {
        if self.pos + n > self.buf.len() {
            Err(format!("OBD truncated at offset {}: need {} bytes", self.pos, n))
        } else {
            Ok(())
        }
    }

    fn u8(&mut self) -> Result<u8, String> {
        self.need(1)?;
        let v = self.buf[self.pos];
        self.pos += 1;
        Ok(v)
    }

    fn i8(&mut self) -> Result<i8, String> {
        Ok(self.u8()? as i8)
    }

    fn u16le(&mut self) -> Result<u16, String> {
        self.need(2)?;
        let v = u16::from_le_bytes([self.buf[self.pos], self.buf[self.pos + 1]]);
        self.pos += 2;
        Ok(v)
    }

    fn u16be(&mut self) -> Result<u16, String> {
        self.need(2)?;
        let v = u16::from_be_bytes([self.buf[self.pos], self.buf[self.pos + 1]]);
        self.pos += 2;
        Ok(v)
    }

    fn i16le(&mut self) -> Result<i16, String> {
        Ok(self.u16le()? as i16)
    }

    fn u32le(&mut self) -> Result<u32, String> {
        self.need(4)?;
        let v = u32::from_le_bytes(self.buf[self.pos..self.pos + 4].try_into().unwrap());
        self.pos += 4;
        Ok(v)
    }

    fn i32le(&mut self) -> Result<i32, String> {
        Ok(self.u32le()? as i32)
    }

    fn take(&mut self, n: usize) -> Result<&'a [u8], String> {
        self.need(n)?;
        let s = &self.buf[self.pos..self.pos + n];
        self.pos += n;
        Ok(s)
    }
}

struct Out {
    buf: Vec<u8>,
}

impl Out {
    fn new() -> Self {
        Self { buf: Vec::with_capacity(1 << 16) }
    }

    fn u8(&mut self, v: u8) {
        self.buf.push(v);
    }

    fn u16le(&mut self, v: u16) {
        self.buf.extend_from_slice(&v.to_le_bytes());
    }

    fn i16le(&mut self, v: i16) {
        self.buf.extend_from_slice(&v.to_le_bytes());
    }

    fn u32le(&mut self, v: u32) {
        self.buf.extend_from_slice(&v.to_le_bytes());
    }

    fn i32le(&mut self, v: i32) {
        self.buf.extend_from_slice(&v.to_le_bytes());
    }

    fn bytes(&mut self, v: &[u8]) {
        self.buf.extend_from_slice(v);
    }
}

fn category_value(category: &str) -> u8 {
    match category {
        "item" => 1,
        "outfit" => 2,
        "effect" => 3,
        "missile" => 4,
        _ => 1,
    }
}

fn category_name(value: u8) -> Result<&'static str, String> {
    match value {
        1 => Ok("item"),
        2 => Ok("outfit"),
        3 => Ok("effect"),
        4 => Ok("missile"),
        _ => Err(format!("Invalid OBD category {}", value)),
    }
}

fn argb_to_rgba(argb: &[u8]) -> Vec<u8> {
    let mut rgba = vec![0u8; SPRITE_DATA_SIZE];
    let px = argb.len() / 4;
    for i in 0..px {
        let a = argb[i * 4];
        let r = argb[i * 4 + 1];
        let g = argb[i * 4 + 2];
        let b = argb[i * 4 + 3];
        rgba[i * 4] = r;
        rgba[i * 4 + 1] = g;
        rgba[i * 4 + 2] = b;
        rgba[i * 4 + 3] = a;
    }
    rgba
}

fn rgba_to_argb(rgba: &[u8]) -> [u8; SPRITE_DATA_SIZE] {
    let mut argb = [0u8; SPRITE_DATA_SIZE];
    for i in 0..(SPRITE_DATA_SIZE / 4) {
        let r = rgba.get(i * 4).copied().unwrap_or(0);
        let g = rgba.get(i * 4 + 1).copied().unwrap_or(0);
        let b = rgba.get(i * 4 + 2).copied().unwrap_or(0);
        let a = rgba.get(i * 4 + 3).copied().unwrap_or(0);
        argb[i * 4] = a;
        argb[i * 4 + 1] = r;
        argb[i * 4 + 2] = g;
        argb[i * 4 + 3] = b;
    }
    argb
}

fn blank_thing(category: &str) -> ThingType {
    ThingType {
        id: 0,
        category: category.to_string(),
        width: 1,
        height: 1,
        exact_size: DEFAULT_SIZE,
        layers: 1,
        pattern_x: 1,
        pattern_y: 1,
        pattern_z: 1,
        frames: 1,
        sprite_index: Vec::new(),
        frame_groups_data: None,
        is_ground: false,
        ground_speed: 0,
        is_ground_border: false,
        is_on_bottom: false,
        is_on_top: false,
        is_container: false,
        stackable: false,
        force_use: false,
        multi_use: false,
        has_charges: false,
        writable: false,
        writable_once: false,
        max_text_length: 0,
        is_fluid_container: false,
        is_fluid: false,
        is_unpassable: false,
        is_unmoveable: false,
        block_missile: false,
        block_pathfind: false,
        no_move_animation: false,
        pickupable: false,
        hangable: false,
        is_vertical: false,
        is_horizontal: false,
        rotatable: false,
        has_light: false,
        light_level: 0,
        light_color: 0,
        dont_hide: false,
        floor_change: false,
        is_translucent: false,
        has_offset: false,
        offset_x: 0,
        offset_y: 0,
        has_elevation: false,
        elevation: 0,
        is_lying_object: false,
        animate_always: false,
        mini_map: false,
        mini_map_color: 0,
        is_lens_help: false,
        lens_help: 0,
        is_full_ground: false,
        ignore_look: false,
        cloth: false,
        cloth_slot: 0,
        is_market_item: false,
        market_name: String::new(),
        market_category: 0,
        market_trade_as: 0,
        market_show_as: 0,
        market_restrict_profession: 0,
        market_restrict_level: 0,
        has_default_action: false,
        default_action: 0,
        usable: false,
        wrappable: false,
        unwrappable: false,
        top_effect: false,
        has_bones: false,
        bones_offset_x: Vec::new(),
        bones_offset_y: Vec::new(),
        is_animation: false,
        animation_mode: 0,
        loop_count: 0,
        start_frame: 0,
        frame_durations: Vec::new(),
    }
}

fn synthetic_group(thing: &ThingType) -> FrameGroup {
    FrameGroup {
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
    }
}

fn group_total_sprites(g: &FrameGroup) -> usize {
    (g.width as usize)
        * (g.height as usize)
        * (g.layers as usize)
        * (g.pattern_x as usize)
        * (g.pattern_y as usize)
        * (g.pattern_z as usize)
        * (g.frames as usize)
}

pub fn decode_obd(file_bytes: &[u8]) -> Result<ObdObject, String> {
    let mut decompressed = Vec::new();
    lzma_decompress(&mut Cursor::new(file_bytes), &mut decompressed)
        .map_err(|e| format!("OBD LZMA decompress failed: {}", e))?;

    let mut peek = Cur::new(&decompressed);
    let first = peek.u16le()?;

    if first == OBD_VERSION_3 {
        decode_v2_v3(&decompressed, true)
    } else if first == OBD_VERSION_2 {
        decode_v2_v3(&decompressed, false)
    } else if first >= 710 {
        decode_v1(&decompressed)
    } else {
        Err(format!("Invalid OBD version {}", first))
    }
}

fn decode_v1(buf: &[u8]) -> Result<ObdObject, String> {
    let mut c = Cur::new(buf);
    let client_version = c.u16le()?;

    let name_len = c.u16be()? as usize;
    let category = String::from_utf8_lossy(c.take(name_len)?).into_owned();

    let mut thing = blank_thing(&category);
    read_properties_v1(&mut c, &mut thing, client_version)?;

    let mut sprites: Vec<ObdSprite> = Vec::new();
    let group = read_group_v1(&mut c, &mut sprites)?;
    apply_group(&mut thing, group, false, &[]);

    Ok(ObdObject { client_version, thing, sprites })
}

fn read_group_v1(c: &mut Cur, sprites: &mut Vec<ObdSprite>) -> Result<FrameGroup, String> {
    let width = c.u8()?;
    let height = c.u8()?;
    let exact_size = if width > 1 || height > 1 { c.u8()? } else { DEFAULT_SIZE };
    let layers = c.u8()?;
    let pattern_x = c.u8()?;
    let pattern_y = c.u8()?;
    let pattern_z = c.u8()?;
    let frames = c.u8()?;

    let mut group = FrameGroup {
        r#type: 0,
        width,
        height,
        exact_size,
        layers,
        pattern_x,
        pattern_y,
        pattern_z,
        frames,
        sprite_index: Vec::new(),
        is_animation: frames > 1,
        animation_mode: Some(0),
        loop_count: Some(0),
        start_frame: Some(0),
        frame_durations: Some(default_durations(frames)),
    };

    let total = group_total_sprites(&group);
    let mut sprite_index = Vec::with_capacity(total);
    for _ in 0..total {
        let sprite_id = c.u32le()?;
        let data_size = c.u32le()? as usize;
        if data_size > SPRITE_DATA_SIZE {
            return Err("Invalid OBD sprite data size".to_string());
        }
        let pixels = c.take(data_size)?;
        sprite_index.push(sprite_id);
        push_sprite(sprites, sprite_id, pixels);
    }
    group.sprite_index = sprite_index;
    Ok(group)
}

fn decode_v2_v3(buf: &[u8], v3: bool) -> Result<ObdObject, String> {
    let mut c = Cur::new(buf);
    let _obd_version = c.u16le()?;
    let client_version = c.u16le()?;
    let category = category_name(c.u8()?)?.to_string();
    let _sprites_offset = c.u32le()?;

    let mut thing = blank_thing(&category);
    read_properties_obd(&mut c, &mut thing)?;

    let is_outfit = category == "outfit";
    let group_count: usize = if v3 && is_outfit { c.u8()? as usize } else { 1 };

    let mut sprites: Vec<ObdSprite> = Vec::new();
    let mut groups: Vec<FrameGroup> = Vec::with_capacity(group_count);

    for gi in 0..group_count {
        let mut group_type = gi as u8;
        if v3 && is_outfit {
            group_type = c.u8()?;
        }

        let width = c.u8()?;
        let height = c.u8()?;
        let exact_size = if width > 1 || height > 1 { c.u8()? } else { DEFAULT_SIZE };
        let layers = c.u8()?;
        let pattern_x = c.u8()?;
        let pattern_y = c.u8()?;
        let pattern_z = c.u8()?;
        let frames = c.u8()?;

        let mut animation_mode = 0u8;
        let mut loop_count = 0i32;
        let mut start_frame = 0i8;
        let mut durations = default_durations(frames);

        if frames > 1 {
            animation_mode = c.u8()?;
            loop_count = c.i32le()?;
            start_frame = c.i8()?;
            durations.clear();
            for _ in 0..frames {
                let minimum = c.u32le()?;
                let maximum = c.u32le()?;
                durations.push(FrameDuration { minimum, maximum });
            }
        }

        let mut group = FrameGroup {
            r#type: group_type,
            width,
            height,
            exact_size,
            layers,
            pattern_x,
            pattern_y,
            pattern_z,
            frames,
            sprite_index: Vec::new(),
            is_animation: frames > 1,
            animation_mode: Some(animation_mode),
            loop_count: Some(loop_count),
            start_frame: Some(start_frame),
            frame_durations: Some(durations),
        };

        let total = group_total_sprites(&group);
        let mut sprite_index = Vec::with_capacity(total);
        for _ in 0..total {
            let sprite_id = c.u32le()?;
            let pixels: &[u8] = if v3 {
                let data_size = c.u32le()? as usize;
                if data_size > SPRITE_DATA_SIZE {
                    return Err("Invalid OBD sprite data size".to_string());
                }
                c.take(data_size)?
            } else {
                c.take(SPRITE_DATA_SIZE)?
            };
            sprite_index.push(sprite_id);
            push_sprite(&mut sprites, sprite_id, pixels);
        }
        group.sprite_index = sprite_index;
        groups.push(group);
    }

    if is_outfit && groups.len() > 1 {
        let default = groups.iter().find(|g| g.r#type == 0).cloned().unwrap_or_else(|| groups[0].clone());
        apply_group(&mut thing, default, true, &groups);
    } else {
        let g = groups.into_iter().next().ok_or("OBD has no frame group")?;
        apply_group(&mut thing, g, false, &[]);
    }

    Ok(ObdObject { client_version, thing, sprites })
}

fn apply_group(thing: &mut ThingType, default: FrameGroup, keep_groups: bool, all_groups: &[FrameGroup]) {
    thing.width = default.width;
    thing.height = default.height;
    thing.exact_size = default.exact_size;
    thing.layers = default.layers;
    thing.pattern_x = default.pattern_x;
    thing.pattern_y = default.pattern_y;
    thing.pattern_z = default.pattern_z;
    thing.frames = default.frames;
    thing.is_animation = default.frames > 1;
    thing.animation_mode = default.animation_mode.unwrap_or(0);
    thing.loop_count = default.loop_count.unwrap_or(0);
    thing.start_frame = default.start_frame.unwrap_or(0);
    thing.frame_durations = default.frame_durations.clone().unwrap_or_default();
    thing.sprite_index = default.sprite_index.clone();
    thing.frame_groups_data = if keep_groups { Some(all_groups.to_vec()) } else { None };
}

fn push_sprite(sprites: &mut Vec<ObdSprite>, id: u32, pixels: &[u8]) {
    if id == 0 {
        return;
    }
    if sprites.iter().any(|s| s.id == id) {
        return;
    }
    sprites.push(ObdSprite { id, rgba: argb_to_rgba(pixels) });
}

fn default_durations(frames: u8) -> Vec<FrameDuration> {
    (0..frames).map(|_| FrameDuration { minimum: 100, maximum: 100 }).collect()
}

pub fn encode_obd_v3(
    client_version: u16,
    thing: &ThingType,
    sprite_rgba: &HashMap<u32, Vec<u8>>,
) -> Result<Vec<u8>, String> {
    let is_outfit = thing.category == "outfit";

    let groups: Vec<FrameGroup> = match &thing.frame_groups_data {
        Some(fgs) if !fgs.is_empty() => {
            let mut g = fgs.clone();
            g.sort_by(|a, b| a.r#type.cmp(&b.r#type));
            g
        }
        _ => vec![synthetic_group(thing)],
    };

    let mut out = Out::new();
    out.u16le(OBD_VERSION_3);
    out.u16le(client_version);
    out.u8(category_value(&thing.category));

    let sprites_offset_pos = out.buf.len();
    out.u32le(0);

    write_properties_obd(&mut out, thing);

    let pos = out.buf.len() as u32;
    out.buf[sprites_offset_pos..sprites_offset_pos + 4].copy_from_slice(&pos.to_le_bytes());

    let group_count = if is_outfit { groups.len().max(1) } else { 1 };
    if is_outfit {
        out.u8(group_count as u8);
    }

    for (gi, group) in groups.iter().enumerate() {
        if gi >= group_count {
            break;
        }
        if is_outfit {
            let g = if group_count < 2 { 1 } else { group.r#type };
            out.u8(g);
        }

        out.u8(group.width);
        out.u8(group.height);
        if group.width > 1 || group.height > 1 {
            out.u8(group.exact_size);
        }
        out.u8(group.layers);
        out.u8(group.pattern_x);
        out.u8(group.pattern_y);
        out.u8(group.pattern_z.max(1));
        out.u8(group.frames);

        if group.frames > 1 {
            out.u8(group.animation_mode.unwrap_or(0));
            out.i32le(group.loop_count.unwrap_or(0));
            out.u8(group.start_frame.unwrap_or(0) as u8);
            let durations = group.frame_durations.clone().unwrap_or_else(|| default_durations(group.frames));
            for i in 0..group.frames as usize {
                let d = durations.get(i).cloned().unwrap_or(FrameDuration { minimum: 100, maximum: 100 });
                out.u32le(d.minimum);
                out.u32le(d.maximum);
            }
        }

        for &sprite_id in &group.sprite_index {
            let empty = vec![0u8; SPRITE_DATA_SIZE];
            let rgba = sprite_rgba.get(&sprite_id).unwrap_or(&empty);
            let argb = rgba_to_argb(rgba);
            out.u32le(sprite_id);
            out.u32le(SPRITE_DATA_SIZE as u32);
            out.bytes(&argb);
        }
    }

    let mut compressed = Vec::new();
    lzma_compress(&mut Cursor::new(&out.buf), &mut compressed)
        .map_err(|e| format!("OBD LZMA compress failed: {}", e))?;
    Ok(compressed)
}

fn read_properties_obd(c: &mut Cur, thing: &mut ThingType) -> Result<(), String> {
    loop {
        let flag = c.u8()?;
        if flag == LAST_FLAG {
            return Ok(());
        }
        match flag {
            GROUND => {
                thing.is_ground = true;
                thing.ground_speed = c.u16le()?;
            }
            GROUND_BORDER => thing.is_ground_border = true,
            ON_BOTTOM => thing.is_on_bottom = true,
            ON_TOP => thing.is_on_top = true,
            CONTAINER => thing.is_container = true,
            STACKABLE => thing.stackable = true,
            FORCE_USE => thing.force_use = true,
            MULTI_USE => thing.multi_use = true,
            WRITABLE => {
                thing.writable = true;
                thing.max_text_length = c.u16le()?;
            }
            WRITABLE_ONCE => {
                thing.writable_once = true;
                thing.max_text_length = c.u16le()?;
            }
            FLUID_CONTAINER => thing.is_fluid_container = true,
            FLUID => thing.is_fluid = true,
            UNPASSABLE => thing.is_unpassable = true,
            UNMOVEABLE => thing.is_unmoveable = true,
            BLOCK_MISSILE => thing.block_missile = true,
            BLOCK_PATHFIND => thing.block_pathfind = true,
            NO_MOVE_ANIMATION => thing.no_move_animation = true,
            PICKUPABLE => thing.pickupable = true,
            HANGABLE => thing.hangable = true,
            HOOK_SOUTH => thing.is_vertical = true,
            HOOK_EAST => thing.is_horizontal = true,
            ROTATABLE => thing.rotatable = true,
            HAS_LIGHT => {
                thing.has_light = true;
                thing.light_level = c.u16le()?;
                thing.light_color = c.u16le()?;
            }
            DONT_HIDE => thing.dont_hide = true,
            TRANSLUCENT => thing.is_translucent = true,
            HAS_OFFSET => {
                thing.has_offset = true;
                thing.offset_x = c.i16le()?;
                thing.offset_y = c.i16le()?;
            }
            HAS_ELEVATION => {
                thing.has_elevation = true;
                thing.elevation = c.u16le()?;
            }
            LYING_OBJECT => thing.is_lying_object = true,
            ANIMATE_ALWAYS => thing.animate_always = true,
            MINI_MAP => {
                thing.mini_map = true;
                thing.mini_map_color = c.u16le()?;
            }
            LENS_HELP => {
                thing.is_lens_help = true;
                thing.lens_help = c.u16le()?;
            }
            FULL_GROUND => thing.is_full_ground = true,
            IGNORE_LOOK => thing.ignore_look = true,
            CLOTH => {
                thing.cloth = true;
                thing.cloth_slot = c.u16le()?;
            }
            MARKET_ITEM => {
                thing.is_market_item = true;
                thing.market_category = c.u16le()?;
                thing.market_trade_as = c.u16le()?;
                thing.market_show_as = c.u16le()?;
                let name_len = c.u16le()? as usize;
                let name_bytes = c.take(name_len)?;
                thing.market_name = name_bytes.iter().map(|&b| b as char).collect();
                thing.market_restrict_profession = c.u16le()?;
                thing.market_restrict_level = c.u16le()?;
            }
            DEFAULT_ACTION => {
                thing.has_default_action = true;
                thing.default_action = c.u16le()?;
            }
            HAS_CHARGES => thing.has_charges = true,
            FLOOR_CHANGE => thing.floor_change = true,
            WRAPPABLE => thing.wrappable = true,
            UNWRAPPABLE => thing.unwrappable = true,
            TOP_EFFECT => thing.top_effect = true,
            USABLE => thing.usable = true,
            other => return Err(format!("Unknown OBD flag 0x{:02X}", other)),
        }
    }
}

fn write_properties_obd(out: &mut Out, thing: &ThingType) {
    if thing.is_ground {
        out.u8(GROUND);
        out.u16le(thing.ground_speed);
    } else if thing.is_ground_border {
        out.u8(GROUND_BORDER);
    } else if thing.is_on_bottom {
        out.u8(ON_BOTTOM);
    } else if thing.is_on_top {
        out.u8(ON_TOP);
    }

    if thing.is_container {
        out.u8(CONTAINER);
    }
    if thing.stackable {
        out.u8(STACKABLE);
    }
    if thing.force_use {
        out.u8(FORCE_USE);
    }
    if thing.multi_use {
        out.u8(MULTI_USE);
    }
    if thing.writable {
        out.u8(WRITABLE);
        out.u16le(thing.max_text_length);
    }
    if thing.writable_once {
        out.u8(WRITABLE_ONCE);
        out.u16le(thing.max_text_length);
    }
    if thing.is_fluid_container {
        out.u8(FLUID_CONTAINER);
    }
    if thing.is_fluid {
        out.u8(FLUID);
    }
    if thing.is_unpassable {
        out.u8(UNPASSABLE);
    }
    if thing.is_unmoveable {
        out.u8(UNMOVEABLE);
    }
    if thing.block_missile {
        out.u8(BLOCK_MISSILE);
    }
    if thing.block_pathfind {
        out.u8(BLOCK_PATHFIND);
    }
    if thing.no_move_animation {
        out.u8(NO_MOVE_ANIMATION);
    }
    if thing.pickupable {
        out.u8(PICKUPABLE);
    }
    if thing.hangable {
        out.u8(HANGABLE);
    }
    if thing.is_vertical {
        out.u8(HOOK_SOUTH);
    }
    if thing.is_horizontal {
        out.u8(HOOK_EAST);
    }
    if thing.rotatable {
        out.u8(ROTATABLE);
    }
    if thing.has_light {
        out.u8(HAS_LIGHT);
        out.u16le(thing.light_level);
        out.u16le(thing.light_color);
    }
    if thing.dont_hide {
        out.u8(DONT_HIDE);
    }
    if thing.is_translucent {
        out.u8(TRANSLUCENT);
    }
    if thing.has_offset {
        out.u8(HAS_OFFSET);
        out.i16le(thing.offset_x);
        out.i16le(thing.offset_y);
    }
    if thing.has_elevation {
        out.u8(HAS_ELEVATION);
        out.u16le(thing.elevation);
    }
    if thing.is_lying_object {
        out.u8(LYING_OBJECT);
    }
    if thing.animate_always {
        out.u8(ANIMATE_ALWAYS);
    }
    if thing.mini_map {
        out.u8(MINI_MAP);
        out.u16le(thing.mini_map_color);
    }
    if thing.is_lens_help {
        out.u8(LENS_HELP);
        out.u16le(thing.lens_help);
    }
    if thing.is_full_ground {
        out.u8(FULL_GROUND);
    }
    if thing.ignore_look {
        out.u8(IGNORE_LOOK);
    }
    if thing.cloth {
        out.u8(CLOTH);
        out.u16le(thing.cloth_slot);
    }
    if thing.is_market_item {
        out.u8(MARKET_ITEM);
        out.u16le(thing.market_category);
        out.u16le(thing.market_trade_as);
        out.u16le(thing.market_show_as);
        let name: Vec<u8> = thing.market_name.chars().map(|ch| ch as u8).collect();
        out.u16le(name.len() as u16);
        out.bytes(&name);
        out.u16le(thing.market_restrict_profession);
        out.u16le(thing.market_restrict_level);
    }
    if thing.has_default_action {
        out.u8(DEFAULT_ACTION);
        out.u16le(thing.default_action);
    }
    if thing.wrappable {
        out.u8(WRAPPABLE);
    }
    if thing.unwrappable {
        out.u8(UNWRAPPABLE);
    }
    if thing.top_effect {
        out.u8(TOP_EFFECT);
    }
    if thing.has_charges {
        out.u8(HAS_CHARGES);
    }
    if thing.floor_change {
        out.u8(FLOOR_CHANGE);
    }
    if thing.usable {
        out.u8(USABLE);
    }
    out.u8(LAST_FLAG);
}

fn read_properties_v1(c: &mut Cur, thing: &mut ThingType, client_version: u16) -> Result<(), String> {
    if client_version <= 730 {
        read_properties_v1_flags(c, thing, 1)
    } else if client_version <= 750 {
        read_properties_v1_flags(c, thing, 2)
    } else if client_version <= 772 {
        read_properties_v1_flags(c, thing, 3)
    } else if client_version <= 854 {
        read_properties_v1_flags(c, thing, 4)
    } else if client_version <= 986 {
        read_properties_v1_flags(c, thing, 5)
    } else {
        read_properties_v1_flags(c, thing, 6)
    }
}

fn read_properties_v1_flags(c: &mut Cur, thing: &mut ThingType, set: u8) -> Result<(), String> {
    loop {
        let flag = c.u8()?;
        if flag == 0xFF {
            return Ok(());
        }
        apply_v1_flag(c, thing, set, flag)?;
    }
}

fn read_market(c: &mut Cur, thing: &mut ThingType) -> Result<(), String> {
    thing.is_market_item = true;
    thing.market_category = c.u16le()?;
    thing.market_trade_as = c.u16le()?;
    thing.market_show_as = c.u16le()?;
    let name_len = c.u16le()? as usize;
    let name_bytes = c.take(name_len)?;
    thing.market_name = name_bytes.iter().map(|&b| b as char).collect();
    thing.market_restrict_profession = c.u16le()?;
    thing.market_restrict_level = c.u16le()?;
    Ok(())
}

fn read_bones(c: &mut Cur, thing: &mut ThingType) -> Result<(), String> {
    thing.has_bones = true;
    let mut xs = Vec::with_capacity(4);
    let mut ys = Vec::with_capacity(4);
    for _ in 0..4 {
        xs.push(c.i16le()?);
        ys.push(c.i16le()?);
    }
    thing.bones_offset_x = xs;
    thing.bones_offset_y = ys;
    Ok(())
}

fn apply_v1_flag(c: &mut Cur, thing: &mut ThingType, set: u8, flag: u8) -> Result<(), String> {
    let ok = match set {
        1 => match flag {
            0x00 => { thing.is_ground = true; thing.ground_speed = c.u16le()?; true }
            0x01 => { thing.is_on_bottom = true; true }
            0x02 => { thing.is_on_top = true; true }
            0x03 => { thing.is_container = true; true }
            0x04 => { thing.stackable = true; true }
            0x05 => { thing.multi_use = true; true }
            0x06 => { thing.force_use = true; true }
            0x07 => { thing.writable = true; thing.max_text_length = c.u16le()?; true }
            0x08 => { thing.writable_once = true; thing.max_text_length = c.u16le()?; true }
            0x09 => { thing.is_fluid_container = true; true }
            0x0A => { thing.is_fluid = true; true }
            0x0B => { thing.is_unpassable = true; true }
            0x0C => { thing.is_unmoveable = true; true }
            0x0D => { thing.block_missile = true; true }
            0x0E => { thing.block_pathfind = true; true }
            0x0F => { thing.pickupable = true; true }
            0x10 => { thing.has_light = true; thing.light_level = c.u16le()?; thing.light_color = c.u16le()?; true }
            0x11 => { thing.floor_change = true; true }
            0x12 => { thing.is_full_ground = true; true }
            0x13 => { thing.has_elevation = true; thing.elevation = c.u16le()?; true }
            0x14 => { thing.has_offset = true; thing.offset_x = 8; thing.offset_y = 8; true }
            0x16 => { thing.mini_map = true; thing.mini_map_color = c.u16le()?; true }
            0x17 => { thing.rotatable = true; true }
            0x18 => { thing.is_lying_object = true; true }
            0x19 => { thing.animate_always = true; true }
            0x1A => { thing.is_lens_help = true; thing.lens_help = c.u16le()?; true }
            0x24 => { thing.wrappable = true; true }
            0x25 => { thing.unwrappable = true; true }
            0x26 => { thing.top_effect = true; true }
            _ => false,
        },
        2 => match flag {
            0x00 => { thing.is_ground = true; thing.ground_speed = c.u16le()?; true }
            0x01 => { thing.is_on_bottom = true; true }
            0x02 => { thing.is_on_top = true; true }
            0x03 => { thing.is_container = true; true }
            0x04 => { thing.stackable = true; true }
            0x05 => { thing.multi_use = true; true }
            0x06 => { thing.force_use = true; true }
            0x07 => { thing.writable = true; thing.max_text_length = c.u16le()?; true }
            0x08 => { thing.writable_once = true; thing.max_text_length = c.u16le()?; true }
            0x09 => { thing.is_fluid_container = true; true }
            0x0A => { thing.is_fluid = true; true }
            0x0B => { thing.is_unpassable = true; true }
            0x0C => { thing.is_unmoveable = true; true }
            0x0D => { thing.block_missile = true; true }
            0x0E => { thing.block_pathfind = true; true }
            0x0F => { thing.pickupable = true; true }
            0x10 => { thing.has_light = true; thing.light_level = c.u16le()?; thing.light_color = c.u16le()?; true }
            0x11 => { thing.floor_change = true; true }
            0x12 => { thing.is_full_ground = true; true }
            0x13 => { thing.has_elevation = true; thing.elevation = c.u16le()?; true }
            0x14 => { thing.has_offset = true; thing.offset_x = 8; thing.offset_y = 8; true }
            0x16 => { thing.mini_map = true; thing.mini_map_color = c.u16le()?; true }
            0x17 => { thing.rotatable = true; true }
            0x18 => { thing.is_lying_object = true; true }
            0x19 => { thing.hangable = true; true }
            0x1A => { thing.is_vertical = true; true }
            0x1B => { thing.is_horizontal = true; true }
            0x1C => { thing.animate_always = true; true }
            0x1D => { thing.is_lens_help = true; thing.lens_help = c.u16le()?; true }
            0x24 => { thing.wrappable = true; true }
            0x25 => { thing.unwrappable = true; true }
            0x26 => { thing.top_effect = true; true }
            _ => false,
        },
        3 => match flag {
            0x00 => { thing.is_ground = true; thing.ground_speed = c.u16le()?; true }
            0x01 => { thing.is_ground_border = true; true }
            0x02 => { thing.is_on_bottom = true; true }
            0x03 => { thing.is_on_top = true; true }
            0x04 => { thing.is_container = true; true }
            0x05 => { thing.stackable = true; true }
            0x06 => { thing.force_use = true; true }
            0x07 => { thing.multi_use = true; true }
            0x08 => { thing.writable = true; thing.max_text_length = c.u16le()?; true }
            0x09 => { thing.writable_once = true; thing.max_text_length = c.u16le()?; true }
            0x0A => { thing.is_fluid_container = true; true }
            0x0B => { thing.is_fluid = true; true }
            0x0C => { thing.is_unpassable = true; true }
            0x0D => { thing.is_unmoveable = true; true }
            0x0E => { thing.block_missile = true; true }
            0x0F => { thing.block_pathfind = true; true }
            0x10 => { thing.pickupable = true; true }
            0x11 => { thing.hangable = true; true }
            0x12 => { thing.is_vertical = true; true }
            0x13 => { thing.is_horizontal = true; true }
            0x14 => { thing.rotatable = true; true }
            0x15 => { thing.has_light = true; thing.light_level = c.u16le()?; thing.light_color = c.u16le()?; true }
            0x17 => { thing.floor_change = true; true }
            0x18 => { thing.has_offset = true; thing.offset_x = c.i16le()?; thing.offset_y = c.i16le()?; true }
            0x19 => { thing.has_elevation = true; thing.elevation = c.u16le()?; true }
            0x1A => { thing.is_lying_object = true; true }
            0x1B => { thing.animate_always = true; true }
            0x1C => { thing.mini_map = true; thing.mini_map_color = c.u16le()?; true }
            0x1D => { thing.is_lens_help = true; thing.lens_help = c.u16le()?; true }
            0x1E => { thing.is_full_ground = true; true }
            _ => false,
        },
        4 => match flag {
            0x00 => { thing.is_ground = true; thing.ground_speed = c.u16le()?; true }
            0x01 => { thing.is_ground_border = true; true }
            0x02 => { thing.is_on_bottom = true; true }
            0x03 => { thing.is_on_top = true; true }
            0x04 => { thing.is_container = true; true }
            0x05 => { thing.stackable = true; true }
            0x06 => { thing.force_use = true; true }
            0x07 => { thing.multi_use = true; true }
            0x08 => { thing.has_charges = true; true }
            0x09 => { thing.writable = true; thing.max_text_length = c.u16le()?; true }
            0x0A => { thing.writable_once = true; thing.max_text_length = c.u16le()?; true }
            0x0B => { thing.is_fluid_container = true; true }
            0x0C => { thing.is_fluid = true; true }
            0x0D => { thing.is_unpassable = true; true }
            0x0E => { thing.is_unmoveable = true; true }
            0x0F => { thing.block_missile = true; true }
            0x10 => { thing.block_pathfind = true; true }
            0x11 => { thing.pickupable = true; true }
            0x12 => { thing.hangable = true; true }
            0x13 => { thing.is_vertical = true; true }
            0x14 => { thing.is_horizontal = true; true }
            0x15 => { thing.rotatable = true; true }
            0x16 => { thing.has_light = true; thing.light_level = c.u16le()?; thing.light_color = c.u16le()?; true }
            0x17 => { thing.dont_hide = true; true }
            0x18 => { thing.floor_change = true; true }
            0x19 => { thing.has_offset = true; thing.offset_x = c.i16le()?; thing.offset_y = c.i16le()?; true }
            0x1A => { thing.has_elevation = true; thing.elevation = c.u16le()?; true }
            0x1B => { thing.is_lying_object = true; true }
            0x1C => { thing.animate_always = true; true }
            0x1D => { thing.mini_map = true; thing.mini_map_color = c.u16le()?; true }
            0x1E => { thing.is_lens_help = true; thing.lens_help = c.u16le()?; true }
            0x1F => { thing.is_full_ground = true; true }
            0x20 => { thing.ignore_look = true; true }
            0x24 => { thing.wrappable = true; true }
            0x25 => { thing.unwrappable = true; true }
            0x27 => { read_bones(c, thing)?; true }
            _ => false,
        },
        5 => match flag {
            0x00 => { thing.is_ground = true; thing.ground_speed = c.u16le()?; true }
            0x01 => { thing.is_ground_border = true; true }
            0x02 => { thing.is_on_bottom = true; true }
            0x03 => { thing.is_on_top = true; true }
            0x04 => { thing.is_container = true; true }
            0x05 => { thing.stackable = true; true }
            0x06 => { thing.force_use = true; true }
            0x07 => { thing.multi_use = true; true }
            0x08 => { thing.writable = true; thing.max_text_length = c.u16le()?; true }
            0x09 => { thing.writable_once = true; thing.max_text_length = c.u16le()?; true }
            0x0A => { thing.is_fluid_container = true; true }
            0x0B => { thing.is_fluid = true; true }
            0x0C => { thing.is_unpassable = true; true }
            0x0D => { thing.is_unmoveable = true; true }
            0x0E => { thing.block_missile = true; true }
            0x0F => { thing.block_pathfind = true; true }
            0x10 => { thing.pickupable = true; true }
            0x11 => { thing.hangable = true; true }
            0x12 => { thing.is_vertical = true; true }
            0x13 => { thing.is_horizontal = true; true }
            0x14 => { thing.rotatable = true; true }
            0x15 => { thing.has_light = true; thing.light_level = c.u16le()?; thing.light_color = c.u16le()?; true }
            0x16 => { thing.dont_hide = true; true }
            0x17 => { thing.is_translucent = true; true }
            0x18 => { thing.has_offset = true; thing.offset_x = c.i16le()?; thing.offset_y = c.i16le()?; true }
            0x19 => { thing.has_elevation = true; thing.elevation = c.u16le()?; true }
            0x1A => { thing.is_lying_object = true; true }
            0x1B => { thing.animate_always = true; true }
            0x1C => { thing.mini_map = true; thing.mini_map_color = c.u16le()?; true }
            0x1D => { thing.is_lens_help = true; thing.lens_help = c.u16le()?; true }
            0x1E => { thing.is_full_ground = true; true }
            0x1F => { thing.ignore_look = true; true }
            0x20 => { thing.cloth = true; thing.cloth_slot = c.u16le()?; true }
            0x21 => { read_market(c, thing)?; true }
            0x27 => { read_bones(c, thing)?; true }
            _ => false,
        },
        _ => match flag {
            0x00 => { thing.is_ground = true; thing.ground_speed = c.u16le()?; true }
            0x01 => { thing.is_ground_border = true; true }
            0x02 => { thing.is_on_bottom = true; true }
            0x03 => { thing.is_on_top = true; true }
            0x04 => { thing.is_container = true; true }
            0x05 => { thing.stackable = true; true }
            0x06 => { thing.force_use = true; true }
            0x07 => { thing.multi_use = true; true }
            0x08 => { thing.writable = true; thing.max_text_length = c.u16le()?; true }
            0x09 => { thing.writable_once = true; thing.max_text_length = c.u16le()?; true }
            0x0A => { thing.is_fluid_container = true; true }
            0x0B => { thing.is_fluid = true; true }
            0x0C => { thing.is_unpassable = true; true }
            0x0D => { thing.is_unmoveable = true; true }
            0x0E => { thing.block_missile = true; true }
            0x0F => { thing.block_pathfind = true; true }
            0x10 => { thing.no_move_animation = true; true }
            0x11 => { thing.pickupable = true; true }
            0x12 => { thing.hangable = true; true }
            0x13 => { thing.is_vertical = true; true }
            0x14 => { thing.is_horizontal = true; true }
            0x15 => { thing.rotatable = true; true }
            0x16 => { thing.has_light = true; thing.light_level = c.u16le()?; thing.light_color = c.u16le()?; true }
            0x17 => { thing.dont_hide = true; true }
            0x18 => { thing.is_translucent = true; true }
            0x19 => { thing.has_offset = true; thing.offset_x = c.i16le()?; thing.offset_y = c.i16le()?; true }
            0x1A => { thing.has_elevation = true; thing.elevation = c.u16le()?; true }
            0x1B => { thing.is_lying_object = true; true }
            0x1C => { thing.animate_always = true; true }
            0x1D => { thing.mini_map = true; thing.mini_map_color = c.u16le()?; true }
            0x1E => { thing.is_lens_help = true; thing.lens_help = c.u16le()?; true }
            0x1F => { thing.is_full_ground = true; true }
            0x20 => { thing.ignore_look = true; true }
            0x21 => { thing.cloth = true; thing.cloth_slot = c.u16le()?; true }
            0x22 => { read_market(c, thing)?; true }
            0x23 => { thing.has_default_action = true; thing.default_action = c.u16le()?; true }
            0x24 => { thing.wrappable = true; true }
            0x25 => { thing.unwrappable = true; true }
            0x26 => { thing.top_effect = true; true }
            0x27 => { read_bones(c, thing)?; true }
            0xFE => { thing.usable = true; true }
            _ => false,
        },
    };
    if ok {
        Ok(())
    } else {
        Err(format!("Unknown OBD V1 flag 0x{:02X} (set {})", flag, set))
    }
}
