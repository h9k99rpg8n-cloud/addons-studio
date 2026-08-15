import { describe, expect, it } from 'vitest'

import { normalizeUvRect } from '@/core/texture/textureUvService'

describe('Texture UV visual editing', () => {
  it('snaps visual UV movement and resize to whole pixels', () => {
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
})
