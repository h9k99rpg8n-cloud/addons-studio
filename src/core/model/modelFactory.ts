import type { StudioCube, StudioModel, StudioReferenceImage } from '@/types/model'
import { createId } from '@/utils/createId'

export const MODEL_SCHEMA_VERSION = 1

export function createStudioCube(index = 0): StudioCube {
  return {
    id: createId(),
    type: 'cube',
    name: index === 0 ? 'Cube' : `Cube ${index + 1}`,
    position: { x: 0, y: 0, z: 0 },
    size: { x: 16, y: 16, z: 16 },
    rotation: { x: 0, y: 0, z: 0 },
    visible: true,
  }
}

export function cloneStudioCube(cube: StudioCube): StudioCube {
  return {
    id: cube.id,
    type: 'cube',
    name: cube.name,
    position: { ...cube.position },
    size: { ...cube.size },
    rotation: { ...cube.rotation },
    visible: cube.visible,
    parentId: cube.parentId,
  }
}

export function cloneStudioReference(reference: StudioReferenceImage): StudioReferenceImage {
  return {
    id: reference.id,
    assetId: reference.assetId,
    name: reference.name,
    view: reference.view,
    position: { ...reference.position },
    size: { ...reference.size },
    opacity: reference.opacity,
    visible: reference.visible,
  }
}

export function cloneStudioModel(model: StudioModel): StudioModel {
  return {
    id: model.id,
    projectId: model.projectId,
    name: model.name,
    identifier: model.identifier,
    elements: model.elements.map(cloneStudioCube),
    references: model.references.map(cloneStudioReference),
    createdAt: model.createdAt,
    updatedAt: model.updatedAt,
    schemaVersion: model.schemaVersion,
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
    references: [],
    createdAt: now,
    updatedAt: now,
    schemaVersion: MODEL_SCHEMA_VERSION,
    revision: 1,
  }
}
