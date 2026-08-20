<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

import { elementCenter, isNodeEffectivelyVisible } from '@/core/model/modelHierarchy'
import type { StudioModel } from '@/types/model'
import type { StudioTextureAsset, TextureFace } from '@/types/texture'

const props = defineProps<{
  model: StudioModel
  texture?: StudioTextureAsset
  selectedCubeId?: string
  selectedFace?: TextureFace
}>()

const emit = defineEmits<{
  selectCube: [cubeId: string]
  selectFace: [face: TextureFace]
}>()

const host = ref<HTMLDivElement>()
let renderer: THREE.WebGLRenderer | undefined
let scene: THREE.Scene | undefined
let camera: THREE.PerspectiveCamera | undefined
let controls: OrbitControls | undefined
let observer: ResizeObserver | undefined
let textureMap: THREE.Texture | undefined
let pointerStart: { id: number; x: number; y: number } | undefined
let textureLoadGeneration = 0
const meshes: THREE.Mesh[] = []
const ownedMaterials: THREE.MeshStandardMaterial[] = []
let materialSet: {
  base: THREE.MeshStandardMaterial
  cube: THREE.MeshStandardMaterial
  face: THREE.MeshStandardMaterial
} | undefined
const activePointers = new Set<number>()
const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()

const materialIndexToFace: readonly TextureFace[] = ['east', 'west', 'up', 'down', 'south', 'north']

function render(): void {
  if (renderer && scene && camera) renderer.render(scene, camera)
}

function disposeMaterials(): void {
  ownedMaterials.splice(0).forEach((entry) => entry.dispose())
  materialSet = undefined
}

function disposeMeshes(): void {
  if (!scene) return
  for (const mesh of meshes.splice(0)) {
    scene.remove(mesh)
    mesh.geometry.dispose()
  }
  disposeMaterials()
}

async function loadTexture(): Promise<boolean> {
  const generation = ++textureLoadGeneration
  textureMap?.dispose()
  textureMap = undefined
  if (!props.texture) return true
  const objectUrl = URL.createObjectURL(props.texture.blob)
  try {
    const loaded = await new THREE.TextureLoader().loadAsync(objectUrl)
    if (generation !== textureLoadGeneration) {
      loaded.dispose()
      return false
    }
    loaded.magFilter = THREE.NearestFilter
    loaded.minFilter = THREE.NearestFilter
    loaded.colorSpace = THREE.SRGBColorSpace
    loaded.generateMipmaps = false
    loaded.needsUpdate = true
    textureMap = loaded
    return true
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function createFaceMaterial(selected: boolean, selectedCube: boolean): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    map: textureMap,
    color: selected ? 0xb9ffd0 : selectedCube ? 0xe4f3e9 : 0xcbd4ce,
    roughness: 0.88,
    metalness: 0.025,
    emissive: selected ? 0x164522 : 0x000000,
    emissiveIntensity: selected ? 0.55 : 0,
  })
  ownedMaterials.push(material)
  return material
}

function materialsForCube(cubeId: string): THREE.MeshStandardMaterial[] {
  materialSet ??= {
    base: createFaceMaterial(false, false),
    cube: createFaceMaterial(false, true),
    face: createFaceMaterial(true, true),
  }
  const selectedCube = cubeId === props.selectedCubeId
  return materialIndexToFace.map((face) => selectedCube && face === props.selectedFace
    ? materialSet!.face
    : selectedCube
      ? materialSet!.cube
      : materialSet!.base)
}

function modelBounds(): THREE.Box3 {
  const bounds = new THREE.Box3()
  for (const mesh of meshes) {
    if (!mesh.visible) continue
    mesh.updateMatrixWorld(true)
    bounds.expandByObject(mesh, true)
  }
  if (bounds.isEmpty()) bounds.setFromCenterAndSize(new THREE.Vector3(), new THREE.Vector3(1, 1, 1))
  return bounds
}

function fitCamera(): void {
  if (!camera || !controls) return
  const bounds = modelBounds()
  const target = bounds.getCenter(new THREE.Vector3())
  const size = bounds.getSize(new THREE.Vector3())
  const radius = Math.max(0.75, size.length() * 0.5)
  const halfFov = THREE.MathUtils.degToRad(camera.fov * 0.5)
  const distance = Math.max(3.2, Math.min(280, radius / Math.max(0.15, Math.sin(halfFov)) * 1.08))
  const direction = new THREE.Vector3(1, 0.72, 1).normalize()
  controls.target.copy(target)
  camera.position.copy(target).add(direction.multiplyScalar(distance))
  camera.near = Math.max(0.01, distance / 500)
  camera.far = Math.max(500, distance * 30)
  camera.updateProjectionMatrix()
  camera.lookAt(target)
  controls.update()
}

function rebuildMeshes(fit = false): void {
  if (!scene) return
  disposeMeshes()
  for (const cube of props.model.elements) {
    const center = elementCenter(cube)
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(cube.size.x, cube.size.y, cube.size.z),
      materialsForCube(cube.id),
    )
    mesh.position.set(center.x, center.y, center.z)
    mesh.rotation.set(
      THREE.MathUtils.degToRad(cube.rotation.x),
      THREE.MathUtils.degToRad(cube.rotation.y),
      THREE.MathUtils.degToRad(cube.rotation.z),
    )
    mesh.userData.cubeId = cube.id
    mesh.visible = isNodeEffectivelyVisible(props.model, cube)
    scene.add(mesh)
    meshes.push(mesh)
  }
  if (fit) fitCamera()
  render()
}

function refreshSelectionMaterials(): void {
  disposeMaterials()
  for (const mesh of meshes) {
    mesh.material = materialsForCube(String(mesh.userData.cubeId ?? ''))
  }
  render()
}

async function rebuildTexture(): Promise<void> {
  try {
    if (await loadTexture()) rebuildMeshes(false)
  } catch {
    rebuildMeshes(false)
  }
}

function resize(): void {
  if (!host.value || !renderer || !camera) return
  const width = Math.max(1, host.value.clientWidth)
  const height = Math.max(1, host.value.clientHeight)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 1.5))
  renderer.setSize(width, height, false)
  render()
}

function setPointer(event: PointerEvent): void {
  const rect = renderer?.domElement.getBoundingClientRect()
  if (!rect) return
  pointer.x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1
  pointer.y = -((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1
}

function onPointerDown(event: PointerEvent): void {
  activePointers.add(event.pointerId)
  if (activePointers.size > 1 || event.isPrimary === false) {
    pointerStart = undefined
    return
  }
  try { renderer?.domElement.setPointerCapture(event.pointerId) } catch { /* Safari released it. */ }
  pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY }
}

function onPointerUp(event: PointerEvent): void {
  activePointers.delete(event.pointerId)
  try {
    if (renderer?.domElement.hasPointerCapture(event.pointerId)) {
      renderer.domElement.releasePointerCapture(event.pointerId)
    }
  } catch { /* Pointer capture already ended. */ }
  if (!camera || !pointerStart || pointerStart.id !== event.pointerId) return
  const moved = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y)
  pointerStart = undefined
  if (moved > 8) return
  setPointer(event)
  raycaster.setFromCamera(pointer, camera)
  const hit = raycaster.intersectObjects(meshes.filter((mesh) => mesh.visible), false)[0]
  if (!hit) return
  const cubeId = String(hit.object.userData.cubeId ?? '')
  if (!cubeId) return
  const materialIndex = hit.face?.materialIndex ?? 0
  const face = materialIndexToFace[materialIndex] ?? 'north'
  emit('selectCube', cubeId)
  emit('selectFace', face)
}

function onPointerCancel(event: PointerEvent): void {
  activePointers.delete(event.pointerId)
  if (pointerStart?.id === event.pointerId) pointerStart = undefined
  try {
    if (renderer?.domElement.hasPointerCapture(event.pointerId)) {
      renderer.domElement.releasePointerCapture(event.pointerId)
    }
  } catch { /* Pointer capture already ended. */ }
}

onMounted(async () => {
  if (!host.value) return
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x111613)
  camera = new THREE.PerspectiveCamera(42, 1, 0.01, 10000)
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.domElement.style.touchAction = 'none'
  host.value.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = false
  controls.enablePan = true
  controls.rotateSpeed = 0.72
  controls.panSpeed = 0.9
  controls.zoomSpeed = 0.85
  controls.minDistance = 1.4
  controls.maxDistance = 500
  controls.touches.ONE = THREE.TOUCH.ROTATE
  controls.touches.TWO = THREE.TOUCH.DOLLY_PAN
  controls.addEventListener('change', render)

  scene.add(new THREE.HemisphereLight(0xe9fff0, 0x27342d, 2.15))
  const key = new THREE.DirectionalLight(0xffffff, 2.45)
  key.position.set(12, 18, 10)
  scene.add(key)
  const grid = new THREE.GridHelper(256, 64, 0x4d8662, 0x28382f)
  scene.add(grid)

  renderer.domElement.addEventListener('pointerdown', onPointerDown)
  renderer.domElement.addEventListener('pointerup', onPointerUp)
  renderer.domElement.addEventListener('pointercancel', onPointerCancel)
  renderer.domElement.addEventListener('lostpointercapture', onPointerCancel)
  observer = new ResizeObserver(resize)
  observer.observe(host.value)
  resize()
  try { await loadTexture() } catch { /* The untextured preview remains usable. */ }
  rebuildMeshes(true)
})

watch(() => [props.model.id, props.model.revision] as const, () => rebuildMeshes(true))
watch(() => [props.texture?.id, props.texture?.updatedAt] as const, () => { void rebuildTexture() })
watch(() => [props.selectedCubeId, props.selectedFace] as const, refreshSelectionMaterials)

onBeforeUnmount(() => {
  observer?.disconnect()
  controls?.removeEventListener('change', render)
  controls?.dispose()
  if (renderer) {
    renderer.domElement.removeEventListener('pointerdown', onPointerDown)
    renderer.domElement.removeEventListener('pointerup', onPointerUp)
    renderer.domElement.removeEventListener('pointercancel', onPointerCancel)
    renderer.domElement.removeEventListener('lostpointercapture', onPointerCancel)
  }
  disposeMeshes()
  textureMap?.dispose()
  textureLoadGeneration += 1
  activePointers.clear()
  scene?.traverse((object) => {
    const disposable = object as THREE.Object3D & {
      geometry?: THREE.BufferGeometry
      material?: THREE.Material | THREE.Material[]
    }
    disposable.geometry?.dispose()
    if (Array.isArray(disposable.material)) disposable.material.forEach((material) => material.dispose())
    else disposable.material?.dispose()
  })
  renderer?.setAnimationLoop(null)
  renderer?.dispose()
  renderer?.forceContextLoss()
  renderer?.domElement.remove()
})
</script>

<template>
  <div ref="host" class="texture-preview" @contextmenu.prevent />
</template>

<style scoped>
.texture-preview { width: 100%; height: 100%; min-height: 9rem; overflow: hidden; background: #111613; touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
.texture-preview :deep(canvas) { display: block; width: 100%; height: 100%; }
</style>
