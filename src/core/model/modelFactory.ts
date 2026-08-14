import type {
  StudioCameraView,
  StudioCube,
  StudioEditorState,
  StudioGroup,
  StudioModelFolder,
  StudioMetadataValue,
  StudioModel,
  StudioReferenceImage,
  StudioVector2,
  StudioVector3,
} from '@/types/model'
import { createId } from '@/utils/createId'

export const MODEL_SCHEMA_VERSION = 5

export const DEFAULT_VIEWPORT_VIEWS: readonly StudioCameraView[] = ['perspective', 'front']

export function createDefaultEditorState(): StudioEditorState {
  return {
    snapping: {
      transform: 1,
      customTransform: 0.125,
      resize: 1,
      customResize: 0.125,
      rotation: 15,
      customRotation: 1,
    },
    modeling: {
      resizeDirection: 'symmetric',
      controlMode: 'hybrid',
      transformSpace: 'global',
      language: 'en',
    },
    camera: {
      orbitSensitivity: 1,
      panSensitivity: 1,
      zoomSensitivity: 1,
      profile: 'standard',
    },
    experimental: {
      touchRotate: false,
    },
    background: {
      type: 'dark-studio',
      fit: 'fill',
      opacity: 1,
      brightness: 1,
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

function cloneVector2(vector: Partial<StudioVector2> | undefined, fallback: StudioVector2): StudioVector2 {
  return {
    x: finite(vector?.x, fallback.x),
    y: finite(vector?.y, fallback.y),
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
    locked: false,
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
    locked: false,
    pivot: { ...center },
    defaultPivot: { ...center },
  }
}

export function createStudioModelFolder(index = 0, parentId?: string): StudioModelFolder {
  return {
    id: createId(),
    type: 'folder',
    name: index === 0 ? 'Folder' : `Folder ${index + 1}`,
    parentId,
    collapsed: false,
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
    locked: cube.locked === true,
    pivot,
    defaultPivot: cloneVector(cube.defaultPivot, pivot),
    parentId: cube.parentId,
    folderId: cube.folderId,
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
    locked: group.locked === true,
    pivot,
    defaultPivot: cloneVector(group.defaultPivot, pivot),
    parentId: group.parentId,
    folderId: group.folderId,
    metadata: cloneStudioMetadata(group.metadata),
  }
}

export function cloneStudioModelFolder(folder: StudioModelFolder): StudioModelFolder {
  return {
    id: folder.id,
    type: 'folder',
    name: folder.name || 'Folder',
    parentId: folder.parentId,
    collapsed: folder.collapsed === true,
    metadata: cloneStudioMetadata(folder.metadata),
  }
}

export function cloneStudioReference(reference: StudioReferenceImage): StudioReferenceImage {
  const legacy = reference as unknown as StudioReferenceImage & {
    position?: Partial<StudioVector3>
    size?: Partial<StudioVector2>
    scale?: number
    rotation?: number
    flipHorizontal?: boolean
    flipVertical?: boolean
  }
  const storedView = reference.view as string
  const view = storedView === 'side' ? 'right' : storedView
  const legacyScale = legacy.size
    ? Math.max(finite(legacy.size.x, 24), finite(legacy.size.y, 24)) / 24
    : 1
  return {
    id: reference.id,
    assetId: reference.assetId,
    name: reference.name,
    view: (
      ['front', 'back', 'left', 'right', 'top', 'bottom'].includes(view) ? view : 'front'
    ) as StudioReferenceImage['view'],
    position: cloneVector2(legacy.position, { x: 0, y: 0 }),
    scale: Math.min(20, Math.max(0.05, finite(legacy.scale, legacyScale))),
    rotation: finite(legacy.rotation, 0),
    opacity: Math.min(1, Math.max(0.05, finite(reference.opacity, 0.55))),
    visible: reference.visible !== false,
    flipHorizontal: legacy.flipHorizontal === true,
    flipVertical: legacy.flipVertical === true,
  }
}

export function cloneEditorState(editor: StudioEditorState | undefined): StudioEditorState {
  const defaults = createDefaultEditorState()
  const transform = editor?.snapping?.transform
  const rotation = editor?.snapping?.rotation
  const resize = editor?.snapping?.resize
  const views = editor?.viewportViews?.filter((view) => DEFAULT_CAMERA_VIEWS.includes(view)) ?? []
  const resizeDirection = editor?.modeling?.resizeDirection
  const controlMode = editor?.modeling?.controlMode as string | undefined
  const transformSpace = editor?.modeling?.transformSpace
  const language = editor?.modeling?.language
  const backgroundType = editor?.background?.type
  const backgroundFit = editor?.background?.fit
  const cameraProfile = editor?.camera?.profile
  return {
    snapping: {
      transform: transform === null
        ? null
        : typeof transform === 'number' && Number.isFinite(transform) && transform > 0
          ? transform
          : defaults.snapping.transform,
      customTransform: Math.max(0.001, finite(editor?.snapping?.customTransform, defaults.snapping.customTransform)),
      resize: resize === null
        ? null
        : typeof resize === 'number' && Number.isFinite(resize) && resize > 0
          ? resize
          : transform === null
            ? null
            : typeof transform === 'number' && Number.isFinite(transform) && transform > 0
              ? transform
              : defaults.snapping.resize ?? 1,
      customResize: Math.max(0.001, finite(editor?.snapping?.customResize, finite(editor?.snapping?.customTransform, defaults.snapping.customResize ?? 0.125))),
      rotation: rotation === null
        ? null
        : typeof rotation === 'number' && Number.isFinite(rotation) && rotation > 0
          ? rotation
          : defaults.snapping.rotation,
      customRotation: Math.max(0.001, finite(editor?.snapping?.customRotation, defaults.snapping.customRotation ?? 1)),
    },
    modeling: {
      resizeDirection: ['symmetric', 'positive', 'negative'].includes(resizeDirection ?? '')
        ? resizeDirection!
        : defaults.modeling.resizeDirection,
      controlMode: controlMode === 'tactilismos'
        ? 'touch-gizmo'
        : ['gizmos', 'touch-gizmo', 'hybrid'].includes(controlMode ?? '')
          ? controlMode as 'gizmos' | 'touch-gizmo' | 'hybrid'
        : defaults.modeling.controlMode,
      transformSpace: ['global', 'local', 'parent'].includes(transformSpace ?? '')
        ? transformSpace!
        : defaults.modeling.transformSpace,
      language: language === 'es' ? 'es' : defaults.modeling.language,
    },
    camera: {
      orbitSensitivity: Math.min(3, Math.max(0.25, finite(editor?.camera?.orbitSensitivity, defaults.camera.orbitSensitivity))),
      panSensitivity: Math.min(3, Math.max(0.25, finite(editor?.camera?.panSensitivity, defaults.camera.panSensitivity))),
      zoomSensitivity: Math.min(3, Math.max(0.25, finite(editor?.camera?.zoomSensitivity, defaults.camera.zoomSensitivity))),
      profile: ['standard', 'one-finger', 'two-finger'].includes(cameraProfile ?? '')
        ? cameraProfile!
        : defaults.camera.profile,
    },
    experimental: {
      touchRotate: editor?.experimental?.touchRotate === true,
    },
    background: {
      type: ['dark-studio', 'sky', 'night', 'sunset', 'snow', 'custom'].includes(backgroundType ?? '')
        ? backgroundType!
        : defaults.background.type,
      customAssetId: editor?.background?.customAssetId,
      fit: ['fit', 'fill', 'stretch'].includes(backgroundFit ?? '')
        ? backgroundFit!
        : defaults.background.fit,
      opacity: Math.min(1, Math.max(0.1, finite(editor?.background?.opacity, defaults.background.opacity))),
      brightness: Math.min(1.5, Math.max(0.25, finite(editor?.background?.brightness, defaults.background.brightness))),
    },
    viewportLayout: editor?.viewportLayout === 2 ? 2 : 1,
    viewportViews: views.length ? [...views.slice(0, 2)] : [...defaults.viewportViews],
  }
}

/** Resets only Model Studio preferences while retaining the user's stored custom image asset. */
export function resetEditorPreferences(
  editor: StudioEditorState,
  language: StudioEditorState['modeling']['language'],
): StudioEditorState {
  const defaults = createDefaultEditorState()
  defaults.modeling.language = language
  defaults.background.customAssetId = editor.background.customAssetId
  return defaults
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
    folders: (model.folders ?? []).map(cloneStudioModelFolder),
    metadata: cloneStudioMetadata(model.metadata),
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
    folders: [],
    metadata: undefined,
    references: [],
    editor: createDefaultEditorState(),
    createdAt: now,
    updatedAt: now,
    schemaVersion: MODEL_SCHEMA_VERSION,
    revision: 1,
  }
}
