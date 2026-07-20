use std::io::{Read, Write};

use flate2::read::ZlibDecoder;
use mlua::{Lua, Table};
use tauri::State;

use crate::lua_host::LuaState;

pub fn register(lua: &Lua) -> mlua::Result<()> {
    let forge: Table = lua.globals().get("forge")?;
    forge.set("_formats", lua.create_table()?)?;

    forge.set(
        "register_format",
        lua.create_function(|lua, t: Table| {
            let ext: String = t.get("ext")?;
            let forge: Table = lua.globals().get("forge")?;
            let formats: Table = forge.get("_formats")?;
            formats.set(ext.to_lowercase(), t)?;
            Ok(())
        })?,
    )?;

    forge.set(
        "inflate",
        lua.create_function(|lua, (data, orig_len): (mlua::String, usize)| {
            let comp = data.as_bytes();
            let mut out = Vec::with_capacity(orig_len);
            ZlibDecoder::new(&comp[..]).read_to_end(&mut out).map_err(mlua::Error::external)?;
            lua.create_string(&out)
        })?,
    )?;

    forge.set(
        "deflate",
        lua.create_function(|lua, data: mlua::String| {
            use flate2::write::ZlibEncoder;
            use flate2::Compression;
            let mut e = ZlibEncoder::new(Vec::new(), Compression::default());
            e.write_all(&data.as_bytes()).map_err(mlua::Error::external)?;
            let out = e.finish().map_err(mlua::Error::external)?;
            lua.create_string(&out)
        })?,
    )?;

    crate::lua_format::register_builders(lua)?;
    crate::lua_ui::install(lua)?;

    Ok(())
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LuaUiConfig {
    pub client_versions: bool,
}

fn read_ui_config(lua: &Lua) -> LuaUiConfig {
    let mut cfg = LuaUiConfig { client_versions: true };
    let Ok(forge) = lua.globals().get::<Table>("forge") else {
        return cfg;
    };
    let Ok(ui) = forge.get::<Table>("ui") else {
        return cfg;
    };
    if let Ok(cv) = ui.get::<bool>("client_versions") {
        cfg.client_versions = cv;
    }
    cfg
}

#[tauri::command]
pub fn forge_ui_config(lua_state: State<LuaState>) -> Result<LuaUiConfig, String> {
    let guard = lua_state.lock().map_err(|e| e.to_string())?;
    Ok(read_ui_config(&guard.lua))
}

#[derive(Default, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LuaAppConfig {
    pub name: Option<String>,
}

fn read_app_config(lua: &Lua) -> LuaAppConfig {
    let mut cfg = LuaAppConfig::default();
    let Ok(forge) = lua.globals().get::<Table>("forge") else {
        return cfg;
    };
    let Ok(app) = forge.get::<Table>("app") else {
        return cfg;
    };
    if let Ok(name) = app.get::<String>("name") {
        if !name.is_empty() {
            cfg.name = Some(name);
        }
    }
    cfg
}

#[tauri::command]
pub fn forge_app_config(lua_state: State<LuaState>) -> Result<LuaAppConfig, String> {
    let guard = lua_state.lock().map_err(|e| e.to_string())?;
    Ok(read_app_config(&guard.lua))
}

#[tauri::command]
pub fn registered_formats(lua_state: State<LuaState>) -> Result<Vec<(String, String, String)>, String> {
    let guard = lua_state.lock().map_err(|e| e.to_string())?;
    let forge: Table = guard.lua.globals().get("forge").map_err(|e| e.to_string())?;
    let formats: Table = forge.get("_formats").map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for pair in formats.pairs::<String, Table>() {
        let (ext, t) = pair.map_err(|e| e.to_string())?;
        let name: String = t.get("name").unwrap_or_else(|_| ext.clone());
        let kind: String = t.get("kind").unwrap_or_else(|_| "assets".to_string());
        out.push((ext, name, kind));
    }
    Ok(out)
}

fn lua_value_to_json(value: mlua::Value) -> serde_json::Value {
    use serde_json::Value;
    match value {
        mlua::Value::Nil => Value::Null,
        mlua::Value::Boolean(b) => Value::Bool(b),
        mlua::Value::Integer(i) => Value::Number(i.into()),
        mlua::Value::Number(n) => serde_json::Number::from_f64(n).map(Value::Number).unwrap_or(Value::Null),
        mlua::Value::String(s) => Value::String(s.to_str().map(|c| c.to_string()).unwrap_or_default()),
        mlua::Value::Table(t) => {
            let is_array = t.clone().pairs::<mlua::Value, mlua::Value>().all(|p| matches!(p, Ok((mlua::Value::Integer(_), _))));
            let has_entries = t.clone().pairs::<mlua::Value, mlua::Value>().next().is_some();
            if is_array && has_entries {
                let mut arr = Vec::new();
                for pair in t.pairs::<i64, mlua::Value>() {
                    if let Ok((_, v)) = pair {
                        arr.push(lua_value_to_json(v));
                    }
                }
                Value::Array(arr)
            } else {
                let mut map = serde_json::Map::new();
                for pair in t.pairs::<String, mlua::Value>() {
                    if let Ok((k, v)) = pair {
                        map.insert(k, lua_value_to_json(v));
                    }
                }
                Value::Object(map)
            }
        }
        _ => Value::Null,
    }
}

#[tauri::command]
pub fn forge_list_formats(lua_state: State<LuaState>) -> Result<serde_json::Value, String> {
    let guard = lua_state.lock().map_err(|e| e.to_string())?;
    let forge: Table = guard.lua.globals().get("forge").map_err(|e| e.to_string())?;
    let formats: Table = forge.get("_formats").map_err(|e| e.to_string())?;
    let mut out: Vec<serde_json::Value> = Vec::new();
    for pair in formats.pairs::<String, Table>() {
        let (ext, t) = pair.map_err(|e| e.to_string())?;
        if let Ok(cfg) = t.get::<Table>("config") {
            let alpha_channel = t.get::<bool>("alpha_channel").unwrap_or(false);
            let mut json = lua_value_to_json(mlua::Value::Table(cfg));
            if let serde_json::Value::Object(ref mut map) = json {
                map.entry("ext".to_string()).or_insert(serde_json::Value::String(ext));
                map.insert("alpha_channel".to_string(), serde_json::Value::Bool(alpha_channel));
            }
            out.push(json);
        }
    }
    Ok(serde_json::Value::Array(out))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn host_with(src: &str) -> Lua {
        let lua = unsafe { Lua::unsafe_new() };
        lua.globals().set("forge", lua.create_table().unwrap()).unwrap();
        register(&lua).unwrap();
        lua.load(src).exec().unwrap();
        lua
    }

    #[test]
    fn register_format_lands_in_registry() {
        let lua = host_with(
            "forge.register_format{ ext='SPR', name='Tibia SPR', kind='sprites', read=function() end }",
        );
        let forge: Table = lua.globals().get("forge").unwrap();
        let formats: Table = forge.get("_formats").unwrap();
        let f: Table = formats.get("spr").unwrap();
        assert_eq!(f.get::<String>("name").unwrap(), "Tibia SPR");
    }

    #[test]
    fn inflate_roundtrips_deflate() {
        let lua = host_with("");
        let forge: Table = lua.globals().get("forge").unwrap();
        let deflate: mlua::Function = forge.get("deflate").unwrap();
        let inflate: mlua::Function = forge.get("inflate").unwrap();
        let original = b"forge plugin payload payload payload";
        let comp: mlua::String = deflate.call(lua.create_string(original).unwrap()).unwrap();
        let back: mlua::String = inflate.call((comp, original.len())).unwrap();
        assert_eq!(&back.as_bytes()[..], &original[..]);
    }

    #[test]
    fn config_defaults_then_override() {
        let d = read_ui_config(&host_with(""));
        assert!(d.client_versions);
        let lua = host_with("forge.ui = { client_versions = false }\nforge.app = { name = 'Forge' }");
        assert!(!read_ui_config(&lua).client_versions);
        assert_eq!(read_app_config(&lua).name.as_deref(), Some("Forge"));
    }
}
