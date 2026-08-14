import type {
  ModelManipulationTool,
  StudioCube,
  StudioGroup,
  StudioModel,
  StudioModelNode,
  StudioResizeDirection,
  StudioTransformSpace,
  StudioVector3,
} from '@/types/model'
import { createId } from '@/utils/createId'

import { cloneStudioCube, cloneStudioGroup } from './modelFactory'
import {
  addVector,
  axisVectorForSpace,
  mirrorEuler,
  multiplyVector,
  rotateEulerAroundAxis,
  rotateEulerInSpace,
  rotatePointAroundAxis,
  rotatePointEuler,
  rotateVectorEuler,
  subtractVector,
  type StudioAxis,
} from './modelMath'

export type { StudioAxis } from './modelMath'

export interface StudioHierarchyState {
  elements: StudioCube[]
  groups: StudioGroup[]
}

export interface StudioNodeTransformSession {
  targetId: string
  node: StudioModelNode
  parentRotation: StudioVector3
  before: StudioHierarchyState
}

export interface StudioNodeTransformOptions {
  operation?: 'generic' | 'move' | 'rotate' | 'scale'
  axis?: StudioAxis
  delta?: number
  resizeDirection?: StudioResizeDirection
  transformSpace?: StudioTransformSpace
}

const ZERO_ROTATION: StudioVector3 = { x: 0, y: 0, z: 0 }
const MIN_CUBE_SIZE = 0.25
const MIN_GROUP_SCALE = 0.05

export function elementCenter(element: StudioCube): StudioVector3 {
  return {
    x: element.position.x + element.size.x / 2,
    y: element.position.y + element.size.y / 2,
    z: element.position.z + element.size.z / 2,
  }
}

export function getStudioNode(model: StudioModel, id: string | undefined): StudioModelNode | undefined {
  if (!id) return undefined
  return model.elements.find((element) => element.id === id)
    ?? model.groups.find((group) => group.id === id)
}

export function getGroupChildren(model: StudioModel, groupId: string): StudioCube[] {
  return model.elements.filter((element) => element.parentId === groupId)
}

export function isNodeEffectivelyVisible(model: StudioModel, element: StudioCube): boolean {
  if (!element.visible) return false
  if (!element.parentId) return true
  return model.groups.find((group) => group.id === element.parentId)?.visible !== false
}

export function isNodeEffectivelyLocked(model: StudioModel, node: StudioModelNode): boolean {
  if (node.locked) return true
  if (node.type === 'group' || !node.parentId) return false
  return model.groups.find((group) => group.id === node.parentId)?.locked === true
}

export function hierarchyBounds(elements: StudioCube[]): {
  minimum: StudioVector3
  maximum: StudioVector3
  center: StudioVector3
  size: StudioVector3
} | undefined {
  if (!elements.length) return undefined
  const minimum = { x: Infinity, y: Infinity, z: Infinity }
  const maximum = { x: -Infinity, y: -Infinity, z: -Infinity }
  for (const element of elements) {
    minimum.x = Math.min(minimum.x, element.position.x)
    minimum.y = Math.min(minimum.y, element.position.y)
    minimum.z = Math.min(minimum.z, element.position.z)
    maximum.x = Math.max(maximum.x, element.position.x + element.size.x)
    maximum.y = Math.max(maximum.y, element.position.y + element.size.y)
    maximum.z = Math.max(maximum.z, element.position.z + element.size.z)
  }
  const center = {
    x: (minimum.x + maximum.x) / 2,
    y: (minimum.y + maximum.y) / 2,
    z: (minimum.z + maximum.z) / 2,
  }
  return {
    minimum,
    maximum,
    center,
    size: {
      x: maximum.x - minimum.x,
      y: maximum.y - minimum.y,
      z: maximum.z - minimum.z,
    },
  }
}

export function groupBoundsCenter(elements: StudioCube[]): StudioVector3 {
  return hierarchyBounds(elements)?.center ?? { x: 0, y: 0, z: 0 }
}

export function nodePivotCenter(model: StudioModel, node: StudioModelNode): StudioVector3 {
  return node.type === 'cube'
    ? elementCenter(node)
    : groupBoundsCenter(getGroupChildren(model, node.id))
}

function copyName(source: string, existingNames: string[]): string {
  const base = `${source.replace(/ Copy(?: \d+)?$/, '')} Copy`
  if (!existingNames.includes(base)) return base
  let suffix = 2
  while (existingNames.includes(`${base} ${suffix}`)) suffix += 1
  return `${base} ${suffix}`
}

export function duplicateStudioCube(model: StudioModel, source: StudioCube): StudioCube {
  const duplicate = cloneStudioCube(source)
  duplicate.id = createId()
  duplicate.name = copyName(source.name, model.elements.map((element) => element.name))
  return duplicate
}

export function duplicateStudioGroup(
  model: StudioModel,
  source: StudioGroup,
): { group: StudioGroup; elements: StudioCube[] } {
  const group = cloneStudioGroup(source)
  group.id = createId()
  group.name = copyName(source.name, model.groups.map((entry) => entry.name))
  group.parentId = undefined
  const usedNames = model.elements.map((entry) => entry.name)
  const elements = getGroupChildren(model, source.id).map((element) => {
    const duplicate = cloneStudioCube(element)
    duplicate.id = createId()
    duplicate.parentId = group.id
    duplicate.name = copyName(element.name, usedNames)
    usedNames.push(duplicate.name)
    return duplicate
  })
  return { group, elements }
}

export function captureNodeTransform(
  model: StudioModel,
  nodeId: string,
): StudioNodeTransformSession | undefined {
  const node = getStudioNode(model, nodeId)
  if (!node) return undefined
  const parentRotation = node.type === 'cube' && node.parentId
    ? model.groups.find((group) => group.id === node.parentId)?.rotation ?? ZERO_ROTATION
    : ZERO_ROTATION
  if (node.type === 'cube') {
    const cube = cloneStudioCube(node)
    return {
      targetId: node.id,
      node: cube,
      parentRotation: { ...parentRotation },
      before: { elements: [cloneStudioCube(cube)], groups: [] },
    }
  }
  const group = cloneStudioGroup(node)
  return {
    targetId: node.id,
    node: group,
    parentRotation: { ...ZERO_ROTATION },
    before: {
      elements: getGroupChildren(model, node.id).map(cloneStudioCube),
      groups: [cloneStudioGroup(group)],
    },
  }
}

function inferOperation(
  before: StudioModelNode,
  requested: StudioModelNode,
): StudioNodeTransformOptions['operation'] {
  if (before.type !== requested.type) return 'generic'
  if (before.type === 'cube' && requested.type === 'cube') {
    if (JSON.stringify(before.size) !== JSON.stringify(requested.size)) return 'scale'
  } else if (before.type === 'group' && requested.type === 'group') {
    if (JSON.stringify(before.scale) !== JSON.stringify(requested.scale)) return 'scale'
  }
  if (JSON.stringify(before.rotation) !== JSON.stringify(requested.rotation)) return 'rotate'
  if (JSON.stringify(before.position) !== JSON.stringify(requested.position)) return 'move'
  return 'generic'
}

function resizedCube(
  source: StudioCube,
  requested: StudioCube,
  session: StudioNodeTransformSession,
  options: StudioNodeTransformOptions,
): StudioCube {
  const cube = cloneStudioCube(source)
  cube.name = requested.name
  cube.visible = requested.visible
  cube.locked = requested.locked
  cube.parentId = requested.parentId
  cube.metadata = requested.metadata
  const direction = options.resizeDirection ?? 'symmetric'
  const space = options.transformSpace ?? 'global'
  const axes: StudioAxis[] = options.axis ? [options.axis] : ['x', 'y', 'z']

  for (const axis of axes) {
    const nextSize = Math.max(MIN_CUBE_SIZE, requested.size[axis])
    const sizeDelta = nextSize - cube.size[axis]
    if (Math.abs(sizeDelta) < 1e-9) continue
    const oldCenter = elementCenter(cube)
    const basis = axisVectorForSpace(source, session.parentRotation, space, axis)
    const directionFactor = direction === 'positive' ? 0.5 : direction === 'negative' ? -0.5 : 0
    const centerShift = multiplyVector(basis, sizeDelta * directionFactor)
    const newCenter = addVector(oldCenter, centerShift)
    cube.size[axis] = nextSize
    cube.position = {
      x: newCenter.x - cube.size.x / 2,
      y: newCenter.y - cube.size.y / 2,
      z: newCenter.z - cube.size.z / 2,
    }
    cube.defaultPivot = addVector(cube.defaultPivot, centerShift)
  }
  // A custom pivot is an anchor and must never be stretched or moved by Resize.
  cube.pivot = { ...source.pivot }
  return cube
}

function buildCubeTransform(
  session: StudioNodeTransformSession,
  requested: StudioCube,
  options: StudioNodeTransformOptions,
): StudioHierarchyState {
  const before = session.before.elements[0]!
  const operation = options.operation ?? inferOperation(before, requested)
  if (operation === 'scale') {
    return { elements: [resizedCube(before, requested, session, options)], groups: [] }
  }

  const after = cloneStudioCube(requested)
  if (operation === 'move') {
    const translation = subtractVector(after.position, before.position)
    after.pivot = addVector(before.pivot, translation)
    after.defaultPivot = addVector(before.defaultPivot, translation)
  } else if (operation === 'rotate') {
    const axis = options.axis
    const delta = options.delta
    const modelingCenter = elementCenter(before)
    if (axis && Number.isFinite(delta)) {
      const basis = axisVectorForSpace(
        before,
        session.parentRotation,
        options.transformSpace ?? 'global',
        axis,
      )
      after.pivot = rotatePointAroundAxis(before.pivot, modelingCenter, basis, delta!)
      after.defaultPivot = rotatePointAroundAxis(before.defaultPivot, modelingCenter, basis, delta!)
    } else {
      const rotationDelta = subtractVector(after.rotation, before.rotation)
      after.pivot = rotatePointEuler(before.pivot, modelingCenter, rotationDelta)
      after.defaultPivot = rotatePointEuler(before.defaultPivot, modelingCenter, rotationDelta)
    }
    // Normal modeling rotation uses the geometry center. The explicit pivot is
    // retained relative to the cube and is only the gizmo origin in Pivot mode.
    after.position = { ...before.position }
  }
  return { elements: [after], groups: [] }
}

function translateCube(source: StudioCube, translation: StudioVector3): StudioCube {
  const cube = cloneStudioCube(source)
  cube.position = addVector(cube.position, translation)
  cube.pivot = addVector(cube.pivot, translation)
  cube.defaultPivot = addVector(cube.defaultPivot, translation)
  return cube
}

function projectedElementBounds(
  elements: StudioCube[],
  basis: StudioVector3,
): { minimum: number; maximum: number; extent: number } | undefined {
  if (!elements.length) return undefined
  let minimum = Infinity
  let maximum = -Infinity
  for (const cube of elements) {
    const center = elementCenter(cube)
    const projection = center.x * basis.x + center.y * basis.y + center.z * basis.z
    const localAxes = (['x', 'y', 'z'] as const).map((axis) =>
      rotateVectorEuler(
        { x: axis === 'x' ? 1 : 0, y: axis === 'y' ? 1 : 0, z: axis === 'z' ? 1 : 0 },
        cube.rotation,
      ),
    )
    const radius = localAxes.reduce((sum, localAxis, index) => {
      const sizeAxis = (['x', 'y', 'z'] as const)[index]!
      const alignment = Math.abs(
        localAxis.x * basis.x + localAxis.y * basis.y + localAxis.z * basis.z,
      )
      return sum + alignment * cube.size[sizeAxis] / 2
    }, 0)
    minimum = Math.min(minimum, projection - radius)
    maximum = Math.max(maximum, projection + radius)
  }
  return { minimum, maximum, extent: maximum - minimum }
}

function resizeGroup(
  session: StudioNodeTransformSession,
  requested: StudioGroup,
  options: StudioNodeTransformOptions,
): StudioHierarchyState {
  const before = session.before.groups[0]!
  const after = cloneStudioGroup(requested)
  const direction = options.resizeDirection ?? 'symmetric'
  const space = options.transformSpace ?? 'global'
  const axes: StudioAxis[] = options.axis ? [options.axis] : ['x', 'y', 'z']
  let elements = session.before.elements.map(cloneStudioCube)
  const oldCenter = groupBoundsCenter(elements)

  for (const axis of axes) {
    const factor = after.scale[axis] / Math.max(0.0001, before.scale[axis])
    if (!Number.isFinite(factor) || Math.abs(factor - 1) < 1e-9) continue
    const basis = axisVectorForSpace(before, session.parentRotation, space, axis)
    const projected = projectedElementBounds(elements, basis)
    const minimum = projected?.minimum ?? 0
    const maximum = projected?.maximum ?? 0
    const anchorProjection = direction === 'positive'
      ? minimum
      : direction === 'negative'
        ? maximum
        : (minimum + maximum) / 2
    const anchor = multiplyVector(basis, anchorProjection)

    elements = elements.map((source) => {
      const cube = cloneStudioCube(source)
      const scalePoint = (point: StudioVector3) => {
        const relative = subtractVector(point, anchor)
        const projection = relative.x * basis.x + relative.y * basis.y + relative.z * basis.z
        return addVector(point, multiplyVector(basis, projection * (factor - 1)))
      }
      const center = scalePoint(elementCenter(source))
      cube.pivot = scalePoint(source.pivot)
      cube.defaultPivot = scalePoint(source.defaultPivot)
      cube.size[axis] = Math.max(MIN_CUBE_SIZE, source.size[axis] * Math.abs(factor))
      cube.position = {
        x: center.x - cube.size.x / 2,
        y: center.y - cube.size.y / 2,
        z: center.z - cube.size.z / 2,
      }
      return cube
    })
  }

  const newCenter = groupBoundsCenter(elements)
  const centerShift = subtractVector(newCenter, oldCenter)
  after.position = addVector(before.position, centerShift)
  after.pivot = { ...before.pivot }
  after.defaultPivot = addVector(before.defaultPivot, centerShift)
  return { elements, groups: [after] }
}

function buildGroupTransform(
  session: StudioNodeTransformSession,
  requested: StudioGroup,
  options: StudioNodeTransformOptions,
): StudioHierarchyState {
  const before = session.before.groups[0]!
  const operation = options.operation ?? inferOperation(before, requested)
  if (operation === 'scale') return resizeGroup(session, requested, options)

  const after = cloneStudioGroup(requested)
  if (operation === 'move') {
    const translation = subtractVector(after.position, before.position)
    after.pivot = addVector(before.pivot, translation)
    after.defaultPivot = addVector(before.defaultPivot, translation)
    return {
      elements: session.before.elements.map((element) => translateCube(element, translation)),
      groups: [after],
    }
  }

  if (operation === 'rotate') {
    const axis = options.axis
    const delta = options.delta
    const rotationDelta = subtractVector(after.rotation, before.rotation)
    const basis = axis
      ? axisVectorForSpace(before, session.parentRotation, options.transformSpace ?? 'global', axis)
      : undefined
    const modelingCenter = groupBoundsCenter(session.before.elements)
    const rotatePoint = (point: StudioVector3) =>
      basis && Number.isFinite(delta)
        ? rotatePointAroundAxis(point, modelingCenter, basis, delta!)
        : rotatePointEuler(point, modelingCenter, rotationDelta)
    return {
      elements: session.before.elements.map((source) => {
        const cube = cloneStudioCube(source)
        const center = rotatePoint(elementCenter(source))
        cube.position = {
          x: center.x - cube.size.x / 2,
          y: center.y - cube.size.y / 2,
          z: center.z - cube.size.z / 2,
        }
        cube.pivot = rotatePoint(source.pivot)
        cube.defaultPivot = rotatePoint(source.defaultPivot)
        cube.rotation = basis && axis && Number.isFinite(delta)
          ? rotateEulerAroundAxis(source.rotation, basis, delta!)
          : addVector(source.rotation, rotationDelta)
        return cube
      }),
      groups: [{
        ...after,
        position: rotatePoint(before.position),
        pivot: rotatePoint(before.pivot),
        defaultPivot: rotatePoint(before.defaultPivot),
      }],
    }
  }
  return { elements: session.before.elements.map(cloneStudioCube), groups: [after] }
}

export function buildNodeTransformState(
  session: StudioNodeTransformSession,
  requested: StudioModelNode,
  options: StudioNodeTransformOptions = {},
): StudioHierarchyState {
  return requested.type === 'cube'
    ? buildCubeTransform(session, requested, options)
    : buildGroupTransform(session, requested, options)
}

export function buildPivotState(
  session: StudioNodeTransformSession,
  pivot: StudioVector3,
): StudioHierarchyState {
  if (session.node.type === 'cube') {
    const cube = cloneStudioCube(session.before.elements[0]!)
    cube.pivot = { ...pivot }
    return { elements: [cube], groups: [] }
  }
  const group = cloneStudioGroup(session.before.groups[0]!)
  group.pivot = { ...pivot }
  return { elements: session.before.elements.map(cloneStudioCube), groups: [group] }
}

export function applyHierarchyState(model: StudioModel, state: StudioHierarchyState): void {
  for (const element of state.elements) {
    const index = model.elements.findIndex((entry) => entry.id === element.id)
    if (index >= 0) model.elements.splice(index, 1, cloneStudioCube(element))
  }
  for (const group of state.groups) {
    const index = model.groups.findIndex((entry) => entry.id === group.id)
    if (index >= 0) model.groups.splice(index, 1, cloneStudioGroup(group))
  }
}

export function snapValue(value: number, step: number | null): number {
  if (!step || step <= 0) return Math.round(value * 1000) / 1000
  return Math.round((value + Number.EPSILON) / step) * step
}

export function sanitizeGestureDelta(
  delta: number,
  tool: ModelManipulationTool,
  initialExtent: number,
  cameraDistance: number,
): number {
  if (!Number.isFinite(delta)) return 0
  if (tool === 'rotate') return Math.max(-1440, Math.min(1440, delta))
  const safeExtent = Math.max(MIN_CUBE_SIZE, Math.abs(initialExtent))
  const safeDistance = Number.isFinite(cameraDistance) ? Math.max(1, cameraDistance) : 1
  const limit = tool === 'scale'
    ? Math.max(32, safeExtent * 4, Math.min(128, safeDistance))
    : Math.max(512, safeExtent * 64, safeDistance * 8)
  return Math.max(-limit, Math.min(limit, delta))
}

/**
 * Rejects discontinuous browser pointer coordinates before they can enter the
 * world-space transform pipeline. Safari can occasionally report a single
 * coordinate jump after a view/zoom change; ordinary fast drags remain valid.
 */
export function isPointerStepContinuous(
  previous: { x: number; y: number; time: number },
  next: { x: number; y: number; time: number },
  viewportDiagonal: number,
): boolean {
  const values = [previous.x, previous.y, previous.time, next.x, next.y, next.time, viewportDiagonal]
  if (!values.every(Number.isFinite)) return false
  const diagonal = Math.max(1, viewportDiagonal)
  const elapsed = Math.max(0, next.time - previous.time)
  const distance = Math.hypot(next.x - previous.x, next.y - previous.y)
  const ordinaryFastDrag = Math.max(96, diagonal * 0.35)
  const delayedEventAllowance = Math.min(diagonal * 0.5, elapsed * 1.5)
  return distance <= ordinaryFastDrag + delayedEventAllowance
}

export function requestedAxisTransform(
  session: StudioNodeTransformSession,
  tool: ModelManipulationTool,
  axis: StudioAxis,
  delta: number,
  transformSnap: number | null,
  rotationSnap: number | null,
  options: Pick<StudioNodeTransformOptions, 'transformSpace'> = {},
): StudioModelNode {
  const requested = session.node.type === 'cube'
    ? cloneStudioCube(session.node)
    : cloneStudioGroup(session.node)
  const space = options.transformSpace ?? 'global'
  const basis = axisVectorForSpace(requested, session.parentRotation, space, axis)

  if (tool === 'pivot') {
    const snappedDelta = snapValue(delta, transformSnap)
    requested.pivot = addVector(requested.pivot, multiplyVector(basis, snappedDelta))
    return requested
  }
  if (tool === 'move') {
    const snappedDelta = snapValue(delta, transformSnap)
    requested.position = addVector(requested.position, multiplyVector(basis, snappedDelta))
  } else if (tool === 'rotate') {
    const snappedDelta = snapValue(delta, rotationSnap)
    requested.rotation = rotateEulerInSpace(
      requested.rotation,
      session.parentRotation,
      space,
      axis,
      snappedDelta,
    )
  } else if (requested.type === 'cube') {
    requested.size[axis] = Math.max(
      MIN_CUBE_SIZE,
      snapValue(requested.size[axis] + delta, transformSnap),
    )
  } else {
    const projected = projectedElementBounds(session.before.elements, basis)
    const extent = Math.max(MIN_CUBE_SIZE, projected?.extent ?? 1)
    requested.scale[axis] = Math.max(
      MIN_GROUP_SCALE,
      snapValue(requested.scale[axis] + delta / extent, transformSnap),
    )
  }
  return requested
}

export function buildAxisTransformState(
  session: StudioNodeTransformSession,
  tool: ModelManipulationTool,
  axis: StudioAxis,
  delta: number,
  transformSnap: number | null,
  rotationSnap: number | null,
  options: Pick<StudioNodeTransformOptions, 'resizeDirection' | 'transformSpace'> = {},
): StudioHierarchyState {
  const requested = requestedAxisTransform(
    session,
    tool,
    axis,
    delta,
    transformSnap,
    rotationSnap,
    options,
  )
  if (tool === 'pivot') return buildPivotState(session, requested.pivot)
  return buildNodeTransformState(session, requested, {
    operation: tool === 'scale' ? 'scale' : tool,
    axis,
    delta: tool === 'rotate' ? snapValue(delta, rotationSnap) : delta,
    resizeDirection: options.resizeDirection,
    transformSpace: options.transformSpace,
  })
}

export function mirroredRotation(rotation: StudioVector3, axis: StudioAxis): StudioVector3 {
  return mirrorEuler(rotation, axis)
}
