import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'

import {
  createElementCommand,
  createGroupCommand,
  createHierarchyCommand,
  deleteElementCommand,
  deleteGroupCommand,
  ModelCommandHistory,
  updateElementCommand,
} from '@/core/model/modelHistory'
import { createEmptyStudioModel, createStudioCube, createStudioGroup } from '@/core/model/modelFactory'

describe('Model Studio command history', () => {
  it('undoes and redoes cube creation and deletion', () => {
    const model = reactive(createEmptyStudioModel('project', 'Slab', 'geometry.project.slab'))
    const cube = createStudioCube()
    const history = new ModelCommandHistory()

    history.execute(createElementCommand(cube, 0), model)
    expect(model.elements).toHaveLength(1)
    history.undo(model)
    expect(model.elements).toHaveLength(0)
    history.redo(model)
    expect(model.elements[0]?.id).toBe(cube.id)

    history.execute(deleteElementCommand(cube, 0), model)
    expect(model.elements).toHaveLength(0)
    history.undo(model)
    expect(model.elements[0]?.id).toBe(cube.id)
  })

  it('stores compact before/after commands for move, rotate, resize, and rename', () => {
    const model = createEmptyStudioModel('project', 'Slab', 'geometry.project.slab')
    const cube = createStudioCube()
    model.elements.push(cube)
    const history = new ModelCommandHistory()
    const before = structuredClone(cube)
    const after = structuredClone(cube)
    after.name = 'Vertical Slab'
    after.position.x = 4
    after.rotation.y = 90
    after.size.y = 8

    history.execute(updateElementCommand(before, after, 'Transform cube'), model)
    expect(model.elements[0]).toMatchObject({
      name: 'Vertical Slab',
      position: { x: 4 },
      rotation: { y: 90 },
      size: { y: 8 },
    })
    history.undo(model)
    expect(model.elements[0]).toEqual(before)
    history.redo(model)
    expect(model.elements[0]).toEqual(after)
  })

  it('undoes group creation, group duplication, and safe group deletion', () => {
    const model = createEmptyStudioModel('project', 'Groups', 'geometry.project.groups')
    const cube = createStudioCube()
    const group = createStudioGroup(0, [cube])
    cube.parentId = group.id
    const history = new ModelCommandHistory()

    history.execute(createGroupCommand(group, 0), model)
    history.execute(createElementCommand(cube, 0), model)

    const copiedGroup = createStudioGroup(1, [cube])
    const copiedCube = { ...createStudioCube(1), parentId: copiedGroup.id }
    history.execute(createHierarchyCommand(copiedGroup, [copiedCube]), model)
    expect(model.groups).toHaveLength(2)
    expect(model.elements).toHaveLength(2)

    history.undo(model)
    expect(model.groups).toHaveLength(1)
    expect(model.elements).toHaveLength(1)
    history.redo(model)
    expect(model.groups).toHaveLength(2)

    history.execute(deleteGroupCommand(group, 0, [cube]), model)
    expect(model.groups.find((entry) => entry.id === group.id)).toBeUndefined()
    expect(model.elements.find((entry) => entry.id === cube.id)?.parentId).toBeUndefined()
    history.undo(model)
    expect(model.groups.find((entry) => entry.id === group.id)).toBeDefined()
    expect(model.elements.find((entry) => entry.id === cube.id)?.parentId).toBe(group.id)
  })
})
