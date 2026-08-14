import {
  buildAxisTransformState,
  sanitizeGestureDelta,
} from '@/core/model/modelHierarchy'
import { buildSelectionAxisMoveState } from '@/core/model/modelProductivity'
import type { StudioResizeDirection, StudioTransformSpace } from '@/types/model'
import type { DragState } from './modelViewportTypes'

export function updateClassicDrag(
  state: DragState,
  event: PointerEvent,
  options: {
    transformSnap: number | null
    resizeSnap: number | null
    rotationSnap: number | null
    resizeDirection: StudioResizeDirection
    transformSpace: StudioTransformSpace
  },
) {
  const dx = event.clientX - state.startX
  const dy = event.clientY - state.startY
  let delta: number
  if (state.tool === 'rotate') {
    delta = (dx - dy) * 0.65
  } else {
    const pixels = dx * state.projection.x + dy * state.projection.y
    delta = pixels * state.projection.worldPerPixel
  }
  delta = sanitizeGestureDelta(
    delta,
    state.tool,
    state.initialExtent,
    state.cameraDistance,
  )

  const latest = 'targetId' in state.session
    ? buildAxisTransformState(
        state.session,
        state.tool,
        state.axis,
        delta,
        state.tool === 'scale' ? options.resizeSnap ?? options.transformSnap : options.transformSnap,
        options.rotationSnap,
        {
          resizeDirection: options.resizeDirection,
          transformSpace: options.transformSpace,
        },
      )
    : buildSelectionAxisMoveState(
        state.session,
        state.axis,
        delta,
        options.transformSnap,
        options.transformSpace,
      )

  state.latest = latest
  return latest
}
