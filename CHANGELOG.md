# Changelog

All notable changes to Sprite Forge are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
