import type { Group, Object3D, PerspectiveCamera, WebGLRenderer } from 'three'

import {
  inflateHandlesForCube,
  type StudioInflateHandle,
} from '@/core/model/modelInflate'
import {
  isNodeEffectivelyLocked,
  isNodeEffectivelyVisible,
} from '@/core/model/modelHierarchy'
import type { StudioCube, StudioModel } from '@/types/model'
import type { ThreeModule } from './modelViewportTypes'
import { worldPerPixelFromDistance } from './viewportMath'
import { disposeObject } from './viewportResources'

export interface InflateRuntimeResult {
  pickers: Object3D[]
}

export function updateInflateHandleScale(
  group: Group,
  camera: PerspectiveCamera,
  renderer: WebGLRenderer,
): void {
  if (!group.visible) return
  const height = Math.max(1, renderer.domElement.clientHeight)
  for (const object of group.children) {
    const distance = camera.position.distanceTo(object.position)
    const worldPerPixel = worldPerPixelFromDistance(distance, camera.fov, height)
    object.scale.setScalar(worldPerPixel * Number(object.userData.handlePixels ?? 6))
  }
}

export function rebuildInflateRuntime(options: {
  three: ThreeModule
  group: Group
  model: StudioModel
  source?: StudioInflateHandle
  targetCubeId?: string
  selectedCube?: StudioCube
  toolActive: boolean
}): InflateRuntimeResult {
  const { three, group, model, source, targetCubeId, selectedCube, toolActive } = options
  for (const child of [...group.children]) {
    group.remove(child)
    disposeObject(child)
  }

  const pickers: Object3D[] = []
  group.visible = toolActive
  if (!group.visible) return { pickers }

  let handleCube: StudioCube | undefined
  if (source) {
    const sourceCube = model.elements.find((cube) => cube.id === source.cubeId)
    if (sourceCube) {
      const marker = new three.Mesh(
        new three.SphereGeometry(1, 12, 8),
        new three.MeshBasicMaterial({ color: 0xf4cf58, depthTest: false }),
      )
      marker.position.set(source.point.x, source.point.y, source.point.z)
      marker.userData.handlePixels = 7
      marker.renderOrder = 30
      group.add(marker)
    }
    handleCube = model.elements.find((cube) => cube.id === targetCubeId)
  } else {
    handleCube = selectedCube
  }

  if (!handleCube
    || !isNodeEffectivelyVisible(model, handleCube)
    || isNodeEffectivelyLocked(model, handleCube)) {
    return { pickers }
  }

  for (const handle of inflateHandlesForCube(handleCube)) {
    const visible = new three.Mesh(
      new three.SphereGeometry(1, 10, 7),
      new three.MeshBasicMaterial({ color: source ? 0x62c7ff : 0xf4cf58, depthTest: false }),
    )
    visible.position.set(handle.point.x, handle.point.y, handle.point.z)
    visible.userData.handlePixels = handle.kind === 'corner' ? 5.5 : 4.5
    visible.renderOrder = 29
    group.add(visible)

    const picker = new three.Mesh(
      new three.SphereGeometry(1, 8, 6),
      new three.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
      }),
    )
    picker.position.copy(visible.position)
    picker.userData.handlePixels = 18
    picker.userData.inflateHandle = handle
    picker.renderOrder = 31
    group.add(picker)
    pickers.push(picker)
  }

  return { pickers }
}
