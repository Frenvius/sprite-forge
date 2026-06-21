use std::fs;
use std::path::PathBuf;
use serde::{Serialize, Deserialize};

const NODE_START: u8 = 0xFE;
const NODE_END: u8 = 0xFF;
const ESCAPE: u8 = 0xFD;

const ROOT_ATTR_VERSION: u8 = 0x01;

const ATTR_SERVER_ID: u8 = 0x10;
const ATTR_CLIENT_ID: u8 = 0x11;
const ATTR_NAME: u8 = 0x12;
const ATTR_GROUND_SPEED: u8 = 0x14;
const ATTR_SPRITE_HASH: u8 = 0x20;
const ATTR_MINIMAP_COLOR: u8 = 0x21;
const ATTR_MAX_READ_WRITE_CHARS: u8 = 0x22;
const ATTR_MAX_READ_CHARS: u8 = 0x23;
const ATTR_LIGHT: u8 = 0x2A;
const ATTR_STACK_ORDER: u8 = 0x2B;
const ATTR_TRADE_AS: u8 = 0x2D;

const GROUP_DEPRECATED: u8 = 14;

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct OtbItem {
    pub server_id: u16,
    pub client_id: u16,
    #[serde(rename = "type")]
    pub group: u8,

    pub unpassable: bool,
    pub block_missiles: bool,
    pub block_pathfinder: bool,
    pub has_elevation: bool,
    pub multi_use: bool,
    pub pickupable: bool,
    pub movable: bool,
    pub stackable: bool,
    pub floor_change_down: bool,
    pub floor_change_north: bool,
    pub floor_change_east: bool,
    pub floor_change_south: bool,
    pub floor_change_west: bool,
    pub has_stack_order: bool,
    pub readable: bool,
    pub rotatable: bool,
    pub hangable: bool,
    pub hook_south: bool,
    pub hook_east: bool,
    pub can_not_decay: bool,
    pub allow_distance_read: bool,
    pub client_charges: bool,
    pub ignore_look: bool,
    pub is_animation: bool,
    pub full_ground: bool,
    pub force_use: bool,

    pub name: String,
    pub ground_speed: u16,
    pub light_level: u16,
    pub light_color: u16,
    pub minimap_color: u16,
    pub max_read_chars: u16,
    pub max_read_write_chars: u16,
    pub stack_order: u8,
    pub trade_as: u16,
    pub sprite_hash: Vec<u8>,
}

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct OtbFile {
    pub major_version: u32,
    pub minor_version: u32,
    pub build_number: u32,
    pub items: Vec<OtbItem>,
}

struct Node {
    type_byte: u8,
    data: Vec<u8>,
    children: Vec<Node>,
}

fn parse_node(b: &[u8], pos: &mut usize) -> Result<Node, String> {
    if *pos >= b.len() || b[*pos] != NODE_START {
        return Err(format!("Expected node start at offset {}", *pos));
    }
    *pos += 1;
    if *pos >= b.len() {
        return Err("Unexpected end of OTB after node start".to_string());
    }
    let type_byte = b[*pos];
    *pos += 1;

    let mut data = Vec::new();
    let mut children = Vec::new();

    loop {
        if *pos >= b.len() {
            return Err("Unexpected end of OTB inside node".to_string());
        }
        let c = b[*pos];
        match c {
            ESCAPE => {
                *pos += 1;
                if *pos >= b.len() {
                    return Err("Unexpected end of OTB after escape".to_string());
                }
                data.push(b[*pos]);
                *pos += 1;
            }
            NODE_START => {
                let child = parse_node(b, pos)?;
                children.push(child);
            }
            NODE_END => {
                *pos += 1;
                break;
            }
            other => {
                data.push(other);
                *pos += 1;
            }
        }
    }

    Ok(Node { type_byte, data, children })
}

fn rd_u16(d: &[u8], o: &mut usize) -> Result<u16, String> {
    if *o + 2 > d.len() {
        return Err("Attribute truncated (u16)".to_string());
    }
    let v = u16::from_le_bytes([d[*o], d[*o + 1]]);
    *o += 2;
    Ok(v)
}

fn rd_u32(d: &[u8], o: &mut usize) -> Result<u32, String> {
    if *o + 4 > d.len() {
        return Err("Attribute truncated (u32)".to_string());
    }
    let v = u32::from_le_bytes([d[*o], d[*o + 1], d[*o + 2], d[*o + 3]]);
    *o += 4;
    Ok(v)
}

fn parse_item(node: &Node) -> Result<OtbItem, String> {
    let d = &node.data;
    let mut o = 0usize;
    let flags = rd_u32(d, &mut o)?;

    let mut item = OtbItem::default();
    item.group = node.type_byte;

    item.unpassable = flags & (1 << 0) != 0;
    item.block_missiles = flags & (1 << 1) != 0;
    item.block_pathfinder = flags & (1 << 2) != 0;
    item.has_elevation = flags & (1 << 3) != 0;
    item.multi_use = flags & (1 << 4) != 0;
    item.pickupable = flags & (1 << 5) != 0;
    item.movable = flags & (1 << 6) != 0;
    item.stackable = flags & (1 << 7) != 0;
    item.floor_change_down = flags & (1 << 8) != 0;
    item.floor_change_north = flags & (1 << 9) != 0;
    item.floor_change_east = flags & (1 << 10) != 0;
    item.floor_change_south = flags & (1 << 11) != 0;
    item.floor_change_west = flags & (1 << 12) != 0;
    item.has_stack_order = flags & (1 << 13) != 0;
    item.readable = flags & (1 << 14) != 0;
    item.rotatable = flags & (1 << 15) != 0;
    item.hangable = flags & (1 << 16) != 0;
    item.hook_south = flags & (1 << 17) != 0;
    item.hook_east = flags & (1 << 18) != 0;
    item.can_not_decay = flags & (1 << 19) != 0;
    item.allow_distance_read = flags & (1 << 20) != 0;
    item.client_charges = flags & (1 << 22) != 0;
    item.ignore_look = flags & (1 << 23) != 0;
    item.is_animation = flags & (1 << 24) != 0;
    item.full_ground = flags & (1 << 25) != 0;
    item.force_use = flags & (1 << 26) != 0;

    while o < d.len() {
        let attr = d[o];
        o += 1;
        let len = rd_u16(d, &mut o)? as usize;
        if o + len > d.len() {
            return Err(format!("Attribute 0x{:02X} value truncated", attr));
        }
        let value = &d[o..o + len];
        match attr {
            ATTR_SERVER_ID => item.server_id = u16::from_le_bytes([value[0], value[1]]),
            ATTR_CLIENT_ID => item.client_id = u16::from_le_bytes([value[0], value[1]]),
            ATTR_GROUND_SPEED => item.ground_speed = u16::from_le_bytes([value[0], value[1]]),
            ATTR_NAME => item.name = String::from_utf8_lossy(value).into_owned(),
            ATTR_SPRITE_HASH => item.sprite_hash = value.to_vec(),
            ATTR_MINIMAP_COLOR => item.minimap_color = u16::from_le_bytes([value[0], value[1]]),
            ATTR_MAX_READ_WRITE_CHARS => item.max_read_write_chars = u16::from_le_bytes([value[0], value[1]]),
            ATTR_MAX_READ_CHARS => item.max_read_chars = u16::from_le_bytes([value[0], value[1]]),
            ATTR_LIGHT => {
                item.light_level = u16::from_le_bytes([value[0], value[1]]);
                item.light_color = u16::from_le_bytes([value[2], value[3]]);
            }
            ATTR_STACK_ORDER => item.stack_order = value[0],
            ATTR_TRADE_AS => item.trade_as = u16::from_le_bytes([value[0], value[1]]),
            _ => {}
        }
        o += len;
    }

    if item.sprite_hash.is_empty() && item.group != GROUP_DEPRECATED {
        item.sprite_hash = vec![0u8; 16];
    }

    Ok(item)
}

pub fn decode_otb(bytes: &[u8]) -> Result<OtbFile, String> {
    if bytes.len() < 5 {
        return Err("OTB file too small".to_string());
    }

    let mut pos = 4usize;
    let root = parse_node(bytes, &mut pos)?;

    let mut file = OtbFile::default();

    let d = &root.data;
    let mut o = 4usize.min(d.len());
    if o < d.len() && d[o] == ROOT_ATTR_VERSION {
        o += 1;
        let len = rd_u16(d, &mut o)? as usize;
        if len >= 12 && o + len <= d.len() {
            file.major_version = rd_u32(d, &mut o)?;
            file.minor_version = rd_u32(d, &mut o)?;
            file.build_number = rd_u32(d, &mut o)?;
        }
    }

    file.items.reserve(root.children.len());
    for child in &root.children {
        file.items.push(parse_item(child)?);
    }

    Ok(file)
}

fn pack_flags(it: &OtbItem) -> u32 {
    let mut f = 0u32;
    if it.unpassable { f |= 1 << 0; }
    if it.block_missiles { f |= 1 << 1; }
    if it.block_pathfinder { f |= 1 << 2; }
    if it.has_elevation { f |= 1 << 3; }
    if it.multi_use { f |= 1 << 4; }
    if it.pickupable { f |= 1 << 5; }
    if it.movable { f |= 1 << 6; }
    if it.stackable { f |= 1 << 7; }
    if it.floor_change_down { f |= 1 << 8; }
    if it.floor_change_north { f |= 1 << 9; }
    if it.floor_change_east { f |= 1 << 10; }
    if it.floor_change_south { f |= 1 << 11; }
    if it.floor_change_west { f |= 1 << 12; }
    if it.has_stack_order { f |= 1 << 13; }
    if it.readable { f |= 1 << 14; }
    if it.rotatable { f |= 1 << 15; }
    if it.hangable { f |= 1 << 16; }
    if it.hook_south { f |= 1 << 17; }
    if it.hook_east { f |= 1 << 18; }
    if it.can_not_decay { f |= 1 << 19; }
    if it.allow_distance_read { f |= 1 << 20; }
    if it.client_charges { f |= 1 << 22; }
    if it.ignore_look { f |= 1 << 23; }
    if it.is_animation { f |= 1 << 24; }
    if it.full_ground { f |= 1 << 25; }
    if it.force_use { f |= 1 << 26; }
    f
}

pub fn encode_otb_bin(f: &OtbFile) -> Vec<u8> {
    let mut o = Vec::with_capacity(16 + f.items.len() * 40);
    o.extend_from_slice(&f.major_version.to_le_bytes());
    o.extend_from_slice(&f.minor_version.to_le_bytes());
    o.extend_from_slice(&f.build_number.to_le_bytes());
    o.extend_from_slice(&(f.items.len() as u32).to_le_bytes());
    for it in &f.items {
        o.extend_from_slice(&it.server_id.to_le_bytes());
        o.extend_from_slice(&it.client_id.to_le_bytes());
        o.push(it.group);
        o.extend_from_slice(&pack_flags(it).to_le_bytes());
        o.extend_from_slice(&it.ground_speed.to_le_bytes());
        o.extend_from_slice(&it.light_level.to_le_bytes());
        o.extend_from_slice(&it.light_color.to_le_bytes());
        o.extend_from_slice(&it.minimap_color.to_le_bytes());
        o.extend_from_slice(&it.max_read_chars.to_le_bytes());
        o.extend_from_slice(&it.max_read_write_chars.to_le_bytes());
        o.extend_from_slice(&it.trade_as.to_le_bytes());
        o.push(it.stack_order);
        o.push(it.sprite_hash.len().min(255) as u8);
        o.extend_from_slice(&it.sprite_hash);
        let nb = it.name.as_bytes();
        o.extend_from_slice(&(nb.len() as u16).to_le_bytes());
        o.extend_from_slice(nb);
    }
    o
}

#[tauri::command]
pub fn read_otb_file(path: String) -> Result<tauri::ipc::Response, String> {
    let bytes = fs::read(&path).map_err(|e| format!("Failed to read OTB {}: {}", path, e))?;
    let file = decode_otb(&bytes)?;
    Ok(tauri::ipc::Response::new(encode_otb_bin(&file)))
}

fn push_escaped(out: &mut Vec<u8>, b: u8) {
    if b == NODE_START || b == NODE_END || b == ESCAPE {
        out.push(ESCAPE);
    }
    out.push(b);
}

fn write_u16(out: &mut Vec<u8>, v: u16) {
    for b in v.to_le_bytes() {
        push_escaped(out, b);
    }
}

fn write_u32(out: &mut Vec<u8>, v: u32) {
    for b in v.to_le_bytes() {
        push_escaped(out, b);
    }
}

fn write_prop(out: &mut Vec<u8>, attr: u8, value: &[u8]) {
    push_escaped(out, attr);
    write_u16(out, value.len() as u16);
    for &b in value {
        push_escaped(out, b);
    }
}

fn build_flags(item: &OtbItem) -> u32 {
    let mut f = 0u32;
    if item.unpassable { f |= 1 << 0; }
    if item.block_missiles { f |= 1 << 1; }
    if item.block_pathfinder { f |= 1 << 2; }
    if item.has_elevation { f |= 1 << 3; }
    if item.multi_use { f |= 1 << 4; }
    if item.pickupable { f |= 1 << 5; }
    if item.movable { f |= 1 << 6; }
    if item.stackable { f |= 1 << 7; }
    if item.floor_change_down { f |= 1 << 8; }
    if item.floor_change_north { f |= 1 << 9; }
    if item.floor_change_east { f |= 1 << 10; }
    if item.floor_change_south { f |= 1 << 11; }
    if item.floor_change_west { f |= 1 << 12; }
    if item.stack_order != 0 { f |= 1 << 13; }
    if item.readable { f |= 1 << 14; }
    if item.rotatable { f |= 1 << 15; }
    if item.hangable { f |= 1 << 16; }
    if item.hook_south { f |= 1 << 17; }
    if item.hook_east { f |= 1 << 18; }
    if item.can_not_decay { f |= 1 << 19; }
    if item.allow_distance_read { f |= 1 << 20; }
    if item.client_charges { f |= 1 << 22; }
    if item.ignore_look { f |= 1 << 23; }
    if item.is_animation { f |= 1 << 24; }
    if item.full_ground { f |= 1 << 25; }
    if item.force_use { f |= 1 << 26; }
    f
}

fn write_item_node(out: &mut Vec<u8>, item: &OtbItem) {
    out.push(NODE_START);
    push_escaped(out, item.group);
    write_u32(out, build_flags(item));

    let deprecated = item.group == GROUP_DEPRECATED;

    write_prop(out, ATTR_SERVER_ID, &item.server_id.to_le_bytes());

    if !deprecated {
        write_prop(out, ATTR_CLIENT_ID, &item.client_id.to_le_bytes());

        let mut hash = item.sprite_hash.clone();
        hash.resize(16, 0);
        write_prop(out, ATTR_SPRITE_HASH, &hash);

        if item.minimap_color != 0 {
            write_prop(out, ATTR_MINIMAP_COLOR, &item.minimap_color.to_le_bytes());
        }
        if item.max_read_write_chars != 0 {
            write_prop(out, ATTR_MAX_READ_WRITE_CHARS, &item.max_read_write_chars.to_le_bytes());
        }
        if item.max_read_chars != 0 {
            write_prop(out, ATTR_MAX_READ_CHARS, &item.max_read_chars.to_le_bytes());
        }
        if item.light_level != 0 || item.light_color != 0 {
            let mut light = Vec::with_capacity(4);
            light.extend_from_slice(&item.light_level.to_le_bytes());
            light.extend_from_slice(&item.light_color.to_le_bytes());
            write_prop(out, ATTR_LIGHT, &light);
        }
        if item.ground_speed != 0 {
            write_prop(out, ATTR_GROUND_SPEED, &item.ground_speed.to_le_bytes());
        }
        if item.stack_order != 0 {
            write_prop(out, ATTR_STACK_ORDER, &[item.stack_order]);
        }
        if item.trade_as != 0 {
            write_prop(out, ATTR_TRADE_AS, &item.trade_as.to_le_bytes());
        }
        if !item.name.is_empty() {
            write_prop(out, ATTR_NAME, item.name.as_bytes());
        }
    }

    out.push(NODE_END);
}

pub fn encode_otb(data: &OtbFile) -> Vec<u8> {
    let mut out: Vec<u8> = Vec::with_capacity(data.items.len() * 40 + 256);

    out.extend_from_slice(&0u32.to_le_bytes());

    out.push(NODE_START);
    push_escaped(&mut out, 0);
    write_u32(&mut out, 0);

    let csd = format!(
        "OTB {}.{}.{}",
        data.major_version, data.minor_version, data.build_number
    );
    let mut prop = Vec::with_capacity(140);
    prop.extend_from_slice(&data.major_version.to_le_bytes());
    prop.extend_from_slice(&data.minor_version.to_le_bytes());
    prop.extend_from_slice(&data.build_number.to_le_bytes());
    let mut csd_bytes = csd.into_bytes();
    csd_bytes.resize(128, 0);
    prop.extend_from_slice(&csd_bytes);
    write_prop(&mut out, ROOT_ATTR_VERSION, &prop);

    for item in &data.items {
        write_item_node(&mut out, item);
    }

    out.push(NODE_END);
    out
}

#[tauri::command]
pub fn write_otb_file(path: String, data: OtbFile) -> Result<(), String> {
    let out = encode_otb(&data);

    let target = PathBuf::from(&path);
    let parent = target.parent().ok_or_else(|| format!("Invalid path: {}", path))?;
    let file_name = target
        .file_name()
        .ok_or_else(|| format!("Invalid path: {}", path))?
        .to_string_lossy()
        .into_owned();
    let tmp = parent.join(format!(".{}.tmp", file_name));

    fs::write(&tmp, &out).map_err(|e| format!("Failed to write temp OTB for {}: {}", path, e))?;
    if let Err(e) = fs::rename(&tmp, &target) {
        let _ = fs::remove_file(&tmp);
        return Err(format!("Failed to commit OTB file {}: {}", path, e));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trips_with_escape_bytes() {
        let mut a = OtbItem::default();
        a.server_id = 0xFEFE;
        a.client_id = 0xFFFD;
        a.group = SERVER_ITEM_TYPE_GROUND;
        a.stackable = true;
        a.movable = true;
        a.force_use = true;
        a.is_animation = true;
        a.ground_speed = 0xFDFE;
        a.light_level = 5;
        a.light_color = 215;
        a.minimap_color = 42;
        a.stack_order = 3;
        a.trade_as = 7;
        a.name = "magic\u{00FD}coin".to_string();
        a.sprite_hash = (0..16u8).collect();

        let mut b = OtbItem::default();
        b.server_id = 2;
        b.group = 14;
        b.client_id = 999;

        let file = OtbFile {
            major_version: 3,
            minor_version: 860,
            build_number: 1,
            items: vec![a.clone(), b],
        };

        let bytes = encode_otb(&file);
        let decoded = decode_otb(&bytes).expect("decode");

        assert_eq!(decoded.major_version, 3);
        assert_eq!(decoded.minor_version, 860);
        assert_eq!(decoded.items.len(), 2);

        let da = &decoded.items[0];
        assert_eq!(da.server_id, a.server_id);
        assert_eq!(da.client_id, a.client_id);
        assert_eq!(da.group, a.group);
        assert!(da.stackable && da.movable && da.force_use && da.is_animation);
        assert_eq!(da.ground_speed, a.ground_speed);
        assert_eq!(da.light_level, 5);
        assert_eq!(da.light_color, 215);
        assert_eq!(da.minimap_color, 42);
        assert_eq!(da.stack_order, 3);
        assert!(da.has_stack_order);
        assert_eq!(da.trade_as, 7);
        assert_eq!(da.name, a.name);
        assert_eq!(da.sprite_hash, a.sprite_hash);

        let db = &decoded.items[1];
        assert_eq!(db.server_id, 2);
        assert_eq!(db.group, 14);
        assert_eq!(db.client_id, 0);
    }

    const SERVER_ITEM_TYPE_GROUND: u8 = 1;
}
