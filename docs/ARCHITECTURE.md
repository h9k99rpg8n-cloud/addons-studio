# Rework Architecture

Addons Studio Alpha `0.1.0` is a mobile-first Bedrock project hub. The application owns project organization, guided resource data, local persistence, validation, generation, and integrations. Specialized applications own specialized editing.

## Product areas

| Area | Responsibility |
| --- | --- |
| Home | Recent/pinned projects, import, active project, recently edited resources |
| Create | Models library, guided Blocks, Block Models, future Items/Entities/Plants |
| Assets | Reusable project Materials and future particle/audio/animation integrations |
| Code | Future reusable Plugins, Functions, and central Recipes |
| World | Future finished world-generation workflows only |
| Project | Metadata, project-level navigation, portability, and local storage context |

The same six areas are rendered as a safe-area-aware mobile bottom bar and as a desktop/tablet side rail. Routes are lazy-loaded and use hash history for GitHub Pages.

## Source boundaries

| Path | Responsibility |
| --- | --- |
| `src/core/resources` | Generic versioned project resources, folders, and binary assets |
| `src/core/bedrock` | Bedrock file generation; no browser UI or renderer state |
| `src/core/integrations` | External tool adapters and handoff contracts |
| `src/core/project` | Project metadata, folders, recovery, duplication, and packages |
| `src/core/texture` | Compatibility storage plus the project image/material repository |
| `src/features/blocks` | Guided Block and Block Model orchestration |
| `src/features/model-studio/ModelsView.vue` | Rework model file library; the old modeling runtime is removed |
| `src/features/texture-core/MaterialsView.vue` | Rework image library; the old UV/Paint runtime is removed |

Vue views orchestrate repositories and services. Binary data stays outside deep reactivity. Bedrock generation and file inspection are independently testable TypeScript modules.

## Resource model

`StudioResource<TPayload>` is the extensible project resource envelope:

- stable resource ID and project ID;
- resource type;
- human name and optional Bedrock identifier;
- optional organizational folder;
- versioned payload;
- created/updated timestamps and revision.

`StudioResourceAsset` stores imported model, image, audio, or document blobs separately. Payloads refer to asset IDs rather than embedding base64 content.

Current typed payloads include:

- `ModelResourcePayload`: format, binary asset, original filename, and inspected metadata;
- `BlockResourcePayload`: identity, translations, texture assignments, lighting, physical settings, recipes/plugins references, and optional custom-model settings.

Future Items, Entities, Plants, Plugins, Functions, Recipes, and world resources can add payload adapters without changing the resource envelope.

## Storage and migration

Dexie schema 5 adds:

- `resources`
- `resourceFolders`
- `resourceAssets`

Existing stores for projects, recovery snapshots, project folders, internal legacy models, editor assets, materials, texture blobs, and texture bindings remain intact. No migration clears IndexedDB. Legacy editor data is retained for import/export and future explicit migration, but the retired Three.js and Paint/UV views are not routed or bundled.

Project duplication remaps project, resource, folder, asset, material, model, and binding IDs. Project deletion removes all owned records transactionally.

`.addonsstudio` package format 2 adds Rework data and binary assets while continuing to import format 1 packages. Import follows read → validate → remap → transaction. Existing projects are never overwritten silently.

## Blockbench integration

`blockbenchIntegration.ts` detects:

- Minecraft Bedrock geometry JSON;
- Blockbench `.bbmodel` JSON;
- legacy Addons Studio `.model.json`, converted to portable Bedrock geometry for handoff.

Small JSON payloads use the official Blockbench web-app URL parameters (`loadtype`, `loadname`, `loaddata`). Payloads that would make an unsafe URL are downloaded and Blockbench is opened separately for manual import. Blockbench remains external; its GPL source is not bundled, copied, or modified here.

## Block generation

The guided block editor stores a typed project resource and can generate a ZIP containing Bedrock source files:

- behavior-pack block definition;
- optional loot table;
- resource-pack terrain texture map and image blobs;
- localized `.lang` files;
- optional custom geometry;
- a separate Addons Studio metadata record and understandable warnings.

Unsupported or unfinished systems are not fabricated. Vibrant Visuals color, recipe, and Plugin metadata is preserved with warnings until a supported generator exists.

## Mobile and accessibility guarantees

- 44 CSS-pixel touch targets for important actions.
- 16 CSS-pixel editable controls on iPhone.
- no hover-only functionality.
- safe-area insets on headers, page gutters, sheets, and bottom navigation.
- no desktop File System Access API dependency.
- responsive portrait/landscape layouts with no intended horizontal page overflow.
- semantic controls, focus-visible states, reduced-motion support, and textual state labels.

## PWA and performance

The PWA precaches the lightweight application shell and branding under the repository base path. Heavy Three.js runtime code has been removed from dependencies and route chunks. Imported blobs are loaded only by the library view that needs them, and runtime object URLs are revoked by preview components.

Future node, particle, or audio integrations must remain isolated and lazy rather than expanding startup cost.
