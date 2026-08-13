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
  StudioControlMode,
  StudioModel,
  StudioModelNode,
  StudioResizeDirection,
  StudioTransformSpace,
  StudioVector3,
} from '@/types/model'
import {
  buildAxisTransformState,
  captureNodeTransform,
  elementCenter,
  getStudioNode,
  isNodeEffectivelyLocked,
  isNodeEffectivelyVisible,
  sanitizeGestureDelta,
  snapValue,
  type StudioAxis,
  type StudioHierarchyState,
  type StudioNodeTransformSession,
} from '@/core/model/modelHierarchy'
import {
  buildSelectionAxisMoveState,
  buildSelectionTranslationState,
  buildUniformResizeState,
  captureSelectionTransform,
  selectionAxisVector,
  selectionBounds,
  selectionCanTransform,
  selectionElements,
  selectionPivot,
  type StudioSelectionTransformSession,
} from '@/core/model/modelProductivity'

const loadThree = () => import('three')
type ThreeModule = Awaited<ReturnType<typeof loadThree>>
type Axis = StudioAxis

interface DragState {
  pointerId: number
  axis: Axis
  tool: Exclude<ModelTransformTool, 'select'>
  startX: number
  startY: number
  session: StudioNodeTransformSession | StudioSelectionTransformSession
  latest: StudioHierarchyState
  projection: { x: number; y: number; worldPerPixel: number }
  cameraDistance: number
  initialExtent: number
}

interface DirectTouchState {
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
  selectedNodeIds?: string[]
  selectedReferenceId?: string
  tool: ModelTransformTool
  view: StudioCameraView
  active?: boolean
  lowPower?: boolean
  maximized?: boolean
  canMaximize?: boolean
  transformSnap: number | null
  rotationSnap: number | null
  resizeDirection: StudioResizeDirection
  controlMode: StudioControlMode
  transformSpace: StudioTransformSpace
  multiSelect?: boolean
  isolatedElementIds?: string[]
}>()

const emit = defineEmits<{
  selectNode: [id?: string, additive?: boolean]
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
let directTouch: DirectTouchState | undefined
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
  return getStudioNode(props.model, selectedIds().at(-1))
}

function selectedIds(): string[] {
  if (props.selectedNodeIds?.length) return props.selectedNodeIds
  return props.selectedNodeId ? [props.selectedNodeId] : []
}

function activeIsolation(): Set<string> | undefined {
  return props.isolatedElementIds?.length ? new Set(props.isolatedElementIds) : undefined
}

function selectionIsTransformable(): boolean {
  return selectionCanTransform(props.model, selectedIds())
}

function selectedBounds(): ReturnType<typeof selectionBounds> {
  const ids = selectedIds()
  const node = ids.length === 1 ? getStudioNode(props.model, ids[0]) : undefined
  if (node?.type === 'cube') {
    return {
      minimum: { ...node.position },
      maximum: {
        x: node.position.x + node.size.x,
        y: node.position.y + node.size.y,
        z: node.position.z + node.size.z,
      },
      center: elementCenter(node),
      size: { ...node.size },
    }
  }
  return selectionBounds(props.model, ids)
}

function selectedPivot(): StudioVector3 {
  return selectionPivot(props.model, selectedIds())
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
  const isolation = activeIsolation()
  mesh.visible = isNodeEffectivelyVisible(props.model, element)
    && (!isolation || isolation.has(element.id))
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
  record.mesh.visible = reference.visible && !activeIsolation()
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
  const ids = selectedIds()
  const bounds = selectedBounds()
  if (!node || !bounds || !ids.length || !node.visible || (node.type === 'cube' && !isNodeEffectivelyVisible(props.model, node))) {
    selectionMesh.visible = false
    gizmoGroup.visible = false
    renderScene()
    return
  }

  const center = bounds.center
  selectionMesh.visible = true
  selectionMesh.position.set(center.x, center.y, center.z)
  selectionMesh.scale.set(bounds.size.x * 1.018, bounds.size.y * 1.018, bounds.size.z * 1.018)
  selectionMesh.rotation.set(0, 0, 0)
  if (ids.length === 1 && node.type === 'cube') {
    selectionMesh.rotation.set(
      three.MathUtils.degToRad(node.rotation.x),
      three.MathUtils.degToRad(node.rotation.y),
      three.MathUtils.degToRad(node.rotation.z),
    )
  }
  const pivot = selectedPivot()
  gizmoGroup.position.set(pivot.x, pivot.y, pivot.z)
  gizmoGroup.rotation.set(0, 0, 0)
  const session = captureSelectionTransform(props.model, ids)
  if (session) {
    const x = selectionAxisVector(session, props.transformSpace, 'x')
    const y = selectionAxisVector(session, props.transformSpace, 'y')
    const z = selectionAxisVector(session, props.transformSpace, 'z')
    const basis = new three.Matrix4().makeBasis(
      new three.Vector3(x.x, x.y, x.z),
      new three.Vector3(y.x, y.y, y.z),
      new three.Vector3(z.x, z.y, z.z),
    )
    gizmoGroup.setRotationFromMatrix(basis)
  }
  const supportsSelectionTool = ids.length === 1 || props.tool === 'move'
  const gizmosEnabled = props.controlMode !== 'tactilismos' || props.tool === 'pivot'
  gizmoGroup.visible = props.tool !== 'select'
    && supportsSelectionTool
    && gizmosEnabled
    && selectionIsTransformable()
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

function projectedAxis(axis: Axis): { x: number; y: number; worldPerPixel: number } {
  if (!three || !camera || !renderer) return { x: 1, y: 0, worldPerPixel: 0.1 }
  const session = captureSelectionTransform(props.model, selectedIds())
  if (!session) return { x: 1, y: 0, worldPerPixel: 0.1 }
  const pivot = session.pivot
  const direction = selectionAxisVector(session, props.transformSpace, axis)
  const origin = new three.Vector3(pivot.x, pivot.y, pivot.z).project(camera)
  const end = new three.Vector3(
    pivot.x + direction.x,
    pivot.y + direction.y,
    pivot.z + direction.z,
  ).project(camera)
  const width = renderer.domElement.clientWidth || 1
  const height = renderer.domElement.clientHeight || 1
  const x = (end.x - origin.x) * width * 0.5
  const y = -(end.y - origin.y) * height * 0.5
  const length = Math.hypot(x, y)
  const distance = camera.position.distanceTo(new three.Vector3(pivot.x, pivot.y, pivot.z))
  const fallback = (2 * distance * Math.tan((camera.fov * Math.PI) / 360)) / height
  if (length >= 2) {
    return {
      x: x / length,
      y: y / length,
      // A nearly camera-aligned axis can project to a tiny line. Capping its
      // sensitivity prevents a one-pixel pointer spike from becoming a huge cube.
      worldPerPixel: Math.min(1 / length, Math.max(0.0001, fallback) * 6),
    }
  }
  return { x: 1, y: 0, worldPerPixel: Math.max(0.0001, fallback) }
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

function interactionSession(): StudioNodeTransformSession | StudioSelectionTransformSession | undefined {
  const ids = selectedIds()
  if (ids.length > 1) return captureSelectionTransform(props.model, ids)
  return ids[0] ? captureNodeTransform(props.model, ids[0]) : undefined
}

function sessionBefore(
  session: StudioNodeTransformSession | StudioSelectionTransformSession,
): StudioHierarchyState {
  return session.before
}

function sessionExtent(axis: Axis): number {
  const bounds = selectedBounds()
  return Math.max(0.25, bounds?.size[axis] ?? 1)
}

function projectedPivotScreen(pivot: StudioVector3): { x: number; y: number } {
  if (!three || !camera || !renderer) return { x: 0, y: 0 }
  const projected = new three.Vector3(pivot.x, pivot.y, pivot.z).project(camera)
  const rect = renderer.domElement.getBoundingClientRect()
  return {
    x: rect.left + (projected.x + 1) * rect.width / 2,
    y: rect.top + (1 - projected.y) * rect.height / 2,
  }
}

function dominantCameraAxis(): Axis {
  if (!three || !camera) return 'z'
  const direction = camera.getWorldDirection(new three.Vector3())
  const absolute = { x: Math.abs(direction.x), y: Math.abs(direction.y), z: Math.abs(direction.z) }
  return absolute.x >= absolute.y && absolute.x >= absolute.z
    ? 'x'
    : absolute.y >= absolute.z
      ? 'y'
      : 'z'
}

function startDirectTouch(event: PointerEvent, hitElementId: string): boolean {
  if (!three || !camera || !renderer || props.controlMode === 'gizmos') return false
  if (!['move', 'scale', 'rotate'].includes(props.tool) || !selectionIsTransformable()) return false
  const ids = selectedIds()
  if (props.tool === 'rotate' && ids.length !== 1) return false
  const selectedElementIds = new Set(selectionElements(props.model, ids).map((element) => element.id))
  if (!selectedElementIds.has(hitElementId)) return false
  const selectionSession = captureSelectionTransform(props.model, ids)
  if (!selectionSession) return false
  const nodeSession = ids.length === 1 ? captureNodeTransform(props.model, ids[0]!) : undefined
  const pivotScreen = projectedPivotScreen(selectionSession.pivot)
  const dx = event.clientX - pivotScreen.x
  const dy = event.clientY - pivotScreen.y
  // Circular rotation is unstable when a gesture begins exactly on the
  // projected pivot; require a small radial lever before claiming the touch.
  if (props.tool === 'rotate' && Math.hypot(dx, dy) < 12) return false
  camera.updateMatrixWorld()
  const matrix = camera.matrixWorld.elements
  const distance = camera.position.distanceTo(
    new three.Vector3(selectionSession.pivot.x, selectionSession.pivot.y, selectionSession.pivot.z),
  )
  const worldPerPixel =
    (2 * distance * Math.tan((camera.fov * Math.PI) / 360))
    / Math.max(1, renderer.domElement.clientHeight)

  event.preventDefault()
  event.stopImmediatePropagation()
  renderer.domElement.setPointerCapture(event.pointerId)
  if (controls) controls.enabled = false
  const state: DirectTouchState = {
    pointerId: event.pointerId,
    mode: props.tool as DirectTouchState['mode'],
    startX: event.clientX,
    startY: event.clientY,
    startRadius: Math.max(8, Math.hypot(dx, dy)),
    startAngle: Math.atan2(dy, dx),
    pivotScreen,
    right: { x: matrix[0]!, y: matrix[1]!, z: matrix[2]! },
    up: { x: matrix[4]!, y: matrix[5]!, z: matrix[6]! },
    worldPerPixel,
    cameraDistance: distance,
    initialExtent: Math.max(0.25, ...(Object.values(selectedBounds()?.size ?? { x: 1, y: 1, z: 1 }))),
    rotationAxis: dominantCameraAxis(),
    selectionSession,
    nodeSession,
    latest: selectionSession.before,
    active: false,
    timer: setTimeout(() => {
      if (!directTouch || directTouch.pointerId !== event.pointerId) return
      directTouch.active = true
      liveTransform.value = directTouch.mode === 'move'
        ? 'Tactilismo · Move'
        : directTouch.mode === 'scale'
          ? 'Tactilismo · Uniform Resize'
          : `Tactilismo · Rotate ${directTouch.rotationAxis.toUpperCase()}`
    }, 220),
  }
  directTouch = state
  return true
}

function onPointerDown(event: PointerEvent): void {
  if (!three || !raycaster || !camera || !renderer || event.isPrimary === false) return
  emit('activate')
  setRayFromPointer(event)

  if (props.tool !== 'select' && gizmoGroup?.visible) {
    const hit = raycaster.intersectObjects(gizmoPickers, false)[0]
    const axis = hit?.object.userData.gizmoAxis as Axis | undefined
    const node = selectedNode()
    const session = interactionSession()
    if (axis && node && session && selectionIsTransformable()) {
      event.preventDefault()
      event.stopImmediatePropagation()
      renderer.domElement.setPointerCapture(event.pointerId)
      const projection = projectedAxis(axis)
      const pivot = selectedPivot()
      drag = {
        pointerId: event.pointerId,
        axis,
        tool: props.tool as Exclude<ModelTransformTool, 'select'>,
        startX: event.clientX,
        startY: event.clientY,
        session,
        latest: sessionBefore(session),
        projection,
        cameraDistance: camera.position.distanceTo(
          new three.Vector3(pivot.x, pivot.y, pivot.z),
        ),
        initialExtent: sessionExtent(axis),
      }
      liveTransform.value = transformValueLabel(node, axis)
      if (controls) controls.enabled = false
      return
    }
  }

  const cubeHit = raycaster.intersectObjects(
    [...cubeMeshes.values()].filter((mesh) => {
      if (!mesh.visible) return false
      const id = mesh.userData.elementId as string | undefined
      const node = id ? getStudioNode(props.model, id) : undefined
      return Boolean(node && !isNodeEffectivelyLocked(props.model, node))
    }),
    false,
  )[0]
  const elementId = cubeHit?.object.userData.elementId as string | undefined
  if (elementId) {
    if (startDirectTouch(event, elementId)) return
    event.preventDefault()
    event.stopImmediatePropagation()
    emit('selectReference', undefined)
    emit('selectNode', elementId, props.multiSelect)
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
  if (directTouch?.pointerId === event.pointerId) {
    const direct = directTouch
    const dx = event.clientX - direct.startX
    const dy = event.clientY - direct.startY
    if (!direct.active) {
      if (Math.hypot(dx, dy) > 14) {
        clearTimeout(direct.timer)
        directTouch = undefined
        if (renderer?.domElement.hasPointerCapture(event.pointerId)) {
          renderer.domElement.releasePointerCapture(event.pointerId)
        }
        if (controls) controls.enabled = true
      }
      return
    }

    event.preventDefault()
    if (direct.mode === 'move') {
      const raw = {
        x: (direct.right.x * dx - direct.up.x * dy) * direct.worldPerPixel,
        y: (direct.right.y * dx - direct.up.y * dy) * direct.worldPerPixel,
        z: (direct.right.z * dx - direct.up.z * dy) * direct.worldPerPixel,
      }
      const rawLength = Math.hypot(raw.x, raw.y, raw.z)
      const safeLength = sanitizeGestureDelta(
        rawLength,
        'move',
        direct.initialExtent,
        direct.cameraDistance,
      )
      const safeFactor = rawLength > 0 ? safeLength / rawLength : 0
      const delta = {
        x: snapValue(raw.x * safeFactor, props.transformSnap),
        y: snapValue(raw.y * safeFactor, props.transformSnap),
        z: snapValue(raw.z * safeFactor, props.transformSnap),
      }
      direct.latest = buildSelectionTranslationState(direct.selectionSession, delta)
      liveTransform.value = `Move ${delta.x.toFixed(2)}, ${delta.y.toFixed(2)}, ${delta.z.toFixed(2)}`
    } else if (direct.mode === 'scale') {
      const radius = Math.hypot(
        event.clientX - direct.pivotScreen.x,
        event.clientY - direct.pivotScreen.y,
      )
      const rawDelta = (radius - direct.startRadius) * direct.worldPerPixel
      const delta = sanitizeGestureDelta(
        rawDelta,
        'scale',
        direct.initialExtent,
        direct.cameraDistance,
      )
      direct.latest = buildUniformResizeState(
        direct.selectionSession,
        delta,
        props.transformSnap,
        props.resizeDirection,
      )
      liveTransform.value = `Uniform Resize ${delta >= 0 ? '+' : ''}${delta.toFixed(2)}`
    } else if (direct.nodeSession) {
      const angle = Math.atan2(
        event.clientY - direct.pivotScreen.y,
        event.clientX - direct.pivotScreen.x,
      )
      let degrees = (angle - direct.startAngle) * 180 / Math.PI
      if (degrees > 180) degrees -= 360
      if (degrees < -180) degrees += 360
      degrees = sanitizeGestureDelta(
        degrees,
        'rotate',
        direct.initialExtent,
        direct.cameraDistance,
      )
      direct.latest = buildAxisTransformState(
        direct.nodeSession,
        'rotate',
        direct.rotationAxis,
        degrees,
        props.transformSnap,
        props.rotationSnap,
        { transformSpace: props.transformSpace, resizeDirection: props.resizeDirection },
      )
      liveTransform.value = `Rotate ${direct.rotationAxis.toUpperCase()} ${snapValue(degrees, props.rotationSnap).toFixed(1)}°`
    }
    emit('previewHierarchy', direct.latest)
    return
  }

  if (!drag || drag.pointerId !== event.pointerId || !camera || !renderer) return
  const currentDrag = drag
  event.preventDefault()
  const dx = event.clientX - currentDrag.startX
  const dy = event.clientY - currentDrag.startY
  let delta: number
  if (currentDrag.tool === 'rotate') {
    delta = (dx - dy) * 0.65
  } else {
    const direction = currentDrag.projection
    const pixels = dx * direction.x + dy * direction.y
    delta = pixels * direction.worldPerPixel
  }
  delta = sanitizeGestureDelta(
    delta,
    currentDrag.tool,
    currentDrag.initialExtent,
    currentDrag.cameraDistance,
  )

  const latest = 'targetId' in currentDrag.session
    ? buildAxisTransformState(
        currentDrag.session,
        currentDrag.tool,
        currentDrag.axis,
        delta,
        props.transformSnap,
        props.rotationSnap,
        { resizeDirection: props.resizeDirection, transformSpace: props.transformSpace },
      )
    : buildSelectionAxisMoveState(
        currentDrag.session,
        currentDrag.axis,
        delta,
        props.transformSnap,
        props.transformSpace,
      )
  currentDrag.latest = latest
  const targetId = 'targetId' in currentDrag.session
    ? currentDrag.session.targetId
    : currentDrag.session.primaryId
  const latestNode = latest.elements.find((entry) => entry.id === targetId)
    ?? latest.groups.find((entry) => entry.id === targetId)
  if (latestNode) liveTransform.value = transformValueLabel(latestNode, currentDrag.axis)
  emit('previewHierarchy', latest)
}

function finishDrag(event: PointerEvent): void {
  if (directTouch?.pointerId === event.pointerId) {
    const finished = directTouch
    directTouch = undefined
    clearTimeout(finished.timer)
    if (renderer?.domElement.hasPointerCapture(event.pointerId)) {
      renderer.domElement.releasePointerCapture(event.pointerId)
    }
    if (controls) controls.enabled = true
    liveTransform.value = ''
    if (!finished.active || JSON.stringify(finished.selectionSession.before) === JSON.stringify(finished.latest)) return
    emit('commitHierarchy', {
      before: finished.selectionSession.before,
      after: finished.latest,
      label: finished.mode === 'move'
        ? 'Direct move selection'
        : finished.mode === 'scale'
          ? 'Direct resize selection'
          : 'Direct rotate object',
    })
    return
  }
  if (!drag || drag.pointerId !== event.pointerId) {
    if (emptyPointer?.id === event.pointerId) {
      const moved = Math.hypot(event.clientX - emptyPointer.x, event.clientY - emptyPointer.y)
      if (moved < 8) {
        emit('selectNode', undefined, false)
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
  if (JSON.stringify(sessionBefore(finished.session)) === JSON.stringify(finished.latest)) return

  const nodeLabel = 'node' in finished.session
    ? finished.session.node.type === 'group' ? 'group' : 'cube'
    : 'selection'
  const labels: Record<Exclude<ModelTransformTool, 'select'>, string> = {
    move: `Move ${nodeLabel}`,
    rotate: `Rotate ${nodeLabel}`,
    scale: `Resize ${nodeLabel}`,
    pivot: `Move ${nodeLabel} pivot`,
  }
  emit('commitHierarchy', {
    before: sessionBefore(finished.session),
    after: finished.latest,
    label: labels[finished.tool],
  })
}

function applyCameraView(view = props.view): void {
  if (!camera || !controls) return
  const target = selectedIds().length ? selectedPivot() : { x: 8, y: 8, z: 8 }
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
  () => [props.selectedNodeId, props.selectedNodeIds] as const,
  () => {
    liveTransform.value = ''
    syncSelection()
  },
  { deep: true },
)
watch(
  () => [props.tool, props.controlMode, props.transformSpace] as const,
  () => {
    if (directTouch) {
      const cancelled = directTouch
      clearTimeout(cancelled.timer)
      emit('previewHierarchy', cancelled.selectionSession.before)
      if (renderer?.domElement.hasPointerCapture(cancelled.pointerId)) {
        renderer.domElement.releasePointerCapture(cancelled.pointerId)
      }
      if (controls) controls.enabled = true
      directTouch = undefined
    }
    liveTransform.value = ''
    syncSelection()
  },
)
watch(() => props.view, (view) => applyCameraView(view))
watch(() => props.lowPower, resize)
watch(
  () => props.isolatedElementIds,
  () => {
    syncCubes()
    syncReferences()
  },
  { deep: true },
)

onMounted(() => void initialize())

onBeforeUnmount(() => {
  if (directTouch) clearTimeout(directTouch.timer)
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
    :data-control-mode="controlMode"
    :data-transform-space="transformSpace"
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
      <em>{{ transformSpace }} · {{ controlMode }}</em>
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
    <div v-if="selectedIds().length" class="selection-label">
      {{ selectedIds().length > 1 ? `${selectedIds().length} objects selected` : selectedNode()?.name }}
    </div>
    <output v-if="liveTransform" class="transform-value" aria-live="polite">{{ liveTransform }}</output>
    <div v-else-if="active && !webglError" class="gesture-help">
      Empty drag: orbit · Pinch: zoom · Two fingers: pan{{ controlMode === 'gizmos' ? '' : ' · Hold object: Tactilismo' }}
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

.viewport-hud em {
  color: #b9c5be;
  font-size: inherit;
  font-style: normal;
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

@media (max-width: 640px) {
  .viewport-hud em { display: none; }
}
</style>
