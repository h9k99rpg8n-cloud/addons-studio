# Addons Studio Brand System

This document defines the visual identity introduced in Alpha `0.0.2`. The system is intentionally compact: it should make a small mobile interface recognizable without making the product heavy.

## Chosen direction: Creative Core Cube

The final mark is an original geometric cube containing a smaller gold cube.

- The outer cube represents construction, modular add-on resources, and a shared workspace.
- The inner gold core represents the user’s idea being shaped by studio tools.
- Green keeps continuity with the foundation release while becoming a deliberate family rather than a single accent.
- Gold gives creation actions and Material concepts a warm secondary signal.

The mark is block-inspired but does not copy a Minecraft block, texture, typeface, grass motif, creeper face, or official brand asset.

## Concepts explored

Three directions were compared before implementation:

1. **Open Cube + Spark** — an outlined cube with a separate sparkle. Clear at large sizes, but the sparkle became generic and visually fragile as a favicon.
2. **Edited Cube** — a cube with a cut corner resembling a selection or modeling operation. It communicated editing, but the silhouette read as incomplete at home-screen size.
3. **Creative Core Cube** — a solid modular cube with a contrasting inner core. It retained the strongest small-size silhouette, connected naturally to the product architecture, and supplied both a logo mark and an app icon. This direction was selected.

## Palette

| Role | Dark UI | Light UI | Purpose |
| --- | --- | --- | --- |
| Primary | `#42D47A` | `#269653` | Brand, creation, active states |
| Primary deep | `#168B4B` | `#116638` | Cube depth and strong brand detail |
| Secondary | `#F0B94D` | `#D9951C` | Creative core, Material, selective emphasis |
| Canvas | `#0B1016` | `#F3F7F4` | Application background |
| Surface | `#121A23` | `#FFFFFF` | Cards, dialogs, sheets |
| Text | `#F1F6F3` | `#15221B` | Primary content |

Semantic success, info, warning, and danger colors are separate tokens. Resource modules also have named brand, gold, sky, violet, rose, cyan, and orange tones. A tone supports recognition but never replaces a text label or unique silhouette.

## Typography and shape

Addons Studio uses the device’s rounded system sans stack for a native, lightweight result and a system monospace stack for namespaces and technical identifiers. Headings are compact with negative letter spacing; supporting copy keeps a relaxed line height.

Cards use the documented radius and shadow scales. Interactive controls maintain at least 44 × 44 CSS pixels. Motion is brief and uses the shared easing token, and all motion collapses under `prefers-reduced-motion`.

## Icon architecture

The icon system has two explicit layers:

- `AppIcon.vue` wraps Lucide for generic actions: back, close, settings, search, add, delete, rename, duplicate, import, information, and warnings.
- `StudioIcon.vue` renders original Addons Studio concepts from `src/core/icons/studioIcons.ts`.

Studio icons use a 24 × 24 grid, 1.7px rounded strokes, common optical padding, one base color, and an optional secondary accent. The typed registry includes Project, Block, Item, Entity, Model, Material, Animation, Particle, Audio, Script, Function, Language, Recipe, Collision Box, Visual Logic, Add Resource, and Workspace marks.

Material intentionally uses a sphere/material-ball silhouette with a highlight and lower shading region. It must not be replaced by a generic image-file icon.

## Assets

Editable sources live in `src/assets/brand/`:

- `addons-studio-mark.svg` — transparent logo mark.
- `addons-studio-app-icon.svg` — rounded application icon source.
- `addons-studio-maskable.svg` — full-bleed safe-zone source for adaptive masks.

Deployment assets live in `public/` and are referenced with Vite base-aware paths:

- `icon.svg`
- `safari-pinned-tab.svg`
- `apple-touch-icon.png`
- `pwa-192x192.png`
- `pwa-512x512.png`
- `pwa-maskable-512x512.png`

Do not stretch, rotate, add Minecraft textures to, recolor one face arbitrarily, or remove the gold core from the primary mark. Monochrome usage is reserved for platform contexts such as Safari pinned tabs.

## Licensing

The Creative Core Cube and the Studio icon family were created for Addons Studio and are distributed with the project under the MIT License. No GPL application source or proprietary Minecraft artwork is included.
