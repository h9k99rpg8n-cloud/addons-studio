import Dexie, { type Table } from 'dexie'

import { DATABASE_SCHEMA_VERSION } from '@/core/project/constants'
import type { ModelEditorAsset, StudioModel } from '@/types/model'
import type {
  ProjectSnapshot,
  StudioProject,
  StudioProjectFolder,
  StudioSetting,
} from '@/types/project'
import type { StudioMaterial, StudioTextureAsset, StudioTextureBinding } from '@/types/texture'
import type { StudioResource, StudioResourceAsset, StudioResourceFolder } from '@/types/resource'

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
  textureAssets!: Table<StudioTextureAsset, string>
  materials!: Table<StudioMaterial, string>
  textureBindings!: Table<StudioTextureBinding, string>
  resources!: Table<StudioResource, string>
  resourceFolders!: Table<StudioResourceFolder, string>
  resourceAssets!: Table<StudioResourceAsset, string>

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

    this.version(3).stores({
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

    this.version(DATABASE_SCHEMA_VERSION).stores({
      projects:
        '&id, name, namespace, folderId, projectType, targetVersion, createdAt, updatedAt, schemaVersion',
      snapshots: '&id, projectId, createdAt, [projectId+createdAt]',
      settings: '&key, updatedAt',
      projectFolders: '&id, name, createdAt, updatedAt',
      models: '&id, projectId, identifier, updatedAt, [projectId+updatedAt], [projectId+identifier]',
      modelReferenceAssets: '&id, modelId, projectId, createdAt, [modelId+createdAt]',
      modelEditorAssets: '&id, modelId, projectId, kind, createdAt, [modelId+kind], [modelId+createdAt]',
      textureAssets: '&id, projectId, updatedAt, [projectId+updatedAt]',
      materials: '&id, projectId, folderId, identifier, updatedAt, [projectId+updatedAt], [projectId+identifier]',
      textureBindings: '&id, modelId, projectId, cubeId, materialId, updatedAt, [modelId+cubeId], [modelId+materialId]',
      resources: '&id, projectId, type, folderId, updatedAt, [projectId+type], [projectId+updatedAt], [projectId+type+updatedAt]',
      resourceFolders: '&id, projectId, resourceType, parentId, name, [projectId+resourceType]',
      resourceAssets: '&id, projectId, resourceId, kind, updatedAt, [projectId+kind], [projectId+updatedAt]',
    })
  }
}

export const studioDatabase = new AddonsStudioDatabase()
