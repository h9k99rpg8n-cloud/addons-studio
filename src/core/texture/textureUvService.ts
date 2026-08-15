import { AppError } from '@/core/errors/AppError'
import { type AddonsStudioDatabase, studioDatabase } from '@/core/storage/database'
import type { StudioTextureBinding, StudioUvRect } from '@/types/texture'

const rotations = [0, 90, 180, 270] as const

export function normalizeUvRect(
  uv: StudioUvRect,
  textureWidth: number,
  textureHeight: number,
): StudioUvRect {
  const maxWidth = Math.max(1, Math.round(textureWidth))
  const maxHeight = Math.max(1, Math.round(textureHeight))
  const width = Math.min(maxWidth, Math.max(1, Math.round(uv.width)))
  const height = Math.min(maxHeight, Math.max(1, Math.round(uv.height)))
  const x = Math.min(maxWidth - width, Math.max(0, Math.round(uv.x)))
  const y = Math.min(maxHeight - height, Math.max(0, Math.round(uv.y)))
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

export class TextureUvService {
  constructor(private readonly database: AddonsStudioDatabase = studioDatabase) {}

  async updateBindingUv(
    bindingId: string,
    uv: StudioUvRect,
    textureWidth: number,
    textureHeight: number,
  ): Promise<StudioTextureBinding> {
    const binding = await this.database.textureBindings.get(bindingId)
    if (!binding) throw new AppError('MATERIAL_FAILED', 'This UV binding is no longer available.')
    const saved: StudioTextureBinding = {
      ...binding,
      uv: normalizeUvRect(uv, textureWidth, textureHeight),
      updatedAt: Date.now(),
    }
    await this.database.textureBindings.put(saved)
    return { ...saved, uv: { ...saved.uv } }
  }
}

export const textureUvService = new TextureUvService()
