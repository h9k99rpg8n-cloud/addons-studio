# Architecture

This document describes the Alpha `0.0.3.6.1` mobile foundation, project organization, and current Model Studio workflow. It defines boundaries for future work; it is not a claim that a complete Bedrock modeling or export engine already exists.

## Application layers

| Area | Responsibility |
| --- | --- |
| `src/app` | Root composition and global application shell |
| `src/components/common` | Touch-friendly primitives, dialogs, sheets, feedback, and brand mark |
| `src/components/navigation` | Main mobile navigation and headers |
| `src/components/project` | Reusable project cards, actions, icons, and resource pickers |
| `src/core/app` | Product release metadata shared by visible surfaces |
| `src/core/icons` | Typed, original Addons Studio product-icon registry |
| `src/features` | Lazy-loaded route-level product features |
| `src/core/project` | Project rules, version registry, persistence scheduling, and resource templates |
| `src/core/model` | Internal model factory, transform math, hierarchy/productivity operations, validation, repository, debounced persistence, and command history |
| `src/features/model-studio` | Mobile model list, 3D viewport, outliner, and touch properties sheets |
| `src/core/storage` | Dexie schema and lightweight preferences |
| `src/core/history` | Recovery-snapshot service boundary |
| `src/core/validation` | Stored-schema compatibility checks |
| `src/core/errors` | Structured logging and user-safe error mapping |
| `src/stores` | Pinia application state |
| `src/styles` | Design tokens, themes, safe defaults, and accessibility utilities |
| `src/assets/brand` | Editable SVG sources for the logo mark and PWA icon system |
| `src/types` | Shared domain contracts |

## Project persistence

`AddonsStudioDatabase` schema version 3 has seven IndexedDB tables:

- `projects` stores project metadata, optional folder placement, and schema/revision numbers.
- `snapshots` stores timestamped recovery copies keyed by project.
- `settings` reserves versioned application settings that need IndexedDB later.
- `projectFolders` stores a single, non-nested organization level.
- `models` stores extensible Addons Studio internal models, cube elements, lightweight reference metadata, and editor-background preferences.
- `modelEditorAssets` stores typed reference/background image blobs and dimensions separately so model records and project cards remain lightweight.
- `modelReferenceAssets` remains as a read-compatible Alpha 0.0.3–0.0.3.6 migration store; new image writes use `modelEditorAssets`.

Project creation, duplication, and deletion use Dexie transactions. Deleting a project also removes its snapshots, models, reference blobs, and custom backgrounds in the same logical operation. Duplicating a project creates independent stable IDs for copied models, elements, references, background links, and blobs. Deleting a folder never deletes projects: every contained project moves to the root list in the same transaction before the folder is removed.

Project metadata autosave is debounced to 650 ms after a meaningful change. Successfully saved projects become eligible for a recovery checkpoint approximately every five minutes; at most 15 snapshots are retained per project. Model records use an independent debounced service and flush on page hide or editor exit. Recovery snapshots do not yet include full model history; the persistent model record is the Alpha 0.0.3.6.1 recovery boundary.

The current image importer crops and resizes project icons to 256 × 256 in the browser before storing them. Large future binary assets must use dedicated records and thumbnails rather than being copied into project metadata.

## Model Studio foundation

`StudioModel` is the editor source of truth. Schema version 4 preserves stable cube IDs, absolute model-space transforms, visibility and lock state, future-compatible metadata, one-level group relationships, cube/group pivots, snapping, viewport preferences, Resize direction, control mode, transform space, the future language preference, References 2.0 metadata, and editor-background preferences. Earlier Alpha records normalize on read with centered pivots, empty groups where absent, unlocked model nodes, migrated axial reference guides, and safe default settings; this does not require an IndexedDB reset. Editor gestures never modify raw Minecraft geometry JSON. A later converter will own the explicit `StudioModel → Bedrock Geometry JSON` boundary.

Three.js and `OrbitControls` are dynamically imported only on the Model Studio route. Camera controls remain enabled in the normal modeling workflow: an empty-space drag orbits, pinch zooms, and two fingers pan. A capture-phase picker prevents camera movement when a cube, custom gizmo handle, or active Tactilismo owns the gesture. Tactilismos use a deliberate hold before direct screen-plane Move, radial uniform Resize, or experimental circular single-object Rotate starts; navigation movement or a second finger cancels a pending direct transform. Gizmo and Hybrid modes retain the original custom controls. Perspective, isometric, and six axial views reposition the camera around the current target. One- and two-viewport layouts are implemented; the secondary viewport reduces device-pixel ratio and rendering features, and either panel can be temporarily maximized. Three/four layouts are not exposed as fake actions.

The viewport renders on demand, caps device pixel ratio, responds to rotation/resizing, and disposes geometries, materials, shared editor-image URLs, controls, observers, and pointer listeners on teardown. Cube picking and original Addons Studio transform handles use raycasting. Visible handles stay precise while transparent picker geometry is deliberately thicker for fingers. Axis projection and world-per-pixel sensitivity are frozen at gesture start, near-camera-axis sensitivity is bounded, discontinuous pointer coordinates are rejected, and non-finite or implausible world deltas never reach model data. The world-origin sphere remains removed; the mathematical origin, origin axes, and green grid remain.

The hierarchy service captures only the selected node plus affected children. Cubes remain in absolute model space for backward compatibility. Normal Resize changes dimensions around the visual center; Positive/Negative Side modes move the center by half the size delta along the active Global/Local/Parent axis. Custom pivots are anchors and never become geometry. Group move/rotate/resize operations apply their delta to every child around the shared group pivot, and transform-space rotations use quaternion composition before returning stable XYZ Euler values.

The productivity service normalizes deliberate touch multi-selection, computes rotated cube bounds, and produces compact before/after states for batch Move, Mirror, Align, Distribute, visibility, and locking. Duplicate and Duplicate + Mirror generate new IDs and remap group membership; Duplicate Again applies the last post-duplicate translation to the next copy. Isolation is viewport-only state and never overwrites intended model visibility. The command history treats each batch operation as one undoable command rather than storing entire project copies.

References 2.0 are editor-only, viewport-aligned DOM guides and are never project textures or Three.js scene geometry. Each guide is assigned to Front, Back, Left, Right, Top, or Bottom and supports 2D position, uniform scale, opacity, visibility, horizontal/vertical flips, rename, and optional rotation. The layer has no pointer events, never enters model raycasts or bounds, and each split viewport resolves only its own assigned guides. Legacy 3D reference metadata maps conservatively to the closest axial view and 2D values.

Editor Background is a separate atmosphere layer behind the transparent WebGL canvas. Built-in backgrounds use lightweight original CSS gradients; a custom PNG/JPG uses a dedicated binary asset with fit, opacity, and brightness preferences. The model stores only an asset ID. `ModelEditorAssetRuntime` creates one object URL per open asset, shares it between both viewports, and revokes it after replacement, deletion, model change, or editor teardown. Persistent records always contain the Blob itself—never an object URL or large base64 metadata.

## Extensibility

`ResourceTemplateRegistry` allows future contextual object presets to register without hard-coding them into the Workspace. A future `Block → Slab` template can own only slab-relevant fields, including the term **Collision Box**, without exposing every block property.

The user-facing term **Material** is reserved for the abstraction that will later connect texture, UV, and rendering information. The current Material card and template are architectural placeholders, not a Material editor.

The icon architecture makes the same separation as the product architecture. `AppIcon` wraps Lucide for universal UI actions such as back, close, search, and delete. `StudioIcon` renders only Addons Studio-specific concepts from a typed 24 × 24 registry. Categories and contextual templates reference that registry by type, so an invalid or mismatched product icon fails type checking.

Large future engines should live behind explicit package boundaries:

```text
packages/
  bedrock-core/
  model-engine/
  texture-engine/
  animation-engine/
  particle-engine/
  audio-engine/
  visual-logic/
  addon-builder/
```

Those package-level engines do not exist in Alpha `0.0.3.6.1`. The current in-app Model Studio foundation is intentionally small and can later move behind a `model-engine` boundary without changing stored editor concepts.

## Visual system

The Creative Core Cube is the application mark. Its outer cube represents construction and modular resources; the gold inner cube represents the user’s creative work. The source SVGs are original project assets and do not reproduce Minecraft art or branding.

CSS custom properties define brand and semantic colors, spacing, typography, radii, shadows, transitions, icon sizes, header heights, card padding, and sheet spacing. Components consume these tokens and remain functional in system, light, and dark themes. Resource tones support recognition, but cards also retain labels and distinct icon silhouettes so color is never the only signal.

## Routing and deployment

Major views are lazy-loaded, including the Three.js Model Studio bundle. Hash history avoids static-server fallback requirements and works at `/addons-studio/` on GitHub Pages. Vite derives its production base path from `GITHUB_REPOSITORY` while GitHub Actions is running. The same base is used by PWA manifest and service-worker assets.

## Error and data-safety rules

- Errors map to user-readable messages.
- Toasts are non-destructive and autosave does not spam them.
- A failed save keeps the current UI state open.
- Reference/background attachment or removal updates model metadata and its Blob in one IndexedDB transaction.
- Folder deletion keeps all projects and moves them to the root list.
- No error path clears the project database automatically.
- Temporary-cache clearing targets only caches whose names contain `addons-studio`.
- Unsupported future project schemas fail closed instead of being silently rewritten.
