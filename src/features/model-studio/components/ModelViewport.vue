<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Mesh, Object3D } from 'three'

import {
  captureNodeTransform,
  getStudioNode,
  isNodeEffectivelyLocked,
  isNodeEffectivelyVisible,
  isPointerStepContinuous,
  type StudioHierarchyState,
  type StudioNodeTransformSession,
} from '@/core/model/modelHierarchy'
import type { StudioInflateHandle } from '@/core/model/modelInflate'
import {
  captureSelectionTransform,
  selectionAxisVector,
  selectionCanTransform,
  selectionElements,
  selectionModelingCenter,
  type StudioSelectionTransformSession,
} from '@/core/model/modelProductivity'
import { useLocaleStore } from '@/stores/locale'
import type {
  ModelManipulationTool,
  ModelTransformTool,
  StudioCameraSettings,
  StudioCameraView,
  StudioControlMode,
  StudioEditorBackgroundSettings,
  StudioModel,
  StudioResizeDirection,
  StudioTransformSpace,
  StudioVector3,
} from '@/types/model'

import BackgroundGuideLayer from '../runtime/BackgroundGuideLayer.vue'
import {
  applyStudioCameraSettings,
  applyStudioCameraView,
  resizeStudioRenderer,
} from '../runtime/cameraRuntime'
import { updateClassicDrag } from '../runtime/classicDragRuntime'
import {
  rebuildClassicGizmo,
  updateClassicGizmoScale,
} from '../runtime/classicGizmoRuntime'
import {
  rebuildInflateRuntime,
  updateInflateHandleScale,
} from '../runtime/inflateRuntime'
import { syncStudioCubeMeshes } from '../runtime/modelMeshRuntime'
import type {
  Axis,
  DirectTouchState,
  DragState,
  EmptyPointerState,
} from '../runtime/modelViewportTypes'
import {
  createStudioThreeSceneRuntime,
  disposeStudioThreeSceneRuntime,
  type StudioThreeSceneRuntime,
} from '../runtime/threeSceneRuntime'
import { updateDirectTouchGesture, worldPerPixelForTouch } from '../runtime/touchGizmoRuntime'
import {
  movedBeyondDeadzone,
  TOUCH_DEADZONE_PX,
  TOUCH_HOLD_MS,
  worldPerPixelFromDistance,
} from '../runtime/viewportMath'
import {
  viewportGizmoOrigin,
  viewportSelectedIds,
  viewportSelectedNode,
  viewportSelectionBounds,
  viewportTransformLabel,
} from '../runtime/viewportSelection'
import ViewportQuickControls from './ViewportQuickControls.vue'

const props = defineProps<{
  model: StudioModel
  assetUrls: Record<string, string>
  background: StudioEditorBackgroundSettings
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
  resizeSnap?: number | null
  rotationSnap: number | null
  resizeDirection: StudioResizeDirection
  controlMode: StudioControlMode
  transformSpace: StudioTransformSpace
  cameraSettings?: StudioCameraSettings
  multiSelect?: boolean
  isolatedElementIds?: string[]
  inflateSource?: StudioInflateHandle
  /** Read-compatible Snapshot 3 prop. Rotate is official in Touch Gizmo now. */
  touchRotateEnabled?: boolean
  interactionLocked?: boolean
}>()

const emit = defineEmits<{
  selectNode: [id?: string, additive?: boolean]
  selectReference: [id?: string]
  previewHierarchy: [state: StudioHierarchyState]
  commitHierarchy: [payload: { before: StudioHierarchyState; after: StudioHierarchyState; label: string }]
  activate: []
  toggleMaximize: []
  cameraNavigated: []
  updateView: [view: StudioCameraView]
  updateTransformSpace: [space: StudioTransformSpace]
  error: [message: string]
  selectInflateHandle: [handle: StudioInflateHandle]
}>()

const locale = useLocaleStore()
const container = ref<HTMLDivElement>()
const webglError = ref('')
const liveTransform = ref('')

let runtime: StudioThreeSceneRuntime | undefined
let resizeObserver: ResizeObserver | undefined
let drag: DragState | undefined
let directTouch: DirectTouchState | undefined
let emptyPointer: EmptyPointerState | undefined
let gizmoTool: ModelTransformTool | undefined
let inflateTargetCubeId: string | undefined
let gizmoPickers: Object3D[] = []
let inflatePickers: Object3D[] = []
const cubeMeshes = new Map<string, Mesh>()

function selectedIds(): string[] {
  return viewportSelectedIds(props.selectedNodeId, props.selectedNodeIds)
}

function selectedNode() {
  return viewportSelectedNode(props.model, selectedIds())
}

function selectedBounds() {
  return viewportSelectionBounds(props.model, selectedIds())
}

function selectionIsTransformable(): boolean {
  return selectionCanTransform(props.model, selectedIds())
}

function activeIsolation(): Set<string> | undefined {
  return props.isolatedElementIds?.length ? new Set(props.isolatedElementIds) : undefined
}

function selectedGizmoOrigin(): StudioVector3 {
  return viewportGizmoOrigin(props.model, selectedIds(), props.tool)
}

function renderScene(): void {
  if (!runtime) return
  updateClassicGizmoScale(runtime.gizmoGroup, runtime.camera, runtime.renderer)
  updateInflateHandleScale(runtime.inflateGroup, runtime.camera, runtime.renderer)
  runtime.renderer.render(runtime.scene, runtime.camera)
}

function rebuildInflateHandles(): void {
  if (!runtime) return
  const node = selectedNode()
  inflatePickers = rebuildInflateRuntime({
    three: runtime.three,
    group: runtime.inflateGroup,
    model: props.model,
    source: props.inflateSource,
    targetCubeId: inflateTargetCubeId,
    selectedCube: node?.type === 'cube' ? node : undefined,
    toolActive: props.tool === 'inflate',
  }).pickers
  updateInflateHandleScale(runtime.inflateGroup, runtime.camera, runtime.renderer)
}

function currentCameraSettings(): StudioCameraSettings {
  return props.cameraSettings ?? {
    orbitSensitivity: 1,
    panSensitivity: 1,
    zoomSensitivity: 1,
    profile: 'standard',
  }
}

function resize(): void {
  if (!runtime || !container.value) return
  resizeStudioRenderer(container.value, runtime.renderer, runtime.camera, props.lowPower)
  renderScene()
}

function syncCubes(): void {
  if (!runtime) return
  syncStudioCubeMeshes({
    three: runtime.three,
    scene: runtime.scene,
    model: props.model,
    meshes: cubeMeshes,
    materials: runtime.previewMaterials.materials,
    lowPower: props.lowPower,
    isolation: activeIsolation(),
  })
  syncSelection()
  rebuildInflateHandles()
  renderScene()
}

function syncSelection(): void {
  if (!runtime) return
  const node = selectedNode()
  const ids = selectedIds()
  const bounds = selectedBounds()
  const { selectionMesh, gizmoGroup, three } = runtime

  if (!node || !bounds || !ids.length || !node.visible
    || (node.type === 'cube' && !isNodeEffectivelyVisible(props.model, node))) {
    selectionMesh.visible = false
    gizmoGroup.visible = false
    renderScene()
    return
  }

  selectionMesh.visible = true
  selectionMesh.position.set(bounds.center.x, bounds.center.y, bounds.center.z)
  selectionMesh.scale.set(bounds.size.x * 1.018, bounds.size.y * 1.018, bounds.size.z * 1.018)
  selectionMesh.rotation.set(0, 0, 0)
  if (ids.length === 1 && node.type === 'cube') {
    selectionMesh.rotation.set(
      three.MathUtils.degToRad(node.rotation.x),
      three.MathUtils.degToRad(node.rotation.y),
      three.MathUtils.degToRad(node.rotation.z),
    )
  }

  const origin = selectedGizmoOrigin()
  gizmoGroup.position.set(origin.x, origin.y, origin.z)
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
  const touchOnly = props.controlMode === 'tactilismos' || props.controlMode === 'touch-gizmo'
  const gizmosEnabled = !touchOnly || props.tool === 'pivot'
  gizmoGroup.visible = props.tool !== 'select' && props.tool !== 'inflate'
    && supportsSelectionTool
    && gizmosEnabled
    && selectionIsTransformable()

  if (gizmoGroup.visible && gizmoTool !== props.tool) rebuildGizmo()
  renderScene()
}

function rebuildGizmo(): void {
  if (!runtime) return
  gizmoTool = props.tool
  gizmoPickers = rebuildClassicGizmo(runtime.three, runtime.gizmoGroup, props.tool)
  updateClassicGizmoScale(runtime.gizmoGroup, runtime.camera, runtime.renderer)
}

function setRayFromPointer(event: PointerEvent): void {
  if (!runtime) return
  const rect = runtime.renderer.domElement.getBoundingClientRect()
  const point = new runtime.three.Vector2(
    ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
    -((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1,
  )
  runtime.raycaster.setFromCamera(point, runtime.camera)
}

function projectedAxis(axis: Axis): { x: number; y: number; worldPerPixel: number } {
  if (!runtime) return { x: 1, y: 0, worldPerPixel: 0.1 }
  const session = captureSelectionTransform(props.model, selectedIds())
  if (!session) return { x: 1, y: 0, worldPerPixel: 0.1 }

  const { three, camera, renderer } = runtime
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
  const fallback = worldPerPixelFromDistance(distance, camera.fov, height)
  if (length >= 2) {
    return {
      x: x / length,
      y: y / length,
      worldPerPixel: Math.min(1 / length, Math.max(0.0001, fallback) * 6),
    }
  }
  return { x: 1, y: 0, worldPerPixel: Math.max(0.0001, fallback) }
}

function interactionSession(): StudioNodeTransformSession | StudioSelectionTransformSession | undefined {
  const ids = selectedIds()
  if (ids.length > 1) return captureSelectionTransform(props.model, ids)
  return ids[0] ? captureNodeTransform(props.model, ids[0]) : undefined
}

function sessionBefore(session: StudioNodeTransformSession | StudioSelectionTransformSession): StudioHierarchyState {
  return session.before
}

function sessionExtent(axis: Axis): number {
  return Math.max(0.25, selectedBounds()?.size[axis] ?? 1)
}

function projectedPivotScreen(pivot: StudioVector3): { x: number; y: number } {
  if (!runtime) return { x: 0, y: 0 }
  const projected = new runtime.three.Vector3(pivot.x, pivot.y, pivot.z).project(runtime.camera)
  const rect = runtime.renderer.domElement.getBoundingClientRect()
  return {
    x: rect.left + (projected.x + 1) * rect.width / 2,
    y: rect.top + (1 - projected.y) * rect.height / 2,
  }
}

function dominantCameraAxis(): Axis {
  if (!runtime) return 'z'
  const direction = runtime.camera.getWorldDirection(new runtime.three.Vector3())
  const absolute = { x: Math.abs(direction.x), y: Math.abs(direction.y), z: Math.abs(direction.z) }
  return absolute.x >= absolute.y && absolute.x >= absolute.z
    ? 'x'
    : absolute.y >= absolute.z ? 'y' : 'z'
}

function pointerStepIsContinuous(
  state: Pick<DragState, 'lastX' | 'lastY' | 'lastTime'>,
  event: PointerEvent,
): boolean {
  if (!runtime) return false
  const rect = runtime.renderer.domElement.getBoundingClientRect()
  const continuous = isPointerStepContinuous(
    { x: state.lastX, y: state.lastY, time: state.lastTime },
    { x: event.clientX, y: event.clientY, time: event.timeStamp },
    Math.hypot(rect.width, rect.height),
  )
  if (continuous) {
    state.lastX = event.clientX
    state.lastY = event.clientY
    state.lastTime = event.timeStamp
  }
  return continuous
}

function cancelDirectTouch(revert = true): void {
  if (!directTouch) return
  const cancelled = directTouch
  directTouch = undefined
  clearTimeout(cancelled.timer)
  if (revert && cancelled.active) emit('previewHierarchy', cancelled.selectionSession.before)
  if (runtime?.renderer.domElement.hasPointerCapture(cancelled.pointerId)) {
    runtime.renderer.domElement.releasePointerCapture(cancelled.pointerId)
  }
  if (runtime) runtime.controls.enabled = !props.interactionLocked
  liveTransform.value = ''
}

function startDirectTouch(event: PointerEvent, hitElementId: string): boolean {
  if (!runtime || props.controlMode === 'gizmos' || props.interactionLocked) return false
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
  if (props.tool === 'rotate' && Math.hypot(dx, dy) < 12) return false

  runtime.camera.updateMatrixWorld()
  const matrix = runtime.camera.matrixWorld.elements
  const touchScale = worldPerPixelForTouch(runtime.camera, runtime.renderer, selectionSession.pivot)
  directTouch = {
    pointerId: event.pointerId,
    mode: props.tool as DirectTouchState['mode'],
    startX: event.clientX,
    startY: event.clientY,
    startRadius: Math.max(8, Math.hypot(dx, dy)),
    startAngle: Math.atan2(dy, dx),
    pivotScreen,
    right: { x: matrix[0]!, y: matrix[1]!, z: matrix[2]! },
    up: { x: matrix[4]!, y: matrix[5]!, z: matrix[6]! },
    worldPerPixel: touchScale.worldPerPixel,
    cameraDistance: touchScale.distance,
    initialExtent: Math.max(0.25, ...Object.values(selectedBounds()?.size ?? { x: 1, y: 1, z: 1 })),
    rotationAxis: dominantCameraAxis(),
    selectionSession,
    nodeSession,
    latest: selectionSession.before,
    active: false,
    lastX: event.clientX,
    lastY: event.clientY,
    lastTime: event.timeStamp,
    timer: setTimeout(() => {
      if (!directTouch || directTouch.pointerId !== event.pointerId || !runtime) return
      runtime.renderer.domElement.setPointerCapture(event.pointerId)
      runtime.controls.enabled = false
      directTouch.active = true
      liveTransform.value = directTouch.mode === 'move'
        ? 'Touch Gizmo · Move'
        : directTouch.mode === 'scale'
          ? 'Touch Gizmo · Uniform Resize'
          : `Touch Gizmo · Rotate ${directTouch.rotationAxis.toUpperCase()}`
    }, TOUCH_HOLD_MS),
  }
  return true
}

function onPointerDown(event: PointerEvent): void {
  if (event.isPrimary === false) {
    cancelDirectTouch()
    return
  }
  if (!runtime || props.interactionLocked) return
  emit('activate')
  setRayFromPointer(event)

  if (props.tool === 'inflate') {
    const hit = runtime.raycaster.intersectObjects(inflatePickers, false)[0]
    const handle = hit?.object.userData.inflateHandle as StudioInflateHandle | undefined
    if (handle) {
      event.preventDefault()
      event.stopImmediatePropagation()
      emit('selectInflateHandle', handle)
      return
    }
  }

  if (props.tool !== 'select' && props.tool !== 'inflate' && runtime.gizmoGroup.visible) {
    const hit = runtime.raycaster.intersectObjects(gizmoPickers, false)[0]
    const axis = hit?.object.userData.gizmoAxis as Axis | undefined
    const node = selectedNode()
    const session = interactionSession()
    if (axis && node && session && selectionIsTransformable()) {
      event.preventDefault()
      event.stopImmediatePropagation()
      runtime.renderer.domElement.setPointerCapture(event.pointerId)
      const pivot = selectedGizmoOrigin()
      drag = {
        pointerId: event.pointerId,
        axis,
        tool: props.tool as ModelManipulationTool,
        startX: event.clientX,
        startY: event.clientY,
        session,
        latest: sessionBefore(session),
        projection: projectedAxis(axis),
        cameraDistance: runtime.camera.position.distanceTo(
          new runtime.three.Vector3(pivot.x, pivot.y, pivot.z),
        ),
        initialExtent: sessionExtent(axis),
        lastX: event.clientX,
        lastY: event.clientY,
        lastTime: event.timeStamp,
      }
      liveTransform.value = viewportTransformLabel(node, props.tool, axis)
      runtime.controls.enabled = false
      return
    }
  }

  const cubeHit = runtime.raycaster.intersectObjects(
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
    if (props.tool === 'inflate') {
      event.preventDefault()
      event.stopImmediatePropagation()
      if (props.inflateSource && elementId !== props.inflateSource.cubeId) {
        inflateTargetCubeId = elementId
        rebuildInflateHandles()
      } else if (!props.inflateSource) {
        emit('selectNode', elementId, false)
      }
      return
    }
    if (startDirectTouch(event, elementId)) return
    event.preventDefault()
    event.stopImmediatePropagation()
    emit('selectReference', undefined)
    emit('selectNode', elementId, props.multiSelect)
    return
  }

  emptyPointer = { id: event.pointerId, x: event.clientX, y: event.clientY }
}

function onPointerMove(event: PointerEvent): void {
  if (directTouch?.pointerId === event.pointerId) {
    if (!directTouch.active) {
      if (movedBeyondDeadzone(directTouch.startX, directTouch.startY, event.clientX, event.clientY)) {
        cancelDirectTouch(false)
      }
      return
    }
    event.preventDefault()
    event.stopImmediatePropagation()
    if (!pointerStepIsContinuous(directTouch, event)) return
    const result = updateDirectTouchGesture(directTouch, event, {
      transformSnap: props.transformSnap,
      resizeSnap: props.resizeSnap ?? props.transformSnap,
      rotationSnap: props.rotationSnap,
      resizeDirection: props.resizeDirection,
      transformSpace: props.transformSpace,
    })
    if (result.changed) {
      liveTransform.value = result.label
      emit('previewHierarchy', directTouch.latest)
    }
    return
  }

  if (!drag || drag.pointerId !== event.pointerId || !runtime) return
  event.preventDefault()
  event.stopImmediatePropagation()
  if (!pointerStepIsContinuous(drag, event)) return
  const latest = updateClassicDrag(drag, event, {
    transformSnap: props.transformSnap,
    resizeSnap: props.resizeSnap ?? props.transformSnap,
    rotationSnap: props.rotationSnap,
    resizeDirection: props.resizeDirection,
    transformSpace: props.transformSpace,
  })
  const targetId = 'targetId' in drag.session ? drag.session.targetId : drag.session.primaryId
  const latestNode = latest.elements.find((entry) => entry.id === targetId)
    ?? latest.groups.find((entry) => entry.id === targetId)
  if (latestNode) liveTransform.value = viewportTransformLabel(latestNode, props.tool, drag.axis)
  emit('previewHierarchy', latest)
}

function finishDrag(event: PointerEvent): void {
  if (directTouch?.pointerId === event.pointerId) {
    const finished = directTouch
    directTouch = undefined
    clearTimeout(finished.timer)
    if (runtime?.renderer.domElement.hasPointerCapture(event.pointerId)) {
      runtime.renderer.domElement.releasePointerCapture(event.pointerId)
    }
    if (runtime) runtime.controls.enabled = !props.interactionLocked
    liveTransform.value = ''
    if (!finished.active || JSON.stringify(finished.selectionSession.before) === JSON.stringify(finished.latest)) return
    emit('commitHierarchy', {
      before: finished.selectionSession.before,
      after: finished.latest,
      label: finished.mode === 'move'
        ? 'Direct move selection'
        : finished.mode === 'scale' ? 'Direct resize selection' : 'Direct rotate object',
    })
    return
  }

  if (!drag || drag.pointerId !== event.pointerId) {
    if (emptyPointer?.id === event.pointerId) {
      if (!movedBeyondDeadzone(emptyPointer.x, emptyPointer.y, event.clientX, event.clientY, TOUCH_DEADZONE_PX)) {
        emit('selectNode', undefined, false)
        emit('selectReference', undefined)
      }
      emptyPointer = undefined
    }
    return
  }

  const finished = drag
  drag = undefined
  if (runtime?.renderer.domElement.hasPointerCapture(event.pointerId)) {
    runtime.renderer.domElement.releasePointerCapture(event.pointerId)
  }
  if (runtime) runtime.controls.enabled = !props.interactionLocked
  if (JSON.stringify(sessionBefore(finished.session)) === JSON.stringify(finished.latest)) return

  const nodeLabel = 'node' in finished.session
    ? finished.session.node.type === 'group' ? 'group' : 'cube'
    : 'selection'
  const labels: Record<ModelManipulationTool, string> = {
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
  if (!runtime) return
  const target = selectedIds().length
    ? selectionModelingCenter(props.model, selectedIds())
    : { x: 8, y: 8, z: 8 }
  applyStudioCameraView(runtime.camera, runtime.controls, view, target)
  renderScene()
}

async function initialize(): Promise<void> {
  if (!container.value) return
  try {
    runtime = await createStudioThreeSceneRuntime({
      container: container.value,
      lowPower: props.lowPower,
      cameraSettings: currentCameraSettings(),
    })
    runtime.controls.addEventListener('change', renderScene)
    runtime.controls.addEventListener('end', onControlsEnd)
    runtime.renderer.domElement.addEventListener('pointerdown', onPointerDown, { capture: true })
    runtime.renderer.domElement.addEventListener('pointermove', onPointerMove)
    runtime.renderer.domElement.addEventListener('pointerup', finishDrag)
    runtime.renderer.domElement.addEventListener('pointercancel', finishDrag)
    resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(container.value)
    syncCubes()
    resize()
    applyCameraView()
  } catch (error) {
    webglError.value = locale.t('3D modeling is not available on this device or browser.')
    emit('error', webglError.value)
    console.warn('[Addons Studio] Model viewport initialization failed', error)
  }
}

watch(() => [props.model.elements, props.model.groups] as const, syncCubes, { deep: true })
watch(() => [props.selectedNodeId, props.selectedNodeIds] as const, () => {
  liveTransform.value = ''
  syncSelection()
}, { deep: true })
watch(() => [props.tool, props.controlMode, props.transformSpace] as const, () => {
  cancelDirectTouch()
  liveTransform.value = ''
  syncSelection()
  rebuildInflateHandles()
})
watch(() => props.inflateSource, () => {
  inflateTargetCubeId = undefined
  rebuildInflateHandles()
}, { deep: true })
watch(() => props.view, (view) => {
  cancelDirectTouch()
  if (drag) {
    const cancelled = drag
    drag = undefined
    emit('previewHierarchy', sessionBefore(cancelled.session))
    if (runtime?.renderer.domElement.hasPointerCapture(cancelled.pointerId)) {
      runtime.renderer.domElement.releasePointerCapture(cancelled.pointerId)
    }
    if (runtime) runtime.controls.enabled = true
    liveTransform.value = ''
  }
  applyCameraView(view)
})
watch(() => props.lowPower, resize)
watch(() => props.cameraSettings, () => {
  if (!runtime) return
  applyStudioCameraSettings(runtime.controls, currentCameraSettings())
  renderScene()
}, { deep: true })
watch(() => props.interactionLocked, (locked) => {
  if (locked) cancelDirectTouch()
  if (runtime) runtime.controls.enabled = !locked
})
watch(() => props.isolatedElementIds, syncCubes, { deep: true })

onMounted(() => void initialize())

onBeforeUnmount(() => {
  if (directTouch) clearTimeout(directTouch.timer)
  resizeObserver?.disconnect()
  if (!runtime) return
  runtime.renderer.domElement.removeEventListener('pointerdown', onPointerDown, { capture: true })
  runtime.renderer.domElement.removeEventListener('pointermove', onPointerMove)
  runtime.renderer.domElement.removeEventListener('pointerup', finishDrag)
  runtime.renderer.domElement.removeEventListener('pointercancel', finishDrag)
  runtime.controls.removeEventListener('change', renderScene)
  runtime.controls.removeEventListener('end', onControlsEnd)
  for (const mesh of cubeMeshes.values()) mesh.geometry.dispose()
  cubeMeshes.clear()
  disposeStudioThreeSceneRuntime(runtime)
  runtime = undefined
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
    <BackgroundGuideLayer
      :background="background"
      :custom-url="background.customAssetId ? assetUrls[background.customAssetId] : undefined"
      :references="isolatedElementIds?.length ? [] : model.references"
      :view="view"
      :asset-urls="assetUrls"
      @background-error="emit('error', locale.t('Addons Studio could not restore this editor background from local storage.'))"
      @guide-error="emit('error', locale.t('Addons Studio could not restore this reference image from local storage.'))"
    />
    <div v-if="webglError" class="viewport-error" role="alert">
      <strong>{{ locale.t('3D unavailable') }}</strong>
      <span>{{ webglError }}</span>
    </div>
    <div v-else class="viewport-hud" aria-hidden="true">
      <span><i class="axis-x" />X</span>
      <span><i class="axis-y" />Y</span>
      <span><i class="axis-z" />Z</span>
    </div>
    <ViewportQuickControls
      :view="view"
      :transform-space="transformSpace"
      :can-maximize="canMaximize"
      :maximized="maximized"
      @update-view="emit('updateView', $event)"
      @update-transform-space="emit('updateTransformSpace', $event)"
      @toggle-maximize="emit('toggleMaximize')"
    />
    <div v-if="selectedIds().length" class="selection-label">
      {{ selectedIds().length > 1 ? `${selectedIds().length} ${locale.t('objects selected')}` : selectedNode()?.name }}
    </div>
    <output v-if="liveTransform" class="transform-value" aria-live="polite">{{ liveTransform }}</output>
    <div v-else-if="active && !webglError" class="gesture-help">
      <template v-if="tool === 'inflate'">{{ locale.t(inflateSource ? 'Tap a target cube, then its matching point' : 'Tap a yellow source point on the selected cube') }}</template>
      <template v-else>{{ locale.t('Empty drag: orbit · Pinch: zoom · Two fingers: pan') }}{{ controlMode === 'gizmos' ? '' : ` · ${locale.t('Hold object: Touch Gizmo')}` }}</template>
    </div>
  </div>
</template>

<style scoped>
.model-viewport { position: relative; min-width: 0; min-height: 12rem; overflow: hidden; background: #0a0d10; isolation: isolate; border: 1px solid transparent; }
.model-viewport--active { border-color: #3ca967; }
.model-viewport :deep(.model-canvas) { position: relative; z-index: 2; width: 100%; height: 100%; display: block; outline: 0; }
.viewport-error { position: absolute; z-index: 6; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.45rem; padding: 2rem; background: #0b0e11; color: #fff; text-align: center; }
.viewport-error span { max-width: 22rem; color: #aeb8b2; font-size: 0.78rem; line-height: 1.45; }
.viewport-hud { position: absolute; z-index: 2; top: 0.65rem; left: max(0.65rem, env(safe-area-inset-left)); display: flex; gap: 0.5rem; border: 1px solid rgb(255 255 255 / 0.1); border-radius: 999px; padding: 0.3rem 0.5rem; background: rgb(5 8 7 / 0.72); color: #dce4df; font-family: var(--font-mono); font-size: 0.62rem; pointer-events: none; }
.viewport-hud span { display: flex; align-items: center; gap: 0.2rem; }
.viewport-hud i { width: 0.42rem; height: 0.42rem; border-radius: 50%; }
.axis-x { background: #f05d68; }.axis-y { background: #4fd178; }.axis-z { background: #4f9ff5; }
.selection-label, .transform-value, .gesture-help { position: absolute; z-index: 2; left: 50%; transform: translateX(-50%); border: 1px solid rgb(255 255 255 / 0.11); border-radius: 999px; padding: 0.3rem 0.6rem; background: rgb(5 8 7 / 0.76); color: #f1f5f2; font-size: 0.64rem; font-weight: 720; pointer-events: none; white-space: nowrap; }
.selection-label { top: 0.65rem; }.transform-value { bottom: 0.65rem; color: #f4d76d; font-family: var(--font-mono); }.gesture-help { bottom: 0.65rem; color: #b8c4bd; }
</style>
