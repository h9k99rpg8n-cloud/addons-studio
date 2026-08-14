import { AppError } from '@/core/errors/AppError'
import { type AddonsStudioDatabase, studioDatabase } from '@/core/storage/database'
import type {
  CreateStudioModelInput,
  ModelEditorAsset,
  StudioModel,
  StudioReferenceImage,
  StudioReferenceView,
} from '@/types/model'
import { createId } from '@/utils/createId'

import {
  cloneStudioModel,
  cloneStudioReference,
  createEmptyStudioModel,
  MODEL_SCHEMA_VERSION,
} from './modelFactory'
import { validateModelInput, validateStoredModel } from './modelValidation'
import { inspectEditorImage, type EditorImageInspector } from './modelImageValidation'

export class ModelRepository {
  constructor(
    private readonly database: AddonsStudioDatabase = studioDatabase,
    private readonly inspectImage: EditorImageInspector = inspectEditorImage,
  ) {}

  async createModel(input: CreateStudioModelInput): Promise<StudioModel> {
    const issue = validateModelInput(input)[0]
    if (issue) throw new AppError('MODEL_VALIDATION', issue.message)

    const project = await this.database.projects.get(input.projectId)
    if (!project) {
      throw new AppError('PROJECT_NOT_FOUND', 'This project is no longer available on this device.')
    }

    const duplicate = await this.database.models
      .where('[projectId+identifier]')
      .equals([input.projectId, input.identifier.trim()])
      .first()
    if (duplicate) {
      throw new AppError('MODEL_VALIDATION', 'This project already contains that model identifier.')
    }

    const model = createEmptyStudioModel(input.projectId, input.name, input.identifier)
    try {
      await this.database.models.add(model)
      return cloneStudioModel(model)
    } catch (error) {
      throw new AppError(
        'MODEL_SAVE_FAILED',
        'Addons Studio could not create this model. No existing resources were changed.',
        { cause: error },
      )
    }
  }

  async importModel(model: StudioModel): Promise<StudioModel> {
    const project = await this.database.projects.get(model.projectId)
    if (!project) {
      throw new AppError('PROJECT_NOT_FOUND', 'This project is no longer available on this device.')
    }
    const imported = cloneStudioModel(model)
    imported.identifier = await this.findAvailableIdentifier(imported.projectId, imported.identifier)
    const issue = validateStoredModel(imported)[0]
    if (issue) throw new AppError('MODEL_VALIDATION', issue.message)
    try {
      await this.database.models.add(imported)
      return cloneStudioModel(imported)
    } catch (error) {
      throw new AppError(
        'MODEL_SAVE_FAILED',
        'Addons Studio could not import this model. No existing models were changed.',
        { cause: error },
      )
    }
  }

  async listModels(projectId: string): Promise<StudioModel[]> {
    const models = await this.database.models.where('projectId').equals(projectId).toArray()
    return models
      .map(cloneStudioModel)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async countModels(projectId: string): Promise<number> {
    return this.database.models.where('projectId').equals(projectId).count()
  }

  async getModel(id: string): Promise<StudioModel | undefined> {
    const model = await this.database.models.get(id)
    return model ? cloneStudioModel(model) : undefined
  }

  async saveModel(model: StudioModel): Promise<StudioModel> {
    const issue = validateStoredModel(model)[0]
    if (issue) throw new AppError('MODEL_VALIDATION', issue.message)

    const existing = await this.database.models.get(model.id)
    if (!existing || existing.projectId !== model.projectId) {
      throw new AppError('MODEL_NOT_FOUND', 'This model is no longer available in the project.')
    }

    const collision = await this.database.models
      .where('[projectId+identifier]')
      .equals([model.projectId, model.identifier])
      .first()
    if (collision && collision.id !== model.id) {
      throw new AppError('MODEL_VALIDATION', 'This project already contains that model identifier.')
    }

    const saved: StudioModel = {
      ...cloneStudioModel(model),
      id: existing.id,
      projectId: existing.projectId,
      createdAt: existing.createdAt,
      updatedAt: Date.now(),
      schemaVersion: MODEL_SCHEMA_VERSION,
      revision: existing.revision + 1,
    }

    try {
      await this.database.models.put(saved)
      return cloneStudioModel(saved)
    } catch (error) {
      throw new AppError(
        'MODEL_SAVE_FAILED',
        'Addons Studio could not save this model. Your latest changes remain open.',
        { cause: error },
      )
    }
  }

  async deleteModel(id: string): Promise<void> {
    try {
      await this.database.transaction(
        'rw',
        [
          this.database.models,
          this.database.modelReferenceAssets,
          this.database.modelEditorAssets,
        ],
        async () => {
          await this.database.models.delete(id)
          await this.database.modelReferenceAssets.where('modelId').equals(id).delete()
          await this.database.modelEditorAssets.where('modelId').equals(id).delete()
        },
      )
    } catch (error) {
      throw new AppError('MODEL_DELETE_FAILED', 'Addons Studio could not delete this model.', {
        cause: error,
      })
    }
  }

  async addReferenceAsset(
    model: StudioModel,
    file: File,
    view: StudioReferenceView = 'front',
  ): Promise<{
    asset: ModelEditorAsset
    reference: StudioReferenceImage
    model: StudioModel
  }> {
    const inspection = await this.inspectImage(file, 'reference')

    const assetId = createId()
    const referenceId = createId()
    const asset: ModelEditorAsset = {
      id: assetId,
      modelId: model.id,
      projectId: model.projectId,
      kind: 'reference',
      name: file.name || 'Reference image',
      mimeType: inspection.mimeType,
      blob: file.slice(0, file.size, inspection.mimeType),
      width: inspection.width,
      height: inspection.height,
      createdAt: Date.now(),
    }
    const reference: StudioReferenceImage = {
      id: referenceId,
      assetId,
      name: file.name.replace(/\.[^.]+$/, '') || 'Front Reference',
      view,
      position: { x: 0, y: 0 },
      scale: 1,
      rotation: 0,
      opacity: 0.55,
      visible: true,
      flipHorizontal: false,
      flipVertical: false,
    }

    try {
      return await this.database.transaction(
        'rw',
        [this.database.models, this.database.modelEditorAssets],
        async () => {
          const existing = await this.database.models.get(model.id)
          if (!existing || existing.projectId !== model.projectId) {
            throw new AppError('MODEL_NOT_FOUND', 'This model is no longer available in the project.')
          }
          const saved = this.prepareSavedModel(existing, {
            ...cloneStudioModel(model),
            references: [...model.references.map(cloneStudioReference), cloneStudioReference(reference)],
          })
          await this.database.models.put(saved)
          await this.database.modelEditorAssets.add(asset)
          return {
            asset: { ...asset },
            reference: cloneStudioReference(reference),
            model: cloneStudioModel(saved),
          }
        },
      )
    } catch (error) {
      if (error instanceof AppError) throw error
      throw new AppError(
        'REFERENCE_IMAGE_FAILED',
        'The reference image could not be stored on this device.',
        { cause: error },
      )
    }
  }

  async listEditorAssets(modelId: string): Promise<ModelEditorAsset[]> {
    const [current, legacy] = await Promise.all([
      this.database.modelEditorAssets.where('modelId').equals(modelId).toArray(),
      this.database.modelReferenceAssets.where('modelId').equals(modelId).toArray(),
    ])
    const assets = new Map<string, ModelEditorAsset>()
    for (const asset of legacy) {
      assets.set(asset.id, {
        ...asset,
        kind: 'reference',
        width: Number.isFinite(asset.width) ? asset.width : 0,
        height: Number.isFinite(asset.height) ? asset.height : 0,
      })
    }
    for (const asset of current) assets.set(asset.id, { ...asset })
    return [...assets.values()].sort((a, b) => a.createdAt - b.createdAt)
  }

  /** Compatibility alias retained for existing callers and migrations. */
  async listReferenceAssets(modelId: string): Promise<ModelEditorAsset[]> {
    return (await this.listEditorAssets(modelId)).filter((asset) => asset.kind === 'reference')
  }

  async addBackgroundAsset(
    model: StudioModel,
    file: File,
  ): Promise<{ asset: ModelEditorAsset; model: StudioModel }> {
    const inspection = await this.inspectImage(file, 'background')
    const asset: ModelEditorAsset = {
      id: createId(),
      modelId: model.id,
      projectId: model.projectId,
      kind: 'background',
      name: file.name || 'Custom background',
      mimeType: inspection.mimeType,
      blob: file.slice(0, file.size, inspection.mimeType),
      width: inspection.width,
      height: inspection.height,
      createdAt: Date.now(),
    }
    const previousAssetId = model.editor.background.customAssetId

    try {
      return await this.database.transaction(
        'rw',
        [this.database.models, this.database.modelEditorAssets],
        async () => {
          const existing = await this.database.models.get(model.id)
          if (!existing || existing.projectId !== model.projectId) {
            throw new AppError('MODEL_NOT_FOUND', 'This model is no longer available in the project.')
          }
          const saved = this.prepareSavedModel(existing, {
            ...cloneStudioModel(model),
            editor: {
              ...cloneStudioModel(model).editor,
              background: {
                ...model.editor.background,
                type: 'custom',
                customAssetId: asset.id,
              },
            },
          })
          await this.database.modelEditorAssets.add(asset)
          await this.database.models.put(saved)
          if (previousAssetId && previousAssetId !== asset.id) {
            await this.database.modelEditorAssets.delete(previousAssetId)
          }
          return { asset: { ...asset }, model: cloneStudioModel(saved) }
        },
      )
    } catch (error) {
      if (error instanceof AppError) throw error
      throw new AppError(
        'EDITOR_IMAGE_FAILED',
        'Addons Studio could not store this custom background on this device.',
        { cause: error },
      )
    }
  }

  async removeBackgroundAsset(model: StudioModel): Promise<StudioModel> {
    const assetId = model.editor.background.customAssetId
    if (!assetId) return cloneStudioModel(model)
    try {
      return await this.database.transaction(
        'rw',
        [this.database.models, this.database.modelEditorAssets],
        async () => {
          const existing = await this.database.models.get(model.id)
          if (!existing) throw new AppError('MODEL_NOT_FOUND', 'This model is no longer available.')
          const normalized = cloneStudioModel(model)
          normalized.editor.background = {
            ...normalized.editor.background,
            type: 'dark-studio',
            customAssetId: undefined,
          }
          const saved = this.prepareSavedModel(existing, normalized)
          await this.database.models.put(saved)
          await this.database.modelEditorAssets.delete(assetId)
          return cloneStudioModel(saved)
        },
      )
    } catch (error) {
      if (error instanceof AppError) throw error
      throw new AppError('EDITOR_IMAGE_FAILED', 'The custom background could not be removed.', {
        cause: error,
      })
    }
  }

  async deleteReferenceAsset(id: string): Promise<void> {
    await this.database.transaction(
      'rw',
      [this.database.modelEditorAssets, this.database.modelReferenceAssets],
      async () => {
        await this.database.modelEditorAssets.delete(id)
        await this.database.modelReferenceAssets.delete(id)
      },
    )
  }

  async deleteReference(model: StudioModel, referenceId: string): Promise<StudioModel> {
    const reference = model.references.find((entry) => entry.id === referenceId)
    if (!reference) {
      throw new AppError('REFERENCE_IMAGE_FAILED', 'This reference image is no longer available.')
    }

    try {
      return await this.database.transaction(
        'rw',
        [
          this.database.models,
          this.database.modelEditorAssets,
          this.database.modelReferenceAssets,
        ],
        async () => {
          const existing = await this.database.models.get(model.id)
          if (!existing || existing.projectId !== model.projectId) {
            throw new AppError('MODEL_NOT_FOUND', 'This model is no longer available in the project.')
          }
          const saved = this.prepareSavedModel(existing, {
            ...cloneStudioModel(model),
            references: model.references.filter((entry) => entry.id !== referenceId),
          })
          await this.database.models.put(saved)
          await this.database.modelEditorAssets.delete(reference.assetId)
          await this.database.modelReferenceAssets.delete(reference.assetId)
          return cloneStudioModel(saved)
        },
      )
    } catch (error) {
      if (error instanceof AppError) throw error
      throw new AppError(
        'REFERENCE_IMAGE_FAILED',
        'The reference image could not be removed. Nothing was changed.',
        { cause: error },
      )
    }
  }

  private prepareSavedModel(existing: StudioModel, model: StudioModel): StudioModel {
    const issue = validateStoredModel(model)[0]
    if (issue) throw new AppError('MODEL_VALIDATION', issue.message)
    return {
      ...cloneStudioModel(model),
      id: existing.id,
      projectId: existing.projectId,
      createdAt: existing.createdAt,
      updatedAt: Date.now(),
      schemaVersion: MODEL_SCHEMA_VERSION,
      revision: existing.revision + 1,
    }
  }

  private async findAvailableIdentifier(projectId: string, preferred: string): Promise<string> {
    let candidate = preferred
    let suffix = 1
    while (await this.database.models.where('[projectId+identifier]').equals([projectId, candidate]).count()) {
      const marker = suffix === 1 ? '_imported' : `_imported_${suffix}`
      candidate = `${preferred.slice(0, Math.max(12, 128 - marker.length))}${marker}`
      suffix += 1
    }
    return candidate
  }
}

export const modelRepository = new ModelRepository()
