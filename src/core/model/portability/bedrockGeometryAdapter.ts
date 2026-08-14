import type { StudioCube, StudioGroup, StudioMetadataValue, StudioVector3 } from '@/types/model'
import { createId } from '@/utils/createId'

import { normalizeModelSegment } from '../modelValidation'
import { ModelJsonError } from './modelJsonError'
import type { ImportedModelDraft, ModelJsonAdapter } from './modelJsonTypes'

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function vector(value: unknown, fallback: StudioVector3): StudioVector3 {
  if (!Array.isArray(value) || value.length < 3 || !value.slice(0, 3).every(Number.isFinite)) {
    return { ...fallback }
  }
  return { x: Number(value[0]), y: Number(value[1]), z: Number(value[2]) }
}

function metadataValue(value: unknown): StudioMetadataValue | undefined {
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
    return value as StudioMetadataValue
  }
  if (Array.isArray(value)) {
    const entries = value.map(metadataValue)
    return entries.every((entry) => entry !== undefined) ? entries as StudioMetadataValue[] : undefined
  }
  if (record(value)) {
    const entries = Object.entries(value)
      .map(([key, entry]) => [key, metadataValue(entry)] as const)
      .filter((entry): entry is readonly [string, StudioMetadataValue] => entry[1] !== undefined)
    return Object.fromEntries(entries)
  }
  return undefined
}

function geometryEntries(value: unknown): Record<string, unknown>[] {
  if (!record(value) || !Array.isArray(value['minecraft:geometry'])) return []
  return value['minecraft:geometry'].filter(record)
}

export const bedrockGeometryAdapter: ModelJsonAdapter = {
  format: 'bedrock-geometry',
  canRead(value): boolean {
    return geometryEntries(value).length > 0
  },
  read(value): ImportedModelDraft {
    const geometry = geometryEntries(value)[0]
    if (!geometry) throw new ModelJsonError('unrecognized-format', 'This is not compatible Bedrock geometry JSON.')
    const description = record(geometry.description) ? geometry.description : {}
    const storedIdentifier = typeof description.identifier === 'string'
      ? description.identifier.trim()
      : 'geometry.imported.model'
    const identifier = /^geometry\.[a-z0-9_]+(?:\.[a-z0-9_]+)+$/.test(storedIdentifier)
      ? storedIdentifier
      : `geometry.imported.${normalizeModelSegment(storedIdentifier.replace(/^geometry\./, ''))}`
    const name = identifier.split('.').at(-1)?.replace(/_/g, ' ') || 'Imported Model'
    const warnings: string[] = []
    const elements: StudioCube[] = []
    const groups: StudioGroup[] = []
    const bones = Array.isArray(geometry.bones) ? geometry.bones.filter(record) : []

    bones.forEach((bone, boneIndex) => {
      const groupId = createId()
      const groupName = typeof bone.name === 'string' && bone.name.trim()
        ? bone.name.trim()
        : `Bone ${boneIndex + 1}`
      const pivot = vector(bone.pivot, { x: 0, y: 0, z: 0 })
      const rotation = vector(bone.rotation, { x: 0, y: 0, z: 0 })
      groups.push({
        id: groupId,
        type: 'group',
        name: groupName,
        position: { ...pivot },
        rotation,
        scale: { x: 1, y: 1, z: 1 },
        visible: true,
        locked: false,
        pivot: { ...pivot },
        defaultPivot: { ...pivot },
        metadata: {
          importedAs: 'bedrock-bone',
          ...(typeof bone.parent === 'string' ? { bedrockParent: bone.parent } : {}),
        },
      })
      if (typeof bone.parent === 'string') {
        warnings.push('Nested Bedrock bones were preserved as metadata and flattened into Model Core groups.')
      }
      const cubes = Array.isArray(bone.cubes) ? bone.cubes.filter(record) : []
      cubes.forEach((storedCube, cubeIndex) => {
        const position = vector(storedCube.origin, { x: 0, y: 0, z: 0 })
        const size = vector(storedCube.size, { x: 1, y: 1, z: 1 })
        if (![size.x, size.y, size.z].every((entry) => Number.isFinite(entry) && entry > 0)) {
          throw new ModelJsonError('invalid-model', `Bedrock cube ${cubeIndex + 1} in “${groupName}” has an invalid size.`)
        }
        const center = {
          x: position.x + size.x / 2,
          y: position.y + size.y / 2,
          z: position.z + size.z / 2,
        }
        const cubePivot = vector(storedCube.pivot, center)
        const rawUv = metadataValue(storedCube.uv)
        elements.push({
          id: createId(),
          type: 'cube',
          name: typeof storedCube.name === 'string' && storedCube.name.trim()
            ? storedCube.name.trim()
            : `${groupName} Cube ${cubeIndex + 1}`,
          position,
          size,
          rotation: vector(storedCube.rotation, { x: 0, y: 0, z: 0 }),
          visible: storedCube.visibility !== false,
          locked: false,
          pivot: { ...cubePivot },
          defaultPivot: { ...cubePivot },
          parentId: groupId,
          metadata: rawUv === undefined ? { importedAs: 'bedrock-cube' } : {
            importedAs: 'bedrock-cube',
            bedrockUv: rawUv,
          },
        })
      })
    })
    if (!elements.length && !groups.length) {
      throw new ModelJsonError('invalid-model', 'The Bedrock geometry file does not contain any supported bones or cubes.')
    }
    if (description.texture_width || description.texture_height) {
      warnings.push('Geometry imported successfully. Texture editing is not available in this version yet.')
    }
    return {
      format: 'bedrock-geometry',
      name: name.replace(/\b\w/g, (letter) => letter.toUpperCase()),
      identifier,
      elements,
      groups,
      folders: [],
      metadata: {
        importedFormat: 'minecraft:geometry',
        ...(Number.isFinite(description.texture_width) ? { textureWidth: Number(description.texture_width) } : {}),
        ...(Number.isFinite(description.texture_height) ? { textureHeight: Number(description.texture_height) } : {}),
      },
      warnings: [...new Set(warnings)],
    }
  },
}
