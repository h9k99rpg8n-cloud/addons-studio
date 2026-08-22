# Addons Studio

Addons Studio is a free, open-source, mobile-first workspace for building Minecraft Bedrock Edition add-ons. It organizes project resources, guides common authoring tasks, and generates Bedrock files without requiring users to write JSON for routine work.

> **Current release:** Alpha `0.1.0` · Rework Update

Addons Studio is an independent community project and is not affiliated with Mojang Studios or Microsoft. Minecraft is a trademark of Microsoft Corporation.

## Rework Update

The Rework Update changes the product direction deliberately. Addons Studio is no longer trying to reproduce every specialized creative editor in one browser tab. It is the project hub that connects Bedrock resources, reusable logic, generated files, and purpose-built tools.

### What works now

- A new original yellow-and-graphite identity, application icon, favicon, and PWA icon family.
- Responsive Home, Create, Assets, Code, World, and Project navigation designed for touch, safe areas, portrait, landscape, tablet, and desktop.
- Local project creation, folders, pinning, recent activity, duplication, safe deletion, recovery snapshots, and IndexedDB persistence.
- A portable Models library with search, folders, `.json`, `.geo.json`, and `.bbmodel` import, download, metadata preview, and Blockbench handoff.
- A project-level Materials image library with PNG/JPEG import, preview, folders, rename, duplicate, move, delete, usage details, and Blockbench handoff.
- Guided standard Block and Block Model creation with identifiers, localized display names, texture modes, lighting, contextual physical properties, a lightweight cube preview, and ZIP export of generated Bedrock source files.
- Versioned `.addonsstudio` package import/export with transactional ID remapping for projects, legacy model records, Rework resources, folders, material images, and bindings.
- English and Spanish UI, light/dark/system themes, installable PWA shell, and GitHub Pages base-path support.

### Specialized-tool integration

Blockbench is the primary modeling, UV, texturing, and animation tool. Addons Studio stores and organizes compatible files, prepares Bedrock geometry, and opens the official Blockbench web application using its documented URL parameters. Large files fall back to a safe download-and-open workflow.

No Blockbench source code or GPL source from Blockbench, bridge., Snowstorm, or another application is copied or bundled. The integration is an external handoff to the user-selected tool; Addons Studio remains an original MIT-licensed implementation.

### Honest scope

The following areas are represented only by product architecture until reliable workflows are implemented:

- Items, Entities, and Plants
- reusable visual Plugins and Functions
- the central Recipes library
- Particles, Sounds, and Animations integrations
- Trees, Biomes, Structures, Ore Generation, and Dimensions
- complete `.mcpack` / `.mcaddon` builds

Unavailable tools are never presented as working buttons. The main Create, Assets, and Code hubs may show clearly labeled, non-interactive roadmap modules so the product structure remains understandable; World tools stay hidden until they generate valid Bedrock content.

## Product philosophy

- Make Bedrock creation understandable without forcing users to edit JSON for common tasks.
- Prefer contextual, vertical workflows over giant forms containing every possible component.
- Treat Blockbench and other specialist tools as integrations, not competitors.
- Keep resources reusable across blocks, items, entities, recipes, and future Plugins.
- Preserve local work before expanding scope.
- Never silently reset IndexedDB or overwrite imported project IDs.
- Keep every important interaction usable without hover, a mouse, or a desktop file-system API.

## Storage and compatibility

Project metadata, folders, imported files, texture images, generated resources, settings, and recovery data are stored in IndexedDB through Dexie. Binary files are stored as blobs rather than large base64 strings in reactive metadata.

Database schema 5 adds generic Rework resource, resource-folder, and binary-asset stores. Existing Alpha `0.0.3.x` Model Core and Alpha `0.0.4.x` Texture Core records are retained for migration and project-package compatibility; their retired in-app editors are not loaded.

## Technology

- Vue 3 + TypeScript
- Vite
- Pinia
- Vue Router with hash history
- Dexie / IndexedDB
- fflate for versioned project and generated-resource ZIP files
- `vite-plugin-pwa` / Workbox
- Lucide for generic interface actions plus original Addons Studio SVG branding
- Vitest + fake IndexedDB

The Rework runtime no longer depends on Three.js. Specialized model editing is delegated to Blockbench.

See [Architecture](docs/ARCHITECTURE.md), [Brand system](docs/BRAND.md), [Rework release notes](docs/releases/0.1.0-rework.md), and [Third-party notices](THIRD_PARTY_NOTICES.md).

## Development

Requirements:

- Node.js 22.12 or newer
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

The production build generates a manifest, install assets, and an offline application shell. Project data remains local to the browser profile.

GitHub Pages deploys the `dist/` build. Vite derives the repository name during GitHub Actions and uses `/addons-studio/` as the production base. Hash routing keeps static-host navigation reliable.

Expected URL: [https://h9k99rpg8n-cloud.github.io/addons-studio/](https://h9k99rpg8n-cloud.github.io/addons-studio/)

## License

Addons Studio is released under the [MIT License](LICENSE).
