import { AppError } from '@/core/errors/AppError'
import { type AddonsStudioDatabase, studioDatabase } from '@/core/storage/database'
import type { StudioProjectFolder } from '@/types/project'
import { createId } from '@/utils/createId'

import { validateProjectFolderName } from './projectFolderValidation'

const FOLDER_SCHEMA_VERSION = 1

function cloneFolder(folder: StudioProjectFolder): StudioProjectFolder {
  return { ...folder }
}

export class ProjectFolderRepository {
  constructor(private readonly database: AddonsStudioDatabase = studioDatabase) {}

  async createFolder(name: string): Promise<StudioProjectFolder> {
    const issue = validateProjectFolderName(name)[0]
    if (issue) throw new AppError('FOLDER_VALIDATION', issue.message)

    const now = Date.now()
    const folder: StudioProjectFolder = {
      id: createId(),
      name: name.trim(),
      createdAt: now,
      updatedAt: now,
      schemaVersion: FOLDER_SCHEMA_VERSION,
    }

    try {
      await this.database.projectFolders.add(folder)
      return cloneFolder(folder)
    } catch (error) {
      throw new AppError(
        'FOLDER_SAVE_FAILED',
        'Addons Studio could not create this folder. No projects were moved.',
        { cause: error },
      )
    }
  }

  async listFolders(): Promise<StudioProjectFolder[]> {
    const folders = await this.database.projectFolders.toArray()
    return folders
      .map(cloneFolder)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  }

  async getFolder(id: string): Promise<StudioProjectFolder | undefined> {
    const folder = await this.database.projectFolders.get(id)
    return folder ? cloneFolder(folder) : undefined
  }

  async renameFolder(id: string, name: string): Promise<StudioProjectFolder> {
    const issue = validateProjectFolderName(name)[0]
    if (issue) throw new AppError('FOLDER_VALIDATION', issue.message)

    const existing = await this.database.projectFolders.get(id)
    if (!existing) {
      throw new AppError('FOLDER_NOT_FOUND', 'This project folder is no longer available.')
    }

    const updated = { ...existing, name: name.trim(), updatedAt: Date.now() }
    try {
      await this.database.projectFolders.put(updated)
      return cloneFolder(updated)
    } catch (error) {
      throw new AppError('FOLDER_SAVE_FAILED', 'Addons Studio could not rename this folder.', {
        cause: error,
      })
    }
  }

  async moveProject(projectId: string, folderId?: string): Promise<void> {
    if (folderId && !(await this.database.projectFolders.get(folderId))) {
      throw new AppError('FOLDER_NOT_FOUND', 'The selected project folder is no longer available.')
    }
    const project = await this.database.projects.get(projectId)
    if (!project) {
      throw new AppError('PROJECT_NOT_FOUND', 'This project is no longer available on this device.')
    }

    try {
      const updated = {
        ...project,
        folderId,
        updatedAt: Date.now(),
        revision: project.revision + 1,
      }
      if (!folderId) delete updated.folderId
      await this.database.projects.put(updated)
    } catch (error) {
      throw new AppError(
        'FOLDER_SAVE_FAILED',
        'Addons Studio could not move this project. It remains in its previous location.',
        { cause: error },
      )
    }
  }

  async countProjects(folderId: string): Promise<number> {
    return this.database.projects.where('folderId').equals(folderId).count()
  }

  /**
   * Folder deletion is deliberately non-destructive: projects are moved to
   * the root list in the same IndexedDB transaction before the folder goes.
   */
  async deleteFolderAndMoveProjectsToRoot(id: string): Promise<number> {
    try {
      return await this.database.transaction(
        'rw',
        [this.database.projectFolders, this.database.projects],
        async () => {
          const folder = await this.database.projectFolders.get(id)
          if (!folder) {
            throw new AppError('FOLDER_NOT_FOUND', 'This project folder is no longer available.')
          }

          const projects = await this.database.projects.where('folderId').equals(id).toArray()
          const now = Date.now()
          await this.database.projects.bulkPut(
            projects.map((project) => {
              const updated = {
                ...project,
                updatedAt: now,
                revision: project.revision + 1,
              }
              delete updated.folderId
              return updated
            }),
          )
          await this.database.projectFolders.delete(id)
          return projects.length
        },
      )
    } catch (error) {
      if (error instanceof AppError) throw error
      throw new AppError(
        'FOLDER_SAVE_FAILED',
        'Addons Studio could not delete this folder. Its projects were not changed.',
        { cause: error },
      )
    }
  }
}

export const projectFolderRepository = new ProjectFolderRepository()
