# Addons Studio

Addons Studio is a free and open-source, mobile-first web application for creating Minecraft Bedrock Edition add-ons. The long-term goal is a complete creative environment that works directly from a phone, tablet, or desktop browser without assuming a mouse or desktop filesystem.

> **Current release:** Alpha `0.0.3.6.2` · Snapshot 3 · Final Model Core Content Update

Addons Studio is an independent community project and is not affiliated with Mojang Studios or Microsoft. Minecraft is a trademark of Microsoft Corporation.

## What works in Alpha 0.0.3.6.2

- First-launch welcome experience
- Local project creation with validated namespaces
- Add-on, Resource Pack, and Behavior Pack project foundations
- Maintained Minecraft Bedrock target-version registry
- Built-in project icons and local PNG/JPG icon import
- IndexedDB project persistence through Dexie
- Debounced autosave infrastructure and bounded recovery snapshots
- Recent projects, reopen, rename, duplicate, and confirmed deletion
- One-level project folders with create, open, rename, safe delete, and move-to-root/folder actions
- Mobile Project Workspace with reusable resource categories
- Extensible contextual resource-template registry
- Explicit “Coming soon” states for unimplemented editors
- System, light, and dark themes
- Accessible dialogs, focus states, and 44 × 44 CSS-pixel touch targets
- PWA manifest, service worker, offline app shell, and installable icons
- GitHub Pages subpath-safe build and deployment workflow
- Original Creative Core Cube app mark with coordinated favicon and PWA assets
- Custom, typed SVG icon family for Addons Studio resources and workspace concepts
- Formalized brand, semantic-color, spacing, radius, shadow, typography, and motion tokens
- Refined Home, project cards, workspace modules, resource sheet, Settings, and empty states
- Functional Models resource list with validated `geometry.namespace.name` identifiers
- Lazy-loaded Three.js Model Studio with lighting, a Bedrock-unit green grid, origin axes, standard camera views, and touch navigation that remains available while modeling
- One- and two-viewport layouts with independent views, active-panel feedback, temporary maximize, and a lower-power secondary renderer
- Multiple-cube creation, touch selection, duplication, finger-sized custom Move/Rotate/Resize/Pivot gizmo pickers, exact numeric transforms, and configurable snapping
- Correct center-preserving Resize on X/Y/Z, directional positive/negative-side Resize, fixed gesture projection, and spike safeguards for predictable mobile resizing
- Focused Model Studio Settings navigation for controls, Resize, independent Move/Resize/Rotate precision, camera sensitivity, appearance, language, experiments, and a safe preferences-only reset
- Classic Gizmos, official Touch Gizmo, and Hybrid controls with hold-to-move, radial uniform Resize, and opt-in experimental circular Rotate while empty-space orbit, pinch zoom, and two-finger pan remain available
- Deliberate touch multi-selection through the viewport or Outliner, with batch Move, Duplicate, Delete, visibility, locking, isolation, and Move to Group actions
- Mirror in place and Duplicate + Mirror on X/Y/Z, bounds-based Min/Center/Max alignment, even distribution, and repeatable Duplicate Again offsets
- Structural model Groups plus organizational Model Folders (one nested folder level) with explicit limits, safe deletion, autosave, JSON portability, and separate icons/behavior
- Animation-ready cube/group pivots with direct XYZ editing, Center, Reset, and Pivot to Origin actions
- Mobile outliner with expandable groups, selection checkboxes, explicit hidden/locked status, touch action menus, and safe access to locked objects
- References 2.0 with multiple PNG/JPG viewport guides assigned independently to Front, Back, Left, Right, Top, or Bottom; guides support 2D position, scale, opacity, visibility, flips, and optional rotation without entering Three.js raycasting or model bounds
- Procedural Dark Studio, Sky, Night, Sunset, and Snow editor environments plus persistent custom PNG/JPG backgrounds with Fit, Fill, Stretch, opacity, and brightness controls
- Dedicated binary editor-asset storage, safe legacy reference migration, shared per-session object URLs across split viewports, and deterministic cleanup when references, models, or projects are deleted
- Command-based hierarchy undo/redo plus debounced model autosave and explicit save status
- Inflate precision fitting with mobile-sized corner, edge, and face targets; fitting adjusts independent cuboid boundaries without welding geometry
- Per-viewport compact camera-view, transform-space, maximize, and restore controls that replace duplicated permanent toolbar actions
- Original lightweight Studio Preview Material palette that improves untextured cuboid legibility on dark and bright editor environments
- Full English/Spanish localization infrastructure and persisted language selection without translating identifiers, namespaces, or JSON keys
- Validated canonical Addons Studio `.model.json` export plus adapter-based import for Studio JSON and compatible Minecraft Bedrock geometry JSON
- Transactional `.addonsstudio` project package import/export beta with manifest preview, ID remapping, project-folder preservation, editor assets, storage checks, and staged progress
- Versioned What’s New / Release Notes plus optional local-only Developer Beta timers, daily routine, notifications fallback, and opt-in usage-time summaries

This release does **not** generate `.mcaddon` or `.mcpack` files. The new `.model.json` and `.addonsstudio` formats are Addons Studio portability formats, not Bedrock add-on builds. Bones, UV mapping, materials, texture painting, animation, particles, audio, code, and visual logic remain unimplemented and are not simulated. Multi-selection currently exposes shared gizmo Move rather than unsafe multi-object Rotate/Resize handles, Touch Rotate remains experimental, Inflate currently requires axis-aligned cubes, and three/four viewport layouts stay deferred until mobile performance is validated. References are axial 2D guides and are intentionally hidden in Perspective and Isometric views.

## Mobile-first principles

The primary targets are iPhone/Safari, Android/Chrome, iPad, Android tablets, and installed mobile PWAs. The interface uses bottom navigation, full-screen flows, bottom sheets, large touch targets, dynamic viewport units, and all four `safe-area-inset-*` values. Desktop support is useful but secondary.

The product architecture deliberately avoids desktop-only filesystem assumptions. Project metadata, folders, internal models, and separate editor-image blobs are stored in IndexedDB because the File System Access API is not consistently available on mobile Safari. Runtime object URLs are recreated when Model Studio opens and revoked when their assets leave the session; they are never treated as persistent identifiers.

## Technology

- Vue 3 and TypeScript
- Vite
- Pinia
- Vue Router with hash history for static-host reliability
- Dexie / IndexedDB
- Three.js, lazy-loaded only for Model Studio
- fflate for versioned local project ZIP packages
- `vite-plugin-pwa` / Workbox
- Lucide for generic interface actions and an original Addons Studio SVG product-icon family
- Vitest and fake IndexedDB for tests

See [Architecture](docs/ARCHITECTURE.md), [Brand system](docs/BRAND.md), and [Third-party notices](THIRD_PARTY_NOTICES.md) for details.

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

Preview the production output:

```bash
npm run preview
```

The production bundle is written to `dist/`.

## PWA and offline behavior

The production build generates a web app manifest and service worker. After the app has been loaded successfully, the application shell can launch without a network connection. Project data is local and does not require a server.

Clearing browser site data can remove local projects. Snapshot 3 adds beta project-package import/export, but users should still verify imported copies and keep independent backups of important work.

## GitHub Pages

The `Deploy GitHub Pages` workflow builds from `main`, uploads `dist/` with the official Pages artifact action, and deploys it with the official Pages deployment action. Vite derives the repository name during GitHub Actions and sets the base to `/addons-studio/`; the router uses hash history so deep links remain valid on static hosting.

Repository administrators must set **Settings → Pages → Build and deployment → Source** to **GitHub Actions** once if Pages is not already enabled.

Expected project URL:

`https://h9k99rpg8n-cloud.github.io/addons-studio/`

## Project philosophy

- Create original, maintainable implementations.
- Study other tools only for workflows, concepts, and UX inspiration.
- Do not copy GPL source from Blockbench, bridge., or other incompatible projects.
- Keep dependencies intentional and license-compatible with the MIT project.
- Prefer contextual creation flows over screens containing every possible Bedrock property.
- Never present unfinished features as working.
- Protect local work before adding ambitious editors.

Future engines are expected to become isolated packages such as `bedrock-core`, `model-engine`, `texture-engine`, `animation-engine`, `particle-engine`, `audio-engine`, `visual-logic`, and `addon-builder`. They are not implemented in this release.

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a change. Please report security issues using the process in [SECURITY.md](SECURITY.md).

## License

Addons Studio is released under the [MIT License](LICENSE).
