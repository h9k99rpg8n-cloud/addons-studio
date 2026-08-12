import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { DEFAULT_BEDROCK_VERSION } from '@/core/project/bedrockVersions'
import { ProjectRepository } from '@/core/project/projectRepository'
import { AddonsStudioDatabase } from '@/core/storage/database'
import type { CreateProjectInput } from '@/types/project'

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

  it('updates project metadata without changing its identity', async () => {
    const source = await repository.createProject(input())
    const updated = await repository.updateProject(source.id, { name: 'Urbanismo 2' })

    expect(updated.id).toBe(source.id)
    expect(updated.createdAt).toBe(source.createdAt)
    expect(updated.name).toBe('Urbanismo 2')
    expect(updated.revision).toBe(2)
  })
})
