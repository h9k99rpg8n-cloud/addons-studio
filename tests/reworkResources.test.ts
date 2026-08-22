import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { generateBlockPackage } from '@/core/bedrock/blockGenerator'
import {
  buildBlockbenchUrl,
  createStarterBedrockModel,
  inspectModelFile,
} from '@/core/integrations/blockbenchIntegration'
import { DEFAULT_BEDROCK_VERSION } from '@/core/project/bedrockVersions'
import { ProjectRepository } from '@/core/project/projectRepository'
import { ResourceRepository } from '@/core/resources/resourceRepository'
import { AddonsStudioDatabase } from '@/core/storage/database'
import type { BlockResourcePayload, StudioResource } from '@/types/resource'

describe('Rework resource foundation', () => {
  let database: AddonsStudioDatabase
  let projects: ProjectRepository
  let resources: ResourceRepository

  beforeEach(() => {
    database = new AddonsStudioDatabase(`addons-studio-rework-${crypto.randomUUID()}`)
    projects = new ProjectRepository(database)
    resources = new ResourceRepository(database)
  })

  afterEach(async () => {
    database.close()
    await database.delete()
  })

  it('persists, moves, and deletes generic project resources without deleting the project', async () => {
    const project = await projects.createProject({
      name: 'Yellow Workshop',
      namespace: 'yellow_workshop',
      projectType: 'addon',
      targetVersion: DEFAULT_BEDROCK_VERSION,
      experimentalFeatures: false,
    })
    const folder = await resources.createFolder({
      projectId: project.id,
      resourceType: 'model',
      name: 'Architecture',
    })
    const model = await resources.create({
      projectId: project.id,
      type: 'model',
      name: 'Window',
      identifier: 'geometry.yellow_workshop.window',
      payload: { format: 'bedrock_geometry', assetId: 'asset', originalFilename: 'window.geo.json' },
    })
    const moved = await resources.update(model.id, { folderId: folder.id, name: 'Tall Window' })

    expect(moved).toMatchObject({ folderId: folder.id, name: 'Tall Window', revision: 2 })
    expect(await resources.list(project.id, 'model')).toHaveLength(1)

    await resources.deleteFolder(folder.id)
    expect((await resources.get(model.id))?.folderId).toBeUndefined()
    await resources.delete(model.id)
    expect(await resources.get(model.id)).toBeUndefined()
    expect(await projects.getProject(project.id)).toBeDefined()
  })
})

describe('Blockbench handoff', () => {
  it('detects Bedrock geometry and creates a bounded official web-app URL', async () => {
    const starter = createStarterBedrockModel({
      name: 'Desk',
      identifier: 'geometry.rework.desk',
    })
    const file = new File([starter.text], 'desk.geo.json', { type: 'application/json' })
    const inspected = await inspectModelFile(file)

    expect(inspected).toMatchObject({
      format: 'bedrock_geometry',
      identifier: 'geometry.rework.desk',
      cubeCount: 1,
      boneCount: 1,
    })
    expect(buildBlockbenchUrl(file.name, starter.text)).toMatch(/^https:\/\/web\.blockbench\.net\/\?/)
  })

  it('rejects unrelated JSON instead of pretending every JSON file is a model', async () => {
    await expect(inspectModelFile(new File(['{"scripts":{}}'], 'package.json', {
      type: 'application/json',
    }))).rejects.toThrow('not a recognized')
  })
})

describe('guided Bedrock block output', () => {
  it('emits namespaced block and localization files from contextual settings', async () => {
    const now = Date.now()
    const payload: BlockResourcePayload = {
      displayName: 'Yellow Lamp',
      nameColor: '#ffff55',
      translations: [
        { locale: 'en', name: 'Yellow Lamp' },
        { locale: 'es', name: 'Lámpara amarilla' },
      ],
      textures: { mode: 'all' },
      light: { enabled: true, level: 12, vibrantColorEnabled: false, color: '#ffd54a' },
      transparency: 'opaque',
      blocksLight: true,
      destroyTime: 1,
      explosionResistance: 4,
      recommendedTool: 'pickaxe',
      requiredToolLevel: 'stone',
      dropIdentifier: 'yellow_workshop:yellow_lamp',
      silkTouch: false,
      fortune: false,
      sound: 'stone',
      collision: 'full',
      selectionBox: 'full',
      flammable: false,
      friction: 0.6,
      movementSpeed: 1,
      mapColor: '#f5c518',
      orientation: 'none',
      creativeCategory: 'construction',
      maxStackSize: 64,
      recipe: { enabled: false },
      pluginIds: [],
    }
    const block: StudioResource<BlockResourcePayload> = {
      id: 'block',
      projectId: 'project',
      type: 'block',
      name: 'Yellow Lamp',
      identifier: 'yellow_workshop:yellow_lamp',
      payload,
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
      revision: 1,
    }
    const generated = await generateBlockPackage({
      project: {
        id: 'project',
        name: 'Yellow Workshop',
        namespace: 'yellow_workshop',
        icon: { kind: 'builtin', value: 'project' },
        projectType: 'addon',
        targetVersion: DEFAULT_BEDROCK_VERSION,
        experimentalFeatures: false,
        createdAt: now,
        updatedAt: now,
        schemaVersion: 1,
        revision: 1,
      },
      block,
      materials: [],
      textureAssets: [],
    })

    expect(generated.files).toEqual(expect.arrayContaining([
      'behavior_pack/blocks/yellow_lamp.json',
      'behavior_pack/loot_tables/blocks/yellow_lamp.json',
      'resource_pack/texts/en_US.lang',
      'resource_pack/texts/es_ES.lang',
    ]))
    expect(generated.warnings).toContain('No texture material is assigned yet.')
    expect(generated.blob.size).toBeGreaterThan(100)
  })
})
