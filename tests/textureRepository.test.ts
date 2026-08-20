import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createStudioCube } from '@/core/model/modelFactory'
import { ModelRepository } from '@/core/model/modelRepository'
import { DEFAULT_BEDROCK_VERSION } from '@/core/project/bedrockVersions'
import { ProjectRepository } from '@/core/project/projectRepository'
import { AddonsStudioDatabase } from '@/core/storage/database'
import { TextureRepository } from '@/core/texture/textureRepository'
import { TextureUvService } from '@/core/texture/textureUvService'

const inspectTestTexture = async (file: File) => ({
  mimeType: file.type === 'image/jpeg' ? 'image/jpeg' as const : 'image/png' as const,
  width: 32,
  height: 32,
})

describe('TextureRepository', () => {
  let database: AddonsStudioDatabase
  let projects: ProjectRepository
  let models: ModelRepository
  let textures: TextureRepository
  let projectId: string
  let modelId: string
  let cubeId: string

  beforeEach(async () => {
    database = new AddonsStudioDatabase(`addons-studio-textures-${crypto.randomUUID()}`)
    projects = new ProjectRepository(database)
    models = new ModelRepository(database)
    textures = new TextureRepository(database, inspectTestTexture)
    projectId = (
      await projects.createProject({
        name: 'Texture Project',
        namespace: 'texture_project',
        projectType: 'addon',
        targetVersion: DEFAULT_BEDROCK_VERSION,
        experimentalFeatures: false,
      })
    ).id
    const model = await models.createModel({
      projectId,
      name: 'Textured Cube',
      identifier: 'geometry.texture_project.textured_cube',
    })
    const cube = createStudioCube()
    cube.name = 'Body'
    model.elements.push(cube)
    await models.saveModel(model)
    modelId = model.id
    cubeId = cube.id
  })

  afterEach(async () => {
    database.close()
    await database.delete()
  })

  it('creates a project material and persists an imported texture blob', async () => {
    const material = await textures.createMaterial({ projectId, name: 'Blue Fabric' })
    const imported = await textures.importTexture(
      material.id,
      new File(['pixel-data'], 'blue_fabric.png', { type: 'image/png' }),
    )

    expect(imported.material).toMatchObject({
      projectId,
      name: 'Blue Fabric',
      identifier: 'blue_fabric',
      textureAssetId: imported.asset.id,
    })
    expect(imported.asset).toMatchObject({
      projectId,
      width: 32,
      height: 32,
      mimeType: 'image/png',
    })
    expect(imported.asset).not.toHaveProperty('modelId')

    const databaseName = database.name
    database.close()
    database = new AddonsStudioDatabase(databaseName)
    textures = new TextureRepository(database, inspectTestTexture)
    const reopened = await textures.getWorkspace(modelId)
    expect(reopened.materials).toHaveLength(1)
    expect(reopened.assets).toHaveLength(1)
    expect(reopened.assets[0]?.blob).toBeDefined()
  })

  it('reuses one project material across multiple models while keeping bindings model-specific', async () => {
    const material = await textures.createMaterial({ projectId, name: 'Shared Wood' })
    await textures.saveFaceBinding({
      projectId,
      modelId,
      cubeId,
      face: 'north',
      materialId: material.id,
      textureWidth: 32,
      textureHeight: 32,
    })

    const second = await models.createModel({
      projectId,
      name: 'Second Model',
      identifier: 'geometry.texture_project.second',
    })
    const secondCube = createStudioCube(2)
    second.elements.push(secondCube)
    await models.saveModel(second)
    await textures.saveFaceBinding({
      projectId,
      modelId: second.id,
      cubeId: secondCube.id,
      face: 'up',
      materialId: material.id,
      textureWidth: 32,
      textureHeight: 32,
    })

    const firstWorkspace = await textures.getWorkspace(modelId)
    const secondWorkspace = await textures.getWorkspace(second.id)
    expect(firstWorkspace.materials.map((entry) => entry.id)).toContain(material.id)
    expect(secondWorkspace.materials.map((entry) => entry.id)).toContain(material.id)
    expect(firstWorkspace.bindings).toHaveLength(1)
    expect(secondWorkspace.bindings).toHaveLength(1)
    expect(firstWorkspace.bindings[0]?.modelId).toBe(modelId)
    expect(secondWorkspace.bindings[0]?.modelId).toBe(second.id)
  })

  it('creates stable per-face bindings without changing model geometry', async () => {
    const before = await models.getModel(modelId)
    const material = await textures.createMaterial({ projectId, name: 'Metal' })
    const binding = await textures.saveFaceBinding({
      projectId,
      modelId,
      cubeId,
      face: 'north',
      materialId: material.id,
      textureWidth: 32,
      textureHeight: 32,
    })

    expect(binding).toMatchObject({
      cubeId,
      face: 'north',
      materialId: material.id,
      uv: { x: 0, y: 0, width: 32, height: 32 },
    })
    const workspace = await textures.getWorkspace(modelId)
    expect(workspace.bindings).toHaveLength(1)
    const after = await models.getModel(modelId)
    expect(after?.elements).toEqual(before?.elements)
  })

  it('assigns multiple selected faces atomically and skips identical rewrites', async () => {
    const material = await textures.createMaterial({ projectId, name: 'Batch Material' })
    const saved = await textures.saveFaceBindings({
      projectId,
      modelId,
      cubeId,
      faces: ['north', 'south', 'north'],
      materialId: material.id,
      textureWidth: 64,
      textureHeight: 64,
    })
    expect(saved.map((binding) => binding.face)).toEqual(['north', 'south'])
    const timestamps = new Map(saved.map((binding) => [binding.face, binding.updatedAt]))

    const repeated = await textures.saveFaceBindings({
      projectId,
      modelId,
      cubeId,
      faces: ['north', 'south'],
      materialId: material.id,
      textureWidth: 64,
      textureHeight: 64,
    })
    expect(repeated.map((binding) => binding.updatedAt)).toEqual([
      timestamps.get('north'),
      timestamps.get('south'),
    ])
    expect((await textures.getWorkspace(modelId)).bindings).toHaveLength(2)
  })

  it('repairs UV bounds when a reusable material receives a smaller texture', async () => {
    const variableTextures = new TextureRepository(database, async (file) => ({
      mimeType: 'image/png' as const,
      width: file.name.startsWith('small') ? 8 : 32,
      height: file.name.startsWith('small') ? 8 : 32,
    }))
    const material = await variableTextures.createMaterial({ projectId, name: 'Resizable Atlas' })
    await variableTextures.importTexture(
      material.id,
      new File(['large'], 'large.png', { type: 'image/png' }),
    )
    const binding = await variableTextures.saveFaceBinding({
      projectId,
      modelId,
      cubeId,
      face: 'north',
      materialId: material.id,
      textureWidth: 32,
      textureHeight: 32,
    })
    await new TextureUvService(database).updateBindingUv(binding.id, {
      ...binding.uv,
      x: 24,
      y: 20,
      width: 8,
      height: 12,
    }, 32, 32, 1)

    await variableTextures.importTexture(
      material.id,
      new File(['small'], 'small.png', { type: 'image/png' }),
    )
    const repaired = (await variableTextures.getWorkspace(modelId)).bindings[0]!
    expect(repaired.uv.x + repaired.uv.width).toBeLessThanOrEqual(8)
    expect(repaired.uv.y + repaired.uv.height).toBeLessThanOrEqual(8)
    expect(await database.textureAssets.where('projectId').equals(projectId).count()).toBe(1)
    expect((await variableTextures.getMaterial(material.id))?.revision).toBe(3)
  })

  it('replaces edited texture pixels with PNG data and preserves the material link', async () => {
    const material = await textures.createMaterial({ projectId, name: 'Editable' })
    const imported = await textures.importTexture(
      material.id,
      new File(['original'], 'editable.jpg', { type: 'image/jpeg' }),
    )
    const saved = await textures.replaceTexturePixels(
      imported.asset.id,
      new Blob(['edited-png'], { type: 'image/png' }),
      64,
      32,
    )

    expect(saved).toMatchObject({ mimeType: 'image/png', width: 64, height: 32 })
    const workspace = await textures.getWorkspace(modelId)
    expect(workspace.materials[0]?.textureAssetId).toBe(saved.id)
    expect(workspace.assets[0]?.mimeType).toBe('image/png')
  })

  it('deletes material-owned texture data and every binding that used it', async () => {
    const material = await textures.createMaterial({ projectId, name: 'Temporary' })
    const imported = await textures.importTexture(
      material.id,
      new File(['texture'], 'temporary.png', { type: 'image/png' }),
    )
    await textures.saveFaceBinding({
      projectId,
      modelId,
      cubeId,
      face: 'up',
      materialId: material.id,
      textureWidth: imported.asset.width,
      textureHeight: imported.asset.height,
    })

    await textures.deleteMaterial(material.id)

    const workspace = await textures.getWorkspace(modelId)
    expect(workspace.materials).toEqual([])
    expect(workspace.assets).toEqual([])
    expect(workspace.bindings).toEqual([])
  })

  it('keeps project materials reusable when a model is deleted but removes its bindings', async () => {
    const material = await textures.createMaterial({ projectId, name: 'Project Library Material' })
    await textures.saveFaceBinding({
      projectId,
      modelId,
      cubeId,
      face: 'west',
      materialId: material.id,
      textureWidth: 16,
      textureHeight: 16,
    })

    await models.deleteModel(modelId)

    expect(await textures.listMaterials(projectId)).toHaveLength(1)
    expect(await database.textureBindings.where('modelId').equals(modelId).count()).toBe(0)
  })

  it('deletes all Texture Core records with their owning project', async () => {
    const material = await textures.createMaterial({ projectId, name: 'Disposable Texture' })
    await textures.importTexture(
      material.id,
      new File(['texture'], 'disposable.png', { type: 'image/png' }),
    )
    await textures.saveFaceBinding({
      projectId,
      modelId,
      cubeId,
      face: 'down',
      materialId: material.id,
      textureWidth: 32,
      textureHeight: 32,
    })

    await projects.deleteProject(projectId)

    expect(await database.materials.where('projectId').equals(projectId).count()).toBe(0)
    expect(await database.textureAssets.where('projectId').equals(projectId).count()).toBe(0)
    expect(await database.textureBindings.where('projectId').equals(projectId).count()).toBe(0)
  })
})
