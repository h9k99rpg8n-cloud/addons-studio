import { describe, expect, it } from 'vitest'

import {
  createElementCommand,
  deleteElementCommand,
  ModelCommandHistory,
  updateElementCommand,
} from '@/core/model/modelHistory'
import { createEmptyStudioModel, createStudioCube } from '@/core/model/modelFactory'

describe('Model Studio command history', () => {
  it('undoes and redoes cube creation and deletion', () => {
    const model = createEmptyStudioModel('project', 'Slab', 'geometry.project.slab')
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
})
