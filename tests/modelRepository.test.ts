import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createStudioCube, createStudioGroup, MODEL_SCHEMA_VERSION } from '@/core/model/modelFactory'
import { ModelRepository } from '@/core/model/modelRepository'
import { DEFAULT_BEDROCK_VERSION } from '@/core/project/bedrockVersions'
import { ProjectRepository } from '@/core/project/projectRepository'
import { AddonsStudioDatabase } from '@/core/storage/database'

const inspectTestImage = async (file: File) => ({
  mimeType: file.type === 'image/jpeg' ? 'image/jpeg' as const : 'image/png' as const,
  width: 640,
  height: 480,
})

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
    models = new ModelRepository(database, inspectTestImage)
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
    models = new ModelRepository(database, inspectTestImage)
    const reopened = await models.getModel(model.id)

    expect(reopened?.elements).toHaveLength(2)
    expect(reopened?.elements[1]?.rotation.y).toBe(90)
  })

  it('persists hierarchy, object locks, modeling settings, references, viewports, and snapping', async () => {
    let model = await models.createModel({
      projectId,
      name: 'Workflow Model',
      identifier: 'geometry.model_project.workflow_model',
    })
    const cube = createStudioCube()
    cube.locked = true
    cube.pivot = { x: 2, y: 3, z: 4 }
    cube.defaultPivot = { x: 8, y: 8, z: 8 }
    const group = createStudioGroup(0, [cube])
    group.locked = true
    cube.parentId = group.id
    model.groups.push(group)
    model.elements.push(cube)
    model.editor.viewportLayout = 2
    model.editor.viewportViews = ['front', 'perspective']
    model.editor.snapping = { transform: 0.25, customTransform: 0.125, rotation: 22.5 }
    model.editor.modeling = {
      resizeDirection: 'negative',
      controlMode: 'tactilismos',
      transformSpace: 'parent',
      language: 'es',
    }
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
    expect(reopened?.groups[0]?.locked).toBe(true)
    expect(reopened?.elements[0]).toMatchObject({
      parentId: group.id,
      pivot: { x: 2, y: 3, z: 4 },
      locked: true,
    })
    expect(reopened?.references[0]).toMatchObject({
      view: 'front',
      position: { x: 0, y: 0 },
      scale: 1,
      opacity: 0.55,
    })
    expect(reopened?.editor).toMatchObject({
      viewportLayout: 2,
      viewportViews: ['front', 'perspective'],
      snapping: { transform: 0.25, customTransform: 0.125, rotation: 22.5 },
      modeling: {
        resizeDirection: 'negative',
        controlMode: 'tactilismos',
        transformSpace: 'parent',
        language: 'es',
      },
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
    expect(reopened?.elements[0]?.locked).toBe(false)
    expect(reopened?.groups).toEqual([])
    expect(reopened?.references[0]).toMatchObject({
      view: 'right',
      position: { x: 0, y: 0 },
      scale: 2 / 3,
      opacity: 0.5,
      visible: true,
    })
    expect(reopened?.editor.viewportLayout).toBe(1)
    expect(reopened?.editor.modeling).toEqual({
      resizeDirection: 'symmetric',
      controlMode: 'hybrid',
      transformSpace: 'global',
      language: 'en',
    })
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
    expect(model.references[0]).toMatchObject({
      view: 'front',
      opacity: 0.55,
      visible: true,
      flipHorizontal: false,
      flipVertical: false,
    })
    expect(await models.listReferenceAssets(model.id)).toHaveLength(1)

    model = await models.deleteReference(model, attached.reference.id)
    expect(model.references).toEqual([])
    expect(await models.listReferenceAssets(model.id)).toEqual([])
  })

  it('persists and safely resets a dedicated custom editor background asset', async () => {
    let model = await models.createModel({
      projectId,
      name: 'Background Model',
      identifier: 'geometry.model_project.background_model',
    })
    const attached = await models.addBackgroundAsset(
      model,
      new File(['background'], 'studio.jpg', { type: 'image/jpeg' }),
    )
    model = attached.model
    model.editor.background = {
      ...model.editor.background,
      fit: 'fit',
      opacity: 0.65,
      brightness: 0.8,
    }
    await models.saveModel(model)
    database.close()

    database = new AddonsStudioDatabase(databaseName)
    models = new ModelRepository(database, inspectTestImage)
    const reopened = await models.getModel(model.id)
    const assets = await models.listEditorAssets(model.id)

    expect(reopened?.editor.background).toMatchObject({
      type: 'custom',
      customAssetId: attached.asset.id,
      fit: 'fit',
      opacity: 0.65,
      brightness: 0.8,
    })
    expect(assets).toHaveLength(1)
    expect(assets[0]).toMatchObject({ kind: 'background', width: 640, height: 480 })

    const reset = await models.removeBackgroundAsset(reopened!)
    expect(reset.editor.background).toMatchObject({ type: 'dark-studio' })
    expect(reset.editor.background.customAssetId).toBeUndefined()
    expect(await models.listEditorAssets(model.id)).toEqual([])
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
    expect(await database.modelEditorAssets.where('projectId').equals(projectId).count()).toBe(0)
  })

  it('cleans reference and background blobs when a model is deleted', async () => {
    let model = await models.createModel({
      projectId,
      name: 'Disposable Assets',
      identifier: 'geometry.model_project.disposable_assets',
    })
    model = (await models.addReferenceAsset(
      model,
      new File(['reference'], 'front.png', { type: 'image/png' }),
    )).model
    model = (await models.addBackgroundAsset(
      model,
      new File(['background'], 'background.jpg', { type: 'image/jpeg' }),
    )).model
    expect(await models.listEditorAssets(model.id)).toHaveLength(2)

    await models.deleteModel(model.id)

    expect(await models.getModel(model.id)).toBeUndefined()
    expect(await models.listEditorAssets(model.id)).toEqual([])
  })
})
