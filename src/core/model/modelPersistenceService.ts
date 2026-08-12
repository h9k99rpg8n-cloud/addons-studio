import { logger } from '@/core/errors/logger'
import { cloneStudioModel } from '@/core/model/modelFactory'
import { modelRepository, type ModelRepository } from '@/core/model/modelRepository'
import { AUTOSAVE_DELAY_MS } from '@/core/project/constants'
import type { StudioModel } from '@/types/model'

interface ModelSaveCallbacks {
  onSaving?: () => void
  onSaved?: (model: StudioModel) => void
  onError?: (error: unknown) => void
}

interface PendingModelSave extends ModelSaveCallbacks {
  model: StudioModel
  timer: ReturnType<typeof setTimeout>
}

export class ModelPersistenceService {
  private readonly pending = new Map<string, PendingModelSave>()

  constructor(private readonly repository: ModelRepository = modelRepository) {}

  schedule(
    model: StudioModel,
    callbacks: ModelSaveCallbacks = {},
    delay = AUTOSAVE_DELAY_MS,
  ): void {
    const existing = this.pending.get(model.id)
    if (existing) clearTimeout(existing.timer)

    callbacks.onSaving?.()
    const timer = setTimeout(() => void this.flush(model.id), delay)
    this.pending.set(model.id, {
      model: cloneStudioModel(model),
      timer,
      ...callbacks,
    })
  }

  async flush(modelId: string): Promise<StudioModel | undefined> {
    const pending = this.pending.get(modelId)
    if (!pending) return undefined
    clearTimeout(pending.timer)
    this.pending.delete(modelId)

    try {
      const saved = await this.repository.saveModel(pending.model)
      pending.onSaved?.(saved)
      return saved
    } catch (error) {
      logger.error('Model autosave failed', {
        area: 'model-persistence',
        action: 'flush',
        details: { modelId, error },
      })
      pending.onError?.(error)
      throw error
    }
  }

  async flushAll(): Promise<void> {
    const results = await Promise.allSettled(
      Array.from(this.pending.keys(), (id) => this.flush(id)),
    )
    const rejection = results.find((result) => result.status === 'rejected')
    if (rejection?.status === 'rejected') throw rejection.reason
  }

  cancel(modelId: string): void {
    const pending = this.pending.get(modelId)
    if (pending) clearTimeout(pending.timer)
    this.pending.delete(modelId)
  }
}

export const modelPersistenceService = new ModelPersistenceService()
