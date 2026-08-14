<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import AppButton from '@/components/common/AppButton.vue'
import AppDialog from '@/components/common/AppDialog.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import IconButton from '@/components/common/IconButton.vue'
import StudioIcon from '@/components/common/StudioIcon.vue'
import { toAppError } from '@/core/errors/AppError'
import { modelRepository } from '@/core/model/modelRepository'
import { textureRepository } from '@/core/texture/textureRepository'
import { useLocaleStore } from '@/stores/locale'
import { useToastStore } from '@/stores/toasts'
import type { StudioModel } from '@/types/model'
import type { StudioMaterial, StudioTextureAsset, StudioTextureBinding, TextureFace } from '@/types/texture'

import TextureModelPreview from './TextureModelPreview.vue'

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
const mode = ref<'material' | 'uv' | 'paint'>('material')
const paintTool = ref<'pencil' | 'eraser' | 'fill' | 'eyedropper'>('pencil')
const paintColor = ref('#4f8f62')
const brushSize = ref(1)
const zoom = ref(12)
const canvas = ref<HTMLCanvasElement>()
const importInput = ref<HTMLInputElement>()
const history = ref<ImageData[]>([])
const future = ref<ImageData[]>([])
const dirty = ref(false)
let activeObjectUrl: string | undefined

const selectedMaterial = computed(() => materials.value.find((entry) => entry.id === selectedMaterialId.value))
const selectedAsset = computed(() => assets.value.find((entry) => entry.id === selectedMaterial.value?.textureAssetId))
const selectedCube = computed(() => model.value?.elements.find((entry) => entry.id === selectedCubeId.value))
const selectedBinding = computed(() => bindings.value.find((entry) => entry.cubeId === selectedCubeId.value && entry.face === selectedFace.value))
const faces: readonly TextureFace[] = ['north', 'south', 'east', 'west', 'up', 'down']

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
  const ctx = target.getContext('2d', { willReadFrequently: true })
  if (!ctx) return
  if (!asset) {
    target.width = 32
    target.height = 32
    ctx.clearRect(0, 0, target.width, target.height)
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
}

function startCreateMaterial(): void {
  materialName.value = `Material ${materials.value.length + 1}`
  createOpen.value = true
}

async function createMaterial(): Promise<void> {
  if (!model.value) return
  busy.value = true
  try {
    const created = await textureRepository.createMaterial({
      projectId: props.projectId,
      modelId: props.modelId,
      name: materialName.value,
    })
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
    const result = await textureRepository.importTexture(selectedMaterial.value.id, file)
    materials.value = materials.value.map((entry) => entry.id === result.material.id ? result.material : entry)
    assets.value = assets.value.filter((entry) => entry.id !== selectedMaterial.value?.textureAssetId)
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
  return new Promise((resolve, reject) => {
    target.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG encode failed')), 'image/png')
  })
}

async function createBlankTexture(size = 32): Promise<void> {
  if (!selectedMaterial.value) {
    toasts.push({ type: 'info', message: locale.t('Create or select a material first.') })
    return
  }
  const temp = document.createElement('canvas')
  temp.width = size
  temp.height = size
  const ctx = temp.getContext('2d')!
  ctx.clearRect(0, 0, size, size)
  const blob = await canvasToBlob(temp)
  const file = new File([blob], `${selectedMaterial.value.identifier}_${size}.png`, { type: 'image/png' })
  const result = await textureRepository.importTexture(selectedMaterial.value.id, file)
  materials.value = materials.value.map((entry) => entry.id === result.material.id ? result.material : entry)
  assets.value.push(result.asset)
  selectedMaterialId.value = result.material.id
  await nextTick()
  await loadSelectedTextureIntoCanvas()
  mode.value = 'paint'
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
  const x = Math.floor((event.clientX - rect.left) / rect.width * target.width)
  const y = Math.floor((event.clientY - rect.top) / rect.height * target.height)
  if (x < 0 || y < 0 || x >= target.width || y >= target.height) return undefined
  return { x, y }
}

function hexToRgba(hex: string): [number, number, number, number] {
  const normalized = hex.replace('#', '')
  const value = Number.parseInt(normalized.padEnd(6, '0').slice(0, 6), 16)
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
  if (first) pushHistory()
  if (paintTool.value === 'eyedropper') {
    const pixel = ctx.getImageData(point.x, point.y, 1, 1).data
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

function pointerDown(event: PointerEvent): void {
  if (mode.value !== 'paint') return
  canvas.value?.setPointerCapture(event.pointerId)
  paintAt(event, true)
}

function pointerMove(event: PointerEvent): void {
  if (mode.value !== 'paint' || !canvas.value?.hasPointerCapture(event.pointerId)) return
  if (paintTool.value === 'fill' || paintTool.value === 'eyedropper') return
  paintAt(event)
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

async function applyMaterialToFace(): Promise<void> {
  if (!model.value || !selectedCube.value || !selectedMaterial.value) return
  const asset = selectedAsset.value
  const saved = await textureRepository.saveFaceBinding({
    projectId: props.projectId,
    modelId: props.modelId,
    cubeId: selectedCube.value.id,
    face: selectedFace.value,
    materialId: selectedMaterial.value.id,
    textureWidth: asset?.width ?? 16,
    textureHeight: asset?.height ?? 16,
  })
  const index = bindings.value.findIndex((entry) => entry.id === saved.id)
  if (index >= 0) bindings.value[index] = saved
  else bindings.value.push(saved)
  toasts.push({ type: 'success', message: locale.t('Material assigned to face') })
}
</script>

<template>
  <main class="texture-core-view">
    <header class="topbar">
      <IconButton icon="arrow-left" :label="locale.t('Back to Texture Core')" @click="router.push({ name: 'texture-models', params: { projectId } })" />
      <div><strong>{{ model?.name ?? locale.t('Texture Core') }}</strong><small>{{ dirty ? locale.t('Unsaved texture changes') : locale.t('Saved') }}</small></div>
      <IconButton icon="save" :label="locale.t('Save texture')" :disabled="!dirty || busy" variant="surface" @click="saveTexture" />
    </header>

    <section v-if="loading" class="loading-state"><div class="spinner" /><strong>{{ locale.t('Preparing Texture Core…') }}</strong><small>{{ locale.t('Loading geometry, materials, and texture workspace') }}</small></section>
    <section v-else-if="loadError || !model" class="error-state"><AppIcon name="alert-triangle" :size="34" /><h1>{{ locale.t('Texture Core unavailable') }}</h1><p>{{ loadError }}</p></section>

    <template v-else>
      <section class="preview-shell">
        <TextureModelPreview :model="model" :texture="selectedAsset" />
        <span class="preview-label">{{ locale.t('Live Preview') }}</span>
      </section>

      <nav class="mode-tabs" :aria-label="locale.t('Texture tools')">
        <button type="button" :class="{ active: mode === 'material' }" @click="mode = 'material'"><StudioIcon name="material" :size="19" />{{ locale.t('Material') }}</button>
        <button type="button" :class="{ active: mode === 'uv' }" @click="mode = 'uv'"><AppIcon name="grid-3x3" :size="19" />UV</button>
        <button type="button" :class="{ active: mode === 'paint' }" @click="mode = 'paint'"><AppIcon name="pencil" :size="19" />{{ locale.t('Paint') }}</button>
      </nav>

      <section class="workspace-panel">
        <template v-if="mode === 'material'">
          <header class="panel-heading"><div><p class="eyebrow">{{ locale.t('Materials') }}</p><h2>{{ locale.t('Project material library') }}</h2></div><AppButton size="small" @click="startCreateMaterial">+ {{ locale.t('Material') }}</AppButton></header>
          <div v-if="materials.length" class="material-grid">
            <button v-for="material in materials" :key="material.id" type="button" class="material-card" :class="{ active: selectedMaterialId === material.id }" @click="selectedMaterialId = material.id">
              <span class="material-swatch"><img v-if="assets.find((asset) => asset.id === material.textureAssetId)" :src="URL.createObjectURL(assets.find((asset) => asset.id === material.textureAssetId)!.blob)" alt="" /><StudioIcon v-else name="material" :size="27" /></span>
              <strong>{{ material.name }}</strong><small>{{ material.identifier }}</small>
            </button>
          </div>
          <div v-else class="mini-empty"><StudioIcon name="material" :size="33" /><strong>{{ locale.t('No materials yet') }}</strong><p>{{ locale.t('Create a material, then import a texture or start with a blank pixel canvas.') }}</p></div>
          <div v-if="selectedMaterial" class="material-actions">
            <AppButton variant="secondary" @click="openTexturePicker">{{ locale.t('Import Texture') }}</AppButton>
            <AppButton variant="secondary" @click="createBlankTexture(32)">{{ locale.t('New 32×32') }}</AppButton>
          </div>
          <aside v-if="selectedMaterial" class="inspector">
            <p class="eyebrow">{{ locale.t('Inspector') }}</p>
            <dl><div><dt>{{ locale.t('Name') }}</dt><dd>{{ selectedMaterial.name }}</dd></div><div><dt>{{ locale.t('Identifier') }}</dt><dd><code>{{ selectedMaterial.identifier }}</code></dd></div><div><dt>{{ locale.t('Texture') }}</dt><dd>{{ selectedAsset ? `${selectedAsset.width}×${selectedAsset.height} · ${selectedAsset.mimeType.replace('image/', '').toUpperCase()}` : locale.t('None') }}</dd></div><div><dt>{{ locale.t('Used by') }}</dt><dd>{{ model.name }}</dd></div></dl>
          </aside>
        </template>

        <template v-else-if="mode === 'uv'">
          <header class="panel-heading"><div><p class="eyebrow">UV</p><h2>{{ locale.t('Face assignment foundation') }}</h2></div><span class="precision">{{ locale.t('Precision') }}: 1 px</span></header>
          <p class="panel-note">{{ locale.t('Texture Core 0.1 starts with per-face material bindings. Manual island movement and Box UV arrive in the next Texture Core update.') }}</p>
          <label>{{ locale.t('Cube') }}<select v-model="selectedCubeId"><option v-for="cube in model.elements" :key="cube.id" :value="cube.id">{{ cube.name }}</option></select></label>
          <div class="face-grid"><button v-for="face in faces" :key="face" type="button" :class="{ active: selectedFace === face }" @click="selectedFace = face">{{ locale.t(face[0]!.toUpperCase() + face.slice(1)) }}</button></div>
          <label>{{ locale.t('Material') }}<select v-model="selectedMaterialId"><option value="">{{ locale.t('No material') }}</option><option v-for="material in materials" :key="material.id" :value="material.id">{{ material.name }}</option></select></label>
          <AppButton :disabled="!selectedCube || !selectedMaterial" @click="applyMaterialToFace">{{ locale.t('Apply to selected face') }}</AppButton>
          <aside class="inspector"><p class="eyebrow">{{ locale.t('UV Inspector') }}</p><dl><div><dt>{{ locale.t('Cube') }}</dt><dd>{{ selectedCube?.name ?? '—' }}</dd></div><div><dt>{{ locale.t('Face') }}</dt><dd>{{ selectedFace }}</dd></div><div><dt>{{ locale.t('Material') }}</dt><dd>{{ selectedMaterial?.name ?? '—' }}</dd></div><div><dt>UV</dt><dd>{{ selectedBinding ? `${selectedBinding.uv.x}, ${selectedBinding.uv.y} · ${selectedBinding.uv.width}×${selectedBinding.uv.height}` : locale.t('Not mapped yet') }}</dd></div></dl></aside>
        </template>

        <template v-else>
          <header class="panel-heading"><div><p class="eyebrow">{{ locale.t('Pixel Editor') }}</p><h2>{{ selectedMaterial?.name ?? locale.t('Choose a material') }}</h2></div><div class="history-actions"><button type="button" :disabled="!history.length" @click="undo">↶</button><button type="button" :disabled="!future.length" @click="redo">↷</button></div></header>
          <div class="paint-toolbar"><button v-for="tool in ['pencil', 'eraser', 'fill', 'eyedropper'] as const" :key="tool" type="button" :class="{ active: paintTool === tool }" @click="paintTool = tool">{{ locale.t(tool[0]!.toUpperCase() + tool.slice(1)) }}</button></div>
          <div class="paint-options"><label>{{ locale.t('Color') }}<input v-model="paintColor" type="color" /></label><label>{{ locale.t('Pixel size') }}<select v-model.number="brushSize"><option :value="1">1 px</option><option :value="2">2 px</option><option :value="4">4 px</option><option :value="8">8 px</option></select></label><label>{{ locale.t('Zoom') }}<input v-model.number="zoom" type="range" min="4" max="28" step="1" /><output>{{ zoom }}×</output></label></div>
          <div class="canvas-stage"><div class="canvas-scroll"><canvas ref="canvas" :style="{ width: `${(canvas?.width || 32) * zoom}px`, height: `${(canvas?.height || 32) * zoom}px` }" @pointerdown="pointerDown" @pointermove="pointerMove" /></div></div>
          <div class="paint-footer"><span>{{ canvas?.width ?? 32 }}×{{ canvas?.height ?? 32 }} px</span><AppButton size="small" :disabled="!selectedAsset || !dirty" @click="saveTexture">{{ locale.t('Save PNG') }}</AppButton></div>
        </template>
      </section>
    </template>

    <input ref="importInput" class="visually-hidden" type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" @change="importTexture" />
    <AppDialog :open="createOpen" :title="locale.t('Create Material')" :description="locale.t('Materials connect a Texture Core image to a model.')" @close="createOpen = false"><label class="dialog-field">{{ locale.t('Material Name') }}<input v-model="materialName" class="text-input" maxlength="80" autocomplete="off" @keydown.enter.prevent="createMaterial" /></label><template #actions><AppButton variant="ghost" @click="createOpen = false">{{ locale.t('Cancel') }}</AppButton><AppButton :loading="busy" @click="createMaterial">{{ locale.t('Create Material') }}</AppButton></template></AppDialog>
  </main>
</template>

<style scoped>
.texture-core-view { min-height: 100dvh; padding-bottom: calc(1rem + env(safe-area-inset-bottom)); background: var(--color-app-bg); }
.topbar { position: sticky; z-index: var(--z-header); top: 0; min-height: calc(var(--header-height) + env(safe-area-inset-top)); display: grid; grid-template-columns: var(--touch-target) minmax(0, 1fr) var(--touch-target); align-items: center; gap: 0.5rem; padding: env(safe-area-inset-top) max(var(--page-gutter), env(safe-area-inset-right)) 0 max(var(--page-gutter), env(safe-area-inset-left)); border-bottom: 1px solid var(--color-border); background: color-mix(in srgb, var(--color-app-bg) 94%, transparent); backdrop-filter: blur(16px); }
.topbar > div { min-width: 0; display: grid; text-align: center; }
.topbar strong, .topbar small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.topbar strong { font-size: 0.86rem; }.topbar small { color: var(--color-text-subtle); font-size: 0.63rem; }
.preview-shell { position: relative; width: min(100%, var(--content-max)); height: clamp(13rem, 37dvh, 24rem); margin: 0 auto; border-bottom: 1px solid var(--color-border); overflow: hidden; }
.preview-label { position: absolute; top: 0.65rem; left: 0.65rem; border: 1px solid #ffffff22; border-radius: 999px; padding: 0.25rem 0.5rem; background: #111a; color: #fff; font-size: 0.64rem; font-weight: 750; pointer-events: none; }
.mode-tabs { position: sticky; z-index: 5; top: calc(var(--header-height) + env(safe-area-inset-top)); display: grid; grid-template-columns: repeat(3, 1fr); width: min(100%, var(--content-max)); margin: 0 auto; border-bottom: 1px solid var(--color-border); background: var(--color-surface); }
.mode-tabs button { min-height: var(--touch-target); display: flex; align-items: center; justify-content: center; gap: 0.35rem; border: 0; border-bottom: 2px solid transparent; background: transparent; color: var(--color-text-muted); font-weight: 750; }.mode-tabs button.active { border-bottom-color: var(--color-accent); color: var(--color-accent-strong); }
.workspace-panel { width: min(100%, var(--content-max)); margin: 0 auto; padding: 1rem max(var(--page-gutter), env(safe-area-inset-right)) 2rem max(var(--page-gutter), env(safe-area-inset-left)); }
.panel-heading { display: flex; align-items: end; justify-content: space-between; gap: 0.75rem; margin-bottom: 0.8rem; }.panel-heading h2 { margin: 0.15rem 0 0; font-size: 1rem; }.panel-note { margin: -0.2rem 0 0.9rem; color: var(--color-text-muted); font-size: 0.72rem; line-height: 1.45; }
.material-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.6rem; }.material-card { min-width: 0; display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 0.55rem; align-items: center; border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 0.55rem; background: var(--color-surface); color: var(--color-text); text-align: left; }.material-card.active { border-color: var(--color-accent); box-shadow: 0 0 0 1px var(--color-accent); }.material-swatch { grid-row: span 2; width: 2.7rem; height: 2.7rem; display: grid; place-items: center; overflow: hidden; border-radius: 50%; background: #f3f4f2; color: #2b332e; }.material-swatch img { width: 100%; height: 100%; object-fit: cover; image-rendering: pixelated; }.material-card strong, .material-card small { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.material-card strong { font-size: 0.78rem; }.material-card small { color: var(--color-text-subtle); font: 0.61rem var(--font-mono); }
.material-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 0.55rem; margin-top: 0.75rem; }.mini-empty { min-height: 9rem; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 1px dashed var(--color-border-strong); border-radius: var(--radius-lg); padding: 1rem; color: var(--color-text-muted); text-align: center; }.mini-empty strong { margin-top: 0.4rem; color: var(--color-text); }.mini-empty p { max-width: 24rem; margin: 0.3rem 0 0; font-size: 0.7rem; line-height: 1.45; }
.inspector { margin-top: 1rem; border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 0.75rem; background: var(--color-surface-muted); }.inspector dl { display: grid; gap: 0.4rem; margin: 0.5rem 0 0; }.inspector dl div { display: grid; grid-template-columns: minmax(5rem, 0.7fr) minmax(0, 1.3fr); gap: 0.5rem; }.inspector dt { color: var(--color-text-subtle); font-size: 0.68rem; }.inspector dd { min-width: 0; margin: 0; overflow: hidden; color: var(--color-text); font-size: 0.7rem; text-overflow: ellipsis; white-space: nowrap; }.inspector code { font-size: 0.64rem; }
.workspace-panel > label, .paint-options label, .dialog-field { display: grid; gap: 0.3rem; margin-top: 0.65rem; color: var(--color-text-muted); font-size: 0.7rem; font-weight: 700; }.workspace-panel select, .paint-options select { min-height: 2.75rem; border: 1px solid var(--color-border-strong); border-radius: var(--radius-md); padding: 0 0.65rem; background: var(--color-input-bg); color: var(--color-text); font-size: 16px; }
.face-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.45rem; margin: 0.75rem 0; }.face-grid button, .paint-toolbar button, .history-actions button { min-height: 2.7rem; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface); color: var(--color-text-muted); font-weight: 700; }.face-grid button.active, .paint-toolbar button.active { border-color: var(--color-accent); background: var(--color-accent-soft); color: var(--color-accent-strong); }.precision { border-radius: 999px; padding: 0.3rem 0.5rem; background: var(--color-surface-muted); color: var(--color-text-subtle); font-size: 0.65rem; }
.paint-toolbar { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.35rem; }.paint-toolbar button { padding: 0.25rem; font-size: 0.65rem; }.paint-options { display: grid; grid-template-columns: auto auto minmax(0, 1fr); gap: 0.55rem; align-items: end; margin: 0.7rem 0; }.paint-options label { margin: 0; }.paint-options input[type='color'] { width: 3rem; height: 2.75rem; border: 1px solid var(--color-border-strong); border-radius: var(--radius-md); background: var(--color-input-bg); }.paint-options label:last-child { grid-template-columns: 1fr auto; }.paint-options label:last-child input { grid-column: 1 / -1; }.paint-options output { justify-self: end; }.history-actions { display: flex; gap: 0.3rem; }.history-actions button { min-width: 2.7rem; }
.canvas-stage { min-height: 19rem; display: grid; place-items: center; overflow: hidden; border: 1px solid var(--color-border); border-radius: var(--radius-lg); background-color: #ddd; background-image: linear-gradient(45deg, #bbb 25%, transparent 25%), linear-gradient(-45deg, #bbb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #bbb 75%), linear-gradient(-45deg, transparent 75%, #bbb 75%); background-size: 16px 16px; background-position: 0 0, 0 8px, 8px -8px, -8px 0; }.canvas-scroll { width: 100%; max-height: 60dvh; overflow: auto; padding: 1rem; }.canvas-scroll canvas { display: block; margin: auto; image-rendering: pixelated; image-rendering: crisp-edges; background: transparent; touch-action: none; box-shadow: 0 0 0 1px #0003; }.paint-footer { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; margin-top: 0.65rem; color: var(--color-text-subtle); font: 0.68rem var(--font-mono); }
.loading-state, .error-state { min-height: 70dvh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; text-align: center; }.loading-state strong { margin-top: 0.8rem; }.loading-state small, .error-state p { margin-top: 0.3rem; color: var(--color-text-muted); }.spinner { width: 2.4rem; height: 2.4rem; border: 3px solid var(--color-border-strong); border-top-color: var(--color-accent); border-radius: 50%; animation: spin 0.8s linear infinite; }.error-state { color: var(--color-warning-text); }.error-state h1 { margin: 0.8rem 0 0; color: var(--color-text); }
@keyframes spin { to { transform: rotate(360deg); } }
@media (min-width: 720px) { .material-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 390px) { .paint-options { grid-template-columns: 1fr 1fr; }.paint-options label:last-child { grid-column: 1 / -1; } }
</style>
