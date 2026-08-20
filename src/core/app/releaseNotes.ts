import { APP_RELEASE_NAME, APP_VERSION } from './release'

export interface ReleaseNote {
  version: string
  title: string
  subtitle: string
  highlights: string[]
}

export const RELEASE_NOTES: readonly ReleaseNote[] = [
  {
    version: APP_VERSION,
    title: 'Texture Core Stabilized',
    subtitle: 'Stability, Mobile Polish & Bug Fixes',
    highlights: [
      'UV 2.0 movement, resizing, multi-face editing, atlas bounds, precision, and batch saving are more reliable',
      'Paint 2.0 keeps fast Pencil and Eraser strokes continuous while separating painting from pinch zoom and panning',
      'iPhone and Safari pointer capture, cancellation, safe areas, touch targets, and editor scrolling received focused hardening',
      'The 3D texture preview now refreshes and disposes runtime resources more predictably across model and material changes',
      'Texture persistence avoids duplicate writes and stale async results when switching cubes, faces, materials, or modes quickly',
      'This is a stability and regression-fix release, not a new Texture Core feature phase',
    ],
  },
  {
    version: '0.0.4.2',
    title: 'Texture Core 0.2',
    subtitle: 'UV & Paint Update',
    highlights: [
      'UV 2.0 shows the mapped faces of the selected cuboid together as a visual atlas over the real texture',
      'Auto Box UV generates a compact six-face cuboid net from the model dimensions and keeps it inside the texture',
      'Multi-face selection can apply one material to several faces and reset selected UV islands together',
      'UV precision supports 0.25, 0.5, 1, 2, and 4 px snapping plus Copy, Paste, Fit, Flip, Rotate, and Reset',
      'Paint 2.0 adds Line, Rectangle, Replace Color, opacity, Mirror X/Y, pixel grid, 64-step history, and touch-first pinch zoom',
    ],
  },
  {
    version: '0.0.4.0.1',
    title: 'Texture Core goes visual',
    subtitle: 'Visual Texture Workspace Update',
    highlights: [
      'Texture Core redesigned around a touch-first 3D + UV workspace instead of form-heavy controls',
      'Tap a cuboid face in the 3D preview to select the matching North, South, East, West, Up, or Down UV face',
      'Visual UV island editing with drag, resize handle, 90° rotation, horizontal/vertical flip, Fit, and 1 px precision',
      'Materials redesigned as a reusable visual project library with cleaner mobile Quick Edit',
      'Paint and Quick Edit now use pinch zoom, touch panning, Pixel Inspect, safer mobile inputs, and compact contextual tools',
      'Texture preview camera now fits the real model bounds for a closer Model Studio-like view',
    ],
  },
  {
    version: '0.0.4.0',
    title: 'Texture Core is here',
    subtitle: 'Texture Core Foundation',
    highlights: [
      'New Texture Core resource opens existing Model Core geometry without changing it',
      'Materials library with local PNG/JPEG texture storage and live 3D nearest-neighbor preview',
      'Pixel editor foundation with Pencil, Eraser, Fill, Eyedropper, pixel-size controls, zoom, Undo, Redo, and PNG saving',
      'Per-face material/UV binding foundation with cube and face inspectors',
      'Separate Materials and Texture Core entries now appear in the project workspace',
    ],
  },
  {
    version: '0.0.3.6.3',
    title: 'Model Core Stabilized',
    subtitle: 'Architecture & Stabilization Update',
    highlights: [
      'Model Studio runtime split into focused camera, rendering, gizmo, touch, Inflate, and resource modules',
      'Touch Gizmo Rotate graduated from experimental to an official touch modeling control',
      'Background and modeling-guide rendering consolidated behind one reliable viewport layer',
      'Original pixel-inspired Studio Preview Material 2.0 plus mobile performance and cleanup improvements',
      'Regression hardening for Safari touch, transforms, persistence, import/export, groups, and editor assets',
    ],
  },
  {
    version: '0.0.3.6.2',
    title: 'Snapshot 3',
    subtitle: 'Final Model Core Content Update',
    highlights: [
      'Inflate precision fitting and organizational Model Folders',
      'Touch Gizmo, cleaner viewport controls, and professional precision settings',
      'Portable model JSON plus transactional project import/export beta',
      'English and Spanish, What’s New, and optional local productivity beta tools',
    ],
  },
  {
    version: '0.0.3.6.1',
    title: 'References 2.0',
    subtitle: 'References & Stability Update',
    highlights: [
      'Persistent viewport-aligned modeling guides',
      'Built-in and custom editor backgrounds',
      'Safari image restoration and Resize hardening',
    ],
  },
]

export const CURRENT_RELEASE_NOTE = RELEASE_NOTES[0]!
export const CURRENT_RELEASE_STORAGE_VALUE = `${APP_VERSION}:${APP_RELEASE_NAME}`
