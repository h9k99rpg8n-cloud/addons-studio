import { describe, expect, it } from 'vitest'

import {
  createEmptyStudioModel,
  createStudioCube,
  createStudioGroup,
} from '@/core/model/modelFactory'
import { createModelFolder } from '@/core/model/modelFolders'
import {
  createStudioModelJson,
  serializeStudioModelJson,
} from '@/core/model/portability/modelJsonExporter'
import {
  importModelJson,
  importModelJsonDraft,
} from '@/core/model/portability/modelJsonImporter'
import { STUDIO_MODEL_JSON_VERSION } from '@/core/model/portability/modelJsonTypes'

function portableModel() {
  const model = createEmptyStudioModel('project', 'Wing Assembly', 'geometry.project.wing_assembly')
  const folder = createModelFolder(model, 'Wing Pieces')
  const cube = createStudioCube()
  cube.position = { x: 2, y: 3, z: 4 }
  cube.size = { x: 8, y: 2, z: 1 }
  cube.pivot = { x: 1, y: 2, z: 3 }
  cube.metadata = { futureTexture: 'wing' }
  const group = createStudioGroup(0, [cube])
  group.folderId = folder.id
  cube.parentId = group.id
  model.elements.push(cube)
  model.groups.push(group)
  model.folders.push(folder)
  model.metadata = { authoring: { source: 'Addons Studio' } }
  return model
}

describe('Model JSON portability', () => {
  it('exports and reconstructs canonical Studio JSON with hierarchy, folders, and pivots', () => {
    const source = portableModel()
    const document = createStudioModelJson(source)
    expect(document.formatVersion).toBe(STUDIO_MODEL_JSON_VERSION)
    expect(document.model.cubes[0]?.pivot).toEqual({ x: 1, y: 2, z: 3 })
    expect(document.model.folders).toHaveLength(1)

    const imported = importModelJson(serializeStudioModelJson(source), 'new-project')
    expect(imported.draft.format).toBe('studio')
    expect(imported.model.projectId).toBe('new-project')
    expect(imported.model.groups[0]?.folderId).toBe(imported.model.folders[0]?.id)
    expect(imported.model.elements[0]?.parentId).toBe(imported.model.groups[0]?.id)
    expect(imported.model.elements[0]?.metadata).toEqual({ futureTexture: 'wing' })
  })

  it('imports compatible Bedrock geometry while preserving texture metadata as future data', () => {
    const draft = importModelJsonDraft(JSON.stringify({
      format_version: '1.12.0',
      'minecraft:geometry': [{
        description: {
          identifier: 'geometry.demo.butterfly',
          texture_width: 64,
          texture_height: 64,
        },
        bones: [{
          name: 'body',
          pivot: [0, 8, 0],
          cubes: [{ origin: [-1, 0, -1], size: [2, 8, 2], uv: [0, 0] }],
        }],
      }],
    }))
    expect(draft.format).toBe('bedrock-geometry')
    expect(draft.identifier).toBe('geometry.demo.butterfly')
    expect(draft.groups).toHaveLength(1)
    expect(draft.elements[0]?.metadata).toMatchObject({ bedrockUv: [0, 0] })
    expect(draft.warnings.join(' ')).toContain('Texture editing is not available')
  })

  it('rejects malformed, unrelated, duplicate-ID, and invalid-hierarchy JSON', () => {
    expect(() => importModelJsonDraft('{broken')).toThrow('valid JSON')
    expect(() => importModelJsonDraft(JSON.stringify({ name: 'package.json' }))).toThrow('not a recognized model format')

    const document = createStudioModelJson(portableModel())
    document.model.groups[0]!.id = document.model.cubes[0]!.id
    expect(() => importModelJsonDraft(JSON.stringify(document))).toThrow('duplicate IDs')

    const crossKindDuplicate = createStudioModelJson(portableModel())
    crossKindDuplicate.model.folders[0]!.id = crossKindDuplicate.model.cubes[0]!.id
    expect(() => importModelJsonDraft(JSON.stringify(crossKindDuplicate))).toThrow('duplicate IDs')

    const hierarchy = createStudioModelJson(portableModel())
    hierarchy.model.cubes[0]!.parentId = 'missing'
    expect(() => importModelJsonDraft(JSON.stringify(hierarchy))).toThrow('missing group')
  })

  it('refuses non-finite and invalid dimensions before creating JSON', () => {
    const source = portableModel()
    source.elements[0]!.size.x = 0
    expect(() => createStudioModelJson(source)).toThrow('invalid X size')
    source.elements[0]!.size.x = 8
    source.metadata = { broken: Number.POSITIVE_INFINITY }
    expect(() => createStudioModelJson(source)).toThrow('invalid number')
  })
})
