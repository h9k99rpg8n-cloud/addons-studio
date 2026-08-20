import { describe, expect, it } from 'vitest'

import { AddonsStudioDatabase } from '@/core/storage/database'
import {
  createBoxUvLayout,
  normalizeUvRect,
  resetUvRect,
  TextureUvService,
} from '@/core/texture/textureUvService'
import type { StudioTextureBinding, UvPrecision } from '@/types/texture'

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

  it.each([0.25, 0.5, 1, 2, 4] as const)('keeps %s px precision inside atlas bounds', (precision) => {
    const uv = normalizeUvRect({
      x: 63.9,
      y: -3.2,
      width: 7.7,
      height: 18.2,
      rotation: 180,
      flipHorizontal: true,
      flipVertical: true,
    }, 64, 32, precision)
    expect(uv.x).toBeGreaterThanOrEqual(0)
    expect(uv.y).toBeGreaterThanOrEqual(0)
    expect(uv.x + uv.width).toBeLessThanOrEqual(64)
    expect(uv.y + uv.height).toBeLessThanOrEqual(32)
    expect(Math.abs(uv.width / precision - Math.round(uv.width / precision))).toBeLessThan(1e-7)
  })

  it('repairs non-finite legacy UV values instead of persisting NaN or Infinity', () => {
    expect(normalizeUvRect({
      x: Number.NaN,
      y: Number.POSITIVE_INFINITY,
      width: Number.NEGATIVE_INFINITY,
      height: Number.NaN,
      rotation: 45 as never,
      flipHorizontal: undefined as never,
      flipVertical: 1 as never,
    }, Number.POSITIVE_INFINITY, 0, 0.25)).toEqual({
      x: 0,
      y: 0,
      width: 0.25,
      height: 0.25,
      rotation: 0,
      flipHorizontal: false,
      flipVertical: true,
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

  it('preserves quarter-pixel detail for decimal-sized cuboids', () => {
    const layout = createBoxUvLayout({ x: 1.5, y: 0.5, z: 0.25 }, 16, 16)
    expect(layout.north).toMatchObject({ x: 0.25, y: 0.25, width: 1.5, height: 0.5 })
    expect(layout.west).toMatchObject({ width: 0.25, height: 0.5 })
    for (const uv of Object.values(layout)) {
      expect(uv.x + uv.width).toBeLessThanOrEqual(16)
      expect(uv.y + uv.height).toBeLessThanOrEqual(16)
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

describe('Texture UV persistence', () => {
  function binding(id: string, updatedAt = 10): StudioTextureBinding {
    return {
      id,
      projectId: 'project',
      modelId: 'model',
      cubeId: 'cube',
      face: 'north',
      materialId: 'material',
      uv: resetUvRect(16, 16),
      updatedAt,
    }
  }

  it('skips identical writes and updates a changed binding once', async () => {
    const database = new AddonsStudioDatabase(`uv-dedup-${crypto.randomUUID()}`)
    const service = new TextureUvService(database)
    try {
      await database.textureBindings.add(binding('binding'))
      const unchanged = await service.updateBindingUv('binding', resetUvRect(16, 16), 16, 16)
      expect(unchanged.updatedAt).toBe(10)

      const changed = await service.updateBindingUv('binding', {
        ...resetUvRect(16, 16),
        x: 4,
        width: 8,
      }, 16, 16, 1)
      expect(changed.uv).toMatchObject({ x: 4, width: 8 })
      expect(changed.updatedAt).toBeGreaterThan(10)

      const duplicate = await service.updateBindingUv('binding', changed.uv, 16, 16, 1)
      expect(duplicate.updatedAt).toBe(changed.updatedAt)
    } finally {
      database.close()
      await database.delete()
    }
  })

  it('deduplicates batch IDs and preserves unchanged timestamps', async () => {
    const database = new AddonsStudioDatabase(`uv-batch-${crypto.randomUUID()}`)
    const service = new TextureUvService(database)
    try {
      await database.textureBindings.bulkAdd([
        binding('first', 20),
        { ...binding('second', 30), face: 'south' },
      ])
      const updates: Array<{ bindingId: string; uv: StudioTextureBinding['uv'] }> = [
        { bindingId: 'first', uv: resetUvRect(16, 16) },
        { bindingId: 'first', uv: resetUvRect(16, 16) },
        { bindingId: 'second', uv: { ...resetUvRect(16, 16), width: 8 } },
      ]
      const saved = await service.updateManyBindingsUv(updates, 16, 16, 0.5 as UvPrecision)
      expect(saved).toHaveLength(2)
      expect(saved.find((entry) => entry.id === 'first')?.updatedAt).toBe(20)
      expect(saved.find((entry) => entry.id === 'second')?.uv.width).toBe(8)
    } finally {
      database.close()
      await database.delete()
    }
  })
})
