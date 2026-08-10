use std::cell::RefCell;
use std::collections::HashMap;
use std::ffi::c_void;
use std::io::Read;
use std::path::Path;
use std::sync::{Arc, Mutex};

use flate2::read::ZlibDecoder;
use mlua::{Function, LightUserData, Lua, Table};
use tauri::ipc::Response;
use tauri::State;

use crate::lua_host::LuaState;

const SPRITE_SIZE: u32 = 32;

#[derive(Clone, Debug, PartialEq, serde::Serialize, serde::Deserialize)]
#[serde(untagged)]
pub enum AttrValue {
    Bool(bool),
    Num(f64),
    Str(String),
}

#[derive(Clone, Default, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ThingDef {
    pub id: u32,
    pub category: String,
    pub width: u32,
    pub height: u32,
    pub layers: u32,
    pub frames: u32,
    pub pattern_x: u32,
    pub pattern_y: u32,
    pub pattern_z: u32,
    pub offset_x: u32,
    pub offset_y: u32,
    pub elevation: u32,
    pub ground_speed: u32,
    pub exact_size: u32,
    pub is_ground: bool,
    pub is_ground_border: bool,
    pub is_on_bottom: bool,
    pub is_on_top: bool,
    pub is_unpassable: bool,
    pub has_offset: bool,
    pub has_elevation: bool,
    pub sprite_index: Vec<u32>,
    pub attrs: HashMap<String, AttrValue>,
}

#[derive(Clone, Default, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ItemDef {
    pub name: String,
    pub group: u32,
    pub kind: u32,
    pub flags: u32,
    pub ground: bool,
    pub client: u32,
    pub attrs: HashMap<String, AttrValue>,
}

#[derive(Default)]
pub struct ItemDb {
    pub items: HashMap<u32, ItemDef>,
    pub server_to_client: HashMap<u32, u32>,
    pub client_to_server: HashMap<u32, u32>,
}

pub type ForgeThingsState = Arc<Mutex<Vec<ThingDef>>>;
pub type ForgeItemsState = Arc<Mutex<ItemDb>>;
pub type ForgeAssetsState = Arc<Mutex<Option<ScriptedAssets>>>;

struct Atlas {
    w: u32,
    h: u32,
    rgba: Vec<u8>,
}

struct Region {
    atlas_id: u16,
    x: u32,
    y: u32,
    w: u32,
    h: u32,
}

#[derive(Default)]
struct AssetsBuilder {
    atlases: HashMap<u16, Atlas>,
    sprites: HashMap<u32, Region>,
    item_map: HashMap<u32, u32>,
    client_map: HashMap<u32, u32>,
}

pub struct ScriptedAssets {
    atlases: HashMap<u16, Atlas>,
    sprites: HashMap<u32, Region>,
    item_map: HashMap<u32, u32>,
    client_map: HashMap<u32, u32>,
}

fn crop(atlas: &Atlas, r: &Region, ss: u32) -> Vec<u8> {
    let mut out = vec![0u8; (ss * ss * 4) as usize];
    if r.x >= atlas.w {
        return out;
    }
    let copy_w = r.w.min(ss).min(atlas.w - r.x);
    let copy_h = r.h.min(ss);
    for row in 0..copy_h {
        let sy = r.y + row;
        if sy >= atlas.h {
            break;
        }
        let src = (((sy * atlas.w) + r.x) * 4) as usize;
        let dst = (row * ss * 4) as usize;
        out[dst..dst + (copy_w * 4) as usize].copy_from_slice(&atlas.rgba[src..src + (copy_w * 4) as usize]);
    }
    out
}

impl ScriptedAssets {
    fn max_sprite_id(&self) -> u32 {
        self.sprites.keys().copied().max().unwrap_or(0)
    }

    fn pack(&self, ids: &[u32]) -> Vec<u8> {
        let ss = SPRITE_SIZE;
        let sds = (ss * ss * 4) as usize;
        let mut buf = Vec::with_capacity(4 + ids.len() * (9 + sds));
        buf.extend_from_slice(&(ids.len() as u32).to_le_bytes());
        for &id in ids {
            buf.extend_from_slice(&id.to_le_bytes());
            let rgba = self
                .sprites
                .get(&id)
                .and_then(|r| self.atlases.get(&r.atlas_id).map(|a| crop(a, r, ss)));
            match rgba {
                Some(px) => {
                    buf.push(0);
                    buf.extend_from_slice(&0u32.to_le_bytes());
                    buf.extend_from_slice(&px);
                }
                None => {
                    buf.push(1);
                    buf.extend_from_slice(&0u32.to_le_bytes());
                    buf.extend_from_slice(&vec![0u8; sds]);
                }
            }
        }
        buf
    }

    pub fn sprite_for_item(&self, item_id: u32) -> Option<u32> {
        self.item_map.get(&item_id).copied()
    }

    pub fn client_of(&self, server_id: u32) -> Option<u32> {
        self.client_map.get(&server_id).copied()
    }

    pub fn rgba(&self, id: u32) -> Option<Vec<u8>> {
        self.sprites
            .get(&id)
            .and_then(|r| self.atlases.get(&r.atlas_id).map(|a| crop(a, r, SPRITE_SIZE)))
    }
}

#[derive(Default)]
struct ItemDbBuilder {
    items: HashMap<u32, ItemDef>,
}

thread_local! {
    static ASSETS: RefCell<Option<AssetsBuilder>> = const { RefCell::new(None) };
    static THINGS: RefCell<Option<Vec<ThingDef>>> = const { RefCell::new(None) };
    static ITEMS: RefCell<Option<ItemDbBuilder>> = const { RefCell::new(None) };
    static LIVE_ITEMS: RefCell<Option<*mut ItemDb>> = const { RefCell::new(None) };
    static LIVE_THINGS: RefCell<Option<*const Vec<ThingDef>>> = const { RefCell::new(None) };
}

struct ScopedLive;
impl ScopedLive {
    fn enter(items: &mut ItemDb, things: &Vec<ThingDef>) -> Self {
        LIVE_ITEMS.with(|b| *b.borrow_mut() = Some(items as *mut _));
        LIVE_THINGS.with(|b| *b.borrow_mut() = Some(things as *const _));
        ScopedLive
    }
}
impl Drop for ScopedLive {
    fn drop(&mut self) {
        LIVE_ITEMS.with(|b| *b.borrow_mut() = None);
        LIVE_THINGS.with(|b| *b.borrow_mut() = None);
    }
}

fn with_live_items<R>(f: impl FnOnce(&ItemDb) -> R) -> Option<R> {
    LIVE_ITEMS.with(|b| b.borrow().map(|p| unsafe { f(&*p) }))
}

fn with_live_items_mut<R>(f: impl FnOnce(&mut ItemDb) -> R) -> Option<R> {
    LIVE_ITEMS.with(|b| b.borrow().map(|p| unsafe { f(&mut *p) }))
}

fn with_live_things<R>(f: impl FnOnce(&[ThingDef]) -> R) -> Option<R> {
    LIVE_THINGS.with(|b| b.borrow().map(|p| unsafe { f(&*p) }))
}

fn item_def_to_table(lua: &Lua, id: u32, d: &ItemDef) -> mlua::Result<Table> {
    let t = lua.create_table()?;
    t.set("id", id)?;
    t.set("name", d.name.clone())?;
    t.set("group", d.group)?;
    t.set("kind", d.kind)?;
    t.set("flags", d.flags)?;
    t.set("ground", d.ground)?;
    t.set("client", d.client)?;
    Ok(t)
}

fn thing_def_to_table(lua: &Lua, t: &ThingDef) -> mlua::Result<Table> {
    let tb = lua.create_table()?;
    tb.set("id", t.id)?;
    tb.set("category", t.category.clone())?;
    tb.set("width", t.width)?;
    tb.set("height", t.height)?;
    tb.set("layers", t.layers)?;
    tb.set("frames", t.frames)?;
    tb.set("is_ground", t.is_ground)?;
    tb.set("is_on_top", t.is_on_top)?;
    tb.set("is_on_bottom", t.is_on_bottom)?;
    tb.set("is_unpassable", t.is_unpassable)?;
    let attrs = lua.create_table()?;
    for (k, v) in &t.attrs {
        match v {
            AttrValue::Bool(b) => attrs.set(k.as_str(), *b)?,
            AttrValue::Num(n) => attrs.set(k.as_str(), *n)?,
            AttrValue::Str(s) => attrs.set(k.as_str(), s.clone())?,
        }
    }
    tb.set("attrs", attrs)?;
    Ok(tb)
}

struct ScopedAssets;
impl ScopedAssets {
    fn enter() -> Self {
        ASSETS.with(|b| *b.borrow_mut() = Some(AssetsBuilder::default()));
        ScopedAssets
    }
}
impl Drop for ScopedAssets {
    fn drop(&mut self) {
        ASSETS.with(|b| *b.borrow_mut() = None);
    }
}

struct ScopedThings;
impl ScopedThings {
    fn enter() -> Self {
        THINGS.with(|b| *b.borrow_mut() = Some(Vec::new()));
        ScopedThings
    }
}
impl Drop for ScopedThings {
    fn drop(&mut self) {
        THINGS.with(|b| *b.borrow_mut() = None);
    }
}

struct ScopedItems;
impl ScopedItems {
    fn enter() -> Self {
        ITEMS.with(|b| *b.borrow_mut() = Some(ItemDbBuilder::default()));
        ScopedItems
    }
}
impl Drop for ScopedItems {
    fn drop(&mut self) {
        ITEMS.with(|b| *b.borrow_mut() = None);
    }
}

fn read_attrs(def: &Table) -> HashMap<String, AttrValue> {
    let mut out = HashMap::new();
    let Ok(attrs) = def.get::<Table>("attrs") else {
        return out;
    };
    for (k, v) in attrs.pairs::<String, mlua::Value>().flatten() {
        let av = match v {
            mlua::Value::Boolean(b) => Some(AttrValue::Bool(b)),
            mlua::Value::Integer(i) => Some(AttrValue::Num(i as f64)),
            mlua::Value::Number(n) => Some(AttrValue::Num(n)),
            mlua::Value::String(s) => s.to_str().ok().map(|g| AttrValue::Str(g.to_string())),
            _ => None,
        };
        if let Some(av) = av {
            out.insert(k, av);
        }
    }
    out
}

pub fn register_builders(lua: &Lua) -> mlua::Result<()> {
    let forge: Table = lua.globals().get("forge")?;

    let sprites = lua.create_table()?;
    sprites.set("begin", lua.create_function(|_, ()| Ok(()))?)?;
    sprites.set(
        "set_atlas",
        lua.create_function(|_, (atlas_id, w, h, format, data): (u16, u32, u32, u8, mlua::String)| {
            let comp = data.as_bytes();
            let mut raw = Vec::new();
            ZlibDecoder::new(&comp[..]).read_to_end(&mut raw).map_err(mlua::Error::external)?;
            let rgba = match format {
                0 => raw,
                1 => {
                    let mut o = Vec::with_capacity((w * h * 4) as usize);
                    for px in raw.chunks_exact(3) {
                        o.extend_from_slice(&[px[0], px[1], px[2], 255]);
                    }
                    o
                }
                _ => return Err(mlua::Error::external(format!("unknown atlas format {}", format))),
            };
            ASSETS.with(|b| {
                if let Some(b) = b.borrow_mut().as_mut() {
                    b.atlases.insert(atlas_id, Atlas { w, h, rgba });
                }
            });
            Ok(())
        })?,
    )?;
    sprites.set(
        "set_sprite",
        lua.create_function(|_, (sprite_id, atlas_id, x, y, w, h): (u32, u16, u16, u16, u16, u16)| {
            ASSETS.with(|b| {
                if let Some(b) = b.borrow_mut().as_mut() {
                    b.sprites
                        .insert(sprite_id, Region { atlas_id, x: x as u32, y: y as u32, w: w as u32, h: h as u32 });
                }
            });
            Ok(())
        })?,
    )?;
    sprites.set(
        "map_item",
        lua.create_function(|_, (item_id, sprite_id): (u32, u32)| {
            ASSETS.with(|b| {
                if let Some(b) = b.borrow_mut().as_mut() {
                    b.item_map.insert(item_id, sprite_id);
                }
            });
            Ok(())
        })?,
    )?;
    sprites.set(
        "map_client",
        lua.create_function(|_, (server_id, client_id): (u32, u32)| {
            ASSETS.with(|b| {
                if let Some(b) = b.borrow_mut().as_mut() {
                    b.client_map.insert(server_id, client_id);
                }
            });
            Ok(())
        })?,
    )?;
    sprites.set("finish", lua.create_function(|_, ()| Ok(()))?)?;
    forge.set("sprites", sprites)?;

    let things = lua.create_table()?;
    things.set("begin", lua.create_function(|_, ()| Ok(()))?)?;
    things.set(
        "add",
        lua.create_function(|_, def: Table| {
            let t = ThingDef {
                id: def.get("id").unwrap_or(0),
                category: def.get("category").unwrap_or_else(|_| "item".to_string()),
                width: def.get("width").unwrap_or(0),
                height: def.get("height").unwrap_or(0),
                layers: def.get("layers").unwrap_or(0),
                frames: def.get("frames").unwrap_or(0),
                pattern_x: def.get("pattern_x").unwrap_or(0),
                pattern_y: def.get("pattern_y").unwrap_or(0),
                pattern_z: def.get("pattern_z").unwrap_or(0),
                offset_x: def.get("offset_x").unwrap_or(0),
                offset_y: def.get("offset_y").unwrap_or(0),
                elevation: def.get("elevation").unwrap_or(0),
                ground_speed: def.get("ground_speed").unwrap_or(0),
                exact_size: def.get("exact_size").unwrap_or(0),
                is_ground: def.get("is_ground").unwrap_or(false),
                is_ground_border: def.get("is_ground_border").unwrap_or(false),
                is_on_bottom: def.get("is_on_bottom").unwrap_or(false),
                is_on_top: def.get("is_on_top").unwrap_or(false),
                is_unpassable: def.get("is_unpassable").unwrap_or(false),
                has_offset: def.get("has_offset").unwrap_or(false),
                has_elevation: def.get("has_elevation").unwrap_or(false),
                sprite_index: def.get("sprite_index").unwrap_or_default(),
                attrs: read_attrs(&def),
            };
            THINGS.with(|b| {
                if let Some(v) = b.borrow_mut().as_mut() {
                    v.push(t);
                }
            });
            Ok(())
        })?,
    )?;
    things.set("finish", lua.create_function(|_, ()| Ok(()))?)?;
    things.set(
        "list",
        lua.create_function(|lua, ()| {
            let arr = lua.create_table()?;
            if let Some(res) = with_live_things(|list| -> mlua::Result<()> {
                for (i, t) in list.iter().enumerate() {
                    arr.set(i + 1, thing_def_to_table(lua, t)?)?;
                }
                Ok(())
            }) {
                res?;
            }
            Ok(arr)
        })?,
    )?;
    things.set(
        "count",
        lua.create_function(|_, ()| Ok(with_live_things(|list| list.len()).unwrap_or(0)))?,
    )?;
    forge.set("things", things)?;

    let build_item_def = |id: u32, def: &Table| -> mlua::Result<ItemDef> {
        Ok(ItemDef {
            name: def.get("name").unwrap_or_default(),
            group: def.get("group").unwrap_or(0),
            kind: def.get("kind").unwrap_or(0),
            flags: def.get("flags").unwrap_or(0),
            ground: def.get("ground").unwrap_or(false),
            client: def.get("client").unwrap_or(id),
            attrs: read_attrs(def),
        })
    };

    let items = lua.create_table()?;
    items.set("begin", lua.create_function(|_, ()| Ok(()))?)?;
    items.set(
        "add",
        lua.create_function(move |_, (id, def): (u32, Table)| {
            let d = build_item_def(id, &def)?;
            if with_live_items_mut(|db| {
                if def.get::<u32>("client").ok().unwrap_or(0) > 0 {
                    db.server_to_client.insert(id, d.client);
                    db.client_to_server.insert(d.client, id);
                }
                db.items.insert(id, d.clone());
            })
            .is_none()
            {
                ITEMS.with(|b| {
                    if let Some(b) = b.borrow_mut().as_mut() {
                        b.items.insert(id, d);
                    }
                });
            }
            Ok(())
        })?,
    )?;
    items.set(
        "set",
        lua.create_function(|_, (id, def): (u32, Table)| {
            let d = ItemDef {
                name: def.get("name").unwrap_or_default(),
                group: def.get("group").unwrap_or(0),
                kind: def.get("kind").unwrap_or(0),
                flags: def.get("flags").unwrap_or(0),
                ground: def.get("ground").unwrap_or(false),
                client: def.get("client").unwrap_or(id),
                attrs: read_attrs(&def),
            };
            with_live_items_mut(|db| {
                if d.client > 0 {
                    db.server_to_client.insert(id, d.client);
                    db.client_to_server.insert(d.client, id);
                }
                db.items.insert(id, d);
            });
            Ok(())
        })?,
    )?;
    items.set(
        "has",
        lua.create_function(|_, id: u32| Ok(with_live_items(|db| db.items.contains_key(&id)).unwrap_or(false)))?,
    )?;
    items.set(
        "delete",
        lua.create_function(|_, id: u32| {
            Ok(with_live_items_mut(|db| {
                let removed = db.items.remove(&id).is_some();
                if let Some(client) = db.server_to_client.remove(&id) {
                    db.client_to_server.remove(&client);
                }
                removed
            })
            .unwrap_or(false))
        })?,
    )?;
    items.set(
        "get",
        lua.create_function(|lua, id: u32| {
            let def = with_live_items(|db| db.items.get(&id).cloned()).flatten();
            match def {
                Some(d) => Ok(mlua::Value::Table(item_def_to_table(lua, id, &d)?)),
                None => Ok(mlua::Value::Nil),
            }
        })?,
    )?;
    items.set(
        "list",
        lua.create_function(|lua, ()| {
            let arr = lua.create_table()?;
            if let Some(res) = with_live_items(|db| -> mlua::Result<()> {
                let mut i = 1;
                for (&id, d) in &db.items {
                    arr.set(i, item_def_to_table(lua, id, d)?)?;
                    i += 1;
                }
                Ok(())
            }) {
                res?;
            }
            Ok(arr)
        })?,
    )?;
    items.set(
        "count",
        lua.create_function(|_, ()| Ok(with_live_items(|db| db.items.len()).unwrap_or(0)))?,
    )?;
    items.set("finish", lua.create_function(|_, ()| Ok(()))?)?;
    forge.set("items", items)?;

    forge.set("_tools", lua.create_table()?)?;
    forge.set(
        "register_tool",
        lua.create_function(|lua, t: Table| {
            let format: String = t.get("format")?;
            let forge: Table = lua.globals().get("forge")?;
            let tools: Table = forge.get("_tools")?;
            let list: Table = match tools.get::<Table>(format.clone()) {
                Ok(l) => l,
                Err(_) => {
                    let l = lua.create_table()?;
                    tools.set(format.clone(), l.clone())?;
                    l
                }
            };
            let len = list.len()?;
            list.set(len + 1, t)?;
            Ok(())
        })?,
    )?;

    Ok(())
}

fn ext_of(path: &str) -> String {
    Path::new(path).extension().and_then(|e| e.to_str()).unwrap_or_default().to_lowercase()
}

fn format_fn(lua: &Lua, ext: &str, which: &str) -> Result<Function, String> {
    let forge: Table = lua.globals().get("forge").map_err(|e| e.to_string())?;
    let formats: Table = forge.get("_formats").map_err(|e| e.to_string())?;
    let fmt: Table = formats.get(ext.to_string()).map_err(|_| format!("no registered format for .{}", ext))?;
    fmt.get(which).map_err(|_| format!("format .{} has no {} function", ext, which))
}

fn call_read(read: &Function, bytes: &[u8]) -> Result<(), String> {
    let buf = LightUserData(bytes.as_ptr() as *mut c_void);
    read.call::<()>((buf, bytes.len())).map_err(|e| format!("lua read error: {}", e))
}

#[tauri::command]
pub fn forge_load_assets(
    path: String,
    assets_state: State<ForgeAssetsState>,
    things_state: State<ForgeThingsState>,
    lua_state: State<LuaState>,
) -> Result<usize, String> {
    let ext = ext_of(&path);
    let bytes = std::fs::read(&path).map_err(|e| format!("Failed to read {}: {}", path, e))?;

    let lua_guard = lua_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let read = format_fn(&lua_guard.lua, &ext, "read")?;

    let (assets, things) = {
        let _a = ScopedAssets::enter();
        let _t = ScopedThings::enter();
        call_read(&read, &bytes)?;
        let b = ASSETS.with(|b| b.borrow_mut().take()).ok_or("sprites.begin() not called")?;
        let things = THINGS.with(|b| b.borrow_mut().take()).unwrap_or_default();
        (
            ScriptedAssets { atlases: b.atlases, sprites: b.sprites, item_map: b.item_map, client_map: b.client_map },
            things,
        )
    };

    let count = assets.max_sprite_id() as usize;
    *assets_state.lock().map_err(|e| e.to_string())? = Some(assets);
    *things_state.lock().map_err(|e| e.to_string())? = things;
    Ok(count)
}

#[tauri::command]
pub fn forge_load_itemdb(path: String, items_state: State<ForgeItemsState>, lua_state: State<LuaState>) -> Result<usize, String> {
    let ext = ext_of(&path);
    let bytes = std::fs::read(&path).map_err(|e| format!("Failed to read {}: {}", path, e))?;

    let lua_guard = lua_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let read = format_fn(&lua_guard.lua, &ext, "read")?;

    let builder = {
        let _i = ScopedItems::enter();
        call_read(&read, &bytes)?;
        ITEMS.with(|b| b.borrow_mut().take()).ok_or("items.begin() not called")?
    };

    let mut db = ItemDb::default();
    for (&server, def) in &builder.items {
        let client = if def.client == 0 { server } else { def.client };
        db.server_to_client.insert(server, client);
        db.client_to_server.insert(client, server);
    }
    db.items = builder.items;

    let count = db.items.len();
    *items_state.lock().map_err(|e| e.to_string())? = db;
    Ok(count)
}

#[tauri::command]
pub fn forge_read_sprites(ids: Vec<u32>, assets_state: State<ForgeAssetsState>) -> Result<Response, String> {
    let guard = assets_state.lock().map_err(|e| e.to_string())?;
    let assets = guard.as_ref().ok_or("no scripted assets loaded")?;
    Ok(Response::new(assets.pack(&ids)))
}

#[tauri::command]
pub fn forge_things(things_state: State<ForgeThingsState>) -> Result<Vec<ThingDef>, String> {
    Ok(things_state.lock().map_err(|e| e.to_string())?.clone())
}

#[tauri::command]
pub fn forge_item_name(id: u32, items_state: State<ForgeItemsState>) -> Result<Option<String>, String> {
    let db = items_state.lock().map_err(|e| e.to_string())?;
    Ok(db.items.get(&id).map(|d| d.name.clone()))
}

#[tauri::command]
pub fn forge_item_names(items_state: State<ForgeItemsState>) -> Result<Vec<(u32, String)>, String> {
    let db = items_state.lock().map_err(|e| e.to_string())?;
    Ok(db
        .items
        .iter()
        .filter(|(_, d)| !d.name.is_empty())
        .map(|(&id, d)| (id, d.name.clone()))
        .collect())
}

#[tauri::command]
pub fn forge_client_id(server_id: u32, items_state: State<ForgeItemsState>) -> Result<Option<u32>, String> {
    let db = items_state.lock().map_err(|e| e.to_string())?;
    Ok(db.server_to_client.get(&server_id).copied())
}

#[tauri::command]
pub fn forge_server_id(client_id: u32, items_state: State<ForgeItemsState>) -> Result<Option<u32>, String> {
    let db = items_state.lock().map_err(|e| e.to_string())?;
    Ok(db.client_to_server.get(&client_id).copied())
}

#[tauri::command]
pub fn forge_item_sprite(item_id: u32, assets_state: State<ForgeAssetsState>) -> Result<Option<u32>, String> {
    let guard = assets_state.lock().map_err(|e| e.to_string())?;
    Ok(guard.as_ref().and_then(|a| a.sprite_for_item(item_id)))
}

struct SaveSprite {
    id: u32,
    rgba: Vec<u8>,
}

fn parse_save_payload(b: &[u8]) -> Result<(String, serde_json::Value, Vec<SaveSprite>), String> {
    let mut o = 0usize;
    let need = |o: usize, n: usize| -> Result<(), String> {
        if o + n > b.len() {
            Err(format!("save payload truncated at {}", o))
        } else {
            Ok(())
        }
    };
    macro_rules! u16le { () => {{ need(o, 2)?; let v = u16::from_le_bytes([b[o], b[o+1]]); o += 2; v }} }
    macro_rules! u32le { () => {{ need(o, 4)?; let v = u32::from_le_bytes([b[o], b[o+1], b[o+2], b[o+3]]); o += 4; v }} }

    let path_len = u16le!() as usize;
    need(o, path_len)?;
    let path = String::from_utf8_lossy(&b[o..o + path_len]).into_owned();
    o += path_len;

    let json_len = u32le!() as usize;
    need(o, json_len)?;
    let things_json: serde_json::Value =
        serde_json::from_slice(&b[o..o + json_len]).map_err(|e| format!("save payload json error: {}", e))?;
    o += json_len;

    let sprite_count = u32le!() as usize;
    let mut sprites = Vec::with_capacity(sprite_count);
    let sds = (SPRITE_SIZE * SPRITE_SIZE * 4) as usize;
    for _ in 0..sprite_count {
        let id = u32le!();
        need(o, sds)?;
        let rgba = b[o..o + sds].to_vec();
        o += sds;
        sprites.push(SaveSprite { id, rgba });
    }
    Ok((path, things_json, sprites))
}

fn json_to_lua(lua: &Lua, value: &serde_json::Value) -> mlua::Result<mlua::Value> {
    use serde_json::Value;
    match value {
        Value::Null => Ok(mlua::Value::Nil),
        Value::Bool(b) => Ok(mlua::Value::Boolean(*b)),
        Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                Ok(mlua::Value::Integer(i))
            } else {
                Ok(mlua::Value::Number(n.as_f64().unwrap_or(0.0)))
            }
        }
        Value::String(s) => Ok(mlua::Value::String(lua.create_string(s)?)),
        Value::Array(arr) => {
            let t = lua.create_table_with_capacity(arr.len(), 0)?;
            for (i, item) in arr.iter().enumerate() {
                t.set(i + 1, json_to_lua(lua, item)?)?;
            }
            Ok(mlua::Value::Table(t))
        }
        Value::Object(map) => {
            let t = lua.create_table_with_capacity(0, map.len())?;
            for (k, v) in map {
                t.set(k.as_str(), json_to_lua(lua, v)?)?;
            }
            Ok(mlua::Value::Table(t))
        }
    }
}

fn fnv64(d: &[u8]) -> u64 {
    let mut h: u64 = 0xcbf29ce484222325;
    for &b in d {
        h ^= b as u64;
        h = h.wrapping_mul(0x100000001b3);
    }
    h
}

fn pack_sprites(sprites: &[(u32, Vec<u8>)]) -> (u32, u32, Vec<u8>, Vec<(u32, u32, u32)>) {
    let ss = SPRITE_SIZE as usize;
    let sds = ss * ss * 4;
    let mut uniques: Vec<&Vec<u8>> = Vec::new();
    let mut buckets: HashMap<u64, Vec<usize>> = HashMap::new();
    let mut id_unique: Vec<(u32, usize)> = Vec::with_capacity(sprites.len());
    for (id, rgba) in sprites {
        let h = fnv64(rgba);
        let bucket = buckets.entry(h).or_default();
        let mut found = None;
        for &u in bucket.iter() {
            if uniques[u] == rgba {
                found = Some(u);
                break;
            }
        }
        let u = match found {
            Some(u) => u,
            None => {
                let u = uniques.len();
                uniques.push(rgba);
                bucket.push(u);
                u
            }
        };
        id_unique.push((*id, u));
    }

    let n = uniques.len().max(1);
    let cols = (n as f64).sqrt().ceil() as usize;
    let rows = n.div_ceil(cols);
    let aw = cols * ss;
    let ah = rows * ss;
    let mut atlas = vec![0u8; aw * ah * 4];
    let mut ucell: Vec<(u32, u32)> = Vec::with_capacity(uniques.len());
    for (i, u) in uniques.iter().enumerate() {
        let cx = (i % cols) * ss;
        let cy = (i / cols) * ss;
        if u.len() == sds {
            for ry in 0..ss {
                let dst = ((cy + ry) * aw + cx) * 4;
                let src = ry * ss * 4;
                atlas[dst..dst + ss * 4].copy_from_slice(&u[src..src + ss * 4]);
            }
        }
        ucell.push((cx as u32, cy as u32));
    }
    let cells = id_unique
        .iter()
        .map(|(id, u)| {
            let (x, y) = ucell[*u];
            (*id, x, y)
        })
        .collect();
    (aw as u32, ah as u32, atlas, cells)
}

#[tauri::command]
pub fn forge_save_assets(request: tauri::ipc::Request, lua_state: State<LuaState>) -> Result<(), String> {
    let bytes = match request.body() {
        tauri::ipc::InvokeBody::Raw(b) => b.as_slice(),
        _ => return Err("forge_save_assets expects a raw binary payload".to_string()),
    };
    let (path, things_json, sprites) = parse_save_payload(bytes)?;
    let ext = ext_of(&path);

    let sprite_pairs: Vec<(u32, Vec<u8>)> = sprites.into_iter().map(|s| (s.id, s.rgba)).collect();
    let (aw, ah, atlas, cells) = pack_sprites(&sprite_pairs);

    let lua_guard = lua_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let lua = &lua_guard.lua;
    let write = format_fn(lua, &ext, "write")?;

    let build = || -> mlua::Result<mlua::String> {
        let a = lua.create_table()?;
        let atlas_tbl = lua.create_table()?;
        atlas_tbl.set("id", 0)?;
        atlas_tbl.set("w", aw as u32)?;
        atlas_tbl.set("h", ah as u32)?;
        atlas_tbl.set("rgba", lua.create_string(&atlas)?)?;
        a.set("atlas", atlas_tbl)?;

        let sprites_tbl = lua.create_table_with_capacity(cells.len(), 0)?;
        for (i, (id, x, y)) in cells.iter().enumerate() {
            let st = lua.create_table()?;
            st.set("id", *id)?;
            st.set("atlas_id", 0)?;
            st.set("x", *x)?;
            st.set("y", *y)?;
            st.set("w", SPRITE_SIZE)?;
            st.set("h", SPRITE_SIZE)?;
            sprites_tbl.set(i + 1, st)?;
        }
        a.set("sprites", sprites_tbl)?;

        a.set("things", json_to_lua(lua, &things_json)?)?;

        write.call::<mlua::String>(a)
    };

    let out = build().map_err(|e| format!("lua write error: {}", e))?;
    std::fs::write(&path, &out.as_bytes()).map_err(|e| format!("Failed to write {}: {}", path, e))?;
    Ok(())
}

#[tauri::command]
pub fn forge_set_sprites(request: tauri::ipc::Request, assets_state: State<ForgeAssetsState>) -> Result<(), String> {
    let bytes = match request.body() {
        tauri::ipc::InvokeBody::Raw(b) => b.as_slice(),
        _ => return Err("forge_set_sprites expects a raw binary payload".to_string()),
    };
    let sds = (SPRITE_SIZE * SPRITE_SIZE * 4) as usize;
    if bytes.len() < 4 {
        return Err("forge_set_sprites: empty payload".to_string());
    }
    let count = u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]) as usize;
    let mut o = 4;
    let mut pairs: Vec<(u32, Vec<u8>)> = Vec::with_capacity(count);
    for _ in 0..count {
        if o + 4 + sds > bytes.len() {
            return Err(format!("forge_set_sprites: truncated at {}", o));
        }
        let id = u32::from_le_bytes([bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]]);
        o += 4;
        let rgba = bytes[o..o + sds].to_vec();
        o += sds;
        pairs.push((id, rgba));
    }
    let (aw, ah, atlas, cells) = pack_sprites(&pairs);
    let mut atlases = HashMap::new();
    atlases.insert(0u16, Atlas { w: aw, h: ah, rgba: atlas });
    let mut sprites = HashMap::new();
    for (id, x, y) in cells {
        sprites.insert(id, Region { atlas_id: 0, x, y, w: SPRITE_SIZE, h: SPRITE_SIZE });
    }
    *assets_state.lock().map_err(|e| e.to_string())? =
        Some(ScriptedAssets { atlases, sprites, item_map: HashMap::new(), client_map: HashMap::new() });
    Ok(())
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ItemRow {
    pub id: u32,
    pub name: String,
    pub group: u32,
    pub kind: u32,
    pub flags: u32,
    pub client: u32,
    pub attrs: HashMap<String, AttrValue>,
}

#[tauri::command]
pub fn forge_items(items_state: State<ForgeItemsState>) -> Result<Vec<ItemRow>, String> {
    let db = items_state.lock().map_err(|e| e.to_string())?;
    let mut rows: Vec<ItemRow> = db
        .items
        .iter()
        .map(|(&id, d)| ItemRow {
            id,
            name: d.name.clone(),
            group: d.group,
            kind: d.kind,
            flags: d.flags,
            client: d.client,
            attrs: d.attrs.clone(),
        })
        .collect();
    rows.sort_by_key(|r| r.id);
    Ok(rows)
}

#[tauri::command]
pub fn forge_save_itemdb(
    path: String,
    attrs: Option<HashMap<u32, HashMap<String, AttrValue>>>,
    items_state: State<ForgeItemsState>,
    lua_state: State<LuaState>,
) -> Result<(), String> {
    let ext = ext_of(&path);
    let lua_guard = lua_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let lua = &lua_guard.lua;
    let write = format_fn(lua, &ext, "write")?;

    let mut db = items_state.lock().map_err(|e| e.to_string())?;
    if let Some(attrs) = attrs {
        for (id, mut bag) in attrs {
            let item = db.items.entry(id).or_default();
            if let Some(AttrValue::Str(n)) = bag.remove("name") {
                item.name = n;
            }
            if let Some(AttrValue::Num(c)) = bag.get("client_id") {
                item.client = *c as u32;
            }
            item.attrs.extend(bag);
        }
    }
    let db = &*db;
    let build = || -> mlua::Result<mlua::String> {
        let arr = lua.create_table()?;
        let mut i = 1;
        for (&id, d) in &db.items {
            let t = lua.create_table()?;
            t.set("id", id)?;
            t.set("name", d.name.clone())?;
            t.set("group", d.group)?;
            t.set("kind", d.kind)?;
            t.set("flags", d.flags)?;
            t.set("ground", d.ground)?;
            t.set("client", d.client)?;
            let attrs = lua.create_table()?;
            for (k, v) in &d.attrs {
                match v {
                    AttrValue::Bool(b) => attrs.set(k.as_str(), *b)?,
                    AttrValue::Num(n) => attrs.set(k.as_str(), *n)?,
                    AttrValue::Str(s) => attrs.set(k.as_str(), s.clone())?,
                }
            }
            t.set("attrs", attrs)?;
            arr.set(i, t)?;
            i += 1;
        }
        let root = lua.create_table()?;
        root.set("items", arr)?;
        write.call::<mlua::String>(root)
    };
    let bytes = build().map_err(|e| format!("lua write error: {}", e))?;
    std::fs::write(&path, &bytes.as_bytes()).map_err(|e| format!("Failed to write {}: {}", path, e))?;
    Ok(())
}

#[derive(serde::Serialize)]
pub struct ToolMeta {
    pub id: String,
    pub label: String,
    pub description: Option<String>,
}

#[tauri::command]
pub fn forge_list_tools(format_id: String, lua_state: State<LuaState>) -> Result<Vec<ToolMeta>, String> {
    let guard = lua_state.lock().map_err(|e| e.to_string())?;
    let forge: Table = guard.lua.globals().get("forge").map_err(|e| e.to_string())?;
    let tools: Table = forge.get("_tools").map_err(|e| e.to_string())?;
    let Ok(list) = tools.get::<Table>(format_id) else {
        return Ok(Vec::new());
    };
    let mut out = Vec::new();
    for pair in list.sequence_values::<Table>() {
        let t = pair.map_err(|e| e.to_string())?;
        out.push(ToolMeta {
            id: t.get("id").map_err(|e| e.to_string())?,
            label: t.get("label").map_err(|e| e.to_string())?,
            description: t.get("description").ok(),
        });
    }
    Ok(out)
}

#[derive(serde::Serialize)]
pub struct ToolResult {
    pub message: Option<String>,
    pub items_changed: bool,
}

#[tauri::command]
pub fn forge_run_tool(
    format_id: String,
    tool_id: String,
    lua_state: State<LuaState>,
    items_state: State<ForgeItemsState>,
    things_state: State<ForgeThingsState>,
) -> Result<ToolResult, String> {
    let lua_guard = lua_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let lua = &lua_guard.lua;
    let forge: Table = lua.globals().get("forge").map_err(|e| e.to_string())?;
    let tools: Table = forge.get("_tools").map_err(|e| e.to_string())?;
    let list: Table = tools
        .get(format_id.clone())
        .map_err(|_| format!("no tools registered for format '{}'", format_id))?;
    let mut run: Option<Function> = None;
    for pair in list.sequence_values::<Table>() {
        let t = pair.map_err(|e| e.to_string())?;
        let id: String = t.get("id").map_err(|e| e.to_string())?;
        if id == tool_id {
            run = Some(t.get("run").map_err(|e| format!("tool '{}' has no run fn: {}", tool_id, e))?);
            break;
        }
    }
    let run = run.ok_or_else(|| format!("tool '{}' not found for format '{}'", tool_id, format_id))?;

    let mut items = items_state.lock().map_err(|e| e.to_string())?;
    let things = things_state.lock().map_err(|e| e.to_string())?;
    let ret: mlua::Value = {
        let _live = ScopedLive::enter(&mut items, &things);
        run.call(()).map_err(|e| format!("tool '{}' error: {}", tool_id, e))?
    };
    let message = match &ret {
        mlua::Value::Table(t) => t.get::<String>("message").ok(),
        mlua::Value::String(s) => s.to_str().ok().map(|c| c.to_string()),
        _ => None,
    };
    let items_changed = match &ret {
        mlua::Value::Table(t) => t.get::<bool>("items_changed").unwrap_or(true),
        _ => true,
    };
    Ok(ToolResult { message, items_changed })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn host(src: &str) -> Lua {
        let lua = unsafe { Lua::unsafe_new() };
        lua.globals().set("forge", lua.create_table().unwrap()).unwrap();
        crate::lua_bridge::register(&lua).unwrap();
        register_builders(&lua).unwrap();
        lua.load(src).exec().unwrap();
        lua
    }

    #[test]
    fn things_collect_attrs_bag() {
        let lua = host(
            "forge.register_format{ ext='fmta', kind='assets', read=function(buf,len)\n\
               forge.things.begin()\n\
               forge.things.add{ id=7, width=1, is_ground=true, attrs={ swimmable=true, depth=3 } }\n\
               forge.things.finish()\n\
             end }",
        );
        let read = format_fn(&lua, "fmta", "read").unwrap();
        let things = {
            let _t = ScopedThings::enter();
            call_read(&read, &[0u8]).unwrap();
            THINGS.with(|b| b.borrow_mut().take()).unwrap()
        };
        assert_eq!(things.len(), 1);
        assert!(things[0].is_ground);
        assert_eq!(things[0].attrs.get("depth"), Some(&AttrValue::Num(3.0)));
    }

    #[test]
    fn itemdb_builds_id_maps() {
        let lua = host(
            "forge.register_format{ ext='fmtb', kind='itemdb', read=function(buf,len)\n\
               forge.items.begin()\n\
               forge.items.add(100, { name='grass', ground=true, client=4526 })\n\
               forge.items.add(101, { name='torch' })\n\
               forge.items.finish()\n\
             end }",
        );
        let read = format_fn(&lua, "fmtb", "read").unwrap();
        let builder = {
            let _i = ScopedItems::enter();
            call_read(&read, &[0u8]).unwrap();
            ITEMS.with(|b| b.borrow_mut().take()).unwrap()
        };
        let mut db = ItemDb::default();
        for (&s, d) in &builder.items {
            let c = if d.client == 0 { s } else { d.client };
            db.server_to_client.insert(s, c);
            db.client_to_server.insert(c, s);
        }
        db.items = builder.items;
        assert_eq!(db.server_to_client.get(&100), Some(&4526));
        assert_eq!(db.client_to_server.get(&4526), Some(&100));
        assert_eq!(db.server_to_client.get(&101), Some(&101), "no client -> identity");
        assert_eq!(db.items.get(&100).map(|d| d.name.as_str()), Some("grass"));
    }

    #[test]
    fn sprites_crop_from_atlas() {
        use flate2::write::ZlibEncoder;
        use flate2::Compression;
        use std::io::Write;
        let zlib = |raw: &[u8]| {
            let mut e = ZlibEncoder::new(Vec::new(), Compression::default());
            e.write_all(raw).unwrap();
            e.finish().unwrap()
        };
        let atlas = zlib(&[255, 0, 0, 255, 0, 255, 0, 255]);
        let lua = unsafe { Lua::unsafe_new() };
        lua.globals().set("forge", lua.create_table().unwrap()).unwrap();
        crate::lua_bridge::register(&lua).unwrap();
        register_builders(&lua).unwrap();
        lua.globals().set("ATLAS", lua.create_string(&atlas).unwrap()).unwrap();
        lua.load(
            "forge.register_format{ ext='fmta', kind='assets', read=function(buf,len)\n\
               forge.sprites.begin()\n\
               forge.sprites.set_atlas(0, 2, 1, 0, ATLAS)\n\
               forge.sprites.set_sprite(100, 0, 0, 0, 1, 1)\n\
               forge.sprites.set_sprite(101, 0, 1, 0, 1, 1)\n\
               forge.sprites.map_item(5, 100)\n\
               forge.sprites.finish()\n\
             end }",
        )
        .exec()
        .unwrap();
        let read = format_fn(&lua, "fmta", "read").unwrap();
        let assets = {
            let _a = ScopedAssets::enter();
            call_read(&read, &[0u8]).unwrap();
            let b = ASSETS.with(|b| b.borrow_mut().take()).unwrap();
            ScriptedAssets { atlases: b.atlases, sprites: b.sprites, item_map: b.item_map, client_map: b.client_map }
        };
        assert_eq!(assets.sprite_for_item(5), Some(100));
        assert_eq!(assets.max_sprite_id(), 101, "count must be highest id, not entry count");
        let sds = (SPRITE_SIZE * SPRITE_SIZE * 4) as usize;
        let out = assets.pack(&[100, 101]);
        assert_eq!(&out[0..4], &2u32.to_le_bytes());
        let red = &out[4 + 9..4 + 9 + sds];
        assert_eq!(&red[0..4], &[255, 0, 0, 255], "sprite 100 red top-left");
        let green = &out[4 + (9 + sds) + 9..4 + (9 + sds) + 9 + sds];
        assert_eq!(&green[0..4], &[0, 255, 0, 255], "sprite 101 green (atlas x=1)");
    }
}
