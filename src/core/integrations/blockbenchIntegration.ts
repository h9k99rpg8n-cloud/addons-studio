import { AppError } from '@/core/errors/AppError'
import { STUDIO_MODEL_JSON_FORMAT } from '@/core/model/portability/modelJsonTypes'
import type { ModelFileFormat, ModelResourcePayload } from '@/types/resource'

export const BLOCKBENCH_WEB_URL = 'https://web.blockbench.net/'
export const MAX_MODEL_FILE_BYTES = 32 * 1024 * 1024
const MAX_INLINE_URL_CHARACTERS = 60_000

interface ModelFileInspection {
  format: ModelFileFormat
  name: string
  identifier?: string
  text: string
  cubeCount?: number
  boneCount?: number
  textureReferences: string[]
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function inspectBedrockGeometry(root: Record<string, unknown>, filename: string): ModelFileInspection | undefined {
  const geometryValue = root['minecraft:geometry']
  const geometries = Array.isArray(geometryValue)
    ? geometryValue
    : objectValue(geometryValue) ? [geometryValue] : []
  if (!geometries.length) return undefined
  let cubes = 0
  let bones = 0
  let identifier = ''
  for (const geometry of geometries) {
    const record = objectValue(geometry)
    if (!record) continue
    const description = objectValue(record.description)
    if (!identifier && typeof description?.identifier === 'string') identifier = description.identifier
    const entries = Array.isArray(record.bones) ? record.bones : []
    bones += entries.length
    for (const bone of entries) {
      const cubeEntries = objectValue(bone)?.cubes
      if (Array.isArray(cubeEntries)) cubes += cubeEntries.length
    }
  }
  return {
    format: 'bedrock_geometry',
    name: identifier.split('.').at(-1)?.replaceAll('_', ' ') || filename.replace(/\.(geo\.)?json$/i, ''),
    identifier: identifier || undefined,
    text: JSON.stringify(root, null, 2),
    cubeCount: cubes,
    boneCount: bones,
    textureReferences: [],
  }
}

function inspectBbmodel(root: Record<string, unknown>, filename: string): ModelFileInspection | undefined {
  const meta = objectValue(root.meta)
  const hasBbmodelShape = Boolean(meta?.format_version || meta?.model_format)
    && (Array.isArray(root.elements) || Array.isArray(root.outliner) || Array.isArray(root.groups))
  if (!hasBbmodelShape && !filename.toLowerCase().endsWith('.bbmodel')) return undefined
  const textures = Array.isArray(root.textures)
    ? root.textures.flatMap((entry) => {
      const record = objectValue(entry)
      return typeof record?.name === 'string' ? [record.name] : []
    })
    : []
  return {
    format: 'bbmodel',
    name: filename.replace(/\.bbmodel$/i, ''),
    text: JSON.stringify(root, null, 2),
    cubeCount: Array.isArray(root.elements) ? root.elements.length : undefined,
    boneCount: Array.isArray(root.groups) ? root.groups.length : undefined,
    textureReferences: textures,
  }
}

function inspectLegacyStudio(root: Record<string, unknown>, filename: string): ModelFileInspection | undefined {
  if (root.format !== STUDIO_MODEL_JSON_FORMAT) return undefined
  const model = objectValue(root.model)
  if (!model || !Array.isArray(model.cubes)) return undefined
  const identifier = typeof model.identifier === 'string' ? model.identifier : undefined
  const name = typeof model.name === 'string' ? model.name : filename.replace(/\.model\.json$/i, '')
  const cubes = model.cubes.flatMap((entry) => {
    const cube = objectValue(entry)
    const position = objectValue(cube?.position)
    const size = objectValue(cube?.size)
    const rotation = objectValue(cube?.rotation)
    if (!position || !size) return []
    const sx = Number(size.x)
    const sy = Number(size.y)
    const sz = Number(size.z)
    const px = Number(position.x)
    const py = Number(position.y)
    const pz = Number(position.z)
    if (![sx, sy, sz, px, py, pz].every(Number.isFinite)) return []
    return [{
      name: typeof cube?.name === 'string' ? cube.name : 'Cube',
      origin: [px - sx / 2, py - sy / 2, pz - sz / 2],
      size: [sx, sy, sz],
      pivot: objectValue(cube?.pivot)
        ? [Number(objectValue(cube?.pivot)?.x) || 0, Number(objectValue(cube?.pivot)?.y) || 0, Number(objectValue(cube?.pivot)?.z) || 0]
        : [px, py, pz],
      rotation: [Number(rotation?.x) || 0, Number(rotation?.y) || 0, Number(rotation?.z) || 0],
      uv: [0, 0],
    }]
  })
  const bedrock = {
    format_version: '1.12.0',
    'minecraft:geometry': [{
      description: {
        identifier: identifier || 'geometry.addons_studio.imported_model',
        texture_width: 64,
        texture_height: 64,
        visible_bounds_width: 4,
        visible_bounds_height: 4,
        visible_bounds_offset: [0, 1, 0],
      },
      bones: [{ name: 'root', pivot: [0, 0, 0], cubes }],
    }],
  }
  return {
    format: 'studio_legacy',
    name,
    identifier,
    text: JSON.stringify(bedrock, null, 2),
    cubeCount: cubes.length,
    boneCount: 1,
    textureReferences: [],
  }
}

export async function inspectModelFile(file: File): Promise<ModelFileInspection> {
  if (file.size > MAX_MODEL_FILE_BYTES) {
    throw new AppError('RESOURCE_INVALID', 'This model file is too large to import safely on a mobile device.')
  }
  if (!/\.(json|geo\.json|bbmodel)$/i.test(file.name)) {
    throw new AppError('RESOURCE_INVALID', 'Choose a .json, .geo.json, or .bbmodel model file.')
  }
  let root: Record<string, unknown>
  try {
    const parsed = JSON.parse(await file.text()) as unknown
    const record = objectValue(parsed)
    if (!record) throw new Error('Root value is not an object')
    root = record
  } catch (error) {
    throw new AppError('RESOURCE_INVALID', 'This model file does not contain readable JSON.', { cause: error })
  }
  const inspection = inspectBedrockGeometry(root, file.name)
    ?? inspectBbmodel(root, file.name)
    ?? inspectLegacyStudio(root, file.name)
  if (!inspection) {
    throw new AppError('RESOURCE_INVALID', 'This JSON file is not a recognized Blockbench or Bedrock model format.')
  }
  return inspection
}

export function createStarterBedrockModel(input: { name: string; identifier: string }): ModelFileInspection {
  const root = {
    format_version: '1.12.0',
    'minecraft:geometry': [{
      description: {
        identifier: input.identifier,
        texture_width: 16,
        texture_height: 16,
        visible_bounds_width: 2,
        visible_bounds_height: 2.5,
        visible_bounds_offset: [0, 0.75, 0],
      },
      bones: [{
        name: 'root',
        pivot: [0, 0, 0],
        cubes: [{ name: 'Cube', origin: [-8, 0, -8], size: [16, 16, 16], uv: [0, 0] }],
      }],
    }],
  }
  return {
    format: 'bedrock_geometry',
    name: input.name.trim(),
    identifier: input.identifier,
    text: JSON.stringify(root, null, 2),
    cubeCount: 1,
    boneCount: 1,
    textureReferences: [],
  }
}

export function buildBlockbenchUrl(filename: string, jsonText: string): string | undefined {
  const params = new URLSearchParams({ loadtype: 'json', loadname: filename, loaddata: jsonText })
  const url = `${BLOCKBENCH_WEB_URL}?${params.toString()}`
  return url.length <= MAX_INLINE_URL_CHARACTERS ? url : undefined
}

export function modelPayload(inspection: ModelFileInspection, assetId: string, originalFilename: string): ModelResourcePayload {
  return {
    format: inspection.format,
    assetId,
    originalFilename,
    cubeCount: inspection.cubeCount,
    boneCount: inspection.boneCount,
    textureReferences: inspection.textureReferences,
  }
}

export function safeModelFilename(name: string, format: ModelFileFormat): string {
  const base = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'model'
  return format === 'bbmodel' ? `${base}.bbmodel` : `${base}.geo.json`
}

