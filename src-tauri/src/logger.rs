use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;

use chrono::Local;

fn log_path() -> Option<PathBuf> {
    dirs::config_dir().map(|mut p| {
        p.push("sprite-forge");
        p.push("sprite-forge.log");
        p
    })
}

fn write_line(line: &str) {
    let Some(path) = log_path() else { return };
    if let Some(dir) = path.parent() {
        let _ = fs::create_dir_all(dir);
    }
    if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(&path) {
        let _ = writeln!(f, "{}", line);
    }
}

pub fn log(level: &str, message: &str) {
    let ts = Local::now().format("%Y-%m-%d %H:%M:%S");
    write_line(&format!("[{}] [{}] {}", ts, level, message));
}

pub fn session_start() {
    let ts = Local::now().format("%Y-%m-%d %H:%M:%S");
    write_line(&format!(
        "\n=== Sprite Forge {} started at {} ===",
        env!("CARGO_PKG_VERSION"),
        ts
    ));
}

#[tauri::command]
pub fn log_message(level: String, message: String) {
    log(&level, &message);
}

#[tauri::command]
pub fn get_log_path() -> Result<String, String> {
    log_path()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "Log path unavailable".to_string())
}

#[tauri::command]
pub fn read_log() -> Result<String, String> {
    let Some(path) = log_path() else {
        return Err("Log path unavailable".to_string());
    };
    if !path.exists() {
        return Ok(String::new());
    }
    fs::read_to_string(&path).map_err(|e| format!("Failed to read log: {}", e))
}

#[tauri::command]
pub fn clear_log() -> Result<(), String> {
    let Some(path) = log_path() else {
        return Err("Log path unavailable".to_string());
    };
    if path.exists() {
        fs::write(&path, "").map_err(|e| format!("Failed to clear log: {}", e))?;
    }
    Ok(())
}
