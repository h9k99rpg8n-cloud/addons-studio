# Architecture

This document describes the Alpha `0.0.2` mobile foundation and visual system. It defines boundaries for future work; it is not a claim that the future editor engines already exist.

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
| `src/core/storage` | Dexie schema and lightweight preferences |
| `src/core/history` | Recovery-snapshot service boundary |
| `src/core/validation` | Stored-schema compatibility checks |
| `src/core/errors` | Structured logging and user-safe error mapping |
| `src/stores` | Pinia application state |
| `src/styles` | Design tokens, themes, safe defaults, and accessibility utilities |
| `src/assets/brand` | Editable SVG sources for the logo mark and PWA icon system |
| `src/types` | Shared domain contracts |

## Project persistence

`AddonsStudioDatabase` currently has three IndexedDB tables:

- `projects` stores project metadata and schema/revision numbers.
- `snapshots` stores timestamped recovery copies keyed by project.
- `settings` reserves versioned application settings that need IndexedDB later.

Project creation and deletion use Dexie transactions. Deleting a project also removes its snapshots in the same logical operation. Autosave is debounced to 650 ms after a meaningful change. Successfully saved projects become eligible for a recovery checkpoint approximately every five minutes; at most 15 snapshots are retained per project.

The current image importer crops and resizes project icons to 256 × 256 in the browser before storing them. Large future binary assets must use dedicated records and thumbnails rather than being copied into project metadata.

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

No engine in that list exists in Alpha `0.0.2`.

## Visual system

The Creative Core Cube is the application mark. Its outer cube represents construction and modular resources; the gold inner cube represents the user’s creative work. The source SVGs are original project assets and do not reproduce Minecraft art or branding.

CSS custom properties define brand and semantic colors, spacing, typography, radii, shadows, transitions, icon sizes, header heights, card padding, and sheet spacing. Components consume these tokens and remain functional in system, light, and dark themes. Resource tones support recognition, but cards also retain labels and distinct icon silhouettes so color is never the only signal.

## Routing and deployment

Major views are lazy-loaded. Hash history avoids static-server fallback requirements and works at `/addons-studio/` on GitHub Pages. Vite derives its production base path from `GITHUB_REPOSITORY` while GitHub Actions is running. The same base is used by PWA manifest and service-worker assets.

## Error and data-safety rules

- Errors map to user-readable messages.
- Toasts are non-destructive and autosave does not spam them.
- A failed save keeps the current UI state open.
- No error path clears the project database automatically.
- Temporary-cache clearing targets only caches whose names contain `addons-studio`.
- Unsupported future project schemas fail closed instead of being silently rewritten.
