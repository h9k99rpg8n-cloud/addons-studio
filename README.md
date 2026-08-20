# Addons Studio

Addons Studio is a free and open-source, mobile-first web application for creating Minecraft Bedrock Edition add-ons. The long-term goal is a complete creative environment that works directly from a phone, tablet, or desktop browser without assuming a mouse or desktop filesystem.

> **Current release:** Alpha `0.0.4.3` · Texture Core Stability Update

Addons Studio is an independent community project and is not affiliated with Mojang Studios or Microsoft. Minecraft is a trademark of Microsoft Corporation.

## Alpha 0.0.4.3

This release closes the first Texture Core development era with a focused stability, mobile-input, performance, persistence, and regression-fixing pass. It deliberately adds no large creative system before the Materials phase.

### Texture Core

- Project-scoped reusable materials with locally persisted PNG/JPEG texture assets and model-specific face bindings.
- UV 2.0 visual atlas editing, synchronized cube/face selection, multi-face selection, Auto Box UV, 0.25/0.5/1/2/4 px precision, Copy/Paste, Rotate, Flip, Fit, and Reset.
- Paint 2.0 Pencil, Eraser, Fill, Eyedropper, Line, Rectangle, Replace Color, opacity, pixel grid, exact X/Y mirroring, 64-step deduplicated history, pinch zoom, and two-finger pan.
- Lightweight Three.js textured-cuboid preview with face raycasting, selected-face feedback, model fitting, nearest-neighbor filtering, and on-demand rendering.
- Transactional IndexedDB storage for materials, immutable texture blobs, and per-face UV bindings without embedding binary data in model JSON.

### Stability work

- UV rectangles are normalized against the active atlas after every gesture or command; non-finite legacy values and texture-size changes repair safely without a destructive database migration.
- UV writes are coalesced per binding, unchanged records are skipped, multi-face assignment is atomic, and navigation waits for pending UV/Paint persistence.
- Fast Paint strokes use coalesced pointer samples plus pixel-line interpolation, while a touch deadzone prevents taps and pinch gestures from creating accidental marks.
- Paint persistence targets the exact source texture asset even when the user switches cube, face, material, model, or mode quickly.
- Safari pointer capture/cancellation, safe areas, 16 px editable controls, 44 px touch targets, landscape sizing, overflow, context menus, and page-scroll conflicts received focused hardening.
- Project/model deletion and project duplication now preserve the ownership rules for project materials, texture assets, and model-specific bindings.

### Preserved Model Core

- Lazy-loaded Three.js Model Studio with a Bedrock-unit grid, lighting, standard camera views, one/two viewport layouts, temporary maximize, and lower-power secondary rendering.
- Multiple cuboids with exact transforms, custom Addons Studio Move/Rotate/Resize/Pivot gizmos, adaptive screen-space gizmo sizing, and larger invisible finger hit targets.
- Correct center-preserving and positive/negative directional Resize with pointer-discontinuity and giant-transform spike protection.
- Official Touch Gizmo Move, Resize, and Rotate plus Hybrid and Classic Gizmo control modes.
- Global / Local / Parent transform spaces and independent Move/Resize/Rotate precision.
- Multi-selection, structural Groups, organizational Model Folders, pivots, visibility, locking, isolation, Mirror, Align, Distribute, Duplicate, Duplicate Again, and Inflate fitting.
- Command-based undo/redo and debounced model autosave.
- Original Studio Preview Material 2.0 for untextured cuboids; Texture Core owns real texture authoring and its isolated preview.
- Background / Guide workflow with Dark Studio, Sky, Night, Sunset, Snow, custom backgrounds, and viewport-aligned PNG/JPG modeling guides.
- Canonical validated Addons Studio `.model.json` export and adapter-based import for Studio JSON and compatible Minecraft Bedrock geometry JSON.

### Modular runtime

Model Studio no longer concentrates its complete Three.js implementation in one viewport file. Alpha `0.0.3.6.3` introduces focused runtime modules for:

- scene/WebGL lifecycle
- camera controls and views
- cuboid mesh synchronization
- classic gizmos
- Touch Gizmo transforms
- Inflate visualization and picking
- shared viewport math/deadzone behavior
- selection helpers
- preview-material/resource lifetime
- Background / Guide composition

`StudioModel` remains the renderer-independent source of truth. Three.js objects are runtime-only and stay outside persistent model data and deep Vue reactivity.

### Projects and portability

- Local project creation with validated namespaces and maintained Bedrock target versions.
- IndexedDB persistence through Dexie, debounced autosave, bounded recovery snapshots, project folders, recent projects, rename, duplicate, and safe delete.
- Transactional `.addonsstudio` project package import/export beta with manifest validation, project preview, ID remapping, folder preservation, editor assets, storage checks, and rollback.
- Dedicated binary editor-asset storage instead of large base64 blobs inside model metadata.

### Mobile-first

Primary targets are iPhone/Safari, Android/Chrome, iPad, Android tablets, and installed PWAs. The UI keeps touch-sized controls, safe-area support, dynamic viewport sizing, Safari-safe editable input sizes, camera locking while sheets/menus own the gesture, and deterministic pointer ownership between gizmos, geometry, Inflate, Touch Gizmo, and camera navigation.

### Language and release experience

- English and Spanish UI with persisted language choice.
- Versioned What's New / Release Notes.
- Optional local-only Developer Beta timers, routine checklist, notification fallback, and foreground usage summaries.

## Not implemented yet

Alpha `0.0.4.3` does **not** implement the future Materials Core, advanced mesh/vertex UV editing, layers or selection tools in Paint, Animation Core, bones, particles, audio editing, visual logic, or complete `.mcpack` / `.mcaddon` generation.

The next major development phase is **Materials**. Alpha 0.0.4.3 intentionally does not start it.

## Mobile-first principles

The product architecture avoids desktop-only filesystem assumptions. Project metadata, folders, internal models, editor-image blobs, materials, texture assets, and UV bindings are stored in IndexedDB because the File System Access API is not consistently available on mobile Safari. Runtime object URLs are recreated for the active editor and revoked when assets leave the session; they are never treated as persistent identifiers.

## Technology

- Vue 3 + TypeScript
- Vite
- Pinia
- Vue Router with hash history
- Dexie / IndexedDB
- Three.js, lazy-loaded for Model Studio
- fflate for versioned local project packages
- `vite-plugin-pwa` / Workbox
- Lucide for generic interface actions plus an original Addons Studio SVG product-icon family
- Vitest + fake IndexedDB

See [Architecture](docs/ARCHITECTURE.md), [Brand system](docs/BRAND.md), [0.0.4.3 release notes](docs/releases/0.0.4.3.md), and [Third-party notices](THIRD_PARTY_NOTICES.md).

## Development

Requirements:

- Node.js 24 (Node 22.12 or newer is supported)
- npm

```bash
npm ci
npm run dev
```

Quality checks:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## PWA and GitHub Pages

The production build generates a web app manifest and service worker. After the application shell has loaded successfully it can launch without a network connection, while project data remains local.

GitHub Pages deploys the `dist/` production build. Vite derives the repository name during GitHub Actions and uses `/addons-studio/` as the production base. Hash routing keeps static-host deep links reliable.

Expected project URL:

`https://h9k99rpg8n-cloud.github.io/addons-studio/`

## Project philosophy

- Create original, maintainable implementations.
- Study other tools for concepts and workflows, not for copying incompatible source, shaders, textures, or assets.
- Keep dependencies intentional and license-compatible with the MIT project.
- Prefer contextual creation flows over screens containing every possible Bedrock property.
- Never present unfinished features as working.
- Protect local work before adding ambitious editors.
- Keep future engines isolated so Model, Texture, Animation, Particle, Audio, Visual Logic, and Add-on Builder can evolve independently.

## License

Addons Studio is released under the [MIT License](LICENSE).
