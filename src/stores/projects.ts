import { defineStore } from 'pinia'

import { AppError, toAppError } from '@/core/errors/AppError'
import { projectFolderRepository } from '@/core/project/projectFolderRepository'
import { projectPersistenceService } from '@/core/project/projectPersistenceService'
import { projectRepository } from '@/core/project/projectRepository'
import type {
  CreateProjectInput,
  ProjectUpdate,
  StudioProject,
  StudioProjectFolder,
} from '@/types/project'

export const useProjectStore = defineStore('projects', {
  state: () => ({
    projects: [] as StudioProject[],
    folders: [] as StudioProjectFolder[],
    activeProject: undefined as StudioProject | undefined,
    loading: false,
    initialized: false,
  }),
  getters: {
    recentProjects: (state): StudioProject[] => state.projects.slice(0, 4),
    rootProjects: (state): StudioProject[] =>
      state.projects.filter((project) => !project.folderId),
    projectsInFolder: (state) => (folderId: string): StudioProject[] =>
      state.projects.filter((project) => project.folderId === folderId),
  },
  actions: {
    async loadProjects(force = false): Promise<void> {
      if (this.initialized && !force) return
      this.loading = true
      try {
        const [localProjects, localFolders] = await Promise.all([
          projectRepository.listProjects(),
          projectFolderRepository.listFolders(),
        ])
        this.projects = localProjects
        this.folders = localFolders
        this.initialized = true
      } finally {
        this.loading = false
      }
    },
    async createProject(input: CreateProjectInput): Promise<StudioProject> {
      const project = await projectRepository.createProject(input)
      this.replaceProject(project)
      this.activeProject = project
      return project
    },
    async openProject(id: string): Promise<StudioProject> {
      const project = await projectRepository.getProject(id)
      if (!project) {
        throw new AppError('PROJECT_NOT_FOUND', 'This project is no longer available on this device.')
      }
      this.activeProject = project
      return project
    },
    async updateProject(
      id: string,
      changes: ProjectUpdate,
      immediate = false,
    ): Promise<StudioProject> {
      const current = this.projects.find((project) => project.id === id) ?? this.activeProject
      if (!current || current.id !== id) {
        throw new AppError('PROJECT_NOT_FOUND', 'This project is no longer available on this device.')
      }

      const optimistic: StudioProject = {
        ...current,
        ...changes,
        icon: changes.icon ? { ...changes.icon } : current.icon,
        updatedAt: Date.now(),
      }
      this.replaceProject(optimistic)

      projectPersistenceService.schedule(optimistic, {
        onSaved: (saved) => this.replaceProject(saved),
        onError: () => this.replaceProject(current),
      })

      if (!immediate) return optimistic

      try {
        return (await projectPersistenceService.flush(id)) ?? optimistic
      } catch (error) {
        throw toAppError(error, 'Addons Studio could not save this project.')
      }
    },
    renameProject(id: string, name: string): Promise<StudioProject> {
      return this.updateProject(id, { name }, true)
    },
    async createFolder(name: string): Promise<StudioProjectFolder> {
      const folder = await projectFolderRepository.createFolder(name)
      this.folders.push(folder)
      this.sortFolders()
      return folder
    },
    async renameFolder(id: string, name: string): Promise<StudioProjectFolder> {
      const folder = await projectFolderRepository.renameFolder(id, name)
      const index = this.folders.findIndex((entry) => entry.id === id)
      if (index >= 0) this.folders.splice(index, 1, folder)
      else this.folders.push(folder)
      this.sortFolders()
      return folder
    },
    async moveProjectToFolder(id: string, folderId?: string): Promise<StudioProject> {
      await projectPersistenceService.flush(id)
      await projectFolderRepository.moveProject(id, folderId)
      const moved = await projectRepository.getProject(id)
      if (!moved) {
        throw new AppError('PROJECT_NOT_FOUND', 'This project is no longer available on this device.')
      }
      this.replaceProject(moved)
      return moved
    },
    async deleteFolder(id: string): Promise<number> {
      const movedCount = await projectFolderRepository.deleteFolderAndMoveProjectsToRoot(id)
      this.folders = this.folders.filter((folder) => folder.id !== id)
      this.projects = await projectRepository.listProjects()
      if (this.activeProject) {
        this.activeProject = this.projects.find((project) => project.id === this.activeProject?.id)
      }
      return movedCount
    },
    async duplicateProject(id: string): Promise<StudioProject> {
      await projectPersistenceService.flush(id)
      const duplicate = await projectRepository.duplicateProject(id)
      this.replaceProject(duplicate)
      return duplicate
    },
    async deleteProject(id: string): Promise<void> {
      projectPersistenceService.cancel(id)
      await projectRepository.deleteProject(id)
      this.projects = this.projects.filter((project) => project.id !== id)
      if (this.activeProject?.id === id) this.activeProject = undefined
    },
    async flushPendingSaves(): Promise<void> {
      await projectPersistenceService.flushAll()
    },
    async createRecoverySnapshots(): Promise<void> {
      await projectPersistenceService.checkpointDirtyProjects()
    },
    replaceProject(project: StudioProject): void {
      const index = this.projects.findIndex((entry) => entry.id === project.id)
      if (index >= 0) this.projects.splice(index, 1)
      this.projects.push(project)
      this.projects.sort((a, b) => b.updatedAt - a.updatedAt)
      if (this.activeProject?.id === project.id) this.activeProject = project
    },
    sortFolders(): void {
      this.folders.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
      )
    },
  },
})
