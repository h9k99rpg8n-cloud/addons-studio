import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createStudioCube, createStudioGroup } from '@/core/model/modelFactory'
import { ModelRepository } from '@/core/model/modelRepository'
import { DEFAULT_BEDROCK_VERSION } from '@/core/project/bedrockVersions'
import { ProjectRepository } from '@/core/project/projectRepository'
import { ResourceRepository } from '@/core/resources/resourceRepository'
import { AddonsStudioDatabase } from '@/core/storage/database'
import { TextureRepository } from '@/core/texture/textureRepository'
import type { CreateProjectInput } from '@/types/project'
import type { BlockResourcePayload, ModelResourcePayload } from '@/types/resource'

const inspectTestImage = async (file: File) => ({
  mimeType: file.type === 'image/jpeg' ? 'image/jpeg' as const : 'image/png' as const,
  width: 640,
  height: 480,
})

function input(overrides: Partial<CreateProjectInput> = {}): CreateProjectInput {
  return {
    name: 'Río Grande Urbanismo',
    namespace: 'rio_grande_urbanismo',
    projectType: 'addon',
    targetVersion: DEFAULT_BEDROCK_VERSION,
    experimentalFeatures: false,
    ...overrides,
  }
}

describe('ProjectRepository', () => {
  let database: AddonsStudioDatabase
  let repository: ProjectRepository

  beforeEach(() => {
    database = new AddonsStudioDatabase(`addons-studio-test-${crypto.randomUUID()}`)
    repository = new ProjectRepository(database)
  })

  afterEach(async () => {
    database.close()
    await database.delete()
  })

  it('persists a created project and its initial recovery point', async () => {
    const created = await repository.createProject(input())
    const reopened = await repository.getProject(created.id)
    const snapshots = await repository.listSnapshots(created.id)

    expect(reopened).toMatchObject({
      name: 'Río Grande Urbanismo',
      namespace: 'rio_grande_urbanismo',
      schemaVersion: 1,
      revision: 1,
    })
    expect(snapshots).toHaveLength(1)
    expect(snapshots[0]?.reason).toBe('created')
  })

  it('deletes the project and its snapshots in one operation', async () => {
    const created = await repository.createProject(input())
    await repository.createRecoverySnapshot(created.id)

    await repository.deleteProject(created.id)

    expect(await repository.getProject(created.id)).toBeUndefined()
    expect(await repository.listSnapshots(created.id)).toEqual([])
  })

  it('duplicates metadata with a new id and collision-safe namespace', async () => {
    const source = await repository.createProject(input())
    const firstCopy = await repository.duplicateProject(source.id)
    const secondCopy = await repository.duplicateProject(source.id)

    expect(firstCopy.id).not.toBe(source.id)
    expect(firstCopy.name).toBe('Río Grande Urbanismo Copy')
    expect(firstCopy.namespace).toBe('rio_grande_urbanismo_copy')
    expect(secondCopy.namespace).toBe('rio_grande_urbanismo_copy_2')
  })

  it('duplicates models, editor assets, materials, textures, and bindings as independent data', async () => {
    const source = await repository.createProject(input())
    const models = new ModelRepository(database, inspectTestImage)
    let model = await models.createModel({
      projectId: source.id,
      name: 'Urban Block',
      identifier: 'geometry.rio_grande.urban_block',
    })
    const cube = createStudioCube()
    cube.metadata = { futureMaterial: 'urban' }
    const group = createStudioGroup(0, [cube])
    group.metadata = { futureBone: true }
    cube.parentId = group.id
    model.groups.push(group)
    model.elements.push(cube)
    model = await models.saveModel(model)
    model = (
      await models.addReferenceAsset(
        model,
        new File(['reference'], 'front.png', { type: 'image/png' }),
      )
    ).model
    const textures = new TextureRepository(database, inspectTestImage)
    const material = await textures.createMaterial({ projectId: source.id, name: 'Urban Stone' })
    const importedTexture = await textures.importTexture(
      material.id,
      new File(['texture-pixels'], 'urban_stone.png', { type: 'image/png' }),
    )
    const sourceBinding = await textures.saveFaceBinding({
      projectId: source.id,
      modelId: model.id,
      cubeId: cube.id,
      face: 'north',
      materialId: material.id,
      textureWidth: importedTexture.asset.width,
      textureHeight: importedTexture.asset.height,
    })
    model = (
      await models.addBackgroundAsset(
        model,
        new File(['background'], 'studio.jpg', { type: 'image/jpeg' }),
      )
    ).model

    const duplicate = await repository.duplicateProject(source.id)
    const copiedModels = await models.listModels(duplicate.id)
    const copiedAssets = await models.listEditorAssets(copiedModels[0]!.id)
    const copiedTextureWorkspace = await textures.getWorkspace(copiedModels[0]!.id)

    expect(copiedModels).toHaveLength(1)
    expect(copiedModels[0]).toMatchObject({
      projectId: duplicate.id,
      identifier: model.identifier,
    })
    expect(copiedModels[0]?.id).not.toBe(model.id)
    expect(copiedModels[0]?.elements[0]?.id).not.toBe(model.elements[0]?.id)
    expect(copiedModels[0]?.groups[0]?.id).not.toBe(model.groups[0]?.id)
    expect(copiedModels[0]?.elements[0]?.parentId).toBe(copiedModels[0]?.groups[0]?.id)
    expect(copiedModels[0]?.elements[0]?.metadata).toEqual(cube.metadata)
    expect(copiedModels[0]?.groups[0]?.metadata).toEqual(group.metadata)
    expect(copiedAssets).toHaveLength(2)
    expect(copiedAssets.every((asset) => asset.projectId === duplicate.id)).toBe(true)
    const copiedReference = copiedAssets.find((asset) => asset.kind === 'reference')
    const copiedBackground = copiedAssets.find((asset) => asset.kind === 'background')
    expect(copiedModels[0]?.references[0]?.assetId).toBe(copiedReference?.id)
    expect(copiedModels[0]?.editor.background.customAssetId).toBe(copiedBackground?.id)
    expect(copiedModels[0]?.editor.background.type).toBe('custom')
    expect(copiedTextureWorkspace.materials).toHaveLength(1)
    expect(copiedTextureWorkspace.assets).toHaveLength(1)
    expect(copiedTextureWorkspace.bindings).toHaveLength(1)
    expect(copiedTextureWorkspace.materials[0]?.id).not.toBe(material.id)
    expect(copiedTextureWorkspace.assets[0]?.id).not.toBe(importedTexture.asset.id)
    expect(copiedTextureWorkspace.materials[0]?.textureAssetId).toBe(copiedTextureWorkspace.assets[0]?.id)
    expect(copiedTextureWorkspace.bindings[0]).toMatchObject({
      modelId: copiedModels[0]!.id,
      cubeId: copiedModels[0]!.elements[0]!.id,
      materialId: copiedTextureWorkspace.materials[0]!.id,
      uv: sourceBinding.uv,
    })
  })

  it('updates project metadata without changing its identity', async () => {
    const source = await repository.createProject(input())
    const updated = await repository.updateProject(source.id, { name: 'Urbanismo 2' })

    expect(updated.id).toBe(source.id)
    expect(updated.createdAt).toBe(source.createdAt)
    expect(updated.name).toBe('Urbanismo 2')
    expect(updated.revision).toBe(2)
  })

  it('remaps Rework block links when duplicating a project', async () => {
    const source = await repository.createProject(input())
    const resources = new ResourceRepository(database)
    const textures = new TextureRepository(database, inspectTestImage)
    const material = await textures.createMaterial({ projectId: source.id, name: 'Rework Yellow' })
    const asset = await resources.addAsset({
      projectId: source.id,
      kind: 'model',
      file: new File(['{"format_version":"1.21.0"}'], 'desk.geo.json', { type: 'application/json' }),
    })
    const model = await resources.create<ModelResourcePayload>({
      projectId: source.id,
      type: 'model',
      name: 'Desk',
      identifier: 'geometry.rio_grande.desk',
      payload: { format: 'bedrock_geometry', assetId: asset.id, originalFilename: 'desk.geo.json' },
    })
    await resources.attachAsset(asset.id, model.id)
    const payload: BlockResourcePayload = {
      displayName: 'Desk Block',
      nameColor: '#ffffff',
      translations: [{ locale: 'en', name: 'Desk Block' }],
      textures: { mode: 'all', all: material.id },
      light: { enabled: false, level: 0, vibrantColorEnabled: false, color: '#ffffff' },
      transparency: 'opaque',
      blocksLight: true,
      destroyTime: 1,
      explosionResistance: 1,
      recommendedTool: 'axe',
      requiredToolLevel: 'none',
      dropIdentifier: '',
      silkTouch: false,
      fortune: false,
      sound: 'wood',
      collision: 'full',
      selectionBox: 'full',
      flammable: true,
      friction: 0.6,
      movementSpeed: 1,
      mapColor: '#f5c518',
      orientation: 'none',
      creativeCategory: 'construction',
      maxStackSize: 64,
      recipe: { enabled: false },
      pluginIds: [],
      customModel: {
        resourceId: model.id,
        scale: { x: 1, y: 1, z: 1 },
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        collision: 'automatic',
        renderMethod: 'opaque',
        animationsEnabled: false,
      },
    }
    await resources.create({
      projectId: source.id,
      type: 'block_model',
      name: 'Desk Block',
      identifier: 'rio_grande_urbanismo:desk',
      payload,
    })

    const duplicate = await repository.duplicateProject(source.id)
    const [copiedModel] = await resources.list<ModelResourcePayload>(duplicate.id, 'model')
    const [copiedBlock] = await resources.list<BlockResourcePayload>(duplicate.id, 'block_model')
    const [copiedMaterial] = await textures.listMaterials(duplicate.id)
    const copiedAsset = copiedModel ? await resources.getAsset(copiedModel.payload.assetId) : undefined

    expect(copiedModel?.id).not.toBe(model.id)
    expect(copiedAsset?.resourceId).toBe(copiedModel?.id)
    expect(copiedBlock?.payload.customModel?.resourceId).toBe(copiedModel?.id)
    expect(copiedBlock?.payload.textures.all).toBe(copiedMaterial?.id)
    expect(copiedBlock?.payload.textures.all).not.toBe(material.id)
  })
})
