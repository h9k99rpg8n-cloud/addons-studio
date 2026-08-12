import 'fake-indexeddb/auto'

import { vi } from 'vitest'

const matchMedia = vi.fn().mockImplementation((query: string) => ({
  matches: query.includes('dark'),
  media: query,
  onchange: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
  dispatchEvent: vi.fn(),
}))

Object.defineProperty(globalThis, 'matchMedia', {
  configurable: true,
  writable: true,
  value: matchMedia,
})
