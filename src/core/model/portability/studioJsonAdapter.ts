import type { StudioCube, StudioGroup, StudioModelFolder, StudioVector3 } from '@/types/model'

import {
  cloneStudioCube,
  cloneStudioGroup,
  cloneStudioModelFolder,
} from '../modelFactory'
import { ModelJsonError } from './modelJsonError'
import {
  type ImportedModelDraft,
  type ModelJsonAdapter,
  STUDIO_MODEL_JSON_FORMAT,
  STUDIO_MODEL_JSON_VERSION,
  type StudioModelJsonDocument,
} from './modelJsonTypes'

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function finiteVector(value: unknown): value is StudioVector3 {
  return record(value)
    && ['x', 'y', 'z'].every((axis) => Number.isFinite(value[axis]))
}

function assertCube(value: unknown, index: number): asserts value is StudioCube {
  if (!record(value) || value.type !== 'cube' || typeof value.id !== 'string' || typeof value.name !== 'string') {
    throw new ModelJsonError('invalid-model', `Cube ${index + 1} is missing a valid ID, name, or type.`)
  }
  if (!finiteVector(value.position) || !finiteVector(value.size) || !finiteVector(value.rotation)
    || !finiteVector(value.pivot) || !finiteVector(value.defaultPivot)) {
    throw new ModelJsonError('invalid-model', `Cube “${value.name}” contains a non-finite transform value.`)
  }
  if (value.size.x <= 0 || value.size.y <= 0 || value.size.z <= 0) {
    const axis = value.size.x <= 0 ? 'X' : value.size.y <= 0 ? 'Y' : 'Z'
    throw new ModelJsonError('invalid-model', `Cube “${value.name}” contains an invalid ${axis} size.`)
  }
}

function assertGroup(value: unknown, index: number): asserts value is StudioGroup {
  if (!record(value) || value.type !== 'group' || typeof value.id !== 'string' || typeof value.name !== 'string') {
    throw new ModelJsonError('invalid-model', `Group ${index + 1} is missing a valid ID, name, or type.`)
  }
  if (!finiteVector(value.position) || !finiteVector(value.rotation) || !finiteVector(value.scale)
    || !finiteVector(value.pivot) || !finiteVector(value.defaultPivot)) {
    throw new ModelJsonError('invalid-model', `Group “${value.name}” contains a non-finite transform value.`)
  }
}

function assertFolder(value: unknown, index: number): asserts value is StudioModelFolder {
  if (!record(value) || value.type !== 'folder' || typeof value.id !== 'string' || typeof value.name !== 'string') {
    throw new ModelJsonError('invalid-model', `Folder ${index + 1} is missing a valid ID, name, or type.`)
  }
}

export const studioJsonAdapter: ModelJsonAdapter = {
  format: 'studio',
  canRead(value): value is StudioModelJsonDocument {
    return record(value) && value.format === STUDIO_MODEL_JSON_FORMAT
  },
  read(value): ImportedModelDraft {
    if (!this.canRead(value)) throw new ModelJsonError('unrecognized-format', 'This is not an Addons Studio model file.')
    const document = value as StudioModelJsonDocument
    if (document.formatVersion !== STUDIO_MODEL_JSON_VERSION) {
      throw new ModelJsonError(
        'unsupported-version',
        `This Addons Studio model uses unsupported format version ${String(document.formatVersion)}.`,
      )
    }
    if (!record(document.model) || typeof document.model.name !== 'string' || typeof document.model.identifier !== 'string') {
      throw new ModelJsonError('invalid-model', 'The exported model name or identifier is missing.')
    }
    const cubes = Array.isArray(document.model.cubes) ? document.model.cubes : []
    const groups = Array.isArray(document.model.groups) ? document.model.groups : []
    const folders = Array.isArray(document.model.folders) ? document.model.folders : []
    cubes.forEach(assertCube)
    groups.forEach(assertGroup)
    folders.forEach(assertFolder)
    const nodeIds = [...cubes, ...groups].map((node) => node.id)
    const folderIds = folders.map((folder) => folder.id)
    const everyId = [...nodeIds, ...folderIds]
    if (new Set(everyId).size !== everyId.length) {
      throw new ModelJsonError('invalid-model', 'Model cannot be imported because it contains duplicate IDs.')
    }
    const groupSet = new Set(groups.map((group) => group.id))
    const folderSet = new Set(folderIds)
    for (const cube of cubes) {
      if (cube.parentId && !groupSet.has(cube.parentId)) {
        throw new ModelJsonError('invalid-model', `Cube “${cube.name}” references a missing group.`)
      }
      if (cube.folderId && !folderSet.has(cube.folderId)) {
        throw new ModelJsonError('invalid-model', `Cube “${cube.name}” references a missing folder.`)
      }
    }
    for (const group of groups) {
      if (group.parentId) throw new ModelJsonError('invalid-model', 'Nested structural groups are not supported yet.')
      if (group.folderId && !folderSet.has(group.folderId)) {
        throw new ModelJsonError('invalid-model', `Group “${group.name}” references a missing folder.`)
      }
    }
    for (const folder of folders) {
      if (folder.parentId && !folderSet.has(folder.parentId)) {
        throw new ModelJsonError('invalid-model', `Folder “${folder.name}” references a missing parent folder.`)
      }
    }
    return {
      format: 'studio',
      name: document.model.name,
      identifier: document.model.identifier,
      elements: cubes.map(cloneStudioCube),
      groups: groups.map(cloneStudioGroup),
      folders: folders.map(cloneStudioModelFolder),
      metadata: record(document.model.metadata) ? document.model.metadata as ImportedModelDraft['metadata'] : undefined,
      warnings: document.editor?.omittedAssets?.length
        ? ['Editor guide/background images are not embedded in portable model JSON.']
        : [],
    }
  },
}
