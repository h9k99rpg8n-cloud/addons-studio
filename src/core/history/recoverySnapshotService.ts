import { projectRepository, type ProjectRepository } from '@/core/project/projectRepository'
import type { ProjectSnapshot } from '@/types/project'

export class RecoverySnapshotService {
  constructor(private readonly repository: ProjectRepository = projectRepository) {}

  create(projectId: string): Promise<ProjectSnapshot | undefined> {
    return this.repository.createRecoverySnapshot(projectId, 'recovery')
  }

  list(projectId: string): Promise<ProjectSnapshot[]> {
    return this.repository.listSnapshots(projectId)
  }
}

export const recoverySnapshotService = new RecoverySnapshotService()
