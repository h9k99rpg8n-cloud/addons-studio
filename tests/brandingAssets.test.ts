import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { APP_RELEASE_LABEL, APP_VERSION } from '@/core/app/release'

const root = resolve(import.meta.dirname, '..')

function readPngDimensions(path: string): { width: number; height: number } {
  const data = readFileSync(resolve(root, path))
  return {
    width: data.readUInt32BE(16),
    height: data.readUInt32BE(20),
  }
}

describe('release metadata and branding assets', () => {
  it('keeps visible release metadata aligned with package metadata', () => {
    const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
      version: string
    }

    expect(APP_VERSION).toBe(packageJson.version)
    expect(APP_RELEASE_LABEL).toBe('Alpha 0.0.3')
  })

  it.each([
    ['public/apple-touch-icon.png', 180],
    ['public/pwa-192x192.png', 192],
    ['public/pwa-512x512.png', 512],
    ['public/pwa-maskable-512x512.png', 512],
  ] as const)('renders %s at the declared square size', (path, size) => {
    expect(readPngDimensions(path)).toEqual({ width: size, height: size })
    expect(statSync(resolve(root, path)).size).toBeGreaterThan(1_000)
  })

  it('ships vector sources for browser and editable brand usage', () => {
    for (const path of [
      'public/icon.svg',
      'public/safari-pinned-tab.svg',
      'src/assets/brand/addons-studio-mark.svg',
      'src/assets/brand/addons-studio-app-icon.svg',
      'src/assets/brand/addons-studio-maskable.svg',
    ]) {
      expect(readFileSync(resolve(root, path), 'utf8')).toContain('<svg')
    }
  })
})
