import { describe, expect, it } from 'vitest'

import { createBoxUvLayout, normalizeUvRect, resetUvRect } from '@/core/texture/textureUvService'

describe('Texture UV 2.0', () => {
  it('keeps whole-pixel snapping as the default', () => {
    expect(normalizeUvRect({
      x: 4.6,
      y: 7.2,
      width: 11.7,
      height: 8.4,
      rotation: 90,
      flipHorizontal: true,
      flipVertical: false,
    }, 32, 32)).toEqual({
      x: 5,
      y: 7,
      width: 12,
      height: 8,
      rotation: 90,
      flipHorizontal: true,
      flipVertical: false,
    })
  })

  it('supports sub-pixel UV precision without leaving the texture', () => {
    expect(normalizeUvRect({
      x: 4.6,
      y: 7.2,
      width: 11.7,
      height: 8.4,
      rotation: 0,
      flipHorizontal: false,
      flipVertical: false,
    }, 32, 32, 0.5)).toEqual({
      x: 4.5,
      y: 7,
      width: 11.5,
      height: 8.5,
      rotation: 0,
      flipHorizontal: false,
      flipVertical: false,
    })
  })

  it('keeps UV islands inside the texture canvas', () => {
    expect(normalizeUvRect({
      x: 30,
      y: -4,
      width: 12,
      height: 40,
      rotation: 270,
      flipHorizontal: false,
      flipVertical: true,
    }, 32, 16)).toEqual({
      x: 20,
      y: 0,
      width: 12,
      height: 16,
      rotation: 270,
      flipHorizontal: false,
      flipVertical: true,
    })
  })

  it('builds a deterministic six-face Box UV net from cuboid dimensions', () => {
    const layout = createBoxUvLayout({ x: 8, y: 8, z: 8 }, 64, 64)
    expect(layout.north).toMatchObject({ x: 8, y: 8, width: 8, height: 8 })
    expect(layout.south).toMatchObject({ x: 24, y: 8, width: 8, height: 8 })
    expect(layout.east).toMatchObject({ x: 16, y: 8, width: 8, height: 8 })
    expect(layout.west).toMatchObject({ x: 0, y: 8, width: 8, height: 8 })
    expect(layout.up).toMatchObject({ x: 8, y: 0, width: 8, height: 8 })
    expect(layout.down).toMatchObject({ x: 8, y: 16, width: 8, height: 8 })
  })

  it('scales oversized Box UV nets down to the available texture', () => {
    const layout = createBoxUvLayout({ x: 32, y: 48, z: 16 }, 32, 32)
    for (const uv of Object.values(layout)) {
      expect(uv.x).toBeGreaterThanOrEqual(0)
      expect(uv.y).toBeGreaterThanOrEqual(0)
      expect(uv.x + uv.width).toBeLessThanOrEqual(32)
      expect(uv.y + uv.height).toBeLessThanOrEqual(32)
    }
  })

  it('resets one UV island to the full material texture', () => {
    expect(resetUvRect(32, 16)).toEqual({
      x: 0,
      y: 0,
      width: 32,
      height: 16,
      rotation: 0,
      flipHorizontal: false,
      flipVertical: false,
    })
  })
})
