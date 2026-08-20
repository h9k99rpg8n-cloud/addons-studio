# Changelog

All notable changes to Addons Studio will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project intends to follow semantic versioning once stable release guarantees exist.

## [Unreleased]

### Planned

- Scope to be selected for the next development prompt; no future editor is implied as complete.

## [0.0.4.3] - 2026-08-20

### Fixed

- Normalized UV move, resize, Rotate, Flip, Fit, Reset, Copy, Paste, and Auto Box results against finite 0.25/0.5/1/2/4 px precision and atlas bounds.
- Preserved decimal cuboid dimensions in Auto Box UV and repaired legacy invalid/out-of-bounds bindings without resetting IndexedDB.
- Coalesced per-binding UV persistence, removed the duplicate commit path, made multi-face assignment transactional, and prevented stale asynchronous saves during rapid editor changes.
- Interpolated fast Pencil/Eraser pointer samples, separated touch painting from pinch/pan, corrected even-size X/Y mirror placement, and deduplicated no-op Paint history states.
- Bound Paint saves to their originating texture asset so rapid cube, face, material, model, or mode changes cannot write pixels into the wrong asset.
- Hardened Safari pointer capture/cancel/lost-capture behavior, context-menu and scroll suppression, safe areas, landscape sizing, 16 px editable controls, and finger-sized interaction targets.
- Improved textured preview face raycasting, rotated-model fitting, hidden-cube handling, stale texture-load rejection, shared materials, and WebGL/resource cleanup.
- Included Texture Core records in local project duplication/deletion and removed model-specific bindings when a model is deleted while preserving project materials.

### Changed

- Paint logic now lives behind a focused, independently tested pixel-operation service while `TextureCoreView.vue` remains an orchestrator.
- Paint autosaves after a short idle delay and flushes on mode change, route change, page hide, and editor teardown without producing repetitive save toasts.
- Texture replacement atomically normalizes every linked face binding if atlas dimensions change.
- Added a focused 0.0.4.3 What's New entry and official compatibility/validation documentation.

### Preserved

- Existing Alpha 0.0.4.0, 0.0.4.0.1, and 0.0.4.2 IndexedDB data; this release adds no destructive schema migration.
- Model Core, project folders, PWA behavior, GitHub Pages routing, project-scoped reusable materials, and model-specific texture bindings.
- Materials Core and Animation Core remain out of scope.

## [0.0.3.6.2] - 2026-08-13

### Added

- Snapshot 3 Inflate precision fitting with 26 finger-friendly corner, edge, and face handles, axis/multi-axis fitting, snapping, undo/redo, and invalid-target protection.
- Organizational Model Folders distinct from structural Groups, including one nested folder level, safe limits, create/rename/move/delete workflows, persistence, and portability metadata.
- Focused Model Studio Settings navigation, independent Move/Resize/Rotate precision (including custom steps), camera sensitivities/profiles, experimental Touch Rotate toggle, and preferences-only reset confirmation.
- Compact per-viewport camera-view and Global/Local/Parent quick selectors plus icon-based maximize/restore controls.
- Canonical validated Addons Studio `.model.json` export and adapter-based import for Studio JSON and compatible Minecraft Bedrock geometry JSON.
- Transactional versioned `.addonsstudio` project package import/export beta, manifest preview, duplicate-safe ID and namespace remapping, model/editor asset restoration, folder preservation, storage advisory, and real staged progress.
- English/Spanish localization store and persisted language selection, with identifiers, namespaces, extensions, and JSON keys left untouched.
- Versioned What's New/Release Notes experience and optional local-only Developer Beta timers, routine checklist, notification fallback, and opt-in foreground usage summaries.
- Original Inflate icon and lightweight Studio Preview Material palette for clearer untextured cuboids.
- Automated coverage for Inflate, folders and limits, language persistence, settings migration/reset, JSON adapters/integrity, and project package rollback/remapping.

### Changed

- Retired the user-facing Tactilismos name in favor of Touch Gizmo / Gizmo táctil while safely migrating the persisted legacy value.
- Normal Move, Resize, and Rotate gizmos now use the geometry/selection center; Pivot mode alone displays and edits the stored animation-ready pivot.
- Gizmos maintain an adaptive screen-space scale while retaining deliberately larger invisible touch pickers.
- Consolidated Reference and editor-environment controls under Background / Guide and removed redundant permanent Model Studio toolbar controls.
- Internal model schema is now version 5. Existing Alpha 0.0.3.x records normalize folders, precision, camera, experiments, and Touch Gizmo settings without resetting IndexedDB.

### Preserved

- References 2.0, custom backgrounds, Resize safeguards, custom Addons Studio gizmos, groups/pivots, multi-selection, productivity commands, one/two viewports, autosave, undo/redo, project folders, PWA behavior, and GitHub Pages deployment.
- Texture Core, UV editing, materials, animation, bones, Bedrock add-on export, and the planned large Model Core refactor remain out of scope.

## [0.0.3.6.1] - 2026-08-13

### Added

- References 2.0: multiple viewport-aligned PNG/JPG guides assigned to Front, Back, Left, Right, Top, or Bottom, with 2D position, scale, opacity, visibility, horizontal/vertical flip, rename, and optional rotation controls.
- Compact touch-first References manager and a separate Editor Background selector inside Model Studio.
- Original lightweight Dark Studio, Sky, Night, Sunset, and Snow procedural environments plus persistent custom PNG/JPG backgrounds with Fit, Fill, Stretch, opacity, and brightness options.
- Dedicated `modelEditorAssets` IndexedDB storage for reference/background blobs, image dimensions, and asset kind, with one shared runtime object URL per open editor session.
- Tests for reference view resolution, legacy asset migration, Blob persistence, project/model cleanup, custom background persistence/reset, shared runtime URLs, Safari decode errors, image limits, and pointer discontinuities.

### Changed

- Replaced selectable Three.js reference planes with non-interactive DOM guide layers behind the transparent WebGL canvas. References no longer affect raycasting, hierarchy, pivots, or model bounds, and split viewports resolve their assigned guides independently.
- Upgraded database schema to version 3 and internal model schema to version 4. Alpha 0.0.3–0.0.3.6 reference blobs and metadata migrate without resetting IndexedDB; legacy Side references map safely to Right and 3D offsets/sizes become approximate 2D guide values.
- Hardened Move/Resize/Rotate gesture continuity against isolated Safari pointer-coordinate spikes while retaining the existing contextual world-delta safeguards.
- Tactilismos now wait through a deliberate hold before capturing the pointer; a second finger or navigation drag cancels the pending direct transform so orbit, pinch zoom, and two-finger pan retain priority.
- All Model Studio text, numeric, select, and textarea controls retain an effective 16 CSS-pixel font size to prevent unwanted iOS focus zoom without disabling browser zoom.

### Preserved

- Alpha 0.0.3.6 model transforms, resize directions, transform spaces, custom touch gizmos, Tactilismos, multi-selection, groups, pivots, productivity commands, locks, isolation, undo/redo, autosave, snapping, camera views, one/two viewports, maximize, green grid, and project migrations.

## [0.0.3.6] - 2026-08-12

### Added

- Persistent Model Studio settings for Both/Positive/Negative Resize direction, Gizmos/Tactilismos/Hybrid control mode, Global/Local/Parent transform space, and an English/Spanish localization foundation.
- Experimental hold-to-move, radial uniform Resize, and circular direct Rotate Tactilismos that coexist with empty-space orbit, pinch zoom, and two-finger pan.
- Deliberate viewport/Outliner multi-selection with batch Move, Duplicate, Delete, visibility, lock, isolation, and Move to Group workflows.
- Mirror in place and Duplicate + Mirror on X/Y/Z, bounds-based Min/Center/Max alignment, even distribution, and Duplicate Again with remembered translation offset.
- Cube/group locking and editor-only isolation with explicit Outliner states and safe unlock access.
- Regression coverage for center-preserving/directional Resize, pivots, gesture spikes, transform spaces, multi-selection, mirror IDs, alignment, distribution, locking, isolation, undo/redo, and settings migration.

### Changed

- Reworked Resize in Model Core so the default operation distributes a size delta evenly across both sides and keeps the visual center fixed on X/Y/Z, including rotated cubes and exact numeric edits.
- Froze axis projection and world-per-pixel sensitivity at gesture start, bounded near-camera-axis sensitivity, and rejected non-finite or implausible Resize drag spikes.
- Model records now normalize to internal schema version 3 while preserving Alpha 0.0.3.5 hierarchy, pivots, references, editor layout, and snapping data.
- Transform gizmos visibly follow the selected Global, Local, or Parent basis; group rotations apply the same world-space axis to affected children.
- Model Studio editable controls use at least 16 CSS pixels so iPhone Safari does not trigger unwanted focus zoom.
- Numeric Resize commits now record the already-applied preview, preventing a symmetric center offset from being applied twice when a mobile properties sheet closes.

### Preserved

- Original Addons Studio custom gizmo geometry, large invisible touch pickers, raycasting, and pointer-event implementation; default Three.js `TransformControls` remain unused.
- Project storage/folders, references, autosave, compact command history, camera views, green grid, one/two viewports, maximize, PWA shell, and GitHub Pages deployment architecture.

## [0.0.3.5] - 2026-08-12

### Added

- Real cube duplication from the Outliner and object action sheet with stable new IDs, sensible names, copied transforms/visibility/metadata, retained group membership, and undo/redo.
- One-level model groups with create, rename, organize, expand/collapse, visibility, duplication, whole-group transforms, and safe deletion that moves children to root.
- Persistent cube/group pivots, a distinct gold Pivot gizmo, exact XYZ editing, Center Pivot, Reset Pivot, and Pivot to Origin.
- Perspective, isometric, front, back, left, right, top, and bottom editor camera views.
- Fully functional one- and two-viewport layouts with independent views, active-panel feedback, temporary maximize, and a lower-power secondary viewport.
- Move/size snapping presets with a custom value and degree-based rotation snapping presets.
- Tests covering hierarchy duplication, group transforms, pivot behavior, snapping, model-schema migration, persistence, project duplication, and command history.

### Changed

- Camera navigation no longer requires a dedicated Orbit tool: empty-space drag orbits, pinch zooms, and two-finger gestures pan while Select/Move/Rotate/Resize/Pivot remains active.
- Reference images now default to locked, do not participate in selection while locked, and support six orientations when unlocked.
- Model records normalize to internal schema version 2 without resetting IndexedDB or discarding Alpha 0.0.3 cubes/references.
- Project duplication now remaps model groups and child relationships while preserving future-compatible node metadata.
- Removed the visible world-origin sphere while retaining the mathematical origin, axes, and green grid.

### Preserved

- Alpha 0.0.3 projects, folders, Model Studio format, reference blobs, autosave, undo/redo, custom Addons Studio touch gizmos, PWA shell, and GitHub Pages architecture.
- Alpha 0.0.2 visual identity and the existing green Addons Studio cube icon.

## [0.0.3] - 2026-08-12

### Added

- Persistent one-level project folders with create, open, rename, move, and safe-delete flows.
- IndexedDB schema version 2 with dedicated folder, internal model, and reference-asset stores.
- Functional Models resource route with validated Bedrock-style geometry identifiers.
- Lazy-loaded Three.js viewport with touch camera controls, grid, origin, lighting, selection, and safe WebGL fallback.
- Original finger-friendly Move, Rotate, and Resize gizmos with large invisible raycast pickers and live values.
- Multiple cubes, exact numeric transform editing, visibility, renaming, deletion, and mobile outliner.
- PNG/JPG front-reference planes with transform, opacity, visibility, and transactional blob persistence.
- Compact command-based undo/redo and debounced model autosave with save status.
- Tests for schema migration, folder safety, model validation/persistence, references, project duplication, and command history.

### Changed

- Promoted the application identity to Alpha 0.0.3.
- Project duplication now includes independent model, cube, reference, and image-asset copies.
- Project deletion now removes model data and reference blobs in the same transaction.
- Models are the first available contextual resource; unfinished resource types remain explicitly marked “Coming soon.”

### Preserved

- Alpha 0.0.1 project creation, local autosave, recovery snapshots, themes, PWA shell, and CI/Pages architecture.
- Alpha 0.0.2 visual identity, custom product icons, touch components, and mobile safe-area support.

## [0.0.2] - 2026-08-12

### Added

- Original Creative Core Cube brand mark and application icon.
- Coordinated SVG favicon, Safari pinned-tab mark, Apple touch icon, and PWA any/maskable assets.
- Typed Addons Studio product-icon registry covering project, resource, workspace, Collision Box, and Visual Logic concepts.
- Dedicated Material sphere icon that establishes Material as a product abstraction rather than an image file.
- Brand documentation with palette, typography, icon, accessibility, and asset-usage guidance.
- Automated coverage for the icon registry and generated branding assets.

### Changed

- Promoted the application identity to Alpha 0.0.2.
- Formalized color, spacing, radius, shadow, typography, transition, icon-size, card, header, and sheet tokens.
- Refined the welcome and Home experiences, project cards, project list, workspace modules, resource picker, Settings, dialogs, buttons, and empty states.
- Limited Lucide to generic UI actions while product-specific concepts use original Addons Studio SVGs.
- Updated PWA theme colors and installation branding without changing the GitHub Pages base-path architecture.

### Preserved

- Prompt 1 project creation, IndexedDB persistence, project actions, autosave, recovery snapshots, themes, routing, safe areas, offline shell, and CI/Pages workflows.

## [0.0.1-dev] - 2026-08-12

### Added

- Vue 3, TypeScript, Vite, Pinia, and Vue Router application foundation.
- Mobile-first welcome, Home, Projects, Create Project, Workspace, Learn, and Settings views.
- Validated project creation with icon import, project type, target version, and experiments metadata.
- Dexie/IndexedDB project database with project, snapshot, and settings tables.
- Debounced persistence and bounded recovery snapshot architecture.
- Recent-project reopening, rename, duplicate, and confirmed delete flows.
- Reusable resource categories and contextual resource-template registry.
- System, light, and dark design-token themes.
- Accessible dialogs, bottom sheets, toasts, global error handling, and offline indicator.
- Installable PWA assets and offline application shell.
- Foundational automated tests.
- GitHub Actions workflows for CI and GitHub Pages.
- Project, contribution, security, architecture, license, and third-party documentation.

[Unreleased]: https://github.com/h9k99rpg8n-cloud/addons-studio/compare/v0.0.4.3...HEAD
[0.0.4.3]: https://github.com/h9k99rpg8n-cloud/addons-studio/compare/v0.0.4.2...v0.0.4.3
[0.0.4.2]: https://github.com/h9k99rpg8n-cloud/addons-studio/compare/v0.0.4.0.1...v0.0.4.2
[0.0.4.0.1]: https://github.com/h9k99rpg8n-cloud/addons-studio/compare/v0.0.4.0...v0.0.4.0.1
[0.0.4.0]: https://github.com/h9k99rpg8n-cloud/addons-studio/compare/v0.0.3.6.3...v0.0.4.0
[0.0.3.6.3]: https://github.com/h9k99rpg8n-cloud/addons-studio/compare/v0.0.3.6.2...v0.0.3.6.3
[0.0.3.6.2]: https://github.com/h9k99rpg8n-cloud/addons-studio/compare/v0.0.3.6.1...v0.0.3.6.2
[0.0.3.6.1]: https://github.com/h9k99rpg8n-cloud/addons-studio/compare/v0.0.3.6...v0.0.3.6.1
[0.0.3.6]: https://github.com/h9k99rpg8n-cloud/addons-studio/compare/v0.0.3.5...v0.0.3.6
[0.0.3.5]: https://github.com/h9k99rpg8n-cloud/addons-studio/compare/v0.0.3...v0.0.3.5
[0.0.3]: https://github.com/h9k99rpg8n-cloud/addons-studio/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/h9k99rpg8n-cloud/addons-studio/compare/v0.0.1-dev...v0.0.2
[0.0.1-dev]: https://github.com/h9k99rpg8n-cloud/addons-studio/releases/tag/v0.0.1-dev
