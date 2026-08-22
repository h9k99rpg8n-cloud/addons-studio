# Addons Studio Rework Brand System

The Rework identity positions Addons Studio as a professional Bedrock creation workspace rather than a generic dashboard or game-themed toy.

## Logo

The original mark combines three ideas in one heavy, small-size silhouette:

- a simplified isometric construction block;
- crossed black creation tools;
- a yellow rounded application tile.

The block suggests modular Bedrock content without copying an official Minecraft texture, grass block, logo, or typeface. The crossed tools communicate building and configuration. Thick geometry keeps the mark legible as an iPhone home-screen icon and favicon.

The primary wordmark uses the product's geometric, heavy system-sans typography. Technical identifiers continue to use the monospace stack.

## Palette

| Role | Dark UI | Light UI | Purpose |
| --- | --- | --- | --- |
| Brand yellow | `#F5C518` | `#DFAE00` | Primary actions, active navigation, progress, key icons |
| Yellow highlight | `#FFDC55` | `#8D6E00` | Accessible accent text and focus details |
| Graphite canvas | `#0C0D10` | `#F3F3F1` | Application background |
| Surface | `#15171C` | `#FFFFFF` | Cards, dialogs, sheets, forms |
| Raised surface | `#1C1F25` | `#F7F7F5` | Nested controls and contextual actions |
| Primary text | `#F7F7F5` | `#17181B` | Main content |

Yellow is an accent, not a page fill. It marks the action or state that matters while graphite and neutral surfaces carry the interface. Success, warning, error, and info remain separate semantic colors and never depend on color alone.

## Shape, spacing, and motion

- Important controls keep a minimum 44 × 44 CSS-pixel target.
- Cards use a compact radius scale and restrained elevation.
- Inputs use at least 16 CSS pixels on iPhone to avoid Safari focus zoom.
- Bottom navigation includes `safe-area-inset-bottom`; headers and content include every relevant safe-area inset.
- Motion is brief and collapses under `prefers-reduced-motion`.
- Hover is enhancement only; every workflow remains available to touch and keyboard users.

## Icon architecture

`AppIcon.vue` uses Lucide for generic actions such as back, add, import, delete, search, menu, and settings. Product-specific concepts remain represented by original Addons Studio SVG definitions where appropriate.

The Material identity is an image/resource concept in the Rework product. It is never presented as a fake paint editor. Model, Block, Block Model, Assets, Code, World, and Project use consistent optical sizing and the shared yellow/neutral color system.

## Assets

Editable sources:

- `src/assets/brand/addons-studio-mark.svg`
- `src/assets/brand/addons-studio-app-icon.svg`
- `src/assets/brand/addons-studio-maskable.svg`

PWA/browser outputs:

- `public/icon.svg`
- `public/safari-pinned-tab.svg`
- `public/apple-touch-icon.png`
- `public/pwa-192x192.png`
- `public/pwa-512x512.png`
- `public/pwa-maskable-512x512.png`

Do not add Minecraft textures, creeper faces, official wordmarks, or third-party tool artwork to the logo. Do not replace the black-on-yellow silhouette with the retired green identity.

## Licensing

The Rework mark and application assets are original Addons Studio work distributed under the MIT License. No GPL application source or proprietary Minecraft artwork is included.
