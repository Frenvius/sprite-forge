use crate::spr_manager::SprManager;
use crate::dat_reader::DatReader;
use crate::dat_manager::DatManager;
use super::{
    FormatInfo, MetadataProvider, MetadataSet, SpriteHeader, SpriteProvider,
};

pub struct TibiaSpriteProvider {
    manager: SprManager,
}

impl TibiaSpriteProvider {
    pub fn new() -> Self {
        Self {
            manager: SprManager::new(),
        }
    }
}

impl SpriteProvider for TibiaSpriteProvider {
    fn format_info(&self) -> FormatInfo {
        FormatInfo {
            name: "Tibia",
            sprite_size: 32,
        }
    }

    fn open(&mut self, path: &str, extended: bool) -> Result<SpriteHeader, String> {
        let header = self.manager.open_file(path.to_string(), extended)?;
        Ok(SpriteHeader {
            sprite_count: header.sprite_count,
            signature: header.signature,
            extended: header.extended,
        })
    }

    fn close(&mut self, path: &str) -> Result<(), String> {
        self.manager.close_file(path)
    }

    fn sprite_count(&self, _path: &str) -> Result<u32, String> {
        Err("Use open() to get sprite count from header".to_string())
    }

    fn read_sprites_rgba(
        &mut self,
        path: &str,
        ids: &[u32],
        transparent: bool,
    ) -> Result<Vec<u8>, String> {
        self.manager
            .read_sprites_rgba(path, ids.to_vec(), transparent)
    }

    fn compose_atlas_png(
        &mut self,
        path: &str,
        start: u32,
        count: u32,
        cols: u32,
        transparent: bool,
    ) -> Result<Vec<u8>, String> {
        self.manager
            .compose_atlas_png(path, start, count, cols, transparent)
    }
}

pub struct TibiaMetadataProvider {
    manager: DatManager,
}

impl TibiaMetadataProvider {
    pub fn new() -> Self {
        Self {
            manager: DatManager::new(),
        }
    }
}

impl MetadataProvider for TibiaMetadataProvider {
    fn read_metadata(&mut self, path: &str, version: u32) -> Result<MetadataSet, String> {
        let mut reader = DatReader::open(path)?;
        reader.set_version(version);
        let (signature, items, outfits, effects, missiles) = reader
            .read_dat()
            .map_err(|e| format!("DAT parse error (version {}): {}", version, e))?;
        Ok(MetadataSet {
            signature,
            items,
            outfits,
            effects,
            missiles,
        })
    }

    fn store_data(&mut self, path: String, data: MetadataSet) -> Result<(), String> {
        self.manager.store_data(
            path,
            data.items,
            data.outfits,
            data.effects,
            data.missiles,
        )
    }

    fn remove_data(&mut self, path: &str) {
        self.manager.remove_data(path);
    }
}
