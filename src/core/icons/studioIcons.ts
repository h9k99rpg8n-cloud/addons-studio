export const STUDIO_ICON_NAMES = [
  'project',
  'block',
  'item',
  'entity',
  'model',
  'material',
  'animation',
  'particle',
  'audio',
  'script',
  'function',
  'language',
  'recipe',
  'collision-box',
  'visual-logic',
  'add-resource',
  'workspace',
  'resource-pack',
  'behavior-pack',
  'layers',
  'sparkle',
  'inflate',
] as const

export type StudioIconName = (typeof STUDIO_ICON_NAMES)[number]

export type StudioIconTone =
  | 'brand'
  | 'gold'
  | 'sky'
  | 'violet'
  | 'rose'
  | 'cyan'
  | 'orange'

export interface StudioIconDefinition {
  readonly base: readonly string[]
  readonly accent?: readonly string[]
  readonly fills?: readonly string[]
  readonly dashed?: readonly string[]
}

/**
 * Original Addons Studio product icon family.
 *
 * Every mark uses a 24 × 24 grid, rounded 1.7px strokes, and the same visual
 * padding. Generic actions intentionally remain in Lucide; this registry is
 * reserved for concepts that belong to the Addons Studio product language.
 */
export const STUDIO_ICONS: Readonly<Record<StudioIconName, StudioIconDefinition>> = {
  project: {
    base: [
      'M4.5 6.8 12 2.9l7.5 3.9v10.4L12 21.1l-7.5-3.9Z',
      'M4.5 6.8 12 10.7l7.5-3.9M12 10.7v10.4',
    ],
    accent: ['M8.1 8.65V6.7L12 4.65l3.9 2.05v1.95'],
  },
  block: {
    base: [
      'M4.25 7.2 12 3l7.75 4.2v9.6L12 21l-7.75-4.2Z',
      'M4.25 7.2 12 11.4l7.75-4.2M12 11.4V21',
    ],
    accent: ['m8.05 8.95 3.95-2.1 3.95 2.1L12 11.1Z'],
  },
  item: {
    base: [
      'm12 3.1 6.8 5.35-2.55 9.1L12 21l-4.25-3.45-2.55-9.1Z',
      'm5.2 8.45 6.8 3.4 6.8-3.4M12 11.85V21',
      'm7.75 17.55 4.25-5.7 4.25 5.7',
    ],
    accent: ['m8.65 7.95 3.35-2.3 3.35 2.3L12 9.6Z'],
  },
  entity: {
    base: [
      'M6.2 8.1V4.4l3.2 2.3A8.1 8.1 0 0 1 12 6.25c.9 0 1.78.15 2.6.45l3.2-2.3v3.7c1.45 1.2 2.3 3.05 2.3 5.1 0 4-3.1 6.15-7.1 6.15s-7.1-2.15-7.1-6.15c0-2.05.85-3.9 2.3-5.1Z',
      'M8.5 14.1h.1m6.8 0h.1M9.25 17.15c1.7 1.1 3.8 1.1 5.5 0',
    ],
    accent: ['m10.3 15.4 1.7.95 1.7-.95'],
  },
  model: {
    base: [
      'm6.2 7.7 5.8-3.2 5.8 3.2v7.15L12 18l-5.8-3.15Z',
      'm6.2 7.7 5.8 3.15 5.8-3.15M12 10.85V18',
      'M3.1 5.7V3.1h2.6M18.3 3.1h2.6v2.6M20.9 18.3v2.6h-2.6M5.7 20.9H3.1v-2.6',
    ],
    accent: ['M12 4.5v6.35'],
  },
  material: {
    fills: ['M5.15 15.85c2.8-1.25 4.85-.9 6.85.25 2.05 1.2 4.15 1.55 6.9.2A8.3 8.3 0 0 1 12 20.3a8.3 8.3 0 0 1-6.85-4.45Z'],
    base: [
      'M20.3 12A8.3 8.3 0 1 1 3.7 12a8.3 8.3 0 0 1 16.6 0Z',
      'M5.15 15.85c2.8-1.25 4.85-.9 6.85.25 2.05 1.2 4.15 1.55 6.9.2',
    ],
    accent: ['M7.35 10.25a5.15 5.15 0 0 1 4.25-3.5', 'M7.2 7.8h.1'],
  },
  animation: {
    base: [
      'M5.2 12a6.8 6.8 0 0 1 11.55-4.85M18.8 12a6.8 6.8 0 0 1-11.55 4.85',
      'm14.9 4.9 2.2 2.25 2.35-1.9M9.1 19.1l-2.2-2.25-2.35 1.9',
      'm12 8.25 3.75 3.75L12 15.75 8.25 12Z',
    ],
    accent: ['M12 8.25v7.5'],
  },
  particle: {
    base: [
      'm12 3.2 1.1 3.1L16.2 7.4l-3.1 1.1L12 11.6l-1.1-3.1-3.1-1.1 3.1-1.1Z',
      'm7.1 12.75.75 2.1 2.1.75-2.1.75-.75 2.1-.75-2.1-2.1-.75 2.1-.75Z',
      'm17.2 13.3.65 1.85 1.85.65-1.85.65-.65 1.85-.65-1.85-1.85-.65 1.85-.65Z',
    ],
    accent: ['M16.9 4.1h.1M4.2 8.8h.1M12.1 20.8h.1'],
  },
  audio: {
    base: [
      'M4 9.4h3.6l4.35-3.6v12.4L7.6 14.6H4Z',
      'M15.05 9.1a4.1 4.1 0 0 1 0 5.8M17.55 6.65a7.55 7.55 0 0 1 0 10.7',
    ],
    accent: ['M11.95 5.8v12.4'],
  },
  script: {
    base: [
      'M6.1 3.25h8.1l3.7 3.7v13.8H6.1Z',
      'M14.2 3.25v3.7h3.7',
      'M10.25 10.1c-1.15 0-1.65.55-1.65 1.55v.75c0 .7-.35 1.1-1.05 1.25.7.15 1.05.55 1.05 1.25v.75c0 1 .5 1.55 1.65 1.55M13.75 10.1c1.15 0 1.65.55 1.65 1.55v.75c0 .7.35 1.1 1.05 1.25-.7.15-1.05.55-1.05 1.25v.75c0 1-.5 1.55-1.65 1.55',
    ],
    accent: ['M12 12.1v3.1'],
  },
  function: {
    base: ['M3.6 5.25h16.8v13.5H3.6Z', 'm7.3 9.1 2.9 2.9-2.9 2.9M12.95 14.9h3.75'],
    accent: ['M3.6 8.1h16.8M6.2 6.65h.1m2 0h.1'],
  },
  language: {
    base: [
      'M3.7 5.05h10.15v8.2H8l-3.05 2.4v-2.4H3.7Z',
      'M10.15 10.75v5.05h5.8l3.1 2.4v-2.4h1.25V7.6h-4',
      'M6.4 8.2h4.75M12.85 10.25h4.75M12.85 12.65h3.1',
    ],
    accent: ['M6.4 10.55h2.9'],
  },
  recipe: {
    base: [
      'M3.9 4.2h7.2v7.2H3.9ZM12.9 4.2h7.2v7.2h-7.2ZM3.9 13.2h7.2v7.2H3.9Z',
      'm15.2 15.4 1.5 1.5 3.2-3.2M16.7 16.9l-3.4 3.4',
    ],
    accent: ['M6.45 6.75h2.1v2.1h-2.1ZM15.45 6.75h2.1v2.1h-2.1Z'],
  },
  'collision-box': {
    base: [
      'm4.15 7.15 7.85-4.2 7.85 4.2v9.7L12 21.05l-7.85-4.2Z',
      'm4.15 7.15 7.85 4.2 7.85-4.2M12 11.35v9.7',
    ],
    dashed: ['m7.3 9 4.7-2.5L16.7 9v5.9L12 17.4l-4.7-2.5Z'],
  },
  'visual-logic': {
    base: [
      'M3.6 4.1h5.2v4.4H3.6ZM15.2 15.5h5.2v4.4h-5.2ZM3.6 15.5h5.2v4.4H3.6Z',
      'M8.8 6.3h3.1a2 2 0 0 1 2 2v7.2M8.8 17.7h6.4M13.9 11.9H8.8a2.6 2.6 0 0 0-2.6 2.6v1',
    ],
    accent: ['M13.9 8.3v3.6'],
  },
  'add-resource': {
    base: [
      'm3.8 7.2 7.2-3.9 7.2 3.9v5.25M11 11.1v9.6l-7.2-3.9V7.2ZM3.8 7.2l7.2 3.9 7.2-3.9',
      'M17.8 14v6.4M14.6 17.2H21',
    ],
    accent: ['M11 3.3v7.8'],
  },
  workspace: {
    base: [
      'M3.25 8V3.25H8M16 3.25h4.75V8M20.75 16v4.75H16M8 20.75H3.25V16',
      'm7 9.15 5-2.7 5 2.7v5.7l-5 2.7-5-2.7ZM7 9.15l5 2.7 5-2.7M12 11.85v5.7',
    ],
    accent: ['M12 6.45v5.4'],
  },
  'resource-pack': {
    base: [
      'M4.1 4.25h5l1.45 1.7h9.35v13.8H4.1Z',
      'm7.1 15.7 2.5-2.55 2.1 1.95 2.8-3.05 2.4 3.65ZM14.9 9.4h.1',
    ],
    accent: ['M4.1 8.1h15.8'],
  },
  'behavior-pack': {
    base: [
      'm12 2.9 7.45 4.3v9.6L12 21.1l-7.45-4.3V7.2Z',
      'm12.95 6.5-4.1 6.15h3.35l-1.15 4.85 4.1-6.15H11.8Z',
    ],
    accent: ['M12.95 6.5 11.8 11.35h3.35l-4.1 6.15'],
  },
  layers: {
    base: [
      'm12 3.8 8.25 4.3L12 12.4 3.75 8.1ZM3.75 12.1 12 16.4l8.25-4.3M3.75 16.15 12 20.4l8.25-4.25',
    ],
    accent: ['M12 3.8v8.6'],
  },
  sparkle: {
    base: [
      'm12 3.15 1.45 4.2 4.2 1.45-4.2 1.45L12 14.4l-1.45-4.15-4.2-1.45 4.2-1.45ZM18.1 14.5l.75 2.05 2.05.75-2.05.75-.75 2.05-.75-2.05-2.05-.75 2.05-.75ZM6 14.7l.65 1.75 1.75.65-1.75.65L6 19.5l-.65-1.75-1.75-.65 1.75-.65Z',
    ],
    accent: ['M12 3.15v11.25'],
  },
  inflate: {
    fills: ['M6.2 8.2c1.8-1.75 9.8-1.75 11.6 0 1.65 1.6 1.65 6 0 7.6-1.8 1.75-9.8 1.75-11.6 0-1.65-1.6-1.65-6 0-7.6Z'],
    base: [
      'M6.2 8.2c1.8-1.75 9.8-1.75 11.6 0 1.65 1.6 1.65 6 0 7.6-1.8 1.75-9.8 1.75-11.6 0-1.65-1.6-1.65-6 0-7.6Z',
      'M8.1 10.1c1.25-.85 6.55-.85 7.8 0M8.1 13.9c1.25.85 6.55.85 7.8 0',
    ],
    accent: ['M12 8.65v6.7M9.75 12h4.5'],
  },
}

export function isStudioIconName(value: string): value is StudioIconName {
  return STUDIO_ICON_NAMES.includes(value as StudioIconName)
}
