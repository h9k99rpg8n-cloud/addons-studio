# Changelog

All notable changes to Addons Studio will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project intends to follow semantic versioning once stable release guarantees exist.

## [Unreleased]

### Planned

- Scope to be selected for the next development prompt; no future editor is implied as complete.

## [0.0.3] - 2026-08-12

### Added

- Persistent one-level project folders with create, open, rename, move, and safe-delete flows.
- IndexedDB schema version 2 with dedicated folder, internal model, and reference-asset stores.
- Functional Models resource route with validated Bedrock-style geometry identifiers.
- Lazy-loaded Three.js viewport with touch camera controls, grid, origin, lighting, selection, and safe WebGL fallback.
- Original finger-friendly Move, Rotate, and Resize gizmos with large invisible raycast pickers and live values.
- Multiple cubes, exact numeric transform editing, visibility, renaming, deletion, and mobile outliner.
- PNG/JPG front-reference planes with transform, opacity, visibility, and transactional blob persistence.
- Compact command-based undo/redo and debounced model autosave with save status.
- Tests for schema migration, folder safety, model validation/persistence, references, project duplication, and command history.

### Changed

- Promoted the application identity to Alpha 0.0.3.
- Project duplication now includes independent model, cube, reference, and image-asset copies.
- Project deletion now removes model data and reference blobs in the same transaction.
- Models are the first available contextual resource; unfinished resource types remain explicitly marked “Coming soon.”

### Preserved

- Alpha 0.0.1 project creation, local autosave, recovery snapshots, themes, PWA shell, and CI/Pages architecture.
- Alpha 0.0.2 visual identity, custom product icons, touch components, and mobile safe-area support.

## [0.0.2] - 2026-08-12

### Added

- Original Creative Core Cube brand mark and application icon.
- Coordinated SVG favicon, Safari pinned-tab mark, Apple touch icon, and PWA any/maskable assets.
- Typed Addons Studio product-icon registry covering project, resource, workspace, Collision Box, and Visual Logic concepts.
- Dedicated Material sphere icon that establishes Material as a product abstraction rather than an image file.
- Brand documentation with palette, typography, icon, accessibility, and asset-usage guidance.
- Automated coverage for the icon registry and generated branding assets.

### Changed

- Promoted the application identity to Alpha 0.0.2.
- Formalized color, spacing, radius, shadow, typography, transition, icon-size, card, header, and sheet tokens.
- Refined the welcome and Home experiences, project cards, project list, workspace modules, resource picker, Settings, dialogs, buttons, and empty states.
- Limited Lucide to generic UI actions while product-specific concepts use original Addons Studio SVGs.
- Updated PWA theme colors and installation branding without changing the GitHub Pages base-path architecture.

### Preserved

- Prompt 1 project creation, IndexedDB persistence, project actions, autosave, recovery snapshots, themes, routing, safe areas, offline shell, and CI/Pages workflows.

## [0.0.1-dev] - 2026-08-12

### Added

- Vue 3, TypeScript, Vite, Pinia, and Vue Router application foundation.
- Mobile-first welcome, Home, Projects, Create Project, Workspace, Learn, and Settings views.
- Validated project creation with icon import, project type, target version, and experiments metadata.
- Dexie/IndexedDB project database with project, snapshot, and settings tables.
- Debounced persistence and bounded recovery snapshot architecture.
- Recent-project reopening, rename, duplicate, and confirmed delete flows.
- Reusable resource categories and contextual resource-template registry.
- System, light, and dark design-token themes.
- Accessible dialogs, bottom sheets, toasts, global error handling, and offline indicator.
- Installable PWA assets and offline application shell.
- Foundational automated tests.
- GitHub Actions workflows for CI and GitHub Pages.
- Project, contribution, security, architecture, license, and third-party documentation.

[Unreleased]: https://github.com/h9k99rpg8n-cloud/addons-studio/compare/v0.0.3...HEAD
[0.0.3]: https://github.com/h9k99rpg8n-cloud/addons-studio/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/h9k99rpg8n-cloud/addons-studio/compare/v0.0.1-dev...v0.0.2
[0.0.1-dev]: https://github.com/h9k99rpg8n-cloud/addons-studio/releases/tag/v0.0.1-dev
