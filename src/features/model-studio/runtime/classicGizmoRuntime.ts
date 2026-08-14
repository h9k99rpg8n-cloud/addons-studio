import type {
  Group,
  Object3D,
  PerspectiveCamera,
  WebGLRenderer,
} from 'three'

import type { ModelTransformTool } from '@/types/model'
import { AXIS_COLORS, gizmoScaleForPixels, worldPerPixelFromDistance } from './viewportMath'
import type { Axis, ThreeModule } from './modelViewportTypes'
import { disposeObject } from './viewportResources'

function setAxisPosition(object: Object3D, axis: Axis, value: number): void {
  object.position.set(axis === 'x' ? value : 0, axis === 'y' ? value : 0, axis === 'z' ? value : 0)
}

function orientCylinder(object: Object3D, axis: Axis): void {
  if (axis === 'x') object.rotation.z = -Math.PI / 2
  if (axis === 'z') object.rotation.x = Math.PI / 2
}

function pickerMaterial(three: ThreeModule) {
  return new three.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
  })
}

export function rebuildClassicGizmo(
  three: ThreeModule,
  gizmoGroup: Group,
  tool: ModelTransformTool,
): Object3D[] {
  for (const child of [...gizmoGroup.children]) {
    gizmoGroup.remove(child)
    disposeObject(child)
  }

  const pickers: Object3D[] = []
  if (!gizmoGroup.visible || tool === 'select' || tool === 'inflate') return pickers

  const axes: Axis[] = ['x', 'y', 'z']
  for (const axis of axes) {
    const visibleMaterial = new three.MeshBasicMaterial({
      color: AXIS_COLORS[axis],
      depthTest: false,
    })

    if (tool === 'rotate') {
      const ring = new three.Mesh(new three.TorusGeometry(0.78, 0.018, 8, 48), visibleMaterial)
      const picker = new three.Mesh(new three.TorusGeometry(0.78, 0.115, 8, 32), pickerMaterial(three))
      if (axis === 'x') {
        ring.rotation.y = Math.PI / 2
        picker.rotation.y = Math.PI / 2
      }
      if (axis === 'y') {
        ring.rotation.x = Math.PI / 2
        picker.rotation.x = Math.PI / 2
      }
      picker.userData.gizmoAxis = axis
      ring.renderOrder = 20
      picker.renderOrder = 21
      gizmoGroup.add(ring, picker)
      pickers.push(picker)
      continue
    }

    const stem = new three.Mesh(new three.CylinderGeometry(0.022, 0.022, 0.72, 8), visibleMaterial)
    setAxisPosition(stem, axis, 0.36)
    orientCylinder(stem, axis)
    stem.renderOrder = 20
    gizmoGroup.add(stem)

    const endpoint = tool === 'move'
      ? new three.Mesh(new three.ConeGeometry(0.09, 0.22, 12), visibleMaterial)
      : tool === 'pivot'
        ? new three.Mesh(
            new three.OctahedronGeometry(0.13),
            new three.MeshBasicMaterial({ color: 0xf4cf58, depthTest: false }),
          )
        : new three.Mesh(new three.BoxGeometry(0.15, 0.15, 0.15), visibleMaterial)
    setAxisPosition(endpoint, axis, 0.82)
    if (tool === 'move') orientCylinder(endpoint, axis)
    endpoint.renderOrder = 20
    gizmoGroup.add(endpoint)

    const picker = new three.Mesh(
      new three.CylinderGeometry(0.15, 0.15, 1.05, 8),
      pickerMaterial(three),
    )
    setAxisPosition(picker, axis, 0.5)
    orientCylinder(picker, axis)
    picker.userData.gizmoAxis = axis
    picker.renderOrder = 21
    gizmoGroup.add(picker)
    pickers.push(picker)
  }

  return pickers
}

export function updateClassicGizmoScale(
  gizmoGroup: Group,
  camera: PerspectiveCamera,
  renderer: WebGLRenderer,
): void {
  if (!gizmoGroup.visible) return
  const distance = camera.position.distanceTo(gizmoGroup.position)
  const worldPerPixel = worldPerPixelFromDistance(
    distance,
    camera.fov,
    renderer.domElement.clientHeight,
  )
  gizmoGroup.scale.setScalar(gizmoScaleForPixels(worldPerPixel))
}
