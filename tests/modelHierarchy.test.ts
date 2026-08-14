import { describe, expect, it } from 'vitest'
import { Euler, MathUtils, Vector3 } from 'three'

import {
  applyHierarchyState,
  buildAxisTransformState,
  buildNodeTransformState,
  buildPivotState,
  captureNodeTransform,
  duplicateStudioCube,
  duplicateStudioGroup,
  elementCenter,
  sanitizeGestureDelta,
  isPointerStepContinuous,
  snapValue,
} from '@/core/model/modelHierarchy'
import type { StudioAxis } from '@/core/model/modelHierarchy'
import { axisVectorForSpace } from '@/core/model/modelMath'
import {
  createEmptyStudioModel,
  createStudioCube,
  createStudioGroup,
} from '@/core/model/modelFactory'
import type { StudioResizeDirection } from '@/types/model'

function groupedModel() {
  const model = createEmptyStudioModel('project', 'Grouped', 'geometry.project.grouped')
  const cube = createStudioCube()
  cube.position = { x: 2, y: 0, z: 0 }
  cube.size = { x: 2, y: 2, z: 2 }
  cube.rotation = { x: 0, y: 45, z: 0 }
  cube.visible = false
  cube.pivot = { x: 3, y: 1, z: 1 }
  cube.defaultPivot = { ...cube.pivot }
  cube.metadata = { future: { materialSlot: 2 }, tags: ['slab'] }
  const group = createStudioGroup(0, [cube])
  group.metadata = { futureBone: true }
  cube.parentId = group.id
  model.groups.push(group)
  model.elements.push(cube)
  return { model, cube, group }
}

function resizeCube(axis: StudioAxis, direction: StudioResizeDirection, nextSize: number) {
  const model = createEmptyStudioModel('project', 'Resize', 'geometry.project.resize')
  const cube = createStudioCube()
  cube.position = { x: 2, y: 4, z: 6 }
  cube.size = { x: 16, y: 12, z: 8 }
  cube.rotation = { x: 17, y: 28, z: 11 }
  cube.pivot = { x: -3, y: 7, z: 2 }
  cube.defaultPivot = elementCenter(cube)
  model.elements.push(cube)
  const session = captureNodeTransform(model, cube.id)!
  const requested = structuredClone(cube)
  requested.size[axis] = nextSize
  return {
    before: cube,
    after: buildNodeTransformState(session, requested, {
      operation: 'scale',
      axis,
      resizeDirection: direction,
      transformSpace: 'global',
    }).elements[0]!,
  }
}

function initialSize(axis: StudioAxis): number {
  return axis === 'x' ? 16 : axis === 'y' ? 12 : 8
}

describe('Model Studio hierarchy and transforms', () => {
  it('duplicates cubes with independent IDs, metadata, transforms, lock, and parent relationship', () => {
    const { model, cube, group } = groupedModel()
    cube.name = 'Cube'
    cube.locked = true
    const duplicate = duplicateStudioCube(model, cube)

    expect(duplicate).toMatchObject({
      name: 'Cube Copy',
      parentId: group.id,
      position: cube.position,
      size: cube.size,
      rotation: cube.rotation,
      visible: cube.visible,
      locked: true,
      pivot: cube.pivot,
      metadata: cube.metadata,
    })
    expect(duplicate.id).not.toBe(cube.id)
    expect(duplicate.metadata).not.toBe(cube.metadata)
  })

  it('duplicates a group and remaps every copied child to the new hierarchy', () => {
    const { model, group } = groupedModel()
    model.elements.push({ ...createStudioCube(1), parentId: group.id })

    const duplicate = duplicateStudioGroup(model, group)

    expect(duplicate.group.id).not.toBe(group.id)
    expect(duplicate.group.name).toBe('Group Copy')
    expect(duplicate.elements).toHaveLength(2)
    expect(new Set(duplicate.elements.map((cube) => cube.id)).size).toBe(2)
    expect(duplicate.elements.every((cube) => cube.parentId === duplicate.group.id)).toBe(true)
    expect(duplicate.group.metadata).toEqual(group.metadata)
  })

  it('moves, rotates, and symmetrically resizes grouped cubes around the group pivot', () => {
    const moved = groupedModel()
    const moveSession = captureNodeTransform(moved.model, moved.group.id)!
    const moveState = buildAxisTransformState(moveSession, 'move', 'x', 4, 1, 15)
    expect(moveState.elements[0]?.position.x).toBe(6)
    expect(moveState.groups[0]?.pivot.x).toBe(7)

    applyHierarchyState(moved.model, moveState)
    const rotateSession = captureNodeTransform(moved.model, moved.group.id)!
    const rotateState = buildAxisTransformState(rotateSession, 'rotate', 'z', 90, 1, 15)
    expect(rotateState.elements[0]?.rotation.z).toBe(90)
    expect(rotateState.elements[0]?.position).toEqual({ x: 6, y: 0, z: 0 })

    applyHierarchyState(moved.model, rotateState)
    const scaleSession = captureNodeTransform(moved.model, moved.group.id)!
    const oldCenter = elementCenter(moved.model.elements[0]!)
    const scaleState = buildAxisTransformState(
      scaleSession,
      'scale',
      'x',
      1,
      0.25,
      15,
      { resizeDirection: 'symmetric' },
    )
    expect(scaleState.elements[0]?.size.x).toBe(3)
    expect(scaleState.groups[0]?.scale.x).toBe(1.5)
    expect(elementCenter(scaleState.elements[0]!)).toEqual(oldCenter)
    expect(scaleState.groups[0]?.pivot).toEqual(scaleSession.node.pivot)
  })

  it.each(['x', 'y', 'z'] as const)('resizes %s symmetrically without changing the visual center', (axis) => {
    const { before, after } = resizeCube(axis, 'symmetric', initialSize(axis) + 4)
    expect(elementCenter(after)).toEqual(elementCenter(before))
    expect(after.position[axis]).toBe(before.position[axis] - 2)
    expect(after.pivot).toEqual(before.pivot)
    expect(after.defaultPivot).toEqual(before.defaultPivot)
  })

  it.each(['x', 'y', 'z'] as const)('supports positive-side %s resize while keeping the negative side fixed', (axis) => {
    const nextSize = initialSize(axis) + 4
    const { before, after } = resizeCube(axis, 'positive', nextSize)
    expect(after.position[axis]).toBe(before.position[axis])
    expect(after.position[axis] + after.size[axis]).toBe(before.position[axis] + nextSize)
    expect(after.pivot).toEqual(before.pivot)
  })

  it.each(['x', 'y', 'z'] as const)('supports negative-side %s resize while keeping the positive side fixed', (axis) => {
    const nextSize = initialSize(axis) + 4
    const { before, after } = resizeCube(axis, 'negative', nextSize)
    expect(after.position[axis] + after.size[axis]).toBe(before.position[axis] + before.size[axis])
    expect(after.position[axis]).toBe(before.position[axis] - 4)
    expect(after.pivot).toEqual(before.pivot)
  })

  it('keeps a rotated cube center and custom pivot stable during symmetric numeric resize', () => {
    const { before, after } = resizeCube('x', 'symmetric', 20)
    expect(before.rotation).not.toEqual({ x: 0, y: 0, z: 0 })
    expect(elementCenter(after)).toEqual(elementCenter(before))
    expect(after.pivot).toEqual(before.pivot)
    expect(after.size.x).toBe(20)
  })

  it('edits a pivot without moving geometry while normal modeling rotation uses the geometry center', () => {
    const { model, cube } = groupedModel()
    const pivotSession = captureNodeTransform(model, cube.id)!
    const pivotState = buildPivotState(pivotSession, { x: 0, y: 0, z: 0 })
    expect(pivotState.elements[0]?.position).toEqual(cube.position)
    expect(pivotState.elements[0]?.size).toEqual(cube.size)

    applyHierarchyState(model, pivotState)
    const rotateSession = captureNodeTransform(model, cube.id)!
    const rotated = buildAxisTransformState(rotateSession, 'rotate', 'z', 90, 1, 15).elements[0]!
    expect(rotated.position).toEqual(cube.position)
    expect(rotated.rotation.z).toBe(90)
    expect(rotated.pivot).toEqual({ x: 4, y: -2, z: 0 })
  })

  it('rejects non-finite and runaway resize gesture spikes while preserving ordinary drags', () => {
    expect(sanitizeGestureDelta(Number.POSITIVE_INFINITY, 'scale', 16, 80)).toBe(0)
    expect(sanitizeGestureDelta(Number.NaN, 'scale', 16, 80)).toBe(0)
    expect(sanitizeGestureDelta(8, 'scale', 16, 80)).toBe(8)
    expect(sanitizeGestureDelta(50_000, 'scale', 16, 80)).toBe(80)
    expect(sanitizeGestureDelta(-50_000, 'scale', 16, 80)).toBe(-80)
  })

  it('rejects discontinuous Safari pointer-coordinate spikes without limiting continuous drags', () => {
    expect(isPointerStepContinuous(
      { x: 100, y: 100, time: 10 },
      { x: 145, y: 128, time: 26 },
      800,
    )).toBe(true)
    expect(isPointerStepContinuous(
      { x: 145, y: 128, time: 26 },
      { x: 2_500, y: -1_800, time: 42 },
      800,
    )).toBe(false)
    expect(isPointerStepContinuous(
      { x: 100, y: 100, time: 10 },
      { x: 430, y: 100, time: 260 },
      800,
    )).toBe(true)
  })

  it('provides Global, Local, and Parent transform-space axes', () => {
    const { model, cube, group } = groupedModel()
    cube.rotation = { x: 0, y: 0, z: 90 }
    group.rotation = { x: 0, y: 90, z: 0 }
    const session = captureNodeTransform(model, cube.id)!

    expect(axisVectorForSpace(cube, session.parentRotation, 'global', 'x')).toEqual({ x: 1, y: 0, z: 0 })
    expect(axisVectorForSpace(cube, session.parentRotation, 'local', 'x').x).toBeCloseTo(0)
    expect(axisVectorForSpace(cube, session.parentRotation, 'local', 'x').y).toBeCloseTo(1)
    expect(axisVectorForSpace(cube, session.parentRotation, 'parent', 'x').x).toBeCloseTo(0)
    expect(axisVectorForSpace(cube, session.parentRotation, 'parent', 'x').z).toBeCloseTo(-1)

    const globalMove = buildAxisTransformState(session, 'move', 'x', 2, null, null, { transformSpace: 'global' })
    const localMove = buildAxisTransformState(session, 'move', 'x', 2, null, null, { transformSpace: 'local' })
    const parentMove = buildAxisTransformState(session, 'move', 'x', 2, null, null, { transformSpace: 'parent' })
    expect(globalMove.elements[0]?.position).toEqual({ x: 4, y: 0, z: 0 })
    expect(localMove.elements[0]?.position.x).toBeCloseTo(2)
    expect(localMove.elements[0]?.position.y).toBeCloseTo(2)
    expect(parentMove.elements[0]?.position.x).toBeCloseTo(2)
    expect(parentMove.elements[0]?.position.z).toBeCloseTo(-2)
  })

  it('matches Three.js XYZ Euler axes for combined object rotations', () => {
    const cube = createStudioCube()
    cube.rotation = { x: 27, y: -38, z: 61 }
    const actual = axisVectorForSpace(cube, { x: 0, y: 0, z: 0 }, 'local', 'x')
    const expected = new Vector3(1, 0, 0).applyEuler(new Euler(
      MathUtils.degToRad(cube.rotation.x),
      MathUtils.degToRad(cube.rotation.y),
      MathUtils.degToRad(cube.rotation.z),
      'XYZ',
    ))

    expect(actual.x).toBeCloseTo(expected.x)
    expect(actual.y).toBeCloseTo(expected.y)
    expect(actual.z).toBeCloseTo(expected.z)
  })

  it('rotates grouped children around the selected group transform-space axis', () => {
    const { model, cube, group } = groupedModel()
    cube.rotation = { x: 0, y: 0, z: 0 }
    group.rotation = { x: 0, y: 0, z: 90 }
    const session = captureNodeTransform(model, group.id)!
    const state = buildAxisTransformState(session, 'rotate', 'x', 90, null, null, {
      transformSpace: 'local',
    })

    expect(state.elements[0]?.rotation.x).toBeCloseTo(0)
    expect(state.elements[0]?.rotation.y).toBeCloseTo(90)
    expect(state.groups[0]?.rotation.x).toBeCloseTo(90)
    // Euler XYZ reaches an equivalent gimbal-lock representation here.
    expect(state.groups[0]?.rotation.y).toBeCloseTo(90)
    expect(state.groups[0]?.rotation.z).toBeCloseTo(0)
  })

  it('supports off, preset, and fractional snapping without affecting exact numeric storage', () => {
    expect(snapValue(1.37, null)).toBe(1.37)
    expect(snapValue(1.37, 1)).toBe(1)
    expect(snapValue(1.37, 0.5)).toBe(1.5)
    expect(snapValue(1.37, 0.25)).toBe(1.25)
    expect(snapValue(23, 22.5)).toBe(22.5)
  })
})
