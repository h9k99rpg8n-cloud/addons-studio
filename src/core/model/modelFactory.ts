import type { StudioCube, StudioModel } from '@/types/model'
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

export function cloneStudioModel(model: StudioModel): StudioModel {
  return structuredClone(model)
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
