import type { PerspectiveCamera, WebGLRenderer } from 'three'

import {
  buildAxisTransformState,
  sanitizeGestureDelta,
  snapValue,
} from '@/core/model/modelHierarchy'
import {
  buildSelectionTranslationState,
  buildUniformResizeState,
} from '@/core/model/modelProductivity'
import type { StudioResizeDirection, StudioTransformSpace } from '@/types/model'
import type { DirectTouchState } from './modelViewportTypes'
import { normalizeAngleDelta } from './viewportMath'

export interface DirectTouchUpdateOptions {
  transformSnap: number | null
  resizeSnap: number | null
  rotationSnap: number | null
  resizeDirection: StudioResizeDirection
  transformSpace: StudioTransformSpace
}

export interface DirectTouchUpdateResult {
  label: string
  changed: boolean
}

export function updateDirectTouchGesture(
  state: DirectTouchState,
  event: PointerEvent,
  options: DirectTouchUpdateOptions,
): DirectTouchUpdateResult {
  const dx = event.clientX - state.startX
  const dy = event.clientY - state.startY

  if (state.mode === 'move') {
    const raw = {
      x: (state.right.x * dx - state.up.x * dy) * state.worldPerPixel,
      y: (state.right.y * dx - state.up.y * dy) * state.worldPerPixel,
      z: (state.right.z * dx - state.up.z * dy) * state.worldPerPixel,
    }
    const rawLength = Math.hypot(raw.x, raw.y, raw.z)
    const safeLength = sanitizeGestureDelta(
      rawLength,
      'move',
      state.initialExtent,
      state.cameraDistance,
    )
    const safeFactor = rawLength > 0 ? safeLength / rawLength : 0
    const delta = {
      x: snapValue(raw.x * safeFactor, options.transformSnap),
      y: snapValue(raw.y * safeFactor, options.transformSnap),
      z: snapValue(raw.z * safeFactor, options.transformSnap),
    }
    state.latest = buildSelectionTranslationState(state.selectionSession, delta)
    return {
      label: `Move ${delta.x.toFixed(2)}, ${delta.y.toFixed(2)}, ${delta.z.toFixed(2)}`,
      changed: true,
    }
  }

  if (state.mode === 'scale') {
    const radius = Math.hypot(
      event.clientX - state.pivotScreen.x,
      event.clientY - state.pivotScreen.y,
    )
    const rawDelta = (radius - state.startRadius) * state.worldPerPixel
    const delta = sanitizeGestureDelta(
      rawDelta,
      'scale',
      state.initialExtent,
      state.cameraDistance,
    )
    state.latest = buildUniformResizeState(
      state.selectionSession,
      delta,
      options.resizeSnap ?? options.transformSnap,
      options.resizeDirection,
    )
    return {
      label: `Uniform Resize ${delta >= 0 ? '+' : ''}${delta.toFixed(2)}`,
      changed: true,
    }
  }

  if (!state.nodeSession) return { label: '', changed: false }

  const angle = Math.atan2(
    event.clientY - state.pivotScreen.y,
    event.clientX - state.pivotScreen.x,
  )
  let degrees = normalizeAngleDelta((angle - state.startAngle) * 180 / Math.PI)
  degrees = sanitizeGestureDelta(
    degrees,
    'rotate',
    state.initialExtent,
    state.cameraDistance,
  )
  state.latest = buildAxisTransformState(
    state.nodeSession,
    'rotate',
    state.rotationAxis,
    degrees,
    options.transformSnap,
    options.rotationSnap,
    {
      transformSpace: options.transformSpace,
      resizeDirection: options.resizeDirection,
    },
  )
  return {
    label: `Rotate ${state.rotationAxis.toUpperCase()} ${snapValue(degrees, options.rotationSnap).toFixed(1)}°`,
    changed: true,
  }
}

export function worldPerPixelForTouch(
  camera: PerspectiveCamera,
  renderer: WebGLRenderer,
  target: { x: number; y: number; z: number },
): { distance: number; worldPerPixel: number } {
  const dx = camera.position.x - target.x
  const dy = camera.position.y - target.y
  const dz = camera.position.z - target.z
  const distance = Math.hypot(dx, dy, dz)
  const height = Math.max(1, renderer.domElement.clientHeight)
  const worldPerPixel = (2 * distance * Math.tan((camera.fov * Math.PI) / 360)) / height
  return { distance, worldPerPixel }
}
