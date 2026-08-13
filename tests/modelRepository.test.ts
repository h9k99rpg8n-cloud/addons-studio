import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createStudioCube, createStudioGroup, MODEL_SCHEMA_VERSION } from '@/core/model/modelFactory'
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

  it('persists hierarchy, pivots, locked references, viewport layout, and snapping', async () => {
    let model = await models.createModel({
      projectId,
      name: 'Workflow Model',
      identifier: 'geometry.model_project.workflow_model',
    })
    const cube = createStudioCube()
    cube.pivot = { x: 2, y: 3, z: 4 }
    cube.defaultPivot = { x: 8, y: 8, z: 8 }
    const group = createStudioGroup(0, [cube])
    cube.parentId = group.id
    model.groups.push(group)
    model.elements.push(cube)
    model.editor.viewportLayout = 2
    model.editor.viewportViews = ['front', 'perspective']
    model.editor.snapping = { transform: 0.25, customTransform: 0.125, rotation: 22.5 }
    model = (
      await models.addReferenceAsset(
        model,
        new File(['reference'], 'locked.jpg', { type: 'image/jpeg' }),
      )
    ).model
    await models.saveModel(model)
    database.close()

    database = new AddonsStudioDatabase(databaseName)
    models = new ModelRepository(database)
    const reopened = await models.getModel(model.id)

    expect(reopened?.schemaVersion).toBe(MODEL_SCHEMA_VERSION)
    expect(reopened?.groups[0]?.id).toBe(group.id)
    expect(reopened?.elements[0]).toMatchObject({ parentId: group.id, pivot: { x: 2, y: 3, z: 4 } })
    expect(reopened?.references[0]?.locked).toBe(true)
    expect(reopened?.editor).toMatchObject({
      viewportLayout: 2,
      viewportViews: ['front', 'perspective'],
      snapping: { transform: 0.25, customTransform: 0.125, rotation: 22.5 },
    })
  })

  it('normalizes Alpha 0.0.3 model records without deleting cubes or references', async () => {
    const model = await models.createModel({
      projectId,
      name: 'Legacy Model',
      identifier: 'geometry.model_project.legacy_model',
    })
    const cube = createStudioCube()
    const legacy = {
      ...model,
      elements: [{
        id: cube.id,
        type: 'cube' as const,
        name: cube.name,
        position: cube.position,
        size: cube.size,
        rotation: cube.rotation,
        visible: true,
      }],
      groups: undefined,
      editor: undefined,
      references: [{
        id: 'legacy-reference',
        assetId: 'legacy-asset',
        name: 'Side Guide',
        view: 'side',
        position: { x: 0, y: 0, z: 0 },
        size: { x: 16, y: 16 },
        opacity: 0.5,
        visible: true,
      }],
      schemaVersion: 1,
    }
    await database.models.put(legacy as never)

    const reopened = await models.getModel(model.id)
    expect(reopened?.elements).toHaveLength(1)
    expect(reopened?.elements[0]?.pivot).toEqual({ x: 8, y: 8, z: 8 })
    expect(reopened?.groups).toEqual([])
    expect(reopened?.references[0]).toMatchObject({ view: 'right', locked: true })
    expect(reopened?.editor.viewportLayout).toBe(1)
    expect(reopened?.schemaVersion).toBe(MODEL_SCHEMA_VERSION)
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
