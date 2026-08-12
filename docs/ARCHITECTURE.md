# Architecture

This document describes the `0.0.1-dev` mobile foundation. It defines boundaries for future work; it is not a claim that the future editor engines already exist.

## Application layers

| Area | Responsibility |
| --- | --- |
| `src/app` | Root composition and global application shell |
| `src/components/common` | Touch-friendly primitives, dialogs, sheets, feedback, and brand mark |
| `src/components/navigation` | Main mobile navigation and headers |
| `src/components/project` | Reusable project cards, actions, icons, and resource pickers |
| `src/features` | Lazy-loaded route-level product features |
| `src/core/project` | Project rules, version registry, persistence scheduling, and resource templates |
| `src/core/storage` | Dexie schema and lightweight preferences |
| `src/core/history` | Recovery-snapshot service boundary |
| `src/core/validation` | Stored-schema compatibility checks |
| `src/core/errors` | Structured logging and user-safe error mapping |
| `src/stores` | Pinia application state |
| `src/styles` | Design tokens, themes, safe defaults, and accessibility utilities |
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

No engine in that list exists in `0.0.1-dev`.

## Routing and deployment

Major views are lazy-loaded. Hash history avoids static-server fallback requirements and works at `/addons-studio/` on GitHub Pages. Vite derives its production base path from `GITHUB_REPOSITORY` while GitHub Actions is running. The same base is used by PWA manifest and service-worker assets.

## Error and data-safety rules

- Errors map to user-readable messages.
- Toasts are non-destructive and autosave does not spam them.
- A failed save keeps the current UI state open.
- No error path clears the project database automatically.
- Temporary-cache clearing targets only caches whose names contain `addons-studio`.
- Unsupported future project schemas fail closed instead of being silently rewritten.
