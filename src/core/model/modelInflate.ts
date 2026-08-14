import type { StudioCube, StudioVector3 } from '@/types/model'

import { cloneStudioCube } from './modelFactory'
import { snapValue, type StudioAxis } from './modelHierarchy'

export type InflateSide = 'min' | 'max'
export type InflateHandleKind = 'corner' | 'edge' | 'face'

export interface StudioInflateHandle {
  id: string
  cubeId: string
  kind: InflateHandleKind
  point: StudioVector3
  sides: Partial<Record<StudioAxis, InflateSide>>
}

export interface StudioInflateFitResult {
  cube: StudioCube
  axes: StudioAxis[]
}

export class InflateError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InflateError'
  }
}

const AXES: readonly StudioAxis[] = ['x', 'y', 'z']
const MIN_CUBE_SIZE = 0.25

function pointForSides(cube: StudioCube, sides: Partial<Record<StudioAxis, InflateSide>>): StudioVector3 {
  const point = { x: 0, y: 0, z: 0 }
  for (const axis of AXES) {
    const side = sides[axis]
    point[axis] = side === 'min'
      ? cube.position[axis]
      : side === 'max'
        ? cube.position[axis] + cube.size[axis]
        : cube.position[axis] + cube.size[axis] / 2
  }
  return point
}

function handle(cube: StudioCube, kind: InflateHandleKind, sides: Partial<Record<StudioAxis, InflateSide>>): StudioInflateHandle {
  const signature = AXES.map((axis) => sides[axis] === 'min' ? 'n' : sides[axis] === 'max' ? 'x' : 'c').join('')
  return {
    id: `${cube.id}:${kind}:${signature}`,
    cubeId: cube.id,
    kind,
    point: pointForSides(cube, sides),
    sides,
  }
}

/**
 * Generates a finger-friendly fitting set: 8 corners, 12 edge midpoints and
 * 6 face centers. The renderer may draw them small while raycasting with a
 * larger threshold.
 */
export function inflateHandlesForCube(cube: StudioCube): StudioInflateHandle[] {
  const handles: StudioInflateHandle[] = []
  const sides: readonly InflateSide[] = ['min', 'max']
  for (const x of sides) for (const y of sides) for (const z of sides) {
    handles.push(handle(cube, 'corner', { x, y, z }))
  }
  for (const freeAxis of AXES) {
    const fixed = AXES.filter((axis) => axis !== freeAxis)
    for (const first of sides) for (const second of sides) {
      handles.push(handle(cube, 'edge', { [fixed[0]!]: first, [fixed[1]!]: second }))
    }
  }
  for (const axis of AXES) for (const side of sides) {
    handles.push(handle(cube, 'face', { [axis]: side }))
  }
  return handles
}

function isAxisAligned(cube: StudioCube): boolean {
  return AXES.every((axis) => Math.abs(cube.rotation[axis] % 360) < 1e-6)
}

export function fitInflateHandle(
  source: StudioCube,
  sourceHandle: StudioInflateHandle,
  target: StudioCube,
  targetHandle: StudioInflateHandle,
  snap: number | null = null,
): StudioInflateFitResult {
  if (source.id === target.id || sourceHandle.cubeId !== source.id || targetHandle.cubeId !== target.id) {
    throw new InflateError('Choose a fitting point on a different cube.')
  }
  if (!isAxisAligned(source) || !isAxisAligned(target)) {
    throw new InflateError('Inflate currently supports axis-aligned cubes. Set rotation to 0° before fitting.')
  }
  const axes = AXES.filter((axis) => Boolean(sourceHandle.sides[axis]))
  if (!axes.length) throw new InflateError('Choose a corner, edge, or face point to fit.')

  const cube = cloneStudioCube(source)
  const oldCenter = {
    x: source.position.x + source.size.x / 2,
    y: source.position.y + source.size.y / 2,
    z: source.position.z + source.size.z / 2,
  }
  for (const axis of axes) {
    const side = sourceHandle.sides[axis]!
    const targetBoundary = snapValue(targetHandle.point[axis], snap)
    const oppositeBoundary = side === 'min'
      ? source.position[axis] + source.size[axis]
      : source.position[axis]
    const nextSize = side === 'min'
      ? oppositeBoundary - targetBoundary
      : targetBoundary - oppositeBoundary
    if (!Number.isFinite(nextSize) || nextSize < MIN_CUBE_SIZE) {
      throw new InflateError(`The selected ${axis.toUpperCase()} fit would create an invalid cube size.`)
    }
    cube.position[axis] = side === 'min' ? targetBoundary : oppositeBoundary
    cube.size[axis] = nextSize
  }
  const newCenter = {
    x: cube.position.x + cube.size.x / 2,
    y: cube.position.y + cube.size.y / 2,
    z: cube.position.z + cube.size.z / 2,
  }
  cube.defaultPivot = {
    x: source.defaultPivot.x + newCenter.x - oldCenter.x,
    y: source.defaultPivot.y + newCenter.y - oldCenter.y,
    z: source.defaultPivot.z + newCenter.z - oldCenter.z,
  }
  // The custom pivot remains an explicit anchor, exactly like Resize.
  cube.pivot = { ...source.pivot }
  return { cube, axes }
}
