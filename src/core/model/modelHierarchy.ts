import type {
  ModelTransformTool,
  StudioCube,
  StudioGroup,
  StudioModel,
  StudioModelNode,
  StudioVector3,
} from '@/types/model'
import { createId } from '@/utils/createId'

import { cloneStudioCube, cloneStudioGroup } from './modelFactory'

export type StudioAxis = 'x' | 'y' | 'z'

export interface StudioHierarchyState {
  elements: StudioCube[]
  groups: StudioGroup[]
}

export interface StudioNodeTransformSession {
  targetId: string
  node: StudioModelNode
  before: StudioHierarchyState
}

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

export function groupBoundsCenter(elements: StudioCube[]): StudioVector3 {
  if (!elements.length) return { x: 0, y: 0, z: 0 }
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
  return {
    x: (minimum.x + maximum.x) / 2,
    y: (minimum.y + maximum.y) / 2,
    z: (minimum.z + maximum.z) / 2,
  }
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
  if (node.type === 'cube') {
    const cube = cloneStudioCube(node)
    return {
      targetId: node.id,
      node: cube,
      before: { elements: [cloneStudioCube(cube)], groups: [] },
    }
  }
  const group = cloneStudioGroup(node)
  return {
    targetId: node.id,
    node: group,
    before: {
      elements: getGroupChildren(model, node.id).map(cloneStudioCube),
      groups: [cloneStudioGroup(group)],
    },
  }
}

function rotatePoint(point: StudioVector3, pivot: StudioVector3, rotation: StudioVector3): StudioVector3 {
  let x = point.x - pivot.x
  let y = point.y - pivot.y
  let z = point.z - pivot.z

  const rx = rotation.x * Math.PI / 180
  const ry = rotation.y * Math.PI / 180
  const rz = rotation.z * Math.PI / 180

  if (rx) {
    const nextY = y * Math.cos(rx) - z * Math.sin(rx)
    z = y * Math.sin(rx) + z * Math.cos(rx)
    y = nextY
  }
  if (ry) {
    const nextX = x * Math.cos(ry) + z * Math.sin(ry)
    z = -x * Math.sin(ry) + z * Math.cos(ry)
    x = nextX
  }
  if (rz) {
    const nextX = x * Math.cos(rz) - y * Math.sin(rz)
    y = x * Math.sin(rz) + y * Math.cos(rz)
    x = nextX
  }

  return { x: x + pivot.x, y: y + pivot.y, z: z + pivot.z }
}

function addVector(target: StudioVector3, delta: StudioVector3): StudioVector3 {
  return { x: target.x + delta.x, y: target.y + delta.y, z: target.z + delta.z }
}

function subtractVector(after: StudioVector3, before: StudioVector3): StudioVector3 {
  return { x: after.x - before.x, y: after.y - before.y, z: after.z - before.z }
}

function scalePoint(point: StudioVector3, pivot: StudioVector3, scale: StudioVector3): StudioVector3 {
  return {
    x: pivot.x + (point.x - pivot.x) * scale.x,
    y: pivot.y + (point.y - pivot.y) * scale.y,
    z: pivot.z + (point.z - pivot.z) * scale.z,
  }
}

function transformedCube(
  source: StudioCube,
  translation: StudioVector3,
  rotation: StudioVector3,
  scale: StudioVector3,
  groupPivot: StudioVector3,
): StudioCube {
  const cube = cloneStudioCube(source)
  const movedPivot = addVector(groupPivot, translation)
  let center = addVector(elementCenter(source), translation)
  let pivot = addVector(source.pivot, translation)
  let defaultPivot = addVector(source.defaultPivot, translation)

  center = scalePoint(center, movedPivot, scale)
  pivot = scalePoint(pivot, movedPivot, scale)
  defaultPivot = scalePoint(defaultPivot, movedPivot, scale)
  cube.size = {
    x: Math.max(0.25, source.size.x * Math.abs(scale.x)),
    y: Math.max(0.25, source.size.y * Math.abs(scale.y)),
    z: Math.max(0.25, source.size.z * Math.abs(scale.z)),
  }

  center = rotatePoint(center, movedPivot, rotation)
  pivot = rotatePoint(pivot, movedPivot, rotation)
  defaultPivot = rotatePoint(defaultPivot, movedPivot, rotation)
  cube.position = {
    x: center.x - cube.size.x / 2,
    y: center.y - cube.size.y / 2,
    z: center.z - cube.size.z / 2,
  }
  cube.rotation = addVector(source.rotation, rotation)
  cube.pivot = pivot
  cube.defaultPivot = defaultPivot
  return cube
}

function buildCubeTransform(
  session: StudioNodeTransformSession,
  requested: StudioCube,
): StudioHierarchyState {
  const before = session.before.elements[0]!
  const after = cloneStudioCube(requested)
  const translation = subtractVector(after.position, before.position)
  const rotation = subtractVector(after.rotation, before.rotation)
  const movedPivot = addVector(before.pivot, translation)
  const sizeRatio = {
    x: after.size.x / Math.max(0.0001, before.size.x),
    y: after.size.y / Math.max(0.0001, before.size.y),
    z: after.size.z / Math.max(0.0001, before.size.z),
  }
  let movedDefaultPivot = {
    x: after.position.x + (before.defaultPivot.x - before.position.x) * sizeRatio.x,
    y: after.position.y + (before.defaultPivot.y - before.position.y) * sizeRatio.y,
    z: after.position.z + (before.defaultPivot.z - before.position.z) * sizeRatio.z,
  }
  let center = elementCenter(after)
  center = rotatePoint(center, movedPivot, rotation)
  movedDefaultPivot = rotatePoint(movedDefaultPivot, movedPivot, rotation)
  after.position = {
    x: center.x - after.size.x / 2,
    y: center.y - after.size.y / 2,
    z: center.z - after.size.z / 2,
  }
  after.pivot = movedPivot
  after.defaultPivot = movedDefaultPivot
  return { elements: [after], groups: [] }
}

function buildGroupTransform(
  session: StudioNodeTransformSession,
  requested: StudioGroup,
): StudioHierarchyState {
  const before = session.before.groups[0]!
  const after = cloneStudioGroup(requested)
  const translation = subtractVector(after.position, before.position)
  const rotation = subtractVector(after.rotation, before.rotation)
  const scale = {
    x: after.scale.x / Math.max(0.0001, before.scale.x),
    y: after.scale.y / Math.max(0.0001, before.scale.y),
    z: after.scale.z / Math.max(0.0001, before.scale.z),
  }
  after.pivot = addVector(before.pivot, translation)
  let defaultPivot = addVector(before.defaultPivot, translation)
  defaultPivot = scalePoint(defaultPivot, after.pivot, scale)
  after.defaultPivot = rotatePoint(defaultPivot, after.pivot, rotation)
  return {
    elements: session.before.elements.map((element) =>
      transformedCube(element, translation, rotation, scale, before.pivot),
    ),
    groups: [after],
  }
}

export function buildNodeTransformState(
  session: StudioNodeTransformSession,
  requested: StudioModelNode,
): StudioHierarchyState {
  return requested.type === 'cube'
    ? buildCubeTransform(session, requested)
    : buildGroupTransform(session, requested)
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

export function requestedAxisTransform(
  session: StudioNodeTransformSession,
  tool: Exclude<ModelTransformTool, 'select'>,
  axis: StudioAxis,
  delta: number,
  transformSnap: number | null,
  rotationSnap: number | null,
): StudioModelNode {
  const requested = session.node.type === 'cube'
    ? cloneStudioCube(session.node)
    : cloneStudioGroup(session.node)

  if (tool === 'pivot') {
    requested.pivot[axis] = snapValue(requested.pivot[axis] + delta, transformSnap)
    return requested
  }
  if (tool === 'move') {
    requested.position[axis] = snapValue(requested.position[axis] + delta, transformSnap)
  } else if (tool === 'rotate') {
    requested.rotation[axis] = snapValue(requested.rotation[axis] + delta, rotationSnap)
  } else if (requested.type === 'cube') {
    requested.size[axis] = Math.max(0.25, snapValue(requested.size[axis] + delta, transformSnap))
  } else {
    requested.scale[axis] = Math.max(0.05, snapValue(requested.scale[axis] + delta, transformSnap))
  }
  return requested
}
