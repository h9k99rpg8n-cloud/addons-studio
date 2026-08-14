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
