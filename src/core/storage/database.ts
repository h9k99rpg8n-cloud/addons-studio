import Dexie, { type Table } from 'dexie'

import { DATABASE_SCHEMA_VERSION } from '@/core/project/constants'
import type { ModelReferenceAsset, StudioModel } from '@/types/model'
import type {
  ProjectSnapshot,
  StudioProject,
  StudioProjectFolder,
  StudioSetting,
} from '@/types/project'

export const DATABASE_NAME = 'addons-studio'

export class AddonsStudioDatabase extends Dexie {
  projects!: Table<StudioProject, string>
  snapshots!: Table<ProjectSnapshot, string>
  settings!: Table<StudioSetting, string>
  projectFolders!: Table<StudioProjectFolder, string>
  models!: Table<StudioModel, string>
  modelReferenceAssets!: Table<ModelReferenceAsset, string>

  constructor(name = DATABASE_NAME) {
    super(name)

    this.version(1).stores({
      projects:
        '&id, name, namespace, projectType, targetVersion, createdAt, updatedAt, schemaVersion',
      snapshots: '&id, projectId, createdAt, [projectId+createdAt]',
      settings: '&key, updatedAt',
    })

    this.version(DATABASE_SCHEMA_VERSION).stores({
      projects:
        '&id, name, namespace, folderId, projectType, targetVersion, createdAt, updatedAt, schemaVersion',
      snapshots: '&id, projectId, createdAt, [projectId+createdAt]',
      settings: '&key, updatedAt',
      projectFolders: '&id, name, createdAt, updatedAt',
      models: '&id, projectId, identifier, updatedAt, [projectId+updatedAt], [projectId+identifier]',
      modelReferenceAssets: '&id, modelId, projectId, createdAt, [modelId+createdAt]',
    })
  }
}

export const studioDatabase = new AddonsStudioDatabase()
