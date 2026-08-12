import { AppError } from '@/core/errors/AppError'
import { type AddonsStudioDatabase, studioDatabase } from '@/core/storage/database'
import type {
  CreateStudioModelInput,
  ModelReferenceAsset,
  StudioModel,
  StudioReferenceImage,
} from '@/types/model'
import { createId } from '@/utils/createId'

import {
  cloneStudioModel,
  cloneStudioReference,
  createEmptyStudioModel,
} from './modelFactory'
import { validateModelInput, validateStoredModel } from './modelValidation'

const REFERENCE_MIME_TYPES = ['image/png', 'image/jpeg'] as const

export class ModelRepository {
  constructor(private readonly database: AddonsStudioDatabase = studioDatabase) {}

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
      schemaVersion: existing.schemaVersion,
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
        [this.database.models, this.database.modelReferenceAssets],
        async () => {
          await this.database.models.delete(id)
          await this.database.modelReferenceAssets.where('modelId').equals(id).delete()
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
  ): Promise<{
    asset: ModelReferenceAsset
    reference: StudioReferenceImage
    model: StudioModel
  }> {
    if (!REFERENCE_MIME_TYPES.includes(file.type as (typeof REFERENCE_MIME_TYPES)[number])) {
      throw new AppError('REFERENCE_IMAGE_FAILED', 'Choose a PNG or JPG reference image.')
    }
    if (file.size > 12 * 1024 * 1024) {
      throw new AppError('REFERENCE_IMAGE_FAILED', 'Reference images must be 12 MB or smaller.')
    }

    const assetId = createId()
    const referenceId = createId()
    const asset: ModelReferenceAsset = {
      id: assetId,
      modelId: model.id,
      projectId: model.projectId,
      name: file.name || 'Reference image',
      mimeType: file.type as ModelReferenceAsset['mimeType'],
      blob: file,
      createdAt: Date.now(),
    }
    const reference: StudioReferenceImage = {
      id: referenceId,
      assetId,
      name: file.name.replace(/\.[^.]+$/, '') || 'Front Reference',
      view: 'front',
      position: { x: 0, y: 0, z: -8.25 },
      size: { x: 24, y: 24 },
      opacity: 0.55,
      visible: true,
    }

    try {
      return await this.database.transaction(
        'rw',
        [this.database.models, this.database.modelReferenceAssets],
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
          await this.database.modelReferenceAssets.add(asset)
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

  async listReferenceAssets(modelId: string): Promise<ModelReferenceAsset[]> {
    return this.database.modelReferenceAssets.where('modelId').equals(modelId).toArray()
  }

  async deleteReferenceAsset(id: string): Promise<void> {
    await this.database.modelReferenceAssets.delete(id)
  }

  async deleteReference(model: StudioModel, referenceId: string): Promise<StudioModel> {
    const reference = model.references.find((entry) => entry.id === referenceId)
    if (!reference) {
      throw new AppError('REFERENCE_IMAGE_FAILED', 'This reference image is no longer available.')
    }

    try {
      return await this.database.transaction(
        'rw',
        [this.database.models, this.database.modelReferenceAssets],
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
      schemaVersion: existing.schemaVersion,
      revision: existing.revision + 1,
    }
  }
}

export const modelRepository = new ModelRepository()
