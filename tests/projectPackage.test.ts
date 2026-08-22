import { strToU8, unzipSync, zipSync } from 'fflate'
import { Blob as NodeBlob } from 'node:buffer'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createStudioCube, createStudioGroup } from '@/core/model/modelFactory'
import { createModelFolder } from '@/core/model/modelFolders'
import { ModelRepository } from '@/core/model/modelRepository'
import { DEFAULT_BEDROCK_VERSION } from '@/core/project/bedrockVersions'
import { ProjectFolderRepository } from '@/core/project/projectFolderRepository'
import { ProjectPackageService } from '@/core/project/projectPackageService'
import { ProjectRepository } from '@/core/project/projectRepository'
import { ResourceRepository } from '@/core/resources/resourceRepository'
import { AddonsStudioDatabase } from '@/core/storage/database'
import { TextureRepository } from '@/core/texture/textureRepository'

const inspectTestImage = async (file: File) => ({
  mimeType: file.type === 'image/jpeg' ? 'image/jpeg' as const : 'image/png' as const,
  width: 320,
  height: 240,
})

describe('Addons Studio project package beta', () => {
  let database: AddonsStudioDatabase
  let projects: ProjectRepository
  let models: ModelRepository
  let packages: ProjectPackageService

  beforeEach(() => {
    database = new AddonsStudioDatabase(`addons-studio-package-${crypto.randomUUID()}`)
    projects = new ProjectRepository(database)
    models = new ModelRepository(database, inspectTestImage)
    packages = new ProjectPackageService(database)
  })

  afterEach(async () => {
    database.close()
    await database.delete()
  })

  async function createSourceProject() {
    const project = await projects.createProject({
      name: 'Portable Workshop',
      namespace: 'portable_workshop',
      description: 'Snapshot 3 package fixture',
      projectType: 'addon',
      targetVersion: DEFAULT_BEDROCK_VERSION,
      experimentalFeatures: false,
    })
    const projectFolder = await new ProjectFolderRepository(database).createFolder('Portable Sets')
    await new ProjectFolderRepository(database).moveProject(project.id, projectFolder.id)
    let model = await models.createModel({
      projectId: project.id,
      name: 'Barrel',
      identifier: 'geometry.portable_workshop.barrel',
    })
    const cube = createStudioCube()
    const group = createStudioGroup(0, [cube])
    const folder = createModelFolder(model, 'Barrel Pieces')
    group.folderId = folder.id
    cube.parentId = group.id
    model.elements.push(cube)
    model.groups.push(group)
    model.folders.push(folder)
    model = await models.saveModel(model)
    model = (await models.addReferenceAsset(
      model,
      new File(['reference'], 'front.png', { type: 'image/png' }),
    )).model
    model = (await models.addBackgroundAsset(
      model,
      new File(['background'], 'studio.jpg', { type: 'image/jpeg' }),
    )).model
    // fake-indexeddb cannot structured-clone Happy DOM's Blob implementation;
    // use Node's standards-compatible Blob so this test exercises real bytes.
    const storedAssets = await database.modelEditorAssets.where('modelId').equals(model.id).toArray()
    await database.modelEditorAssets.bulkPut(storedAssets.map((asset, index) => ({
      ...asset,
      blob: new NodeBlob([index === 0 ? 'reference' : 'background'], { type: asset.mimeType }) as unknown as Blob,
    })))
    const resources = new ResourceRepository(database)
    const recipeFolder = await resources.createFolder({
      projectId: project.id,
      resourceType: 'recipe',
      name: 'Crafting',
    })
    await resources.create({
      projectId: project.id,
      type: 'recipe',
      folderId: recipeFolder.id,
      name: 'Barrel Recipe',
      identifier: 'portable_workshop:barrel',
      payload: { kind: 'shaped', pattern: ['PPP', 'P P', 'PPP'] },
    })
    await new TextureRepository(database, inspectTestImage).createMaterial({
      projectId: project.id,
      name: 'Barrel Wood',
    })
    return { project: (await projects.getProject(project.id))!, model, projectFolder }
  }

  it('exports, previews, and transactionally imports models, folders, references, and assets', async () => {
    const { project } = await createSourceProject()
    const stages: string[] = []
    const exported = await packages.exportProject(project.id, (stage) => stages.push(stage))
    expect(exported.filename).toBe('portable-workshop.addonsstudio')
    expect(exported.manifest.content).toMatchObject({
      models: 1,
      cubes: 1,
      groups: 1,
      modelFolders: 1,
      editorAssets: 2,
      resources: 1,
      resourceFolders: 1,
      materials: 1,
    })
    expect(stages).toEqual(expect.arrayContaining(['reading', 'validating', 'models', 'assets', 'finishing']))

    const inspected = await packages.inspectPackage(exported.blob)
    expect(packages.previewPackage(inspected)).toMatchObject({
      name: 'Portable Workshop',
      namespace: 'portable_workshop',
      formatVersion: 2,
    })
    const imported = await packages.importPackage(inspected)
    expect(imported.id).not.toBe(project.id)
    expect(imported.namespace).toBe('portable_workshop_imported')
    const importedFolder = imported.folderId ? await database.projectFolders.get(imported.folderId) : undefined
    expect(importedFolder).toMatchObject({ name: 'Portable Sets 2' })
    const importedModels = await models.listModels(imported.id)
    const importedAssets = await models.listEditorAssets(importedModels[0]!.id)
    expect(importedModels[0]?.folders).toHaveLength(1)
    expect(importedModels[0]?.references).toHaveLength(1)
    expect(importedModels[0]?.editor.background.type).toBe('custom')
    expect(importedAssets).toHaveLength(2)
    expect(importedAssets.every((asset) => asset.projectId === imported.id)).toBe(true)
    expect(await database.resources.where('projectId').equals(imported.id).count()).toBe(1)
    expect(await database.resourceFolders.where('projectId').equals(imported.id).count()).toBe(1)
    expect(await database.materials.where('projectId').equals(imported.id).count()).toBe(1)
  })

  it('never overwrites project IDs or namespaces when the same package is imported twice', async () => {
    const { project } = await createSourceProject()
    const inspected = await packages.inspectPackage((await packages.exportProject(project.id)).blob)
    const first = await packages.importPackage(inspected)
    const second = await packages.importPackage(inspected)
    expect(new Set([project.id, first.id, second.id]).size).toBe(3)
    expect(first.namespace).toBe('portable_workshop_imported')
    expect(second.namespace).toBe('portable_workshop_imported_2')
  })

  it('rejects corrupted packages and missing assets', async () => {
    await expect(packages.inspectPackage(new Blob(['not a zip']))).rejects.toThrow('not a readable')
    const { project } = await createSourceProject()
    const exported = await packages.exportProject(project.id)
    const entries = unzipSync(new Uint8Array(await exported.blob.arrayBuffer()))
    const assetPath = exported.manifest.assets[0]!.path
    delete entries[assetPath]
    const corrupted = new Blob([zipSync(entries)])
    await expect(packages.inspectPackage(corrupted)).rejects.toThrow('missing editor asset')
  })

  it('rolls back the whole import when model conversion fails', async () => {
    const { project } = await createSourceProject()
    const exported = await packages.exportProject(project.id)
    const entries = unzipSync(new Uint8Array(await exported.blob.arrayBuffer()))
    const modelPath = exported.manifest.models[0]!.modelPath
    entries[modelPath] = strToU8(JSON.stringify({ unrelated: true }))
    const inspected = await packages.inspectPackage(new Blob([zipSync(entries)]))
    const before = await database.projects.count()
    await expect(packages.importPackage(inspected)).rejects.toThrow('recognized model format')
    expect(await database.projects.count()).toBe(before)
    expect(await database.models.where('projectId').notEqual(project.id).count()).toBe(0)
  })
})
