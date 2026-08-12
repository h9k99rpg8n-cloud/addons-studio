# Addons Studio

Addons Studio is a free and open-source, mobile-first web application for creating Minecraft Bedrock Edition add-ons. The long-term goal is a complete creative environment that works directly from a phone, tablet, or desktop browser without assuming a mouse or desktop filesystem.

> **Current release:** Alpha `0.0.2` · Visual Identity and Icon System

Addons Studio is an independent community project and is not affiliated with Mojang Studios or Microsoft. Minecraft is a trademark of Microsoft Corporation.

## What works in Alpha 0.0.2

- First-launch welcome experience
- Local project creation with validated namespaces
- Add-on, Resource Pack, and Behavior Pack project foundations
- Maintained Minecraft Bedrock target-version registry
- Built-in project icons and local PNG/JPG icon import
- IndexedDB project persistence through Dexie
- Debounced autosave infrastructure and bounded recovery snapshots
- Recent projects, reopen, rename, duplicate, and confirmed deletion
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

This release does **not** generate `.mcaddon` or `.mcpack` files and does not include model, texture, animation, particle, audio, code, or visual-logic editors. Those buttons are not simulated.

## Mobile-first principles

The primary targets are iPhone/Safari, Android/Chrome, iPad, Android tablets, and installed mobile PWAs. The interface uses bottom navigation, full-screen flows, bottom sheets, large touch targets, dynamic viewport units, and all four `safe-area-inset-*` values. Desktop support is useful but secondary.

The product architecture deliberately avoids desktop-only filesystem assumptions. Project metadata is stored in IndexedDB because the File System Access API is not consistently available on mobile Safari.

## Technology

- Vue 3 and TypeScript
- Vite
- Pinia
- Vue Router with hash history for static-host reliability
- Dexie / IndexedDB
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

Clearing browser site data can remove local projects. A future release will add real import/export and recovery management; users should not treat this Alpha as their only copy of important work.

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
