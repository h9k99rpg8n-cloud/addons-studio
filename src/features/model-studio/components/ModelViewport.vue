<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type {
  BoxGeometry,
  Group,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Texture,
  WebGLRenderer,
} from 'three'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'

import type {
  ModelReferenceAsset,
  ModelTransformTool,
  StudioCube,
  StudioCameraView,
  StudioModel,
  StudioModelNode,
} from '@/types/model'
import {
  buildPivotState,
  buildNodeTransformState,
  captureNodeTransform,
  elementCenter,
  getGroupChildren,
  getStudioNode,
  isNodeEffectivelyVisible,
  requestedAxisTransform,
  type StudioAxis,
  type StudioHierarchyState,
  type StudioNodeTransformSession,
} from '@/core/model/modelHierarchy'

const loadThree = () => import('three')
type ThreeModule = Awaited<ReturnType<typeof loadThree>>
type Axis = StudioAxis

interface DragState {
  pointerId: number
  axis: Axis
  startX: number
  startY: number
  session: StudioNodeTransformSession
  latest: StudioHierarchyState
}

interface ReferenceMeshRecord {
  mesh: Mesh
  texture: Texture
  url: string
  assetId: string
}

const props = defineProps<{
  model: StudioModel
  assets: ModelReferenceAsset[]
  selectedNodeId?: string
  selectedReferenceId?: string
  tool: ModelTransformTool
  view: StudioCameraView
  active?: boolean
  lowPower?: boolean
  maximized?: boolean
  canMaximize?: boolean
  transformSnap: number | null
  rotationSnap: number | null
}>()

const emit = defineEmits<{
  selectNode: [id?: string]
  selectReference: [id?: string]
  previewHierarchy: [state: StudioHierarchyState]
  commitHierarchy: [payload: { before: StudioHierarchyState; after: StudioHierarchyState; label: string }]
  activate: []
  toggleMaximize: []
  cameraNavigated: []
  error: [message: string]
}>()

const container = ref<HTMLDivElement>()
const webglError = ref('')
const liveTransform = ref('')

let three: ThreeModule | undefined
let scene: Scene | undefined
let camera: PerspectiveCamera | undefined
let renderer: WebGLRenderer | undefined
let controls: OrbitControls | undefined
let raycaster: Raycaster | undefined
let gizmoGroup: Group | undefined
let environmentGroup: Group | undefined
let selectionMesh: Mesh<BoxGeometry, MeshBasicMaterial> | undefined
let cubeMaterial: MeshStandardMaterial | undefined
let resizeObserver: ResizeObserver | undefined
let drag: DragState | undefined
let gizmoTool: ModelTransformTool | undefined
let emptyPointer: { id: number; x: number; y: number } | undefined

const cubeMeshes = new Map<string, Mesh<BoxGeometry, MeshStandardMaterial>>()
const referenceMeshes = new Map<string, ReferenceMeshRecord>()
const gizmoPickers: Object3D[] = []

const axisColors: Record<Axis, number> = {
  x: 0xf05d68,
  y: 0x4fd178,
  z: 0x4f9ff5,
}

function selectedNode(): StudioModelNode | undefined {
  return getStudioNode(props.model, props.selectedNodeId)
}

function nodeBounds(node: StudioModelNode): { center: { x: number; y: number; z: number }; size: { x: number; y: number; z: number } } {
  if (node.type === 'cube') return { center: elementCenter(node), size: node.size }
  const children = getGroupChildren(props.model, node.id)
  if (!children.length) return { center: node.pivot, size: { x: 1, y: 1, z: 1 } }
  const minimum = { x: Infinity, y: Infinity, z: Infinity }
  const maximum = { x: -Infinity, y: -Infinity, z: -Infinity }
  children.forEach((child) => {
    minimum.x = Math.min(minimum.x, child.position.x)
    minimum.y = Math.min(minimum.y, child.position.y)
    minimum.z = Math.min(minimum.z, child.position.z)
    maximum.x = Math.max(maximum.x, child.position.x + child.size.x)
    maximum.y = Math.max(maximum.y, child.position.y + child.size.y)
    maximum.z = Math.max(maximum.z, child.position.z + child.size.z)
  })
  return {
    center: {
      x: (minimum.x + maximum.x) / 2,
      y: (minimum.y + maximum.y) / 2,
      z: (minimum.z + maximum.z) / 2,
    },
    size: {
      x: Math.max(0.5, maximum.x - minimum.x),
      y: Math.max(0.5, maximum.y - minimum.y),
      z: Math.max(0.5, maximum.z - minimum.z),
    },
  }
}

function disposeMaterial(material: Material | Material[]): void {
  if (Array.isArray(material)) material.forEach((entry) => entry.dispose())
  else material.dispose()
}

function disposeObject(object: Object3D): void {
  object.traverse((child) => {
    const mesh = child as Mesh
    mesh.geometry?.dispose()
    if (mesh.material) disposeMaterial(mesh.material)
  })
}

function renderScene(): void {
  if (!renderer || !scene || !camera) return
  updateGizmoScale()
  renderer.render(scene, camera)
}

function onControlsEnd(): void {
  if (!drag) emit('cameraNavigated')
}

function resize(): void {
  if (!container.value || !renderer || !camera) return
  const width = Math.max(1, container.value.clientWidth)
  const height = Math.max(1, container.value.clientHeight)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, props.lowPower ? 1 : 1.75))
  renderer.setSize(width, height, false)
  renderScene()
}

function applyElementToMesh(element: StudioCube, mesh: Mesh): void {
  if (!three) return
  const center = elementCenter(element)
  mesh.position.set(center.x, center.y, center.z)
  mesh.scale.set(element.size.x, element.size.y, element.size.z)
  mesh.rotation.set(
    three.MathUtils.degToRad(element.rotation.x),
    three.MathUtils.degToRad(element.rotation.y),
    three.MathUtils.degToRad(element.rotation.z),
  )
  mesh.visible = isNodeEffectivelyVisible(props.model, element)
}

function syncCubes(): void {
  if (!three || !scene || !cubeMaterial) return
  const currentIds = new Set(props.model.elements.map((element) => element.id))

  for (const [id, mesh] of cubeMeshes) {
    if (currentIds.has(id)) continue
    scene.remove(mesh)
    mesh.geometry.dispose()
    cubeMeshes.delete(id)
  }

  for (const element of props.model.elements) {
    let mesh = cubeMeshes.get(element.id)
    if (!mesh) {
      mesh = new three.Mesh(new three.BoxGeometry(1, 1, 1), cubeMaterial)
      mesh.userData.elementId = element.id
      mesh.castShadow = !props.lowPower
      mesh.receiveShadow = !props.lowPower
      scene.add(mesh)
      cubeMeshes.set(element.id, mesh)
    }
    applyElementToMesh(element, mesh)
  }

  syncSelection()
  renderScene()
}

function clearReferenceRecord(id: string): void {
  const record = referenceMeshes.get(id)
  if (!record || !scene) return
  scene.remove(record.mesh)
  record.mesh.geometry.dispose()
  disposeMaterial(record.mesh.material)
  record.texture.dispose()
  URL.revokeObjectURL(record.url)
  referenceMeshes.delete(id)
}

function applyReferenceTransform(id: string): void {
  const reference = props.model.references.find((entry) => entry.id === id)
  const record = referenceMeshes.get(id)
  if (!reference || !record || !three) return
  record.mesh.position.set(reference.position.x, reference.position.y, reference.position.z)
  record.mesh.scale.set(reference.size.x, reference.size.y, 1)
  record.mesh.rotation.set(0, 0, 0)
  if (reference.view === 'back') record.mesh.rotation.y = Math.PI
  if (reference.view === 'left') record.mesh.rotation.y = -Math.PI / 2
  if (reference.view === 'right') record.mesh.rotation.y = Math.PI / 2
  if (reference.view === 'top') record.mesh.rotation.x = -Math.PI / 2
  if (reference.view === 'bottom') record.mesh.rotation.x = Math.PI / 2
  record.mesh.visible = reference.visible
  record.mesh.userData.locked = reference.locked
  const material = record.mesh.material as MeshBasicMaterial
  material.opacity = reference.opacity
  material.needsUpdate = true
}

function createReferenceMesh(referenceId: string, asset: ModelReferenceAsset): void {
  if (!three || !scene) return
  const reference = props.model.references.find((entry) => entry.id === referenceId)
  if (!reference) return

  const url = URL.createObjectURL(asset.blob)
  const texture = new three.TextureLoader().load(
    url,
    () => renderScene(),
    undefined,
    () => emit('error', 'The reference image could not be opened.'),
  )
  texture.colorSpace = three.SRGBColorSpace
  const material = new three.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: reference.opacity,
    depthWrite: false,
    side: three.DoubleSide,
  })
  const mesh = new three.Mesh(new three.PlaneGeometry(1, 1), material)
  mesh.userData.referenceId = referenceId
  mesh.renderOrder = -2
  scene.add(mesh)
  referenceMeshes.set(referenceId, { mesh, texture, url, assetId: asset.id })
  applyReferenceTransform(referenceId)
}

function syncReferences(): void {
  if (!three || !scene) return
  const activeIds = new Set(props.model.references.map((reference) => reference.id))
  for (const id of referenceMeshes.keys()) {
    if (!activeIds.has(id)) clearReferenceRecord(id)
  }

  for (const reference of props.model.references) {
    const asset = props.assets.find((entry) => entry.id === reference.assetId)
    const current = referenceMeshes.get(reference.id)
    if (!asset) continue
    if (!current || current.assetId !== asset.id) {
      if (current) clearReferenceRecord(reference.id)
      createReferenceMesh(reference.id, asset)
    } else applyReferenceTransform(reference.id)
  }
  renderScene()
}

function syncSelection(): void {
  if (!selectionMesh || !gizmoGroup || !three) return
  const node = selectedNode()
  if (!node || !node.visible || (node.type === 'cube' && !isNodeEffectivelyVisible(props.model, node))) {
    selectionMesh.visible = false
    gizmoGroup.visible = false
    renderScene()
    return
  }

  const bounds = nodeBounds(node)
  const center = bounds.center
  selectionMesh.visible = true
  selectionMesh.position.set(center.x, center.y, center.z)
  selectionMesh.scale.set(bounds.size.x * 1.018, bounds.size.y * 1.018, bounds.size.z * 1.018)
  selectionMesh.rotation.set(0, 0, 0)
  if (node.type === 'cube') {
    selectionMesh.rotation.set(
      three.MathUtils.degToRad(node.rotation.x),
      three.MathUtils.degToRad(node.rotation.y),
      three.MathUtils.degToRad(node.rotation.z),
    )
  }
  gizmoGroup.position.set(node.pivot.x, node.pivot.y, node.pivot.z)
  gizmoGroup.visible = props.tool !== 'select'
  if (gizmoGroup.visible && gizmoTool !== props.tool) rebuildGizmo()
  renderScene()
}

function setAxisPosition(object: Object3D, axis: Axis, value: number): void {
  object.position.set(axis === 'x' ? value : 0, axis === 'y' ? value : 0, axis === 'z' ? value : 0)
}

function orientCylinder(object: Object3D, axis: Axis): void {
  if (axis === 'x') object.rotation.z = -Math.PI / 2
  if (axis === 'z') object.rotation.x = Math.PI / 2
}

function pickerMaterial(): MeshBasicMaterial {
  if (!three) throw new Error('Three.js is not ready')
  return new three.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
  })
}

function rebuildGizmo(): void {
  if (!three || !gizmoGroup) return
  for (const child of [...gizmoGroup.children]) {
    gizmoGroup.remove(child)
    disposeObject(child)
  }
  gizmoPickers.splice(0)
  gizmoTool = props.tool

  if (!gizmoGroup.visible) return
  const axes: Axis[] = ['x', 'y', 'z']
  for (const axis of axes) {
    const visibleMaterial = new three.MeshBasicMaterial({
      color: axisColors[axis],
      depthTest: false,
    })

    if (props.tool === 'rotate') {
      const ring = new three.Mesh(new three.TorusGeometry(0.78, 0.018, 8, 48), visibleMaterial)
      const picker = new three.Mesh(new three.TorusGeometry(0.78, 0.115, 8, 32), pickerMaterial())
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
      gizmoPickers.push(picker)
      continue
    }

    const stem = new three.Mesh(new three.CylinderGeometry(0.022, 0.022, 0.72, 8), visibleMaterial)
    setAxisPosition(stem, axis, 0.36)
    orientCylinder(stem, axis)
    stem.renderOrder = 20
    gizmoGroup.add(stem)

    const endpoint =
      props.tool === 'move'
        ? new three.Mesh(new three.ConeGeometry(0.09, 0.22, 12), visibleMaterial)
        : props.tool === 'pivot'
          ? new three.Mesh(new three.OctahedronGeometry(0.13), new three.MeshBasicMaterial({ color: 0xf4cf58, depthTest: false }))
        : new three.Mesh(new three.BoxGeometry(0.15, 0.15, 0.15), visibleMaterial)
    setAxisPosition(endpoint, axis, 0.82)
    if (props.tool === 'move') orientCylinder(endpoint, axis)
    endpoint.renderOrder = 20
    gizmoGroup.add(endpoint)

    const picker = new three.Mesh(new three.CylinderGeometry(0.15, 0.15, 1.05, 8), pickerMaterial())
    setAxisPosition(picker, axis, 0.5)
    orientCylinder(picker, axis)
    picker.userData.gizmoAxis = axis
    picker.renderOrder = 21
    gizmoGroup.add(picker)
    gizmoPickers.push(picker)
  }
  updateGizmoScale()
}

function updateGizmoScale(): void {
  if (!gizmoGroup || !camera || !gizmoGroup.visible) return
  const distance = camera.position.distanceTo(gizmoGroup.position)
  const scale = Math.max(3.4, Math.min(11, distance * 0.115))
  gizmoGroup.scale.setScalar(scale)
}

function pointerNdc(event: PointerEvent): { x: number; y: number } {
  const rect = renderer?.domElement.getBoundingClientRect()
  if (!rect) return { x: 0, y: 0 }
  return {
    x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
    y: -((event.clientY - rect.top) / rect.height) * 2 + 1,
  }
}

function setRayFromPointer(event: PointerEvent): void {
  if (!raycaster || !camera || !three) return
  const point = pointerNdc(event)
  raycaster.setFromCamera(new three.Vector2(point.x, point.y), camera)
}

function projectedAxis(axis: Axis): { x: number; y: number } {
  if (!three || !camera || !renderer) return { x: 1, y: 0 }
  const node = selectedNode()
  if (!node) return { x: 1, y: 0 }
  const origin = new three.Vector3(node.pivot.x, node.pivot.y, node.pivot.z).project(camera)
  const end = new three.Vector3(
    node.pivot.x + (axis === 'x' ? 1 : 0),
    node.pivot.y + (axis === 'y' ? 1 : 0),
    node.pivot.z + (axis === 'z' ? 1 : 0),
  ).project(camera)
  const width = renderer.domElement.clientWidth || 1
  const height = renderer.domElement.clientHeight || 1
  const x = (end.x - origin.x) * width * 0.5
  const y = -(end.y - origin.y) * height * 0.5
  const length = Math.hypot(x, y)
  return length < 0.01 ? { x: 1, y: 0 } : { x: x / length, y: y / length }
}

function transformValueLabel(node: StudioModelNode, axis: Axis): string {
  if (props.tool === 'rotate') return `${axis.toUpperCase()} ${node.rotation[axis].toFixed(1)}°`
  if (props.tool === 'scale') {
    if (node.type === 'group') return `Scale ${axis.toUpperCase()} ${node.scale[axis].toFixed(2)}`
    const dimension = axis === 'x' ? 'Width' : axis === 'y' ? 'Height' : 'Depth'
    return `${dimension} ${node.size[axis].toFixed(2)}`
  }
  if (props.tool === 'pivot') return `Pivot ${axis.toUpperCase()} ${node.pivot[axis].toFixed(2)}`
  return `${axis.toUpperCase()} ${node.position[axis].toFixed(2)}`
}

function onPointerDown(event: PointerEvent): void {
  if (!raycaster || !camera || !renderer || event.isPrimary === false) return
  emit('activate')
  setRayFromPointer(event)

  if (props.tool !== 'select') {
    const hit = raycaster.intersectObjects(gizmoPickers, false)[0]
    const axis = hit?.object.userData.gizmoAxis as Axis | undefined
    const node = selectedNode()
    const session = node ? captureNodeTransform(props.model, node.id) : undefined
    if (axis && node && session) {
      event.preventDefault()
      event.stopImmediatePropagation()
      renderer.domElement.setPointerCapture(event.pointerId)
      drag = {
        pointerId: event.pointerId,
        axis,
        startX: event.clientX,
        startY: event.clientY,
        session,
        latest: session.before,
      }
      liveTransform.value = transformValueLabel(node, axis)
      if (controls) controls.enabled = false
      return
    }
  }

  const cubeHit = raycaster.intersectObjects([...cubeMeshes.values()], false)[0]
  const elementId = cubeHit?.object.userData.elementId as string | undefined
  if (elementId) {
    event.preventDefault()
    event.stopImmediatePropagation()
    emit('selectReference', undefined)
    emit('selectNode', elementId)
    return
  }

  const referenceHit = raycaster.intersectObjects(
    [...referenceMeshes.values()]
      .map((entry) => entry.mesh)
      .filter((mesh) => mesh.userData.locked !== true),
    false,
  )[0]
  const referenceId = referenceHit?.object.userData.referenceId as string | undefined
  if (referenceId) {
    event.preventDefault()
    event.stopImmediatePropagation()
    emit('selectNode', undefined)
    emit('selectReference', referenceId)
    return
  }

  emptyPointer = { id: event.pointerId, x: event.clientX, y: event.clientY }
}

function onPointerMove(event: PointerEvent): void {
  if (!drag || drag.pointerId !== event.pointerId || !camera || !renderer) return
  const currentDrag = drag
  event.preventDefault()
  const dx = event.clientX - currentDrag.startX
  const dy = event.clientY - currentDrag.startY
  let delta: number
  if (props.tool === 'rotate') {
    delta = (dx - dy) * 0.65
  } else {
    const direction = projectedAxis(currentDrag.axis)
    const pixels = dx * direction.x + dy * direction.y
    const distance = camera.position.distanceTo(gizmoGroup?.position ?? camera.position)
    const worldPerPixel =
      (2 * distance * Math.tan((camera.fov * Math.PI) / 360)) /
      Math.max(1, renderer.domElement.clientHeight)
    delta = pixels * worldPerPixel
  }

  const requested = requestedAxisTransform(
    currentDrag.session,
    props.tool as Exclude<ModelTransformTool, 'select'>,
    currentDrag.axis,
    delta,
    props.transformSnap,
    props.rotationSnap,
  )
  const latest = props.tool === 'pivot'
    ? buildPivotState(currentDrag.session, requested.pivot)
    : buildNodeTransformState(currentDrag.session, requested)
  currentDrag.latest = latest
  const latestNode = latest.elements.find((entry) => entry.id === currentDrag.session.targetId)
    ?? latest.groups.find((entry) => entry.id === currentDrag.session.targetId)
  if (latestNode) liveTransform.value = transformValueLabel(latestNode, currentDrag.axis)
  emit('previewHierarchy', latest)
}

function finishDrag(event: PointerEvent): void {
  if (!drag || drag.pointerId !== event.pointerId) {
    if (emptyPointer?.id === event.pointerId) {
      const moved = Math.hypot(event.clientX - emptyPointer.x, event.clientY - emptyPointer.y)
      if (moved < 8) {
        emit('selectNode', undefined)
        emit('selectReference', undefined)
      }
      emptyPointer = undefined
    }
    return
  }
  const finished = drag
  drag = undefined
  if (renderer?.domElement.hasPointerCapture(event.pointerId)) {
    renderer.domElement.releasePointerCapture(event.pointerId)
  }
  if (controls) controls.enabled = true
  if (JSON.stringify(finished.session.before) === JSON.stringify(finished.latest)) return

  const nodeLabel = finished.session.node.type === 'group' ? 'group' : 'cube'
  const labels: Record<Exclude<ModelTransformTool, 'select'>, string> = {
    move: `Move ${nodeLabel}`,
    rotate: `Rotate ${nodeLabel}`,
    scale: `Resize ${nodeLabel}`,
    pivot: `Move ${nodeLabel} pivot`,
  }
  if (props.tool === 'select') return
  emit('commitHierarchy', {
    before: finished.session.before,
    after: finished.latest,
    label: labels[props.tool],
  })
}

function applyCameraView(view = props.view): void {
  if (!camera || !controls) return
  const target = selectedNode()?.pivot ?? { x: 8, y: 8, z: 8 }
  controls.target.set(target.x, target.y, target.z)
  const distance = 78
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
  const [x, y, z] = positions[view]
  camera.up.set(0, 1, 0)
  if (view === 'top') camera.up.set(0, 0, -1)
  if (view === 'bottom') camera.up.set(0, 0, 1)
  camera.position.set(target.x + x, target.y + y, target.z + z)
  camera.lookAt(controls.target)
  controls.update()
  renderScene()
}

async function initialize(): Promise<void> {
  if (!container.value) return
  try {
    const [threeModule, controlsModule] = await Promise.all([
      loadThree(),
      import('three/addons/controls/OrbitControls.js'),
    ])
    three = threeModule
    scene = new three.Scene()
    scene.background = new three.Color(0x0a0d10)
    camera = new three.PerspectiveCamera(42, 1, 0.1, 2000)
    camera.position.set(54, 42, 54)

    renderer = new three.WebGLRenderer({
      antialias: !props.lowPower,
      alpha: false,
      powerPreference: props.lowPower ? 'low-power' : 'high-performance',
    })
    renderer.outputColorSpace = three.SRGBColorSpace
    renderer.shadowMap.enabled = !props.lowPower
    renderer.shadowMap.type = three.PCFSoftShadowMap
    renderer.domElement.className = 'model-canvas'
    renderer.domElement.setAttribute('aria-label', 'Interactive 3D model viewport')
    renderer.domElement.style.touchAction = 'none'
    container.value.append(renderer.domElement)

    controls = new controlsModule.OrbitControls(camera, renderer.domElement)
    controls.target.set(8, 8, 8)
    controls.enableDamping = false
    controls.screenSpacePanning = true
    controls.minDistance = 8
    controls.maxDistance = 420
    controls.touches.ONE = three.TOUCH.ROTATE
    controls.touches.TWO = three.TOUCH.DOLLY_PAN
    controls.enabled = true
    controls.update()
    controls.addEventListener('change', renderScene)
    controls.addEventListener('end', onControlsEnd)

    environmentGroup = new three.Group()
    environmentGroup.add(new three.HemisphereLight(0xd9efff, 0x253129, 1.45))
    const keyLight = new three.DirectionalLight(0xffffff, 2.1)
    keyLight.position.set(45, 70, 35)
    keyLight.castShadow = !props.lowPower
    environmentGroup.add(keyLight)

    const minorGrid = new three.GridHelper(256, 64, 0x2b553b, 0x1c2b22)
    const majorGrid = new three.GridHelper(256, 16, 0x4ab66c, 0x294134)
    ;(minorGrid.material as Material).opacity = 0.55
    ;(minorGrid.material as Material).transparent = true
    ;(majorGrid.material as Material).opacity = 0.85
    ;(majorGrid.material as Material).transparent = true
    environmentGroup.add(minorGrid, majorGrid)

    const origin = new three.AxesHelper(12)
    environmentGroup.add(origin)
    scene.add(environmentGroup)

    cubeMaterial = new three.MeshStandardMaterial({
      color: 0x83a99a,
      roughness: 0.72,
      metalness: 0.04,
    })
    selectionMesh = new three.Mesh(
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

    gizmoGroup = new three.Group()
    gizmoGroup.visible = false
    scene.add(gizmoGroup)
    raycaster = new three.Raycaster()

    renderer.domElement.addEventListener('pointerdown', onPointerDown, { capture: true })
    renderer.domElement.addEventListener('pointermove', onPointerMove)
    renderer.domElement.addEventListener('pointerup', finishDrag)
    renderer.domElement.addEventListener('pointercancel', finishDrag)

    resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(container.value)
    syncCubes()
    syncReferences()
    resize()
    applyCameraView()
  } catch (error) {
    webglError.value = '3D modeling is not available on this device or browser.'
    emit('error', webglError.value)
    console.warn('[Addons Studio] Model viewport initialization failed', error)
  }
}

watch(() => [props.model.elements, props.model.groups] as const, syncCubes, { deep: true })
watch(() => [props.model.references, props.assets] as const, syncReferences, { deep: true })
watch(
  () => props.selectedNodeId,
  () => {
    liveTransform.value = ''
    syncSelection()
  },
)
watch(
  () => props.tool,
  () => {
    liveTransform.value = ''
    syncSelection()
  },
)
watch(() => props.view, (view) => applyCameraView(view))
watch(() => props.lowPower, resize)

onMounted(() => void initialize())

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  if (renderer) {
    renderer.domElement.removeEventListener('pointerdown', onPointerDown, { capture: true })
    renderer.domElement.removeEventListener('pointermove', onPointerMove)
    renderer.domElement.removeEventListener('pointerup', finishDrag)
    renderer.domElement.removeEventListener('pointercancel', finishDrag)
  }
  controls?.removeEventListener('change', renderScene)
  controls?.removeEventListener('end', onControlsEnd)
  controls?.dispose()
  for (const id of [...referenceMeshes.keys()]) clearReferenceRecord(id)
  for (const mesh of cubeMeshes.values()) mesh.geometry.dispose()
  cubeMeshes.clear()
  cubeMaterial?.dispose()
  if (selectionMesh) {
    selectionMesh.geometry.dispose()
    selectionMesh.material.dispose()
  }
  if (gizmoGroup) disposeObject(gizmoGroup)
  if (environmentGroup) disposeObject(environmentGroup)
  renderer?.dispose()
  renderer?.domElement.remove()
})
</script>

<template>
  <div
    ref="container"
    class="model-viewport"
    :class="{ 'model-viewport--active': active }"
    data-testid="model-viewport"
  >
    <div v-if="webglError" class="viewport-error" role="alert">
      <strong>3D unavailable</strong>
      <span>{{ webglError }}</span>
    </div>
    <div v-else class="viewport-hud" aria-hidden="true">
      <span><i class="axis-x" />X</span>
      <span><i class="axis-y" />Y</span>
      <span><i class="axis-z" />Z</span>
      <b>{{ view }}</b>
    </div>
    <button
      v-if="canMaximize"
      type="button"
      class="viewport-maximize"
      :aria-label="maximized ? 'Restore split view' : 'Maximize viewport'"
      @pointerdown.stop
      @click.stop="emit('toggleMaximize')"
    >
      {{ maximized ? 'Restore' : 'Max' }}
    </button>
    <div v-if="selectedNodeId" class="selection-label">
      {{ selectedNode()?.name }}
    </div>
    <output v-if="liveTransform" class="transform-value" aria-live="polite">{{ liveTransform }}</output>
    <div v-else-if="active && !webglError" class="gesture-help">
      Empty drag: orbit · Pinch: zoom · Two fingers: pan
    </div>
  </div>
</template>

<style scoped>
.model-viewport {
  position: relative;
  min-width: 0;
  min-height: 12rem;
  overflow: hidden;
  background: #0a0d10;
  isolation: isolate;
  border: 1px solid transparent;
}

.model-viewport--active { border-color: #3ca967; }

.model-viewport :deep(.model-canvas) {
  width: 100%;
  height: 100%;
  display: block;
  outline: 0;
}

.viewport-error {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  padding: 2rem;
  background: #0b0e11;
  color: #fff;
  text-align: center;
}

.viewport-error span {
  max-width: 22rem;
  color: #aeb8b2;
  font-size: 0.78rem;
  line-height: 1.45;
}

.viewport-hud {
  position: absolute;
  z-index: 2;
  top: 0.65rem;
  left: max(0.65rem, env(safe-area-inset-left));
  display: flex;
  gap: 0.5rem;
  border: 1px solid rgb(255 255 255 / 0.1);
  border-radius: 999px;
  padding: 0.3rem 0.5rem;
  background: rgb(5 8 7 / 0.72);
  color: #dce4df;
  font-family: var(--font-mono);
  font-size: 0.62rem;
  pointer-events: none;
}

.viewport-hud b {
  color: #7fdd9d;
  font-size: inherit;
  font-weight: 760;
  text-transform: capitalize;
}

.viewport-maximize {
  position: absolute;
  z-index: 4;
  top: 0.42rem;
  right: 0.42rem;
  min-width: 2.75rem;
  min-height: 2.75rem;
  border: 1px solid rgb(255 255 255 / 0.14);
  border-radius: 0.75rem;
  background: rgb(5 8 7 / 0.78);
  color: #dce4df;
  font-size: 0.62rem;
  font-weight: 760;
}

.viewport-hud span { display: flex; align-items: center; gap: 0.2rem; }
.viewport-hud i { width: 0.42rem; height: 0.42rem; border-radius: 50%; }
.axis-x { background: #f05d68; }
.axis-y { background: #4fd178; }
.axis-z { background: #4f9ff5; }

.selection-label,
.transform-value,
.gesture-help {
  position: absolute;
  z-index: 2;
  left: 50%;
  transform: translateX(-50%);
  border: 1px solid rgb(255 255 255 / 0.11);
  border-radius: 999px;
  padding: 0.3rem 0.6rem;
  background: rgb(5 8 7 / 0.76);
  color: #f1f5f2;
  font-size: 0.64rem;
  font-weight: 720;
  pointer-events: none;
  white-space: nowrap;
}

.selection-label { top: 0.65rem; }
.transform-value { bottom: 0.65rem; color: #f4d76d; font-family: var(--font-mono); }
.gesture-help { bottom: 0.65rem; color: #b8c4bd; }
</style>
