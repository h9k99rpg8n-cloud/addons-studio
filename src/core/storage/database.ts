import Dexie, { type Table } from 'dexie'

import { DATABASE_SCHEMA_VERSION } from '@/core/project/constants'
import type { ProjectSnapshot, StudioProject, StudioSetting } from '@/types/project'

export const DATABASE_NAME = 'addons-studio'

export class AddonsStudioDatabase extends Dexie {
  projects!: Table<StudioProject, string>
  snapshots!: Table<ProjectSnapshot, string>
  settings!: Table<StudioSetting, string>

  constructor(name = DATABASE_NAME) {
    super(name)

    this.version(DATABASE_SCHEMA_VERSION).stores({
      projects:
        '&id, name, namespace, projectType, targetVersion, createdAt, updatedAt, schemaVersion',
      snapshots: '&id, projectId, createdAt, [projectId+createdAt]',
      settings: '&key, updatedAt',
    })
  }
}

export const studioDatabase = new AddonsStudioDatabase()
