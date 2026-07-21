# Changelog

All notable changes to Sprite Forge are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.1] - 2026-07-20

### Added
- Editable layers in the object preview with a vertical stepper and a show-all toggle for compositing.
- Animation timeline panel with shared playback controls.
- Top and bottom dockable zones, with panel locking.
- Open Folder and Reload Files actions in the Lua Scripts dialog.
- Project manifest (`.frg`) support to resolve paths before Lua scripts run.
- Duplicate a server item for a client.
- Star button in the About dialog.
- Confirmation dialog when replacing sprites via drag-and-drop or import.

### Fixed
- Multi-tile sprites now stack in the correct order (matches the reference renderer).
- Tooltips no longer get clipped by parent containers with hidden overflow.
- Pasting into item description (and other textareas) works again; the global image-paste listener now ignores textareas and contenteditable fields.
- `items.xml` is preserved on save with in-place patching, plus a confirmation before rewriting.

### Changed
- Formats can now declare a full alpha channel at registration, so RGBA sprites render with correct transparency.
- Toolbar buttons in the object preview use the styled tooltip component (hover to see labels).

## [0.3.0] - 2026-06-29

### Added
- Lua-scripted custom formats: drop a `.lua` script into the scripts folder to add a new file format with its own categories, load dialog title, and read/write logic; no app rebuild required.
- Tools → Lua Scripts dialog with an enable/disable toggle, script browser, and syntax-highlighted Lua editor for live edits and reloads.
- Format scripts declare their own property schema (sections, fields, visibility, grids), so each format shows only the editor controls it actually supports.
- Slice/crop editor window with layers, marching-ants selection, transform mode, rectangular pixel select, proximity grid snap, and layer keyboard ops.
- New project dialog (File → New…) for creating empty `.dat`/`.spr` projects with version, transparency, extended, frame groups, and improved animations toggles.
- Right-click `Import…` on an item to replace it; when multiple objects are selected in the import dialog, the first replaces the clicked item and the rest are added as new.
- In-app confirm modal for replace flows.
- Auto-calculate exact size for items from their non-transparent pixel bounds.
- Expanded client version table to cover 7.10–12.86.
- Fallback to `.otfi` metadata + version 1099 when the DAT signature is unrecognized.

### Fixed
- Sprite optimizer now applies the temp file atomically and refuses to overwrite the original with itself, eliminating a case where the SPR file could be deleted on compile.
- Light, Displacement, and Minimap fields no longer appear twice on wide property panels; the Visuals block and the body columns share a single breakpoint.

### Performance
- Faster compiles on large projects: the DAT file is no longer rewritten when only sprites changed, and the backup copy runs in parallel with sprite-state capture instead of blocking the write.

## [0.2.2] - 2026-06-25

### Added
- Server items (OTB) are now created, synced, and cleaned up live as you add, import, or delete items, instead of only on compile, with a Create button in the server item panel.
- Last button jumps to the final item in both list panels.

### Fixed
- Imported sprites no longer turn blank/transparent after saving on transparent clients (e.g. 10.98).
- Multi-tile object thumbnails now render at full height in the lists.

## [0.2.1] - 2026-06-25

### Added
- In-place item removal with undo/redo.
- Configurable default sprite canvas zoom in Preferences.
- Exported objects panel with double-click to view.
- Draggable, dockable panels with a persistent layout.
- Background context menu to create or import directly in listings.
- Rich object preview sidebar in the import dialog.
- Timestamped `.bak` backup of the DAT/SPR before each save.
- On-demand OBD/SFP viewer with server-item dedup in the import dialog.
- Drag-and-drop reordering of favorites.
- Single-file format auto-detection in the open dialog.

### Fixed
- Update notes now render as formatted markdown instead of raw text.
- Writes a placeholder for missing DAT object IDs to prevent corruption on save.
- Sprite sheet export now decodes with the correct SPR alpha format.
- Centers the toggle switch thumb.

### Performance
- Faster OTB loading via binary transfer.

## [0.2.0] - 2026-06-20

### Added
- Optional auto-play of animation when opening an animated object (off by default, toggle in Settings).
- Two-column large view mode for the item and sprite lists.
- Editable address bar to type or paste a path.
- Server items shown as icon-only statuses, side by side.
- Open Recent reopens the full DAT/SPR/OTFI/OTB set.
- Remembers the OTB per DAT/SPR, removing the manual Load OTB menu.
- Pick `items.otb` via a dedicated in-app file dialog.
- Detects DAT/SPR/OTFI by extension, with an asset detail panel.
- Create-missing-OTB-items and reload-attributes actions.
- Side-by-side server item (OTB/XML) editing.
- Import/export dialogs with multi-selection support.

### Changed
- Compact menubar header with a check-for-updates action.

### Fixed
- Respects OTFI feature flags on save and writes the `.otfi` file.
- Sheet import now uses explicit object geometry.
- Imported pack items count toward the category total.

## [0.1.4] - 2026-06-18

### Added
- Honors `.otfi` overrides when loading custom clients, so DAT/SPR files with non-standard extended/transparency/frame-durations/frame-groups flags now open correctly.
- Similarity search for items.
- Copy sprite to clipboard button.

### Fixed
- Magenta background appearing on sheet imports.
- Thumbnail rendering for tall objects in the list.
- Grid and exact-size view toggles now respond to clicks.

## [0.1.3] - 2026-06-04

### Added
- In-app updater indicator with auto-check, download progress and one-click restart.

### Docs
- Download links and auto-update info in the README.

## [0.1.2] - 2026-06-03

### Fixed
- Duplicate now creates a visible independent item across categories.

### Docs
- Build and development instructions.

## [0.1.1] - 2026-05-29

### Fixed
- Aligned Tauri npm packages with the Rust crate versions to stop runtime IPC mismatches.

### Build
- Committed Cargo.lock and updated the CI cache strategy.

## [0.1.0] - 2026-05-25

### Added
- Initial public release.
- Item, outfit, effect and missile editor for Tibia clients 7.10 to 10.56.
- Sprite editing with version history.
- Find dialog with property and sprite-id filters.
- Scene editor for composing multi-tile layouts.
- Sprite optimizer that removes duplicates and unused sprites.
- Settings dialog with configurable list page size.
