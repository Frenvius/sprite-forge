use std::collections::{BTreeMap, HashMap, HashSet};
use sha1::{Sha1, Digest};
use crate::spr_manager::{SprManagerState, SprFileReader};
use crate::spr_writer::SpriteWrite;

#[tauri::command]
pub async fn optimize_sprites_rust(
    app: tauri::AppHandle,
    request: tauri::ipc::Request<'_>,
    _spr_state: tauri::State<'_, SprManagerState>,
) -> Result<tauri::ipc::Response, String> {
    let bytes = match request.body() {
        tauri::ipc::InvokeBody::Raw(b) => b.as_slice(),
        _ => return Err("optimize_sprites_rust expects a raw binary payload".to_string()),
    };
    if bytes.len() < 3 {
        return Err("optimize_sprites_rust payload too small".to_string());
    }
    let extended = bytes[0] != 0;
    let path_len = u16::from_le_bytes([bytes[1], bytes[2]]) as usize;
    if bytes.len() < 3 + path_len {
        return Err("optimize_sprites_rust payload truncated at path".to_string());
    }
    let path = String::from_utf8_lossy(&bytes[3..3 + path_len]).into_owned();
    let used_ids_blob: Vec<u8> = bytes[3 + path_len..].to_vec();

    let path_clone = path.clone();
    let used_ids_blob_clone = used_ids_blob.clone();
    
    let app_handle = app.clone();
    
    let (remap_blob, removed_blob, reason_counts, removed_count, old_total, new_total, temp_path) = tauri::async_runtime::spawn_blocking(move || {
        use tauri::Emitter;
        
        let mut reader = SprFileReader::open(&path_clone, extended)
            .map_err(|e| format!("Failed to open SPR file: {}", e))?;
            
        let header = reader.get_header();
        let old_total = header.sprite_count;
        let signature = header.signature;
        
        let used_set: HashSet<u32> = used_ids_blob_clone
            .chunks_exact(4)
            .map(|chunk| u32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]))
            .filter(|&id| id != 0 && id <= old_total)
            .collect();

        let mut hashes: HashMap<[u8; 20], u32> = HashMap::new();
        let mut remap: HashMap<u32, u32> = HashMap::new();
        let mut unique_sprites: HashMap<u32, Vec<u8>> = HashMap::new();
        let mut empty_ids: HashSet<u32> = HashSet::new();

        for id in 1..=old_total {
            if id % 1000 == 0 {
                let _ = app_handle.emit("optimizer-progress", format!("Hashing sprites: {}/{}", id, old_total));
            }

            let sprite = reader.read_sprite(id)
                .map_err(|e| format!("Failed to read sprite {}: {}", id, e))?;

            if sprite.is_empty {
                empty_ids.insert(id);
                continue;
            }

            let mut hasher = Sha1::new();
            hasher.update(&sprite.compressed_pixels);
            let digest: [u8; 20] = hasher.finalize().into();

            if let Some(&canonical_id) = hashes.get(&digest) {
                remap.insert(id, canonical_id);
            } else {
                hashes.insert(digest, id);
                remap.insert(id, id);
                unique_sprites.insert(id, sprite.compressed_pixels);
            }
        }
        
        let _ = app_handle.emit("optimizer-progress", "Filtering unused sprites...");

        let mut final_remap: BTreeMap<u32, u32> = BTreeMap::new();
        let mut new_sprites: Vec<(u32, Vec<u8>)> = Vec::new();
        let mut new_id_counter = 1;

        let mut used_canonical_ids: HashSet<u32> = HashSet::new();
        for old_id in &used_set {
            if empty_ids.contains(old_id) {
                final_remap.insert(*old_id, 0);
                continue;
            }
            if let Some(&canonical) = remap.get(old_id) {
                used_canonical_ids.insert(canonical);
            }
        }

        let mut canonical_to_new: HashMap<u32, u32> = HashMap::new();

        for id in 1..=old_total {
            if unique_sprites.contains_key(&id) && used_canonical_ids.contains(&id) {
                let new_id = new_id_counter;
                new_id_counter += 1;

                canonical_to_new.insert(id, new_id);

                if let Some(pixels) = unique_sprites.get(&id) {
                    new_sprites.push((new_id, pixels.clone()));
                }
            }
        }

        for id in 1..=old_total {
            if let Some(&canonical) = remap.get(&id) {
                if let Some(&new_id) = canonical_to_new.get(&canonical) {
                    final_remap.insert(id, new_id);
                }
            }
        }
        
        let mut removed_blob: Vec<u8> = Vec::new();
        let mut empty_count: u32 = 0;
        let mut duplicate_count: u32 = 0;
        let mut unused_count: u32 = 0;

        for id in 1..=old_total {
            let (canonical, reason) = if empty_ids.contains(&id) {
                empty_count += 1;
                (0u32, 0u8)
            } else {
                match remap.get(&id) {
                    Some(&canon) if canon != id => {
                        duplicate_count += 1;
                        (canon, 1u8)
                    }
                    Some(&canon) if !canonical_to_new.contains_key(&canon) => {
                        unused_count += 1;
                        (0u32, 2u8)
                    }
                    _ => continue,
                }
            };

            removed_blob.extend_from_slice(&id.to_le_bytes());
            removed_blob.extend_from_slice(&canonical.to_le_bytes());
            removed_blob.push(reason);
        }

        let _ = app_handle.emit("optimizer-progress", "Writing optimized file...");

        let temp_file = tempfile::Builder::new()
            .prefix("tibia_opt_")
            .suffix(".spr")
            .tempfile()
            .map_err(|e| format!("Failed to create temp file: {}", e))?;

        let sprites_to_write: Vec<SpriteWrite> = new_sprites.into_iter().map(|(id, pixels)| {
            SpriteWrite {
                id,
                is_empty: pixels.is_empty(),
                compressed_pixels: pixels,
            }
        }).collect();

        let (_, path_buf) = temp_file.keep().map_err(|e| format!("Failed to persist temp file: {}", e))?;
        let persisted_path = path_buf.to_string_lossy().to_string();

        crate::spr_writer::write_spr_file(&persisted_path, signature, extended, sprites_to_write)
            .map_err(|e| format!("Failed to write temp file: {}", e))?;

        let mut remap_blob = Vec::with_capacity(final_remap.len() * 8);
        for (old, new) in final_remap {
            remap_blob.extend_from_slice(&old.to_le_bytes());
            remap_blob.extend_from_slice(&new.to_le_bytes());
        }

        Ok::<(Vec<u8>, Vec<u8>, (u32, u32, u32), u32, u32, u32, String), String>((
            remap_blob,
            removed_blob,
            (duplicate_count, unused_count, empty_count),
            old_total - (new_id_counter - 1),
            old_total,
            new_id_counter - 1,
            persisted_path
        ))
    }).await.map_err(|e| format!("Task join error: {}", e))??;

    let (duplicate_count, unused_count, empty_count) = reason_counts;
    let path_bytes = temp_path.as_bytes();
    let mut response =
        Vec::with_capacity(6 * 4 + 2 + path_bytes.len() + 4 + remap_blob.len() + removed_blob.len());
    response.extend_from_slice(&old_total.to_le_bytes());
    response.extend_from_slice(&new_total.to_le_bytes());
    response.extend_from_slice(&removed_count.to_le_bytes());
    response.extend_from_slice(&duplicate_count.to_le_bytes());
    response.extend_from_slice(&unused_count.to_le_bytes());
    response.extend_from_slice(&empty_count.to_le_bytes());
    response.extend_from_slice(&(path_bytes.len() as u16).to_le_bytes());
    response.extend_from_slice(path_bytes);
    response.extend_from_slice(&(remap_blob.len() as u32).to_le_bytes());
    response.extend_from_slice(&remap_blob);
    response.extend_from_slice(&removed_blob);

    Ok(tauri::ipc::Response::new(response))
}

#[tauri::command]
pub fn apply_optimization(
    temp_path: String,
    original_path: String,
    spr_state: tauri::State<SprManagerState>,
) -> Result<(), String> {
    if temp_path == original_path {
        return Err("apply_optimization called with identical temp and original paths".to_string());
    }

    let mut manager = spr_state.lock().map_err(|e| format!("Lock error: {}", e))?;

    manager.close_file(&original_path).ok();
    manager.close_file(&temp_path).ok();

    let staging_path = format!("{}.new", original_path);
    let _ = std::fs::remove_file(&staging_path);

    std::fs::copy(&temp_path, &staging_path)
        .map_err(|e| format!("Failed to stage optimized file: {}", e))?;

    if let Err(e) = std::fs::rename(&staging_path, &original_path) {
        let _ = std::fs::remove_file(&staging_path);
        return Err(format!("Failed to replace original file: {}", e));
    }

    let _ = std::fs::remove_file(&temp_path);

    Ok(())
}
