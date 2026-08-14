import { AppError } from '@/core/errors/AppError'
import { type AddonsStudioDatabase, studioDatabase } from '@/core/storage/database'
import type {
  StudioMaterial,
  StudioTextureAsset,
  StudioTextureBinding,
  TextureFace,
  TextureWorkspaceSummary,
} from '@/types/texture'
import { createId } from '@/utils/createId'

import { inspectTextureImage, type TextureImageInspector } from './textureImageValidation'

function cloneMaterial(material: StudioMaterial): StudioMaterial {
  return { ...material }
}

function cloneAsset(asset: StudioTextureAsset): StudioTextureAsset {
  return { ...asset }
}

function cloneBinding(binding: StudioTextureBinding): StudioTextureBinding {
  return { ...binding, uv: { ...binding.uv } }
}

function normalizeIdentifier(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 96)
}

export class TextureRepository {
  constructor(
    private readonly database: AddonsStudioDatabase = studioDatabase,
    private readonly inspectImage: TextureImageInspector = inspectTextureImage,
  ) {}

  async getWorkspace(modelId: string): Promise<TextureWorkspaceSummary> {
    const [materials, assets, bindings] = await Promise.all([
      this.database.materials.where('modelId').equals(modelId).toArray(),
      this.database.textureAssets.where('modelId').equals(modelId).toArray(),
      this.database.textureBindings.where('modelId').equals(modelId).toArray(),
    ])
    return {
      materials: materials.map(cloneMaterial).sort((a, b) => a.createdAt - b.createdAt),
      assets: assets.map(cloneAsset).sort((a, b) => a.createdAt - b.createdAt),
      bindings: bindings.map(cloneBinding).sort((a, b) => a.updatedAt - b.updatedAt),
    }
  }

  async countMaterials(projectId: string): Promise<number> {
    return this.database.materials.where('projectId').equals(projectId).count()
  }

  async createMaterial(input: {
    projectId: string
    modelId: string
    name: string
    identifier?: string
  }): Promise<StudioMaterial> {
    const model = await this.database.models.get(input.modelId)
    if (!model || model.projectId !== input.projectId) {
      throw new AppError('MODEL_NOT_FOUND', 'This model is no longer available in the project.')
    }
    const name = input.name.trim().slice(0, 80)
    if (!name) throw new AppError('MATERIAL_FAILED', 'Give this material a name.')
    const base = normalizeIdentifier(input.identifier || name) || 'material'
    const identifier = await this.findAvailableIdentifier(input.projectId, base)
    const now = Date.now()
    const material: StudioMaterial = {
      id: createId(),
      projectId: input.projectId,
      modelId: input.modelId,
      name,
      identifier,
      createdAt: now,
      updatedAt: now,
      revision: 1,
    }
    try {
      await this.database.materials.add(material)
      return cloneMaterial(material)
    } catch (error) {
      throw new AppError('MATERIAL_FAILED', 'Addons Studio could not create this material.', {
        cause: error instanceof Error ? error : undefined,
      })
    }
  }

  async renameMaterial(materialId: string, name: string): Promise<StudioMaterial> {
    const existing = await this.database.materials.get(materialId)
    if (!existing) throw new AppError('MATERIAL_FAILED', 'This material is no longer available.')
    const nextName = name.trim().slice(0, 80)
    if (!nextName) throw new AppError('MATERIAL_FAILED', 'Give this material a name.')
    const saved: StudioMaterial = {
      ...existing,
      name: nextName,
      updatedAt: Date.now(),
      revision: existing.revision + 1,
    }
    await this.database.materials.put(saved)
    return cloneMaterial(saved)
  }

  async importTexture(materialId: string, file: File): Promise<{
    material: StudioMaterial
    asset: StudioTextureAsset
  }> {
    const material = await this.database.materials.get(materialId)
    if (!material) throw new AppError('MATERIAL_FAILED', 'Create or select a material first.')
    const inspection = await this.inspectImage(file)
    const now = Date.now()
    const asset: StudioTextureAsset = {
      id: createId(),
      projectId: material.projectId,
      modelId: material.modelId,
      name: file.name.replace(/\.[^.]+$/, '') || material.name,
      mimeType: inspection.mimeType,
      blob: file.slice(0, file.size, inspection.mimeType),
      width: inspection.width,
      height: inspection.height,
      createdAt: now,
      updatedAt: now,
    }
    try {
      return await this.database.transaction(
        'rw',
        [this.database.materials, this.database.textureAssets],
        async () => {
          const previousAssetId = material.textureAssetId
          const savedMaterial: StudioMaterial = {
            ...material,
            textureAssetId: asset.id,
            updatedAt: now,
            revision: material.revision + 1,
          }
          await this.database.textureAssets.add(asset)
          await this.database.materials.put(savedMaterial)
          if (previousAssetId && previousAssetId !== asset.id) {
            await this.database.textureAssets.delete(previousAssetId)
          }
          return { material: cloneMaterial(savedMaterial), asset: cloneAsset(asset) }
        },
      )
    } catch (error) {
      if (error instanceof AppError) throw error
      throw new AppError('TEXTURE_FAILED', 'Addons Studio could not store this texture.', {
        cause: error instanceof Error ? error : undefined,
      })
    }
  }

  async replaceTexturePixels(assetId: string, blob: Blob, width: number, height: number): Promise<StudioTextureAsset> {
    const existing = await this.database.textureAssets.get(assetId)
    if (!existing) throw new AppError('TEXTURE_FAILED', 'This texture is no longer available.')
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1 || width > 4096 || height > 4096) {
      throw new AppError('TEXTURE_FAILED', 'The edited texture dimensions are invalid.')
    }
    const saved: StudioTextureAsset = {
      ...existing,
      mimeType: 'image/png',
      blob: blob.slice(0, blob.size, 'image/png'),
      width: Math.round(width),
      height: Math.round(height),
      updatedAt: Date.now(),
    }
    await this.database.textureAssets.put(saved)
    return cloneAsset(saved)
  }

  async saveFaceBinding(input: {
    projectId: string
    modelId: string
    cubeId: string
    face: TextureFace
    materialId: string
    textureWidth: number
    textureHeight: number
  }): Promise<StudioTextureBinding> {
    const existing = await this.database.textureBindings
      .where('[modelId+cubeId]')
      .equals([input.modelId, input.cubeId])
      .filter((binding) => binding.face === input.face)
      .first()
    const now = Date.now()
    const binding: StudioTextureBinding = {
      id: existing?.id ?? createId(),
      projectId: input.projectId,
      modelId: input.modelId,
      cubeId: input.cubeId,
      face: input.face,
      materialId: input.materialId,
      uv: existing?.uv ?? {
        x: 0,
        y: 0,
        width: Math.max(1, input.textureWidth),
        height: Math.max(1, input.textureHeight),
        rotation: 0,
        flipHorizontal: false,
        flipVertical: false,
      },
      updatedAt: now,
    }
    await this.database.textureBindings.put(binding)
    return cloneBinding(binding)
  }

  async deleteMaterial(materialId: string): Promise<void> {
    const material = await this.database.materials.get(materialId)
    if (!material) return
    await this.database.transaction(
      'rw',
      [this.database.materials, this.database.textureAssets, this.database.textureBindings],
      async () => {
        await this.database.materials.delete(materialId)
        await this.database.textureBindings.where('materialId').equals(materialId).delete()
        if (material.textureAssetId) await this.database.textureAssets.delete(material.textureAssetId)
      },
    )
  }

  async deleteForModel(modelId: string): Promise<void> {
    const materials = await this.database.materials.where('modelId').equals(modelId).toArray()
    await this.database.transaction(
      'rw',
      [this.database.materials, this.database.textureAssets, this.database.textureBindings],
      async () => {
        await this.database.materials.where('modelId').equals(modelId).delete()
        await this.database.textureAssets.where('modelId').equals(modelId).delete()
        await this.database.textureBindings.where('modelId').equals(modelId).delete()
      },
    )
    void materials
  }

  private async findAvailableIdentifier(projectId: string, preferred: string): Promise<string> {
    let candidate = preferred
    let suffix = 2
    while (await this.database.materials.where('[projectId+identifier]').equals([projectId, candidate]).count()) {
      candidate = `${preferred.slice(0, 86)}_${suffix}`
      suffix += 1
    }
    return candidate
  }
}

export const textureRepository = new TextureRepository()
