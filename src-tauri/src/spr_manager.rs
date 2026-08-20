use std::collections::HashMap;
use std::fs::File;
use std::io::{Read, Seek, SeekFrom, BufReader};
use std::sync::{Arc, Mutex};
use serde::Serialize;
use rayon::prelude::*;

const SPRITE_SIZE: usize = 32;
const SPRITE_PIXELS: usize = SPRITE_SIZE * SPRITE_SIZE;
const SPRITE_DATA_SIZE: usize = SPRITE_PIXELS * 4;

#[derive(Debug, Clone, Serialize)]
pub struct SprHeader {
    pub signature: u32,
    pub sprite_count: u32,
    pub extended: bool,
    pub skip_colorkey: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct SpriteData {
    pub id: u32,
    pub is_empty: bool,
    #[serde(with = "serde_bytes")]
    pub compressed_pixels: Vec<u8>,
}

pub struct SprFileReader {
    file: BufReader<File>,
    header: SprHeader,
    header_size: u64,
    sprite_prefix_size: u64,
}

impl SprFileReader {
    pub fn open(path: &str, extended: bool) -> Result<Self, String> {
        let file = File::open(path)
            .map_err(|e| format!("Failed to open SPR file: {}", e))?;

        let mut reader = BufReader::new(file);

        let mut sig_buf = [0u8; 4];
        reader.read_exact(&mut sig_buf)
            .map_err(|e| format!("Failed to read signature: {}", e))?;
        let signature = u32::from_le_bytes(sig_buf);

        let sprite_count = if extended {
            let mut count_buf = [0u8; 4];
            reader.read_exact(&mut count_buf)
                .map_err(|e| format!("Failed to read sprite count: {}", e))?;
            u32::from_le_bytes(count_buf)
        } else {
            let mut count_buf = [0u8; 2];
            reader.read_exact(&mut count_buf)
                .map_err(|e| format!("Failed to read sprite count: {}", e))?;
            u16::from_le_bytes(count_buf) as u32
        };

        let header_size = if extended { 8 } else { 6 };

        let skip_colorkey = detect_skip_colorkey(&mut reader, header_size, sprite_count);
        let sprite_prefix_size: u64 = if skip_colorkey { 3 } else { 0 };

        let header = SprHeader {
            signature,
            sprite_count,
            extended,
            skip_colorkey,
        };

        Ok(Self {
            file: reader,
            header,
            header_size,
            sprite_prefix_size,
        })
    }

    pub fn read_sprite(&mut self, id: u32) -> Result<SpriteData, String> {
        if id == 0 || id > self.header.sprite_count {
            return Err(format!(
                "Invalid sprite ID: {} (valid range: 1-{})",
                id, self.header.sprite_count
            ));
        }

        let address_pos = self.header_size + ((id - 1) * 4) as u64;

        self.file.seek(SeekFrom::Start(address_pos))
            .map_err(|e| format!("Failed to seek to address: {}", e))?;

        let mut addr_buf = [0u8; 4];
        self.file.read_exact(&mut addr_buf)
            .map_err(|e| format!("Failed to read sprite address: {}", e))?;
        let address = u32::from_le_bytes(addr_buf);

        if address == 0 {
            return Ok(SpriteData {
                id,
                is_empty: true,
                compressed_pixels: Vec::new(),
            });
        }

        let data_start = address as u64 + self.sprite_prefix_size;
        self.file.seek(SeekFrom::Start(data_start))
            .map_err(|e| format!("Failed to seek to sprite data: {}", e))?;

        let mut len_buf = [0u8; 2];
        self.file.read_exact(&mut len_buf)
            .map_err(|e| format!("Failed to read data length: {}", e))?;
        let length = u16::from_le_bytes(len_buf);

        if length == 0 {
            return Ok(SpriteData {
                id,
                is_empty: true,
                compressed_pixels: Vec::new(),
            });
        }

        let mut compressed_pixels = vec![0u8; length as usize];
        self.file.read_exact(&mut compressed_pixels)
            .map_err(|e| format!("Failed to read sprite data: {}", e))?;

        Ok(SpriteData {
            id,
            is_empty: false,
            compressed_pixels,
        })
    }

    pub fn get_header(&self) -> &SprHeader {
        &self.header
    }
}

fn detect_skip_colorkey(reader: &mut BufReader<File>, header_size: u64, sprite_count: u32) -> bool {
    if sprite_count < 2 {
        return true;
    }

    if reader.seek(SeekFrom::Start(header_size)).is_err() {
        return true;
    }

    let table_size = (sprite_count as usize) * 4;
    let mut table = vec![0u8; table_size];
    if reader.read_exact(&mut table).is_err() {
        return true;
    }

    let mut addrs: Vec<u64> = (0..sprite_count as usize)
        .map(|i| u32::from_le_bytes([
            table[i * 4],
            table[i * 4 + 1],
            table[i * 4 + 2],
            table[i * 4 + 3],
        ]) as u64)
        .filter(|&a| a != 0)
        .collect();
    addrs.sort_unstable();

    let mut votes_std = 0i32;
    let mut votes_no = 0i32;

    for pair in addrs.windows(2).take(16) {
        let (a, b) = (pair[0], pair[1]);
        if b <= a + 5 {
            continue;
        }
        if reader.seek(SeekFrom::Start(a)).is_err() {
            continue;
        }
        let mut buf = [0u8; 5];
        if reader.read_exact(&mut buf).is_err() {
            continue;
        }
        let len_no = u16::from_le_bytes([buf[0], buf[1]]) as u64;
        let len_std = u16::from_le_bytes([buf[3], buf[4]]) as u64;
        let match_no = len_no > 0 && a + 2 + len_no == b;
        let match_std = len_std > 0 && a + 5 + len_std == b;
        match (match_no, match_std) {
            (true, false) => votes_no += 1,
            (false, true) => votes_std += 1,
            _ => {}
        }
    }

    votes_no <= votes_std
}

pub struct SprManager {
    readers: HashMap<String, SprFileReader>,
    overrides: HashMap<String, HashMap<u32, SpriteData>>,
}

impl SprManager {
    pub fn new() -> Self {
        Self {
            readers: HashMap::new(),
            overrides: HashMap::new(),
        }
    }

    pub fn open_file(&mut self, path: String, extended: bool) -> Result<SprHeader, String> {
        let reader = SprFileReader::open(&path, extended)?;
        let header = reader.get_header().clone();
        self.readers.insert(path.clone(), reader);
        self.overrides.entry(path).or_insert_with(HashMap::new);
        Ok(header)
    }

    pub fn close_file(&mut self, path: &str) -> Result<(), String> {
        self.readers.remove(path);
        Ok(())
    }

    pub fn read_sprites_batch(&mut self, path: &str, start_id: u32, count: u32) -> Result<Vec<SpriteData>, String> {
        let ids: Vec<u32> = (start_id..=(start_id + count - 1)).collect();
        self.read_sprites_list(path, ids)
    }

    pub fn read_sprites_list(&mut self, path: &str, ids: Vec<u32>) -> Result<Vec<SpriteData>, String> {
        if ids.is_empty() {
            return Ok(Vec::new());
        }

        let mut sorted_ids = ids.clone();
        sorted_ids.sort_unstable();
        sorted_ids.dedup();

        let reader = self.readers.get_mut(path)
            .ok_or_else(|| format!("SPR file not open: {}", path))?;
        let max_id = reader.get_header().sprite_count;

        let mut file_ids = Vec::new();
        let mut result_sprites = Vec::new();

        let path_overrides = self.overrides.get(path);

        for id in sorted_ids {
            if let Some(overrides) = path_overrides {
                if let Some(sprite) = overrides.get(&id) {
                    result_sprites.push(sprite.clone());
                    continue;
                }
            }

            if id > 0 && id <= max_id {
                file_ids.push(id);
            }
        }

        if file_ids.is_empty() {
             return Ok(result_sprites);
        }

        let reader = self.readers.get_mut(path).unwrap();

        let mut sprites = Vec::with_capacity(file_ids.len());

        let mut chunks: Vec<Vec<u32>> = Vec::new();
        let mut current_chunk: Vec<u32> = Vec::new();

        for &id in &file_ids {
            if current_chunk.is_empty() {
                current_chunk.push(id);
            } else {
                let last_id = *current_chunk.last().unwrap();
                if id - last_id < 100 {
                    current_chunk.push(id);
                } else {
                    chunks.push(current_chunk);
                    current_chunk = vec![id];
                }
            }
        }
        if !current_chunk.is_empty() {
            chunks.push(current_chunk);
        }

        for chunk in chunks {
            if chunk.is_empty() { continue; }

            let start_id = chunk[0];
            let end_id = *chunk.last().unwrap();
            let count = end_id - start_id + 1;

            let start_offset = reader.header_size + ((start_id - 1) as u64 * 4);

            reader.file.seek(SeekFrom::Start(start_offset))
                .map_err(|e| format!("Failed to seek to address table: {}", e))?;

            let mut addresses_buf = vec![0u8; (count * 4) as usize];
            reader.file.read_exact(&mut addresses_buf)
                .map_err(|e| format!("Failed to read address table: {}", e))?;

            let mut valid_sprites = Vec::with_capacity(chunk.len());

            for &id in &chunk {
                let offset_idx = (id - start_id) as usize;
                let offset = offset_idx * 4;

                let address = u32::from_le_bytes([
                    addresses_buf[offset],
                    addresses_buf[offset + 1],
                    addresses_buf[offset + 2],
                    addresses_buf[offset + 3],
                ]);

                if address != 0 {
                    valid_sprites.push((id, address as u64));
                } else {
                    sprites.push(SpriteData {
                        id,
                        is_empty: true,
                        compressed_pixels: Vec::new(),
                    });
                }
            }

            if valid_sprites.is_empty() {
                continue;
            }

            valid_sprites.sort_by_key(|k| k.1);

            let min_pos = valid_sprites.first().unwrap().1;
            let max_pos = valid_sprites.last().unwrap().1;

            let span_size = (max_pos + 8192) - min_pos;

            let estimated_data_size = valid_sprites.len() as u64 * 500;

            if span_size < 5 * 1024 * 1024 && (estimated_data_size * 5 > span_size || valid_sprites.len() > 50) {
                reader.file.seek(SeekFrom::Start(min_pos))
                    .map_err(|e| format!("Failed to seek to data block: {}", e))?;

                let mut file_buf = vec![0u8; span_size as usize];
                let bytes_read = reader.file.read(&mut file_buf)
                    .map_err(|e| format!("Failed to read data block: {}", e))?;

                let prefix = reader.sprite_prefix_size as usize;

                for (id, pos) in valid_sprites {
                    let local_offset = (pos - min_pos) as usize;

                    if local_offset + prefix + 2 > bytes_read { continue; }

                    let len_offset = local_offset + prefix;
                    let length = u16::from_le_bytes([
                        file_buf[len_offset],
                        file_buf[len_offset + 1]
                    ]);

                    if length == 0 {
                        sprites.push(SpriteData { id, is_empty: true, compressed_pixels: Vec::new() });
                        continue;
                    }

                    let data_offset = len_offset + 2;
                    let data_end = data_offset + length as usize;

                    if data_end <= bytes_read {
                        sprites.push(SpriteData {
                            id,
                            is_empty: false,
                            compressed_pixels: file_buf[data_offset..data_end].to_vec(),
                        });
                    }
                }
            } else {
                let mut current_pos = reader.file.stream_position()
                    .map_err(|e| format!("Failed to get stream pos: {}", e))?;

                for (id, pos) in valid_sprites {
                    let target_pos = pos + reader.sprite_prefix_size;

                    if current_pos != target_pos {
                        reader.file.seek(SeekFrom::Start(target_pos))
                            .map_err(|e| format!("Failed to seek: {}", e))?;
                        current_pos = target_pos;
                    }

                    let mut len_buf = [0u8; 2];
                    reader.file.read_exact(&mut len_buf)
                        .map_err(|e| format!("Failed to read length: {}", e))?;
                    current_pos += 2;

                    let length = u16::from_le_bytes(len_buf);

                    if length == 0 {
                        sprites.push(SpriteData { id, is_empty: true, compressed_pixels: Vec::new() });
                        continue;
                    }

                    let mut pixels = vec![0u8; length as usize];
                    reader.file.read_exact(&mut pixels)
                        .map_err(|e| format!("Failed to read pixels: {}", e))?;
                    current_pos += length as u64;

                    sprites.push(SpriteData {
                        id,
                        is_empty: false,
                        compressed_pixels: pixels,
                    });
                }
            }
        }

        result_sprites.extend(sprites);
        Ok(result_sprites)
    }

    pub fn update_sprite(&mut self, path: &str, id: u32, sprite: SpriteData) -> Result<(), String> {
        if id == 0 { return Err("Invalid sprite ID 0".to_string()); }

        self.overrides.entry(path.to_string())
            .or_insert_with(HashMap::new)
            .insert(id, sprite);
        Ok(())
    }

    pub fn read_sprites_rgba(&mut self, path: &str, ids: Vec<u32>, transparent: bool) -> Result<Vec<u8>, String> {
        let sprites = self.read_sprites_list(path, ids)?;
        Ok(Self::pack_sprites_rgba(sprites, transparent))
    }

    pub fn read_sprites_batch_rgba(&mut self, path: &str, start_id: u32, count: u32, transparent: bool) -> Result<Vec<u8>, String> {
        let sprites = self.read_sprites_batch(path, start_id, count)?;
        Ok(Self::pack_sprites_rgba(sprites, transparent))
    }

    pub fn read_sprites_rgba_lz4(&mut self, path: &str, ids: Vec<u32>, transparent: bool) -> Result<Vec<u8>, String> {
        let sprites = self.read_sprites_list(path, ids)?;
        Ok(Self::pack_sprites_rgba_lz4(sprites, transparent))
    }

    pub fn compose_atlas_png(
        &mut self,
        path: &str,
        start_id: u32,
        count: u32,
        cols: u32,
        transparent: bool,
    ) -> Result<Vec<u8>, String> {
        use std::io::Cursor;

        let cols = cols.max(1);
        let rows = (count + cols - 1) / cols;
        let atlas_w = cols * SPRITE_SIZE as u32;
        let atlas_h = rows.max(1) * SPRITE_SIZE as u32;

        let sprites = self.read_sprites_batch(path, start_id, count)?;

        let row_bytes = SPRITE_SIZE * 4;
        let mut atlas = vec![0u8; (atlas_w * atlas_h * 4) as usize];

        for sprite in sprites {
            if sprite.is_empty || sprite.id < start_id {
                continue;
            }
            let idx = sprite.id - start_id;
            if idx >= count {
                continue;
            }
            let dst_x = (idx % cols) * SPRITE_SIZE as u32;
            let dst_y = (idx / cols) * SPRITE_SIZE as u32;
            let rgba = decompress_to_rgba(&sprite.compressed_pixels, transparent);

            for y in 0..SPRITE_SIZE as u32 {
                let src_off = (y as usize) * row_bytes;
                let dst_off = (((dst_y + y) * atlas_w + dst_x) as usize) * 4;
                atlas[dst_off..dst_off + row_bytes].copy_from_slice(&rgba[src_off..src_off + row_bytes]);
            }
        }

        let img = image::RgbaImage::from_raw(atlas_w, atlas_h, atlas)
            .ok_or_else(|| "Failed to build atlas image".to_string())?;
        let mut out = Cursor::new(Vec::new());
        image::DynamicImage::ImageRgba8(img)
            .write_to(&mut out, image::ImageOutputFormat::Png)
            .map_err(|e| format!("PNG encode failed: {}", e))?;
        Ok(out.into_inner())
    }

    pub fn pack_sprites_rgba_lz4(sprites: Vec<SpriteData>, transparent: bool) -> Vec<u8> {
        let uncompressed = Self::pack_sprites_rgba(sprites, transparent);

        use lz4_flex::frame::FrameEncoder;
        use std::io::Write;

        let mut encoder = FrameEncoder::new(Vec::new());
        encoder.write_all(&uncompressed).expect("LZ4 encoding failed");
        encoder.finish().expect("LZ4 finish failed")
    }

    fn pack_sprites_rgba(sprites: Vec<SpriteData>, transparent: bool) -> Vec<u8> {
        let decompressed: Vec<(SpriteData, Vec<u8>)> = sprites
            .into_par_iter()
            .map(|sprite| {
                let rgba = decompress_to_rgba(&sprite.compressed_pixels, transparent);
                (sprite, rgba)
            })
            .collect();

        let header_bytes = 4;
        let total_compressed: usize = decompressed.iter()
            .map(|(s, _)| s.compressed_pixels.len())
            .sum();
        let total_size = header_bytes
            + decompressed.len() * (4 + 1 + 4 + SPRITE_DATA_SIZE)
            + total_compressed;

        let mut buffer = Vec::with_capacity(total_size);

        buffer.extend_from_slice(&(decompressed.len() as u32).to_le_bytes());

        for (sprite, rgba) in decompressed {
            buffer.extend_from_slice(&sprite.id.to_le_bytes());
            buffer.push(if sprite.is_empty { 1 } else { 0 });
            buffer.extend_from_slice(&(sprite.compressed_pixels.len() as u32).to_le_bytes());
            buffer.extend_from_slice(&sprite.compressed_pixels);
            buffer.extend_from_slice(&rgba);
        }
        buffer
    }
}

pub fn decompress_to_rgba(compressed: &[u8], transparent: bool) -> Vec<u8> {
    let mut pixels = vec![0u8; SPRITE_DATA_SIZE];
    let mut write_pos = 0;
    let mut read_pos = 0;
    let channels = if transparent { 4 } else { 3 };

    while read_pos + 4 <= compressed.len() && write_pos < SPRITE_DATA_SIZE {
        let transparent_count = u16::from_le_bytes([
            compressed[read_pos],
            compressed[read_pos + 1]
        ]) as usize;
        read_pos += 2;

        let colored_count = u16::from_le_bytes([
            compressed[read_pos],
            compressed[read_pos + 1]
        ]) as usize;
        read_pos += 2;

        let mut current_channels = channels;
        let bytes_needed = colored_count * current_channels;

        if read_pos + bytes_needed > compressed.len() {
            if transparent && read_pos + colored_count * 3 <= compressed.len() {
                current_channels = 3;
            } else {
                break;
            }
        }

        for _ in 0..transparent_count {
            if write_pos >= SPRITE_DATA_SIZE {
                break;
            }
            pixels[write_pos] = 0;
            pixels[write_pos + 1] = 0;
            pixels[write_pos + 2] = 0;
            pixels[write_pos + 3] = 0;
            write_pos += 4;
        }

        for _ in 0..colored_count {
            if write_pos >= SPRITE_DATA_SIZE {
                break;
            }

            let red = compressed[read_pos];
            let green = compressed[read_pos + 1];
            let blue = compressed[read_pos + 2];
            read_pos += 3;

            let alpha = if current_channels == 4 {
                let a = compressed[read_pos];
                read_pos += 1;
                a
            } else {
                0xFF
            };

            pixels[write_pos] = red;
            pixels[write_pos + 1] = green;
            pixels[write_pos + 2] = blue;
            pixels[write_pos + 3] = alpha;
            write_pos += 4;
        }
    }

    pixels
}

pub fn compress_to_rle(pixels: &[u8], transparent: bool) -> Vec<u8> {
    if pixels.len() != SPRITE_DATA_SIZE {
        return Vec::new();
    }

    let mut compressed = Vec::new();
    let mut index = 0;
    let pixel_count = SPRITE_DATA_SIZE / 4;

    while index < pixel_count {
        let mut transparent_count = 0u16;
        while index < pixel_count {
            let offset = index * 4;
            let r = pixels[offset];
            let g = pixels[offset + 1];
            let b = pixels[offset + 2];
            let a = pixels[offset + 3];

            let is_transparent = r == 0 && g == 0 && b == 0 && a == 0;
            if !is_transparent {
                break;
            }

            transparent_count += 1;
            index += 1;
        }

        compressed.extend_from_slice(&transparent_count.to_le_bytes());

        let colored_count_pos = compressed.len();
        compressed.push(0);
        compressed.push(0);

        let mut colored_count = 0u16;
        while index < pixel_count {
            let offset = index * 4;
            let r = pixels[offset];
            let g = pixels[offset + 1];
            let b = pixels[offset + 2];
            let a = pixels[offset + 3];

            let is_transparent = r == 0 && g == 0 && b == 0 && a == 0;
            if is_transparent {
                break;
            }

            compressed.push(r);
            compressed.push(g);
            compressed.push(b);
            if transparent {
                compressed.push(a);
            }

            colored_count += 1;
            index += 1;
        }

        let count_bytes = colored_count.to_le_bytes();
        compressed[colored_count_pos] = count_bytes[0];
        compressed[colored_count_pos + 1] = count_bytes[1];
    }

    compressed
}

pub type SprManagerState = Arc<Mutex<SprManager>>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rle_roundtrip_preserves_alpha_when_transparent() {
        let mut px = vec![0u8; SPRITE_DATA_SIZE];
        px[0..4].copy_from_slice(&[10, 20, 30, 128]);
        px[4..8].copy_from_slice(&[200, 50, 50, 1]);
        px[8..12].copy_from_slice(&[70, 80, 90, 255]);

        let back = decompress_to_rgba(&compress_to_rle(&px, true), true);
        assert_eq!(back, px);
    }
}
