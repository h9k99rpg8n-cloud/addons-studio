import type {
  BoxGeometry,
  Group,
  Material,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Raycaster,
  Scene,
  WebGLRenderer,
} from 'three'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'

import type { StudioCameraSettings } from '@/types/model'
import { applyStudioCameraSettings } from './cameraRuntime'
import type { ThreeModule } from './modelViewportTypes'
import {
  createStudioPreviewMaterials,
  disposeObject,
  disposeStudioPreviewMaterials,
  type StudioPreviewMaterialSet,
} from './viewportResources'

export interface StudioThreeSceneRuntime {
  three: ThreeModule
  scene: Scene
  camera: PerspectiveCamera
  renderer: WebGLRenderer
  controls: OrbitControls
  raycaster: Raycaster
  gizmoGroup: Group
  environmentGroup: Group
  inflateGroup: Group
  selectionMesh: Mesh<BoxGeometry, MeshBasicMaterial>
  previewMaterials: StudioPreviewMaterialSet
}

export async function createStudioThreeSceneRuntime(options: {
  container: HTMLElement
  lowPower?: boolean
  cameraSettings: StudioCameraSettings
}): Promise<StudioThreeSceneRuntime> {
  const [three, controlsModule] = await Promise.all([
    import('three'),
    import('three/addons/controls/OrbitControls.js'),
  ])

  const scene = new three.Scene()
  scene.background = null

  const camera = new three.PerspectiveCamera(42, 1, 0.1, 2000)
  camera.position.set(54, 42, 54)

  const renderer = new three.WebGLRenderer({
    antialias: !options.lowPower,
    alpha: true,
    powerPreference: options.lowPower ? 'low-power' : 'high-performance',
  })
  renderer.outputColorSpace = three.SRGBColorSpace
  renderer.setClearColor(0x000000, 0)
  renderer.shadowMap.enabled = !options.lowPower
  renderer.shadowMap.type = three.PCFSoftShadowMap
  renderer.domElement.className = 'model-canvas'
  renderer.domElement.setAttribute('aria-label', 'Interactive 3D model viewport')
  renderer.domElement.style.touchAction = 'none'
  options.container.append(renderer.domElement)

  const controls = new controlsModule.OrbitControls(camera, renderer.domElement)
  controls.target.set(8, 8, 8)
  controls.enableDamping = false
  controls.screenSpacePanning = true
  controls.minDistance = 8
  controls.maxDistance = 420
  controls.touches.ONE = three.TOUCH.ROTATE
  controls.touches.TWO = three.TOUCH.DOLLY_PAN
  controls.enabled = true
  applyStudioCameraSettings(controls, options.cameraSettings)
  controls.update()

  const environmentGroup = new three.Group()
  environmentGroup.add(new three.HemisphereLight(0xd9efff, 0x253129, 1.45))
  const keyLight = new three.DirectionalLight(0xffffff, 2.1)
  keyLight.position.set(45, 70, 35)
  keyLight.castShadow = !options.lowPower
  environmentGroup.add(keyLight)

  const minorGrid = new three.GridHelper(256, 64, 0x2b553b, 0x1c2b22)
  const majorGrid = new three.GridHelper(256, 16, 0x4ab66c, 0x294134)
  const minorMaterial = minorGrid.material as Material
  const majorMaterial = majorGrid.material as Material
  minorMaterial.opacity = 0.55
  minorMaterial.transparent = true
  majorMaterial.opacity = 0.85
  majorMaterial.transparent = true
  environmentGroup.add(minorGrid, majorGrid, new three.AxesHelper(12))
  scene.add(environmentGroup)

  const inflateGroup = new three.Group()
  inflateGroup.visible = false
  scene.add(inflateGroup)

  const previewMaterials = createStudioPreviewMaterials(three)
  const selectionMesh = new three.Mesh(
    new three.BoxGeometry(1, 1, 1),
    new three.MeshBasicMaterial({
      color: 0xf4cf58,
      wireframe: true,
      depthTest: false,
      transparent: true,
      opacity: 1,
    }),
  )
  selectionMesh.renderOrder = 15
  selectionMesh.visible = false
  scene.add(selectionMesh)

  const gizmoGroup = new three.Group()
  gizmoGroup.visible = false
  scene.add(gizmoGroup)

  return {
    three,
    scene,
    camera,
    renderer,
    controls,
    raycaster: new three.Raycaster(),
    gizmoGroup,
    environmentGroup,
    inflateGroup,
    selectionMesh,
    previewMaterials,
  }
}

export function disposeStudioThreeSceneRuntime(runtime: StudioThreeSceneRuntime): void {
  runtime.controls.dispose()
  runtime.selectionMesh.geometry.dispose()
  runtime.selectionMesh.material.dispose()
  disposeObject(runtime.gizmoGroup)
  disposeObject(runtime.inflateGroup)
  disposeObject(runtime.environmentGroup)
  disposeStudioPreviewMaterials(runtime.previewMaterials)
  runtime.renderer.dispose()
  runtime.renderer.domElement.remove()
}
