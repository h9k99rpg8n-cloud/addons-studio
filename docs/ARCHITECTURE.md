# Architecture

This document describes the Addons Studio Alpha `0.0.3.6.3` architecture after the first-generation Model Core stabilization. Texture Core, Animation Core, and complete Bedrock add-on export are still future systems.

## Application layers

| Area | Responsibility |
| --- | --- |
| `src/app` | Root composition and global application shell |
| `src/components/common` | Touch-friendly primitives, dialogs, sheets, feedback, and brand mark |
| `src/components/navigation` | Main mobile navigation and headers |
| `src/components/project` | Reusable project cards, actions, icons, and resource pickers |
| `src/core/app` | Product release metadata and release notes |
| `src/core/icons` | Typed original Addons Studio product-icon registry |
| `src/core/project` | Project rules, version registry, persistence scheduling, and resource templates |
| `src/core/model` | Model domain, transforms, hierarchy, Inflate math, folders, productivity operations, validation, persistence, history, and portability |
| `src/core/i18n` | English-source / Spanish message catalog that never rewrites technical IDs |
| `src/core/productivity` | Opt-in local Developer Beta timers, routine, and usage records |
| `src/features/model-studio` | Model Studio product UI and its isolated 3D runtime modules |
| `src/core/storage` | Dexie schema and lightweight preferences |
| `src/core/history` | Recovery-snapshot service boundary |
| `src/core/validation` | Stored-schema compatibility checks |
| `src/core/errors` | Structured logging and user-safe error mapping |
| `src/stores` | Pinia application state |
| `src/styles` | Design tokens, themes, safe defaults, and accessibility utilities |
| `src/types` | Shared domain contracts |

## Source-of-truth rule

`StudioModel` is the source of truth for editable model data. Three.js is a renderer and interaction runtime only.

Persisted model data never stores `THREE.Scene`, `THREE.Mesh`, cameras, materials, renderers, `OrbitControls`, or other Three.js objects. Editor gestures convert pointer input into changes to `StudioModel`; the renderer then reflects those changes.

This boundary allows Addons Studio to change viewport implementation without changing the portable model format.

## Model Core domain

The core model layer remains independent from Vue and the DOM. It owns:

- cube and group contracts
- model folders
- pivots
- hierarchy transforms
- Global / Local / Parent transform math
- center-preserving and directional Resize
- Mirror, Align, Distribute, Duplicate, and Duplicate Again
- multi-selection calculations
- Inflate fitting math
- validation
- command history state
- `.model.json` adapters and serialization
- persistence normalization and migration helpers

Model Folders are editor organization only. Structural Groups affect child transforms. Those concepts remain deliberately separate.

## Model Studio runtime modules

Alpha `0.0.3.6.3` removes major rendering responsibilities from the Vue viewport component and places them behind focused runtime modules under `src/features/model-studio/runtime`.

### `threeSceneRuntime.ts`

Creates and disposes the Three.js scene, transparent renderer, camera, `OrbitControls`, lighting, grid, origin axes, selection outline, runtime groups, and editor preview materials. Heavy Three.js objects stay in ordinary TypeScript variables and are never placed inside deep Vue reactivity.

### `cameraRuntime.ts`

Owns camera sensitivity, touch navigation profiles, standard camera views, renderer resize behavior, and device-pixel-ratio limits.

### `modelMeshRuntime.ts`

Maps `StudioModel` cuboids to disposable Three.js meshes. It does not own geometry truth. Stable cube IDs choose stable preview-material variants so untextured models do not randomly change appearance after reload.

### `classicGizmoRuntime.ts`

Owns Addons Studio's original Move, Rotate, Resize, and Pivot gizmo geometry. Visible handles remain precise while larger invisible picker geometry gives fingers a larger hit target. The editor does not use default Three.js `TransformControls`.

### `touchGizmoRuntime.ts`

Owns direct-touch transform updates. Touch Gizmo Move, Resize, and Rotate are official Model Core interactions in `0.0.3.6.3`. Touch Rotate is no longer gated as an experimental tool.

### `inflateRuntime.ts`

Owns Three.js visualization and raycast targets for Inflate. The actual Inflate fitting calculations remain in `src/core/model/modelInflate.ts`, keeping rendering separate from geometry logic.

### `viewportMath.ts`

Contains shared screen-space calculations, camera-profile factors, stable material hashing, and the common CSS-pixel touch deadzone.

### `viewportSelection.ts`

Contains viewport-facing selection helpers and the separation between the geometry/selection center and the persisted Pivot.

### `viewportResources.ts`

Owns disposal helpers and the original Studio Preview Material 2.0 runtime assets.

### `BackgroundGuideLayer.vue`

Presents editor environment backgrounds and viewport-aligned modeling guides as one rendering layer. Existing guide/reference records remain compatible and are not converted into model geometry.

## Touch ownership and camera safety

Model Studio uses deterministic pointer ownership. UI sheets lock viewport interaction. Within the viewport, Inflate and classic gizmo pickers receive priority before direct transforms, cube selection, or camera navigation.

A shared CSS-pixel deadzone distinguishes taps from intentional drags. A second finger cancels a pending direct transform so pinch zoom and two-finger pan remain available. When a gizmo or Touch Gizmo owns a pointer, `OrbitControls` is temporarily disabled and restored afterward.

World-per-pixel sensitivity is bounded and pointer discontinuities are rejected before they can produce invalid transform deltas. These safeguards prevent the historical giant-cube Resize failure on mobile Safari.

## Rendering and battery policy

Model Studio renders on demand instead of running a permanent idle animation loop. Rendering occurs when camera state, geometry, selection, gizmos, editor background, or viewport dimensions change.

The primary viewport caps device pixel ratio. The secondary split viewport uses a lower-power configuration. Runtime teardown disposes controls, geometry, materials, preview textures, observers, pointer listeners, WebGL renderer resources, and editor-image object URLs owned by the asset runtime.

## Studio Preview Material 2.0

Untextured cuboids use an original Addons Studio editor-only pixel-inspired preview. A tiny generated `DataTexture` uses nearest-neighbor sampling and muted material variants to distinguish adjacent cuboids while clearly remaining a temporary editor visualization.

The preview is not a Minecraft texture and is never exported as one. Future Texture Core integration will replace the preview at render time when a real material/texture binding exists.

## Background / Guide

Environment backgrounds and modeling guides share one user-facing workflow but remain distinct data concepts.

Environment backgrounds include Dark Studio, Sky, Night, Sunset, Snow, and a persistent custom image. Modeling guides remain viewport-aligned image records assigned to axial views. Guides have no pointer events, never enter Three.js raycasting, never affect model bounds, and never export as geometry.

Persistent editor images live as Blob records in IndexedDB. Runtime object URLs are recreated per editor session and revoked during replacement, deletion, model changes, or teardown. Object URLs and large base64 strings are never treated as persistent identifiers.

## Project persistence

`AddonsStudioDatabase` keeps project metadata, recovery snapshots, project folders, models, editor assets, and migration-compatible legacy reference records in IndexedDB. Project creation, duplication, deletion, and package import use transactions where data integrity requires them.

Model autosave remains debounced and flushes on editor exit/page hide. The `0.0.3.6.3` runtime refactor does not reset IndexedDB or replace the stored model schema merely to reorganize rendering code.

## Portability

Canonical `.model.json` export remains a versioned Addons Studio model document containing editable geometry, groups, folders, transforms, pivots, hierarchy relationships, and safe metadata. Binary editor backgrounds/guides remain outside the primary JSON document.

JSON import continues through explicit format detection and adapters rather than treating arbitrary JSON as a model.

The beta `.addonsstudio` project package remains a versioned ZIP container with transactional import, ID remapping, model/editor records, binary editor assets, and duplicate-project protection.

## Localization and mobile UI

English remains the source language and Spanish is officially supported. Identifiers, namespaces, JSON keys, and file extensions never change with UI language.

Interactive Model Studio text/number fields retain an effective 16 CSS-pixel size where required to avoid iPhone Safari focus zoom. Product interaction targets continue to follow the project's mobile touch-target standard.

## Future engine boundaries

Large future engines should remain isolated from Model Core. The intended long-term shape remains:

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

Alpha `0.0.3.6.3` prepares the Model Core boundary but does not pretend those future packages already exist.

The next major product branch is planned as Alpha `0.0.4` — Texture Core. Model Core should be consumed by that engine rather than rewritten by it.
