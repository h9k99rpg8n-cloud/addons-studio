import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createStudioCube, createStudioGroup } from '@/core/model/modelFactory'
import { ModelRepository } from '@/core/model/modelRepository'
import { DEFAULT_BEDROCK_VERSION } from '@/core/project/bedrockVersions'
import { ProjectRepository } from '@/core/project/projectRepository'
import { AddonsStudioDatabase } from '@/core/storage/database'
import type { CreateProjectInput } from '@/types/project'

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

  it('duplicates models and reference assets as independent project data', async () => {
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
    model = (
      await models.addBackgroundAsset(
        model,
        new File(['background'], 'studio.jpg', { type: 'image/jpeg' }),
      )
    ).model

    const duplicate = await repository.duplicateProject(source.id)
    const copiedModels = await models.listModels(duplicate.id)
    const copiedAssets = await models.listEditorAssets(copiedModels[0]!.id)

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
  })

  it('updates project metadata without changing its identity', async () => {
    const source = await repository.createProject(input())
    const updated = await repository.updateProject(source.id, { name: 'Urbanismo 2' })

    expect(updated.id).toBe(source.id)
    expect(updated.createdAt).toBe(source.createdAt)
    expect(updated.name).toBe('Urbanismo 2')
    expect(updated.revision).toBe(2)
  })
})
