<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

import { elementCenter } from '@/core/model/modelHierarchy'
import type { StudioModel } from '@/types/model'
import type { StudioTextureAsset } from '@/types/texture'

const props = defineProps<{
  model: StudioModel
  texture?: StudioTextureAsset
}>()

const host = ref<HTMLDivElement>()
let renderer: THREE.WebGLRenderer | undefined
let scene: THREE.Scene | undefined
let camera: THREE.PerspectiveCamera | undefined
let controls: OrbitControls | undefined
let observer: ResizeObserver | undefined
let material: THREE.MeshStandardMaterial | undefined
let objectUrl: string | undefined
const meshes: THREE.Mesh[] = []

function disposeMeshes(): void {
  if (!scene) return
  for (const mesh of meshes.splice(0)) {
    scene.remove(mesh)
    mesh.geometry.dispose()
  }
}

function disposeTextureUrl(): void {
  if (objectUrl) URL.revokeObjectURL(objectUrl)
  objectUrl = undefined
}

async function createMaterial(): Promise<THREE.MeshStandardMaterial> {
  material?.map?.dispose()
  material?.dispose()
  disposeTextureUrl()
  if (!props.texture) {
    material = new THREE.MeshStandardMaterial({ color: 0xc8d2ca, roughness: 0.88, metalness: 0.04 })
    return material
  }
  objectUrl = URL.createObjectURL(props.texture.blob)
  const texture = await new THREE.TextureLoader().loadAsync(objectUrl)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9, metalness: 0.02 })
  return material
}

function modelCenter(): THREE.Vector3 {
  if (!props.model.elements.length) return new THREE.Vector3(0, 0, 0)
  const bounds = new THREE.Box3()
  for (const cube of props.model.elements) {
    const center = elementCenter(cube)
    bounds.expandByPoint(new THREE.Vector3(center.x - cube.size.x / 2, center.y - cube.size.y / 2, center.z - cube.size.z / 2))
    bounds.expandByPoint(new THREE.Vector3(center.x + cube.size.x / 2, center.y + cube.size.y / 2, center.z + cube.size.z / 2))
  }
  return bounds.getCenter(new THREE.Vector3())
}

async function rebuild(): Promise<void> {
  if (!scene) return
  disposeMeshes()
  const nextMaterial = await createMaterial()
  for (const cube of props.model.elements) {
    const center = elementCenter(cube)
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(cube.size.x, cube.size.y, cube.size.z), nextMaterial)
    mesh.position.set(center.x, center.y, center.z)
    mesh.rotation.set(
      THREE.MathUtils.degToRad(cube.rotation.x),
      THREE.MathUtils.degToRad(cube.rotation.y),
      THREE.MathUtils.degToRad(cube.rotation.z),
    )
    scene.add(mesh)
    meshes.push(mesh)
  }
  const target = modelCenter()
  controls?.target.copy(target)
  const radius = Math.max(8, props.model.elements.reduce((max, cube) => Math.max(max, cube.size.x, cube.size.y, cube.size.z), 1) * 3.4)
  camera?.position.set(target.x + radius, target.y + radius * 0.75, target.z + radius)
  camera?.lookAt(target)
  controls?.update()
  renderer?.render(scene, camera!)
}

function resize(): void {
  if (!host.value || !renderer || !camera || !scene) return
  const width = Math.max(1, host.value.clientWidth)
  const height = Math.max(1, host.value.clientHeight)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 1.5))
  renderer.setSize(width, height, false)
  renderer.render(scene, camera)
}

onMounted(async () => {
  if (!host.value) return
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x151917)
  camera = new THREE.PerspectiveCamera(40, 1, 0.01, 10000)
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  host.value.appendChild(renderer.domElement)
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = false
  controls.enablePan = true
  controls.rotateSpeed = 0.7
  controls.zoomSpeed = 0.8
  controls.addEventListener('change', () => {
    if (renderer && scene && camera) renderer.render(scene, camera)
  })
  scene.add(new THREE.HemisphereLight(0xffffff, 0x33413a, 2.2))
  const key = new THREE.DirectionalLight(0xffffff, 2.6)
  key.position.set(12, 18, 10)
  scene.add(key)
  const grid = new THREE.GridHelper(64, 32, 0x4f8062, 0x2d3932)
  scene.add(grid)
  observer = new ResizeObserver(resize)
  observer.observe(host.value)
  resize()
  await rebuild()
})

watch(() => [props.model, props.texture] as const, () => { void rebuild() }, { deep: true })

onBeforeUnmount(() => {
  observer?.disconnect()
  controls?.dispose()
  disposeMeshes()
  material?.map?.dispose()
  material?.dispose()
  disposeTextureUrl()
  renderer?.dispose()
  renderer?.domElement.remove()
})
</script>

<template>
  <div ref="host" class="texture-preview" />
</template>

<style scoped>
.texture-preview { width: 100%; height: 100%; min-height: 13rem; overflow: hidden; background: #151917; touch-action: none; }
.texture-preview :deep(canvas) { display: block; width: 100%; height: 100%; }
</style>
