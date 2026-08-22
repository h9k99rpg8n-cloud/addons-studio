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
import { normalizeUvRect, uvRectsEqual } from './textureUvService'

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
    return this.database.transaction(
      'rw',
      [this.database.models, this.database.materials, this.database.textureAssets, this.database.textureBindings],
      async () => {
        const model = await this.database.models.get(modelId)
        if (!model) throw new AppError('MODEL_NOT_FOUND', 'This model is no longer available in the project.')
        const [materials, assets, bindings] = await Promise.all([
          this.database.materials.where('projectId').equals(model.projectId).toArray(),
          this.database.textureAssets.where('projectId').equals(model.projectId).toArray(),
          this.database.textureBindings.where('modelId').equals(modelId).toArray(),
        ])
        const materialsById = new Map(materials.map((material) => [material.id, material]))
        const assetsById = new Map(assets.map((asset) => [asset.id, asset]))
        const repairedAt = Date.now()
        const normalizedBindings = bindings.map((binding) => {
          const material = materialsById.get(binding.materialId)
          const asset = material?.textureAssetId ? assetsById.get(material.textureAssetId) : undefined
          const uv = normalizeUvRect(binding.uv, asset?.width ?? 16, asset?.height ?? 16, 0.25)
          return uvRectsEqual(binding.uv, uv) ? binding : { ...binding, uv, updatedAt: repairedAt }
        })
        const repaired = normalizedBindings.filter((binding, index) => binding !== bindings[index])
        if (repaired.length) await this.database.textureBindings.bulkPut(repaired)
        return {
          materials: materials.map(cloneMaterial).sort((a, b) => a.createdAt - b.createdAt),
          assets: assets.map(cloneAsset).sort((a, b) => a.createdAt - b.createdAt),
          bindings: normalizedBindings.map(cloneBinding).sort((a, b) => a.updatedAt - b.updatedAt),
        }
      },
    )
  }

  async listMaterials(projectId: string): Promise<StudioMaterial[]> {
    return (await this.database.materials.where('projectId').equals(projectId).toArray())
      .map(cloneMaterial)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async listTextureAssets(projectId: string): Promise<StudioTextureAsset[]> {
    return (await this.database.textureAssets.where('projectId').equals(projectId).toArray())
      .map(cloneAsset)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async getMaterial(materialId: string): Promise<StudioMaterial | undefined> {
    const material = await this.database.materials.get(materialId)
    return material ? cloneMaterial(material) : undefined
  }

  async getTextureAsset(assetId: string): Promise<StudioTextureAsset | undefined> {
    const asset = await this.database.textureAssets.get(assetId)
    return asset ? cloneAsset(asset) : undefined
  }

  async countMaterials(projectId: string): Promise<number> {
    return this.database.materials.where('projectId').equals(projectId).count()
  }

  async createMaterial(input: {
    projectId: string
    name: string
    identifier?: string
    folderId?: string
    /** Transitional caller compatibility; materials themselves remain project-scoped. */
    modelId?: string
  }): Promise<StudioMaterial> {
    const project = await this.database.projects.get(input.projectId)
    if (!project) throw new AppError('PROJECT_NOT_FOUND', 'This project is no longer available on this device.')
    const name = input.name.trim().slice(0, 80)
    if (!name) throw new AppError('MATERIAL_FAILED', 'Give this material a name.')
    const base = normalizeIdentifier(input.identifier || name) || 'material'
    const identifier = await this.findAvailableIdentifier(input.projectId, base)
    const now = Date.now()
    const material: StudioMaterial = {
      id: createId(),
      projectId: input.projectId,
      name,
      identifier,
      folderId: input.folderId,
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

  async moveMaterial(materialId: string, folderId?: string): Promise<StudioMaterial> {
    const existing = await this.database.materials.get(materialId)
    if (!existing) throw new AppError('MATERIAL_FAILED', 'This material is no longer available.')
    if (folderId) {
      const folder = await this.database.resourceFolders.get(folderId)
      if (!folder || folder.projectId !== existing.projectId || folder.resourceType !== 'material') {
        throw new AppError('MATERIAL_FAILED', 'The selected material folder is no longer available.')
      }
    }
    const saved = { ...existing, folderId, updatedAt: Date.now(), revision: existing.revision + 1 }
    await this.database.materials.put(saved)
    return cloneMaterial(saved)
  }

  async duplicateMaterial(materialId: string): Promise<{ material: StudioMaterial; asset?: StudioTextureAsset }> {
    const source = await this.database.materials.get(materialId)
    if (!source) throw new AppError('MATERIAL_FAILED', 'This material is no longer available.')
    const sourceAsset = source.textureAssetId
      ? await this.database.textureAssets.get(source.textureAssetId)
      : undefined
    const now = Date.now()
    const identifier = await this.findAvailableIdentifier(source.projectId, `${source.identifier}_copy`)
    const asset = sourceAsset ? {
      ...sourceAsset,
      id: createId(),
      blob: sourceAsset.blob,
      createdAt: now,
      updatedAt: now,
    } : undefined
    const material: StudioMaterial = {
      ...source,
      id: createId(),
      name: `${source.name.slice(0, 75)} Copy`,
      identifier,
      textureAssetId: asset?.id,
      createdAt: now,
      updatedAt: now,
      revision: 1,
    }
    await this.database.transaction('rw', [this.database.materials, this.database.textureAssets], async () => {
      if (asset) await this.database.textureAssets.add(asset)
      await this.database.materials.add(material)
    })
    return { material: cloneMaterial(material), asset: asset ? cloneAsset(asset) : undefined }
  }

  async countMaterialBindings(materialId: string): Promise<number> {
    return this.database.textureBindings.where('materialId').equals(materialId).count()
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
        [this.database.materials, this.database.textureAssets, this.database.textureBindings],
        async () => {
          const currentMaterial = await this.database.materials.get(materialId)
          if (!currentMaterial) {
            throw new AppError('MATERIAL_FAILED', 'This material is no longer available.')
          }
          const previousAssetId = currentMaterial.textureAssetId
          const savedMaterial: StudioMaterial = {
            ...currentMaterial,
            textureAssetId: asset.id,
            updatedAt: now,
            revision: currentMaterial.revision + 1,
          }
          await this.database.textureAssets.add(asset)
          await this.database.materials.put(savedMaterial)
          const existingBindings = await this.database.textureBindings
            .where('materialId')
            .equals(currentMaterial.id)
            .toArray()
          const normalizedBindings = existingBindings.flatMap((binding) => {
            const uv = normalizeUvRect(binding.uv, asset.width, asset.height, 0.25)
            return uvRectsEqual(binding.uv, uv)
              ? []
              : [{ ...binding, uv, updatedAt: now }]
          })
          if (normalizedBindings.length) {
            await this.database.textureBindings.bulkPut(normalizedBindings)
          }
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
    await this.database.transaction(
      'rw',
      [this.database.textureAssets, this.database.materials, this.database.textureBindings],
      async () => {
        await this.database.textureAssets.put(saved)
        const linkedMaterials = await this.database.materials
          .where('projectId')
          .equals(existing.projectId)
          .filter((material) => material.textureAssetId === assetId)
          .toArray()
        if (!linkedMaterials.length) return
        const materialIds = new Set(linkedMaterials.map((material) => material.id))
        const bindings = await this.database.textureBindings
          .where('projectId')
          .equals(existing.projectId)
          .filter((binding) => materialIds.has(binding.materialId))
          .toArray()
        const now = Date.now()
        const normalized = bindings.flatMap((binding) => {
          const uv = normalizeUvRect(binding.uv, saved.width, saved.height, 0.25)
          return uvRectsEqual(binding.uv, uv)
            ? []
            : [{ ...binding, uv, updatedAt: now }]
        })
        if (normalized.length) await this.database.textureBindings.bulkPut(normalized)
      },
    )
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
    const [binding] = await this.saveFaceBindings({
      ...input,
      faces: [input.face],
    })
    return binding!
  }

  async saveFaceBindings(input: {
    projectId: string
    modelId: string
    cubeId: string
    faces: readonly TextureFace[]
    materialId: string
    textureWidth: number
    textureHeight: number
  }): Promise<StudioTextureBinding[]> {
    const requestedFaces = [...new Set(input.faces)]
    if (!requestedFaces.length) return []
    return this.database.transaction(
      'rw',
      [this.database.models, this.database.materials, this.database.textureBindings],
      async () => {
        const [model, material, currentBindings] = await Promise.all([
          this.database.models.get(input.modelId),
          this.database.materials.get(input.materialId),
          this.database.textureBindings
            .where('[modelId+cubeId]')
            .equals([input.modelId, input.cubeId])
            .toArray(),
        ])
        if (!model || model.projectId !== input.projectId) {
          throw new AppError('MODEL_NOT_FOUND', 'This model is no longer available in the project.')
        }
        if (!model.elements.some((cube) => cube.id === input.cubeId)) {
          throw new AppError('MATERIAL_FAILED', 'The selected cube is no longer available.')
        }
        if (!material || material.projectId !== input.projectId) {
          throw new AppError('MATERIAL_FAILED', 'The selected material is not available in this project.')
        }
        const now = Date.now()
        const byFace = new Map(currentBindings.map((binding) => [binding.face, binding]))
        const saved = requestedFaces.map((face) => {
          const existing = byFace.get(face)
          const uv = normalizeUvRect(existing?.uv ?? {
            x: 0,
            y: 0,
            width: input.textureWidth,
            height: input.textureHeight,
            rotation: 0,
            flipHorizontal: false,
            flipVertical: false,
          }, input.textureWidth, input.textureHeight, 0.25)
          if (existing && existing.materialId === input.materialId && uvRectsEqual(existing.uv, uv)) {
            return existing
          }
          return {
            id: existing?.id ?? createId(),
            projectId: input.projectId,
            modelId: input.modelId,
            cubeId: input.cubeId,
            face,
            materialId: input.materialId,
            uv,
            updatedAt: now,
          }
        })
        const changed = saved.filter((binding) => binding !== byFace.get(binding.face))
        if (changed.length) await this.database.textureBindings.bulkPut(changed)
        return saved.map(cloneBinding)
      },
    )
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

  /** Deleting a model removes only its bindings; project materials remain reusable. */
  async deleteForModel(modelId: string): Promise<void> {
    await this.database.textureBindings.where('modelId').equals(modelId).delete()
  }

  async deleteForProject(projectId: string): Promise<void> {
    await this.database.transaction(
      'rw',
      [this.database.materials, this.database.textureAssets, this.database.textureBindings],
      async () => {
        await this.database.materials.where('projectId').equals(projectId).delete()
        await this.database.textureAssets.where('projectId').equals(projectId).delete()
        await this.database.textureBindings.where('projectId').equals(projectId).delete()
      },
    )
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
