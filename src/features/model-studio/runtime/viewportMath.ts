import type { StudioCameraView, StudioTouchNavigationProfile } from '@/types/model'
import type { Axis } from './modelViewportTypes'

export const TOUCH_DEADZONE_PX = 8
export const TOUCH_HOLD_MS = 220

export const AXIS_COLORS: Readonly<Record<Axis, number>> = {
  x: 0xf05d68,
  y: 0x4fd178,
  z: 0x4f9ff5,
}

export function worldPerPixelFromDistance(
  distance: number,
  fovDegrees: number,
  viewportHeight: number,
): number {
  const safeHeight = Math.max(1, viewportHeight)
  return (2 * distance * Math.tan((fovDegrees * Math.PI) / 360)) / safeHeight
}

export function stablePreviewMaterialIndex(id: string, count: number): number {
  let hash = 0
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) | 0
  }
  return Math.abs(hash) % Math.max(1, count)
}

export function movedBeyondDeadzone(
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
  threshold = TOUCH_DEADZONE_PX,
): boolean {
  return Math.hypot(currentX - startX, currentY - startY) > threshold
}

export function cameraProfileFactors(profile: StudioTouchNavigationProfile): {
  orbit: number
  pan: number
} {
  if (profile === 'one-finger') return { orbit: 1.12, pan: 1 }
  if (profile === 'two-finger') return { orbit: 0.86, pan: 1.15 }
  return { orbit: 1, pan: 1 }
}

export function cameraViewOffset(
  view: StudioCameraView,
  distance = 78,
): [number, number, number] {
  const positions: Record<StudioCameraView, [number, number, number]> = {
    perspective: [distance, distance * 0.65, distance],
    isometric: [distance, distance, distance],
    front: [0, 0, distance],
    back: [0, 0, -distance],
    left: [-distance, 0, 0],
    right: [distance, 0, 0],
    top: [0, distance, 0.001],
    bottom: [0, -distance, 0.001],
  }
  return positions[view]
}

export function normalizeAngleDelta(degrees: number): number {
  if (degrees > 180) return degrees - 360
  if (degrees < -180) return degrees + 360
  return degrees
}

export function gizmoScaleForPixels(worldPerPixel: number, targetPixels = 74): number {
  return Math.max(0.8, Math.min(12, worldPerPixel * targetPixels))
}
