import type { StudioCube, StudioGroup, StudioModel, StudioModelFolder } from '@/types/model'
import { createId } from '@/utils/createId'

import {
  cloneStudioCube,
  cloneStudioGroup,
  cloneStudioModelFolder,
} from './modelFactory'

export const MODEL_FOLDER_LIMITS = Object.freeze({
  cubes: 50,
  groups: 25,
  childFolders: 1,
  depth: 1,
})

export type ModelFolderIssueCode =
  | 'folder-not-found'
  | 'node-not-found'
  | 'nested-folder-limit'
  | 'cube-limit'
  | 'group-limit'
  | 'duplicate-folder-id'
  | 'invalid-folder-reference'

export class ModelFolderError extends Error {
  constructor(
    readonly code: ModelFolderIssueCode,
    message: string,
  ) {
    super(message)
    this.name = 'ModelFolderError'
  }
}

function uniqueFolderName(model: StudioModel, preferred = 'Folder'): string {
  const names = new Set(model.folders.map((folder) => folder.name.toLocaleLowerCase()))
  const base = preferred.trim() || 'Folder'
  if (!names.has(base.toLocaleLowerCase())) return base
  let suffix = 2
  while (names.has(`${base} ${suffix}`.toLocaleLowerCase())) suffix += 1
  return `${base} ${suffix}`
}

export function createModelFolder(
  model: StudioModel,
  name = 'Folder',
  parentId?: string,
): StudioModelFolder {
  if (parentId) assertFolderCanContainFolder(model, parentId)
  return {
    id: createId(),
    type: 'folder',
    name: uniqueFolderName(model, name),
    parentId,
    collapsed: false,
  }
}

export function renameModelFolder(folder: StudioModelFolder, name: string): StudioModelFolder {
  const normalized = name.trim()
  if (!normalized) throw new ModelFolderError('folder-not-found', 'Folder name is required.')
  return { ...cloneStudioModelFolder(folder), name: normalized.slice(0, 80) }
}

export function folderDirectCubes(model: StudioModel, folderId: string): StudioCube[] {
  return model.elements.filter((cube) => cube.folderId === folderId && !cube.parentId)
}

export function folderDirectGroups(model: StudioModel, folderId: string): StudioGroup[] {
  return model.groups.filter((group) => group.folderId === folderId)
}

export function folderChildren(model: StudioModel, folderId: string): StudioModelFolder[] {
  return model.folders.filter((folder) => folder.parentId === folderId)
}

export function assertFolderCanContainFolder(model: StudioModel, folderId: string): void {
  const folder = model.folders.find((entry) => entry.id === folderId)
  if (!folder) throw new ModelFolderError('folder-not-found', 'This model folder is no longer available.')
  if (folder.parentId) {
    throw new ModelFolderError(
      'nested-folder-limit',
      'Snapshot 3 supports only one nested model-folder level.',
    )
  }
  if (folderChildren(model, folderId).length >= MODEL_FOLDER_LIMITS.childFolders) {
    throw new ModelFolderError(
      'nested-folder-limit',
      'This folder already contains its one supported child folder.',
    )
  }
}

export function assertFolderCapacity(
  model: StudioModel,
  folderId: string,
  kind: 'cube' | 'group',
  additional = 1,
): void {
  if (!model.folders.some((folder) => folder.id === folderId)) {
    throw new ModelFolderError('folder-not-found', 'This model folder is no longer available.')
  }
  const count = kind === 'cube'
    ? folderDirectCubes(model, folderId).length
    : folderDirectGroups(model, folderId).length
  const limit = kind === 'cube' ? MODEL_FOLDER_LIMITS.cubes : MODEL_FOLDER_LIMITS.groups
  if (count + additional > limit) {
    throw new ModelFolderError(
      kind === 'cube' ? 'cube-limit' : 'group-limit',
      `This folder can contain up to ${limit} direct ${kind === 'cube' ? 'cubes' : 'groups'}.`,
    )
  }
}

export function moveNodeToFolder(
  model: StudioModel,
  nodeId: string,
  folderId?: string,
): { elements: StudioCube[]; groups: StudioGroup[] } {
  const elements = model.elements.map(cloneStudioCube)
  const groups = model.groups.map(cloneStudioGroup)
  const cube = elements.find((entry) => entry.id === nodeId)
  if (cube) {
    if (cube.parentId) {
      throw new ModelFolderError(
        'node-not-found',
        'Move the containing group to a folder, or remove this cube from its group first.',
      )
    }
    if (folderId && cube.folderId !== folderId) assertFolderCapacity(model, folderId, 'cube')
    cube.folderId = folderId
    return { elements, groups }
  }
  const group = groups.find((entry) => entry.id === nodeId)
  if (!group) throw new ModelFolderError('node-not-found', 'This model object is no longer available.')
  if (folderId && group.folderId !== folderId) assertFolderCapacity(model, folderId, 'group')
  group.folderId = folderId
  // A structural child follows its group in the Outliner and does not carry a
  // competing organizational folder reference.
  elements.forEach((entry) => {
    if (entry.parentId === group.id) entry.folderId = undefined
  })
  return { elements, groups }
}

export function removeModelFolder(
  model: StudioModel,
  folderId: string,
): { elements: StudioCube[]; groups: StudioGroup[]; folders: StudioModelFolder[] } {
  const folder = model.folders.find((entry) => entry.id === folderId)
  if (!folder) throw new ModelFolderError('folder-not-found', 'This model folder is no longer available.')
  const destinationId = folder.parentId
  return {
    elements: model.elements.map((cube) => ({
      ...cloneStudioCube(cube),
      folderId: cube.folderId === folderId ? destinationId : cube.folderId,
    })),
    groups: model.groups.map((group) => ({
      ...cloneStudioGroup(group),
      folderId: group.folderId === folderId ? destinationId : group.folderId,
    })),
    folders: model.folders
      .filter((entry) => entry.id !== folderId)
      .map((entry) => ({
        ...cloneStudioModelFolder(entry),
        parentId: entry.parentId === folderId ? destinationId : entry.parentId,
      })),
  }
}

export function validateModelFolders(model: StudioModel): ModelFolderError[] {
  const errors: ModelFolderError[] = []
  const ids = new Set<string>()
  for (const folder of model.folders) {
    if (ids.has(folder.id)) {
      errors.push(new ModelFolderError('duplicate-folder-id', 'Model folder IDs must be unique.'))
      continue
    }
    ids.add(folder.id)
  }
  for (const folder of model.folders) {
    if (folder.parentId && !ids.has(folder.parentId)) {
      errors.push(new ModelFolderError('invalid-folder-reference', `Folder “${folder.name}” has a missing parent.`))
    }
    if (folder.parentId) {
      const parent = model.folders.find((entry) => entry.id === folder.parentId)
      if (parent?.parentId) {
        errors.push(new ModelFolderError('nested-folder-limit', 'Model folders may be nested one level only.'))
      }
    }
    if (folderDirectCubes(model, folder.id).length > MODEL_FOLDER_LIMITS.cubes) {
      errors.push(new ModelFolderError('cube-limit', `Folder “${folder.name}” exceeds the 50-cube limit.`))
    }
    if (folderDirectGroups(model, folder.id).length > MODEL_FOLDER_LIMITS.groups) {
      errors.push(new ModelFolderError('group-limit', `Folder “${folder.name}” exceeds the 25-group limit.`))
    }
    if (folderChildren(model, folder.id).length > MODEL_FOLDER_LIMITS.childFolders) {
      errors.push(new ModelFolderError('nested-folder-limit', `Folder “${folder.name}” has too many child folders.`))
    }
  }
  for (const node of [...model.elements, ...model.groups]) {
    if (node.folderId && !ids.has(node.folderId)) {
      errors.push(new ModelFolderError('invalid-folder-reference', `Model object “${node.name}” has a missing folder.`))
    }
  }
  return errors
}
