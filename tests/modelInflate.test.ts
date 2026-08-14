import { describe, expect, it } from 'vitest'

import { createStudioCube } from '@/core/model/modelFactory'
import { ModelCommandHistory, updateElementCommand } from '@/core/model/modelHistory'
import {
  fitInflateHandle,
  inflateHandlesForCube,
  InflateError,
} from '@/core/model/modelInflate'
import { createEmptyStudioModel } from '@/core/model/modelFactory'

function face(cube: ReturnType<typeof createStudioCube>, axis: 'x' | 'y' | 'z', side: 'min' | 'max') {
  return inflateHandlesForCube(cube).find((handle) =>
    handle.kind === 'face' && handle.sides[axis] === side,
  )!
}

describe('Model Core Inflate', () => {
  it('exposes 26 finger-targetable points per cube', () => {
    const handles = inflateHandlesForCube(createStudioCube())
    expect(handles.filter((entry) => entry.kind === 'corner')).toHaveLength(8)
    expect(handles.filter((entry) => entry.kind === 'edge')).toHaveLength(12)
    expect(handles.filter((entry) => entry.kind === 'face')).toHaveLength(6)
    expect(new Set(handles.map((entry) => entry.id)).size).toBe(26)
  })

  it.each(['x', 'y', 'z'] as const)('fits a %s boundary without merging cubes', (axis) => {
    const source = createStudioCube()
    source.position = { x: 0, y: 0, z: 0 }
    source.size = { x: 8, y: 8, z: 8 }
    source.pivot = { x: -2, y: 3, z: 5 }
    const target = createStudioCube(1)
    target.position = { x: 10, y: 10, z: 10 }
    target.size = { x: 4, y: 4, z: 4 }

    const fitted = fitInflateHandle(source, face(source, axis, 'max'), target, face(target, axis, 'min'))

    expect(fitted.axes).toEqual([axis])
    expect(fitted.cube.position[axis] + fitted.cube.size[axis]).toBe(10)
    expect(fitted.cube.pivot).toEqual(source.pivot)
    expect(fitted.cube.id).toBe(source.id)
    expect(target.size).toEqual({ x: 4, y: 4, z: 4 })
  })

  it('fits a corner on multiple axes with snapping', () => {
    const source = createStudioCube()
    source.size = { x: 4, y: 4, z: 4 }
    const target = createStudioCube(1)
    target.position = { x: 7.9, y: 8.1, z: 7.8 }
    const sourceCorner = inflateHandlesForCube(source).find((entry) =>
      entry.kind === 'corner' && entry.sides.x === 'max' && entry.sides.y === 'max' && entry.sides.z === 'max',
    )!
    const targetCorner = inflateHandlesForCube(target).find((entry) =>
      entry.kind === 'corner' && entry.sides.x === 'min' && entry.sides.y === 'min' && entry.sides.z === 'min',
    )!

    const fitted = fitInflateHandle(source, sourceCorner, target, targetCorner, 0.5)
    expect(fitted.axes).toEqual(['x', 'y', 'z'])
    expect(fitted.cube.size).toEqual({ x: 8, y: 8, z: 8 })
  })

  it('rejects the same cube, rotated cubes, and invalid boundary crossings', () => {
    const source = createStudioCube()
    const target = createStudioCube(1)
    expect(() => fitInflateHandle(source, face(source, 'x', 'max'), source, face(source, 'x', 'min')))
      .toThrow(InflateError)
    source.rotation.y = 15
    expect(() => fitInflateHandle(source, face(source, 'x', 'max'), target, face(target, 'x', 'min')))
      .toThrow('axis-aligned')
    source.rotation.y = 0
    target.position.x = -2
    expect(() => fitInflateHandle(source, face(source, 'x', 'max'), target, face(target, 'x', 'min')))
      .toThrow('invalid cube size')
  })

  it('undoes and redoes one completed fit as a single command', () => {
    const model = createEmptyStudioModel('project', 'Inflate', 'geometry.project.inflate')
    const source = createStudioCube()
    source.size.x = 8
    const target = createStudioCube(1)
    target.position.x = 10
    model.elements.push(source, target)
    const fitted = fitInflateHandle(source, face(source, 'x', 'max'), target, face(target, 'x', 'min')).cube
    const history = new ModelCommandHistory()
    history.execute(updateElementCommand(source, fitted, 'Inflate fit X'), model)
    expect(model.elements[0]?.size.x).toBe(10)
    history.undo(model)
    expect(model.elements[0]?.size.x).toBe(8)
    history.redo(model)
    expect(model.elements[0]?.size.x).toBe(10)
  })
})
