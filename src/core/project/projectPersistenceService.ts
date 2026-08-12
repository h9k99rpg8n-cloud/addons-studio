import { logger } from '@/core/errors/logger'
import { AUTOSAVE_DELAY_MS } from '@/core/project/constants'
import { projectRepository, type ProjectRepository } from '@/core/project/projectRepository'
import type { ProjectUpdate, StudioProject } from '@/types/project'

interface PendingSave {
  project: StudioProject
  timer: ReturnType<typeof setTimeout>
  onSaved?: (project: StudioProject) => void
  onError?: (error: unknown) => void
}

function cloneProject(project: StudioProject): StudioProject {
  return { ...project, icon: { ...project.icon } }
}

function toUpdate(project: StudioProject): ProjectUpdate {
  return {
    name: project.name,
    namespace: project.namespace,
    description: project.description,
    icon: project.icon,
    projectType: project.projectType,
    targetVersion: project.targetVersion,
    experimentalFeatures: project.experimentalFeatures,
  }
}

export class ProjectPersistenceService {
  private readonly pending = new Map<string, PendingSave>()
  private readonly dirtyForRecovery = new Set<string>()

  constructor(private readonly repository: ProjectRepository = projectRepository) {}

  schedule(
    project: StudioProject,
    callbacks: Pick<PendingSave, 'onSaved' | 'onError'> = {},
    delay = AUTOSAVE_DELAY_MS,
  ): void {
    const existing = this.pending.get(project.id)
    if (existing) clearTimeout(existing.timer)

    const timer = setTimeout(() => void this.flush(project.id), delay)
    this.pending.set(project.id, {
      project: cloneProject(project),
      timer,
      ...callbacks,
    })
  }

  async flush(projectId: string): Promise<StudioProject | undefined> {
    const pending = this.pending.get(projectId)
    if (!pending) return undefined

    clearTimeout(pending.timer)
    this.pending.delete(projectId)

    try {
      const saved = await this.repository.updateProject(projectId, toUpdate(pending.project))
      this.dirtyForRecovery.add(projectId)
      pending.onSaved?.(saved)
      return saved
    } catch (error) {
      logger.error('Autosave failed', {
        area: 'project-persistence',
        action: 'flush',
        details: { projectId, error },
      })
      pending.onError?.(error)
      throw error
    }
  }

  async flushAll(): Promise<void> {
    const projectIds = Array.from(this.pending.keys())
    const results = await Promise.allSettled(projectIds.map((id) => this.flush(id)))
    const rejection = results.find((result) => result.status === 'rejected')
    if (rejection?.status === 'rejected') throw rejection.reason
  }

  async checkpointDirtyProjects(): Promise<void> {
    const projectIds = Array.from(this.dirtyForRecovery)
    this.dirtyForRecovery.clear()

    const results = await Promise.allSettled(
      projectIds.map((projectId) => this.repository.createRecoverySnapshot(projectId)),
    )

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const projectId = projectIds[index]
        if (projectId) this.dirtyForRecovery.add(projectId)
        logger.warn('Recovery snapshot failed', {
          area: 'project-persistence',
          action: 'checkpoint',
          details: { projectId, error: result.reason },
        })
      }
    })
  }

  cancel(projectId: string): void {
    const pending = this.pending.get(projectId)
    if (pending) clearTimeout(pending.timer)
    this.pending.delete(projectId)
    this.dirtyForRecovery.delete(projectId)
  }
}

export const projectPersistenceService = new ProjectPersistenceService()
