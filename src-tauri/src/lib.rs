use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use serde::{Serialize, Deserialize};
use image::{RgbaImage, imageops, GenericImageView};

mod spr_manager;
use spr_manager::{SprManager, SprManagerState, SprHeader, SpriteData, compress_to_rle, decompress_to_rgba};

mod logger;

pub mod dat_writer;
use dat_writer::{write_dat_from_buffer, read_thing, Reader, ThingType, FrameGroup};

mod spr_writer;
use spr_writer::{update_sprites_in_spr, copy_spr_with_modifications, SpriteWrite};

mod dat_manager;
use dat_manager::{DatManager, DatManagerState};

pub mod dat_reader;
use dat_reader::{DatReader, encode_dat_to_binary};

mod optimizer;
use optimizer::{optimize_sprites_rust, apply_optimization};

mod sprite_protocol;

mod similarity;
use similarity::{SpriteSignature, signature_compressed};

mod formats;
use formats::FormatManagerState;

mod obd;
mod pack;

mod import_store;
use import_store::{thing_pixel_hash, ImportRecord, ImportSrc, ImportStore, ImportStoreState};

mod otb;
use otb::{read_otb_file, write_otb_file};

mod project;
use project::ProjectState;

mod lua_host;
use lua_host::{LuaHost, LuaState};
mod lua_bridge;
mod lua_ui;
mod lua_format;
use lua_format::{ForgeAssetsState, ForgeItemsState, ForgeThingsState};

#[derive(Serialize, Deserialize)]
struct FileBytes(#[serde(with = "serde_bytes")] Vec<u8>);

#[tauri::command]
#[allow(unused_variables)]
fn set_window_acrylic(
    window: tauri::Window,
    enabled: bool,
    color: Option<(u8, u8, u8, u8)>,
) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use window_vibrancy::{apply_acrylic, clear_acrylic};
        if enabled {
            let tint = color.unwrap_or((26, 26, 26, 180));
            apply_acrylic(&window, Some(tint)).map_err(|e| e.to_string())?;
        } else {
            clear_acrylic(&window).map_err(|e| e.to_string())?;
        }
        return Ok(());
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Acrylic is only supported on Windows".to_string())
    }
}

#[tauri::command]
fn read_file(path: String) -> Result<FileBytes, String> {
    fs::read(&path)
        .map(FileBytes)
        .map_err(|e| format!("Failed to read file {}: {}", path, e))
}

#[tauri::command]
fn read_file_text(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Failed to read file {}: {}", path, e))
}

#[tauri::command]
fn write_file_text(path: String, contents: String) -> Result<(), String> {
    fs::write(&path, contents).map_err(|e| format!("Failed to write file {}: {}", path, e))
}

#[tauri::command]
fn read_file_header(path: String, bytes: usize) -> Result<FileBytes, String> {
    use std::io::Read;
    let mut file = fs::File::open(&path)
        .map_err(|e| format!("Failed to open file {}: {}", path, e))?;

    let mut buffer = vec![0u8; bytes];
    file.read_exact(&mut buffer)
        .map_err(|e| format!("Failed to read {} bytes from {}: {}", bytes, path, e))?;

    Ok(FileBytes(buffer))
}

#[tauri::command]
fn open_spr_file(
    path: String,
    extended: bool,
    spr_state: tauri::State<SprManagerState>,
) -> Result<SprHeader, String> {
    let mut manager = spr_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let result = manager.open_file(path.clone(), extended);
    match &result {
        Ok(header) => logger::log("INFO", &format!("Opened SPR {} ({} sprites)", path, header.sprite_count)),
        Err(e) => logger::log("ERROR", &format!("Failed to open SPR {}: {}", path, e)),
    }
    result
}

#[tauri::command]
fn close_spr_file(
    path: String,
    state: tauri::State<SprManagerState>,
) -> Result<(), String> {
    let mut manager = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    manager.close_file(&path)
}

use tauri::ipc::Response;

#[tauri::command]
fn read_sprites_rgba(
    path: String,
    ids: Vec<u32>,
    transparent: bool,
    spr_state: tauri::State<SprManagerState>,
) -> Result<Response, String> {
    let mut manager = spr_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let bytes = manager.read_sprites_rgba(&path, ids, transparent)?;
    Ok(Response::new(bytes))
}

#[tauri::command]
fn read_sprites_batch_rgba(
    path: String,
    start_id: u32,
    count: u32,
    transparent: bool,
    spr_state: tauri::State<SprManagerState>,
) -> Result<Response, String> {
    let mut manager = spr_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let bytes = manager.read_sprites_batch_rgba(&path, start_id, count, transparent)?;
    Ok(Response::new(bytes))
}

#[tauri::command]
fn read_sprites_rgba_lz4(
    path: String,
    ids: Vec<u32>,
    transparent: bool,
    spr_state: tauri::State<SprManagerState>,
) -> Result<Response, String> {
    let mut manager = spr_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let bytes = manager.read_sprites_rgba_lz4(&path, ids, transparent)?;
    Ok(Response::new(bytes))
}

#[tauri::command]
fn compress_sprite_rgba(request: tauri::ipc::Request) -> Result<Response, String> {
    let bytes = match request.body() {
        tauri::ipc::InvokeBody::Raw(b) => b.as_slice(),
        _ => return Err("compress_sprite_rgba expects a raw binary payload".to_string()),
    };
    if bytes.len() != 4097 {
        return Err(format!("Invalid payload length: {} (expected 4097 = 1 flag + 4096 RGBA)", bytes.len()));
    }
    let transparent = bytes[0] != 0;
    let pixels = &bytes[1..];
    Ok(Response::new(compress_to_rle(pixels, transparent)))
}

#[derive(Serialize)]
struct DirEntry {
    name: String,
    path: String,
    is_dir: bool,
    modified_ms: Option<i64>,
    size: Option<u64>,
}

#[derive(Serialize)]
struct DriveInfo {
    letter: String,
    label: String,
}

#[tauri::command]
#[cfg(target_os = "windows")]
fn list_drives() -> Vec<DriveInfo> {
    let mut drives = Vec::new();
    for c in b'A'..=b'Z' {
        let letter = (c as char).to_string();
        let path_str = format!("{}:\\", letter);
        if Path::new(&path_str).is_dir() {
            drives.push(DriveInfo {
                label: format!("Disco Local ({}:)", letter),
                letter: path_str,
            });
        }
    }
    drives
}

#[tauri::command]
#[cfg(not(target_os = "windows"))]
fn list_drives() -> Vec<DriveInfo> {
    vec![DriveInfo {
        letter: "/".to_string(),
        label: "Root (/)".to_string(),
    }]
}

#[derive(Serialize)]
struct SystemDirectory {
    name: String,
    path: String,
}

#[tauri::command]
fn get_home_dir() -> Result<String, String> {
    dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "Home directory not found".to_string())
}

#[tauri::command]
fn get_system_directories() -> Result<Vec<SystemDirectory>, String> {
    let mut dirs = Vec::new();

    if let Some(home) = dirs::home_dir() {
        let home_str = home.to_string_lossy().to_string();
        dirs.push(SystemDirectory {
            name: "Home".to_string(),
            path: home_str.clone(),
        });

        if let Some(doc) = dirs::document_dir() {
            dirs.push(SystemDirectory {
                name: "Documents".to_string(),
                path: doc.to_string_lossy().to_string(),
            });
        }

        if let Some(download) = dirs::download_dir() {
            dirs.push(SystemDirectory {
                name: "Downloads".to_string(),
                path: download.to_string_lossy().to_string(),
            });
        }

        if let Some(desktop) = dirs::desktop_dir() {
            dirs.push(SystemDirectory {
                name: "Desktop".to_string(),
                path: desktop.to_string_lossy().to_string(),
            });
        }

    }

    Ok(dirs)
}

#[tauri::command]
fn list_directory(path: String) -> Result<Vec<DirEntry>, String> {
    let path = Path::new(&path);
    
    if !path.exists() {
        return Err(format!("Path does not exist: {}", path.display()));
    }
    
    if !path.is_dir() {
        return Err(format!("Path is not a directory: {}", path.display()));
    }
    
    let mut entries = Vec::new();
    
    match fs::read_dir(path) {
        Ok(reader) => {
            for entry_result in reader {
                match entry_result {
                    Ok(entry) => {
                        let entry_path = entry.path();
                        let name = entry_path
                            .file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or("")
                            .to_string();
                        
                        let full_path = entry_path.to_string_lossy().to_string();
                        let is_dir = entry_path.is_dir();
                        let meta = entry.metadata().ok();
                        let modified_ms = meta.as_ref().and_then(|m| m.modified().ok()).and_then(|t| {
                            t.duration_since(std::time::UNIX_EPOCH).ok().map(|d| d.as_millis() as i64)
                        });
                        let size = meta.as_ref().map(|m| m.len()).filter(|_| !is_dir);

                        entries.push(DirEntry {
                            name,
                            path: full_path,
                            is_dir,
                            modified_ms,
                            size,
                        });
                    }
                    Err(e) => {
                        return Err(format!("Failed to read directory entry: {}", e));
                    }
                }
            }
        }
        Err(e) => {
            return Err(format!("Failed to read directory: {}", e));
        }
    }
    
    entries.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.cmp(&b.name),
        }
    });
    
    Ok(entries)
}

#[tauri::command]
fn check_files_exist(path: String, filenames: Vec<String>) -> Result<Vec<bool>, String> {
    let dir_path = Path::new(&path);
    
    if !dir_path.exists() || !dir_path.is_dir() {
        return Err(format!("Path does not exist or is not a directory: {}", path));
    }
    
    let results: Vec<bool> = filenames
        .iter()
        .map(|filename| {
            let file_path = dir_path.join(filename);
            file_path.exists() && file_path.is_file()
        })
        .collect();
    
    Ok(results)
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct FavoriteFolder {
    name: String,
    path: String,
}

#[derive(Serialize, Deserialize, Debug, Default)]
struct AppConfig {
    last_folder: Option<String>,
    favorite_folders: Vec<FavoriteFolder>,
    panel_settings: Option<PanelSettings>,
    default_scene: Option<String>,
    item_list_view_mode: Option<String>,
    sprite_list_view_mode: Option<String>,
    find_list_view_mode: Option<String>,
    general_settings: Option<GeneralSettings>,
}

fn default_true() -> bool {
    true
}

fn default_zoom() -> u32 {
    2
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct GeneralSettings {
    list_amount_objects: u32,
    list_amount_sprites: u32,
    #[serde(default)]
    auto_play_animation: bool,
    #[serde(default = "default_true")]
    backup_on_save: bool,
    #[serde(default = "default_zoom")]
    default_zoom: u32,
    #[serde(default = "default_thumb_scale")]
    list_thumb_scale: f32,
}

fn default_thumb_scale() -> f32 {
    1.0
}

impl Default for GeneralSettings {
    fn default() -> Self {
        Self {
            list_amount_objects: 100,
            list_amount_sprites: 100,
            auto_play_animation: false,
            backup_on_save: true,
            default_zoom: 2,
            list_thumb_scale: 1.0,
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
struct PanelSettings {
    show_visualization: bool,
    show_opened_items: bool,
}

pub(crate) fn get_config_dir() -> Result<PathBuf, String> {
    dirs::config_dir()
        .ok_or_else(|| "Config directory not found".to_string())
        .map(|mut path| {
            path.push("sprite-forge");
            path
        })
}

#[tauri::command]
fn get_config_dir_path() -> Result<String, String> {
    get_config_dir().map(|p| p.to_string_lossy().to_string())
}

fn get_config_path() -> Result<PathBuf, String> {
    get_config_dir().map(|mut path| {
        path.push("config.json");
        path
    })
}

fn ensure_config_dir() -> Result<(), String> {
    let config_dir = get_config_dir()?;
    fs::create_dir_all(&config_dir)
        .map_err(|e| format!("Failed to create config directory: {}", e))?;
    Ok(())
}

#[tauri::command]
fn get_config() -> Result<AppConfig, String> {
    let config_path = get_config_path()?;
    
    if !config_path.exists() {
        return Ok(AppConfig::default());
    }
    
    match fs::read_to_string(&config_path) {
        Ok(content) => {
            serde_json::from_str(&content)
                .map_err(|e| format!("Failed to parse config: {}", e))
        }
        Err(e) => Err(format!("Failed to read config: {}", e))
    }
}

#[tauri::command]
fn save_config(config: AppConfig) -> Result<(), String> {
    ensure_config_dir()?;
    let config_path = get_config_path()?;
    
    let json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    
    fs::write(&config_path, json)
        .map_err(|e| format!("Failed to write config: {}", e))?;
    
    Ok(())
}

#[tauri::command]
fn get_last_folder() -> Result<Option<String>, String> {
    let config = get_config()?;
    Ok(config.last_folder)
}

#[tauri::command]
fn set_last_folder(path: String) -> Result<(), String> {
    let mut config = get_config()?;
    config.last_folder = Some(path);
    save_config(config)
}

#[tauri::command]
fn get_favorite_folders() -> Result<Vec<FavoriteFolder>, String> {
    let config = get_config()?;
    Ok(config.favorite_folders)
}

#[tauri::command]
fn set_favorite_folders(folders: Vec<FavoriteFolder>) -> Result<(), String> {
    let mut config = get_config()?;
    config.favorite_folders = folders;
    save_config(config)
}

#[tauri::command]
fn get_panel_settings() -> Result<PanelSettings, String> {
    let config = get_config()?;
    Ok(config.panel_settings.unwrap_or_default())
}

#[tauri::command]
fn set_panel_settings(settings: PanelSettings) -> Result<(), String> {
    let mut config = get_config()?;
    config.panel_settings = Some(settings);
    save_config(config)
}

#[tauri::command]
fn get_item_list_view_mode() -> Result<Option<String>, String> {
    let config = get_config()?;
    Ok(config.item_list_view_mode)
}

#[tauri::command]
fn set_item_list_view_mode(mode: String) -> Result<(), String> {
    let mut config = get_config()?;
    config.item_list_view_mode = Some(mode);
    save_config(config)
}

#[tauri::command]
fn get_sprite_list_view_mode() -> Result<Option<String>, String> {
    let config = get_config()?;
    Ok(config.sprite_list_view_mode)
}

#[tauri::command]
fn set_sprite_list_view_mode(mode: String) -> Result<(), String> {
    let mut config = get_config()?;
    config.sprite_list_view_mode = Some(mode);
    save_config(config)
}

#[tauri::command]
fn get_find_list_view_mode() -> Result<Option<String>, String> {
    let config = get_config()?;
    Ok(config.find_list_view_mode)
}

#[tauri::command]
fn set_find_list_view_mode(mode: String) -> Result<(), String> {
    let mut config = get_config()?;
    config.find_list_view_mode = Some(mode);
    save_config(config)
}

#[tauri::command]
fn get_general_settings() -> Result<GeneralSettings, String> {
    let config = get_config()?;
    Ok(config.general_settings.unwrap_or_default())
}

#[tauri::command]
fn set_general_settings(settings: GeneralSettings) -> Result<(), String> {
    let mut config = get_config()?;
    config.general_settings = Some(settings);
    save_config(config)
}

#[tauri::command]
fn backup_file(path: String) -> Result<(), String> {
    let enabled = get_config()
        .ok()
        .and_then(|c| c.general_settings)
        .map(|g| g.backup_on_save)
        .unwrap_or(true);
    if !enabled {
        return Ok(());
    }

    let src = std::path::Path::new(&path);
    if !src.exists() {
        return Ok(());
    }

    let millis = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let file_name = src
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("backup");
    let dest = src.with_file_name(format!("{}.{}.bak", file_name, millis));

    fs::copy(src, &dest).map_err(|e| format!("Failed to back up {}: {}", path, e))?;
    Ok(())
}

#[tauri::command]
fn ensure_versions_dir() -> Result<(), String> {
    let mut versions_dir = get_config_dir()?;
    versions_dir.push("versions");
    fs::create_dir_all(&versions_dir)
        .map_err(|e| format!("Failed to create versions directory: {}", e))?;
    Ok(())
}

#[tauri::command]
fn write_json_file(path: String, content: String) -> Result<(), String> {
    let target = PathBuf::from(&path);
    let parent = target.parent().ok_or_else(|| format!("Invalid path: {}", path))?;
    let file_name = target
        .file_name()
        .ok_or_else(|| format!("Invalid path: {}", path))?
        .to_string_lossy()
        .into_owned();
    let tmp = parent.join(format!(".{}.tmp", file_name));

    fs::write(&tmp, content.as_bytes())
        .map_err(|e| format!("Failed to write temp file for {}: {}", path, e))?;

    if let Err(e) = fs::rename(&tmp, &target) {
        let _ = fs::remove_file(&tmp);
        return Err(format!("Failed to commit JSON file {}: {}", path, e));
    }

    Ok(())
}

#[tauri::command]
fn delete_file(path: String) -> Result<(), String> {
    fs::remove_file(&path)
        .map_err(|e| format!("Failed to delete file {}: {}", path, e))
}

#[tauri::command]
fn list_versions_dir() -> Result<Vec<String>, String> {
    let mut versions_dir = get_config_dir()?;
    versions_dir.push("versions");

    if !versions_dir.exists() {
        return Ok(Vec::new());
    }

    let mut hashes = Vec::new();
    let entries = fs::read_dir(&versions_dir)
        .map_err(|e| format!("Failed to read versions dir: {}", e))?;
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to list versions dir: {}", e))?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let name = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n,
            None => continue,
        };
        if name == "commits.json" || name == ".schema" || name.starts_with('.') {
            continue;
        }
        if let Some(stem) = name.strip_suffix(".json") {
            hashes.push(stem.to_string());
        }
    }

    Ok(hashes)
}

#[tauri::command]
fn clear_versions_dir() -> Result<(), String> {
    let mut versions_dir = get_config_dir()?;
    versions_dir.push("versions");

    if !versions_dir.exists() {
        return Ok(());
    }

    let entries = fs::read_dir(&versions_dir)
        .map_err(|e| format!("Failed to read versions dir: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to list versions dir: {}", e))?;
        let path = entry.path();
        if path.is_file() {
            let _ = fs::remove_file(&path);
        } else if path.is_dir() {
            let _ = fs::remove_dir_all(&path);
        }
    }

    Ok(())
}

#[tauri::command]
fn read_sprites_compressed_raw(
    path: String,
    ids: Vec<u32>,
    extended: bool,
) -> Result<tauri::ipc::Response, String> {
    use std::io::{Read, Seek, SeekFrom};

    let mut file = fs::File::open(&path)
        .map_err(|e| format!("Failed to open SPR {}: {}", path, e))?;

    let header_size: u64 = if extended { 8 } else { 6 };

    let mut count_buf = [0u8; 4];
    file.seek(SeekFrom::Start(4))
        .map_err(|e| format!("Failed to seek SPR header: {}", e))?;
    if extended {
        file.read_exact(&mut count_buf)
            .map_err(|e| format!("Failed to read SPR sprite count: {}", e))?;
    } else {
        let mut small = [0u8; 2];
        file.read_exact(&mut small)
            .map_err(|e| format!("Failed to read SPR sprite count: {}", e))?;
        count_buf[0] = small[0];
        count_buf[1] = small[1];
    }
    let sprite_count = u32::from_le_bytes(count_buf);

    let mut out: Vec<u8> = Vec::with_capacity(ids.len() * 32);
    out.extend_from_slice(&(ids.len() as u32).to_le_bytes());

    for id in ids {
        out.extend_from_slice(&id.to_le_bytes());

        if id == 0 || id > sprite_count {
            out.push(1);
            out.extend_from_slice(&0u32.to_le_bytes());
            continue;
        }

        let addr_pos = header_size + ((id - 1) as u64) * 4;
        file.seek(SeekFrom::Start(addr_pos))
            .map_err(|e| format!("Failed to seek to sprite address: {}", e))?;

        let mut addr_buf = [0u8; 4];
        file.read_exact(&mut addr_buf)
            .map_err(|e| format!("Failed to read sprite address: {}", e))?;
        let address = u32::from_le_bytes(addr_buf);

        if address == 0 {
            out.push(1);
            out.extend_from_slice(&0u32.to_le_bytes());
            continue;
        }

        file.seek(SeekFrom::Start(address as u64 + 3))
            .map_err(|e| format!("Failed to seek to sprite data: {}", e))?;

        let mut len_buf = [0u8; 2];
        file.read_exact(&mut len_buf)
            .map_err(|e| format!("Failed to read sprite data length: {}", e))?;
        let length = u16::from_le_bytes(len_buf) as u32;

        if length == 0 {
            out.push(1);
            out.extend_from_slice(&0u32.to_le_bytes());
            continue;
        }

        let mut pixels = vec![0u8; length as usize];
        file.read_exact(&mut pixels)
            .map_err(|e| format!("Failed to read sprite data: {}", e))?;

        out.push(0);
        out.extend_from_slice(&length.to_le_bytes());
        out.extend_from_slice(&pixels);
    }

    Ok(tauri::ipc::Response::new(out))
}

#[tauri::command]
fn save_scene(name: String, content: String) -> Result<String, String> {
    let mut scenes_dir = get_config_dir()?;
    scenes_dir.push("scenes");
    fs::create_dir_all(&scenes_dir)
        .map_err(|e| format!("Failed to create scenes directory: {}", e))?;
    
    let safe_name = name.replace(|c: char| !c.is_alphanumeric() && c != '-' && c != '_', "_");
    let file_path = scenes_dir.join(format!("{}.json", safe_name));
    
    fs::write(&file_path, content)
        .map_err(|e| format!("Failed to write scene file: {}", e))?;
        
    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
fn list_scenes() -> Result<Vec<String>, String> {
    let mut scenes_dir = get_config_dir()?;
    scenes_dir.push("scenes");
    
    if !scenes_dir.exists() {
        return Ok(Vec::new());
    }
    
    let mut scenes = Vec::new();
    for entry in fs::read_dir(scenes_dir).map_err(|e| format!("Failed to read scenes dir: {}", e))? {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();
        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("json") {
            if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                scenes.push(stem.to_string());
            }
        }
    }
    scenes.sort();
    Ok(scenes)
}

#[tauri::command]
fn load_scene(name: String) -> Result<String, String> {
    let mut scenes_dir = get_config_dir()?;
    scenes_dir.push("scenes");
    let safe_name = name.replace(|c: char| !c.is_alphanumeric() && c != '-' && c != '_', "_");
    let file_path = scenes_dir.join(format!("{}.json", safe_name));
    
    fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read scene file: {}", e))
}

#[tauri::command]
fn delete_scene(name: String) -> Result<(), String> {
    let mut scenes_dir = get_config_dir()?;
    scenes_dir.push("scenes");
    let safe_name = name.replace(|c: char| !c.is_alphanumeric() && c != '-' && c != '_', "_");
    let file_path = scenes_dir.join(format!("{}.json", safe_name));
    
    if file_path.exists() {
        fs::remove_file(&file_path)
            .map_err(|e| format!("Failed to delete scene file: {}", e))?;
    }
    Ok(())
}

fn templates_dir() -> Result<PathBuf, String> {
    let mut dir = get_config_dir()?;
    dir.push("templates");
    Ok(dir)
}

fn template_path(name: &str) -> Result<PathBuf, String> {
    let safe_name = name.replace(|c: char| !c.is_alphanumeric() && c != '-' && c != '_', "_");
    if safe_name.is_empty() {
        return Err("Invalid template name".to_string());
    }
    Ok(templates_dir()?.join(format!("{}.json", safe_name)))
}

#[tauri::command]
fn save_template(name: String, content: String) -> Result<String, String> {
    let dir = templates_dir()?;
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create templates directory: {}", e))?;

    let file_path = template_path(&name)?;
    fs::write(&file_path, content).map_err(|e| format!("Failed to write template file: {}", e))?;

    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
fn list_templates() -> Result<Vec<String>, String> {
    let dir = templates_dir()?;
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let mut templates = Vec::new();
    for entry in fs::read_dir(dir).map_err(|e| format!("Failed to read templates dir: {}", e))? {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();
        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("json") {
            let content = fs::read_to_string(&path)
                .map_err(|e| format!("Failed to read template file: {}", e))?;
            templates.push(content);
        }
    }
    Ok(templates)
}

#[tauri::command]
fn cache_template_sheet(request: tauri::ipc::Request) -> Result<String, String> {
    let bytes = match request.body() {
        tauri::ipc::InvokeBody::Raw(data) => data,
        _ => return Err("Expected raw sheet bytes".to_string()),
    };

    let mut dir = templates_dir()?;
    dir.push("sheets");
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create sheets directory: {}", e))?;

    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("Failed to read clock: {}", e))?
        .as_millis();
    let file_path = dir.join(format!("sheet-{}.png", stamp));

    fs::write(&file_path, bytes).map_err(|e| format!("Failed to write sheet file: {}", e))?;
    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
fn delete_template(name: String) -> Result<(), String> {
    let file_path = template_path(&name)?;
    if file_path.exists() {
        fs::remove_file(&file_path).map_err(|e| format!("Failed to delete template file: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
fn write_dat_bin(request: tauri::ipc::Request) -> Result<(), String> {
    match request.body() {
        tauri::ipc::InvokeBody::Raw(bytes) => write_dat_from_buffer(bytes),
        _ => Err("write_dat_bin expects a raw binary payload".to_string()),
    }
}

#[tauri::command]
fn copy_spr_file_with_mods(request: tauri::ipc::Request) -> Result<(), String> {
    fn take<'a>(bytes: &'a [u8], o: &mut usize, n: usize) -> Result<&'a [u8], String> {
        if *o + n > bytes.len() {
            return Err(format!("SPR copy buffer truncated at offset {}", *o));
        }
        let s = &bytes[*o..*o + n];
        *o += n;
        Ok(s)
    }

    let bytes = match request.body() {
        tauri::ipc::InvokeBody::Raw(b) => b.as_slice(),
        _ => return Err("copy_spr_file_with_mods expects a raw binary payload".to_string()),
    };

    let mut o = 0usize;
    let extended = take(bytes, &mut o, 1)?[0] == 1;
    let signature = u32::from_le_bytes(take(bytes, &mut o, 4)?.try_into().unwrap());
    let target_count = u32::from_le_bytes(take(bytes, &mut o, 4)?.try_into().unwrap());
    let src_len = u16::from_le_bytes(take(bytes, &mut o, 2)?.try_into().unwrap()) as usize;
    let source_path = String::from_utf8_lossy(take(bytes, &mut o, src_len)?).into_owned();
    let dst_len = u16::from_le_bytes(take(bytes, &mut o, 2)?.try_into().unwrap()) as usize;
    let dest_path = String::from_utf8_lossy(take(bytes, &mut o, dst_len)?).into_owned();

    let modifications = parse_sprites_buffer(&bytes[o..])?;

    copy_spr_with_modifications(&source_path, &dest_path, extended, signature, target_count, modifications)
}

fn parse_sprites_buffer(buffer: &[u8]) -> Result<Vec<SpriteWrite>, String> {
    if buffer.len() < 4 {
        return Err("Buffer too small to contain sprite count".to_string());
    }

    let mut offset = 0;

    let count = u32::from_le_bytes(
        buffer[offset..offset + 4]
            .try_into()
            .map_err(|_| "Failed to read sprite count")?,
    ) as usize;
    offset += 4;

    let mut sprites = Vec::with_capacity(count);

    for i in 0..count {
        if offset + 9 > buffer.len() {
            return Err(format!(
                "Buffer truncated at sprite {}: need {} bytes, have {}",
                i,
                offset + 9,
                buffer.len()
            ));
        }

        let id = u32::from_le_bytes(
            buffer[offset..offset + 4]
                .try_into()
                .map_err(|_| format!("Failed to read sprite {} ID", i))?,
        );
        offset += 4;

        let is_empty = buffer[offset] == 1;
        offset += 1;

        let compressed_len = u32::from_le_bytes(
            buffer[offset..offset + 4]
                .try_into()
                .map_err(|_| format!("Failed to read sprite {} compressed length", i))?,
        ) as usize;
        offset += 4;

        let compressed_pixels = if compressed_len > 0 {
            if offset + compressed_len > buffer.len() {
                return Err(format!(
                    "Buffer truncated at sprite {} data: need {} bytes, have {}",
                    i,
                    offset + compressed_len,
                    buffer.len()
                ));
            }
            buffer[offset..offset + compressed_len].to_vec()
        } else {
            Vec::new()
        };
        offset += compressed_len;

        sprites.push(SpriteWrite {
            id,
            is_empty,
            compressed_pixels,
        });
    }

    Ok(sprites)
}

#[tauri::command]
fn update_spr_sprites_bin(request: tauri::ipc::Request) -> Result<(), String> {
    let bytes = match request.body() {
        tauri::ipc::InvokeBody::Raw(b) => b.as_slice(),
        _ => return Err("update_spr_sprites_bin expects a raw binary payload".to_string()),
    };

    if bytes.len() < 7 {
        return Err("SPR update buffer too small for header".to_string());
    }
    let extended = bytes[0] == 1;
    let sprites_count = u32::from_le_bytes([bytes[1], bytes[2], bytes[3], bytes[4]]);
    let path_len = u16::from_le_bytes([bytes[5], bytes[6]]) as usize;
    let path_start = 7;
    if path_start + path_len > bytes.len() {
        return Err("SPR update buffer truncated (path)".to_string());
    }
    let path = String::from_utf8_lossy(&bytes[path_start..path_start + path_len]).into_owned();

    let sprites = parse_sprites_buffer(&bytes[path_start + path_len..])?;

    update_sprites_in_spr(&path, extended, sprites, sprites_count)
}

#[tauri::command]
fn parse_dat_file_bin(
    path: String,
    version: u32,  // Version from frontend (e.g., 860 for 8.60, 1098 for 10.98)
    extended: Option<bool>,
    frame_durations: Option<bool>,
    frame_groups: Option<bool>,
    dat_state: tauri::State<DatManagerState>,
) -> Result<Response, String> {
    let mut reader = DatReader::open(&path)?;
    reader.set_version(version);
    reader.apply_overrides(extended, frame_durations, frame_groups);
    let (signature, items, outfits, effects, missiles) = reader.read_dat()
        .map_err(|e| {
            let msg = format!("DAT parse error (version {}): {}", version, e);
            logger::log("ERROR", &msg);
            msg
        })?;

    logger::log(
        "INFO",
        &format!(
            "Loaded DAT {} (v{}): {} items, {} outfits, {} effects, {} missiles",
            path, version, items.len(), outfits.len(), effects.len(), missiles.len()
        ),
    );

    {
        let mut manager = dat_state.lock().map_err(|e| format!("Lock error: {}", e))?;
        manager.store_data(path.clone(), items.clone(), outfits.clone(), effects.clone(), missiles.clone())?;
    }

    let buffer = encode_dat_to_binary(signature, &items, &outfits, &effects, &missiles);
    Ok(Response::new(buffer))
}

#[tauri::command]
fn search_things_bin(
    path: String,
    category: Option<String>,
    name: Option<String>,
    properties: std::collections::HashMap<String, bool>,
    sprite_id: Option<u32>,
    limit: usize,
    dat_state: tauri::State<DatManagerState>,
) -> Result<Response, String> {
    let manager = dat_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let bytes = manager.search_binary(
        &path,
        category.as_deref(),
        name.as_deref(),
        &properties,
        sprite_id,
        limit
    )?;
    Ok(Response::new(bytes))
}

#[tauri::command]
fn find_similar_bin(
    request: tauri::ipc::Request,
    spr_state: tauri::State<SprManagerState>,
    dat_state: tauri::State<DatManagerState>,
) -> Result<Response, String> {
    use std::collections::HashMap;

    let bytes = match request.body() {
        tauri::ipc::InvokeBody::Raw(b) => b.as_slice(),
        _ => return Err("find_similar_bin expects a raw binary payload".to_string()),
    };

    let mut cursor = 0usize;
    let need = |cursor: usize, n: usize, total: usize| -> Result<(), String> {
        if cursor + n > total {
            Err(format!("Payload truncated at offset {} (need {} bytes, have {})", cursor, n, total - cursor))
        } else { Ok(()) }
    };
    let total = bytes.len();

    need(cursor, 2, total)?;
    let ref_count = u16::from_le_bytes([bytes[cursor], bytes[cursor + 1]]) as usize;
    cursor += 2;

    need(cursor, ref_count * 5, total)?;
    let mut ref_pairs: Vec<(u32, u8)> = Vec::with_capacity(ref_count);
    for _ in 0..ref_count {
        let id = u32::from_le_bytes([
            bytes[cursor], bytes[cursor + 1], bytes[cursor + 2], bytes[cursor + 3],
        ]);
        cursor += 4;
        let cat = bytes[cursor]; cursor += 1;
        ref_pairs.push((id, cat));
    }

    need(cursor, 8, total)?;
    let category_byte = bytes[cursor]; cursor += 1;
    let transparent = bytes[cursor] != 0; cursor += 1;
    let threshold_pct = bytes[cursor].min(100); cursor += 1;
    let _reserved = bytes[cursor]; cursor += 1;
    let max_results = u32::from_le_bytes([
        bytes[cursor], bytes[cursor + 1], bytes[cursor + 2], bytes[cursor + 3],
    ]) as usize;
    cursor += 4;

    need(cursor, 2, total)?;
    let dat_path_len = u16::from_le_bytes([bytes[cursor], bytes[cursor + 1]]) as usize;
    cursor += 2;
    need(cursor, dat_path_len, total)?;
    let dat_path = std::str::from_utf8(&bytes[cursor..cursor + dat_path_len])
        .map_err(|e| format!("Invalid dat_path utf-8: {}", e))?
        .to_string();
    cursor += dat_path_len;

    need(cursor, 2, total)?;
    let spr_path_len = u16::from_le_bytes([bytes[cursor], bytes[cursor + 1]]) as usize;
    cursor += 2;
    need(cursor, spr_path_len, total)?;
    let spr_path = std::str::from_utf8(&bytes[cursor..cursor + spr_path_len])
        .map_err(|e| format!("Invalid spr_path utf-8: {}", e))?
        .to_string();

    let category: Option<&str> = match category_byte {
        0 => None,
        1 => Some("item"),
        2 => Some("outfit"),
        3 => Some("effect"),
        4 => Some("missile"),
        other => return Err(format!("Invalid category byte: {}", other)),
    };

    let (refs, candidate_ids) = {
        let dat_mgr = dat_state.lock().map_err(|e| format!("DAT lock error: {}", e))?;
        let refs = dat_mgr.resolve_reference_things(&dat_path, &ref_pairs)?;
        let mut set = dat_mgr.collect_candidate_sprite_ids(&dat_path, category)?;
        for r in &refs {
            for &sid in &r.sprite_ids { set.insert(sid); }
        }
        (refs, set.into_iter().collect::<Vec<u32>>())
    };

    if refs.is_empty() {
        let mut empty = Vec::with_capacity(4);
        empty.extend_from_slice(&0u32.to_le_bytes());
        return Ok(Response::new(empty));
    }

    let sprite_data = {
        let mut spr_mgr = spr_state.lock().map_err(|e| format!("SPR lock error: {}", e))?;
        spr_mgr.read_sprites_list(&spr_path, candidate_ids)?
    };

    use rayon::prelude::*;
    let signed: Vec<(u32, SpriteSignature)> = sprite_data
        .into_par_iter()
        .map(|s| {
            if s.is_empty { (s.id, SpriteSignature::empty()) }
            else { (s.id, signature_compressed(&s.compressed_pixels, transparent)) }
        })
        .collect();

    let mut sig_map: HashMap<u32, SpriteSignature> = HashMap::with_capacity(signed.len());
    for (id, sig) in signed { sig_map.insert(id, sig); }

    let buffer = {
        let dat_mgr = dat_state.lock().map_err(|e| format!("DAT lock error: {}", e))?;
        dat_mgr.find_similar_binary(
            &dat_path,
            category,
            &refs,
            &sig_map,
            threshold_pct,
            max_results,
        )?
    };

    Ok(Response::new(buffer))
}

#[tauri::command]
fn clear_dat_data(
    path: String,
    dat_state: tauri::State<DatManagerState>,
) -> Result<(), String> {
    let mut manager = dat_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    manager.remove_data(&path);
    Ok(())
}

#[tauri::command]
fn write_sprite_png(path: String, rgba: Vec<u8>) -> Result<(), String> {
    if rgba.len() != 32 * 32 * 4 {
        return Err(format!("Expected 4096 RGBA bytes, got {}", rgba.len()));
    }
    let img = image::RgbaImage::from_raw(32, 32, rgba)
        .ok_or_else(|| "Failed to build RGBA image".to_string())?;
    img.save(&path).map_err(|e| format!("Failed to write PNG: {}", e))
}

#[tauri::command]
fn read_sprite_png(path: String) -> Result<Vec<u8>, String> {
    let img = image::open(&path)
        .map_err(|e| format!("Failed to open image: {}", e))?
        .to_rgba8();
    if img.width() != 32 || img.height() != 32 {
        return Err(format!(
            "Image must be exactly 32x32 pixels (got {}x{})",
            img.width(),
            img.height()
        ));
    }
    Ok(img.into_raw())
}

fn get_group_dimensions(group: &FrameGroup) -> (u32, u32) {
    let total_x = (group.pattern_z as u32) * (group.pattern_x as u32) * (group.layers as u32);
    let total_y = (group.frames as u32) * (group.pattern_y as u32);
    (total_x, total_y)
}

fn get_sprite_index(
    group: &FrameGroup,
    width: u32,
    height: u32,
    layer: u32,
    pattern_x: u32,
    pattern_y: u32,
    pattern_z: u32,
    frame: u32,
) -> usize {
    let w = group.width as u32;
    let h = group.height as u32;
    let l = group.layers as u32;
    let px = group.pattern_x as u32;
    let py = group.pattern_y as u32;
    let pz = group.pattern_z as u32;
    let f = group.frames as u32;
    
    (((
        (((
            (frame % f) * pz + pattern_z
         ) * py + pattern_y
        ) * px + pattern_x
       ) * l + layer
      ) * h + height
     ) * w + width
    ) as usize
}


fn create_synthetic_group(thing: &ThingType) -> FrameGroup {
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
        is_animation: thing.is_animation,
        animation_mode: Some(thing.animation_mode),
        loop_count: Some(thing.loop_count),
        start_frame: Some(thing.start_frame),
        frame_durations: Some(thing.frame_durations.clone()),
    }
}

#[tauri::command]
fn export_object_sheet_rust(
    thing: ThingType,
    spr_path: String,
    path: String,
    transparent: bool,
    scripted: bool,
    spr_state: tauri::State<SprManagerState>,
    forge_assets: tauri::State<ForgeAssetsState>,
) -> Result<(), String> {
    let mut groups: Vec<FrameGroup> = Vec::new();
    if let Some(ref fgs) = thing.frame_groups_data {
        if !fgs.is_empty() {
             groups = fgs.clone();
             groups.sort_by(|a, b| a.r#type.cmp(&b.r#type));
        } else {
             groups.push(create_synthetic_group(&thing));
        }
    } else {
         groups.push(create_synthetic_group(&thing));
    }

    let mut sheet_total_x = 0;
    let mut sheet_total_y = 0;
    let mut max_thing_width = 0;
    let mut max_thing_height = 0;
    
    struct GroupMetric {
        start_y: u32,
    }
    let mut group_metrics = Vec::new();
    let mut current_y = 0;
    
    for group in &groups {
        let (total_x, total_y) = get_group_dimensions(group);
        if total_x > sheet_total_x { sheet_total_x = total_x; }
        
        group_metrics.push(GroupMetric {
            start_y: current_y,
        });
        
        current_y += total_y;
        sheet_total_y += total_y;
        
        if (group.width as u32) > max_thing_width { max_thing_width = group.width as u32; }
        if (group.height as u32) > max_thing_height { max_thing_height = group.height as u32; }
    }
    
    const SPRITE_SIZE: u32 = 32;
    let texture_width_px = max_thing_width * SPRITE_SIZE;
    let texture_height_px = max_thing_height * SPRITE_SIZE;
    
    let canvas_width = sheet_total_x * texture_width_px;
    let canvas_height = sheet_total_y * texture_height_px;
    
    if canvas_width == 0 || canvas_height == 0 {
        return Err("Invalid canvas dimensions".to_string());
    }
    
    let mut sprite_ids = Vec::new();
    for group in &groups {
        for f in 0..group.frames {
            for z in 0..group.pattern_z {
                for y in 0..group.pattern_y {
                    for x in 0..group.pattern_x {
                        for l in 0..group.layers {
                            for h in 0..group.height {
                                for w in 0..group.width {
                                    let index = get_sprite_index(group, w as u32, h as u32, l as u32, x as u32, y as u32, z as u32, f as u32);
                                    if index < group.sprite_index.len() {
                                        sprite_ids.push(group.sprite_index[index]);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    use std::collections::HashMap;
    let mut rgba_map: HashMap<u32, Vec<u8>> = HashMap::new();
    if scripted {
        let guard = forge_assets.lock().map_err(|e| format!("Lock error: {}", e))?;
        let assets = guard.as_ref().ok_or("no scripted assets loaded")?;
        for id in &sprite_ids {
            if let Some(px) = assets.rgba(*id) {
                rgba_map.entry(*id).or_insert(px);
            }
        }
    } else {
        let mut manager = spr_state.lock().map_err(|e| format!("Lock error: {}", e))?;
        let sprite_data_list = manager.read_sprites_list(&spr_path, sprite_ids)?;
        for sprite in sprite_data_list {
            if !sprite.is_empty {
                rgba_map.insert(sprite.id, decompress_to_rgba(&sprite.compressed_pixels, transparent));
            }
        }
    }

    let mut sheet = RgbaImage::new(canvas_width, canvas_height);
    
    for (i, group) in groups.iter().enumerate() {
        let metrics = &group_metrics[i];
        let start_y_px = metrics.start_y * texture_height_px;
        let cell_width = texture_width_px;
        let cell_height = texture_height_px;
        
        for f in 0..group.frames {
            for z in 0..group.pattern_z {
                for y in 0..group.pattern_y {
                    for x in 0..group.pattern_x {
                        for l in 0..group.layers {
                             let col = (z as u32) * (group.pattern_x as u32) * (group.layers as u32)
                                     + (x as u32) * (group.layers as u32)
                                     + (l as u32);

                             let row = (f as u32) * (group.pattern_y as u32) + (y as u32);

                             let fx = col * cell_width;
                             let fy = row * cell_height + start_y_px;
                             
                             for h in 0..group.height {
                                 for w in 0..group.width {
                                     let index = get_sprite_index(group, w as u32, h as u32, l as u32, x as u32, y as u32, z as u32, f as u32);
                                     if index < group.sprite_index.len() {
                                         let sprite_id = group.sprite_index[index];
                                         if let Some(rgba) = rgba_map.get(&sprite_id) {
                                             if let Some(img_buffer) = RgbaImage::from_raw(SPRITE_SIZE, SPRITE_SIZE, rgba.clone()) {
                                                 let px = ((group.width as u32 - w as u32 - 1) * SPRITE_SIZE);
                                                 let py = ((group.height as u32 - h as u32 - 1) * SPRITE_SIZE);

                                                 imageops::overlay(&mut sheet, &img_buffer, (fx + px) as i64, (fy + py) as i64);
                                             }
                                         }
                                     }
                                 }
                             }
                        }
                    }
                }
            }
        }
    }

    sheet.save(&path).map_err(|e| format!("Failed to save image to {}: {}", path, e))?;

    Ok(())
}

#[derive(Clone)]
struct GroupGeom {
    width: u8,
    height: u8,
    layers: u8,
    pattern_x: u8,
    pattern_y: u8,
    pattern_z: u8,
    frames: u8,
}

impl GroupGeom {
    fn from_thing(t: &ThingType) -> Self {
        Self {
            width: t.width.max(1),
            height: t.height.max(1),
            layers: t.layers.max(1),
            pattern_x: t.pattern_x.max(1),
            pattern_y: t.pattern_y.max(1),
            pattern_z: t.pattern_z.max(1),
            frames: t.frames.max(1),
        }
    }

    fn from_frame_group(g: &FrameGroup) -> Self {
        Self {
            width: g.width.max(1),
            height: g.height.max(1),
            layers: g.layers.max(1),
            pattern_x: g.pattern_x.max(1),
            pattern_y: g.pattern_y.max(1),
            pattern_z: g.pattern_z.max(1),
            frames: g.frames.max(1),
        }
    }

    fn total_x(&self) -> u32 {
        self.pattern_z as u32 * self.pattern_x as u32 * self.layers as u32
    }

    fn total_y(&self) -> u32 {
        self.frames as u32 * self.pattern_y as u32
    }

    fn sheet_size(&self) -> (u32, u32) {
        (self.total_x() * self.width as u32 * 32, self.total_y() * self.height as u32 * 32)
    }

    fn total_sprites(&self) -> usize {
        self.width as usize
            * self.height as usize
            * self.layers as usize
            * self.pattern_x as usize
            * self.pattern_y as usize
            * self.pattern_z as usize
            * self.frames as usize
    }
}

fn extract_group_sprites(
    img: &RgbaImage,
    g: &GroupGeom,
    sheet_total_x: u32,
    cell_w_px: u32,
    cell_h_px: u32,
    fy_offset: u32,
    transparent: bool,
    spr_path: &str,
    manager: &mut SprManager,
    reusable_ids: &[u32],
    id_alloc_idx: &mut usize,
    current_next_id: &mut u32,
) -> Result<(Vec<u32>, Vec<SpriteData>), String> {
    let mut sprite_index: Vec<u32> = Vec::with_capacity(g.total_sprites());
    let mut sprites_data: Vec<SpriteData> = Vec::new();
    let img_w = img.width();
    let img_h = img.height();

    for frame in 0..g.frames {
        for pz in 0..g.pattern_z {
            for py in 0..g.pattern_y {
                for px in 0..g.pattern_x {
                    for layer in 0..g.layers {
                        let tex_index = (((((frame as u32) * g.pattern_z as u32 + pz as u32)
                            * g.pattern_y as u32
                            + py as u32)
                            * g.pattern_x as u32
                            + px as u32)
                            * g.layers as u32)
                            + layer as u32;
                        let fx = (tex_index % sheet_total_x) * cell_w_px;
                        let fy = fy_offset + (tex_index / sheet_total_x) * cell_h_px;

                        for h in 0..g.height {
                            for w in 0..g.width {
                                let reversed_w = (g.width - 1 - w) as u32;
                                let reversed_h = (g.height - 1 - h) as u32;
                                let src_x = fx + reversed_w * 32;
                                let src_y = fy + reversed_h * 32;

                                if src_x + 32 > img_w || src_y + 32 > img_h {
                                    sprite_index.push(0);
                                    continue;
                                }

                                let sub_img = img.view(src_x, src_y, 32, 32);
                                let mut sub_img_buffer = sub_img.to_image();
                                for pixel in sub_img_buffer.pixels_mut() {
                                    if pixel[3] == 0 { pixel.0 = [0, 0, 0, 0]; }
                                }
                                let raw_pixels = sub_img_buffer.as_raw();
                                let is_empty = raw_pixels.chunks(4).all(|p| p[3] == 0);

                                if is_empty {
                                    sprite_index.push(0);
                                    continue;
                                }

                                let sprite_id = if *id_alloc_idx < reusable_ids.len() {
                                    let id = reusable_ids[*id_alloc_idx];
                                    *id_alloc_idx += 1;
                                    id
                                } else {
                                    let id = *current_next_id;
                                    *current_next_id += 1;
                                    id
                                };

                                let compressed_pixels = compress_to_rle(raw_pixels, transparent);
                                let sprite_data = SpriteData {
                                    id: sprite_id,
                                    is_empty: false,
                                    compressed_pixels,
                                };

                                manager.update_sprite(spr_path, sprite_id, sprite_data.clone())?;
                                sprites_data.push(sprite_data);
                                sprite_index.push(sprite_id);
                            }
                        }
                    }
                }
            }
        }
    }

    Ok((sprite_index, sprites_data))
}

fn build_import_response(new_thing: &ThingType, sprites_data: Vec<SpriteData>, transparent: bool)
    -> Result<tauri::ipc::Response, String>
{
    let thing_json = serde_json::to_vec(new_thing)
        .map_err(|e| format!("JSON serialize error: {}", e))?;
    let sprites_buffer = SprManager::pack_sprites_rgba_lz4(sprites_data, transparent);
    let mut result = Vec::with_capacity(4 + thing_json.len() + sprites_buffer.len());
    result.extend_from_slice(&(thing_json.len() as u32).to_le_bytes());
    result.extend_from_slice(&thing_json);
    result.extend_from_slice(&sprites_buffer);
    Ok(tauri::ipc::Response::new(result))
}

fn collect_reusable_ids(thing: &ThingType) -> Vec<u32> {
    let mut ids: Vec<u32> = Vec::new();
    if let Some(fgs) = &thing.frame_groups_data {
        for fg in fgs {
            for &id in &fg.sprite_index {
                if id != 0 { ids.push(id); }
            }
        }
    } else {
        for &id in &thing.sprite_index {
            if id != 0 { ids.push(id); }
        }
    }
    ids.sort();
    ids.dedup();
    ids
}

fn import_preserve_geometry(
    img: &RgbaImage,
    img_width: u32,
    img_height: u32,
    thing: ThingType,
    transparent: bool,
    next_sprite_id: u32,
    is_new: bool,
    spr_path: &str,
    manager: &mut SprManager,
) -> Result<tauri::ipc::Response, String> {
    let synthetic = thing.frame_groups_data.is_none();
    let groups: Vec<GroupGeom> = if synthetic {
        vec![GroupGeom::from_thing(&thing)]
    } else {
        thing.frame_groups_data
            .as_ref()
            .unwrap()
            .iter()
            .map(GroupGeom::from_frame_group)
            .collect()
    };

    let reusable_ids = if is_new {
        Vec::new()
    } else {
        collect_reusable_ids(&thing)
    };
    let mut id_alloc_idx: usize = 0;
    let mut current_next_id: u32 = next_sprite_id;

    let active = GroupGeom::from_thing(&thing);
    let active_matches = |g: &GroupGeom| {
        g.width == active.width && g.height == active.height && g.layers == active.layers
            && g.pattern_x == active.pattern_x && g.pattern_y == active.pattern_y
            && g.pattern_z == active.pattern_z && g.frames == active.frames
    };

    let single_match: Option<usize> = groups
        .iter()
        .enumerate()
        .find(|(_, g)| g.sheet_size() == (img_width, img_height) && active_matches(g))
        .map(|(i, _)| i)
        .or_else(|| {
            groups
                .iter()
                .enumerate()
                .find(|(_, g)| g.sheet_size() == (img_width, img_height))
                .map(|(i, _)| i)
        });

    if let Some(idx) = single_match {
        let g = groups[idx].clone();
        let cell_w_px = g.width as u32 * 32;
        let cell_h_px = g.height as u32 * 32;
        let (new_sprite_index, sprites_data) = extract_group_sprites(
            img, &g, g.total_x(), cell_w_px, cell_h_px, 0,
            transparent, spr_path, manager,
            &reusable_ids, &mut id_alloc_idx, &mut current_next_id,
        )?;

        let mut new_thing = thing.clone();
        if synthetic {
            new_thing.sprite_index = new_sprite_index;
        } else if let Some(fgs) = new_thing.frame_groups_data.as_mut() {
            fgs[idx].sprite_index = new_sprite_index.clone();
            if active_matches(&GroupGeom::from_frame_group(&fgs[idx])) {
                new_thing.sprite_index = new_sprite_index;
            }
        }

        return build_import_response(&new_thing, sprites_data, transparent);
    }

    if groups.len() > 1 {
        let combined_w: u32 = groups.iter().map(|g| g.total_x() * g.width as u32 * 32).max().unwrap_or(0);
        let combined_h: u32 = groups.iter().map(|g| g.total_y() * g.height as u32 * 32).sum();

        if combined_w == img_width && combined_h == img_height {
            let global_total_x: u32 = groups.iter().map(|g| g.total_x()).max().unwrap_or(1);
            let global_cell_w_px: u32 = groups.iter().map(|g| g.width as u32 * 32).max().unwrap_or(32);
            let global_cell_h_px: u32 = groups.iter().map(|g| g.height as u32 * 32).max().unwrap_or(32);

            let mut all_sprites: Vec<SpriteData> = Vec::new();
            let mut per_group_index: Vec<Vec<u32>> = Vec::with_capacity(groups.len());
            let mut fy_offset: u32 = 0;

            for g in groups.iter() {
                let (idx_vec, mut sprites) = extract_group_sprites(
                    img, g, global_total_x, global_cell_w_px, global_cell_h_px, fy_offset,
                    transparent, spr_path, manager,
                    &reusable_ids, &mut id_alloc_idx, &mut current_next_id,
                )?;
                fy_offset += g.total_y() * global_cell_h_px;
                per_group_index.push(idx_vec);
                all_sprites.append(&mut sprites);
            }

            let mut new_thing = thing.clone();
            if let Some(fgs) = new_thing.frame_groups_data.as_mut() {
                for (i, idx_vec) in per_group_index.into_iter().enumerate() {
                    if i < fgs.len() {
                        fgs[i].sprite_index = idx_vec.clone();
                        if active_matches(&GroupGeom::from_frame_group(&fgs[i])) {
                            new_thing.sprite_index = idx_vec;
                        }
                    }
                }
            }

            return build_import_response(&new_thing, all_sprites, transparent);
        }
    }

    let single_sizes: Vec<String> = groups
        .iter()
        .enumerate()
        .map(|(i, g)| {
            let (w, h) = g.sheet_size();
            if groups.len() > 1 {
                format!("group {}: {}x{}", i, w, h)
            } else {
                format!("{}x{}", w, h)
            }
        })
        .collect();
    let mut msg = format!(
        "Image is {}x{} but does not match the object's geometry. Expected {}",
        img_width, img_height, single_sizes.join(" or ")
    );
    if groups.len() > 1 {
        let combined_w: u32 = groups.iter().map(|g| g.total_x() * g.width as u32 * 32).max().unwrap_or(0);
        let combined_h: u32 = groups.iter().map(|g| g.total_y() * g.height as u32 * 32).sum();
        msg.push_str(&format!(", or combined: {}x{}", combined_w, combined_h));
    }
    Err(msg)
}

#[tauri::command]
fn import_object_sheet_binary(
    request: tauri::ipc::Request,
    spr_state: tauri::State<SprManagerState>,
) -> Result<tauri::ipc::Response, String> {
    let bytes = match request.body() {
        tauri::ipc::InvokeBody::Raw(b) => b.as_slice(),
        _ => return Err("import_object_sheet_binary expects a raw binary payload".to_string()),
    };

    let mut r = Reader::new(bytes);
    let transparent = r.bool()?;
    let _version = r.u32()?;
    let next_sprite_id = r.u32()?;
    let is_new = r.bool()?;
    let spr_path = r.string()?;
    let category = r.string()?;
    let thing = read_thing(&mut r, &category)?;
    let image_bytes = r.rest();

    let mut manager = spr_state.lock().map_err(|e| format!("Lock error: {}", e))?;

    let mut img = image::load_from_memory(image_bytes)
        .map_err(|e| format!("Failed to load image from bytes: {}", e))?
        .to_rgba8();

    for pixel in img.pixels_mut() {
        if pixel[0] == 255 && pixel[1] == 0 && pixel[2] == 255 && pixel[3] == 255 {
            pixel.0 = [0, 0, 0, 0];
        }
    }

    let img_width = img.width();
    let img_height = img.height();

    if img_width < 32 || img_height < 32 {
        return Err("Image is too small (must be at least 32x32)".to_string());
    }

    import_preserve_geometry(
        &img,
        img_width,
        img_height,
        thing,
        transparent,
        next_sprite_id,
        is_new,
        &spr_path,
        &mut manager,
    )
}

fn transfer_category_label(value: u8) -> &'static str {
    match value {
        1 => "item",
        2 => "outfit",
        3 => "effect",
        4 => "missile",
        _ => "item",
    }
}

fn transfer_category_value(category: &str) -> u8 {
    match category {
        "item" => 1,
        "outfit" => 2,
        "effect" => 3,
        "missile" => 4,
        _ => 1,
    }
}

fn read_sprite_rgba(r: &mut Reader, transparent: bool) -> Result<(u32, bool, Vec<u8>, Vec<u8>), String> {
    let local_id = r.u32()?;
    let kind = r.u8()?;
    let len = r.u32()? as usize;
    let bytes = r.take(len)?.to_vec();
    let (is_empty, rle, rgba) = match kind {
        0 => (true, Vec::new(), vec![0u8; 4096]),
        1 => {
            let rgba = decompress_to_rgba(&bytes, transparent);
            (false, bytes, rgba)
        }
        _ => {
            let rle = compress_to_rle(&bytes, transparent);
            (false, rle, bytes)
        }
    };
    Ok((local_id, is_empty, rle, rgba))
}

fn build_extract_response(
    things: Vec<ThingType>,
    sprites: Vec<(u32, Vec<u8>)>,
    transparent: bool,
) -> Result<tauri::ipc::Response, String> {
    let mut result = Vec::new();
    result.extend_from_slice(&(things.len() as u32).to_le_bytes());
    for t in &things {
        let json = serde_json::to_vec(t).map_err(|e| format!("JSON serialize error: {}", e))?;
        result.extend_from_slice(&(json.len() as u32).to_le_bytes());
        result.extend_from_slice(&json);
    }
    let sprite_data: Vec<SpriteData> = sprites
        .into_iter()
        .map(|(id, rgba)| SpriteData {
            id,
            is_empty: false,
            compressed_pixels: compress_to_rle(&rgba, transparent),
        })
        .collect();
    let buf = SprManager::pack_sprites_rgba_lz4(sprite_data, transparent);
    result.extend_from_slice(&buf);
    Ok(tauri::ipc::Response::new(result))
}

#[tauri::command]
fn export_pack_bin(request: tauri::ipc::Request) -> Result<(), String> {
    use std::collections::HashMap;

    let bytes = match request.body() {
        tauri::ipc::InvokeBody::Raw(b) => b.as_slice(),
        _ => return Err("export_pack_bin expects a raw binary payload".to_string()),
    };

    let mut r = Reader::new(bytes);
    let mode = r.u8()?;
    let out_path = r.string()?;
    let append_path = r.string()?;
    let client_version = r.u16()?;
    let flags = r.u8()?;
    let transparent = flags & pack::FLAG_TRANSPARENCY != 0;

    let thing_count = r.u32()? as usize;
    let mut entries = Vec::with_capacity(thing_count);
    for _ in 0..thing_count {
        let category = r.u8()?;
        let name = r.string()?;
        let thing_len = r.u32()? as usize;
        let thing_bytes = r.take(thing_len)?;
        let mut tr = Reader::new(thing_bytes);
        let thing = read_thing(&mut tr, transfer_category_label(category))?;
        entries.push(pack::PackEntryInput { category, name, thing });
    }

    let sprite_count = r.u32()? as usize;
    let mut sprites: HashMap<u32, pack::SpriteInput> = HashMap::with_capacity(sprite_count);
    for _ in 0..sprite_count {
        let (local_id, is_empty, rle, rgba) = read_sprite_rgba(&mut r, transparent)?;
        sprites.insert(local_id, pack::SpriteInput { is_empty, rle, rgba });
    }

    let append = if mode == 1 && !append_path.is_empty() {
        Some(append_path.as_str())
    } else {
        None
    };

    pack::write_pack(&out_path, append, client_version, flags, entries, &sprites)
}

#[tauri::command]
fn export_obd_bin(request: tauri::ipc::Request) -> Result<(), String> {
    use std::collections::HashMap;

    let bytes = match request.body() {
        tauri::ipc::InvokeBody::Raw(b) => b.as_slice(),
        _ => return Err("export_obd_bin expects a raw binary payload".to_string()),
    };

    let mut r = Reader::new(bytes);
    let out_path = r.string()?;
    let client_version = r.u16()?;
    let flags = r.u8()?;
    let transparent = flags & pack::FLAG_TRANSPARENCY != 0;
    let category = r.u8()?;
    let thing_len = r.u32()? as usize;
    let thing_bytes = r.take(thing_len)?;
    let mut tr = Reader::new(thing_bytes);
    let thing = read_thing(&mut tr, transfer_category_label(category))?;

    let sprite_count = r.u32()? as usize;
    let mut rgba_by_id: HashMap<u32, Vec<u8>> = HashMap::with_capacity(sprite_count);
    for _ in 0..sprite_count {
        let (local_id, _is_empty, _rle, rgba) = read_sprite_rgba(&mut r, transparent)?;
        rgba_by_id.insert(local_id, rgba);
    }

    let encoded = obd::encode_obd_v3(client_version, &thing, &rgba_by_id)?;
    fs::write(&out_path, &encoded).map_err(|e| format!("Failed to write OBD: {}", e))?;
    Ok(())
}

fn read_file_list(r: &mut Reader) -> Result<Vec<Vec<u8>>, String> {
    let count = r.u32()? as usize;
    let mut files = Vec::with_capacity(count);
    for _ in 0..count {
        let len = r.u32()? as usize;
        files.push(r.take(len)?.to_vec());
    }
    Ok(files)
}

#[tauri::command]
fn extract_obd_bin(request: tauri::ipc::Request) -> Result<tauri::ipc::Response, String> {
    use std::collections::HashMap;

    let bytes = match request.body() {
        tauri::ipc::InvokeBody::Raw(b) => b.as_slice(),
        _ => return Err("extract_obd_bin expects a raw binary payload".to_string()),
    };

    let mut r = Reader::new(bytes);
    let flags = r.u8()?;
    let transparent = flags & pack::FLAG_TRANSPARENCY != 0;
    let base_sprite_id = r.u32()?;
    let files = read_file_list(&mut r)?;

    let mut next_id = base_sprite_id;
    let mut hash_to_new: HashMap<u64, u32> = HashMap::new();
    let mut sprites: Vec<(u32, Vec<u8>)> = Vec::new();
    let mut things: Vec<ThingType> = Vec::new();

    for file_bytes in &files {
        let obj = obd::decode_obd(file_bytes)?;

        let mut rgba_by_id: HashMap<u32, Vec<u8>> = HashMap::new();
        for s in &obj.sprites {
            rgba_by_id.insert(s.id, s.rgba.clone());
        }

        let mut id_map: HashMap<u32, u32> = HashMap::new();
        let mut remap = |obd_id: u32| -> u32 {
            if obd_id == 0 {
                return 0;
            }
            if let Some(&id) = id_map.get(&obd_id) {
                return id;
            }
            let rgba = rgba_by_id.get(&obd_id).cloned().unwrap_or_else(|| vec![0u8; 4096]);
            let hash = {
                let mut h: u64 = 0xcbf2_9ce4_8422_2325;
                for &b in &rgba {
                    h ^= b as u64;
                    h = h.wrapping_mul(0x0000_0100_0000_01b3);
                }
                h
            };
            let new_id = if let Some(&existing) = hash_to_new.get(&hash) {
                existing
            } else {
                let id = next_id;
                next_id += 1;
                hash_to_new.insert(hash, id);
                sprites.push((id, rgba));
                id
            };
            id_map.insert(obd_id, new_id);
            new_id
        };

        let mut thing = obj.thing.clone();
        thing.sprite_index = thing.sprite_index.iter().map(|&id| remap(id)).collect();
        if let Some(fgs) = thing.frame_groups_data.as_mut() {
            for fg in fgs.iter_mut() {
                fg.sprite_index = fg.sprite_index.iter().map(|&id| remap(id)).collect();
            }
        }
        things.push(thing);
    }

    build_extract_response(things, sprites, transparent)
}


fn obd_is_file(p: &Path) -> bool {
	p.extension()
		.and_then(|e| e.to_str())
		.map(|e| e.eq_ignore_ascii_case("obd"))
		.unwrap_or(false)
}

fn obd_collect_dir(dir: &Path, recursive: bool, out: &mut Vec<String>) {
	if let Ok(rd) = std::fs::read_dir(dir) {
		for entry in rd.flatten() {
			let path = entry.path();
			if path.is_dir() {
				if recursive {
					obd_collect_dir(&path, recursive, out);
				}
			} else if obd_is_file(&path) {
				if let Some(s) = path.to_str() {
					out.push(s.to_string());
				}
			}
		}
	}
}

fn obd_collect_files(paths: &[String], recursive: bool) -> Vec<String> {
	let mut out = Vec::new();
	for p in paths {
		let pb = Path::new(p);
		if pb.is_dir() {
			obd_collect_dir(pb, recursive, &mut out);
		} else if obd_is_file(pb) {
			out.push(p.clone());
		}
	}
	out
}


#[derive(Clone, Serialize)]
struct ImportProgress {
	job: u64,
	done: usize,
	total: usize,
	#[serde(rename = "elapsedMs")]
	elapsed_ms: u64,
}

#[derive(Clone, Serialize)]
struct ImportDone {
	job: u64,
	done: usize,
	total: usize,
	duplicates: usize,
	#[serde(rename = "elapsedMs")]
	elapsed_ms: u64,
}

#[derive(Serialize)]
struct ImportStats {
	status: u8,
	done: usize,
	total: usize,
	duplicates: usize,
	item: usize,
	outfit: usize,
	effect: usize,
	missile: usize,
	#[serde(rename = "elapsedMs")]
	elapsed_ms: u64,
}

fn collect_thing_ids(thing: &ThingType) -> Vec<u32> {
	let mut ids = thing.sprite_index.clone();
	if let Some(fgs) = &thing.frame_groups_data {
		for fg in fgs {
			ids.extend_from_slice(&fg.sprite_index);
		}
	}
	ids
}

fn import_record_obd(locator: u32, obj: &obd::ObdObject) -> ImportRecord {
	use std::collections::HashMap;
	let mut m: HashMap<u32, &Vec<u8>> = HashMap::new();
	for s in &obj.sprites {
		m.insert(s.id, &s.rgba);
	}
	let ids = collect_thing_ids(&obj.thing);
	let hash = thing_pixel_hash(ids.iter().copied(), |id| m.get(&id).map(|v| v.as_slice()));
	ImportRecord {
		category: transfer_category_value(&obj.thing.category),
		source_id: obj.thing.id,
		name: obj.thing.market_name.clone(),
		thumb_w: (obj.thing.width as u16) * 32,
		thumb_h: (obj.thing.height as u16) * 32,
		frames: obj.thing.frames,
		sprite_count: obj.sprites.len() as u32,
		content_hash: hash,
		locator,
	}
}

fn import_record_sfp(locator: u32, entry: &pack::StoredEntry, pool: &[pack::PoolSprite], transparent: bool) -> ImportRecord {
	use std::collections::HashMap;
	let ids = collect_thing_ids(&entry.thing);
	let mut cache: HashMap<u32, Vec<u8>> = HashMap::new();
	for &id in &ids {
		if id != 0 && !cache.contains_key(&id) {
			if let Some(p) = pool.get((id - 1) as usize) {
				cache.insert(id, pack::pool_rgba(p, transparent));
			}
		}
	}
	let hash = thing_pixel_hash(ids.iter().copied(), |id| cache.get(&id).map(|v| v.as_slice()));
	ImportRecord {
		category: entry.category,
		source_id: entry.thing.id,
		name: entry.name.clone(),
		thumb_w: (entry.thing.width as u16) * 32,
		thumb_h: (entry.thing.height as u16) * 32,
		frames: entry.thing.frames,
		sprite_count: pack::count_entry_sprites(&entry.thing),
		content_hash: hash,
		locator,
	}
}

fn push_thumb(out: &mut Vec<u8>, i: usize, w: u16, h: u16, thumb: &[u8]) {
	out.extend_from_slice(&(i as u32).to_le_bytes());
	out.extend_from_slice(&w.to_le_bytes());
	out.extend_from_slice(&h.to_le_bytes());
	out.extend_from_slice(&(thumb.len() as u32).to_le_bytes());
	out.extend_from_slice(thumb);
}

fn remap_pool(
	pool_id: u32,
	next_id: &mut u32,
	map: &mut std::collections::HashMap<u32, u32>,
	sprites: &mut Vec<(u32, Vec<u8>)>,
	pool: &[pack::PoolSprite],
	transparent: bool,
) -> u32 {
	if pool_id == 0 || (pool_id as usize) > pool.len() {
		return 0;
	}
	if let Some(&id) = map.get(&pool_id) {
		return id;
	}
	let id = *next_id;
	*next_id += 1;
	map.insert(pool_id, id);
	sprites.push((id, pack::pool_rgba(&pool[(pool_id - 1) as usize], transparent)));
	id
}

#[tauri::command]
fn import_open_obd(
	app: tauri::AppHandle,
	store: tauri::State<ImportStoreState>,
	paths: Vec<String>,
	recursive: bool,
) -> Result<usize, String> {
	use rayon::prelude::*;
	use tauri::Emitter;

	let files = obd_collect_files(&paths, recursive);
	let total = files.len();
	let job = store.lock().unwrap().begin(total, ImportSrc::Obd(files.clone()), false);
	let store_arc = store.inner().clone();

	std::thread::spawn(move || {
		files.par_chunks(512).enumerate().for_each(|(ci, chunk)| {
			if store_arc.lock().unwrap().job != job {
				return;
			}
			let mut recs = Vec::with_capacity(chunk.len());
			for (k, path) in chunk.iter().enumerate() {
				let locator = (ci * 512 + k) as u32;
				if let Ok(bytes) = std::fs::read(path) {
					if let Ok(obj) = obd::decode_obd(&bytes) {
						recs.push(import_record_obd(locator, &obj));
					}
				}
			}
			let (done, total, elapsed, alive) = {
				let mut s = store_arc.lock().unwrap();
				let alive = s.extend(job, chunk.len(), recs);
				(s.done, s.total, s.elapsed_ms(), alive)
			};
			if alive {
				let _ = app.emit("import_progress", ImportProgress { job, done, total, elapsed_ms: elapsed });
			}
		});

		let payload = {
			let mut s = store_arc.lock().unwrap();
			if s.job == job {
				s.records.sort_by_key(|r| r.locator);
				s.finish(job);
				Some(ImportDone {
					job,
					done: s.done,
					total: s.total,
					duplicates: s.duplicate_count(),
					elapsed_ms: s.elapsed_ms(),
				})
			} else {
				None
			}
		};
		if let Some(p) = payload {
			let _ = app.emit("import_done", p);
		}
	});

	Ok(total)
}

#[tauri::command]
fn import_open_sfp(app: tauri::AppHandle, store: tauri::State<ImportStoreState>, path: String) -> Result<(), String> {
	use tauri::Emitter;

	let job = store.lock().unwrap().begin_parsing();
	let store_arc = store.inner().clone();

	std::thread::spawn(move || {
		let parsed = (|| -> Result<(ImportSrc, Vec<ImportRecord>, bool), String> {
			let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
			let data = pack::read_pack(&bytes)?;
			let transparent = data.flags & pack::FLAG_TRANSPARENCY != 0;
			let mut recs = Vec::with_capacity(data.entries.len());
			for (i, e) in data.entries.iter().enumerate() {
				recs.push(import_record_sfp(i as u32, e, &data.pool, transparent));
			}
			Ok((ImportSrc::Sfp(Box::new(data)), recs, transparent))
		})();

		if let Ok((src, recs, transparent)) = parsed {
			let payload = {
				let mut s = store_arc.lock().unwrap();
				if s.install(job, recs, src, transparent) {
					Some(ImportDone {
						job,
						done: s.done,
						total: s.total,
						duplicates: s.duplicate_count(),
						elapsed_ms: s.elapsed_ms(),
					})
				} else {
					None
				}
			};
			if let Some(p) = payload {
				let _ = app.emit("import_done", p);
			}
		} else {
			let mut s = store_arc.lock().unwrap();
			if s.job == job {
				s.finish(job);
			}
		}
	});

	Ok(())
}

#[tauri::command]
fn import_query(store: tauri::State<ImportStoreState>, request: tauri::ipc::Request) -> Result<tauri::ipc::Response, String> {
	let body = match request.body() {
		tauri::ipc::InvokeBody::Raw(b) => b.as_slice(),
		_ => return Err("import_query expects a raw binary payload".to_string()),
	};
	let mut r = Reader::new(body);
	let category = r.u8()?;
	let dup_only = r.u8()? != 0;
	let offset = r.u32()? as usize;
	let limit = r.u32()? as usize;
	let search_len = r.u16()? as usize;
	let search = String::from_utf8_lossy(r.take(search_len)?).to_lowercase();

	let s = store.lock().unwrap();
	let matches = |rec: &ImportRecord| -> bool {
		if category != 0 && rec.category != category {
			return false;
		}
		if dup_only && !s.is_dup(rec.content_hash) {
			return false;
		}
		if !search.is_empty() {
			let by_name = rec.name.to_lowercase().contains(&search);
			let by_id = rec.source_id.to_string().contains(&search);
			if !by_name && !by_id {
				return false;
			}
		}
		true
	};

	let mut matched: Vec<usize> = Vec::new();
	for (i, rec) in s.records.iter().enumerate() {
		if matches(rec) {
			matched.push(i);
		}
	}
	let total_matched = matched.len();

	let mut out = Vec::new();
	out.push(s.status.code());
	out.extend_from_slice(&(total_matched as u32).to_le_bytes());
	let mut count = 0u32;
	let mut rows = Vec::new();
	for &i in matched.iter().skip(offset).take(limit) {
		let rec = &s.records[i];
		rows.extend_from_slice(&(i as u32).to_le_bytes());
		rows.push(rec.category);
		rows.extend_from_slice(&rec.source_id.to_le_bytes());
		rows.extend_from_slice(&rec.thumb_w.to_le_bytes());
		rows.extend_from_slice(&rec.thumb_h.to_le_bytes());
		rows.push(rec.frames);
		rows.extend_from_slice(&rec.sprite_count.to_le_bytes());
		rows.push(if s.is_dup(rec.content_hash) { 1 } else { 0 });
		let name = rec.name.as_bytes();
		rows.extend_from_slice(&(name.len() as u16).to_le_bytes());
		rows.extend_from_slice(name);
		count += 1;
	}
	out.extend_from_slice(&count.to_le_bytes());
	out.extend_from_slice(&rows);

	Ok(tauri::ipc::Response::new(out))
}

#[tauri::command]
fn import_thumbs(store: tauri::State<ImportStoreState>, request: tauri::ipc::Request) -> Result<tauri::ipc::Response, String> {
	use std::collections::HashMap;

	let body = match request.body() {
		tauri::ipc::InvokeBody::Raw(b) => b.as_slice(),
		_ => return Err("import_thumbs expects a raw binary payload".to_string()),
	};
	let mut r = Reader::new(body);
	let count = r.u32()? as usize;
	let mut indices = Vec::with_capacity(count);
	for _ in 0..count {
		indices.push(r.u32()? as usize);
	}

	let mut out = Vec::new();
	out.extend_from_slice(&(indices.len() as u32).to_le_bytes());

	let s = store.lock().unwrap();
	match &s.src {
		ImportSrc::Sfp(data) => {
			for &i in &indices {
				let mut w = 0u16;
				let mut h = 0u16;
				let mut thumb: Vec<u8> = Vec::new();
				if let Some(rec) = s.records.get(i) {
					if let Some(entry) = data.entries.get(rec.locator as usize) {
						let ids = collect_thing_ids(&entry.thing);
						let mut m: HashMap<u32, Vec<u8>> = HashMap::new();
						for id in ids {
							if id != 0 && !m.contains_key(&id) {
								if let Some(p) = data.pool.get((id - 1) as usize) {
									m.insert(id, pack::pool_rgba(p, s.transparent));
								}
							}
						}
						let (tw, th, t) = pack::render_thing_thumb(&entry.thing, &m);
						w = tw;
						h = th;
						thumb = t;
					}
				}
				push_thumb(&mut out, i, w, h, &thumb);
			}
		}
		ImportSrc::Obd(paths) => {
			let pairs: Vec<(usize, Option<String>)> = indices
				.iter()
				.map(|&i| (i, s.records.get(i).and_then(|r| paths.get(r.locator as usize)).cloned()))
				.collect();
			drop(s);
			for (i, path) in pairs {
				let mut w = 0u16;
				let mut h = 0u16;
				let mut thumb: Vec<u8> = Vec::new();
				if let Some(path) = path {
					if let Ok(bytes) = std::fs::read(&path) {
						if let Ok(obj) = obd::decode_obd(&bytes) {
							let mut m: HashMap<u32, Vec<u8>> = HashMap::new();
							for sp in &obj.sprites {
								m.insert(sp.id, sp.rgba.clone());
							}
							let (tw, th, t) = pack::render_thing_thumb(&obj.thing, &m);
							w = tw;
							h = th;
							thumb = t;
						}
					}
				}
				push_thumb(&mut out, i, w, h, &thumb);
			}
		}
		ImportSrc::None => {}
	}

	Ok(tauri::ipc::Response::new(out))
}

#[tauri::command]
fn import_extract(store: tauri::State<ImportStoreState>, request: tauri::ipc::Request) -> Result<tauri::ipc::Response, String> {
	use std::collections::HashMap;

	let body = match request.body() {
		tauri::ipc::InvokeBody::Raw(b) => b.as_slice(),
		_ => return Err("import_extract expects a raw binary payload".to_string()),
	};
	let mut r = Reader::new(body);
	let project_transparent = r.u8()? != 0;
	let base = r.u32()?;
	let n = r.u32()? as usize;
	let mut indices = Vec::with_capacity(n);
	for _ in 0..n {
		indices.push(r.u32()? as usize);
	}

	let s = store.lock().unwrap();
	let transparent = s.transparent;

	match &s.src {
		ImportSrc::Sfp(data) => {
			let mut next_id = base;
			let mut pool_to_new: HashMap<u32, u32> = HashMap::new();
			let mut sprites: Vec<(u32, Vec<u8>)> = Vec::new();
			let mut things: Vec<ThingType> = Vec::new();

			for &i in &indices {
				let rec = match s.records.get(i) {
					Some(r) => r,
					None => continue,
				};
				let entry = match data.entries.get(rec.locator as usize) {
					Some(e) => e,
					None => continue,
				};
				let mut thing = entry.thing.clone();
				thing.sprite_index = thing
					.sprite_index
					.iter()
					.map(|&p| remap_pool(p, &mut next_id, &mut pool_to_new, &mut sprites, &data.pool, transparent))
					.collect();
				if let Some(fgs) = thing.frame_groups_data.as_mut() {
					for fg in fgs.iter_mut() {
						fg.sprite_index = fg
							.sprite_index
							.iter()
							.map(|&p| remap_pool(p, &mut next_id, &mut pool_to_new, &mut sprites, &data.pool, transparent))
							.collect();
					}
				}
				things.push(thing);
			}
			build_extract_response(things, sprites, project_transparent)
		}
		ImportSrc::Obd(paths) => {
			let sel: Vec<String> = indices
				.iter()
				.filter_map(|&i| s.records.get(i).and_then(|r| paths.get(r.locator as usize)).cloned())
				.collect();
			drop(s);

			let mut next_id = base;
			let mut hash_to_new: HashMap<u64, u32> = HashMap::new();
			let mut sprites: Vec<(u32, Vec<u8>)> = Vec::new();
			let mut things: Vec<ThingType> = Vec::new();

			for path in &sel {
				let bytes = std::fs::read(path).map_err(|e| e.to_string())?;
				let obj = obd::decode_obd(&bytes)?;

				let mut rgba_by_id: HashMap<u32, Vec<u8>> = HashMap::new();
				for sp in &obj.sprites {
					rgba_by_id.insert(sp.id, sp.rgba.clone());
				}

				let mut id_map: HashMap<u32, u32> = HashMap::new();
				let mut remap = |obd_id: u32| -> u32 {
					if obd_id == 0 {
						return 0;
					}
					if let Some(&id) = id_map.get(&obd_id) {
						return id;
					}
					let rgba = rgba_by_id.get(&obd_id).cloned().unwrap_or_else(|| vec![0u8; 4096]);
					let hash = {
						let mut h: u64 = 0xcbf2_9ce4_8422_2325;
						for &b in &rgba {
							h ^= b as u64;
							h = h.wrapping_mul(0x0000_0100_0000_01b3);
						}
						h
					};
					let new_id = if let Some(&existing) = hash_to_new.get(&hash) {
						existing
					} else {
						let id = next_id;
						next_id += 1;
						hash_to_new.insert(hash, id);
						sprites.push((id, rgba));
						id
					};
					id_map.insert(obd_id, new_id);
					new_id
				};

				let mut thing = obj.thing.clone();
				thing.sprite_index = thing.sprite_index.iter().map(|&id| remap(id)).collect();
				if let Some(fgs) = thing.frame_groups_data.as_mut() {
					for fg in fgs.iter_mut() {
						fg.sprite_index = fg.sprite_index.iter().map(|&id| remap(id)).collect();
					}
				}
				things.push(thing);
			}
			build_extract_response(things, sprites, project_transparent)
		}
		ImportSrc::None => Err("no import source loaded".to_string()),
	}
}

#[tauri::command]
fn import_dup_indices(store: tauri::State<ImportStoreState>) -> Vec<u32> {
	use std::collections::HashSet;
	let s = store.lock().unwrap();
	let mut seen: HashSet<u64> = HashSet::new();
	let mut out = Vec::new();
	for (i, rec) in s.records.iter().enumerate() {
		if !s.is_dup(rec.content_hash) {
			continue;
		}
		if seen.insert(rec.content_hash) {
			continue;
		}
		out.push(i as u32);
	}
	out
}

#[tauri::command]
fn import_stats(store: tauri::State<ImportStoreState>) -> ImportStats {
	let s = store.lock().unwrap();
	let mut item = 0;
	let mut outfit = 0;
	let mut effect = 0;
	let mut missile = 0;
	for rec in &s.records {
		match rec.category {
			1 => item += 1,
			2 => outfit += 1,
			3 => effect += 1,
			4 => missile += 1,
			_ => {}
		}
	}
	ImportStats {
		status: s.status.code(),
		done: s.done,
		total: s.total,
		duplicates: s.duplicate_count(),
		item,
		outfit,
		effect,
		missile,
		elapsed_ms: s.elapsed_ms(),
	}
}

#[tauri::command]
fn import_clear(store: tauri::State<ImportStoreState>) {
	store.lock().unwrap().clear();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let spr_manager: SprManagerState = Arc::new(Mutex::new(SprManager::new()));

    let dat_manager: DatManagerState = Arc::new(Mutex::new(DatManager::new()));

    let import_store: ImportStoreState = Arc::new(Mutex::new(ImportStore::new()));

    let format_manager: FormatManagerState = {
        #[cfg(feature = "tibia")]
        {
            Arc::new(Mutex::new(formats::FormatManager::new(
                Box::new(formats::tibia::TibiaSpriteProvider::new()),
                Box::new(formats::tibia::TibiaMetadataProvider::new()),
            )))
        }
        #[cfg(not(feature = "tibia"))]
        {
            compile_error!("At least one format feature must be enabled (e.g. 'tibia')");
        }
    };

    let active_project = project::resolve_active();
    match &active_project {
        Some(p) => logger::log("INFO", &format!("Project '{}' at {}", p.manifest.id, p.root.display())),
        None => logger::log("INFO", "No project open"),
    }

    let lua_host: LuaState = {
        let mut h = LuaHost::new(active_project.as_ref().and_then(|p| p.scripts_dir()));
        if let Err(e) = h.load_all() {
            logger::log("WARN", &format!("Lua scripts not loaded: {}", e));
            h.last_error = Some(e);
        } else {
            logger::log("INFO", &format!("Loaded {} Lua script(s)", h.loaded));
        }
        Arc::new(Mutex::new(h))
    };

    let project_state: ProjectState = Arc::new(Mutex::new(active_project));

    let forge_assets: ForgeAssetsState = Arc::new(Mutex::new(None));
    let forge_things: ForgeThingsState = Arc::new(Mutex::new(Vec::new()));
    let forge_items: ForgeItemsState = Arc::new(Mutex::new(lua_format::ItemDb::default()));

    logger::session_start();

    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init());

    #[cfg(debug_assertions)]
    {
        builder = builder.plugin(tauri_plugin_mcp_bridge::init_with_config(
            tauri_plugin_mcp_bridge::Config { base_port: 9623, ..Default::default() },
        ));
    }

    builder
        .register_asynchronous_uri_scheme_protocol(
            sprite_protocol::SCHEME,
            sprite_protocol::handle,
        )
        .manage(spr_manager)
        .manage(dat_manager)
        .manage(format_manager)
        .manage(import_store)
        .manage(lua_host)
        .manage(project_state)
        .manage(forge_assets)
        .manage(forge_things)
        .manage(forge_items)
        .invoke_handler(tauri::generate_handler![
            read_file,
            read_file_text,
            write_file_text,
            read_file_header,
            open_spr_file,
            close_spr_file,
            read_sprites_rgba,
            read_sprites_batch_rgba,
            read_sprites_rgba_lz4,
            compress_sprite_rgba,
            logger::log_message,
            logger::get_log_path,
            logger::read_log,
            logger::clear_log,
            list_directory,
            list_drives,
            get_home_dir,
            get_system_directories,
            check_files_exist,
            get_config,
            save_config,
            get_last_folder,
            set_last_folder,
            get_favorite_folders,
            set_favorite_folders,
            get_panel_settings,
            set_panel_settings,
            get_item_list_view_mode,
            set_item_list_view_mode,
            get_sprite_list_view_mode,
            set_sprite_list_view_mode,
            get_find_list_view_mode,
            set_find_list_view_mode,
            get_general_settings,
            set_general_settings,
            backup_file,
            get_config_dir_path,
            ensure_versions_dir,
            write_json_file,
            delete_file,
            clear_versions_dir,
            list_versions_dir,
            read_sprites_compressed_raw,
            save_scene,
            list_scenes,
            load_scene,
            delete_scene,
            save_template,
            list_templates,
            delete_template,
            cache_template_sheet,
            write_dat_bin,
            update_spr_sprites_bin,
            copy_spr_file_with_mods,
            parse_dat_file_bin,
            search_things_bin,
            find_similar_bin,
            clear_dat_data,
            write_sprite_png,
            read_sprite_png,
            optimize_sprites_rust,
            apply_optimization,
            export_object_sheet_rust,
            import_object_sheet_binary,
            export_pack_bin,
            export_obd_bin,
            extract_obd_bin,
            read_otb_file,
            write_otb_file,
            import_open_obd,
            import_open_sfp,
            import_query,
            import_thumbs,
            import_extract,
            import_dup_indices,
            import_stats,
            import_clear,
            set_window_acrylic,
            lua_host::list_scripts,
            lua_host::open_scripts_dir,
            lua_host::read_script,
            lua_host::write_script,
            lua_host::reload_scripts,
            project::project_active,
            project::project_open,
            project::project_close,
            project::project_recents,
            project::project_clear_recents,
            project::project_state_get,
            project::project_state_set,
            lua_bridge::forge_ui_config,
            lua_bridge::forge_server_profiles,
            lua_bridge::forge_app_config,
            lua_bridge::registered_formats,
            lua_bridge::forge_list_formats,
            lua_ui::forge_panels,
            lua_ui::forge_panel_list,
            lua_ui::forge_dispatch,
            lua_ui::forge_command,
            lua_format::forge_load_assets,
            lua_format::forge_load_itemdb,
            lua_format::forge_read_sprites,
            lua_format::forge_things,
            lua_format::forge_item_name,
            lua_format::forge_item_names,
            lua_format::forge_items,
            lua_format::forge_client_id,
            lua_format::forge_server_id,
            lua_format::forge_item_sprite,
            lua_format::forge_save_assets,
            lua_format::forge_set_sprites,
            lua_format::forge_save_itemdb,
            lua_format::forge_list_tools,
            lua_format::forge_run_tool
        ])
        .setup(move |app| {
            #[cfg(target_os = "macos")]
            {
                use tauri::{Manager, Listener};
                use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};

                if let Some(window) = app.get_webview_window("main") {
                    let _ = apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, Some(12.0));
                }

                let app_handle = app.handle().clone();
                app.listen("tauri://webview-created", move |_event| {
                    if let Some(window) = app_handle.get_webview_window("find") {
                        let _ = apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, Some(12.0));
                    }
                });
            }

            #[cfg(target_os = "windows")]
            {
                use tauri::Manager;

                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_shadow(true);
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
