import Dexie, { type Table } from 'dexie'

import { DATABASE_SCHEMA_VERSION } from '@/core/project/constants'
import type { ModelEditorAsset, StudioModel } from '@/types/model'
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
  /** Alpha 0.0.3–0.0.3.6 compatibility store. New writes use modelEditorAssets. */
  modelReferenceAssets!: Table<ModelEditorAsset, string>
  modelEditorAssets!: Table<ModelEditorAsset, string>

  constructor(name = DATABASE_NAME) {
    super(name)

    this.version(1).stores({
      projects:
        '&id, name, namespace, projectType, targetVersion, createdAt, updatedAt, schemaVersion',
      snapshots: '&id, projectId, createdAt, [projectId+createdAt]',
      settings: '&key, updatedAt',
    })

    this.version(2).stores({
      projects:
        '&id, name, namespace, folderId, projectType, targetVersion, createdAt, updatedAt, schemaVersion',
      snapshots: '&id, projectId, createdAt, [projectId+createdAt]',
      settings: '&key, updatedAt',
      projectFolders: '&id, name, createdAt, updatedAt',
      models: '&id, projectId, identifier, updatedAt, [projectId+updatedAt], [projectId+identifier]',
      modelReferenceAssets: '&id, modelId, projectId, createdAt, [modelId+createdAt]',
    })

    this.version(DATABASE_SCHEMA_VERSION).stores({
      projects:
        '&id, name, namespace, folderId, projectType, targetVersion, createdAt, updatedAt, schemaVersion',
      snapshots: '&id, projectId, createdAt, [projectId+createdAt]',
      settings: '&key, updatedAt',
      projectFolders: '&id, name, createdAt, updatedAt',
      models: '&id, projectId, identifier, updatedAt, [projectId+updatedAt], [projectId+identifier]',
      modelReferenceAssets: '&id, modelId, projectId, createdAt, [modelId+createdAt]',
      modelEditorAssets: '&id, modelId, projectId, kind, createdAt, [modelId+kind], [modelId+createdAt]',
    }).upgrade(async (transaction) => {
      const legacyAssets = await transaction.table('modelReferenceAssets').toArray()
      if (!legacyAssets.length) return
      await transaction.table('modelEditorAssets').bulkPut(legacyAssets.map((asset) => ({
        ...asset,
        kind: 'reference',
        width: Number.isFinite(asset.width) ? asset.width : 0,
        height: Number.isFinite(asset.height) ? asset.height : 0,
      })))
    })
  }
}

export const studioDatabase = new AddonsStudioDatabase()
