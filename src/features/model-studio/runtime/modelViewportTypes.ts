import type { StudioHierarchyState, StudioNodeTransformSession, StudioAxis } from '@/core/model/modelHierarchy'
import type { StudioSelectionTransformSession } from '@/core/model/modelProductivity'
import type { ModelManipulationTool, StudioVector3 } from '@/types/model'

export type ThreeModule = typeof import('three')
export type Axis = StudioAxis

export interface AxisProjection {
  x: number
  y: number
  worldPerPixel: number
}

export interface DragState {
  pointerId: number
  axis: Axis
  tool: ModelManipulationTool
  startX: number
  startY: number
  session: StudioNodeTransformSession | StudioSelectionTransformSession
  latest: StudioHierarchyState
  projection: AxisProjection
  cameraDistance: number
  initialExtent: number
  lastX: number
  lastY: number
  lastTime: number
}

export interface DirectTouchState {
  pointerId: number
  mode: 'move' | 'scale' | 'rotate'
  startX: number
  startY: number
  startRadius: number
  startAngle: number
  pivotScreen: { x: number; y: number }
  right: StudioVector3
  up: StudioVector3
  worldPerPixel: number
  cameraDistance: number
  initialExtent: number
  rotationAxis: Axis
  selectionSession: StudioSelectionTransformSession
  nodeSession?: StudioNodeTransformSession
  latest: StudioHierarchyState
  active: boolean
  timer: ReturnType<typeof setTimeout>
  lastX: number
  lastY: number
  lastTime: number
}

export interface EmptyPointerState {
  id: number
  x: number
  y: number
}
