import { afterEach, describe, expect, it } from 'vitest'

import { DATABASE_SCHEMA_VERSION } from '@/core/project/constants'
import { AddonsStudioDatabase } from '@/core/storage/database'

describe('database schema', () => {
  const database = new AddonsStudioDatabase(`addons-studio-schema-${crypto.randomUUID()}`)

  afterEach(async () => {
    database.close()
    await database.delete()
  })

  it('exposes the versioned projects, snapshots, and settings stores', () => {
    expect(DATABASE_SCHEMA_VERSION).toBe(1)
    expect(database.tables.map((table) => table.name).sort()).toEqual([
      'projects',
      'settings',
      'snapshots',
    ])
    expect(database.projects.schema.primKey.name).toBe('id')
    expect(database.snapshots.schema.indexes.map((index) => index.name)).toContain(
      '[projectId+createdAt]',
    )
  })
})
