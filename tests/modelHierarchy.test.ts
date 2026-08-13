import { describe, expect, it } from 'vitest'

import {
  applyHierarchyState,
  buildNodeTransformState,
  buildPivotState,
  captureNodeTransform,
  duplicateStudioCube,
  duplicateStudioGroup,
  requestedAxisTransform,
  snapValue,
} from '@/core/model/modelHierarchy'
import {
  createEmptyStudioModel,
  createStudioCube,
  createStudioGroup,
} from '@/core/model/modelFactory'

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

describe('Model Studio hierarchy and transforms', () => {
  it('duplicates cubes with independent IDs, metadata, transforms, and parent relationship', () => {
    const { model, cube, group } = groupedModel()
    cube.name = 'Cube'
    const duplicate = duplicateStudioCube(model, cube)

    expect(duplicate).toMatchObject({
      name: 'Cube Copy',
      parentId: group.id,
      position: cube.position,
      size: cube.size,
      rotation: cube.rotation,
      visible: cube.visible,
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

  it('moves, rotates, and resizes grouped cubes together around the group pivot', () => {
    const moved = groupedModel()
    const moveSession = captureNodeTransform(moved.model, moved.group.id)!
    const moveRequest = requestedAxisTransform(moveSession, 'move', 'x', 4, 1, 15)
    const moveState = buildNodeTransformState(moveSession, moveRequest)
    expect(moveState.elements[0]?.position.x).toBe(6)
    expect(moveState.groups[0]?.pivot.x).toBe(7)

    applyHierarchyState(moved.model, moveState)
    const rotateSession = captureNodeTransform(moved.model, moved.group.id)!
    const rotateRequest = requestedAxisTransform(rotateSession, 'rotate', 'z', 90, 1, 15)
    const rotateState = buildNodeTransformState(rotateSession, rotateRequest)
    expect(rotateState.elements[0]?.rotation.z).toBe(90)
    expect(rotateState.elements[0]?.position).toEqual({ x: 6, y: 0, z: 0 })

    applyHierarchyState(moved.model, rotateState)
    const scaleSession = captureNodeTransform(moved.model, moved.group.id)!
    const scaleRequest = requestedAxisTransform(scaleSession, 'scale', 'x', 1, 0.25, 15)
    const scaleState = buildNodeTransformState(scaleSession, scaleRequest)
    expect(scaleState.elements[0]?.size.x).toBe(4)
    expect(scaleState.groups[0]?.scale.x).toBe(2)
  })

  it('edits a pivot without moving geometry and rotates a cube around that pivot later', () => {
    const { model, cube } = groupedModel()
    const pivotSession = captureNodeTransform(model, cube.id)!
    const pivotState = buildPivotState(pivotSession, { x: 0, y: 0, z: 0 })
    expect(pivotState.elements[0]?.position).toEqual(cube.position)
    expect(pivotState.elements[0]?.size).toEqual(cube.size)

    applyHierarchyState(model, pivotState)
    const rotateSession = captureNodeTransform(model, cube.id)!
    const request = requestedAxisTransform(rotateSession, 'rotate', 'z', 90, 1, 15)
    const rotated = buildNodeTransformState(rotateSession, request).elements[0]!
    expect(rotated.position.x).toBeCloseTo(-2)
    expect(rotated.position.y).toBeCloseTo(2)
    expect(rotated.rotation.z).toBe(90)
  })

  it('keeps exact cube position while direct size values update the reset pivot', () => {
    const { model, cube } = groupedModel()
    const session = captureNodeTransform(model, cube.id)!
    const request = structuredClone(cube)
    request.size.x = 4.75
    const resized = buildNodeTransformState(session, request).elements[0]!

    expect(resized.position).toEqual(cube.position)
    expect(resized.size.x).toBe(4.75)
    expect(resized.defaultPivot.x).toBeCloseTo(4.375)
  })

  it('supports off, preset, and fractional snapping without affecting exact numeric storage', () => {
    expect(snapValue(1.37, null)).toBe(1.37)
    expect(snapValue(1.37, 1)).toBe(1)
    expect(snapValue(1.37, 0.5)).toBe(1.5)
    expect(snapValue(1.37, 0.25)).toBe(1.25)
    expect(snapValue(23, 22.5)).toBe(22.5)
  })
})
