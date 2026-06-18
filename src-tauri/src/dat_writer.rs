use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{self, Write};

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct FrameDuration {
    pub minimum: u32,
    pub maximum: u32,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FrameGroup {
    pub r#type: u8,
    pub width: u8,
    pub height: u8,
    pub exact_size: u8,
    pub layers: u8,
    pub pattern_x: u8,
    pub pattern_y: u8,
    pub pattern_z: u8,
    pub frames: u8,
    pub sprite_index: Vec<u32>,
    pub is_animation: bool,
    pub animation_mode: Option<u8>,
    pub loop_count: Option<i32>,
    pub start_frame: Option<i8>,
    pub frame_durations: Option<Vec<FrameDuration>>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ThingType {
    pub id: u32,
    pub category: String,
    pub width: u8,
    pub height: u8,
    pub exact_size: u8,
    pub layers: u8,
    pub pattern_x: u8,
    pub pattern_y: u8,
    pub pattern_z: u8,
    pub frames: u8,
    pub sprite_index: Vec<u32>,
    pub frame_groups_data: Option<Vec<FrameGroup>>,

    pub is_ground: bool,
    pub ground_speed: u16,
    pub is_ground_border: bool,
    pub is_on_bottom: bool,
    pub is_on_top: bool,
    pub is_container: bool,
    pub stackable: bool,
    pub force_use: bool,
    pub multi_use: bool,
    pub has_charges: bool,
    pub writable: bool,
    pub writable_once: bool,
    pub max_text_length: u16,
    pub is_fluid_container: bool,
    pub is_fluid: bool,
    pub is_unpassable: bool,
    pub is_unmoveable: bool,
    pub block_missile: bool,
    pub block_pathfind: bool,
    pub no_move_animation: bool,
    pub pickupable: bool,
    pub hangable: bool,
    pub is_vertical: bool,
    pub is_horizontal: bool,
    pub rotatable: bool,
    pub has_light: bool,
    pub light_level: u16,
    pub light_color: u16,
    pub dont_hide: bool,
    pub floor_change: bool,
    pub is_translucent: bool,
    pub has_offset: bool,
    pub offset_x: i16,
    pub offset_y: i16,
    pub has_elevation: bool,
    pub elevation: u16,
    pub is_lying_object: bool,
    pub animate_always: bool,
    pub mini_map: bool,
    pub mini_map_color: u16,
    pub is_lens_help: bool,
    pub lens_help: u16,
    pub is_full_ground: bool,
    pub ignore_look: bool,
    pub cloth: bool,
    pub cloth_slot: u16,
    pub is_market_item: bool,
    pub market_name: String,
    pub market_category: u16,
    pub market_trade_as: u16,
    pub market_show_as: u16,
    pub market_restrict_profession: u16,
    pub market_restrict_level: u16,
    pub has_default_action: bool,
    pub default_action: u16,
    pub usable: bool,
    pub wrappable: bool,
    pub unwrappable: bool,
    pub top_effect: bool,
    #[serde(default)]
    pub has_bones: bool,
    #[serde(default)]
    pub bones_offset_x: Vec<i16>,
    #[serde(default)]
    pub bones_offset_y: Vec<i16>,

    pub is_animation: bool,
    pub animation_mode: u8,
    pub loop_count: i32,
    pub start_frame: i8,
    pub frame_durations: Vec<FrameDuration>,
}

#[allow(dead_code)]
pub struct MetadataFlags1;
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
    const FLUID: u8 = 0x0a;
    const UNPASSABLE: u8 = 0x0b;
    const UNMOVEABLE: u8 = 0x0c;
    const BLOCK_MISSILE: u8 = 0x0d;
    const BLOCK_PATHFIND: u8 = 0x0e;
    const PICKUPABLE: u8 = 0x0f;
    const HAS_LIGHT: u8 = 0x10;
    const FLOOR_CHANGE: u8 = 0x11;
    const FULL_GROUND: u8 = 0x12;
    const HAS_ELEVATION: u8 = 0x13;
    const HAS_OFFSET: u8 = 0x14;
    const MINI_MAP: u8 = 0x16;
    const ROTATABLE: u8 = 0x17;
    const LYING_OBJECT: u8 = 0x18;
    const ANIMATE_ALWAYS: u8 = 0x19;
    const LENS_HELP: u8 = 0x1a;
    const WRAPPABLE: u8 = 0x24;
    const UNWRAPPABLE: u8 = 0x25;
    const TOP_EFFECT: u8 = 0x26;
    const LAST_FLAG: u8 = 0xff;
}

#[allow(dead_code)]
pub struct MetadataFlags2;
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
    const FLUID: u8 = 0x0a;
    const UNPASSABLE: u8 = 0x0b;
    const UNMOVEABLE: u8 = 0x0c;
    const BLOCK_MISSILE: u8 = 0x0d;
    const BLOCK_PATHFIND: u8 = 0x0e;
    const PICKUPABLE: u8 = 0x0f;
    const HAS_LIGHT: u8 = 0x10;
    const FLOOR_CHANGE: u8 = 0x11;
    const FULL_GROUND: u8 = 0x12;
    const HAS_ELEVATION: u8 = 0x13;
    const HAS_OFFSET: u8 = 0x14;
    const MINI_MAP: u8 = 0x16;
    const ROTATABLE: u8 = 0x17;
    const LYING_OBJECT: u8 = 0x18;
    const HANGABLE: u8 = 0x19;
    const VERTICAL: u8 = 0x1a;
    const HORIZONTAL: u8 = 0x1b;
    const ANIMATE_ALWAYS: u8 = 0x1c;
    const LENS_HELP: u8 = 0x1d;
    const WRAPPABLE: u8 = 0x24;
    const UNWRAPPABLE: u8 = 0x25;
    const TOP_EFFECT: u8 = 0x26;
    const LAST_FLAG: u8 = 0xff;
}

#[allow(dead_code)]
pub struct MetadataFlags3;
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
    const FLUID_CONTAINER: u8 = 0x0a;
    const FLUID: u8 = 0x0b;
    const UNPASSABLE: u8 = 0x0c;
    const UNMOVEABLE: u8 = 0x0d;
    const BLOCK_MISSILE: u8 = 0x0e;
    const BLOCK_PATHFIND: u8 = 0x0f;
    const PICKUPABLE: u8 = 0x10;
    const HANGABLE: u8 = 0x11;
    const VERTICAL: u8 = 0x12;
    const HORIZONTAL: u8 = 0x13;
    const ROTATABLE: u8 = 0x14;
    const HAS_LIGHT: u8 = 0x15;
    const FLOOR_CHANGE: u8 = 0x17;
    const HAS_OFFSET: u8 = 0x18;
    const HAS_ELEVATION: u8 = 0x19;
    const LYING_OBJECT: u8 = 0x1a;
    const ANIMATE_ALWAYS: u8 = 0x1b;
    const MINI_MAP: u8 = 0x1c;
    const LENS_HELP: u8 = 0x1d;
    const FULL_GROUND: u8 = 0x1e;
    const LAST_FLAG: u8 = 0xff;
}

pub struct MetadataFlags4;
impl MetadataFlags4 {
    pub const GROUND: u8 = 0x00;
    const GROUND_BORDER: u8 = 0x01;
    const ON_BOTTOM: u8 = 0x02;
    const ON_TOP: u8 = 0x03;
    const CONTAINER: u8 = 0x04;
    const STACKABLE: u8 = 0x05;
    const FORCE_USE: u8 = 0x06;
    const MULTI_USE: u8 = 0x07;
    const HAS_CHARGES: u8 = 0x08;
    const WRITABLE: u8 = 0x09;
    const WRITABLE_ONCE: u8 = 0x0a;
    const FLUID_CONTAINER: u8 = 0x0b;
    const FLUID: u8 = 0x0c;
    const UNPASSABLE: u8 = 0x0d;
    const UNMOVEABLE: u8 = 0x0e;
    const BLOCK_MISSILE: u8 = 0x0f;
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
    const HAS_ELEVATION: u8 = 0x1a;
    const LYING_OBJECT: u8 = 0x1b;
    const ANIMATE_ALWAYS: u8 = 0x1c;
    const MINI_MAP: u8 = 0x1d;
    const LENS_HELP: u8 = 0x1e;
    const FULL_GROUND: u8 = 0x1f;
    const IGNORE_LOOK: u8 = 0x20;
    const WRAPPABLE: u8 = 0x24;
    const UNWRAPPABLE: u8 = 0x25;
    const HAS_BONES: u8 = 0x27;
    const LAST_FLAG: u8 = 0xff;
}

pub struct MetadataFlags5;
impl MetadataFlags5 {
    pub const GROUND: u8 = 0x00;
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
    const LYING_OBJECT: u8 = 0x1a;
    const ANIMATE_ALWAYS: u8 = 0x1b;
    const MINI_MAP: u8 = 0x1c;
    const LENS_HELP: u8 = 0x1d;
    const FULL_GROUND: u8 = 0x1e;
    const IGNORE_LOOK: u8 = 0x1f;
    const CLOTH: u8 = 0x20;
    const MARKET_ITEM: u8 = 0x21;
    const HAS_BONES: u8 = 0x27;
    const LAST_FLAG: u8 = 0xff;
}

pub struct MetadataFlags6;
impl MetadataFlags6 {
    pub const GROUND: u8 = 0x00;
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
    const USABLE: u8 = 0xfe;
    const LAST_FLAG: u8 = 0xff;
}

pub struct DatWriter<W: Write> {
    writer: W,
    version: u32,
    extended: bool,
    frame_durations: bool,
    frame_groups: bool,
}

impl<W: Write> DatWriter<W> {
    pub fn new(writer: W, version: u32, extended: bool, frame_durations: bool) -> Self {
        let frame_groups = version >= 1057;
        Self {
            writer,
            version,
            extended,
            frame_durations,
            frame_groups,
        }
    }

    fn write_u8(&mut self, value: u8) -> io::Result<()> {
        self.writer.write_all(&[value])
    }

    fn write_i8(&mut self, value: i8) -> io::Result<()> {
        self.writer.write_all(&[value as u8])
    }

    fn write_u16_le(&mut self, value: u16) -> io::Result<()> {
        self.writer.write_all(&value.to_le_bytes())
    }

    fn write_bones(&mut self, thing: &ThingType) -> io::Result<()> {
        for i in 0..4 {
            let x = thing.bones_offset_x.get(i).copied().unwrap_or(0);
            let y = thing.bones_offset_y.get(i).copied().unwrap_or(0);
            self.write_u16_le(x as u16)?;
            self.write_u16_le(y as u16)?;
        }
        Ok(())
    }

    fn write_u32_le(&mut self, value: u32) -> io::Result<()> {
        self.writer.write_all(&value.to_le_bytes())
    }

    fn write_i32_le(&mut self, value: i32) -> io::Result<()> {
        self.writer.write_all(&value.to_le_bytes())
    }

    fn write_string(&mut self, s: &str) -> io::Result<()> {
        self.write_u16_le(s.len() as u16)?;
        self.writer.write_all(s.as_bytes())
    }

    pub fn write_header(&mut self, signature: u32, items_count: u16, outfits_count: u16, effects_count: u16, missiles_count: u16) -> io::Result<()> {
        self.write_u32_le(signature)?;
        self.write_u16_le(items_count)?;
        self.write_u16_le(outfits_count)?;
        self.write_u16_le(effects_count)?;
        self.write_u16_le(missiles_count)?;
        Ok(())
    }

    fn write_item_properties_v1(&mut self, thing: &ThingType) -> io::Result<()> {
        if thing.is_ground {
            self.write_u8(MetadataFlags1::GROUND)?;
            self.write_u16_le(thing.ground_speed)?;
        } else if thing.is_on_bottom {
            self.write_u8(MetadataFlags1::ON_BOTTOM)?;
        } else if thing.is_on_top {
            self.write_u8(MetadataFlags1::ON_TOP)?;
        }
        if thing.is_container {
            self.write_u8(MetadataFlags1::CONTAINER)?;
        }
        if thing.stackable {
            self.write_u8(MetadataFlags1::STACKABLE)?;
        }
        if thing.multi_use {
            self.write_u8(MetadataFlags1::MULTI_USE)?;
        }
        if thing.force_use {
            self.write_u8(MetadataFlags1::FORCE_USE)?;
        }
        if thing.writable {
            self.write_u8(MetadataFlags1::WRITABLE)?;
            self.write_u16_le(thing.max_text_length)?;
        }
        if thing.writable_once {
            self.write_u8(MetadataFlags1::WRITABLE_ONCE)?;
            self.write_u16_le(thing.max_text_length)?;
        }
        if thing.is_fluid_container {
            self.write_u8(MetadataFlags1::FLUID_CONTAINER)?;
        }
        if thing.is_fluid {
            self.write_u8(MetadataFlags1::FLUID)?;
        }
        if thing.is_unpassable {
            self.write_u8(MetadataFlags1::UNPASSABLE)?;
        }
        if thing.is_unmoveable {
            self.write_u8(MetadataFlags1::UNMOVEABLE)?;
        }
        if thing.block_missile {
            self.write_u8(MetadataFlags1::BLOCK_MISSILE)?;
        }
        if thing.block_pathfind {
            self.write_u8(MetadataFlags1::BLOCK_PATHFIND)?;
        }
        if thing.pickupable {
            self.write_u8(MetadataFlags1::PICKUPABLE)?;
        }
        if thing.has_light {
            self.write_u8(MetadataFlags1::HAS_LIGHT)?;
            self.write_u16_le(thing.light_level)?;
            self.write_u16_le(thing.light_color)?;
        }
        if thing.floor_change {
            self.write_u8(MetadataFlags1::FLOOR_CHANGE)?;
        }
        if thing.is_full_ground {
            self.write_u8(MetadataFlags1::FULL_GROUND)?;
        }
        if thing.has_elevation {
            self.write_u8(MetadataFlags1::HAS_ELEVATION)?;
            self.write_u16_le(thing.elevation)?;
        }
        if thing.has_offset {
            self.write_u8(MetadataFlags1::HAS_OFFSET)?;
        }
        if thing.mini_map {
            self.write_u8(MetadataFlags1::MINI_MAP)?;
            self.write_u16_le(thing.mini_map_color)?;
        }
        if thing.rotatable {
            self.write_u8(MetadataFlags1::ROTATABLE)?;
        }
        if thing.is_lying_object {
            self.write_u8(MetadataFlags1::LYING_OBJECT)?;
        }
        if thing.animate_always {
            self.write_u8(MetadataFlags1::ANIMATE_ALWAYS)?;
        }
        if thing.is_lens_help {
            self.write_u8(MetadataFlags1::LENS_HELP)?;
            self.write_u16_le(thing.lens_help)?;
        }
        if thing.wrappable {
            self.write_u8(MetadataFlags1::WRAPPABLE)?;
        }
        if thing.unwrappable {
            self.write_u8(MetadataFlags1::UNWRAPPABLE)?;
        }

        self.write_u8(MetadataFlags1::LAST_FLAG)?;
        Ok(())
    }

    fn write_non_item_properties_v1(&mut self, thing: &ThingType) -> io::Result<()> {
        if thing.has_light {
            self.write_u8(MetadataFlags1::HAS_LIGHT)?;
            self.write_u16_le(thing.light_level)?;
            self.write_u16_le(thing.light_color)?;
        }

        if thing.has_offset {
            self.write_u8(MetadataFlags1::HAS_OFFSET)?;
        }

        if thing.animate_always {
            self.write_u8(MetadataFlags1::ANIMATE_ALWAYS)?;
        }

        self.write_u8(MetadataFlags1::LAST_FLAG)?;
        Ok(())
    }

    fn write_item_properties_v2(&mut self, thing: &ThingType) -> io::Result<()> {
        if thing.is_ground {
            self.write_u8(MetadataFlags2::GROUND)?;
            self.write_u16_le(thing.ground_speed)?;
        } else if thing.is_on_bottom {
            self.write_u8(MetadataFlags2::ON_BOTTOM)?;
        } else if thing.is_on_top {
            self.write_u8(MetadataFlags2::ON_TOP)?;
        }
        if thing.is_container {
            self.write_u8(MetadataFlags2::CONTAINER)?;
        }
        if thing.stackable {
            self.write_u8(MetadataFlags2::STACKABLE)?;
        }
        if thing.multi_use {
            self.write_u8(MetadataFlags2::MULTI_USE)?;
        }
        if thing.force_use {
            self.write_u8(MetadataFlags2::FORCE_USE)?;
        }
        if thing.writable {
            self.write_u8(MetadataFlags2::WRITABLE)?;
            self.write_u16_le(thing.max_text_length)?;
        }
        if thing.writable_once {
            self.write_u8(MetadataFlags2::WRITABLE_ONCE)?;
            self.write_u16_le(thing.max_text_length)?;
        }
        if thing.is_fluid_container {
            self.write_u8(MetadataFlags2::FLUID_CONTAINER)?;
        }
        if thing.is_fluid {
            self.write_u8(MetadataFlags2::FLUID)?;
        }
        if thing.is_unpassable {
            self.write_u8(MetadataFlags2::UNPASSABLE)?;
        }
        if thing.is_unmoveable {
            self.write_u8(MetadataFlags2::UNMOVEABLE)?;
        }
        if thing.block_missile {
            self.write_u8(MetadataFlags2::BLOCK_MISSILE)?;
        }
        if thing.block_pathfind {
            self.write_u8(MetadataFlags2::BLOCK_PATHFIND)?;
        }
        if thing.pickupable {
            self.write_u8(MetadataFlags2::PICKUPABLE)?;
        }
        if thing.has_light {
            self.write_u8(MetadataFlags2::HAS_LIGHT)?;
            self.write_u16_le(thing.light_level)?;
            self.write_u16_le(thing.light_color)?;
        }
        if thing.floor_change {
            self.write_u8(MetadataFlags2::FLOOR_CHANGE)?;
        }
        if thing.is_full_ground {
            self.write_u8(MetadataFlags2::FULL_GROUND)?;
        }
        if thing.has_elevation {
            self.write_u8(MetadataFlags2::HAS_ELEVATION)?;
            self.write_u16_le(thing.elevation)?;
        }
        if thing.has_offset {
            self.write_u8(MetadataFlags2::HAS_OFFSET)?;
        }
        if thing.mini_map {
            self.write_u8(MetadataFlags2::MINI_MAP)?;
            self.write_u16_le(thing.mini_map_color)?;
        }
        if thing.rotatable {
            self.write_u8(MetadataFlags2::ROTATABLE)?;
        }
        if thing.is_lying_object {
            self.write_u8(MetadataFlags2::LYING_OBJECT)?;
        }
        if thing.hangable {
            self.write_u8(MetadataFlags2::HANGABLE)?;
        }
        if thing.is_vertical {
            self.write_u8(MetadataFlags2::VERTICAL)?;
        }
        if thing.is_horizontal {
            self.write_u8(MetadataFlags2::HORIZONTAL)?;
        }
        if thing.animate_always {
            self.write_u8(MetadataFlags2::ANIMATE_ALWAYS)?;
        }
        if thing.is_lens_help {
            self.write_u8(MetadataFlags2::LENS_HELP)?;
            self.write_u16_le(thing.lens_help)?;
        }
        if thing.wrappable {
            self.write_u8(MetadataFlags2::WRAPPABLE)?;
        }
        if thing.unwrappable {
            self.write_u8(MetadataFlags2::UNWRAPPABLE)?;
        }

        self.write_u8(MetadataFlags2::LAST_FLAG)?;
        Ok(())
    }

    fn write_non_item_properties_v2(&mut self, thing: &ThingType) -> io::Result<()> {
        if thing.has_light {
            self.write_u8(MetadataFlags2::HAS_LIGHT)?;
            self.write_u16_le(thing.light_level)?;
            self.write_u16_le(thing.light_color)?;
        }

        if thing.has_offset {
            self.write_u8(MetadataFlags2::HAS_OFFSET)?;
        }

        if thing.animate_always {
            self.write_u8(MetadataFlags2::ANIMATE_ALWAYS)?;
        }

        self.write_u8(MetadataFlags2::LAST_FLAG)?;
        Ok(())
    }

    fn write_item_properties_v3(&mut self, thing: &ThingType) -> io::Result<()> {
        if thing.is_ground {
            self.write_u8(MetadataFlags3::GROUND)?;
            self.write_u16_le(thing.ground_speed)?;
        } else if thing.is_ground_border {
            self.write_u8(MetadataFlags3::GROUND_BORDER)?;
        } else if thing.is_on_bottom {
            self.write_u8(MetadataFlags3::ON_BOTTOM)?;
        } else if thing.is_on_top {
            self.write_u8(MetadataFlags3::ON_TOP)?;
        }
        if thing.is_container {
            self.write_u8(MetadataFlags3::CONTAINER)?;
        }
        if thing.stackable {
            self.write_u8(MetadataFlags3::STACKABLE)?;
        }
        if thing.multi_use {
            self.write_u8(MetadataFlags3::MULTI_USE)?;
        }
        if thing.force_use {
            self.write_u8(MetadataFlags3::FORCE_USE)?;
        }
        if thing.writable {
            self.write_u8(MetadataFlags3::WRITABLE)?;
            self.write_u16_le(thing.max_text_length)?;
        }
        if thing.writable_once {
            self.write_u8(MetadataFlags3::WRITABLE_ONCE)?;
            self.write_u16_le(thing.max_text_length)?;
        }
        if thing.is_fluid_container {
            self.write_u8(MetadataFlags3::FLUID_CONTAINER)?;
        }
        if thing.is_fluid {
            self.write_u8(MetadataFlags3::FLUID)?;
        }
        if thing.is_unpassable {
            self.write_u8(MetadataFlags3::UNPASSABLE)?;
        }
        if thing.is_unmoveable {
            self.write_u8(MetadataFlags3::UNMOVEABLE)?;
        }
        if thing.block_missile {
            self.write_u8(MetadataFlags3::BLOCK_MISSILE)?;
        }
        if thing.block_pathfind {
            self.write_u8(MetadataFlags3::BLOCK_PATHFIND)?;
        }
        if thing.pickupable {
            self.write_u8(MetadataFlags3::PICKUPABLE)?;
        }
        if thing.hangable {
            self.write_u8(MetadataFlags3::HANGABLE)?;
        }
        if thing.is_vertical {
            self.write_u8(MetadataFlags3::VERTICAL)?;
        }
        if thing.is_horizontal {
            self.write_u8(MetadataFlags3::HORIZONTAL)?;
        }
        if thing.rotatable {
            self.write_u8(MetadataFlags3::ROTATABLE)?;
        }
        if thing.has_light {
            self.write_u8(MetadataFlags3::HAS_LIGHT)?;
            self.write_u16_le(thing.light_level)?;
            self.write_u16_le(thing.light_color)?;
        }
        if thing.floor_change {
            self.write_u8(MetadataFlags3::FLOOR_CHANGE)?;
        }
        if thing.has_offset {
            self.write_u8(MetadataFlags3::HAS_OFFSET)?;
            self.write_u16_le(thing.offset_x as u16)?;
            self.write_u16_le(thing.offset_y as u16)?;
        }
        if thing.has_elevation {
            self.write_u8(MetadataFlags3::HAS_ELEVATION)?;
            self.write_u16_le(thing.elevation)?;
        }
        if thing.is_lying_object {
            self.write_u8(MetadataFlags3::LYING_OBJECT)?;
        }
        if thing.animate_always {
            self.write_u8(MetadataFlags3::ANIMATE_ALWAYS)?;
        }
        if thing.mini_map {
            self.write_u8(MetadataFlags3::MINI_MAP)?;
            self.write_u16_le(thing.mini_map_color)?;
        }
        if thing.is_lens_help {
            self.write_u8(MetadataFlags3::LENS_HELP)?;
            self.write_u16_le(thing.lens_help)?;
        }
        if thing.is_full_ground {
            self.write_u8(MetadataFlags3::FULL_GROUND)?;
        }

        self.write_u8(MetadataFlags3::LAST_FLAG)?;
        Ok(())
    }

    fn write_non_item_properties_v3(&mut self, thing: &ThingType) -> io::Result<()> {
        if thing.has_light {
            self.write_u8(MetadataFlags3::HAS_LIGHT)?;
            self.write_u16_le(thing.light_level)?;
            self.write_u16_le(thing.light_color)?;
        }

        if thing.has_offset {
            self.write_u8(MetadataFlags3::HAS_OFFSET)?;
            self.write_u16_le(thing.offset_x as u16)?;
            self.write_u16_le(thing.offset_y as u16)?;
        }

        if thing.animate_always {
            self.write_u8(MetadataFlags3::ANIMATE_ALWAYS)?;
        }

        self.write_u8(MetadataFlags3::LAST_FLAG)?;
        Ok(())
    }

    fn write_item_properties_v4(&mut self, thing: &ThingType) -> io::Result<()> {
        if thing.is_ground {
            self.write_u8(MetadataFlags4::GROUND)?;
            self.write_u16_le(thing.ground_speed)?;
        } else if thing.is_ground_border {
            self.write_u8(MetadataFlags4::GROUND_BORDER)?;
        } else if thing.is_on_bottom {
            self.write_u8(MetadataFlags4::ON_BOTTOM)?;
        } else if thing.is_on_top {
            self.write_u8(MetadataFlags4::ON_TOP)?;
        }
        if thing.is_container {
            self.write_u8(MetadataFlags4::CONTAINER)?;
        }
        if thing.stackable {
            self.write_u8(MetadataFlags4::STACKABLE)?;
        }
        if thing.force_use {
            self.write_u8(MetadataFlags4::FORCE_USE)?;
        }
        if thing.multi_use {
            self.write_u8(MetadataFlags4::MULTI_USE)?;
        }
        if thing.has_charges {
            self.write_u8(MetadataFlags4::HAS_CHARGES)?;
        }
        if thing.writable {
            self.write_u8(MetadataFlags4::WRITABLE)?;
            self.write_u16_le(thing.max_text_length)?;
        }
        if thing.writable_once {
            self.write_u8(MetadataFlags4::WRITABLE_ONCE)?;
            self.write_u16_le(thing.max_text_length)?;
        }
        if thing.is_fluid_container {
            self.write_u8(MetadataFlags4::FLUID_CONTAINER)?;
        }
        if thing.is_fluid {
            self.write_u8(MetadataFlags4::FLUID)?;
        }
        if thing.is_unpassable {
            self.write_u8(MetadataFlags4::UNPASSABLE)?;
        }
        if thing.is_unmoveable {
            self.write_u8(MetadataFlags4::UNMOVEABLE)?;
        }
        if thing.block_missile {
            self.write_u8(MetadataFlags4::BLOCK_MISSILE)?;
        }
        if thing.block_pathfind {
            self.write_u8(MetadataFlags4::BLOCK_PATHFIND)?;
        }
        if thing.pickupable {
            self.write_u8(MetadataFlags4::PICKUPABLE)?;
        }
        if thing.hangable {
            self.write_u8(MetadataFlags4::HANGABLE)?;
        }
        if thing.is_vertical {
            self.write_u8(MetadataFlags4::VERTICAL)?;
        }
        if thing.is_horizontal {
            self.write_u8(MetadataFlags4::HORIZONTAL)?;
        }
        if thing.rotatable {
            self.write_u8(MetadataFlags4::ROTATABLE)?;
        }
        if thing.has_light {
            self.write_u8(MetadataFlags4::HAS_LIGHT)?;
            self.write_u16_le(thing.light_level)?;
            self.write_u16_le(thing.light_color)?;
        }
        if thing.dont_hide {
            self.write_u8(MetadataFlags4::DONT_HIDE)?;
        }
        if thing.floor_change {
            self.write_u8(MetadataFlags4::FLOOR_CHANGE)?;
        }
        if thing.has_offset {
            self.write_u8(MetadataFlags4::HAS_OFFSET)?;
            self.write_u16_le(thing.offset_x as u16)?;
            self.write_u16_le(thing.offset_y as u16)?;
        }
        if thing.has_elevation {
            self.write_u8(MetadataFlags4::HAS_ELEVATION)?;
            self.write_u16_le(thing.elevation)?;
        }
        if thing.is_lying_object {
            self.write_u8(MetadataFlags4::LYING_OBJECT)?;
        }
        if thing.animate_always {
            self.write_u8(MetadataFlags4::ANIMATE_ALWAYS)?;
        }
        if thing.mini_map {
            self.write_u8(MetadataFlags4::MINI_MAP)?;
            self.write_u16_le(thing.mini_map_color)?;
        }
        if thing.is_lens_help {
            self.write_u8(MetadataFlags4::LENS_HELP)?;
            self.write_u16_le(thing.lens_help)?;
        }
        if thing.is_full_ground {
            self.write_u8(MetadataFlags4::FULL_GROUND)?;
        }
        if thing.ignore_look {
            self.write_u8(MetadataFlags4::IGNORE_LOOK)?;
        }
        if thing.wrappable {
            self.write_u8(MetadataFlags4::WRAPPABLE)?;
        }
        if thing.unwrappable {
            self.write_u8(MetadataFlags4::UNWRAPPABLE)?;
        }
        if thing.has_bones {
            self.write_u8(MetadataFlags4::HAS_BONES)?;
            self.write_bones(thing)?;
        }

        self.write_u8(MetadataFlags4::LAST_FLAG)?;
        Ok(())
    }

    fn write_non_item_properties_v4(&mut self, thing: &ThingType) -> io::Result<()> {
        if thing.has_light {
            self.write_u8(MetadataFlags4::HAS_LIGHT)?;
            self.write_u16_le(thing.light_level)?;
            self.write_u16_le(thing.light_color)?;
        }

        if thing.has_offset {
            self.write_u8(MetadataFlags4::HAS_OFFSET)?;
            self.write_u16_le(thing.offset_x as u16)?;
            self.write_u16_le(thing.offset_y as u16)?;
        }

        if thing.animate_always {
            self.write_u8(MetadataFlags4::ANIMATE_ALWAYS)?;
        }

        if thing.has_bones {
            self.write_u8(MetadataFlags4::HAS_BONES)?;
            self.write_bones(thing)?;
        }

        self.write_u8(MetadataFlags4::LAST_FLAG)?;
        Ok(())
    }

    fn write_item_properties_v5(&mut self, thing: &ThingType) -> io::Result<()> {
        if thing.is_ground {
            self.write_u8(MetadataFlags5::GROUND)?;
            self.write_u16_le(thing.ground_speed)?;
        } else if thing.is_ground_border {
            self.write_u8(MetadataFlags5::GROUND_BORDER)?;
        } else if thing.is_on_bottom {
            self.write_u8(MetadataFlags5::ON_BOTTOM)?;
        } else if thing.is_on_top {
            self.write_u8(MetadataFlags5::ON_TOP)?;
        }
        if thing.is_container {
            self.write_u8(MetadataFlags5::CONTAINER)?;
        }
        if thing.stackable {
            self.write_u8(MetadataFlags5::STACKABLE)?;
        }
        if thing.force_use {
            self.write_u8(MetadataFlags5::FORCE_USE)?;
        }
        if thing.multi_use {
            self.write_u8(MetadataFlags5::MULTI_USE)?;
        }
        if thing.writable {
            self.write_u8(MetadataFlags5::WRITABLE)?;
            self.write_u16_le(thing.max_text_length)?;
        }
        if thing.writable_once {
            self.write_u8(MetadataFlags5::WRITABLE_ONCE)?;
            self.write_u16_le(thing.max_text_length)?;
        }
        if thing.is_fluid_container {
            self.write_u8(MetadataFlags5::FLUID_CONTAINER)?;
        }
        if thing.is_fluid {
            self.write_u8(MetadataFlags5::FLUID)?;
        }
        if thing.is_unpassable {
            self.write_u8(MetadataFlags5::UNPASSABLE)?;
        }
        if thing.is_unmoveable {
            self.write_u8(MetadataFlags5::UNMOVEABLE)?;
        }
        if thing.block_missile {
            self.write_u8(MetadataFlags5::BLOCK_MISSILE)?;
        }
        if thing.block_pathfind {
            self.write_u8(MetadataFlags5::BLOCK_PATHFIND)?;
        }
        if thing.pickupable {
            self.write_u8(MetadataFlags5::PICKUPABLE)?;
        }
        if thing.hangable {
            self.write_u8(MetadataFlags5::HANGABLE)?;
        }
        if thing.is_vertical {
            self.write_u8(MetadataFlags5::VERTICAL)?;
        }
        if thing.is_horizontal {
            self.write_u8(MetadataFlags5::HORIZONTAL)?;
        }
        if thing.rotatable {
            self.write_u8(MetadataFlags5::ROTATABLE)?;
        }
        if thing.has_light {
            self.write_u8(MetadataFlags5::HAS_LIGHT)?;
            self.write_u16_le(thing.light_level)?;
            self.write_u16_le(thing.light_color)?;
        }
        if thing.dont_hide {
            self.write_u8(MetadataFlags5::DONT_HIDE)?;
        }
        if thing.is_translucent {
            self.write_u8(MetadataFlags5::TRANSLUCENT)?;
        }
        if thing.has_offset {
            self.write_u8(MetadataFlags5::HAS_OFFSET)?;
            self.write_u16_le(thing.offset_x as u16)?;
            self.write_u16_le(thing.offset_y as u16)?;
        }
        if thing.has_elevation {
            self.write_u8(MetadataFlags5::HAS_ELEVATION)?;
            self.write_u16_le(thing.elevation)?;
        }
        if thing.is_lying_object {
            self.write_u8(MetadataFlags5::LYING_OBJECT)?;
        }
        if thing.animate_always {
            self.write_u8(MetadataFlags5::ANIMATE_ALWAYS)?;
        }
        if thing.mini_map {
            self.write_u8(MetadataFlags5::MINI_MAP)?;
            self.write_u16_le(thing.mini_map_color)?;
        }
        if thing.is_lens_help {
            self.write_u8(MetadataFlags5::LENS_HELP)?;
            self.write_u16_le(thing.lens_help)?;
        }
        if thing.is_full_ground {
            self.write_u8(MetadataFlags5::FULL_GROUND)?;
        }
        if thing.ignore_look {
            self.write_u8(MetadataFlags5::IGNORE_LOOK)?;
        }
        if thing.cloth {
            self.write_u8(MetadataFlags5::CLOTH)?;
            self.write_u16_le(thing.cloth_slot)?;
        }
        if thing.is_market_item {
            self.write_u8(MetadataFlags5::MARKET_ITEM)?;
            self.write_u16_le(thing.market_category)?;
            self.write_u16_le(thing.market_trade_as)?;
            self.write_u16_le(thing.market_show_as)?;
            self.write_string(&thing.market_name)?;
            self.write_u16_le(thing.market_restrict_profession)?;
            self.write_u16_le(thing.market_restrict_level)?;
        }
        if thing.has_bones {
            self.write_u8(MetadataFlags5::HAS_BONES)?;
            self.write_bones(thing)?;
        }

        self.write_u8(MetadataFlags5::LAST_FLAG)?;
        Ok(())
    }

    fn write_non_item_properties_v5(&mut self, thing: &ThingType) -> io::Result<()> {
        if thing.has_light {
            self.write_u8(MetadataFlags5::HAS_LIGHT)?;
            self.write_u16_le(thing.light_level)?;
            self.write_u16_le(thing.light_color)?;
        }

        if thing.has_offset {
            self.write_u8(MetadataFlags5::HAS_OFFSET)?;
            self.write_u16_le(thing.offset_x as u16)?;
            self.write_u16_le(thing.offset_y as u16)?;
        }

        if thing.animate_always {
            self.write_u8(MetadataFlags5::ANIMATE_ALWAYS)?;
        }

        if thing.has_bones {
            self.write_u8(MetadataFlags5::HAS_BONES)?;
            self.write_bones(thing)?;
        }

        self.write_u8(MetadataFlags5::LAST_FLAG)?;
        Ok(())
    }

    fn write_item_properties_v6(&mut self, thing: &ThingType) -> io::Result<()> {
        if thing.is_ground {
            self.write_u8(MetadataFlags6::GROUND)?;
            self.write_u16_le(thing.ground_speed)?;
        } else if thing.is_ground_border {
            self.write_u8(MetadataFlags6::GROUND_BORDER)?;
        } else if thing.is_on_bottom {
            self.write_u8(MetadataFlags6::ON_BOTTOM)?;
        } else if thing.is_on_top {
            self.write_u8(MetadataFlags6::ON_TOP)?;
        }
        if thing.is_container {
            self.write_u8(MetadataFlags6::CONTAINER)?;
        }
        if thing.stackable {
            self.write_u8(MetadataFlags6::STACKABLE)?;
        }
        if thing.force_use {
            self.write_u8(MetadataFlags6::FORCE_USE)?;
        }
        if thing.multi_use {
            self.write_u8(MetadataFlags6::MULTI_USE)?;
        }
        if thing.writable {
            self.write_u8(MetadataFlags6::WRITABLE)?;
            self.write_u16_le(thing.max_text_length)?;
        }
        if thing.writable_once {
            self.write_u8(MetadataFlags6::WRITABLE_ONCE)?;
            self.write_u16_le(thing.max_text_length)?;
        }
        if thing.is_fluid_container {
            self.write_u8(MetadataFlags6::FLUID_CONTAINER)?;
        }
        if thing.is_fluid {
            self.write_u8(MetadataFlags6::FLUID)?;
        }
        if thing.is_unpassable {
            self.write_u8(MetadataFlags6::UNPASSABLE)?;
        }
        if thing.is_unmoveable {
            self.write_u8(MetadataFlags6::UNMOVEABLE)?;
        }
        if thing.block_missile {
            self.write_u8(MetadataFlags6::BLOCK_MISSILE)?;
        }
        if thing.block_pathfind {
            self.write_u8(MetadataFlags6::BLOCK_PATHFIND)?;
        }
        if thing.no_move_animation {
            self.write_u8(MetadataFlags6::NO_MOVE_ANIMATION)?;
        }
        if thing.pickupable {
            self.write_u8(MetadataFlags6::PICKUPABLE)?;
        }
        if thing.hangable {
            self.write_u8(MetadataFlags6::HANGABLE)?;
        }
        if thing.is_vertical {
            self.write_u8(MetadataFlags6::VERTICAL)?;
        }
        if thing.is_horizontal {
            self.write_u8(MetadataFlags6::HORIZONTAL)?;
        }
        if thing.rotatable {
            self.write_u8(MetadataFlags6::ROTATABLE)?;
        }
        if thing.has_light {
            self.write_u8(MetadataFlags6::HAS_LIGHT)?;
            self.write_u16_le(thing.light_level)?;
            self.write_u16_le(thing.light_color)?;
        }
        if thing.dont_hide {
            self.write_u8(MetadataFlags6::DONT_HIDE)?;
        }
        if thing.is_translucent {
            self.write_u8(MetadataFlags6::TRANSLUCENT)?;
        }
        if thing.has_offset {
            self.write_u8(MetadataFlags6::HAS_OFFSET)?;
            self.write_u16_le(thing.offset_x as u16)?;
            self.write_u16_le(thing.offset_y as u16)?;
        }
        if thing.has_elevation {
            self.write_u8(MetadataFlags6::HAS_ELEVATION)?;
            self.write_u16_le(thing.elevation)?;
        }
        if thing.is_lying_object {
            self.write_u8(MetadataFlags6::LYING_OBJECT)?;
        }
        if thing.animate_always {
            self.write_u8(MetadataFlags6::ANIMATE_ALWAYS)?;
        }
        if thing.mini_map {
            self.write_u8(MetadataFlags6::MINI_MAP)?;
            self.write_u16_le(thing.mini_map_color)?;
        }
        if thing.is_lens_help {
            self.write_u8(MetadataFlags6::LENS_HELP)?;
            self.write_u16_le(thing.lens_help)?;
        }
        if thing.is_full_ground {
            self.write_u8(MetadataFlags6::FULL_GROUND)?;
        }
        if thing.ignore_look {
            self.write_u8(MetadataFlags6::IGNORE_LOOK)?;
        }
        if thing.cloth {
            self.write_u8(MetadataFlags6::CLOTH)?;
            self.write_u16_le(thing.cloth_slot)?;
        }
        if thing.is_market_item {
            self.write_u8(MetadataFlags6::MARKET_ITEM)?;
            self.write_u16_le(thing.market_category)?;
            self.write_u16_le(thing.market_trade_as)?;
            self.write_u16_le(thing.market_show_as)?;
            self.write_string(&thing.market_name)?;
            self.write_u16_le(thing.market_restrict_profession)?;
            self.write_u16_le(thing.market_restrict_level)?;
        }
        if thing.has_default_action {
            self.write_u8(MetadataFlags6::DEFAULT_ACTION)?;
            self.write_u16_le(thing.default_action)?;
        }
        if thing.wrappable {
            self.write_u8(MetadataFlags6::WRAPPABLE)?;
        }
        if thing.unwrappable {
            self.write_u8(MetadataFlags6::UNWRAPPABLE)?;
        }
        if thing.usable {
            self.write_u8(MetadataFlags6::USABLE)?;
        }
        if thing.has_bones {
            self.write_u8(MetadataFlags6::HAS_BONES)?;
            self.write_bones(thing)?;
        }

        self.write_u8(MetadataFlags6::LAST_FLAG)?;
        Ok(())
    }

    fn write_non_item_properties_v6(&mut self, thing: &ThingType) -> io::Result<()> {
        if thing.has_light {
            self.write_u8(MetadataFlags6::HAS_LIGHT)?;
            self.write_u16_le(thing.light_level)?;
            self.write_u16_le(thing.light_color)?;
        }

        if thing.has_offset {
            self.write_u8(MetadataFlags6::HAS_OFFSET)?;
            self.write_u16_le(thing.offset_x as u16)?;
            self.write_u16_le(thing.offset_y as u16)?;
        }

        if thing.animate_always {
            self.write_u8(MetadataFlags6::ANIMATE_ALWAYS)?;
        }

        if thing.top_effect && thing.category == "effect" {
            self.write_u8(MetadataFlags6::TOP_EFFECT)?;
        }

        if thing.has_bones {
            self.write_u8(MetadataFlags6::HAS_BONES)?;
            self.write_bones(thing)?;
        }

        self.write_u8(MetadataFlags6::LAST_FLAG)?;
        Ok(())
    }

    fn write_texture_patterns(&mut self, thing: &ThingType) -> io::Result<()> {
        if self.frame_groups && thing.category == "outfit" {
            if let Some(groups) = &thing.frame_groups_data {
                if !groups.is_empty() {
                    self.write_u8(groups.len() as u8)?;
                    
                    for (group_idx, group) in groups.iter().enumerate() {
                        let expected_sprites = group.width as usize
                            * group.height as usize
                            * group.layers as usize
                            * group.pattern_x as usize
                            * group.pattern_y as usize
                            * group.pattern_z as usize
                            * group.frames as usize;
                        
                        if group.sprite_index.len() != expected_sprites {
                            return Err(io::Error::new(
                                io::ErrorKind::InvalidData,
                                format!(
                                    "Outfit ID {} frame group {} sprite index mismatch: expected {} but has {}",
                                    thing.id,
                                    group_idx,
                                    expected_sprites,
                                    group.sprite_index.len()
                                )
                            ));
                        }
                        
                        let group_type = if groups.len() < 2 { 1 } else { group_idx as u8 };
                        
                        self.write_u8(group_type)?;
                        
                        self.write_u8(group.width)?;
                        self.write_u8(group.height)?;
                        
                        if group.width > 1 || group.height > 1 {
                            self.write_u8(group.exact_size)?;
                        }
                        
                        self.write_u8(group.layers)?;
                        self.write_u8(group.pattern_x)?;
                        self.write_u8(group.pattern_y)?;
                        self.write_u8(group.pattern_z)?;
                        self.write_u8(group.frames)?;
                        
                        if group.frames > 1 && self.frame_durations {
                            self.write_u8(group.animation_mode.unwrap_or(0))?;
                            self.write_i32_le(group.loop_count.unwrap_or(0))?;
                            self.write_i8(group.start_frame.unwrap_or(0))?;
                            
                            for i in 0..group.frames {
                                if let Some(durations) = &group.frame_durations {
                                    if (i as usize) < durations.len() {
                                        self.write_u32_le(durations[i as usize].minimum)?;
                                        self.write_u32_le(durations[i as usize].maximum)?;
                                    } else {
                                        self.write_u32_le(100)?;
                                        self.write_u32_le(100)?;
                                    }
                                } else {
                                    self.write_u32_le(100)?;
                                    self.write_u32_le(100)?;
                                }
                            }
                        }
                        
                        for &sprite_id in &group.sprite_index {
                            if self.extended {
                                self.write_u32_le(sprite_id)?;
                            } else {
                                self.write_u16_le(sprite_id as u16)?;
                            }
                        }
                    }
                    return Ok(());
                }
            }

            eprintln!("WARNING: Outfit {} using fallback (no frame_groups_data)! This may cause corruption.", thing.id);
            self.write_u8(1)?;
            self.write_u8(1)?;
        }

        self.write_u8(thing.width)?;
        self.write_u8(thing.height)?;

        if thing.width > 1 || thing.height > 1 {
            self.write_u8(thing.exact_size)?;
        }

        self.write_u8(thing.layers)?;
        self.write_u8(thing.pattern_x)?;
        self.write_u8(thing.pattern_y)?;
        if self.version > 750 {
            self.write_u8(thing.pattern_z)?;
        }
        self.write_u8(thing.frames)?;

        if thing.frames > 1 && self.frame_durations {
            self.write_u8(thing.animation_mode)?;
            self.write_i32_le(thing.loop_count)?;
            self.write_i8(thing.start_frame)?;

            for i in 0..thing.frames {
                if (i as usize) < thing.frame_durations.len() {
                    self.write_u32_le(thing.frame_durations[i as usize].minimum)?;
                    self.write_u32_le(thing.frame_durations[i as usize].maximum)?;
                } else {
                    self.write_u32_le(100)?;
                    self.write_u32_le(100)?;
                }
            }
        }

        for &sprite_id in &thing.sprite_index {
            if self.extended {
                self.write_u32_le(sprite_id)?;
            } else {
                self.write_u16_le(sprite_id as u16)?;
            }
        }

        Ok(())
    }

    pub fn write_thing(&mut self, thing: &ThingType) -> io::Result<()> {
        let uses_frame_groups = self.frame_groups 
            && thing.category == "outfit" 
            && thing.frame_groups_data.is_some() 
            && !thing.frame_groups_data.as_ref().unwrap().is_empty();

        if !uses_frame_groups {
            let total_sprites = thing.width as u32
                * thing.height as u32
                * thing.pattern_x as u32
                * thing.pattern_y as u32
                * thing.pattern_z as u32
                * thing.frames as u32
                * thing.layers as u32;

            if total_sprites > 4096 {
                return Err(io::Error::new(
                    io::ErrorKind::InvalidData,
                    format!(
                        "Thing ID {} ({}) has {} sprites ({}×{}×{}×{}×{}×{}×{}) which exceeds the limit of 4096. Sprite index length: {}",
                        thing.id,
                        thing.category,
                        total_sprites,
                        thing.width, thing.height,
                        thing.pattern_x, thing.pattern_y, thing.pattern_z,
                        thing.frames, thing.layers,
                        thing.sprite_index.len()
                    )
                ));
            }

            if thing.sprite_index.len() != total_sprites as usize {
                return Err(io::Error::new(
                    io::ErrorKind::InvalidData,
                    format!(
                        "Thing ID {} ({}) sprite index length mismatch: expected {} sprites but array has {} entries",
                        thing.id,
                        thing.category,
                        total_sprites,
                        thing.sprite_index.len()
                    )
                ));
            }
        }

        let is_item = thing.category == "item";

        if self.version < 710 {
            return Err(io::Error::new(
                io::ErrorKind::Unsupported,
                format!("Writing version {} not supported (minimum 7.10)", self.version)
            ));
        } else if self.version <= 730 {
            if is_item {
                self.write_item_properties_v1(thing)?;
            } else {
                self.write_non_item_properties_v1(thing)?;
            }
        } else if self.version <= 750 {
            if is_item {
                self.write_item_properties_v2(thing)?;
            } else {
                self.write_non_item_properties_v2(thing)?;
            }
        } else if self.version <= 772 {
            if is_item {
                self.write_item_properties_v3(thing)?;
            } else {
                self.write_non_item_properties_v3(thing)?;
            }
        } else if self.version <= 854 {
            if is_item {
                self.write_item_properties_v4(thing)?;
            } else {
                self.write_non_item_properties_v4(thing)?;
            }
        } else if self.version <= 986 {
            if is_item {
                self.write_item_properties_v5(thing)?;
            } else {
                self.write_non_item_properties_v5(thing)?;
            }
        } else {
            if is_item {
                self.write_item_properties_v6(thing)?;
            } else {
                self.write_non_item_properties_v6(thing)?;
            }
        }

        self.write_texture_patterns(thing)?;

        Ok(())
    }
}

pub fn write_dat_file(
    path: &str,
    signature: u32,
    version: u32,
    extended: bool,
    frame_durations: bool,
    items_min_id: u16,
    items_max_id: u16,
    outfits_min_id: u16,
    outfits_max_id: u16,
    effects_min_id: u16,
    effects_max_id: u16,
    missiles_min_id: u16,
    missiles_max_id: u16,
    items: Vec<ThingType>,
    outfits: Vec<ThingType>,
    effects: Vec<ThingType>,
    missiles: Vec<ThingType>,
) -> Result<(), String> {
    let serialize_cat = |things: &[ThingType], cat: &str| -> Result<HashMap<u32, Vec<u8>>, String> {
        things
            .par_iter()
            .map(|t| {
                let mut buf: Vec<u8> = Vec::with_capacity(64);
                {
                    let mut w = DatWriter::new(&mut buf, version, extended, frame_durations);
                    w.write_thing(t)
                        .map_err(|e| format!("Failed to write {} {}: {}", cat, t.id, e))?;
                }
                Ok((t.id, buf))
            })
            .collect()
    };

    let items_bytes = serialize_cat(&items, "item")?;
    let outfits_bytes = serialize_cat(&outfits, "outfit")?;
    let effects_bytes = serialize_cat(&effects, "effect")?;
    let missiles_bytes = serialize_cat(&missiles, "missile")?;

    let body_len: usize = [&items_bytes, &outfits_bytes, &effects_bytes, &missiles_bytes]
        .iter()
        .map(|m| m.values().map(|b| b.len()).sum::<usize>())
        .sum::<usize>()
        + (items_max_id.saturating_sub(items_min_id) as usize + 1)
        + (outfits_max_id.saturating_sub(outfits_min_id) as usize + 1)
        + (effects_max_id.saturating_sub(effects_min_id) as usize + 1)
        + (missiles_max_id.saturating_sub(missiles_min_id) as usize + 1);

    let mut out: Vec<u8> = Vec::with_capacity(body_len + 12);
    {
        let mut hw = DatWriter::new(&mut out, version, extended, frame_durations);
        hw.write_header(
            signature,
            items_max_id,
            outfits_max_id,
            effects_max_id,
            missiles_max_id,
        )
        .map_err(|e| format!("Failed to write header: {}", e))?;
    }

    append_category(&mut out, &items_bytes, items_min_id, items_max_id);
    append_category(&mut out, &outfits_bytes, outfits_min_id, outfits_max_id);
    append_category(&mut out, &effects_bytes, effects_min_id, effects_max_id);
    append_category(&mut out, &missiles_bytes, missiles_min_id, missiles_max_id);

    std::fs::write(path, &out).map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(())
}

fn append_category(out: &mut Vec<u8>, map: &HashMap<u32, Vec<u8>>, min_id: u16, max_id: u16) {
    for id in min_id..=max_id {
        match map.get(&(id as u32)) {
            Some(bytes) => out.extend_from_slice(bytes),
            None => out.push(0xFF),
        }
    }
}

pub struct Reader<'a> {
    buf: &'a [u8],
    pos: usize,
}

impl<'a> Reader<'a> {
    pub fn new(buf: &'a [u8]) -> Self {
        Self { buf, pos: 0 }
    }

    pub fn need(&self, n: usize) -> Result<(), String> {
        if self.pos + n > self.buf.len() {
            Err(format!(
                "DAT buffer truncated at offset {}: need {} more bytes, have {}",
                self.pos,
                n,
                self.buf.len() - self.pos
            ))
        } else {
            Ok(())
        }
    }

    pub fn u8(&mut self) -> Result<u8, String> {
        self.need(1)?;
        let v = self.buf[self.pos];
        self.pos += 1;
        Ok(v)
    }

    pub fn i8(&mut self) -> Result<i8, String> {
        Ok(self.u8()? as i8)
    }

    pub fn bool(&mut self) -> Result<bool, String> {
        Ok(self.u8()? != 0)
    }

    pub fn u16(&mut self) -> Result<u16, String> {
        self.need(2)?;
        let v = u16::from_le_bytes([self.buf[self.pos], self.buf[self.pos + 1]]);
        self.pos += 2;
        Ok(v)
    }

    pub fn i16(&mut self) -> Result<i16, String> {
        Ok(self.u16()? as i16)
    }

    pub fn u32(&mut self) -> Result<u32, String> {
        self.need(4)?;
        let v = u32::from_le_bytes(self.buf[self.pos..self.pos + 4].try_into().unwrap());
        self.pos += 4;
        Ok(v)
    }

    pub fn i32(&mut self) -> Result<i32, String> {
        Ok(self.u32()? as i32)
    }

    pub fn string(&mut self) -> Result<String, String> {
        let n = self.u16()? as usize;
        self.need(n)?;
        let s = String::from_utf8_lossy(&self.buf[self.pos..self.pos + n]).into_owned();
        self.pos += n;
        Ok(s)
    }

    pub fn rest(&self) -> &'a [u8] {
        &self.buf[self.pos..]
    }

    pub fn take(&mut self, n: usize) -> Result<&'a [u8], String> {
        self.need(n)?;
        let s = &self.buf[self.pos..self.pos + n];
        self.pos += n;
        Ok(s)
    }
}

fn read_u32_vec(r: &mut Reader) -> Result<Vec<u32>, String> {
    let n = r.u32()? as usize;
    r.need(n)?;
    let mut v = Vec::with_capacity(n);
    for _ in 0..n {
        v.push(r.u32()?);
    }
    Ok(v)
}

fn read_i16_vec_u8len(r: &mut Reader) -> Result<Vec<i16>, String> {
    let n = r.u8()? as usize;
    let mut v = Vec::with_capacity(n);
    for _ in 0..n {
        v.push(r.i16()?);
    }
    Ok(v)
}

fn read_frame_durations(r: &mut Reader) -> Result<Vec<FrameDuration>, String> {
    let n = r.u16()? as usize;
    r.need(n)?;
    let mut v = Vec::with_capacity(n);
    for _ in 0..n {
        let minimum = r.u32()?;
        let maximum = r.u32()?;
        v.push(FrameDuration { minimum, maximum });
    }
    Ok(v)
}

fn read_frame_group(r: &mut Reader) -> Result<FrameGroup, String> {
    let r#type = r.u8()?;
    let width = r.u8()?;
    let height = r.u8()?;
    let exact_size = r.u8()?;
    let layers = r.u8()?;
    let pattern_x = r.u8()?;
    let pattern_y = r.u8()?;
    let pattern_z = r.u8()?;
    let frames = r.u8()?;
    let animation_mode = r.u8()?;
    let loop_count = r.i32()?;
    let start_frame = r.i8()?;
    let frame_durations = read_frame_durations(r)?;
    let sprite_index = read_u32_vec(r)?;

    Ok(FrameGroup {
        r#type,
        width,
        height,
        exact_size,
        layers,
        pattern_x,
        pattern_y,
        pattern_z,
        frames,
        sprite_index,
        is_animation: false,
        animation_mode: Some(animation_mode),
        loop_count: Some(loop_count),
        start_frame: Some(start_frame),
        frame_durations: Some(frame_durations),
    })
}

pub fn read_thing(r: &mut Reader, category: &str) -> Result<ThingType, String> {
    let id = r.u32()?;
    let width = r.u8()?;
    let height = r.u8()?;
    let exact_size = r.u8()?;
    let layers = r.u8()?;
    let pattern_x = r.u8()?;
    let pattern_y = r.u8()?;
    let pattern_z = r.u8()?;
    let frames = r.u8()?;

    let is_ground = r.bool()?;
    let is_ground_border = r.bool()?;
    let is_on_bottom = r.bool()?;
    let is_on_top = r.bool()?;
    let is_container = r.bool()?;
    let stackable = r.bool()?;
    let multi_use = r.bool()?;
    let force_use = r.bool()?;
    let has_charges = r.bool()?;
    let writable = r.bool()?;
    let writable_once = r.bool()?;
    let is_fluid_container = r.bool()?;
    let is_fluid = r.bool()?;
    let is_unpassable = r.bool()?;
    let is_unmoveable = r.bool()?;
    let block_missile = r.bool()?;
    let block_pathfind = r.bool()?;
    let no_move_animation = r.bool()?;
    let pickupable = r.bool()?;
    let hangable = r.bool()?;
    let is_vertical = r.bool()?;
    let is_horizontal = r.bool()?;
    let rotatable = r.bool()?;
    let has_light = r.bool()?;
    let dont_hide = r.bool()?;
    let floor_change = r.bool()?;
    let is_translucent = r.bool()?;
    let has_offset = r.bool()?;
    let has_elevation = r.bool()?;
    let is_lying_object = r.bool()?;
    let animate_always = r.bool()?;
    let mini_map = r.bool()?;
    let is_lens_help = r.bool()?;
    let is_full_ground = r.bool()?;
    let ignore_look = r.bool()?;
    let cloth = r.bool()?;
    let is_market_item = r.bool()?;
    let has_default_action = r.bool()?;
    let wrappable = r.bool()?;
    let unwrappable = r.bool()?;
    let usable = r.bool()?;
    let top_effect = r.bool()?;
    let has_bones = r.bool()?;

    let ground_speed = r.u16()?;
    let max_text_length = r.u16()?;
    let light_level = r.u16()?;
    let light_color = r.u16()?;
    let offset_x = r.i16()?;
    let offset_y = r.i16()?;
    let elevation = r.u16()?;
    let mini_map_color = r.u16()?;
    let lens_help = r.u16()?;
    let cloth_slot = r.u16()?;
    let market_category = r.u16()?;
    let market_trade_as = r.u16()?;
    let market_show_as = r.u16()?;
    let market_restrict_profession = r.u16()?;
    let market_restrict_level = r.u16()?;
    let default_action = r.u16()?;
    let animation_mode = r.u8()?;
    let loop_count = r.i32()?;
    let start_frame = r.i8()?;

    let market_name = r.string()?;

    let bones_offset_x = read_i16_vec_u8len(r)?;
    let bones_offset_y = read_i16_vec_u8len(r)?;

    let frame_durations = read_frame_durations(r)?;
    let sprite_index = read_u32_vec(r)?;

    let fg_count = r.u8()?;
    let frame_groups_data = if fg_count == 0 {
        None
    } else {
        let mut v = Vec::with_capacity(fg_count as usize);
        for _ in 0..fg_count {
            v.push(read_frame_group(r)?);
        }
        Some(v)
    };

    Ok(ThingType {
        id,
        category: category.to_string(),
        width,
        height,
        exact_size,
        layers,
        pattern_x,
        pattern_y,
        pattern_z,
        frames,
        sprite_index,
        frame_groups_data,
        is_ground,
        ground_speed,
        is_ground_border,
        is_on_bottom,
        is_on_top,
        is_container,
        stackable,
        force_use,
        multi_use,
        has_charges,
        writable,
        writable_once,
        max_text_length,
        is_fluid_container,
        is_fluid,
        is_unpassable,
        is_unmoveable,
        block_missile,
        block_pathfind,
        no_move_animation,
        pickupable,
        hangable,
        is_vertical,
        is_horizontal,
        rotatable,
        has_light,
        light_level,
        light_color,
        dont_hide,
        floor_change,
        is_translucent,
        has_offset,
        offset_x,
        offset_y,
        has_elevation,
        elevation,
        is_lying_object,
        animate_always,
        mini_map,
        mini_map_color,
        is_lens_help,
        lens_help,
        is_full_ground,
        ignore_look,
        cloth,
        cloth_slot,
        is_market_item,
        market_name,
        market_category,
        market_trade_as,
        market_show_as,
        market_restrict_profession,
        market_restrict_level,
        has_default_action,
        default_action,
        usable,
        wrappable,
        unwrappable,
        top_effect,
        has_bones,
        bones_offset_x,
        bones_offset_y,
        is_animation: false,
        animation_mode,
        loop_count,
        start_frame,
        frame_durations,
    })
}

fn nw_u16(buf: &mut Vec<u8>, v: u16) {
    buf.extend_from_slice(&v.to_le_bytes());
}

fn nw_i16(buf: &mut Vec<u8>, v: i16) {
    buf.extend_from_slice(&v.to_le_bytes());
}

fn nw_u32(buf: &mut Vec<u8>, v: u32) {
    buf.extend_from_slice(&v.to_le_bytes());
}

fn nw_str(buf: &mut Vec<u8>, s: &str) {
    let bytes = s.as_bytes();
    nw_u16(buf, bytes.len() as u16);
    buf.extend_from_slice(bytes);
}

fn nw_frame_durations(buf: &mut Vec<u8>, durations: &[FrameDuration]) {
    nw_u16(buf, durations.len() as u16);
    for d in durations {
        nw_u32(buf, d.minimum);
        nw_u32(buf, d.maximum);
    }
}

fn nw_u32_vec(buf: &mut Vec<u8>, arr: &[u32]) {
    nw_u32(buf, arr.len() as u32);
    for &v in arr {
        nw_u32(buf, v);
    }
}

fn nw_i16_vec_u8len(buf: &mut Vec<u8>, arr: &[i16]) {
    buf.push(arr.len() as u8);
    for &v in arr {
        nw_i16(buf, v);
    }
}

pub fn write_thing_neutral(buf: &mut Vec<u8>, t: &ThingType) {
    nw_u32(buf, t.id);
    buf.push(t.width);
    buf.push(t.height);
    buf.push(t.exact_size);
    buf.push(t.layers);
    buf.push(t.pattern_x);
    buf.push(t.pattern_y);
    buf.push(t.pattern_z);
    buf.push(t.frames);

    for b in [
        t.is_ground, t.is_ground_border, t.is_on_bottom, t.is_on_top, t.is_container, t.stackable,
        t.multi_use, t.force_use, t.has_charges, t.writable, t.writable_once, t.is_fluid_container,
        t.is_fluid, t.is_unpassable, t.is_unmoveable, t.block_missile, t.block_pathfind,
        t.no_move_animation, t.pickupable, t.hangable, t.is_vertical, t.is_horizontal, t.rotatable,
        t.has_light, t.dont_hide, t.floor_change, t.is_translucent, t.has_offset, t.has_elevation,
        t.is_lying_object, t.animate_always, t.mini_map, t.is_lens_help, t.is_full_ground,
        t.ignore_look, t.cloth, t.is_market_item, t.has_default_action, t.wrappable, t.unwrappable,
        t.usable, t.top_effect, t.has_bones,
    ] {
        buf.push(if b { 1 } else { 0 });
    }

    nw_u16(buf, t.ground_speed);
    nw_u16(buf, t.max_text_length);
    nw_u16(buf, t.light_level);
    nw_u16(buf, t.light_color);
    nw_i16(buf, t.offset_x);
    nw_i16(buf, t.offset_y);
    nw_u16(buf, t.elevation);
    nw_u16(buf, t.mini_map_color);
    nw_u16(buf, t.lens_help);
    nw_u16(buf, t.cloth_slot);
    nw_u16(buf, t.market_category);
    nw_u16(buf, t.market_trade_as);
    nw_u16(buf, t.market_show_as);
    nw_u16(buf, t.market_restrict_profession);
    nw_u16(buf, t.market_restrict_level);
    nw_u16(buf, t.default_action);
    buf.push(t.animation_mode);
    buf.extend_from_slice(&t.loop_count.to_le_bytes());
    buf.push(t.start_frame as u8);

    nw_str(buf, &t.market_name);

    nw_i16_vec_u8len(buf, &t.bones_offset_x);
    nw_i16_vec_u8len(buf, &t.bones_offset_y);

    nw_frame_durations(buf, &t.frame_durations);
    nw_u32_vec(buf, &t.sprite_index);

    let groups = t.frame_groups_data.as_deref().unwrap_or(&[]);
    buf.push(groups.len() as u8);
    for g in groups {
        buf.push(g.r#type);
        buf.push(g.width);
        buf.push(g.height);
        buf.push(g.exact_size);
        buf.push(g.layers);
        buf.push(g.pattern_x);
        buf.push(g.pattern_y);
        buf.push(g.pattern_z);
        buf.push(g.frames);
        buf.push(g.animation_mode.unwrap_or(0));
        buf.extend_from_slice(&g.loop_count.unwrap_or(0).to_le_bytes());
        buf.push(g.start_frame.unwrap_or(0) as u8);
        nw_frame_durations(buf, g.frame_durations.as_deref().unwrap_or(&[]));
        nw_u32_vec(buf, &g.sprite_index);
    }
}

fn read_things(r: &mut Reader, category: &str) -> Result<Vec<ThingType>, String> {
    let n = r.u32()? as usize;
    r.need(n)?;
    let mut v = Vec::with_capacity(n);
    for _ in 0..n {
        v.push(read_thing(r, category)?);
    }
    Ok(v)
}

pub fn write_dat_from_buffer(buffer: &[u8]) -> Result<(), String> {
    let mut r = Reader::new(buffer);

    let signature = r.u32()?;
    let version = r.u32()?;
    let extended = r.bool()?;
    let frame_durations = r.bool()?;
    let items_min_id = r.u16()?;
    let items_max_id = r.u16()?;
    let outfits_min_id = r.u16()?;
    let outfits_max_id = r.u16()?;
    let effects_min_id = r.u16()?;
    let effects_max_id = r.u16()?;
    let missiles_min_id = r.u16()?;
    let missiles_max_id = r.u16()?;
    let path = r.string()?;

    let items = read_things(&mut r, "item")?;
    let outfits = read_things(&mut r, "outfit")?;
    let effects = read_things(&mut r, "effect")?;
    let missiles = read_things(&mut r, "missile")?;

    write_dat_file(
        &path,
        signature,
        version,
        extended,
        frame_durations,
        items_min_id,
        items_max_id,
        outfits_min_id,
        outfits_max_id,
        effects_min_id,
        effects_max_id,
        missiles_min_id,
        missiles_max_id,
        items,
        outfits,
        effects,
        missiles,
    )
}
