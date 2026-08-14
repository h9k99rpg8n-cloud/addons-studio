import { describe, expect, it } from 'vitest'

import {
  cloneStudioModel,
  createEmptyStudioModel,
  createStudioCube,
  createStudioGroup,
} from '@/core/model/modelFactory'
import {
  createModelFolder,
  ModelFolderError,
  moveNodeToFolder,
  removeModelFolder,
  renameModelFolder,
  validateModelFolders,
} from '@/core/model/modelFolders'

function modelWithFolder() {
  const model = createEmptyStudioModel('project', 'Folders', 'geometry.project.folders')
  const folder = createModelFolder(model, 'Head Pieces')
  model.folders.push(folder)
  return { model, folder }
}

describe('Model Outliner folders', () => {
  it('creates, renames, clones, and persists organizational metadata', () => {
    const { model, folder } = modelWithFolder()
    model.folders[0] = renameModelFolder(folder, 'Body Pieces')
    const reopened = cloneStudioModel(model)
    expect(reopened.folders).toEqual([{ ...folder, name: 'Body Pieces' }])
    expect(reopened.folders[0]).not.toBe(model.folders[0])
  })

  it('moves root cubes and groups without applying transforms', () => {
    const { model, folder } = modelWithFolder()
    const cube = createStudioCube()
    const group = createStudioGroup()
    model.elements.push(cube)
    model.groups.push(group)
    const cubeMoved = moveNodeToFolder(model, cube.id, folder.id)
    model.elements = cubeMoved.elements
    model.groups = cubeMoved.groups
    const groupMoved = moveNodeToFolder(model, group.id, folder.id)
    expect(groupMoved.elements[0]?.position).toEqual(cube.position)
    expect(groupMoved.groups[0]?.position).toEqual(group.position)
    expect(groupMoved.elements[0]?.folderId).toBe(folder.id)
    expect(groupMoved.groups[0]?.folderId).toBe(folder.id)
  })

  it('supports exactly one nested child level and one direct child folder', () => {
    const { model, folder } = modelWithFolder()
    const child = createModelFolder(model, 'Detail', folder.id)
    model.folders.push(child)
    expect(() => createModelFolder(model, 'Second child', folder.id)).toThrow(ModelFolderError)
    expect(() => createModelFolder(model, 'Too deep', child.id)).toThrow('one nested')
  })

  it('enforces direct cube and group safeguards without losing items', () => {
    const { model, folder } = modelWithFolder()
    model.elements = Array.from({ length: 50 }, (_, index) => {
      const cube = createStudioCube(index)
      cube.folderId = folder.id
      return cube
    })
    const extra = createStudioCube(50)
    model.elements.push(extra)
    expect(() => moveNodeToFolder(model, extra.id, folder.id)).toThrow('up to 50')
    expect(model.elements).toHaveLength(51)

    model.groups = Array.from({ length: 25 }, (_, index) => {
      const group = createStudioGroup(index)
      group.folderId = folder.id
      return group
    })
    const extraGroup = createStudioGroup(25)
    model.groups.push(extraGroup)
    expect(() => moveNodeToFolder(model, extraGroup.id, folder.id)).toThrow('up to 25')
    expect(model.groups).toHaveLength(26)
  })

  it('deletes a folder safely by moving direct contents to its parent/root', () => {
    const { model, folder } = modelWithFolder()
    const cube = createStudioCube()
    cube.folderId = folder.id
    model.elements.push(cube)
    const result = removeModelFolder(model, folder.id)
    expect(result.folders).toEqual([])
    expect(result.elements[0]?.folderId).toBeUndefined()
    expect(result.elements[0]?.id).toBe(cube.id)
  })

  it('detects broken references and duplicate folder IDs', () => {
    const { model, folder } = modelWithFolder()
    model.folders.push({ ...folder })
    const cube = createStudioCube()
    cube.folderId = 'missing'
    model.elements.push(cube)
    expect(validateModelFolders(model).map((entry) => entry.code)).toEqual(
      expect.arrayContaining(['duplicate-folder-id', 'invalid-folder-reference']),
    )
  })
})
