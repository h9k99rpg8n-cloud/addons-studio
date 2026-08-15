<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import AppButton from '@/components/common/AppButton.vue'
import AppDialog from '@/components/common/AppDialog.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import IconButton from '@/components/common/IconButton.vue'
import StudioIcon from '@/components/common/StudioIcon.vue'
import { toAppError } from '@/core/errors/AppError'
import { modelRepository } from '@/core/model/modelRepository'
import { textureRepository } from '@/core/texture/textureRepository'
import { textureUvService } from '@/core/texture/textureUvService'
import { useLocaleStore } from '@/stores/locale'
import { useToastStore } from '@/stores/toasts'
import type { StudioModel } from '@/types/model'
import type { StudioMaterial, StudioTextureAsset, StudioTextureBinding, StudioUvRect, TextureFace } from '@/types/texture'

import MaterialSwatch from './MaterialSwatch.vue'
import TextureModelPreview from './TextureModelPreview.vue'
import TextureUvWorkspace from './TextureUvWorkspace.vue'

const props = defineProps<{ projectId: string; modelId: string }>()
const router = useRouter()
const locale = useLocaleStore()
const toasts = useToastStore()

const model = ref<StudioModel>()
const materials = ref<StudioMaterial[]>([])
const assets = ref<StudioTextureAsset[]>([])
const bindings = ref<StudioTextureBinding[]>([])
const loading = ref(true)
const loadError = ref('')
const busy = ref(false)
const createOpen = ref(false)
const materialName = ref('Material')
const selectedMaterialId = ref('')
const selectedCubeId = ref('')
const selectedFace = ref<TextureFace>('north')
const mode = ref<'material' | 'uv' | 'paint'>('uv')
const inspectorOpen = ref(false)
const paintTool = ref<'pencil' | 'eraser' | 'fill' | 'eyedropper' | 'inspect'>('pencil')
const paintColor = ref('#4f8f62')
const brushSize = ref(1)
const paintZoom = ref(10)
const pixelInfo = ref<{ x: number; y: number; color: string; alpha: number }>()
const previewHeight = ref(270)
const canvas = ref<HTMLCanvasElement>()
const canvasScroll = ref<HTMLDivElement>()
const importInput = ref<HTMLInputElement>()
const history = ref<ImageData[]>([])
const future = ref<ImageData[]>([])
const dirty = ref(false)
let activeObjectUrl: string | undefined
let dividerPointer: { id: number; startY: number; startHeight: number } | undefined
let uvSaveTimer: ReturnType<typeof setTimeout> | undefined
const paintTouches = new Map<number, { x: number; y: number }>()
let pinchStartDistance = 0
let pinchStartZoom = 10
let pinchStartCentroid = { x: 0, y: 0 }
let pinchStartScroll = { left: 0, top: 0 }

const faces: readonly TextureFace[] = ['north', 'south', 'east', 'west', 'up', 'down']
const selectedMaterial = computed(() => materials.value.find((entry) => entry.id === selectedMaterialId.value))
const selectedAsset = computed(() => assets.value.find((entry) => entry.id === selectedMaterial.value?.textureAssetId))
const selectedCube = computed(() => model.value?.elements.find((entry) => entry.id === selectedCubeId.value))
const selectedBinding = computed(() => bindings.value.find((entry) => entry.cubeId === selectedCubeId.value && entry.face === selectedFace.value))
const selectedFaceMaterial = computed(() => materials.value.find((entry) => entry.id === selectedBinding.value?.materialId))
const editorStyle = computed(() => ({ '--preview-height': `${previewHeight.value}px` }))

function assetForMaterial(material: StudioMaterial): StudioTextureAsset | undefined {
  return assets.value.find((entry) => entry.id === material.textureAssetId)
}

function faceLabel(face: TextureFace): string {
  return locale.t(face[0]!.toUpperCase() + face.slice(1))
}

async function loadWorkspace(): Promise<void> {
  loading.value = true
  loadError.value = ''
  try {
    const loadedModel = await modelRepository.getModel(props.modelId)
    if (!loadedModel || loadedModel.projectId !== props.projectId) throw new Error('Model unavailable')
    model.value = loadedModel
    selectedCubeId.value = loadedModel.elements[0]?.id ?? ''
    const workspace = await textureRepository.getWorkspace(props.modelId)
    materials.value = workspace.materials
    assets.value = workspace.assets
    bindings.value = workspace.bindings
    selectedMaterialId.value = workspace.materials[0]?.id ?? ''
  } catch (error) {
    loadError.value = toAppError(error, locale.t('Addons Studio could not open Texture Core.')).userMessage
  } finally {
    loading.value = false
  }
}

onMounted(loadWorkspace)

watch(selectedBinding, (binding) => {
  if (binding && materials.value.some((entry) => entry.id === binding.materialId)) {
    selectedMaterialId.value = binding.materialId
  }
})

watch(selectedAsset, async () => {
  await nextTick()
  await loadSelectedTextureIntoCanvas()
})

function cleanupObjectUrl(): void {
  if (activeObjectUrl) URL.revokeObjectURL(activeObjectUrl)
  activeObjectUrl = undefined
}

async function loadSelectedTextureIntoCanvas(): Promise<void> {
  const target = canvas.value
  const asset = selectedAsset.value
  if (!target) return
  history.value = []
  future.value = []
  dirty.value = false
  pixelInfo.value = undefined
  const ctx = target.getContext('2d', { willReadFrequently: true })
  if (!ctx) return
  if (!asset) {
    target.width = 32
    target.height = 32
    ctx.clearRect(0, 0, target.width, target.height)
    fitPaintCanvas()
    return
  }
  cleanupObjectUrl()
  activeObjectUrl = URL.createObjectURL(asset.blob)
  const image = new Image()
  image.decoding = 'async'
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('Texture decode failed'))
    image.src = activeObjectUrl!
  })
  target.width = asset.width
  target.height = asset.height
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, target.width, target.height)
  ctx.drawImage(image, 0, 0, target.width, target.height)
  fitPaintCanvas()
}

function fitPaintCanvas(): void {
  const width = canvas.value?.width ?? selectedAsset.value?.width ?? 32
  const available = Math.max(180, Math.min(globalThis.innerWidth - 28, 520))
  paintZoom.value = Math.max(2, Math.min(24, Math.floor(available / Math.max(1, width))))
}

function startCreateMaterial(): void {
  materialName.value = `Material ${materials.value.length + 1}`
  createOpen.value = true
}

async function createMaterial(): Promise<void> {
  busy.value = true
  try {
    const created = await textureRepository.createMaterial({ projectId: props.projectId, name: materialName.value })
    materials.value.push(created)
    selectedMaterialId.value = created.id
    createOpen.value = false
    toasts.push({ type: 'success', message: locale.t('Material created') })
  } catch (error) {
    toasts.push({ type: 'error', message: toAppError(error, locale.t('Addons Studio could not create this material.')).userMessage })
  } finally {
    busy.value = false
  }
}

function openTexturePicker(): void {
  if (!selectedMaterial.value) {
    toasts.push({ type: 'info', message: locale.t('Create or select a material first.') })
    return
  }
  importInput.value?.click()
}

async function importTexture(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !selectedMaterial.value) return
  busy.value = true
  try {
    const previousAssetId = selectedMaterial.value.textureAssetId
    const result = await textureRepository.importTexture(selectedMaterial.value.id, file)
    materials.value = materials.value.map((entry) => entry.id === result.material.id ? result.material : entry)
    if (previousAssetId) assets.value = assets.value.filter((entry) => entry.id !== previousAssetId)
    assets.value.push(result.asset)
    selectedMaterialId.value = result.material.id
    await nextTick()
    await loadSelectedTextureIntoCanvas()
    toasts.push({ type: 'success', message: locale.t('Texture imported successfully') })
  } catch (error) {
    toasts.push({ type: 'error', message: toAppError(error, locale.t('Addons Studio could not import this texture.')).userMessage })
  } finally {
    input.value = ''
    busy.value = false
  }
}

function canvasToBlob(target: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => target.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG encode failed')), 'image/png'))
}

async function createBlankTexture(size = 32): Promise<void> {
  if (!selectedMaterial.value) {
    toasts.push({ type: 'info', message: locale.t('Create or select a material first.') })
    return
  }
  const temp = document.createElement('canvas')
  temp.width = size
  temp.height = size
  temp.getContext('2d')!.clearRect(0, 0, size, size)
  const blob = await canvasToBlob(temp)
  const file = new File([blob], `${selectedMaterial.value.identifier}_${size}.png`, { type: 'image/png' })
  const previousAssetId = selectedMaterial.value.textureAssetId
  const result = await textureRepository.importTexture(selectedMaterial.value.id, file)
  materials.value = materials.value.map((entry) => entry.id === result.material.id ? result.material : entry)
  if (previousAssetId) assets.value = assets.value.filter((entry) => entry.id !== previousAssetId)
  assets.value.push(result.asset)
  selectedMaterialId.value = result.material.id
  await nextTick()
  await loadSelectedTextureIntoCanvas()
  mode.value = 'paint'
}

async function applyMaterialToFace(face = selectedFace.value): Promise<void> {
  if (!model.value || !selectedCube.value || !selectedMaterial.value) return
  const asset = selectedAsset.value
  try {
    const saved = await textureRepository.saveFaceBinding({
      projectId: props.projectId,
      modelId: props.modelId,
      cubeId: selectedCube.value.id,
      face,
      materialId: selectedMaterial.value.id,
      textureWidth: asset?.width ?? 16,
      textureHeight: asset?.height ?? 16,
    })
    const index = bindings.value.findIndex((entry) => entry.id === saved.id)
    if (index >= 0) bindings.value[index] = saved
    else bindings.value.push(saved)
    toasts.push({ type: 'success', message: locale.t('Material assigned to face') })
  } catch (error) {
    toasts.push({ type: 'error', message: toAppError(error, locale.t('Addons Studio could not assign this material.')).userMessage })
  }
}

async function applyMaterialToCube(): Promise<void> {
  if (!selectedCube.value || !selectedMaterial.value) return
  busy.value = true
  try {
    for (const face of faces) await applyMaterialToFace(face)
    toasts.push({ type: 'success', message: locale.t('Material assigned to cube') })
  } finally {
    busy.value = false
  }
}

function selectCube(cubeId: string): void {
  selectedCubeId.value = cubeId
}

function selectFace(face: TextureFace): void {
  selectedFace.value = face
  mode.value = 'uv'
}

function updateUvDraft(uv: StudioUvRect): void {
  const binding = selectedBinding.value
  if (!binding) return
  bindings.value = bindings.value.map((entry) => entry.id === binding.id ? { ...entry, uv: { ...uv } } : entry)
  if (uvSaveTimer) clearTimeout(uvSaveTimer)
  uvSaveTimer = setTimeout(() => { void persistUv(uv) }, 180)
}

async function persistUv(uv: StudioUvRect): Promise<void> {
  const binding = selectedBinding.value
  const asset = selectedAsset.value
  if (!binding) return
  if (uvSaveTimer) clearTimeout(uvSaveTimer)
  uvSaveTimer = undefined
  try {
    const saved = await textureUvService.updateBindingUv(binding.id, uv, asset?.width ?? 16, asset?.height ?? 16)
    bindings.value = bindings.value.map((entry) => entry.id === saved.id ? saved : entry)
  } catch (error) {
    toasts.push({ type: 'error', message: toAppError(error, locale.t('Addons Studio could not save this UV map.')).userMessage })
  }
}

function pushHistory(): void {
  const target = canvas.value
  const ctx = target?.getContext('2d', { willReadFrequently: true })
  if (!target || !ctx) return
  history.value.push(ctx.getImageData(0, 0, target.width, target.height))
  if (history.value.length > 40) history.value.shift()
  future.value = []
}

function restoreImage(data: ImageData): void {
  const target = canvas.value
  const ctx = target?.getContext('2d', { willReadFrequently: true })
  if (!target || !ctx) return
  ctx.putImageData(data, 0, 0)
  dirty.value = true
}

function undo(): void {
  const target = canvas.value
  const ctx = target?.getContext('2d', { willReadFrequently: true })
  const previous = history.value.pop()
  if (!target || !ctx || !previous) return
  future.value.push(ctx.getImageData(0, 0, target.width, target.height))
  restoreImage(previous)
}

function redo(): void {
  const target = canvas.value
  const ctx = target?.getContext('2d', { willReadFrequently: true })
  const next = future.value.pop()
  if (!target || !ctx || !next) return
  history.value.push(ctx.getImageData(0, 0, target.width, target.height))
  restoreImage(next)
}

function pointerPixel(event: PointerEvent): { x: number; y: number } | undefined {
  const target = canvas.value
  if (!target) return undefined
  const rect = target.getBoundingClientRect()
  const x = Math.floor((event.clientX - rect.left) / Math.max(1, rect.width) * target.width)
  const y = Math.floor((event.clientY - rect.top) / Math.max(1, rect.height) * target.height)
  if (x < 0 || y < 0 || x >= target.width || y >= target.height) return undefined
  return { x, y }
}

function hexToRgba(hex: string): [number, number, number, number] {
  const value = Number.parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255, 255]
}

function rgbaToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`
}

function floodFill(ctx: CanvasRenderingContext2D, x: number, y: number, replacement: [number, number, number, number]): void {
  const width = ctx.canvas.width
  const height = ctx.canvas.height
  const image = ctx.getImageData(0, 0, width, height)
  const data = image.data
  const start = (y * width + x) * 4
  const target = [data[start], data[start + 1], data[start + 2], data[start + 3]]
  if (target.every((value, index) => value === replacement[index])) return
  const stack: [number, number][] = [[x, y]]
  while (stack.length) {
    const [px, py] = stack.pop()!
    if (px < 0 || py < 0 || px >= width || py >= height) continue
    const offset = (py * width + px) * 4
    if (!target.every((value, index) => data[offset + index] === value)) continue
    data[offset] = replacement[0]
    data[offset + 1] = replacement[1]
    data[offset + 2] = replacement[2]
    data[offset + 3] = replacement[3]
    stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1])
  }
  ctx.putImageData(image, 0, 0)
}

function paintAt(event: PointerEvent, first = false): void {
  const target = canvas.value
  const point = pointerPixel(event)
  const ctx = target?.getContext('2d', { willReadFrequently: true })
  if (!target || !ctx || !point) return
  const pixel = ctx.getImageData(point.x, point.y, 1, 1).data
  if (paintTool.value === 'inspect') {
    pixelInfo.value = { x: point.x, y: point.y, color: rgbaToHex(pixel[0]!, pixel[1]!, pixel[2]!), alpha: pixel[3]! }
    return
  }
  if (first) pushHistory()
  if (paintTool.value === 'eyedropper') {
    paintColor.value = rgbaToHex(pixel[0]!, pixel[1]!, pixel[2]!)
    paintTool.value = 'pencil'
    return
  }
  if (paintTool.value === 'fill') {
    floodFill(ctx, point.x, point.y, hexToRgba(paintColor.value))
    dirty.value = true
    return
  }
  const size = brushSize.value
  if (paintTool.value === 'eraser') ctx.clearRect(point.x, point.y, size, size)
  else {
    ctx.fillStyle = paintColor.value
    ctx.fillRect(point.x, point.y, size, size)
  }
  dirty.value = true
}

function touchDistance(): number {
  const values = [...paintTouches.values()]
  if (values.length < 2) return 0
  return Math.hypot(values[0]!.x - values[1]!.x, values[0]!.y - values[1]!.y)
}

function touchCentroid(): { x: number; y: number } {
  const values = [...paintTouches.values()]
  if (values.length < 2) return values[0] ?? { x: 0, y: 0 }
  return { x: (values[0]!.x + values[1]!.x) / 2, y: (values[0]!.y + values[1]!.y) / 2 }
}

function pointerDown(event: PointerEvent): void {
  if (mode.value !== 'paint') return
  if (event.pointerType === 'touch') {
    paintTouches.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (paintTouches.size === 2) {
      pinchStartDistance = touchDistance()
      pinchStartZoom = paintZoom.value
      pinchStartCentroid = touchCentroid()
      pinchStartScroll = { left: canvasScroll.value?.scrollLeft ?? 0, top: canvasScroll.value?.scrollTop ?? 0 }
      return
    }
  }
  canvas.value?.setPointerCapture(event.pointerId)
  paintAt(event, true)
}

function pointerMove(event: PointerEvent): void {
  if (mode.value !== 'paint') return
  if (event.pointerType === 'touch' && paintTouches.has(event.pointerId)) {
    paintTouches.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (paintTouches.size >= 2 && pinchStartDistance > 0) {
      event.preventDefault()
      const ratio = touchDistance() / pinchStartDistance
      paintZoom.value = Math.max(2, Math.min(32, Math.round(pinchStartZoom * ratio * 10) / 10))
      const centroid = touchCentroid()
      if (canvasScroll.value) {
        canvasScroll.value.scrollLeft = pinchStartScroll.left - (centroid.x - pinchStartCentroid.x)
        canvasScroll.value.scrollTop = pinchStartScroll.top - (centroid.y - pinchStartCentroid.y)
      }
      return
    }
  }
  if (!canvas.value?.hasPointerCapture(event.pointerId)) return
  if (paintTool.value === 'fill' || paintTool.value === 'eyedropper') return
  paintAt(event)
}

function pointerUp(event: PointerEvent): void {
  paintTouches.delete(event.pointerId)
  if (paintTouches.size < 2) pinchStartDistance = 0
  if (canvas.value?.hasPointerCapture(event.pointerId)) canvas.value.releasePointerCapture(event.pointerId)
}

async function saveTexture(): Promise<void> {
  const target = canvas.value
  const asset = selectedAsset.value
  if (!target || !asset) return
  busy.value = true
  try {
    const saved = await textureRepository.replaceTexturePixels(asset.id, await canvasToBlob(target), target.width, target.height)
    assets.value = assets.value.map((entry) => entry.id === saved.id ? saved : entry)
    dirty.value = false
    toasts.push({ type: 'success', message: locale.t('Texture saved') })
  } catch (error) {
    toasts.push({ type: 'error', message: toAppError(error, locale.t('Addons Studio could not save this texture.')).userMessage })
  } finally {
    busy.value = false
  }
}

function startDivider(event: PointerEvent): void {
  const target = event.currentTarget as HTMLElement
  target.setPointerCapture(event.pointerId)
  dividerPointer = { id: event.pointerId, startY: event.clientY, startHeight: previewHeight.value }
}

function moveDivider(event: PointerEvent): void {
  if (!dividerPointer || dividerPointer.id !== event.pointerId) return
  previewHeight.value = Math.max(180, Math.min(globalThis.innerHeight * 0.58, dividerPointer.startHeight + event.clientY - dividerPointer.startY))
}

function finishDivider(event: PointerEvent): void {
  if (!dividerPointer || dividerPointer.id !== event.pointerId) return
  const target = event.currentTarget as HTMLElement
  if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId)
  dividerPointer = undefined
}

onBeforeUnmount(() => {
  cleanupObjectUrl()
  if (uvSaveTimer) clearTimeout(uvSaveTimer)
})
</script>

<template>
  <main class="texture-core-view">
    <header class="topbar">
      <IconButton icon="arrow-left" :label="locale.t('Back to Texture Core')" @click="router.push({ name: 'texture-models', params: { projectId } })" />
      <div class="title-stack"><strong>{{ model?.name ?? locale.t('Texture Core') }}</strong><small>{{ dirty ? locale.t('Unsaved texture changes') : locale.t('Saved') }}</small></div>
      <div class="top-actions">
        <IconButton icon="info" :label="locale.t('Inspector')" variant="surface" @click="inspectorOpen = !inspectorOpen" />
        <IconButton icon="save" :label="locale.t('Save texture')" :disabled="!dirty || busy" variant="surface" @click="saveTexture" />
      </div>
    </header>

    <section v-if="loading" class="loading-state"><div class="spinner" /><strong>{{ locale.t('Preparing Texture Core…') }}</strong><small>{{ locale.t('Loading geometry, materials, and texture workspace') }}</small></section>
    <section v-else-if="loadError || !model" class="error-state"><AppIcon name="alert-triangle" :size="34" /><h1>{{ locale.t('Texture Core unavailable') }}</h1><p>{{ loadError }}</p></section>

    <section v-else class="editor-shell" :style="editorStyle">
      <section class="preview-shell">
        <TextureModelPreview
          :model="model"
          :texture="selectedAsset"
          :selected-cube-id="selectedCubeId"
          :selected-face="selectedFace"
          @select-cube="selectCube"
          @select-face="selectFace"
        />
        <div class="preview-hud">
          <span>{{ selectedCube?.name ?? locale.t('Select a cube') }}</span>
          <b>{{ faceLabel(selectedFace) }}</b>
        </div>
        <div class="cube-strip" aria-label="Cubes">
          <button v-for="cube in model.elements" :key="cube.id" type="button" :class="{ active: cube.id === selectedCubeId }" @click="selectedCubeId = cube.id">{{ cube.name }}</button>
        </div>
      </section>

      <button class="split-handle" type="button" aria-label="Resize 3D and texture workspaces" @pointerdown="startDivider" @pointermove="moveDivider" @pointerup="finishDivider" @pointercancel="finishDivider"><span /></button>

      <section class="workspace-panel">
        <template v-if="mode === 'material'">
          <header class="workspace-heading">
            <div><p>{{ locale.t('Materials') }}</p><strong>{{ locale.t('Project material library') }}</strong></div>
            <button type="button" class="compact-action" @click="startCreateMaterial">+ {{ locale.t('Material') }}</button>
          </header>
          <div v-if="materials.length" class="material-ribbon">
            <button v-for="material in materials" :key="material.id" type="button" class="material-card" :class="{ active: selectedMaterialId === material.id }" @click="selectedMaterialId = material.id">
              <MaterialSwatch :blob="assetForMaterial(material)?.blob" :size="50" />
              <span><strong>{{ material.name }}</strong><small>{{ assetForMaterial(material) ? `${assetForMaterial(material)!.width}×${assetForMaterial(material)!.height}` : locale.t('No texture') }}</small></span>
            </button>
          </div>
          <div v-else class="mini-empty"><StudioIcon name="material" :size="36" /><strong>{{ locale.t('No materials yet') }}</strong><p>{{ locale.t('Create a material, then import a texture or start with a blank pixel canvas.') }}</p></div>
          <div v-if="selectedMaterial" class="material-command-bar">
            <button type="button" @click="openTexturePicker">{{ locale.t('Import Texture') }}</button>
            <button type="button" @click="createBlankTexture(32)">{{ locale.t('New 32×32') }}</button>
            <button type="button" :disabled="!selectedCube" @click="applyMaterialToCube">{{ locale.t('Apply to cube') }}</button>
            <button type="button" :disabled="!selectedCube" @click="applyMaterialToFace()">{{ locale.t('Apply to face') }}</button>
          </div>
          <div v-if="selectedMaterial" class="material-preview-card">
            <MaterialSwatch :blob="selectedAsset?.blob" :size="72" />
            <div><strong>{{ selectedMaterial.name }}</strong><small><code>{{ selectedMaterial.identifier }}</code></small><span>{{ selectedAsset ? `${selectedAsset.width}×${selectedAsset.height} · ${selectedAsset.mimeType.replace('image/', '').toUpperCase()}` : locale.t('Texture not assigned') }}</span></div>
          </div>
        </template>

        <template v-else-if="mode === 'uv'">
          <div class="uv-context-bar">
            <select v-model="selectedCubeId" aria-label="Cube"><option v-for="cube in model.elements" :key="cube.id" :value="cube.id">{{ cube.name }}</option></select>
            <div class="face-strip">
              <button v-for="face in faces" :key="face" type="button" :class="{ active: selectedFace === face }" @click="selectedFace = face">{{ faceLabel(face) }}</button>
            </div>
          </div>
          <div v-if="!selectedBinding" class="map-face-prompt">
            <div><strong>{{ locale.t('This face is not mapped yet') }}</strong><small>{{ selectedMaterial ? locale.t('Apply the selected material to create its UV island.') : locale.t('Choose a material first.') }}</small></div>
            <button type="button" :disabled="!selectedMaterial" @click="applyMaterialToFace()">{{ locale.t('Map face') }}</button>
          </div>
          <TextureUvWorkspace
            :asset="selectedAsset"
            :binding="selectedBinding"
            :face="selectedFace"
            :disabled="busy"
            @change="updateUvDraft"
            @commit="persistUv"
          />
        </template>

        <template v-else>
          <header class="paint-head">
            <div class="paint-tools">
              <button v-for="tool in ['pencil', 'eraser', 'fill', 'eyedropper', 'inspect'] as const" :key="tool" type="button" :class="{ active: paintTool === tool }" @click="paintTool = tool">{{ locale.t(tool[0]!.toUpperCase() + tool.slice(1)) }}</button>
            </div>
            <div class="history-actions"><button type="button" :disabled="!history.length" @click="undo">↶</button><button type="button" :disabled="!future.length" @click="redo">↷</button></div>
          </header>
          <div class="paint-options">
            <label><span>{{ locale.t('Color') }}</span><input v-model="paintColor" type="color" /></label>
            <label><span>{{ locale.t('Pixel') }}</span><select v-model.number="brushSize"><option :value="1">1 px</option><option :value="2">2 px</option><option :value="4">4 px</option><option :value="8">8 px</option></select></label>
            <button type="button" @click="fitPaintCanvas">{{ locale.t('Fit') }}</button>
            <output>{{ Math.round(paintZoom * 100) }}%</output>
          </div>
          <div class="canvas-stage">
            <div ref="canvasScroll" class="canvas-scroll">
              <canvas
                ref="canvas"
                :style="{ width: `${(canvas?.width || 32) * paintZoom}px`, height: `${(canvas?.height || 32) * paintZoom}px` }"
                @pointerdown="pointerDown"
                @pointermove="pointerMove"
                @pointerup="pointerUp"
                @pointercancel="pointerUp"
              />
            </div>
            <div v-if="pixelInfo" class="pixel-readout">X {{ pixelInfo.x }} · Y {{ pixelInfo.y }} · {{ pixelInfo.color }} · A {{ pixelInfo.alpha }}</div>
          </div>
          <footer class="paint-footer"><span>{{ canvas?.width ?? 32 }}×{{ canvas?.height ?? 32 }} px · {{ locale.t('Pinch to zoom') }}</span><button type="button" :disabled="!selectedAsset || !dirty" @click="saveTexture">{{ locale.t('Save PNG') }}</button></footer>
        </template>
      </section>

      <nav class="mode-tabs" :aria-label="locale.t('Texture tools')">
        <button type="button" :class="{ active: mode === 'material' }" @click="mode = 'material'"><StudioIcon name="material" :size="20" /><span>{{ locale.t('Material') }}</span></button>
        <button type="button" :class="{ active: mode === 'uv' }" @click="mode = 'uv'"><AppIcon name="grid-3x3" :size="20" /><span>UV</span></button>
        <button type="button" :class="{ active: mode === 'paint' }" @click="mode = 'paint'"><AppIcon name="pencil" :size="20" /><span>{{ locale.t('Paint') }}</span></button>
      </nav>

      <aside v-if="inspectorOpen" class="inspector-drawer">
        <header><div><small>{{ locale.t('Inspector') }}</small><strong>{{ mode === 'uv' ? `${selectedCube?.name ?? '—'} · ${faceLabel(selectedFace)}` : selectedMaterial?.name ?? locale.t('Nothing selected') }}</strong></div><button type="button" @click="inspectorOpen = false">×</button></header>
        <dl>
          <div><dt>{{ locale.t('Cube') }}</dt><dd>{{ selectedCube?.name ?? '—' }}</dd></div>
          <div><dt>{{ locale.t('Face') }}</dt><dd>{{ faceLabel(selectedFace) }}</dd></div>
          <div><dt>{{ locale.t('Material') }}</dt><dd>{{ selectedFaceMaterial?.name ?? selectedMaterial?.name ?? '—' }}</dd></div>
          <div><dt>{{ locale.t('Texture') }}</dt><dd>{{ selectedAsset ? `${selectedAsset.width}×${selectedAsset.height}` : '—' }}</dd></div>
          <div><dt>UV</dt><dd>{{ selectedBinding ? `${selectedBinding.uv.x}, ${selectedBinding.uv.y} · ${selectedBinding.uv.width}×${selectedBinding.uv.height} · ${selectedBinding.uv.rotation}°` : locale.t('Not mapped yet') }}</dd></div>
        </dl>
      </aside>
    </section>

    <input ref="importInput" class="visually-hidden" type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" @change="importTexture" />
    <AppDialog :open="createOpen" :title="locale.t('Create Material')" :description="locale.t('Materials connect a Texture Core image to a model.')" @close="createOpen = false">
      <label class="dialog-field">{{ locale.t('Material Name') }}<input v-model="materialName" class="text-input" maxlength="80" autocomplete="off" @keydown.enter.prevent="createMaterial" /></label>
      <template #actions><AppButton variant="ghost" @click="createOpen = false">{{ locale.t('Cancel') }}</AppButton><AppButton :loading="busy" @click="createMaterial">{{ locale.t('Create Material') }}</AppButton></template>
    </AppDialog>
  </main>
</template>

<style scoped>
.texture-core-view { min-height: 100dvh; overflow: hidden; background: var(--color-app-bg); }
.topbar { position: relative; z-index: 20; min-height: calc(var(--header-height) + env(safe-area-inset-top)); display: grid; grid-template-columns: var(--touch-target) minmax(0, 1fr) auto; align-items: center; gap: 0.4rem; padding: env(safe-area-inset-top) max(0.55rem, env(safe-area-inset-right)) 0 max(0.55rem, env(safe-area-inset-left)); border-bottom: 1px solid var(--color-border); background: color-mix(in srgb, var(--color-app-bg) 95%, transparent); backdrop-filter: blur(18px); }
.title-stack { min-width: 0; display: grid; text-align: center; }.title-stack strong,.title-stack small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.title-stack strong { font-size: 0.84rem; }.title-stack small { color: var(--color-text-subtle); font-size: 0.62rem; }.top-actions { display: flex; gap: 0.2rem; }
.loading-state,.error-state { min-height: calc(100dvh - var(--header-height)); display: grid; place-items: center; align-content: center; gap: 0.55rem; padding: 2rem; text-align: center; }.loading-state small,.error-state p { color: var(--color-text-subtle); font-size: 0.74rem; }.spinner { width: 2rem; height: 2rem; border: 3px solid var(--color-border); border-top-color: var(--color-accent); border-radius: 50%; animation: spin .75s linear infinite; }@keyframes spin { to { transform: rotate(360deg); } }
.editor-shell { position: relative; height: calc(100dvh - var(--header-height) - env(safe-area-inset-top)); display: grid; grid-template-rows: minmax(11rem, var(--preview-height)) 0.9rem minmax(0, 1fr) calc(3.7rem + env(safe-area-inset-bottom)); overflow: hidden; }
.preview-shell { position: relative; min-height: 0; overflow: hidden; background: #111613; }.preview-hud { position: absolute; z-index: 3; top: 0.6rem; left: 0.6rem; display: flex; align-items: center; gap: 0.3rem; border: 1px solid #ffffff1c; border-radius: 999px; padding: 0.28rem 0.45rem; background: #07110acc; color: #dce7df; font-size: 0.61rem; pointer-events: none; }.preview-hud b { color: #72e594; }.cube-strip { position: absolute; z-index: 3; right: 0.45rem; bottom: 0.45rem; left: 0.45rem; display: flex; gap: 0.35rem; overflow-x: auto; padding: 0.2rem; scrollbar-width: none; }.cube-strip::-webkit-scrollbar { display: none; }.cube-strip button { flex: 0 0 auto; min-height: 2.35rem; max-width: 9rem; overflow: hidden; border: 1px solid #ffffff18; border-radius: 0.75rem; padding: 0 0.65rem; background: #111b16db; color: #cbd6cf; font-size: 0.65rem; font-weight: 760; text-overflow: ellipsis; white-space: nowrap; }.cube-strip button.active { border-color: #62d884; background: #173923e8; color: #b9f7ca; }
.split-handle { position: relative; z-index: 5; display: grid; place-items: center; border: 0; border-top: 1px solid #ffffff12; border-bottom: 1px solid #000; background: #171d1a; touch-action: none; }.split-handle span { width: 2.8rem; height: 0.22rem; border-radius: 999px; background: #667169; }
.workspace-panel { min-height: 0; overflow: auto; overscroll-behavior: contain; background: #0f1311; }.workspace-heading,.paint-head { min-height: 3.2rem; display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; padding: 0.45rem 0.65rem; border-bottom: 1px solid #ffffff12; }.workspace-heading > div { display: grid; gap: 0.05rem; }.workspace-heading p { margin: 0; color: #6fdd90; font-size: 0.58rem; font-weight: 850; letter-spacing: .08em; text-transform: uppercase; }.workspace-heading strong { font-size: 0.76rem; }.compact-action { min-height: 2.5rem; border: 1px solid #ffffff18; border-radius: 0.7rem; padding: 0 0.7rem; background: #1b2b21; color: #bdf4cc; font-size: 0.7rem; font-weight: 800; }
.material-ribbon { display: flex; gap: 0.55rem; overflow-x: auto; padding: 0.7rem; scrollbar-width: none; }.material-ribbon::-webkit-scrollbar { display:none; }.material-card { flex: 0 0 9.5rem; min-height: 5.4rem; display: flex; align-items: center; gap: 0.55rem; border: 1px solid #ffffff14; border-radius: 1rem; padding: 0.55rem; background: #171c19; color: #e2e9e4; text-align: left; }.material-card.active { border-color: #5bd77f; background: #173421; box-shadow: inset 0 0 0 1px #5bd77f2e; }.material-card > span:last-child { min-width:0; display:grid; gap:.1rem; }.material-card strong,.material-card small { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.material-card strong { font-size:.72rem; }.material-card small { color:#8d9992; font-size:.58rem; }.material-command-bar { display:flex; gap:.4rem; overflow-x:auto; padding:0 .7rem .7rem; }.material-command-bar button,.paint-footer button,.map-face-prompt button { flex:0 0 auto; min-height:2.7rem; border:1px solid #ffffff18; border-radius:.75rem; padding:0 .75rem; background:#202823; color:#e5ece7; font-size:.68rem; font-weight:780; }.material-command-bar button:disabled,.paint-footer button:disabled,.map-face-prompt button:disabled { opacity:.4; }.material-preview-card { display:flex; align-items:center; gap:.8rem; margin:0 .7rem .8rem; border:1px solid #ffffff12; border-radius:1rem; padding:.75rem; background:#151a17; }.material-preview-card > div { min-width:0; display:grid; gap:.12rem; }.material-preview-card small,.material-preview-card span { color:#8d9992; font-size:.62rem; }.mini-empty { min-height:10rem; display:grid; place-items:center; align-content:center; gap:.35rem; padding:1.2rem; color:#9aa59e; text-align:center; }.mini-empty p { max-width:22rem; margin:0; font-size:.68rem; line-height:1.45; }
.uv-context-bar { min-height:3rem; display:flex; align-items:center; gap:.45rem; padding:.4rem .55rem; border-bottom:1px solid #ffffff12; background:#151a17; }.uv-context-bar select,.paint-options select { min-height:2.5rem; max-width:8.5rem; border:1px solid #ffffff18; border-radius:.65rem; padding:0 .55rem; background:#202622; color:#edf2ee; font-size:16px; }.face-strip { min-width:0; display:flex; flex:1; gap:.3rem; overflow-x:auto; scrollbar-width:none; }.face-strip::-webkit-scrollbar { display:none; }.face-strip button { flex:0 0 auto; min-height:2.5rem; border:1px solid #ffffff14; border-radius:.65rem; padding:0 .62rem; background:#202622; color:#9ea9a2; font-size:.64rem; font-weight:780; }.face-strip button.active { border-color:#62dc86; background:#183a23; color:#c3f6d0; }.map-face-prompt { display:flex; align-items:center; justify-content:space-between; gap:.6rem; margin:.55rem; border:1px solid #e1ba4d50; border-radius:.8rem; padding:.55rem; background:#2a2415; }.map-face-prompt > div { min-width:0; display:grid; gap:.1rem; }.map-face-prompt strong { font-size:.68rem; }.map-face-prompt small { color:#bdad82; font-size:.6rem; }
.paint-tools { min-width:0; display:flex; flex:1; gap:.3rem; overflow-x:auto; scrollbar-width:none; }.paint-tools::-webkit-scrollbar { display:none; }.paint-tools button,.history-actions button,.paint-options button { flex:0 0 auto; min-height:2.55rem; border:1px solid #ffffff14; border-radius:.65rem; padding:0 .65rem; background:#202622; color:#aab4ae; font-size:.65rem; font-weight:780; }.paint-tools button.active { border-color:#62dc86; background:#183a23; color:#c3f6d0; }.history-actions { display:flex; gap:.25rem; }.history-actions button { min-width:2.55rem; padding:0; font-size:1rem; }.paint-options { display:flex; align-items:center; gap:.45rem; overflow-x:auto; padding:.45rem .6rem; border-bottom:1px solid #ffffff10; }.paint-options label { flex:0 0 auto; display:flex; align-items:center; gap:.35rem; color:#95a099; font-size:.62rem; }.paint-options input[type='color'] { width:2.5rem; height:2.5rem; border:0; border-radius:.65rem; padding:.2rem; background:#202622; }.paint-options output { flex:0 0 auto; min-width:3rem; color:#aeb9b2; font-family:var(--font-mono); font-size:.62rem; }.canvas-stage { position:relative; min-height:13rem; height:calc(100% - 8.5rem); overflow:hidden; background:#0b0f0d; }.canvas-scroll { width:100%; height:100%; overflow:auto; display:grid; place-items:start center; padding:1rem; background-image:linear-gradient(45deg,#1d231f 25%,transparent 25%),linear-gradient(-45deg,#1d231f 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#1d231f 75%),linear-gradient(-45deg,transparent 75%,#1d231f 75%); background-size:20px 20px; background-position:0 0,0 10px,10px -10px,-10px 0; overscroll-behavior:contain; }.canvas-scroll canvas { display:block; flex:0 0 auto; max-width:none; border:1px solid #ffffff24; image-rendering:pixelated; touch-action:none; box-shadow:0 12px 35px #0008; }.pixel-readout { position:absolute; right:.6rem; bottom:.6rem; border:1px solid #ffffff18; border-radius:999px; padding:.28rem .48rem; background:#080c0add; color:#b9f3ca; font-family:var(--font-mono); font-size:.58rem; pointer-events:none; }.paint-footer { min-height:2.8rem; display:flex; align-items:center; justify-content:space-between; gap:.5rem; padding:.35rem .6rem; border-top:1px solid #ffffff10; color:#8f9a93; font-size:.6rem; }
.mode-tabs { z-index:10; display:grid; grid-template-columns:repeat(3,1fr); border-top:1px solid var(--color-border); padding-bottom:env(safe-area-inset-bottom); background:color-mix(in srgb,var(--color-surface) 96%,#000); }.mode-tabs button { min-height:3.7rem; display:grid; place-items:center; align-content:center; gap:.12rem; border:0; border-top:2px solid transparent; background:transparent; color:var(--color-text-subtle); font-size:.62rem; font-weight:800; }.mode-tabs button.active { border-top-color:var(--color-accent); color:var(--color-accent); background:color-mix(in srgb,var(--color-accent) 8%,transparent); }
.inspector-drawer { position:absolute; z-index:25; top:.55rem; right:max(.55rem,env(safe-area-inset-right)); width:min(20rem,calc(100% - 1.1rem)); max-height:calc(100% - 1.1rem); overflow:auto; border:1px solid #ffffff18; border-radius:1rem; padding:.65rem; background:#171c19f5; box-shadow:0 18px 55px #000a; backdrop-filter:blur(18px); }.inspector-drawer header { display:flex; align-items:center; justify-content:space-between; gap:.5rem; }.inspector-drawer header > div { min-width:0; display:grid; }.inspector-drawer header small { color:#68d888; font-size:.58rem; font-weight:850; text-transform:uppercase; }.inspector-drawer header strong { overflow:hidden; font-size:.76rem; text-overflow:ellipsis; white-space:nowrap; }.inspector-drawer header button { width:2.5rem; height:2.5rem; border:0; border-radius:50%; background:#252d28; color:#fff; font-size:1.2rem; }.inspector-drawer dl { display:grid; gap:.15rem; margin:.65rem 0 0; }.inspector-drawer dl div { display:grid; grid-template-columns:5rem minmax(0,1fr); gap:.5rem; padding:.48rem 0; border-top:1px solid #ffffff0e; }.inspector-drawer dt { color:#8e9992; font-size:.62rem; }.inspector-drawer dd { margin:0; overflow-wrap:anywhere; color:#e4eae6; font-size:.65rem; text-align:right; }
.dialog-field { display:grid; gap:.35rem; color:var(--color-text-muted); font-size:.72rem; font-weight:700; }.text-input { min-height:var(--touch-target); border:1px solid var(--color-border-strong); border-radius:var(--radius-md); padding:0 .75rem; background:var(--color-input-bg); color:var(--color-text); font-size:16px; }.visually-hidden { position:fixed; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); }
@media (min-width: 720px) { .editor-shell { width:min(100%,72rem); margin:0 auto; border-right:1px solid var(--color-border); border-left:1px solid var(--color-border); }.previewHeight { max-height:36rem; } }
@media (max-width: 380px) { .top-actions > :first-child { display:none; }.workspace-heading strong { font-size:.7rem; }.material-card { flex-basis:8.6rem; }.uv-context-bar select { max-width:6.6rem; } }
</style>
