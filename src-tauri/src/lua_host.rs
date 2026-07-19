use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use mlua::Lua;
use tauri::State;

pub struct LuaHost {
    pub lua: Lua,
    pub dir: PathBuf,
    pub loaded: usize,
    pub last_error: Option<String>,
}

impl LuaHost {
    pub fn new(dir: PathBuf) -> Self {
        LuaHost { lua: unsafe { Lua::unsafe_new() }, dir, loaded: 0, last_error: None }
    }

    pub fn load_all(&mut self) -> Result<usize, String> {
        let lua = unsafe { Lua::unsafe_new() };
        let mut files: Vec<PathBuf> = std::fs::read_dir(&self.dir)
            .map_err(|e| format!("scripts dir {}: {}", self.dir.display(), e))?
            .filter_map(|e| e.ok().map(|e| e.path()))
            .filter(|p| p.extension().map_or(false, |x| x == "lua"))
            .collect();
        files.sort();
        lua.globals()
            .set("forge", lua.create_table().map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())?;
        crate::lua_bridge::register(&lua).map_err(|e| e.to_string())?;
        let mut count = 0usize;
        for f in &files {
            let src = std::fs::read_to_string(f).map_err(|e| format!("{}: {}", f.display(), e))?;
            let name = f.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
            lua.load(&src).set_name(name).exec().map_err(|e| format!("{}: {}", f.display(), e))?;
            count += 1;
        }
        self.lua = lua;
        self.loaded = count;
        self.last_error = None;
        Ok(count)
    }
}

pub type LuaState = Arc<Mutex<LuaHost>>;

pub fn scripts_dir() -> PathBuf {
    let candidates = [
        std::env::current_exe().ok().and_then(|e| e.parent().map(|p| p.join("scripts"))),
        Some(PathBuf::from("scripts")),
        Some(PathBuf::from("../scripts")),
    ];
    for c in candidates.into_iter().flatten() {
        if c.is_dir() {
            return c;
        }
    }
    PathBuf::from("scripts")
}

fn script_path(host: &LuaHost, name: &str) -> Result<PathBuf, String> {
    if name.is_empty() || name.contains('/') || name.contains('\\') || name.contains("..") || !name.ends_with(".lua") {
        return Err(format!("invalid script name: {}", name));
    }
    Ok(host.dir.join(name))
}

#[tauri::command]
pub fn list_scripts(lua: State<LuaState>) -> Result<Vec<String>, String> {
    let h = lua.lock().map_err(|e| e.to_string())?;
    let mut names: Vec<String> = std::fs::read_dir(&h.dir)
        .map_err(|e| format!("scripts dir {}: {}", h.dir.display(), e))?
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| p.extension().map_or(false, |x| x == "lua"))
        .filter_map(|p| p.file_name().map(|n| n.to_string_lossy().into_owned()))
        .collect();
    names.sort();
    Ok(names)
}

#[tauri::command]
pub fn read_script(name: String, lua: State<LuaState>) -> Result<String, String> {
    let h = lua.lock().map_err(|e| e.to_string())?;
    let path = script_path(&h, &name)?;
    std::fs::read_to_string(&path).map_err(|e| format!("{}: {}", path.display(), e))
}

#[tauri::command]
pub fn write_script(name: String, content: String, lua: State<LuaState>) -> Result<usize, String> {
    let mut h = lua.lock().map_err(|e| e.to_string())?;
    let path = script_path(&h, &name)?;
    std::fs::write(&path, content).map_err(|e| format!("{}: {}", path.display(), e))?;
    match h.load_all() {
        Ok(n) => Ok(n),
        Err(e) => {
            h.last_error = Some(e.clone());
            Err(e)
        }
    }
}

#[tauri::command]
pub fn open_scripts_dir(lua: State<LuaState>) -> Result<(), String> {
    let dir = {
        let h = lua.lock().map_err(|e| e.to_string())?;
        h.dir.clone()
    };
    std::fs::create_dir_all(&dir).map_err(|e| format!("{}: {}", dir.display(), e))?;
    let resolved = std::fs::canonicalize(&dir).unwrap_or(dir);
    let as_str = resolved.to_string_lossy();
    let clean = as_str.trim_start_matches(r"\\?\");
    tauri_plugin_opener::open_path(clean, None::<&str>).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn reload_scripts(dir: Option<String>, lua: State<LuaState>) -> Result<usize, String> {
    let mut h = lua.lock().map_err(|e| e.to_string())?;
    if let Some(d) = dir {
        h.dir = PathBuf::from(d);
    }
    match h.load_all() {
        Ok(n) => Ok(n),
        Err(e) => {
            h.last_error = Some(e.clone());
            Err(e)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deploy_scripts_load() {
        let dir = PathBuf::from("scripts");
        if !dir.is_dir() {
            return;
        }
        let mut h = LuaHost::new(dir);
        let n = h.load_all().expect("deploy scripts should load");
        assert!(n >= 1, "expected at least one deploy script");
    }

    #[test]
    fn host_runs_luajit_with_ffi() {
        let lua = unsafe { Lua::unsafe_new() };
        lua.globals().set("forge", lua.create_table().unwrap()).unwrap();
        crate::lua_bridge::register(&lua).unwrap();
        let has_jit: bool = lua.load("return jit ~= nil").eval().unwrap();
        assert!(has_jit, "luajit runtime expected");
        let has_ffi: bool = lua.load("return (pcall(require, 'ffi'))").eval().unwrap();
        assert!(has_ffi, "ffi library expected");
    }
}
