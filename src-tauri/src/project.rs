use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use tauri::State;

use crate::lua_host::LuaState;

pub const MANIFEST_VERSION: u32 = 1;
const MAX_RECENT_PROJECTS: usize = 16;

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
pub struct SpriteForgeSection {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub assets: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Manifest {
    pub frg: u32,
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scripts: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub map_forge: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sprite_forge: Option<SpriteForgeSection>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

#[derive(Clone, Debug)]
pub struct Project {
    pub root: PathBuf,
    pub manifest_path: PathBuf,
    pub manifest: Manifest,
}

impl Project {
    pub fn parse(text: &str, manifest_path: &Path) -> Result<Self, String> {
        let manifest: Manifest = serde_json::from_str(text).map_err(|e| format!("{}: {}", manifest_path.display(), e))?;
        if manifest.frg > MANIFEST_VERSION {
            return Err(format!(
                "{} requires manifest version {}, this build supports {}",
                manifest_path.display(),
                manifest.frg,
                MANIFEST_VERSION
            ));
        }
        if manifest.sprite_forge.is_none() {
            let target = if manifest.map_forge.is_some() { "the map editor" } else { "no known editor" };
            return Err(format!("{} targets {}", manifest_path.display(), target));
        }
        Ok(Project {
            root: manifest_path.parent().map(Path::to_path_buf).unwrap_or_default(),
            manifest_path: manifest_path.to_path_buf(),
            manifest,
        })
    }

    pub fn load(manifest_path: &Path) -> Result<Self, String> {
        let text = fs::read_to_string(manifest_path).map_err(|e| format!("{}: {}", manifest_path.display(), e))?;
        Self::parse(&text, manifest_path)
    }

    fn resolve(&self, rel: &str) -> PathBuf {
        let mut path = self.root.clone();
        for part in rel.split('/').filter(|p| !p.is_empty() && *p != ".") {
            path.push(part);
        }
        path
    }

    pub fn scripts_dir(&self) -> Option<PathBuf> {
        let dir = self.resolve(self.manifest.scripts.as_deref()?);
        dir.is_dir().then_some(dir)
    }

    pub fn assets_dir(&self) -> Option<PathBuf> {
        Some(self.resolve(self.manifest.sprite_forge.as_ref()?.assets.as_deref()?))
    }
}

pub type ProjectState = Arc<Mutex<Option<Project>>>;

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    #[serde(default)]
    pub active_project: Option<String>,
    #[serde(default)]
    pub recent_projects: Vec<String>,
}

fn settings_path() -> Result<PathBuf, String> {
    Ok(crate::get_config_dir()?.join("settings.json"))
}

pub fn read_settings() -> AppSettings {
    settings_path()
        .ok()
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|t| serde_json::from_str(&t).ok())
        .unwrap_or_default()
}

fn write_settings(settings: &AppSettings) -> Result<(), String> {
    let path = settings_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("{}: {}", parent.display(), e))?;
    }
    let json = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| format!("{}: {}", path.display(), e))
}

pub fn resolve_active() -> Option<Project> {
    let path = read_settings().active_project?;
    match Project::load(Path::new(&path)) {
        Ok(project) => Some(project),
        Err(e) => {
            crate::logger::log("WARN", &format!("Running with no project: {}", e));
            None
        }
    }
}

fn safe_component(value: &str) -> Result<&str, String> {
    let ok = !value.is_empty()
        && value.len() <= 64
        && value.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_');
    if ok {
        Ok(value)
    } else {
        Err(format!("invalid name: {}", value))
    }
}

fn state_file(base: &Path, id: &str, key: &str) -> Result<PathBuf, String> {
    Ok(base.join(safe_component(id)?).join(format!("{}.json", safe_component(key)?)))
}

fn state_base() -> Result<PathBuf, String> {
    Ok(crate::get_config_dir()?.join("projects"))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInfo {
    pub id: String,
    pub name: String,
    pub root: String,
    pub manifest_path: String,
    pub scripts_dir: Option<String>,
    pub assets_dir: Option<String>,
}

fn info(project: &Project) -> ProjectInfo {
    let as_string = |p: PathBuf| p.to_string_lossy().into_owned();
    ProjectInfo {
        id: project.manifest.id.clone(),
        name: project.manifest.name.clone(),
        root: project.root.to_string_lossy().into_owned(),
        manifest_path: as_string(project.manifest_path.clone()),
        scripts_dir: project.scripts_dir().map(as_string),
        assets_dir: project.assets_dir().map(as_string),
    }
}

fn rebuild_lua(lua: &State<LuaState>, dir: Option<PathBuf>) -> Result<(), String> {
    let mut host = lua.lock().map_err(|e| e.to_string())?;
    host.dir = dir;
    if let Err(e) = host.load_all() {
        host.last_error = Some(e);
    }
    Ok(())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentProject {
    pub path: String,
    pub id: Option<String>,
    pub name: Option<String>,
    pub available: bool,
}

#[tauri::command]
pub fn project_active(project: State<ProjectState>) -> Result<Option<ProjectInfo>, String> {
    let guard = project.lock().map_err(|e| e.to_string())?;
    Ok(guard.as_ref().map(info))
}

#[tauri::command]
pub fn project_open(path: String, project: State<ProjectState>, lua: State<LuaState>) -> Result<ProjectInfo, String> {
    let opened = Project::load(Path::new(&path))?;

    let mut settings = read_settings();
    settings.active_project = Some(path.clone());
    settings.recent_projects.retain(|p| p != &path);
    settings.recent_projects.insert(0, path);
    settings.recent_projects.truncate(MAX_RECENT_PROJECTS);
    write_settings(&settings)?;

    rebuild_lua(&lua, opened.scripts_dir())?;

    let mut guard = project.lock().map_err(|e| e.to_string())?;
    let out = info(&opened);
    *guard = Some(opened);
    Ok(out)
}

#[tauri::command]
pub fn project_close(project: State<ProjectState>, lua: State<LuaState>) -> Result<(), String> {
    let mut settings = read_settings();
    settings.active_project = None;
    write_settings(&settings)?;

    rebuild_lua(&lua, None)?;

    *project.lock().map_err(|e| e.to_string())? = None;
    Ok(())
}

#[tauri::command]
pub fn project_recents() -> Vec<RecentProject> {
    read_settings()
        .recent_projects
        .into_iter()
        .map(|path| match Project::load(Path::new(&path)) {
            Ok(p) => RecentProject {
                path,
                id: Some(p.manifest.id),
                name: Some(p.manifest.name),
                available: true,
            },
            Err(_) => RecentProject { path, id: None, name: None, available: false },
        })
        .collect()
}

#[tauri::command]
pub fn project_clear_recents() -> Result<(), String> {
    let mut settings = read_settings();
    settings.recent_projects.clear();
    write_settings(&settings)
}

fn active_id(project: &State<ProjectState>) -> Result<String, String> {
    let guard = project.lock().map_err(|e| e.to_string())?;
    guard
        .as_ref()
        .map(|p| p.manifest.id.clone())
        .ok_or_else(|| "no project is open".to_string())
}

#[tauri::command]
pub fn project_state_get(key: String, project: State<ProjectState>) -> Result<Option<Value>, String> {
    let path = state_file(&state_base()?, &active_id(&project)?, &key)?;
    let Ok(text) = fs::read_to_string(&path) else {
        return Ok(None);
    };
    Ok(serde_json::from_str(&text).ok())
}

#[tauri::command]
pub fn project_state_set(key: String, value: Value, project: State<ProjectState>) -> Result<(), String> {
    let path = state_file(&state_base()?, &active_id(&project)?, &key)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("{}: {}", parent.display(), e))?;
    }
    let json = serde_json::to_string(&value).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| format!("{}: {}", path.display(), e))
}

#[cfg(test)]
mod tests {
    use super::*;

    const BOTH_SECTIONS: &str = r#"{
        "frg": 1,
        "id": "sample",
        "name": "Sample",
        "scripts": "scripts",
        "mapForge": { "data": "data" },
        "spriteForge": { "assets": "assets/sources" },
        "futureKey": { "kept": true }
    }"#;

    fn manifest_in(dir: &Path) -> PathBuf {
        dir.join("sample.frg")
    }

    #[test]
    fn parses_shared_manifest_and_resolves_own_section() {
        let dir = tempfile::tempdir().unwrap();
        let project = Project::parse(BOTH_SECTIONS, &manifest_in(dir.path())).unwrap();
        assert_eq!(project.manifest.id, "sample");
        assert_eq!(project.root, dir.path());
        assert_eq!(project.assets_dir().unwrap(), dir.path().join("assets").join("sources"));
        assert!(project.manifest.map_forge.is_some());
    }

    #[test]
    fn unknown_keys_survive_round_trip() {
        let project = Project::parse(BOTH_SECTIONS, Path::new("sample.frg")).unwrap();
        let back: Value = serde_json::from_str(&serde_json::to_string(&project.manifest).unwrap()).unwrap();
        assert_eq!(back["futureKey"]["kept"], Value::Bool(true));
        assert_eq!(back["mapForge"]["data"], Value::String("data".into()));
    }

    #[test]
    fn refuses_newer_manifest_version() {
        let src = r#"{ "frg": 2, "id": "a", "name": "A", "spriteForge": {} }"#;
        let err = Project::parse(src, Path::new("a.frg")).unwrap_err();
        assert!(err.contains("manifest version 2"), "{}", err);
    }

    #[test]
    fn refuses_manifest_without_own_section() {
        let src = r#"{ "frg": 1, "id": "a", "name": "A", "mapForge": { "data": "data" } }"#;
        let err = Project::parse(src, Path::new("a.frg")).unwrap_err();
        assert!(err.contains("map editor"), "{}", err);
    }

    #[test]
    fn missing_scripts_directory_is_not_an_error() {
        let dir = tempfile::tempdir().unwrap();
        let src = r#"{ "frg": 1, "id": "a", "name": "A", "scripts": "scripts", "spriteForge": {} }"#;
        let project = Project::parse(src, &manifest_in(dir.path())).unwrap();
        assert!(project.scripts_dir().is_none());

        fs::create_dir(dir.path().join("scripts")).unwrap();
        assert_eq!(project.scripts_dir().unwrap(), dir.path().join("scripts"));
    }

    #[test]
    fn per_project_state_is_keyed_by_manifest_id() {
        let dir = tempfile::tempdir().unwrap();
        let one = state_file(dir.path(), "alpha", "recentLoads").unwrap();
        let two = state_file(dir.path(), "beta", "recentLoads").unwrap();
        assert_ne!(one, two);

        fs::create_dir_all(one.parent().unwrap()).unwrap();
        fs::write(&one, r#"[{"label":"x"}]"#).unwrap();
        let read: Value = serde_json::from_str(&fs::read_to_string(&one).unwrap()).unwrap();
        assert_eq!(read[0]["label"], Value::String("x".into()));
        assert!(!two.exists());
    }

    #[test]
    fn state_names_cannot_escape_their_directory() {
        let dir = tempfile::tempdir().unwrap();
        assert!(state_file(dir.path(), "..", "recentLoads").is_err());
        assert!(state_file(dir.path(), "alpha", "../../escape").is_err());
        assert!(state_file(dir.path(), "a/b", "recentLoads").is_err());
    }
}
