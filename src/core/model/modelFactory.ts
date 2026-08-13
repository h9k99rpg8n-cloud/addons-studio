import type {
  StudioCameraView,
  StudioCube,
  StudioEditorState,
  StudioGroup,
  StudioMetadataValue,
  StudioModel,
  StudioReferenceImage,
  StudioVector3,
} from '@/types/model'
import { createId } from '@/utils/createId'

export const MODEL_SCHEMA_VERSION = 2

export const DEFAULT_VIEWPORT_VIEWS: readonly StudioCameraView[] = ['perspective', 'front']

export function createDefaultEditorState(): StudioEditorState {
  return {
    snapping: {
      transform: 1,
      customTransform: 0.125,
      rotation: 15,
    },
    viewportLayout: 1,
    viewportViews: [...DEFAULT_VIEWPORT_VIEWS],
  }
}

function finite(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? Number(value) : fallback
}

function cloneVector(vector: Partial<StudioVector3> | undefined, fallback: StudioVector3): StudioVector3 {
  return {
    x: finite(vector?.x, fallback.x),
    y: finite(vector?.y, fallback.y),
    z: finite(vector?.z, fallback.z),
  }
}

function cloneMetadataValue(value: StudioMetadataValue): StudioMetadataValue {
  if (Array.isArray(value)) return value.map(cloneMetadataValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, cloneMetadataValue(entry)]),
    )
  }
  return value
}

export function cloneStudioMetadata(
  metadata: Record<string, StudioMetadataValue> | undefined,
): Record<string, StudioMetadataValue> | undefined {
  if (!metadata) return undefined
  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [key, cloneMetadataValue(value)]),
  )
}

export function createStudioCube(index = 0): StudioCube {
  const pivot = { x: 8, y: 8, z: 8 }
  return {
    id: createId(),
    type: 'cube',
    name: index === 0 ? 'Cube' : `Cube ${index + 1}`,
    position: { x: 0, y: 0, z: 0 },
    size: { x: 16, y: 16, z: 16 },
    rotation: { x: 0, y: 0, z: 0 },
    visible: true,
    pivot: { ...pivot },
    defaultPivot: { ...pivot },
  }
}

export function createStudioGroup(index = 0, elements: StudioCube[] = []): StudioGroup {
  const center = groupCenter(elements)
  return {
    id: createId(),
    type: 'group',
    name: index === 0 ? 'Group' : `Group ${index + 1}`,
    position: { ...center },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    visible: true,
    pivot: { ...center },
    defaultPivot: { ...center },
  }
}

function groupCenter(elements: StudioCube[]): StudioVector3 {
  if (!elements.length) return { x: 0, y: 0, z: 0 }
  const minimum = { x: Infinity, y: Infinity, z: Infinity }
  const maximum = { x: -Infinity, y: -Infinity, z: -Infinity }
  for (const element of elements) {
    minimum.x = Math.min(minimum.x, element.position.x)
    minimum.y = Math.min(minimum.y, element.position.y)
    minimum.z = Math.min(minimum.z, element.position.z)
    maximum.x = Math.max(maximum.x, element.position.x + element.size.x)
    maximum.y = Math.max(maximum.y, element.position.y + element.size.y)
    maximum.z = Math.max(maximum.z, element.position.z + element.size.z)
  }
  return {
    x: (minimum.x + maximum.x) / 2,
    y: (minimum.y + maximum.y) / 2,
    z: (minimum.z + maximum.z) / 2,
  }
}

export function cloneStudioCube(cube: StudioCube): StudioCube {
  const position = cloneVector(cube.position, { x: 0, y: 0, z: 0 })
  const size = cloneVector(cube.size, { x: 16, y: 16, z: 16 })
  const center = {
    x: position.x + size.x / 2,
    y: position.y + size.y / 2,
    z: position.z + size.z / 2,
  }
  const pivot = cloneVector(cube.pivot, center)
  return {
    id: cube.id,
    type: 'cube',
    name: cube.name,
    position,
    size,
    rotation: cloneVector(cube.rotation, { x: 0, y: 0, z: 0 }),
    visible: cube.visible !== false,
    pivot,
    defaultPivot: cloneVector(cube.defaultPivot, pivot),
    parentId: cube.parentId,
    metadata: cloneStudioMetadata(cube.metadata),
  }
}

export function cloneStudioGroup(group: StudioGroup): StudioGroup {
  const position = cloneVector(group.position, { x: 0, y: 0, z: 0 })
  const pivot = cloneVector(group.pivot, position)
  return {
    id: group.id,
    type: 'group',
    name: group.name,
    position,
    rotation: cloneVector(group.rotation, { x: 0, y: 0, z: 0 }),
    scale: cloneVector(group.scale, { x: 1, y: 1, z: 1 }),
    visible: group.visible !== false,
    pivot,
    defaultPivot: cloneVector(group.defaultPivot, pivot),
    parentId: group.parentId,
    metadata: cloneStudioMetadata(group.metadata),
  }
}

export function cloneStudioReference(reference: StudioReferenceImage): StudioReferenceImage {
  const storedView = reference.view as string
  const view = storedView === 'side' ? 'right' : storedView
  return {
    id: reference.id,
    assetId: reference.assetId,
    name: reference.name,
    view: (
      ['front', 'back', 'left', 'right', 'top', 'bottom'].includes(view) ? view : 'front'
    ) as StudioReferenceImage['view'],
    position: cloneVector(reference.position, { x: 0, y: 0, z: -8.25 }),
    size: {
      x: finite(reference.size?.x, 24),
      y: finite(reference.size?.y, 24),
    },
    opacity: finite(reference.opacity, 0.55),
    visible: reference.visible !== false,
    locked: reference.locked !== false,
  }
}

function cloneEditorState(editor: StudioEditorState | undefined): StudioEditorState {
  const defaults = createDefaultEditorState()
  const transform = editor?.snapping?.transform
  const rotation = editor?.snapping?.rotation
  const views = editor?.viewportViews?.filter((view) => DEFAULT_CAMERA_VIEWS.includes(view)) ?? []
  return {
    snapping: {
      transform: transform === null
        ? null
        : typeof transform === 'number' && Number.isFinite(transform) && transform > 0
          ? transform
          : defaults.snapping.transform,
      customTransform: Math.max(0.001, finite(editor?.snapping?.customTransform, defaults.snapping.customTransform)),
      rotation: rotation === null
        ? null
        : typeof rotation === 'number' && Number.isFinite(rotation) && rotation > 0
          ? rotation
          : defaults.snapping.rotation,
    },
    viewportLayout: editor?.viewportLayout === 2 ? 2 : 1,
    viewportViews: views.length ? [...views.slice(0, 2)] : [...defaults.viewportViews],
  }
}

const DEFAULT_CAMERA_VIEWS: readonly StudioCameraView[] = [
  'perspective',
  'isometric',
  'front',
  'back',
  'left',
  'right',
  'top',
  'bottom',
]

export function cloneStudioModel(model: StudioModel): StudioModel {
  return {
    id: model.id,
    projectId: model.projectId,
    name: model.name,
    identifier: model.identifier,
    elements: (model.elements ?? []).map(cloneStudioCube),
    groups: (model.groups ?? []).map(cloneStudioGroup),
    references: (model.references ?? []).map(cloneStudioReference),
    editor: cloneEditorState(model.editor),
    createdAt: model.createdAt,
    updatedAt: model.updatedAt,
    schemaVersion: MODEL_SCHEMA_VERSION,
    revision: model.revision,
  }
}

export function createEmptyStudioModel(
  projectId: string,
  name: string,
  identifier: string,
): StudioModel {
  const now = Date.now()
  return {
    id: createId(),
    projectId,
    name: name.trim(),
    identifier: identifier.trim(),
    elements: [],
    groups: [],
    references: [],
    editor: createDefaultEditorState(),
    createdAt: now,
    updatedAt: now,
    schemaVersion: MODEL_SCHEMA_VERSION,
    revision: 1,
  }
}
