import type {
  StudioCube,
  StudioGroup,
  StudioModel,
  StudioModelNode,
  StudioResizeDirection,
  StudioTransformSpace,
  StudioVector3,
} from '@/types/model'

import { cloneStudioCube, cloneStudioGroup, cloneStudioModel } from './modelFactory'
import {
  duplicateStudioCube,
  duplicateStudioGroup,
  elementCenter,
  getGroupChildren,
  getStudioNode,
  hierarchyBounds,
  isNodeEffectivelyLocked,
  mirroredRotation,
  snapValue,
  type StudioAxis,
  type StudioHierarchyState,
} from './modelHierarchy'
import {
  addVector,
  axisVectorForSpace,
  multiplyVector,
  rotateVectorEuler,
} from './modelMath'

export interface StudioSelectionTransformSession {
  selectedIds: string[]
  primaryId: string
  primary: StudioModelNode
  parentRotation: StudioVector3
  pivot: StudioVector3
  before: StudioHierarchyState
}

export interface StudioDuplicatedSelection {
  elements: StudioCube[]
  groups: StudioGroup[]
  selectedIds: string[]
}

export type StudioAlignment = 'min' | 'center' | 'max'

const ZERO: StudioVector3 = { x: 0, y: 0, z: 0 }

export function normalizeSelectionIds(model: StudioModel, ids: readonly string[]): string[] {
  const unique = [...new Set(ids)].filter((id) => Boolean(getStudioNode(model, id)))
  const selectedGroups = new Set(
    unique.filter((id) => model.groups.some((group) => group.id === id)),
  )
  return unique.filter((id) => {
    const cube = model.elements.find((element) => element.id === id)
    return !cube?.parentId || !selectedGroups.has(cube.parentId)
  })
}

export function selectionElements(model: StudioModel, ids: readonly string[]): StudioCube[] {
  const normalized = normalizeSelectionIds(model, ids)
  const elementIds = new Set<string>()
  for (const id of normalized) {
    const node = getStudioNode(model, id)
    if (!node) continue
    if (node.type === 'cube') elementIds.add(node.id)
    else getGroupChildren(model, node.id).forEach((element) => elementIds.add(element.id))
  }
  return model.elements.filter((element) => elementIds.has(element.id))
}

export function selectionGroups(model: StudioModel, ids: readonly string[]): StudioGroup[] {
  const selected = new Set(normalizeSelectionIds(model, ids))
  return model.groups.filter((group) => selected.has(group.id))
}

export function cubeBounds(cube: StudioCube): {
  minimum: StudioVector3
  maximum: StudioVector3
  center: StudioVector3
  size: StudioVector3
} {
  const center = elementCenter(cube)
  const localAxes = (['x', 'y', 'z'] as const).map((axis) =>
    rotateVectorEuler(
      { x: axis === 'x' ? 1 : 0, y: axis === 'y' ? 1 : 0, z: axis === 'z' ? 1 : 0 },
      cube.rotation,
    ),
  )
  const half = { x: cube.size.x / 2, y: cube.size.y / 2, z: cube.size.z / 2 }
  const extent = {
    x: Math.abs(localAxes[0]!.x) * half.x + Math.abs(localAxes[1]!.x) * half.y + Math.abs(localAxes[2]!.x) * half.z,
    y: Math.abs(localAxes[0]!.y) * half.x + Math.abs(localAxes[1]!.y) * half.y + Math.abs(localAxes[2]!.y) * half.z,
    z: Math.abs(localAxes[0]!.z) * half.x + Math.abs(localAxes[1]!.z) * half.y + Math.abs(localAxes[2]!.z) * half.z,
  }
  return {
    minimum: { x: center.x - extent.x, y: center.y - extent.y, z: center.z - extent.z },
    maximum: { x: center.x + extent.x, y: center.y + extent.y, z: center.z + extent.z },
    center,
    size: { x: extent.x * 2, y: extent.y * 2, z: extent.z * 2 },
  }
}

export function selectionBounds(model: StudioModel, ids: readonly string[]) {
  const elements = selectionElements(model, ids)
  if (!elements.length) return undefined
  const minimum = { x: Infinity, y: Infinity, z: Infinity }
  const maximum = { x: -Infinity, y: -Infinity, z: -Infinity }
  elements.forEach((cube) => {
    const bounds = cubeBounds(cube)
    ;(['x', 'y', 'z'] as const).forEach((axis) => {
      minimum[axis] = Math.min(minimum[axis], bounds.minimum[axis])
      maximum[axis] = Math.max(maximum[axis], bounds.maximum[axis])
    })
  })
  return {
    minimum,
    maximum,
    center: {
      x: (minimum.x + maximum.x) / 2,
      y: (minimum.y + maximum.y) / 2,
      z: (minimum.z + maximum.z) / 2,
    },
    size: {
      x: maximum.x - minimum.x,
      y: maximum.y - minimum.y,
      z: maximum.z - minimum.z,
    },
  }
}

export function selectionPivot(model: StudioModel, ids: readonly string[]): StudioVector3 {
  const normalized = normalizeSelectionIds(model, ids)
  if (normalized.length === 1) return { ...getStudioNode(model, normalized[0])!.pivot }
  return selectionBounds(model, normalized)?.center ?? { ...ZERO }
}

export function selectionModelingCenter(model: StudioModel, ids: readonly string[]): StudioVector3 {
  return selectionBounds(model, ids)?.center ?? { ...ZERO }
}

export function captureSelectionTransform(
  model: StudioModel,
  ids: readonly string[],
): StudioSelectionTransformSession | undefined {
  const selectedIds = normalizeSelectionIds(model, ids)
  const primaryId = selectedIds.at(-1)
  const primary = getStudioNode(model, primaryId)
  if (!primaryId || !primary) return undefined
  const parentRotation = primary.type === 'cube' && primary.parentId
    ? model.groups.find((group) => group.id === primary.parentId)?.rotation ?? ZERO
    : ZERO
  return {
    selectedIds,
    primaryId,
    primary: primary.type === 'cube' ? cloneStudioCube(primary) : cloneStudioGroup(primary),
    parentRotation: { ...parentRotation },
    pivot: selectionModelingCenter(model, selectedIds),
    before: {
      elements: selectionElements(model, selectedIds).map(cloneStudioCube),
      groups: selectionGroups(model, selectedIds).map(cloneStudioGroup),
    },
  }
}

function translateCube(cube: StudioCube, delta: StudioVector3): StudioCube {
  const moved = cloneStudioCube(cube)
  moved.position = addVector(moved.position, delta)
  moved.pivot = addVector(moved.pivot, delta)
  moved.defaultPivot = addVector(moved.defaultPivot, delta)
  return moved
}

function translateGroup(group: StudioGroup, delta: StudioVector3): StudioGroup {
  const moved = cloneStudioGroup(group)
  moved.position = addVector(moved.position, delta)
  moved.pivot = addVector(moved.pivot, delta)
  moved.defaultPivot = addVector(moved.defaultPivot, delta)
  return moved
}

export function buildSelectionTranslationState(
  session: StudioSelectionTransformSession,
  delta: StudioVector3,
): StudioHierarchyState {
  return {
    elements: session.before.elements.map((cube) => translateCube(cube, delta)),
    groups: session.before.groups.map((group) => translateGroup(group, delta)),
  }
}

export function selectionAxisVector(
  session: StudioSelectionTransformSession,
  space: StudioTransformSpace,
  axis: StudioAxis,
): StudioVector3 {
  // Multiple independently rotated nodes have no single Local frame.
  const effectiveSpace = session.selectedIds.length > 1 && space === 'local' ? 'global' : space
  return axisVectorForSpace(session.primary, session.parentRotation, effectiveSpace, axis)
}

export function buildSelectionAxisMoveState(
  session: StudioSelectionTransformSession,
  axis: StudioAxis,
  delta: number,
  snap: number | null,
  space: StudioTransformSpace,
): StudioHierarchyState {
  const direction = selectionAxisVector(session, space, axis)
  return buildSelectionTranslationState(session, multiplyVector(direction, snapValue(delta, snap)))
}

export function buildUniformResizeState(
  session: StudioSelectionTransformSession,
  delta: number,
  snap: number | null,
  direction: StudioResizeDirection,
): StudioHierarchyState {
  const bounds = hierarchyBounds(session.before.elements)
  if (!bounds) return session.before
  const baseExtent = Math.max(0.25, bounds.size.x, bounds.size.y, bounds.size.z)
  const nextExtent = Math.max(0.25, snapValue(baseExtent + delta, snap))
  const factor = nextExtent / baseExtent
  const anchor = direction === 'positive'
    ? bounds.minimum
    : direction === 'negative'
      ? bounds.maximum
      : bounds.center
  const resizePoint = (point: StudioVector3) => ({
    x: anchor.x + (point.x - anchor.x) * factor,
    y: anchor.y + (point.y - anchor.y) * factor,
    z: anchor.z + (point.z - anchor.z) * factor,
  })
  const directlySelectedCube = session.selectedIds.length === 1 && session.primary.type === 'cube'
  const directlySelectedGroup = session.selectedIds.length === 1 && session.primary.type === 'group'
  return {
    elements: session.before.elements.map((source) => {
      const cube = cloneStudioCube(source)
      const center = resizePoint(elementCenter(source))
      cube.size = {
        x: Math.max(0.25, source.size.x * factor),
        y: Math.max(0.25, source.size.y * factor),
        z: Math.max(0.25, source.size.z * factor),
      }
      cube.position = {
        x: center.x - cube.size.x / 2,
        y: center.y - cube.size.y / 2,
        z: center.z - cube.size.z / 2,
      }
      cube.pivot = directlySelectedCube
        ? { ...source.pivot }
        : resizePoint(source.pivot)
      cube.defaultPivot = resizePoint(source.defaultPivot)
      return cube
    }),
    groups: session.before.groups.map((source) => {
      const group = cloneStudioGroup(source)
      group.position = resizePoint(source.position)
      group.pivot = directlySelectedGroup ? { ...source.pivot } : resizePoint(source.pivot)
      group.defaultPivot = resizePoint(source.defaultPivot)
      group.scale = {
        x: source.scale.x * factor,
        y: source.scale.y * factor,
        z: source.scale.z * factor,
      }
      return group
    }),
  }
}

export function duplicateSelection(model: StudioModel, ids: readonly string[]): StudioDuplicatedSelection {
  const working = cloneStudioModel(model)
  const normalized = normalizeSelectionIds(model, ids)
  const elements: StudioCube[] = []
  const groups: StudioGroup[] = []
  const selectedIds: string[] = []
  for (const id of normalized) {
    const node = getStudioNode(working, id)
    if (!node) continue
    if (node.type === 'cube') {
      const duplicate = duplicateStudioCube(working, node)
      elements.push(duplicate)
      working.elements.push(cloneStudioCube(duplicate))
      selectedIds.push(duplicate.id)
    } else {
      const duplicate = duplicateStudioGroup(working, node)
      groups.push(duplicate.group)
      elements.push(...duplicate.elements)
      working.groups.push(cloneStudioGroup(duplicate.group))
      working.elements.push(...duplicate.elements.map(cloneStudioCube))
      selectedIds.push(duplicate.group.id)
    }
  }
  return { elements, groups, selectedIds }
}

function mirrorPoint(point: StudioVector3, plane: StudioVector3, axis: StudioAxis): StudioVector3 {
  return { ...point, [axis]: plane[axis] * 2 - point[axis] }
}

export function mirrorSelectionState(
  model: StudioModel,
  ids: readonly string[],
  axis: StudioAxis,
): { before: StudioHierarchyState; after: StudioHierarchyState } | undefined {
  const session = captureSelectionTransform(model, ids)
  if (!session) return undefined
  const plane = session.pivot
  const after = {
    elements: session.before.elements.map((source) => {
      const cube = cloneStudioCube(source)
      const center = mirrorPoint(elementCenter(source), plane, axis)
      cube.position = {
        x: center.x - cube.size.x / 2,
        y: center.y - cube.size.y / 2,
        z: center.z - cube.size.z / 2,
      }
      cube.pivot = mirrorPoint(source.pivot, plane, axis)
      cube.defaultPivot = mirrorPoint(source.defaultPivot, plane, axis)
      cube.rotation = mirroredRotation(source.rotation, axis)
      return cube
    }),
    groups: session.before.groups.map((source) => {
      const group = cloneStudioGroup(source)
      group.position = mirrorPoint(source.position, plane, axis)
      group.pivot = mirrorPoint(source.pivot, plane, axis)
      group.defaultPivot = mirrorPoint(source.defaultPivot, plane, axis)
      group.rotation = mirroredRotation(source.rotation, axis)
      return group
    }),
  }
  return { before: session.before, after }
}

export function duplicateAndMirrorSelection(
  model: StudioModel,
  ids: readonly string[],
  axis: StudioAxis,
): StudioDuplicatedSelection {
  const duplicated = duplicateSelection(model, ids)
  const temporary = cloneStudioModel(model)
  temporary.elements.push(...duplicated.elements.map(cloneStudioCube))
  temporary.groups.push(...duplicated.groups.map(cloneStudioGroup))
  const mirrored = mirrorSelectionState(temporary, duplicated.selectedIds, axis)
  if (!mirrored) return duplicated
  return {
    elements: mirrored.after.elements,
    groups: mirrored.after.groups,
    selectedIds: duplicated.selectedIds,
  }
}

export function alignSelectionState(
  model: StudioModel,
  ids: readonly string[],
  axis: StudioAxis,
  alignment: StudioAlignment,
): { before: StudioHierarchyState; after: StudioHierarchyState } | undefined {
  const cubes = selectionElements(model, ids)
  if (cubes.length < 2) return undefined
  const bounds = cubes.map(cubeBounds)
  const target = alignment === 'min'
    ? Math.min(...bounds.map((entry) => entry.minimum[axis]))
    : alignment === 'max'
      ? Math.max(...bounds.map((entry) => entry.maximum[axis]))
      : (Math.min(...bounds.map((entry) => entry.minimum[axis]))
        + Math.max(...bounds.map((entry) => entry.maximum[axis]))) / 2
  const after = cubes.map((cube, index) => {
    const source = bounds[index]!
    const current = alignment === 'min'
      ? source.minimum[axis]
      : alignment === 'max'
        ? source.maximum[axis]
        : source.center[axis]
    return translateCube(cube, { ...ZERO, [axis]: target - current })
  })
  return { before: { elements: cubes.map(cloneStudioCube), groups: [] }, after: { elements: after, groups: [] } }
}

export function distributeSelectionState(
  model: StudioModel,
  ids: readonly string[],
  axis: StudioAxis,
): { before: StudioHierarchyState; after: StudioHierarchyState } | undefined {
  const cubes = selectionElements(model, ids)
  if (cubes.length < 3) return undefined
  const entries = cubes
    .map((cube) => ({ cube, bounds: cubeBounds(cube) }))
    .sort((a, b) => a.bounds.minimum[axis] - b.bounds.minimum[axis])
  const first = entries[0]!
  const last = entries.at(-1)!
  const totalSize = entries.reduce((sum, entry) => sum + entry.bounds.size[axis], 0)
  const available = last.bounds.maximum[axis] - first.bounds.minimum[axis]
  const gap = (available - totalSize) / (entries.length - 1)
  let cursor = first.bounds.minimum[axis]
  const moved = new Map<string, StudioCube>()
  entries.forEach((entry, index) => {
    const targetMinimum = index === 0 ? entry.bounds.minimum[axis] : cursor
    moved.set(entry.cube.id, translateCube(entry.cube, {
      ...ZERO,
      [axis]: targetMinimum - entry.bounds.minimum[axis],
    }))
    cursor = targetMinimum + entry.bounds.size[axis] + gap
  })
  return {
    before: { elements: cubes.map(cloneStudioCube), groups: [] },
    after: { elements: cubes.map((cube) => moved.get(cube.id)!), groups: [] },
  }
}

export function lockSelectionState(
  model: StudioModel,
  ids: readonly string[],
  locked: boolean,
): { before: StudioHierarchyState; after: StudioHierarchyState } | undefined {
  const normalized = normalizeSelectionIds(model, ids)
  if (!normalized.length) return undefined
  const elements = normalized
    .map((id) => model.elements.find((cube) => cube.id === id))
    .filter((cube): cube is StudioCube => Boolean(cube))
  const groups = normalized
    .map((id) => model.groups.find((group) => group.id === id))
    .filter((group): group is StudioGroup => Boolean(group))
  return {
    before: { elements: elements.map(cloneStudioCube), groups: groups.map(cloneStudioGroup) },
    after: {
      elements: elements.map((cube) => ({ ...cloneStudioCube(cube), locked })),
      groups: groups.map((group) => ({ ...cloneStudioGroup(group), locked })),
    },
  }
}

export function visibilitySelectionState(
  model: StudioModel,
  ids: readonly string[],
  visible: boolean,
): { before: StudioHierarchyState; after: StudioHierarchyState } | undefined {
  const normalized = normalizeSelectionIds(model, ids)
  if (!normalized.length) return undefined
  const elements = normalized
    .map((id) => model.elements.find((cube) => cube.id === id))
    .filter((cube): cube is StudioCube => Boolean(cube))
  const groups = normalized
    .map((id) => model.groups.find((group) => group.id === id))
    .filter((group): group is StudioGroup => Boolean(group))
  return {
    before: { elements: elements.map(cloneStudioCube), groups: groups.map(cloneStudioGroup) },
    after: {
      elements: elements.map((cube) => ({ ...cloneStudioCube(cube), visible })),
      groups: groups.map((group) => ({ ...cloneStudioGroup(group), visible })),
    },
  }
}

export function isolatedElementIds(model: StudioModel, ids: readonly string[]): string[] {
  return selectionElements(model, ids).map((cube) => cube.id)
}

export function selectionCanTransform(model: StudioModel, ids: readonly string[]): boolean {
  const nodes = normalizeSelectionIds(model, ids)
    .map((id) => getStudioNode(model, id))
    .filter((node): node is StudioModelNode => Boolean(node))
  return nodes.length > 0 && nodes.every((node) => !isNodeEffectivelyLocked(model, node))
}
