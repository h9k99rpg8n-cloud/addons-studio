import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { DEFAULT_BEDROCK_VERSION } from '@/core/project/bedrockVersions'
import { ProjectFolderRepository } from '@/core/project/projectFolderRepository'
import { ProjectRepository } from '@/core/project/projectRepository'
import { AddonsStudioDatabase } from '@/core/storage/database'

describe('project folders', () => {
  let databaseName: string
  let database: AddonsStudioDatabase
  let folders: ProjectFolderRepository
  let projects: ProjectRepository

  beforeEach(() => {
    databaseName = `addons-studio-folders-${crypto.randomUUID()}`
    database = new AddonsStudioDatabase(databaseName)
    folders = new ProjectFolderRepository(database)
    projects = new ProjectRepository(database)
  })

  afterEach(async () => {
    database.close()
    await database.delete()
  })

  it('creates, renames, and persists a one-level folder with its project placement', async () => {
    const folder = await folders.createFolder('Río Grande')
    const project = await projects.createProject({
      name: 'Río Grande Urbanismo',
      namespace: 'rio_grande_urbanismo',
      projectType: 'addon',
      targetVersion: DEFAULT_BEDROCK_VERSION,
      experimentalFeatures: false,
    })

    await folders.renameFolder(folder.id, 'Río Grande Suite')
    await folders.moveProject(project.id, folder.id)
    database.close()

    database = new AddonsStudioDatabase(databaseName)
    folders = new ProjectFolderRepository(database)
    projects = new ProjectRepository(database)

    expect(await folders.getFolder(folder.id)).toMatchObject({ name: 'Río Grande Suite' })
    expect(await projects.getProject(project.id)).toMatchObject({ folderId: folder.id })
    expect(await folders.countProjects(folder.id)).toBe(1)
  })

  it('moves contained projects to root before deleting a folder', async () => {
    const folder = await folders.createFolder('Miraculous')
    const project = await projects.createProject({
      name: 'Main Add-on',
      namespace: 'main_addon',
      projectType: 'addon',
      targetVersion: DEFAULT_BEDROCK_VERSION,
      experimentalFeatures: false,
      folderId: folder.id,
    })

    expect(await folders.deleteFolderAndMoveProjectsToRoot(folder.id)).toBe(1)
    expect(await folders.getFolder(folder.id)).toBeUndefined()
    expect((await projects.getProject(project.id))?.folderId).toBeUndefined()
  })

  it('rejects moves to a missing folder without changing the project', async () => {
    const project = await projects.createProject({
      name: 'Safe Project',
      namespace: 'safe_project',
      projectType: 'addon',
      targetVersion: DEFAULT_BEDROCK_VERSION,
      experimentalFeatures: false,
    })

    await expect(folders.moveProject(project.id, 'missing')).rejects.toThrow('no longer available')
    expect((await projects.getProject(project.id))?.folderId).toBeUndefined()
  })
})
