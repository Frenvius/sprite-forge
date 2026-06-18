use std::fs::File;
use std::io::{self, Read, BufReader};
use crate::dat_writer::{ThingType, FrameDuration, FrameGroup};

pub fn encode_dat_to_binary(
    signature: u32,
    items: &[ThingType],
    outfits: &[ThingType],
    effects: &[ThingType],
    missiles: &[ThingType],
) -> Vec<u8> {
    let thing_count = items.len() + outfits.len() + effects.len() + missiles.len();
    let mut buffer = Vec::with_capacity(20 + thing_count * 150);

    buffer.extend_from_slice(&signature.to_le_bytes());
    buffer.extend_from_slice(&(items.len() as u32).to_le_bytes());
    buffer.extend_from_slice(&(outfits.len() as u32).to_le_bytes());
    buffer.extend_from_slice(&(effects.len() as u32).to_le_bytes());
    buffer.extend_from_slice(&(missiles.len() as u32).to_le_bytes());

    for thing in items { encode_thing(&mut buffer, thing); }
    for thing in outfits { encode_thing(&mut buffer, thing); }
    for thing in effects { encode_thing(&mut buffer, thing); }
    for thing in missiles { encode_thing(&mut buffer, thing); }

    buffer
}

fn encode_thing(buffer: &mut Vec<u8>, thing: &ThingType) {
    buffer.extend_from_slice(&thing.id.to_le_bytes());
    buffer.push(thing.width);
    buffer.push(thing.height);
    buffer.push(thing.exact_size);
    buffer.push(thing.layers);
    buffer.push(thing.pattern_x);
    buffer.push(thing.pattern_y);
    buffer.push(thing.pattern_z);
    buffer.push(thing.frames);

    let flags = encode_flags(thing);
    buffer.extend_from_slice(&flags.to_le_bytes());

    buffer.extend_from_slice(&(thing.sprite_index.len() as u16).to_le_bytes());
    for &sprite_id in &thing.sprite_index {
        buffer.extend_from_slice(&sprite_id.to_le_bytes());
    }

    if thing.is_ground {
        buffer.extend_from_slice(&thing.ground_speed.to_le_bytes());
    }
    if thing.has_light {
        buffer.extend_from_slice(&thing.light_level.to_le_bytes());
        buffer.extend_from_slice(&thing.light_color.to_le_bytes());
    }
    if thing.has_offset {
        buffer.extend_from_slice(&thing.offset_x.to_le_bytes());
        buffer.extend_from_slice(&thing.offset_y.to_le_bytes());
    }
    if thing.has_elevation {
        buffer.extend_from_slice(&thing.elevation.to_le_bytes());
    }
    if thing.mini_map {
        buffer.extend_from_slice(&thing.mini_map_color.to_le_bytes());
    }
    if thing.is_lens_help {
        buffer.extend_from_slice(&thing.lens_help.to_le_bytes());
    }
    if thing.cloth {
        buffer.extend_from_slice(&thing.cloth_slot.to_le_bytes());
    }
    if thing.is_market_item {
        buffer.extend_from_slice(&thing.market_category.to_le_bytes());
        buffer.extend_from_slice(&thing.market_trade_as.to_le_bytes());
        buffer.extend_from_slice(&thing.market_show_as.to_le_bytes());
        buffer.extend_from_slice(&thing.market_restrict_profession.to_le_bytes());
        buffer.extend_from_slice(&thing.market_restrict_level.to_le_bytes());
        let name_bytes = thing.market_name.as_bytes();
        buffer.extend_from_slice(&(name_bytes.len() as u16).to_le_bytes());
        buffer.extend_from_slice(name_bytes);
    }
    if thing.has_default_action {
        buffer.extend_from_slice(&thing.default_action.to_le_bytes());
    }
    if thing.writable || thing.writable_once {
        buffer.extend_from_slice(&thing.max_text_length.to_le_bytes());
    }
    if thing.has_bones {
        for i in 0..4 {
            let x = thing.bones_offset_x.get(i).copied().unwrap_or(0);
            let y = thing.bones_offset_y.get(i).copied().unwrap_or(0);
            buffer.extend_from_slice(&x.to_le_bytes());
            buffer.extend_from_slice(&y.to_le_bytes());
        }
    }

    if thing.is_animation && !thing.frame_durations.is_empty() {
        buffer.push(thing.animation_mode);
        buffer.extend_from_slice(&thing.loop_count.to_le_bytes());
        buffer.push(thing.start_frame as u8);
        buffer.push(thing.frame_durations.len() as u8);
        for fd in &thing.frame_durations {
            buffer.extend_from_slice(&fd.minimum.to_le_bytes());
            buffer.extend_from_slice(&fd.maximum.to_le_bytes());
        }
    }

    match &thing.frame_groups_data {
        Some(groups) if !groups.is_empty() => {
            buffer.push(1);
            buffer.push(groups.len() as u8);
            for g in groups {
                buffer.push(g.r#type);
                buffer.push(g.width);
                buffer.push(g.height);
                buffer.push(g.exact_size);
                buffer.push(g.layers);
                buffer.push(g.pattern_x);
                buffer.push(g.pattern_y);
                buffer.push(g.pattern_z);
                buffer.push(g.frames);

                buffer.extend_from_slice(&(g.sprite_index.len() as u16).to_le_bytes());
                for &sid in &g.sprite_index {
                    buffer.extend_from_slice(&sid.to_le_bytes());
                }

                let has_anim = g.is_animation
                    && g.frame_durations.as_ref().map_or(false, |d| !d.is_empty());
                if has_anim {
                    let durs = g.frame_durations.as_ref().unwrap();
                    buffer.push(1);
                    buffer.push(g.animation_mode.unwrap_or(0));
                    buffer.extend_from_slice(&g.loop_count.unwrap_or(0).to_le_bytes());
                    buffer.push(g.start_frame.unwrap_or(0) as u8);
                    buffer.push(durs.len() as u8);
                    for fd in durs {
                        buffer.extend_from_slice(&fd.minimum.to_le_bytes());
                        buffer.extend_from_slice(&fd.maximum.to_le_bytes());
                    }
                } else {
                    buffer.push(0);
                }
            }
        }
        _ => {
            buffer.push(0);
        }
    }
}

fn encode_flags(thing: &ThingType) -> u64 {
    let mut flags: u64 = 0;
    if thing.is_ground          { flags |= 1 << 0; }
    if thing.is_ground_border   { flags |= 1 << 1; }
    if thing.is_on_bottom       { flags |= 1 << 2; }
    if thing.is_on_top          { flags |= 1 << 3; }
    if thing.is_container       { flags |= 1 << 4; }
    if thing.stackable          { flags |= 1 << 5; }
    if thing.force_use          { flags |= 1 << 6; }
    if thing.multi_use          { flags |= 1 << 7; }
    if thing.has_charges        { flags |= 1 << 8; }
    if thing.writable           { flags |= 1 << 9; }
    if thing.writable_once      { flags |= 1 << 10; }
    if thing.is_fluid_container { flags |= 1 << 11; }
    if thing.is_fluid           { flags |= 1 << 12; }
    if thing.is_unpassable      { flags |= 1 << 13; }
    if thing.is_unmoveable      { flags |= 1 << 14; }
    if thing.block_missile      { flags |= 1 << 15; }
    if thing.block_pathfind     { flags |= 1 << 16; }
    if thing.no_move_animation  { flags |= 1 << 17; }
    if thing.pickupable         { flags |= 1 << 18; }
    if thing.hangable           { flags |= 1 << 19; }
    if thing.is_vertical        { flags |= 1 << 20; }
    if thing.is_horizontal      { flags |= 1 << 21; }
    if thing.rotatable          { flags |= 1 << 22; }
    if thing.has_light          { flags |= 1 << 23; }
    if thing.dont_hide          { flags |= 1 << 24; }
    if thing.floor_change       { flags |= 1 << 25; }
    if thing.is_translucent     { flags |= 1 << 26; }
    if thing.has_offset         { flags |= 1 << 27; }
    if thing.has_elevation      { flags |= 1 << 28; }
    if thing.is_lying_object    { flags |= 1 << 29; }
    if thing.animate_always     { flags |= 1 << 30; }
    if thing.mini_map           { flags |= 1 << 31; }
    if thing.is_lens_help       { flags |= 1 << 32; }
    if thing.is_full_ground     { flags |= 1 << 33; }
    if thing.ignore_look        { flags |= 1 << 34; }
    if thing.cloth              { flags |= 1 << 35; }
    if thing.is_market_item     { flags |= 1 << 36; }
    if thing.has_default_action { flags |= 1 << 37; }
    if thing.usable             { flags |= 1 << 38; }
    if thing.wrappable          { flags |= 1 << 39; }
    if thing.unwrappable        { flags |= 1 << 40; }
    if thing.top_effect         { flags |= 1 << 41; }
    if thing.is_animation && !thing.frame_durations.is_empty() { flags |= 1 << 42; }
    if thing.has_bones          { flags |= 1 << 43; }
    flags
}

struct MetadataFlags1;
#[allow(dead_code)]
impl MetadataFlags1 {
    const GROUND: u8 = 0x00;
    const ON_BOTTOM: u8 = 0x01;
    const ON_TOP: u8 = 0x02;
    const CONTAINER: u8 = 0x03;
    const STACKABLE: u8 = 0x04;
    const MULTI_USE: u8 = 0x05;
    const FORCE_USE: u8 = 0x06;
    const WRITABLE: u8 = 0x07;
    const WRITABLE_ONCE: u8 = 0x08;
    const FLUID_CONTAINER: u8 = 0x09;
    const FLUID: u8 = 0x0A;
    const UNPASSABLE: u8 = 0x0B;
    const UNMOVEABLE: u8 = 0x0C;
    const BLOCK_MISSILE: u8 = 0x0D;
    const BLOCK_PATHFIND: u8 = 0x0E;
    const PICKUPABLE: u8 = 0x0F;
    const HAS_LIGHT: u8 = 0x10;
    const FLOOR_CHANGE: u8 = 0x11;
    const FULL_GROUND: u8 = 0x12;
    const HAS_ELEVATION: u8 = 0x13;
    const HAS_OFFSET: u8 = 0x14;
    const MINI_MAP: u8 = 0x16;
    const ROTATABLE: u8 = 0x17;
    const LYING_OBJECT: u8 = 0x18;
    const ANIMATE_ALWAYS: u8 = 0x19;
    const LENS_HELP: u8 = 0x1A;
    const WRAPPABLE: u8 = 0x24;
    const UNWRAPPABLE: u8 = 0x25;
    const TOP_EFFECT: u8 = 0x26;
    const LAST_FLAG: u8 = 0xFF;
}

struct MetadataFlags2;
#[allow(dead_code)]
impl MetadataFlags2 {
    const GROUND: u8 = 0x00;
    const ON_BOTTOM: u8 = 0x01;
    const ON_TOP: u8 = 0x02;
    const CONTAINER: u8 = 0x03;
    const STACKABLE: u8 = 0x04;
    const MULTI_USE: u8 = 0x05;
    const FORCE_USE: u8 = 0x06;
    const WRITABLE: u8 = 0x07;
    const WRITABLE_ONCE: u8 = 0x08;
    const FLUID_CONTAINER: u8 = 0x09;
    const FLUID: u8 = 0x0A;
    const UNPASSABLE: u8 = 0x0B;
    const UNMOVEABLE: u8 = 0x0C;
    const BLOCK_MISSILE: u8 = 0x0D;
    const BLOCK_PATHFIND: u8 = 0x0E;
    const PICKUPABLE: u8 = 0x0F;
    const HAS_LIGHT: u8 = 0x10;
    const FLOOR_CHANGE: u8 = 0x11;
    const FULL_GROUND: u8 = 0x12;
    const HAS_ELEVATION: u8 = 0x13;
    const HAS_OFFSET: u8 = 0x14;
    const MINI_MAP: u8 = 0x16;
    const ROTATABLE: u8 = 0x17;
    const LYING_OBJECT: u8 = 0x18;
    const HANGABLE: u8 = 0x19;
    const VERTICAL: u8 = 0x1A;
    const HORIZONTAL: u8 = 0x1B;
    const ANIMATE_ALWAYS: u8 = 0x1C;
    const LENS_HELP: u8 = 0x1D;
    const WRAPPABLE: u8 = 0x24;
    const UNWRAPPABLE: u8 = 0x25;
    const TOP_EFFECT: u8 = 0x26;
    const LAST_FLAG: u8 = 0xFF;
}

struct MetadataFlags3;
#[allow(dead_code)]
impl MetadataFlags3 {
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
    const PICKUPABLE: u8 = 0x10;
    const HANGABLE: u8 = 0x11;
    const VERTICAL: u8 = 0x12;
    const HORIZONTAL: u8 = 0x13;
    const ROTATABLE: u8 = 0x14;
    const HAS_LIGHT: u8 = 0x15;
    const FLOOR_CHANGE: u8 = 0x17;
    const HAS_OFFSET: u8 = 0x18;
    const HAS_ELEVATION: u8 = 0x19;
    const LYING_OBJECT: u8 = 0x1A;
    const ANIMATE_ALWAYS: u8 = 0x1B;
    const MINI_MAP: u8 = 0x1C;
    const LENS_HELP: u8 = 0x1D;
    const FULL_GROUND: u8 = 0x1E;
    const LAST_FLAG: u8 = 0xFF;
}

struct MetadataFlags4;
#[allow(dead_code)]
impl MetadataFlags4 {
    const GROUND: u8 = 0x00;
    const GROUND_BORDER: u8 = 0x01;
    const ON_BOTTOM: u8 = 0x02;
    const ON_TOP: u8 = 0x03;
    const CONTAINER: u8 = 0x04;
    const STACKABLE: u8 = 0x05;
    const FORCE_USE: u8 = 0x06;
    const MULTI_USE: u8 = 0x07;
    const HAS_CHARGES: u8 = 0x08;
    const WRITABLE: u8 = 0x09;
    const WRITABLE_ONCE: u8 = 0x0A;
    const FLUID_CONTAINER: u8 = 0x0B;
    const FLUID: u8 = 0x0C;
    const UNPASSABLE: u8 = 0x0D;
    const UNMOVEABLE: u8 = 0x0E;
    const BLOCK_MISSILE: u8 = 0x0F;
    const BLOCK_PATHFIND: u8 = 0x10;
    const PICKUPABLE: u8 = 0x11;
    const HANGABLE: u8 = 0x12;
    const VERTICAL: u8 = 0x13;
    const HORIZONTAL: u8 = 0x14;
    const ROTATABLE: u8 = 0x15;
    const HAS_LIGHT: u8 = 0x16;
    const DONT_HIDE: u8 = 0x17;
    const FLOOR_CHANGE: u8 = 0x18;
    const HAS_OFFSET: u8 = 0x19;
    const HAS_ELEVATION: u8 = 0x1A;
    const LYING_OBJECT: u8 = 0x1B;
    const ANIMATE_ALWAYS: u8 = 0x1C;
    const MINI_MAP: u8 = 0x1D;
    const LENS_HELP: u8 = 0x1E;
    const FULL_GROUND: u8 = 0x1F;
    const IGNORE_LOOK: u8 = 0x20;
    const WRAPPABLE: u8 = 0x24;
    const UNWRAPPABLE: u8 = 0x25;
    const HAS_BONES: u8 = 0x27;
    const LAST_FLAG: u8 = 0xFF;
}

struct MetadataFlags5;
#[allow(dead_code)]
impl MetadataFlags5 {
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
    const PICKUPABLE: u8 = 0x10;
    const HANGABLE: u8 = 0x11;
    const VERTICAL: u8 = 0x12;
    const HORIZONTAL: u8 = 0x13;
    const ROTATABLE: u8 = 0x14;
    const HAS_LIGHT: u8 = 0x15;
    const DONT_HIDE: u8 = 0x16;
    const TRANSLUCENT: u8 = 0x17;
    const HAS_OFFSET: u8 = 0x18;
    const HAS_ELEVATION: u8 = 0x19;
    const LYING_OBJECT: u8 = 0x1A;
    const ANIMATE_ALWAYS: u8 = 0x1B;
    const MINI_MAP: u8 = 0x1C;
    const LENS_HELP: u8 = 0x1D;
    const FULL_GROUND: u8 = 0x1E;
    const IGNORE_LOOK: u8 = 0x1F;
    const CLOTH: u8 = 0x20;
    const MARKET_ITEM: u8 = 0x21;
    const HAS_BONES: u8 = 0x27;
    const LAST_FLAG: u8 = 0xFF;
}

struct MetadataFlags6;
impl MetadataFlags6 {
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
    const FLUID_CONTAINER: u8 = 0x0a;
    const FLUID: u8 = 0x0b;
    const UNPASSABLE: u8 = 0x0c;
    const UNMOVEABLE: u8 = 0x0d;
    const BLOCK_MISSILE: u8 = 0x0e;
    const BLOCK_PATHFIND: u8 = 0x0f;
    const NO_MOVE_ANIMATION: u8 = 0x10;
    const PICKUPABLE: u8 = 0x11;
    const HANGABLE: u8 = 0x12;
    const VERTICAL: u8 = 0x13;
    const HORIZONTAL: u8 = 0x14;
    const ROTATABLE: u8 = 0x15;
    const HAS_LIGHT: u8 = 0x16;
    const DONT_HIDE: u8 = 0x17;
    const TRANSLUCENT: u8 = 0x18;
    const HAS_OFFSET: u8 = 0x19;
    const HAS_ELEVATION: u8 = 0x1a;
    const LYING_OBJECT: u8 = 0x1b;
    const ANIMATE_ALWAYS: u8 = 0x1c;
    const MINI_MAP: u8 = 0x1d;
    const LENS_HELP: u8 = 0x1e;
    const FULL_GROUND: u8 = 0x1f;
    const IGNORE_LOOK: u8 = 0x20;
    const CLOTH: u8 = 0x21;
    const MARKET_ITEM: u8 = 0x22;
    const DEFAULT_ACTION: u8 = 0x23;
    const WRAPPABLE: u8 = 0x24;
    const UNWRAPPABLE: u8 = 0x25;
    const TOP_EFFECT: u8 = 0x26;
    const HAS_BONES: u8 = 0x27;
    const USABLE: u8 = 0xFE;
    const LAST_FLAG: u8 = 0xFF;
}

pub struct DatReader {
    reader: BufReader<File>,
    version: u32,
    extended: bool,
    frame_durations: bool,
    frame_groups: bool,
}

impl DatReader {
    pub fn open(path: &str) -> Result<Self, String> {
        let file = File::open(path).map_err(|e| format!("Failed to open DAT file: {}", e))?;
        let reader = BufReader::new(file);
        
        Ok(Self {
            reader,
            version: 0,
            extended: false,
            frame_durations: false,
            frame_groups: false,
        })
    }

    fn read_u8(&mut self) -> io::Result<u8> {
        let mut buf = [0u8; 1];
        self.reader.read_exact(&mut buf)?;
        Ok(buf[0])
    }

    fn read_u16_le(&mut self) -> io::Result<u16> {
        let mut buf = [0u8; 2];
        self.reader.read_exact(&mut buf)?;
        Ok(u16::from_le_bytes(buf))
    }

    fn read_bones(&mut self, thing: &mut ThingType) -> io::Result<()> {
        thing.has_bones = true;
        thing.bones_offset_x = Vec::with_capacity(4);
        thing.bones_offset_y = Vec::with_capacity(4);
        for _ in 0..4 {
            thing.bones_offset_x.push(self.read_u16_le()? as i16);
            thing.bones_offset_y.push(self.read_u16_le()? as i16);
        }
        Ok(())
    }

    fn read_u32_le(&mut self) -> io::Result<u32> {
        let mut buf = [0u8; 4];
        self.reader.read_exact(&mut buf)?;
        Ok(u32::from_le_bytes(buf))
    }

    fn read_i8(&mut self) -> io::Result<i8> {
        let mut buf = [0u8; 1];
        self.reader.read_exact(&mut buf)?;
        Ok(i8::from_le_bytes(buf))
    }

    fn read_i32_le(&mut self) -> io::Result<i32> {
        let mut buf = [0u8; 4];
        self.reader.read_exact(&mut buf)?;
        Ok(i32::from_le_bytes(buf))
    }

    fn read_string(&mut self) -> io::Result<String> {
        let len = self.read_u16_le()?;
        let mut buf = vec![0u8; len as usize];
        self.reader.read_exact(&mut buf)?;
        Ok(String::from_utf8_lossy(&buf).to_string())
    }

    pub fn set_version(&mut self, version: u32) {
        self.version = version;
        self.extended = version >= 960;
        self.frame_durations = version >= 1050;
        self.frame_groups = version >= 1057;
    }

    pub fn apply_overrides(
        &mut self,
        extended: Option<bool>,
        frame_durations: Option<bool>,
        frame_groups: Option<bool>,
    ) {
        if let Some(v) = extended {
            self.extended = v;
        }
        if let Some(v) = frame_durations {
            self.frame_durations = v;
        }
        if let Some(v) = frame_groups {
            self.frame_groups = v;
        }
    }

    pub fn read_dat(&mut self) -> Result<(u32, Vec<ThingType>, Vec<ThingType>, Vec<ThingType>, Vec<ThingType>), String> {
        let signature = self.read_u32_le().map_err(|e| format!("Failed to read signature: {}", e))?;

        let items_count = self.read_u16_le().map_err(|e| format!("Failed to read items count: {}", e))?;
        let outfits_count = self.read_u16_le().map_err(|e| format!("Failed to read outfits count: {}", e))?;
        let effects_count = self.read_u16_le().map_err(|e| format!("Failed to read effects count: {}", e))?;
        let missiles_count = self.read_u16_le().map_err(|e| format!("Failed to read missiles count: {}", e))?;

        let mut items = Vec::with_capacity(items_count as usize);
        let mut outfits = Vec::with_capacity(outfits_count as usize);
        let mut effects = Vec::with_capacity(effects_count as usize);
        let mut missiles = Vec::with_capacity(missiles_count as usize);

        for id in 100..=items_count {
            let thing = self.read_thing(id as u32, "item").map_err(|e| format!("Error reading item {}: {}", id, e))?;
            items.push(thing);
        }

        for id in 1..=outfits_count {
            let thing = self.read_thing(id as u32, "outfit").map_err(|e| format!("Error reading outfit {}: {}", id, e))?;
            outfits.push(thing);
        }

        for id in 1..=effects_count {
            let thing = self.read_thing(id as u32, "effect").map_err(|e| format!("Error reading effect {}: {}", id, e))?;
            effects.push(thing);
        }

        for id in 1..=missiles_count {
            let thing = self.read_thing(id as u32, "missile").map_err(|e| format!("Error reading missile {}: {}", id, e))?;
            missiles.push(thing);
        }

        Ok((signature, items, outfits, effects, missiles))
    }

    fn read_thing(&mut self, id: u32, category: &str) -> io::Result<ThingType> {
        let mut thing = self.create_empty_thing(id, category);

        self.read_properties(&mut thing)?;
        self.read_texture_patterns(&mut thing)?;

        Ok(thing)
    }

    fn create_empty_thing(&self, id: u32, category: &str) -> ThingType {
        ThingType {
            id,
            category: category.to_string(),
            width: 1,
            height: 1,
            exact_size: 32,
            layers: 1,
            pattern_x: 1,
            pattern_y: 1,
            pattern_z: 1,
            frames: 1,
            sprite_index: Vec::new(),
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
            frame_groups_data: None,
        }
    }

    fn read_properties(&mut self, thing: &mut ThingType) -> io::Result<()> {
        if self.version < 710 {
            Err(io::Error::new(
                io::ErrorKind::Unsupported,
                format!("Version {} not supported (minimum 7.10)", self.version)
            ))
        } else if self.version <= 730 {
            self.read_properties_v1(thing)
        } else if self.version <= 750 {
            self.read_properties_v2(thing)
        } else if self.version <= 772 {
            self.read_properties_v3(thing)
        } else if self.version <= 854 {
            self.read_properties_v4(thing)
        } else if self.version <= 986 {
            self.read_properties_v5(thing)
        } else {
            self.read_properties_v6(thing)
        }
    }

    fn read_properties_v1(&mut self, thing: &mut ThingType) -> io::Result<()> {
        loop {
            let flag = self.read_u8()?;
            if flag == MetadataFlags1::LAST_FLAG {
                break;
            }

            match flag {
                MetadataFlags1::GROUND => {
                    thing.is_ground = true;
                    thing.ground_speed = self.read_u16_le()?;
                }
                MetadataFlags1::ON_BOTTOM => thing.is_on_bottom = true,
                MetadataFlags1::ON_TOP => thing.is_on_top = true,
                MetadataFlags1::CONTAINER => thing.is_container = true,
                MetadataFlags1::STACKABLE => thing.stackable = true,
                MetadataFlags1::MULTI_USE => thing.multi_use = true,
                MetadataFlags1::FORCE_USE => thing.force_use = true,
                MetadataFlags1::WRITABLE => {
                    thing.writable = true;
                    thing.max_text_length = self.read_u16_le()?;
                }
                MetadataFlags1::WRITABLE_ONCE => {
                    thing.writable_once = true;
                    thing.max_text_length = self.read_u16_le()?;
                }
                MetadataFlags1::FLUID_CONTAINER => thing.is_fluid_container = true,
                MetadataFlags1::FLUID => thing.is_fluid = true,
                MetadataFlags1::UNPASSABLE => thing.is_unpassable = true,
                MetadataFlags1::UNMOVEABLE => thing.is_unmoveable = true,
                MetadataFlags1::BLOCK_MISSILE => thing.block_missile = true,
                MetadataFlags1::BLOCK_PATHFIND => thing.block_pathfind = true,
                MetadataFlags1::PICKUPABLE => thing.pickupable = true,
                MetadataFlags1::HAS_LIGHT => {
                    thing.has_light = true;
                    thing.light_level = self.read_u16_le()?;
                    thing.light_color = self.read_u16_le()?;
                }
                MetadataFlags1::FLOOR_CHANGE => thing.floor_change = true,
                MetadataFlags1::FULL_GROUND => thing.is_full_ground = true,
                MetadataFlags1::HAS_ELEVATION => {
                    thing.has_elevation = true;
                    thing.elevation = self.read_u16_le()?;
                }
                MetadataFlags1::HAS_OFFSET => {
                    thing.has_offset = true;
                    thing.offset_x = 8;
                    thing.offset_y = 8;
                }
                MetadataFlags1::MINI_MAP => {
                    thing.mini_map = true;
                    thing.mini_map_color = self.read_u16_le()?;
                }
                MetadataFlags1::ROTATABLE => thing.rotatable = true,
                MetadataFlags1::LYING_OBJECT => thing.is_lying_object = true,
                MetadataFlags1::ANIMATE_ALWAYS => thing.animate_always = true,
                MetadataFlags1::LENS_HELP => {
                    thing.is_lens_help = true;
                    thing.lens_help = self.read_u16_le()?;
                }
                MetadataFlags1::WRAPPABLE => thing.wrappable = true,
                MetadataFlags1::UNWRAPPABLE => thing.unwrappable = true,
                MetadataFlags1::TOP_EFFECT => thing.top_effect = true,
                0x15 => {}
                _ => {
                    return Err(io::Error::new(
                        io::ErrorKind::InvalidData,
                        format!("Unknown v1 flag: 0x{:02X} for {} id {}", flag, thing.category, thing.id)
                    ));
                }
            }
        }
        Ok(())
    }

    fn read_properties_v2(&mut self, thing: &mut ThingType) -> io::Result<()> {
        loop {
            let flag = self.read_u8()?;
            if flag == MetadataFlags2::LAST_FLAG {
                break;
            }

            match flag {
                MetadataFlags2::GROUND => {
                    thing.is_ground = true;
                    thing.ground_speed = self.read_u16_le()?;
                }
                MetadataFlags2::ON_BOTTOM => thing.is_on_bottom = true,
                MetadataFlags2::ON_TOP => thing.is_on_top = true,
                MetadataFlags2::CONTAINER => thing.is_container = true,
                MetadataFlags2::STACKABLE => thing.stackable = true,
                MetadataFlags2::MULTI_USE => thing.multi_use = true,
                MetadataFlags2::FORCE_USE => thing.force_use = true,
                MetadataFlags2::WRITABLE => {
                    thing.writable = true;
                    thing.max_text_length = self.read_u16_le()?;
                }
                MetadataFlags2::WRITABLE_ONCE => {
                    thing.writable_once = true;
                    thing.max_text_length = self.read_u16_le()?;
                }
                MetadataFlags2::FLUID_CONTAINER => thing.is_fluid_container = true,
                MetadataFlags2::FLUID => thing.is_fluid = true,
                MetadataFlags2::UNPASSABLE => thing.is_unpassable = true,
                MetadataFlags2::UNMOVEABLE => thing.is_unmoveable = true,
                MetadataFlags2::BLOCK_MISSILE => thing.block_missile = true,
                MetadataFlags2::BLOCK_PATHFIND => thing.block_pathfind = true,
                MetadataFlags2::PICKUPABLE => thing.pickupable = true,
                MetadataFlags2::HAS_LIGHT => {
                    thing.has_light = true;
                    thing.light_level = self.read_u16_le()?;
                    thing.light_color = self.read_u16_le()?;
                }
                MetadataFlags2::FLOOR_CHANGE => thing.floor_change = true,
                MetadataFlags2::FULL_GROUND => thing.is_full_ground = true,
                MetadataFlags2::HAS_ELEVATION => {
                    thing.has_elevation = true;
                    thing.elevation = self.read_u16_le()?;
                }
                MetadataFlags2::HAS_OFFSET => {
                    thing.has_offset = true;
                    thing.offset_x = 8;
                    thing.offset_y = 8;
                }
                MetadataFlags2::MINI_MAP => {
                    thing.mini_map = true;
                    thing.mini_map_color = self.read_u16_le()?;
                }
                MetadataFlags2::ROTATABLE => thing.rotatable = true,
                MetadataFlags2::LYING_OBJECT => thing.is_lying_object = true,
                MetadataFlags2::HANGABLE => thing.hangable = true,
                MetadataFlags2::VERTICAL => thing.is_vertical = true,
                MetadataFlags2::HORIZONTAL => thing.is_horizontal = true,
                MetadataFlags2::ANIMATE_ALWAYS => thing.animate_always = true,
                MetadataFlags2::LENS_HELP => {
                    thing.is_lens_help = true;
                    thing.lens_help = self.read_u16_le()?;
                }
                MetadataFlags2::WRAPPABLE => thing.wrappable = true,
                MetadataFlags2::UNWRAPPABLE => thing.unwrappable = true,
                MetadataFlags2::TOP_EFFECT => thing.top_effect = true,
                0x15 => {}
                _ => {
                    return Err(io::Error::new(
                        io::ErrorKind::InvalidData,
                        format!("Unknown v2 flag: 0x{:02X} for {} id {}", flag, thing.category, thing.id)
                    ));
                }
            }
        }
        Ok(())
    }

    fn read_properties_v3(&mut self, thing: &mut ThingType) -> io::Result<()> {
        loop {
            let flag = self.read_u8()?;
            if flag == MetadataFlags3::LAST_FLAG {
                break;
            }

            match flag {
                MetadataFlags3::GROUND => {
                    thing.is_ground = true;
                    thing.ground_speed = self.read_u16_le()?;
                }
                MetadataFlags3::GROUND_BORDER => thing.is_ground_border = true,
                MetadataFlags3::ON_BOTTOM => thing.is_on_bottom = true,
                MetadataFlags3::ON_TOP => thing.is_on_top = true,
                MetadataFlags3::CONTAINER => thing.is_container = true,
                MetadataFlags3::STACKABLE => thing.stackable = true,
                MetadataFlags3::FORCE_USE => thing.force_use = true,
                MetadataFlags3::MULTI_USE => thing.multi_use = true,
                MetadataFlags3::WRITABLE => {
                    thing.writable = true;
                    thing.max_text_length = self.read_u16_le()?;
                }
                MetadataFlags3::WRITABLE_ONCE => {
                    thing.writable_once = true;
                    thing.max_text_length = self.read_u16_le()?;
                }
                MetadataFlags3::FLUID_CONTAINER => thing.is_fluid_container = true,
                MetadataFlags3::FLUID => thing.is_fluid = true,
                MetadataFlags3::UNPASSABLE => thing.is_unpassable = true,
                MetadataFlags3::UNMOVEABLE => thing.is_unmoveable = true,
                MetadataFlags3::BLOCK_MISSILE => thing.block_missile = true,
                MetadataFlags3::BLOCK_PATHFIND => thing.block_pathfind = true,
                MetadataFlags3::PICKUPABLE => thing.pickupable = true,
                MetadataFlags3::HANGABLE => thing.hangable = true,
                MetadataFlags3::VERTICAL => thing.is_vertical = true,
                MetadataFlags3::HORIZONTAL => thing.is_horizontal = true,
                MetadataFlags3::ROTATABLE => thing.rotatable = true,
                MetadataFlags3::HAS_LIGHT => {
                    thing.has_light = true;
                    thing.light_level = self.read_u16_le()?;
                    thing.light_color = self.read_u16_le()?;
                }
                MetadataFlags3::FLOOR_CHANGE => thing.floor_change = true,
                MetadataFlags3::HAS_OFFSET => {
                    thing.has_offset = true;
                    thing.offset_x = self.read_u16_le()? as i16;
                    thing.offset_y = self.read_u16_le()? as i16;
                }
                MetadataFlags3::HAS_ELEVATION => {
                    thing.has_elevation = true;
                    thing.elevation = self.read_u16_le()?;
                }
                MetadataFlags3::LYING_OBJECT => thing.is_lying_object = true,
                MetadataFlags3::ANIMATE_ALWAYS => thing.animate_always = true,
                MetadataFlags3::MINI_MAP => {
                    thing.mini_map = true;
                    thing.mini_map_color = self.read_u16_le()?;
                }
                MetadataFlags3::LENS_HELP => {
                    thing.is_lens_help = true;
                    thing.lens_help = self.read_u16_le()?;
                }
                MetadataFlags3::FULL_GROUND => thing.is_full_ground = true,
                0x16 => {}
                _ => {
                    return Err(io::Error::new(
                        io::ErrorKind::InvalidData,
                        format!("Unknown v3 flag: 0x{:02X} for {} id {}", flag, thing.category, thing.id)
                    ));
                }
            }
        }
        Ok(())
    }

    fn read_properties_v4(&mut self, thing: &mut ThingType) -> io::Result<()> {
        loop {
            let flag = self.read_u8()?;
            if flag == MetadataFlags4::LAST_FLAG {
                break;
            }

            match flag {
                MetadataFlags4::GROUND => {
                    thing.is_ground = true;
                    thing.ground_speed = self.read_u16_le()?;
                }
                MetadataFlags4::GROUND_BORDER => thing.is_ground_border = true,
                MetadataFlags4::ON_BOTTOM => thing.is_on_bottom = true,
                MetadataFlags4::ON_TOP => thing.is_on_top = true,
                MetadataFlags4::CONTAINER => thing.is_container = true,
                MetadataFlags4::STACKABLE => thing.stackable = true,
                MetadataFlags4::FORCE_USE => thing.force_use = true,
                MetadataFlags4::MULTI_USE => thing.multi_use = true,
                MetadataFlags4::HAS_CHARGES => thing.has_charges = true,
                MetadataFlags4::WRITABLE => {
                    thing.writable = true;
                    thing.max_text_length = self.read_u16_le()?;
                }
                MetadataFlags4::WRITABLE_ONCE => {
                    thing.writable_once = true;
                    thing.max_text_length = self.read_u16_le()?;
                }
                MetadataFlags4::FLUID_CONTAINER => thing.is_fluid_container = true,
                MetadataFlags4::FLUID => thing.is_fluid = true,
                MetadataFlags4::UNPASSABLE => thing.is_unpassable = true,
                MetadataFlags4::UNMOVEABLE => thing.is_unmoveable = true,
                MetadataFlags4::BLOCK_MISSILE => thing.block_missile = true,
                MetadataFlags4::BLOCK_PATHFIND => thing.block_pathfind = true,
                MetadataFlags4::PICKUPABLE => thing.pickupable = true,
                MetadataFlags4::HANGABLE => thing.hangable = true,
                MetadataFlags4::VERTICAL => thing.is_vertical = true,
                MetadataFlags4::HORIZONTAL => thing.is_horizontal = true,
                MetadataFlags4::ROTATABLE => thing.rotatable = true,
                MetadataFlags4::HAS_LIGHT => {
                    thing.has_light = true;
                    thing.light_level = self.read_u16_le()?;
                    thing.light_color = self.read_u16_le()?;
                }
                MetadataFlags4::DONT_HIDE => thing.dont_hide = true,
                MetadataFlags4::FLOOR_CHANGE => thing.floor_change = true,
                MetadataFlags4::HAS_OFFSET => {
                    thing.has_offset = true;
                    thing.offset_x = self.read_u16_le()? as i16;
                    thing.offset_y = self.read_u16_le()? as i16;
                }
                MetadataFlags4::HAS_ELEVATION => {
                    thing.has_elevation = true;
                    thing.elevation = self.read_u16_le()?;
                }
                MetadataFlags4::LYING_OBJECT => thing.is_lying_object = true,
                MetadataFlags4::ANIMATE_ALWAYS => thing.animate_always = true,
                MetadataFlags4::MINI_MAP => {
                    thing.mini_map = true;
                    thing.mini_map_color = self.read_u16_le()?;
                }
                MetadataFlags4::LENS_HELP => {
                    thing.is_lens_help = true;
                    thing.lens_help = self.read_u16_le()?;
                }
                MetadataFlags4::FULL_GROUND => thing.is_full_ground = true,
                MetadataFlags4::IGNORE_LOOK => thing.ignore_look = true,
                MetadataFlags4::WRAPPABLE => thing.wrappable = true,
                MetadataFlags4::UNWRAPPABLE => thing.unwrappable = true,
                MetadataFlags4::HAS_BONES => self.read_bones(thing)?,
                _ => {
                    return Err(io::Error::new(
                        io::ErrorKind::InvalidData,
                        format!("Unknown v4 flag: 0x{:02X} for {} id {}", flag, thing.category, thing.id)
                    ));
                }
            }
        }
        Ok(())
    }

    fn read_properties_v5(&mut self, thing: &mut ThingType) -> io::Result<()> {
        loop {
            let flag = self.read_u8()?;
            if flag == MetadataFlags5::LAST_FLAG {
                break;
            }

            match flag {
                MetadataFlags5::GROUND => {
                    thing.is_ground = true;
                    thing.ground_speed = self.read_u16_le()?;
                }
                MetadataFlags5::GROUND_BORDER => thing.is_ground_border = true,
                MetadataFlags5::ON_BOTTOM => thing.is_on_bottom = true,
                MetadataFlags5::ON_TOP => thing.is_on_top = true,
                MetadataFlags5::CONTAINER => thing.is_container = true,
                MetadataFlags5::STACKABLE => thing.stackable = true,
                MetadataFlags5::FORCE_USE => thing.force_use = true,
                MetadataFlags5::MULTI_USE => thing.multi_use = true,
                MetadataFlags5::WRITABLE => {
                    thing.writable = true;
                    thing.max_text_length = self.read_u16_le()?;
                }
                MetadataFlags5::WRITABLE_ONCE => {
                    thing.writable_once = true;
                    thing.max_text_length = self.read_u16_le()?;
                }
                MetadataFlags5::FLUID_CONTAINER => thing.is_fluid_container = true,
                MetadataFlags5::FLUID => thing.is_fluid = true,
                MetadataFlags5::UNPASSABLE => thing.is_unpassable = true,
                MetadataFlags5::UNMOVEABLE => thing.is_unmoveable = true,
                MetadataFlags5::BLOCK_MISSILE => thing.block_missile = true,
                MetadataFlags5::BLOCK_PATHFIND => thing.block_pathfind = true,
                MetadataFlags5::PICKUPABLE => thing.pickupable = true,
                MetadataFlags5::HANGABLE => thing.hangable = true,
                MetadataFlags5::VERTICAL => thing.is_vertical = true,
                MetadataFlags5::HORIZONTAL => thing.is_horizontal = true,
                MetadataFlags5::ROTATABLE => thing.rotatable = true,
                MetadataFlags5::HAS_LIGHT => {
                    thing.has_light = true;
                    thing.light_level = self.read_u16_le()?;
                    thing.light_color = self.read_u16_le()?;
                }
                MetadataFlags5::DONT_HIDE => thing.dont_hide = true,
                MetadataFlags5::TRANSLUCENT => thing.is_translucent = true,
                MetadataFlags5::HAS_OFFSET => {
                    thing.has_offset = true;
                    thing.offset_x = self.read_u16_le()? as i16;
                    thing.offset_y = self.read_u16_le()? as i16;
                }
                MetadataFlags5::HAS_ELEVATION => {
                    thing.has_elevation = true;
                    thing.elevation = self.read_u16_le()?;
                }
                MetadataFlags5::LYING_OBJECT => thing.is_lying_object = true,
                MetadataFlags5::ANIMATE_ALWAYS => thing.animate_always = true,
                MetadataFlags5::MINI_MAP => {
                    thing.mini_map = true;
                    thing.mini_map_color = self.read_u16_le()?;
                }
                MetadataFlags5::LENS_HELP => {
                    thing.is_lens_help = true;
                    thing.lens_help = self.read_u16_le()?;
                }
                MetadataFlags5::FULL_GROUND => thing.is_full_ground = true,
                MetadataFlags5::IGNORE_LOOK => thing.ignore_look = true,
                MetadataFlags5::CLOTH => {
                    thing.cloth = true;
                    thing.cloth_slot = self.read_u16_le()?;
                }
                MetadataFlags5::MARKET_ITEM => {
                    thing.is_market_item = true;
                    thing.market_category = self.read_u16_le()?;
                    thing.market_trade_as = self.read_u16_le()?;
                    thing.market_show_as = self.read_u16_le()?;
                    thing.market_name = self.read_string()?;
                    thing.market_restrict_profession = self.read_u16_le()?;
                    thing.market_restrict_level = self.read_u16_le()?;
                }
                MetadataFlags5::HAS_BONES => self.read_bones(thing)?,
                _ => {
                    return Err(io::Error::new(
                        io::ErrorKind::InvalidData,
                        format!("Unknown v5 flag: 0x{:02X} for {} id {}", flag, thing.category, thing.id)
                    ));
                }
            }
        }
        Ok(())
    }

    fn read_properties_v6(&mut self, thing: &mut ThingType) -> io::Result<()> {
        loop {
            let flag = self.read_u8()?;
            if flag == MetadataFlags6::LAST_FLAG {
                break;
            }

            match flag {
                MetadataFlags6::GROUND => {
                    thing.is_ground = true;
                    thing.ground_speed = self.read_u16_le()?;
                }
                MetadataFlags6::GROUND_BORDER => thing.is_ground_border = true,
                MetadataFlags6::ON_BOTTOM => thing.is_on_bottom = true,
                MetadataFlags6::ON_TOP => thing.is_on_top = true,
                MetadataFlags6::CONTAINER => thing.is_container = true,
                MetadataFlags6::STACKABLE => thing.stackable = true,
                MetadataFlags6::FORCE_USE => thing.force_use = true,
                MetadataFlags6::MULTI_USE => thing.multi_use = true,
                MetadataFlags6::WRITABLE => {
                    thing.writable = true;
                    thing.max_text_length = self.read_u16_le()?;
                }
                MetadataFlags6::WRITABLE_ONCE => {
                    thing.writable_once = true;
                    thing.max_text_length = self.read_u16_le()?;
                }
                MetadataFlags6::FLUID_CONTAINER => thing.is_fluid_container = true,
                MetadataFlags6::FLUID => thing.is_fluid = true,
                MetadataFlags6::UNPASSABLE => thing.is_unpassable = true,
                MetadataFlags6::UNMOVEABLE => thing.is_unmoveable = true,
                MetadataFlags6::BLOCK_MISSILE => thing.block_missile = true,
                MetadataFlags6::BLOCK_PATHFIND => thing.block_pathfind = true,
                MetadataFlags6::NO_MOVE_ANIMATION => thing.no_move_animation = true,
                MetadataFlags6::PICKUPABLE => thing.pickupable = true,
                MetadataFlags6::HANGABLE => thing.hangable = true,
                MetadataFlags6::VERTICAL => thing.is_vertical = true,
                MetadataFlags6::HORIZONTAL => thing.is_horizontal = true,
                MetadataFlags6::ROTATABLE => thing.rotatable = true,
                MetadataFlags6::HAS_LIGHT => {
                    thing.has_light = true;
                    thing.light_level = self.read_u16_le()?;
                    thing.light_color = self.read_u16_le()?;
                }
                MetadataFlags6::DONT_HIDE => thing.dont_hide = true,
                MetadataFlags6::TRANSLUCENT => thing.is_translucent = true,
                MetadataFlags6::HAS_OFFSET => {
                    thing.has_offset = true;
                    thing.offset_x = self.read_u16_le()? as i16;
                    thing.offset_y = self.read_u16_le()? as i16;
                }
                MetadataFlags6::HAS_ELEVATION => {
                    thing.has_elevation = true;
                    thing.elevation = self.read_u16_le()?;
                }
                MetadataFlags6::LYING_OBJECT => thing.is_lying_object = true,
                MetadataFlags6::ANIMATE_ALWAYS => thing.animate_always = true,
                MetadataFlags6::MINI_MAP => {
                    thing.mini_map = true;
                    thing.mini_map_color = self.read_u16_le()?;
                }
                MetadataFlags6::LENS_HELP => {
                    thing.is_lens_help = true;
                    thing.lens_help = self.read_u16_le()?;
                }
                MetadataFlags6::FULL_GROUND => thing.is_full_ground = true,
                MetadataFlags6::IGNORE_LOOK => thing.ignore_look = true,
                MetadataFlags6::CLOTH => {
                    thing.cloth = true;
                    thing.cloth_slot = self.read_u16_le()?;
                }
                MetadataFlags6::MARKET_ITEM => {
                    thing.is_market_item = true;
                    thing.market_category = self.read_u16_le()?;
                    thing.market_trade_as = self.read_u16_le()?;
                    thing.market_show_as = self.read_u16_le()?;
                    thing.market_name = self.read_string()?;
                    thing.market_restrict_profession = self.read_u16_le()?;
                    thing.market_restrict_level = self.read_u16_le()?;
                }
                MetadataFlags6::DEFAULT_ACTION => {
                    thing.has_default_action = true;
                    thing.default_action = self.read_u16_le()?;
                }
                MetadataFlags6::WRAPPABLE => thing.wrappable = true,
                MetadataFlags6::UNWRAPPABLE => thing.unwrappable = true,
                MetadataFlags6::TOP_EFFECT => thing.top_effect = true,
                MetadataFlags6::HAS_BONES => self.read_bones(thing)?,
                MetadataFlags6::USABLE => thing.usable = true,
                _ => {
                    return Err(io::Error::new(
                        io::ErrorKind::InvalidData,
                        format!("Unknown flag: 0x{:02X} (version: {})", flag, self.version)
                    ));
                }
            }
        }
        Ok(())
    }

    fn read_texture_patterns(&mut self, thing: &mut ThingType) -> io::Result<()> {
        let has_frame_groups = self.frame_groups && thing.category == "outfit";
        let group_count = if has_frame_groups {
            self.read_u8()?
        } else {
            1
        };

        if has_frame_groups {
            thing.frame_groups_data = Some(Vec::new());
        }

        for group_idx in 0..group_count {
            let group_type = if has_frame_groups {
                self.read_u8()?;
                group_idx as u8
            } else {
                0
            };

            let width = self.read_u8()?;
            let height = self.read_u8()?;
            let exact_size = if width > 1 || height > 1 {
                self.read_u8()?
            } else {
                32
            };
            let layers = self.read_u8()?;
            let pattern_x = self.read_u8()?;
            let pattern_y = self.read_u8()?;
            let pattern_z = if self.version <= 750 { 1 } else { self.read_u8()? };
            let frames = self.read_u8()?;

            let (is_animation, animation_mode, loop_count, start_frame, frame_durations) = if frames > 1 && self.frame_durations {
                let mode = self.read_u8()?;
                let loop_cnt = self.read_i32_le()?;
                let start = self.read_i8()?;
                let mut durations = Vec::new();
                for _ in 0..frames {
                    let min = self.read_u32_le()?;
                    let max = self.read_u32_le()?;
                    durations.push(FrameDuration { minimum: min, maximum: max });
                }
                (true, Some(mode), Some(loop_cnt), Some(start), Some(durations))
            } else {
                (frames > 1, None, None, None, None)
            };

            let total_sprites = width as u32 * height as u32 * layers as u32
                * pattern_x as u32 * pattern_y as u32 * pattern_z as u32 * frames as u32;

            if total_sprites > 4096 {
                return Err(io::Error::new(io::ErrorKind::InvalidData,
                    format!("Frame group has {} sprites (exceeds 4096 limit)", total_sprites)));
            }

            let mut sprite_indices = Vec::new();
            for _ in 0..total_sprites {
                let sprite_id = if self.extended {
                    self.read_u32_le()?
                } else {
                    self.read_u16_le()? as u32
                };
                sprite_indices.push(sprite_id);
            }

            if has_frame_groups {
                let frame_group = FrameGroup {
                    r#type: group_type,
                    width,
                    height,
                    exact_size,
                    layers,
                    pattern_x,
                    pattern_y,
                    pattern_z,
                    frames,
                    sprite_index: sprite_indices.clone(),
                    is_animation,
                    animation_mode,
                    loop_count,
                    start_frame,
                    frame_durations: frame_durations.clone(),
                };
                if let Some(groups) = &mut thing.frame_groups_data {
                    groups.push(frame_group);
                }
            }

            if group_idx == 0 {
                thing.width = width;
                thing.height = height;
                thing.exact_size = exact_size;
                thing.layers = layers;
                thing.pattern_x = pattern_x;
                thing.pattern_y = pattern_y;
                thing.pattern_z = pattern_z;
                thing.frames = frames;
                thing.is_animation = is_animation;
                thing.animation_mode = animation_mode.unwrap_or(0);
                thing.loop_count = loop_count.unwrap_or(0);
                thing.start_frame = start_frame.unwrap_or(0);
                thing.frame_durations = frame_durations.unwrap_or_default();
                thing.sprite_index = sprite_indices;
            }
        }

        Ok(())
    }
}
