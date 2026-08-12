import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { DEFAULT_BEDROCK_VERSION } from '@/core/project/bedrockVersions'
import { ProjectPersistenceService } from '@/core/project/projectPersistenceService'
import { ProjectRepository } from '@/core/project/projectRepository'
import { AddonsStudioDatabase } from '@/core/storage/database'

describe('ProjectPersistenceService', () => {
  let database: AddonsStudioDatabase
  let repository: ProjectRepository
  let persistence: ProjectPersistenceService

  beforeEach(() => {
    database = new AddonsStudioDatabase(`addons-studio-autosave-${crypto.randomUUID()}`)
    repository = new ProjectRepository(database)
    persistence = new ProjectPersistenceService(repository)
  })

  afterEach(async () => {
    database.close()
    await database.delete()
  })

  it('debounces a meaningful change and creates a bounded recovery checkpoint', async () => {
    const project = await repository.createProject({
      name: 'Autosave Test',
      namespace: 'autosave_test',
      projectType: 'addon',
      targetVersion: DEFAULT_BEDROCK_VERSION,
      experimentalFeatures: false,
    })

    persistence.schedule({ ...project, name: 'Autosaved Name' }, {}, 5)
    expect((await repository.getProject(project.id))?.name).toBe('Autosave Test')

    await new Promise((resolve) => setTimeout(resolve, 25))
    expect((await repository.getProject(project.id))?.name).toBe('Autosaved Name')

    await persistence.checkpointDirtyProjects()
    const snapshots = await repository.listSnapshots(project.id)
    expect(snapshots.map((snapshot) => snapshot.reason)).toEqual(['recovery', 'created'])
  })
})
