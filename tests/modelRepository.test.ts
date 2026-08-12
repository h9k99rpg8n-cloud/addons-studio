import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createStudioCube } from '@/core/model/modelFactory'
import { ModelRepository } from '@/core/model/modelRepository'
import { DEFAULT_BEDROCK_VERSION } from '@/core/project/bedrockVersions'
import { ProjectRepository } from '@/core/project/projectRepository'
import { AddonsStudioDatabase } from '@/core/storage/database'

describe('ModelRepository', () => {
  let databaseName: string
  let database: AddonsStudioDatabase
  let projects: ProjectRepository
  let models: ModelRepository
  let projectId: string

  beforeEach(async () => {
    databaseName = `addons-studio-models-${crypto.randomUUID()}`
    database = new AddonsStudioDatabase(databaseName)
    projects = new ProjectRepository(database)
    models = new ModelRepository(database)
    projectId = (
      await projects.createProject({
        name: 'Model Project',
        namespace: 'model_project',
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

  it('persists multiple cubes after closing and reopening IndexedDB', async () => {
    const model = await models.createModel({
      projectId,
      name: 'Vertical Slab',
      identifier: 'geometry.model_project.vertical_slab',
    })
    model.elements.push(createStudioCube(0), createStudioCube(1))
    model.elements[1]!.rotation.y = 90
    await models.saveModel(model)
    database.close()

    database = new AddonsStudioDatabase(databaseName)
    models = new ModelRepository(database)
    const reopened = await models.getModel(model.id)

    expect(reopened?.elements).toHaveLength(2)
    expect(reopened?.elements[1]?.rotation.y).toBe(90)
  })

  it('stores reference blobs with model metadata and deletes both atomically', async () => {
    let model = await models.createModel({
      projectId,
      name: 'Reference Model',
      identifier: 'geometry.model_project.reference_model',
    })
    const file = new File([new Uint8Array([137, 80, 78, 71])], 'front.png', {
      type: 'image/png',
    })

    const attached = await models.addReferenceAsset(model, file)
    model = attached.model
    expect(model.references).toHaveLength(1)
    expect(await models.listReferenceAssets(model.id)).toHaveLength(1)

    model = await models.deleteReference(model, attached.reference.id)
    expect(model.references).toEqual([])
    expect(await models.listReferenceAssets(model.id)).toEqual([])
  })

  it('cascades model and reference deletion with its project', async () => {
    const model = await models.createModel({
      projectId,
      name: 'Disposable Model',
      identifier: 'geometry.model_project.disposable',
    })
    const attached = await models.addReferenceAsset(
      model,
      new File(['reference'], 'front.jpg', { type: 'image/jpeg' }),
    )

    await projects.deleteProject(projectId)

    expect(await models.getModel(model.id)).toBeUndefined()
    expect(await models.listReferenceAssets(attached.model.id)).toEqual([])
  })
})
