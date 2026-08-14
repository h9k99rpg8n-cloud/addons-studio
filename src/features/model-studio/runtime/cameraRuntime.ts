import type { PerspectiveCamera, WebGLRenderer } from 'three'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'

import type { StudioCameraSettings, StudioCameraView, StudioVector3 } from '@/types/model'
import { cameraProfileFactors, cameraViewOffset } from './viewportMath'

export function applyStudioCameraSettings(
  controls: OrbitControls,
  settings: StudioCameraSettings,
): void {
  const factors = cameraProfileFactors(settings.profile)
  controls.rotateSpeed = settings.orbitSensitivity * factors.orbit
  controls.panSpeed = settings.panSensitivity * factors.pan
  controls.zoomSpeed = settings.zoomSensitivity
}

export function applyStudioCameraView(
  camera: PerspectiveCamera,
  controls: OrbitControls,
  view: StudioCameraView,
  target: StudioVector3,
): void {
  controls.target.set(target.x, target.y, target.z)
  const [x, y, z] = cameraViewOffset(view)
  camera.up.set(0, 1, 0)
  if (view === 'top') camera.up.set(0, 0, -1)
  if (view === 'bottom') camera.up.set(0, 0, 1)
  camera.position.set(target.x + x, target.y + y, target.z + z)
  camera.lookAt(controls.target)
  controls.update()
}

export function resizeStudioRenderer(
  container: HTMLElement,
  renderer: WebGLRenderer,
  camera: PerspectiveCamera,
  lowPower = false,
): void {
  const width = Math.max(1, container.clientWidth)
  const height = Math.max(1, container.clientHeight)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, lowPower ? 1 : 1.75))
  renderer.setSize(width, height, false)
}
