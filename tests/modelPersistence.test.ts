import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { reactive } from 'vue'

import { createStudioCube } from '@/core/model/modelFactory'
import { ModelPersistenceService } from '@/core/model/modelPersistenceService'
import { ModelRepository } from '@/core/model/modelRepository'
import { DEFAULT_BEDROCK_VERSION } from '@/core/project/bedrockVersions'
import { ProjectRepository } from '@/core/project/projectRepository'
import { AddonsStudioDatabase } from '@/core/storage/database'

describe('ModelPersistenceService', () => {
  let database: AddonsStudioDatabase
  let models: ModelRepository
  let persistence: ModelPersistenceService
  let projectId: string

  beforeEach(async () => {
    database = new AddonsStudioDatabase(`addons-studio-model-save-${crypto.randomUUID()}`)
    const projects = new ProjectRepository(database)
    models = new ModelRepository(database)
    persistence = new ModelPersistenceService(models)
    projectId = (
      await projects.createProject({
        name: 'Autosave Model',
        namespace: 'autosave_model',
        projectType: 'addon',
        targetVersion: DEFAULT_BEDROCK_VERSION,
        experimentalFeatures: false,
      })
    ).id
  })

  afterEach(async () => {
    database.close()
    await database.delete()
  })

  it('debounces model changes and flushes the latest meaningful state', async () => {
    const model = reactive(await models.createModel({
      projectId,
      name: 'Autosaved Geometry',
      identifier: 'geometry.autosave_model.geometry',
    }))
    model.elements.push(createStudioCube())
    persistence.schedule(model, {}, 5)

    expect((await models.getModel(model.id))?.elements).toEqual([])
    await new Promise((resolve) => setTimeout(resolve, 25))
    expect((await models.getModel(model.id))?.elements).toHaveLength(1)
  })
})
