#[cfg(feature = "tibia")]
pub mod tibia;

use std::sync::{Arc, Mutex};
use crate::dat_writer::ThingType;

pub struct FormatInfo {
    pub name: &'static str,
    pub sprite_size: u32,
}

pub struct SpriteHeader {
    pub sprite_count: u32,
    pub signature: u32,
    pub extended: bool,
}

pub struct MetadataSet {
    pub signature: u32,
    pub items: Vec<ThingType>,
    pub outfits: Vec<ThingType>,
    pub effects: Vec<ThingType>,
    pub missiles: Vec<ThingType>,
}

pub struct WriteMetadataRequest {
    pub buffer: Vec<u8>,
}

pub trait SpriteProvider: Send + Sync {
    fn format_info(&self) -> FormatInfo;
    fn open(&mut self, path: &str, extended: bool) -> Result<SpriteHeader, String>;
    fn close(&mut self, path: &str) -> Result<(), String>;
    fn sprite_count(&self, path: &str) -> Result<u32, String>;
    fn read_sprites_rgba(&mut self, path: &str, ids: &[u32], transparent: bool) -> Result<Vec<u8>, String>;
    fn compose_atlas_png(&mut self, path: &str, start: u32, count: u32, cols: u32, transparent: bool) -> Result<Vec<u8>, String>;
}

pub trait MetadataProvider: Send + Sync {
    fn read_metadata(&mut self, path: &str, version: u32) -> Result<MetadataSet, String>;
    fn store_data(&mut self, path: String, data: MetadataSet) -> Result<(), String>;
    fn remove_data(&mut self, path: &str);
}

pub struct FormatManager {
    sprite_provider: Box<dyn SpriteProvider>,
    metadata_provider: Box<dyn MetadataProvider>,
}

impl FormatManager {
    pub fn new(
        sprite: Box<dyn SpriteProvider>,
        metadata: Box<dyn MetadataProvider>,
    ) -> Self {
        Self {
            sprite_provider: sprite,
            metadata_provider: metadata,
        }
    }

    pub fn sprite(&mut self) -> &mut dyn SpriteProvider {
        &mut *self.sprite_provider
    }

    pub fn metadata(&mut self) -> &mut dyn MetadataProvider {
        &mut *self.metadata_provider
    }

    pub fn format_info(&self) -> FormatInfo {
        self.sprite_provider.format_info()
    }
}

pub type FormatManagerState = Arc<Mutex<FormatManager>>;
