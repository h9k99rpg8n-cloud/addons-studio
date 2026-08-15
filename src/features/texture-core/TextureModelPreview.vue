<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

import { elementCenter } from '@/core/model/modelHierarchy'
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
let objectUrl: string | undefined
let pointerStart: { id: number; x: number; y: number } | undefined
const meshes: THREE.Mesh[] = []
const ownedMaterials: THREE.MeshStandardMaterial[] = []
const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()

const materialIndexToFace: readonly TextureFace[] = ['east', 'west', 'up', 'down', 'south', 'north']

function render(): void {
  if (renderer && scene && camera) renderer.render(scene, camera)
}

function disposeMaterials(): void {
  ownedMaterials.splice(0).forEach((entry) => entry.dispose())
}

function disposeMeshes(): void {
  if (!scene) return
  for (const mesh of meshes.splice(0)) {
    scene.remove(mesh)
    mesh.geometry.dispose()
  }
  disposeMaterials()
}

function disposeTextureUrl(): void {
  if (objectUrl) URL.revokeObjectURL(objectUrl)
  objectUrl = undefined
}

async function loadTexture(): Promise<void> {
  textureMap?.dispose()
  textureMap = undefined
  disposeTextureUrl()
  if (!props.texture) return
  objectUrl = URL.createObjectURL(props.texture.blob)
  textureMap = await new THREE.TextureLoader().loadAsync(objectUrl)
  textureMap.magFilter = THREE.NearestFilter
  textureMap.minFilter = THREE.NearestFilter
  textureMap.colorSpace = THREE.SRGBColorSpace
  textureMap.generateMipmaps = false
  textureMap.needsUpdate = true
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
  const selectedCube = cubeId === props.selectedCubeId
  return materialIndexToFace.map((face) => createFaceMaterial(
    selectedCube && face === props.selectedFace,
    selectedCube,
  ))
}

function modelBounds(): THREE.Box3 {
  const bounds = new THREE.Box3()
  for (const cube of props.model.elements) {
    const center = elementCenter(cube)
    bounds.expandByPoint(new THREE.Vector3(center.x - cube.size.x / 2, center.y - cube.size.y / 2, center.z - cube.size.z / 2))
    bounds.expandByPoint(new THREE.Vector3(center.x + cube.size.x / 2, center.y + cube.size.y / 2, center.z + cube.size.z / 2))
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
  await loadTexture()
  rebuildMeshes(false)
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
  if (event.isPrimary === false) return
  pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY }
}

function onPointerUp(event: PointerEvent): void {
  if (!camera || !pointerStart || pointerStart.id !== event.pointerId) return
  const moved = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y)
  pointerStart = undefined
  if (moved > 8) return
  setPointer(event)
  raycaster.setFromCamera(pointer, camera)
  const hit = raycaster.intersectObjects(meshes, false)[0]
  if (!hit) return
  const cubeId = String(hit.object.userData.cubeId ?? '')
  if (!cubeId) return
  const materialIndex = hit.face?.materialIndex ?? 0
  const face = materialIndexToFace[materialIndex] ?? 'north'
  emit('selectCube', cubeId)
  emit('selectFace', face)
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
  observer = new ResizeObserver(resize)
  observer.observe(host.value)
  resize()
  await loadTexture()
  rebuildMeshes(true)
})

watch(() => props.model, () => rebuildMeshes(true), { deep: true })
watch(() => props.texture, () => { void rebuildTexture() }, { deep: true })
watch(() => [props.selectedCubeId, props.selectedFace] as const, refreshSelectionMaterials)

onBeforeUnmount(() => {
  observer?.disconnect()
  controls?.removeEventListener('change', render)
  controls?.dispose()
  if (renderer) {
    renderer.domElement.removeEventListener('pointerdown', onPointerDown)
    renderer.domElement.removeEventListener('pointerup', onPointerUp)
  }
  disposeMeshes()
  textureMap?.dispose()
  disposeTextureUrl()
  renderer?.dispose()
  renderer?.domElement.remove()
})
</script>

<template>
  <div ref="host" class="texture-preview" />
</template>

<style scoped>
.texture-preview { width: 100%; height: 100%; min-height: 11rem; overflow: hidden; background: #111613; touch-action: none; }
.texture-preview :deep(canvas) { display: block; width: 100%; height: 100%; }
</style>
