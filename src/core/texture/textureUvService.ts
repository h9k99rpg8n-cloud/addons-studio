import { AppError } from '@/core/errors/AppError'
import { type AddonsStudioDatabase, studioDatabase } from '@/core/storage/database'
import type { StudioVector3 } from '@/types/model'
import type { StudioTextureBinding, StudioUvRect, TextureFace, UvPrecision } from '@/types/texture'

const rotations = [0, 90, 180, 270] as const
const supportedPrecisions: readonly UvPrecision[] = [0.25, 0.5, 1, 2, 4]
const faces: readonly TextureFace[] = ['north', 'south', 'east', 'west', 'up', 'down']

function normalizePrecision(value: number): UvPrecision {
  return supportedPrecisions.includes(value as UvPrecision) ? value as UvPrecision : 1
}

function snap(value: number, precision: UvPrecision): number {
  return Math.round(value / precision) * precision
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

export function normalizeUvRect(
  uv: StudioUvRect,
  textureWidth: number,
  textureHeight: number,
  requestedPrecision: UvPrecision = 1,
): StudioUvRect {
  const precision = normalizePrecision(requestedPrecision)
  const maxWidth = Math.max(1, Number(textureWidth) || 1)
  const maxHeight = Math.max(1, Number(textureHeight) || 1)
  const width = clamp(snap(Math.max(precision, uv.width), precision), precision, maxWidth)
  const height = clamp(snap(Math.max(precision, uv.height), precision), precision, maxHeight)
  const x = clamp(snap(uv.x, precision), 0, Math.max(0, maxWidth - width))
  const y = clamp(snap(uv.y, precision), 0, Math.max(0, maxHeight - height))
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
): StudioUvRect {
  return normalizeUvRect({
    x,
    y,
    width,
    height,
    rotation: 0,
    flipHorizontal: false,
    flipVertical: false,
  }, textureWidth, textureHeight, 1)
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
  const sx = Math.max(1, Math.abs(size.x))
  const sy = Math.max(1, Math.abs(size.y))
  const sz = Math.max(1, Math.abs(size.z))
  const rawWidth = Math.max(1, 2 * (sx + sz))
  const rawHeight = Math.max(1, sy + 2 * sz)
  const scale = Math.min(1, Math.max(0.01, Math.min(textureWidth / rawWidth, textureHeight / rawHeight)))
  const x = Math.max(1, sx * scale)
  const y = Math.max(1, sy * scale)
  const z = Math.max(1, sz * scale)

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
    const binding = await this.database.textureBindings.get(bindingId)
    if (!binding) throw new AppError('MATERIAL_FAILED', 'This UV binding is no longer available.')
    const saved: StudioTextureBinding = {
      ...binding,
      uv: normalizeUvRect(uv, textureWidth, textureHeight, precision),
      updatedAt: Date.now(),
    }
    await this.database.textureBindings.put(saved)
    return { ...saved, uv: { ...saved.uv } }
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
        return {
          ...current,
          uv: normalizeUvRect(byId.get(current.id) ?? current.uv, textureWidth, textureHeight, precision),
          updatedAt: now,
        }
      })
      await this.database.textureBindings.bulkPut(saved)
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
      1,
    )
  }
}

export const textureUvService = new TextureUvService()
