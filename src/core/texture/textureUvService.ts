import { AppError } from '@/core/errors/AppError'
import { type AddonsStudioDatabase, studioDatabase } from '@/core/storage/database'
import type { StudioVector3 } from '@/types/model'
import type { StudioTextureBinding, StudioUvRect, TextureFace, UvPrecision } from '@/types/texture'

const rotations = [0, 90, 180, 270] as const
const supportedPrecisions: readonly UvPrecision[] = [0.25, 0.5, 1, 2, 4]
const faces: readonly TextureFace[] = ['north', 'south', 'east', 'west', 'up', 'down']
const UV_EPSILON = 1e-6

function normalizePrecision(value: number): UvPrecision {
  return supportedPrecisions.includes(value as UvPrecision) ? value as UvPrecision : 1
}

function snap(value: number, precision: UvPrecision): number {
  const snapped = Math.round(value / precision) * precision
  return Math.round(snapped * 1_000_000) / 1_000_000
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function finiteNumber(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback
}

function atlasDimension(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1
}

export function uvRectsEqual(left: StudioUvRect, right: StudioUvRect): boolean {
  return Math.abs(left.x - right.x) < UV_EPSILON
    && Math.abs(left.y - right.y) < UV_EPSILON
    && Math.abs(left.width - right.width) < UV_EPSILON
    && Math.abs(left.height - right.height) < UV_EPSILON
    && left.rotation === right.rotation
    && left.flipHorizontal === right.flipHorizontal
    && left.flipVertical === right.flipVertical
}

export function normalizeUvRect(
  uv: StudioUvRect,
  textureWidth: number,
  textureHeight: number,
  requestedPrecision: UvPrecision = 1,
): StudioUvRect {
  const precision = normalizePrecision(requestedPrecision)
  const maxWidth = atlasDimension(textureWidth)
  const maxHeight = atlasDimension(textureHeight)
  const minimumWidth = Math.min(precision, maxWidth)
  const minimumHeight = Math.min(precision, maxHeight)
  const width = clamp(
    snap(Math.max(minimumWidth, finiteNumber(uv.width, minimumWidth)), precision),
    minimumWidth,
    maxWidth,
  )
  const height = clamp(
    snap(Math.max(minimumHeight, finiteNumber(uv.height, minimumHeight)), precision),
    minimumHeight,
    maxHeight,
  )
  const x = clamp(
    snap(finiteNumber(uv.x, 0), precision),
    0,
    Math.max(0, maxWidth - width),
  )
  const y = clamp(
    snap(finiteNumber(uv.y, 0), precision),
    0,
    Math.max(0, maxHeight - height),
  )
  const rotation = rotations.includes(uv.rotation) ? uv.rotation : 0
  return {
    x,
    y,
    width,
    height,
    rotation,
    flipHorizontal: Boolean(uv.flipHorizontal),
    flipVertical: Boolean(uv.flipVertical),
  }
}

function makeRect(
  x: number,
  y: number,
  width: number,
  height: number,
  textureWidth: number,
  textureHeight: number,
  precision: UvPrecision = 0.25,
): StudioUvRect {
  return normalizeUvRect({
    x,
    y,
    width,
    height,
    rotation: 0,
    flipHorizontal: false,
    flipVertical: false,
  }, textureWidth, textureHeight, precision)
}

/**
 * Generates a compact Minecraft-style cuboid net for a cube.
 * The layout is deterministic and scales down to stay inside the texture.
 */
export function createBoxUvLayout(
  size: StudioVector3,
  textureWidth: number,
  textureHeight: number,
): Record<TextureFace, StudioUvRect> {
  const minimum = 0.25
  const sx = Math.max(minimum, Math.abs(finiteNumber(size.x, minimum)))
  const sy = Math.max(minimum, Math.abs(finiteNumber(size.y, minimum)))
  const sz = Math.max(minimum, Math.abs(finiteNumber(size.z, minimum)))
  const rawWidth = Math.max(1, 2 * (sx + sz))
  const rawHeight = Math.max(1, sy + 2 * sz)
  const availableWidth = atlasDimension(textureWidth)
  const availableHeight = atlasDimension(textureHeight)
  const scale = Math.min(1, Math.max(0.000_001, Math.min(
    availableWidth / rawWidth,
    availableHeight / rawHeight,
  )))
  const x = Math.max(minimum, sx * scale)
  const y = Math.max(minimum, sy * scale)
  const z = Math.max(minimum, sz * scale)

  return {
    west: makeRect(0, z, z, y, textureWidth, textureHeight),
    north: makeRect(z, z, x, y, textureWidth, textureHeight),
    east: makeRect(z + x, z, z, y, textureWidth, textureHeight),
    south: makeRect(z + x + z, z, x, y, textureWidth, textureHeight),
    up: makeRect(z, 0, x, z, textureWidth, textureHeight),
    down: makeRect(z, z + y, x, z, textureWidth, textureHeight),
  }
}

export function resetUvRect(textureWidth: number, textureHeight: number): StudioUvRect {
  return {
    x: 0,
    y: 0,
    width: Math.max(1, textureWidth),
    height: Math.max(1, textureHeight),
    rotation: 0,
    flipHorizontal: false,
    flipVertical: false,
  }
}

export class TextureUvService {
  constructor(private readonly database: AddonsStudioDatabase = studioDatabase) {}

  async updateBindingUv(
    bindingId: string,
    uv: StudioUvRect,
    textureWidth: number,
    textureHeight: number,
    precision: UvPrecision = 1,
  ): Promise<StudioTextureBinding> {
    return this.database.transaction('rw', this.database.textureBindings, async () => {
      const binding = await this.database.textureBindings.get(bindingId)
      if (!binding) throw new AppError('MATERIAL_FAILED', 'This UV binding is no longer available.')
      const normalized = normalizeUvRect(uv, textureWidth, textureHeight, precision)
      if (uvRectsEqual(binding.uv, normalized)) return { ...binding, uv: { ...binding.uv } }
      const saved: StudioTextureBinding = {
        ...binding,
        uv: normalized,
        updatedAt: Date.now(),
      }
      await this.database.textureBindings.put(saved)
      return { ...saved, uv: { ...saved.uv } }
    })
  }

  async updateManyBindingsUv(
    updates: ReadonlyArray<{ bindingId: string; uv: StudioUvRect }>,
    textureWidth: number,
    textureHeight: number,
    precision: UvPrecision = 1,
  ): Promise<StudioTextureBinding[]> {
    const ids = [...new Set(updates.map((entry) => entry.bindingId))]
    if (!ids.length) return []
    const byId = new Map(updates.map((entry) => [entry.bindingId, entry.uv]))
    return this.database.transaction('rw', this.database.textureBindings, async () => {
      const existing = await this.database.textureBindings.bulkGet(ids)
      if (existing.some((entry) => !entry)) {
        throw new AppError('MATERIAL_FAILED', 'One or more UV bindings are no longer available.')
      }
      const now = Date.now()
      const saved = existing.map((binding) => {
        const current = binding!
        const uv = normalizeUvRect(
          byId.get(current.id) ?? current.uv,
          textureWidth,
          textureHeight,
          precision,
        )
        if (uvRectsEqual(current.uv, uv)) return current
        return {
          ...current,
          uv,
          updatedAt: now,
        }
      })
      const changed = saved.filter((entry, index) => entry !== existing[index])
      if (changed.length) await this.database.textureBindings.bulkPut(changed)
      return saved.map((entry) => ({ ...entry, uv: { ...entry.uv } }))
    })
  }

  async applyBoxLayout(
    modelId: string,
    cubeId: string,
    size: StudioVector3,
    textureWidth: number,
    textureHeight: number,
  ): Promise<StudioTextureBinding[]> {
    const bindings = await this.database.textureBindings
      .where('[modelId+cubeId]')
      .equals([modelId, cubeId])
      .toArray()
    const byFace = new Map(bindings.map((entry) => [entry.face, entry]))
    const missing = faces.filter((face) => !byFace.has(face))
    if (missing.length) {
      throw new AppError('MATERIAL_FAILED', 'Map all six cube faces before applying Box UV.')
    }
    const layout = createBoxUvLayout(size, textureWidth, textureHeight)
    return this.updateManyBindingsUv(
      faces.map((face) => ({ bindingId: byFace.get(face)!.id, uv: layout[face] })),
      textureWidth,
      textureHeight,
      0.25,
    )
  }
}

export const textureUvService = new TextureUvService()
