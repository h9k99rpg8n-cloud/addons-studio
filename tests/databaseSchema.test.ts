import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'

import { DATABASE_SCHEMA_VERSION } from '@/core/project/constants'
import { AddonsStudioDatabase } from '@/core/storage/database'

describe('database schema', () => {
  const database = new AddonsStudioDatabase(`addons-studio-schema-${crypto.randomUUID()}`)

  afterEach(async () => {
    database.close()
    await database.delete()
  })

  it('exposes the versioned project, folder, model, reference, snapshot, and settings stores', () => {
    expect(DATABASE_SCHEMA_VERSION).toBe(3)
    expect(database.tables.map((table) => table.name).sort()).toEqual([
      'modelEditorAssets',
      'modelReferenceAssets',
      'models',
      'projectFolders',
      'projects',
      'settings',
      'snapshots',
    ])
    expect(database.projects.schema.primKey.name).toBe('id')
    expect(database.snapshots.schema.indexes.map((index) => index.name)).toContain(
      '[projectId+createdAt]',
    )
    expect(database.models.schema.indexes.map((index) => index.name)).toContain(
      '[projectId+identifier]',
    )
    expect(database.projects.schema.indexes.map((index) => index.name)).toContain('folderId')
  })

  it('upgrades an Alpha 0.0.2 database without losing projects', async () => {
    const name = `addons-studio-upgrade-${crypto.randomUUID()}`
    const legacy = new Dexie(name)
    legacy.version(1).stores({
      projects:
        '&id, name, namespace, projectType, targetVersion, createdAt, updatedAt, schemaVersion',
      snapshots: '&id, projectId, createdAt, [projectId+createdAt]',
      settings: '&key, updatedAt',
    })
    await legacy.table('projects').add({
      id: 'legacy-project',
      name: 'Legacy Project',
      namespace: 'legacy_project',
      icon: { kind: 'builtin', value: 'cube' },
      projectType: 'addon',
      targetVersion: '1.26.0',
      experimentalFeatures: false,
      createdAt: 1,
      updatedAt: 1,
      schemaVersion: 1,
      revision: 1,
    })
    legacy.close()

    const upgraded = new AddonsStudioDatabase(name)
    await upgraded.open()
    expect((await upgraded.projects.get('legacy-project'))?.name).toBe('Legacy Project')
    expect(upgraded.tables.map((table) => table.name)).toContain('models')
    expect(upgraded.tables.map((table) => table.name)).toContain('projectFolders')
    upgraded.close()
    await upgraded.delete()
  })

  it('migrates legacy reference blobs into the shared editor asset store', async () => {
    const name = `addons-studio-assets-upgrade-${crypto.randomUUID()}`
    const legacy = new Dexie(name)
    legacy.version(2).stores({
      projects: '&id, name, namespace, folderId, updatedAt',
      snapshots: '&id, projectId, createdAt, [projectId+createdAt]',
      settings: '&key, updatedAt',
      projectFolders: '&id, name, createdAt, updatedAt',
      models: '&id, projectId, identifier, updatedAt, [projectId+updatedAt], [projectId+identifier]',
      modelReferenceAssets: '&id, modelId, projectId, createdAt, [modelId+createdAt]',
    })
    await legacy.table('modelReferenceAssets').add({
      id: 'legacy-reference-asset',
      modelId: 'legacy-model',
      projectId: 'legacy-project',
      name: 'front.png',
      mimeType: 'image/png',
      blob: new Blob(['persisted-image'], { type: 'image/png' }),
      createdAt: 10,
    })
    legacy.close()

    const upgraded = new AddonsStudioDatabase(name)
    await upgraded.open()
    const migrated = await upgraded.modelEditorAssets.get('legacy-reference-asset')
    expect(migrated).toMatchObject({
      kind: 'reference',
      width: 0,
      height: 0,
      modelId: 'legacy-model',
    })
    expect(migrated?.blob).toBeDefined()
    expect(migrated?.blob).toMatchObject({ type: 'image/png' })
    upgraded.close()
    await upgraded.delete()
  })
})
