import { describe, expect, it } from 'vitest'

import { applyHierarchyState, isNodeEffectivelyLocked } from '@/core/model/modelHierarchy'
import {
  alignSelectionState,
  buildSelectionAxisMoveState,
  captureSelectionTransform,
  cubeBounds,
  distributeSelectionState,
  duplicateAndMirrorSelection,
  isolatedElementIds,
  lockSelectionState,
  mirrorSelectionState,
  selectionCanTransform,
} from '@/core/model/modelProductivity'
import { createEmptyStudioModel, createStudioCube, createStudioGroup } from '@/core/model/modelFactory'

function productivityModel() {
  const model = createEmptyStudioModel('project', 'Productivity', 'geometry.project.productivity')
  const positions = [0, 5, 12]
  const cubes = positions.map((x, index) => {
    const cube = createStudioCube(index)
    cube.position = { x, y: index * 2, z: index * 3 }
    cube.size = { x: index + 2, y: 2, z: 2 }
    cube.pivot = { x: x + cube.size.x / 2, y: index * 2 + 1, z: index * 3 + 1 }
    cube.defaultPivot = { ...cube.pivot }
    return cube
  })
  model.elements.push(...cubes)
  return { model, cubes }
}

describe('Model Studio productivity operations', () => {
  it('moves a multi-selection in one shared transform state', () => {
    const { model, cubes } = productivityModel()
    const session = captureSelectionTransform(model, cubes.map((cube) => cube.id))!
    const state = buildSelectionAxisMoveState(session, 'x', 2.2, 0.5, 'global')

    expect(state.elements.map((cube) => cube.position.x)).toEqual([2, 7, 14])
    expect(state.elements.map((cube) => cube.pivot.x)).toEqual([3, 8.5, 16])
    expect(state.groups).toEqual([])
  })

  it.each(['x', 'y', 'z'] as const)('mirrors selection on %s including rotation and pivots', (axis) => {
    const { model, cubes } = productivityModel()
    const cube = cubes[0]!
    cube.rotation = { x: 10, y: 20, z: 30 }
    cube.pivot = { x: 0, y: 0, z: 0 }
    const state = mirrorSelectionState(model, [cube.id], axis)!
    const mirrored = state.after.elements[0]!
    const center = cubeBounds(cube).center

    expect(cubeBounds(mirrored).center[axis]).toBeCloseTo(center[axis])
    expect(mirrored.pivot[axis]).toBeCloseTo(center[axis] * 2)
    if (axis === 'x') expect(mirrored.rotation).toEqual({ x: 10, y: -20, z: -30 })
    if (axis === 'y') expect(mirrored.rotation).toEqual({ x: -10, y: 20, z: -30 })
    if (axis === 'z') expect(mirrored.rotation).toEqual({ x: -10, y: -20, z: 30 })
  })

  it('duplicates and mirrors groups with stable new IDs and remapped membership', () => {
    const { model, cubes } = productivityModel()
    const group = createStudioGroup(0, cubes.slice(0, 2))
    group.pivot = { x: 0, y: 0, z: 0 }
    group.defaultPivot = { ...group.pivot }
    cubes[0]!.parentId = group.id
    cubes[1]!.parentId = group.id
    model.groups.push(group)

    const duplicated = duplicateAndMirrorSelection(model, [group.id], 'x')

    expect(duplicated.groups).toHaveLength(1)
    expect(duplicated.elements).toHaveLength(2)
    expect(duplicated.groups[0]!.id).not.toBe(group.id)
    expect(new Set(duplicated.elements.map((cube) => cube.id)).size).toBe(2)
    expect(duplicated.elements.every((cube) => cube.parentId === duplicated.groups[0]!.id)).toBe(true)
    expect(duplicated.elements.every((cube) => !model.elements.some((source) => source.id === cube.id))).toBe(true)
  })

  it.each(['min', 'center', 'max'] as const)('aligns cube bounds to %s X', (alignment) => {
    const { model, cubes } = productivityModel()
    const state = alignSelectionState(model, cubes.map((cube) => cube.id), 'x', alignment)!
    const values = state.after.elements.map((cube) => {
      const bounds = cubeBounds(cube)
      return alignment === 'min' ? bounds.minimum.x : alignment === 'max' ? bounds.maximum.x : bounds.center.x
    })
    expect(values[1]).toBeCloseTo(values[0]!)
    expect(values[2]).toBeCloseTo(values[0]!)
  })

  it('distributes three cube bounds with equal gaps', () => {
    const { model, cubes } = productivityModel()
    const state = distributeSelectionState(model, cubes.map((cube) => cube.id), 'x')!
    const bounds = state.after.elements.map(cubeBounds).sort((a, b) => a.minimum.x - b.minimum.x)
    const firstGap = bounds[1]!.minimum.x - bounds[0]!.maximum.x
    const secondGap = bounds[2]!.minimum.x - bounds[1]!.maximum.x
    expect(firstGap).toBeCloseTo(secondGap)
    expect(bounds[0]!.minimum.x).toBe(0)
    expect(bounds[2]!.maximum.x).toBe(16)
  })

  it('locks groups structurally while preserving Outliner unlock access', () => {
    const { model, cubes } = productivityModel()
    const group = createStudioGroup(0, [cubes[0]!])
    cubes[0]!.parentId = group.id
    model.groups.push(group)
    const state = lockSelectionState(model, [group.id], true)!
    applyHierarchyState(model, state.after)

    expect(model.groups[0]?.locked).toBe(true)
    expect(isNodeEffectivelyLocked(model, cubes[0]!)).toBe(true)
    expect(selectionCanTransform(model, [group.id])).toBe(false)
    expect(selectionCanTransform(model, [cubes[0]!.id])).toBe(false)
  })

  it('computes editor-only isolation IDs without mutating intended visibility', () => {
    const { model, cubes } = productivityModel()
    const group = createStudioGroup(0, cubes.slice(0, 2))
    cubes[0]!.parentId = group.id
    cubes[1]!.parentId = group.id
    cubes[2]!.visible = false
    model.groups.push(group)
    const beforeVisibility = model.elements.map((cube) => cube.visible)

    expect(isolatedElementIds(model, [group.id])).toEqual([cubes[0]!.id, cubes[1]!.id])
    expect(model.elements.map((cube) => cube.visible)).toEqual(beforeVisibility)
  })
})
