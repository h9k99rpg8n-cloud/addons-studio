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
