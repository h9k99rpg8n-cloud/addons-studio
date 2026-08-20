import { describe, expect, it } from 'vitest'

import {
  floodFillPixels,
  linePixels,
  mirroredBrushPixels,
  pushUniquePaintHistory,
  rectanglePixels,
  replaceColorPixels,
  type PaintSnapshot,
} from '@/core/texture/texturePaintService'

function makeSnapshot(value: number): PaintSnapshot {
  return { width: 2, height: 2, data: new Uint8ClampedArray(16).fill(value) }
}

describe('Texture Paint 2.0 core', () => {
  it('deduplicates identical history snapshots and keeps the 64-step limit', () => {
    const history: PaintSnapshot[] = []
    expect(pushUniquePaintHistory(history, makeSnapshot(1))).toBe(true)
    expect(pushUniquePaintHistory(history, makeSnapshot(1))).toBe(false)
    for (let value = 2; value <= 70; value += 1) {
      pushUniquePaintHistory(history, makeSnapshot(value), 64)
    }
    expect(history).toHaveLength(64)
    expect(history.at(-1)?.data[0]).toBe(70)
  })

  it('mirrors every covered pixel for even brushes without shifting the result', () => {
    const pixels = mirroredBrushPixels({ x: 1, y: 2 }, 8, 8, 2, true, true)
    const keys = new Set(pixels.map((point) => `${point.x}:${point.y}`))
    expect(keys).toEqual(new Set([
      '1:2', '2:2', '1:3', '2:3',
      '5:2', '6:2', '5:3', '6:3',
      '1:4', '2:4', '1:5', '2:5',
      '5:4', '6:4', '5:5', '6:5',
    ]))
  })

  it('generates continuous fast-stroke line pixels', () => {
    const points = linePixels({ x: 0, y: 0 }, { x: 12, y: 5 })
    expect(points[0]).toEqual({ x: 0, y: 0 })
    expect(points.at(-1)).toEqual({ x: 12, y: 5 })
    for (let index = 1; index < points.length; index += 1) {
      expect(Math.abs(points[index]!.x - points[index - 1]!.x)).toBeLessThanOrEqual(1)
      expect(Math.abs(points[index]!.y - points[index - 1]!.y)).toBeLessThanOrEqual(1)
    }
  })

  it('creates a one-pixel rectangle outline without duplicate corners', () => {
    const points = rectanglePixels({ x: 1, y: 1 }, { x: 4, y: 3 })
    expect(new Set(points.map((point) => `${point.x}:${point.y}`)).size).toBe(points.length)
    expect(points).toHaveLength(10)
  })

  it('replaces only the exact selected RGBA color and reports no-op replacements', () => {
    const data = new Uint8ClampedArray([
      10, 20, 30, 255,
      10, 20, 30, 128,
      10, 20, 30, 255,
    ])
    expect(replaceColorPixels(data, [10, 20, 30, 255], [90, 80, 70, 64])).toBe(2)
    expect([...data]).toEqual([
      90, 80, 70, 64,
      10, 20, 30, 128,
      90, 80, 70, 64,
    ])
    expect(replaceColorPixels(data, [90, 80, 70, 64], [90, 80, 70, 64])).toBe(0)
  })

  it('fills one connected color region without crossing a boundary', () => {
    const data = new Uint8ClampedArray([
      1, 1, 1, 255, 9, 9, 9, 255,
      1, 1, 1, 255, 9, 9, 9, 255,
    ])
    expect(floodFillPixels(data, 2, 2, { x: 0, y: 0 }, [4, 5, 6, 255])).toBe(2)
    expect([...data]).toEqual([
      4, 5, 6, 255, 9, 9, 9, 255,
      4, 5, 6, 255, 9, 9, 9, 255,
    ])
  })
})
