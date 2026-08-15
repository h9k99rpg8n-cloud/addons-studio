<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import AppButton from '@/components/common/AppButton.vue'
import AppDialog from '@/components/common/AppDialog.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import IconButton from '@/components/common/IconButton.vue'
import { toAppError } from '@/core/errors/AppError'
import { textureRepository } from '@/core/texture/textureRepository'
import { useLocaleStore } from '@/stores/locale'
import { useProjectStore } from '@/stores/projects'
import { useToastStore } from '@/stores/toasts'
import type { StudioMaterial, StudioTextureAsset } from '@/types/texture'

import MaterialSwatch from './MaterialSwatch.vue'

const props = defineProps<{ projectId: string }>()
const router = useRouter()
const projects = useProjectStore()
const locale = useLocaleStore()
const toasts = useToastStore()

const materials = ref<StudioMaterial[]>([])
const assets = ref<StudioTextureAsset[]>([])
const loading = ref(true)
const loadError = ref('')
const selectedMaterialId = ref('')
const createOpen = ref(false)
const materialName = ref('Material')
const importInput = ref<HTMLInputElement>()
const canvas = ref<HTMLCanvasElement>()
const canvasScroll = ref<HTMLDivElement>()
const color = ref('#4f8f62')
const tool = ref<'pencil' | 'eraser' | 'fill' | 'eyedropper' | 'inspect'>('pencil')
const pixelSize = ref(1)
const zoom = ref(10)
const pixelInfo = ref<{ x: number; y: number; color: string; alpha: number }>()
const history = ref<ImageData[]>([])
const future = ref<ImageData[]>([])
const dirty = ref(false)
const busy = ref(false)
let canvasUrl = ''
const touchPoints = new Map<number, { x: number; y: number }>()
let pinchStartDistance = 0
let pinchStartZoom = 10
let pinchStartCentroid = { x: 0, y: 0 }
let pinchStartScroll = { left: 0, top: 0 }

const project = computed(() =>
  projects.activeProject?.id === props.projectId
    ? projects.activeProject
    : projects.projects.find((entry) => entry.id === props.projectId),
)
const selectedMaterial = computed(() => materials.value.find((entry) => entry.id === selectedMaterialId.value))
const selectedAsset = computed(() => assets.value.find((entry) => entry.id === selectedMaterial.value?.textureAssetId))

function assetFor(material: StudioMaterial): StudioTextureAsset | undefined {
  return assets.value.find((entry) => entry.id === material.textureAssetId)
}

function releaseCanvasUrl(): void {
  if (canvasUrl) URL.revokeObjectURL(canvasUrl)
  canvasUrl = ''
}

async function loadLibrary(): Promise<void> {
  loading.value = true
  try {
    await projects.loadProjects()
    await projects.openProject(props.projectId)
    materials.value = await textureRepository.listMaterials(props.projectId)
    assets.value = await textureRepository.listTextureAssets(props.projectId)
    selectedMaterialId.value ||= materials.value[0]?.id ?? ''
  } catch (error) {
    loadError.value = toAppError(error, locale.t('Addons Studio could not load Materials.')).userMessage
  } finally {
    loading.value = false
  }
}

onMounted(loadLibrary)
onBeforeUnmount(releaseCanvasUrl)

watch(selectedAsset, async () => {
  await nextTick()
  await loadCanvas()
})

watch(selectedMaterialId, async () => {
  await nextTick()
  await loadCanvas()
})

async function loadCanvas(): Promise<void> {
  const target = canvas.value
  if (!target) return
  const ctx = target.getContext('2d', { willReadFrequently: true })
  if (!ctx) return
  releaseCanvasUrl()
  history.value = []
  future.value = []
  dirty.value = false
  pixelInfo.value = undefined
  const asset = selectedAsset.value
  if (!asset) {
    target.width = 32
    target.height = 32
    ctx.clearRect(0, 0, target.width, target.height)
    fitCanvas()
    return
  }
  canvasUrl = URL.createObjectURL(asset.blob)
  const image = new Image()
  image.decoding = 'async'
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('Texture decode failed'))
    image.src = canvasUrl
  })
  target.width = asset.width
  target.height = asset.height
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, target.width, target.height)
  ctx.drawImage(image, 0, 0, target.width, target.height)
  fitCanvas()
}

function fitCanvas(): void {
  const width = canvas.value?.width ?? selectedAsset.value?.width ?? 32
  const available = Math.max(180, Math.min(globalThis.innerWidth - 28, 560))
  zoom.value = Math.max(2, Math.min(28, Math.floor(available / Math.max(1, width))))
}

function openCreate(): void {
  materialName.value = `Material ${materials.value.length + 1}`
  createOpen.value = true
}

async function createMaterial(): Promise<void> {
  busy.value = true
  try {
    const material = await textureRepository.createMaterial({ projectId: props.projectId, name: materialName.value })
    materials.value.unshift(material)
    selectedMaterialId.value = material.id
    createOpen.value = false
    toasts.push({ type: 'success', message: locale.t('Material created') })
  } catch (error) {
    toasts.push({ type: 'error', message: toAppError(error, locale.t('Addons Studio could not create this material.')).userMessage })
  } finally {
    busy.value = false
  }
}

function openImport(): void {
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
    assets.value.unshift(result.asset)
    await nextTick()
    await loadCanvas()
    toasts.push({ type: 'success', message: locale.t('Texture imported successfully') })
  } catch (error) {
    toasts.push({ type: 'error', message: toAppError(error, locale.t('Addons Studio could not import this texture.')).userMessage })
  } finally {
    input.value = ''
    busy.value = false
  }
}

function canvasBlob(target: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => target.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG encode failed')), 'image/png'))
}

async function createBlank(size = 32): Promise<void> {
  if (!selectedMaterial.value) return
  const scratch = document.createElement('canvas')
  scratch.width = size
  scratch.height = size
  const blob = await canvasBlob(scratch)
  const previousAssetId = selectedMaterial.value.textureAssetId
  const result = await textureRepository.importTexture(
    selectedMaterial.value.id,
    new File([blob], `${selectedMaterial.value.identifier}_${size}.png`, { type: 'image/png' }),
  )
  materials.value = materials.value.map((entry) => entry.id === result.material.id ? result.material : entry)
  if (previousAssetId) assets.value = assets.value.filter((entry) => entry.id !== previousAssetId)
  assets.value.unshift(result.asset)
  await nextTick()
  await loadCanvas()
}

function pushHistory(): void {
  const target = canvas.value
  const ctx = target?.getContext('2d', { willReadFrequently: true })
  if (!target || !ctx) return
  history.value.push(ctx.getImageData(0, 0, target.width, target.height))
  if (history.value.length > 30) history.value.shift()
  future.value = []
}

function undo(): void {
  const target = canvas.value
  const ctx = target?.getContext('2d', { willReadFrequently: true })
  const image = history.value.pop()
  if (!target || !ctx || !image) return
  future.value.push(ctx.getImageData(0, 0, target.width, target.height))
  ctx.putImageData(image, 0, 0)
  dirty.value = true
}

function redo(): void {
  const target = canvas.value
  const ctx = target?.getContext('2d', { willReadFrequently: true })
  const image = future.value.pop()
  if (!target || !ctx || !image) return
  history.value.push(ctx.getImageData(0, 0, target.width, target.height))
  ctx.putImageData(image, 0, 0)
  dirty.value = true
}

function pointFrom(event: PointerEvent): { x: number; y: number } | undefined {
  const target = canvas.value
  if (!target) return undefined
  const rect = target.getBoundingClientRect()
  const x = Math.floor((event.clientX - rect.left) / Math.max(1, rect.width) * target.width)
  const y = Math.floor((event.clientY - rect.top) / Math.max(1, rect.height) * target.height)
  return x >= 0 && y >= 0 && x < target.width && y < target.height ? { x, y } : undefined
}

function hexRgba(hex: string): [number, number, number, number] {
  const value = Number.parseInt(hex.replace('#', ''), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255, 255]
}

function rgbaHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((entry) => entry.toString(16).padStart(2, '0')).join('')}`
}

function fill(ctx: CanvasRenderingContext2D, x: number, y: number, replacement: [number, number, number, number]): void {
  const image = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
  const data = image.data
  const width = image.width
  const offset = (y * width + x) * 4
  const source = [data[offset], data[offset + 1], data[offset + 2], data[offset + 3]]
  if (source.every((entry, index) => entry === replacement[index])) return
  const stack: [number, number][] = [[x, y]]
  while (stack.length) {
    const [px, py] = stack.pop()!
    if (px < 0 || py < 0 || px >= image.width || py >= image.height) continue
    const current = (py * width + px) * 4
    if (!source.every((entry, index) => data[current + index] === entry)) continue
    data[current] = replacement[0]
    data[current + 1] = replacement[1]
    data[current + 2] = replacement[2]
    data[current + 3] = replacement[3]
    stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1])
  }
  ctx.putImageData(image, 0, 0)
}

function paint(event: PointerEvent, first = false): void {
  const target = canvas.value
  const point = pointFrom(event)
  const ctx = target?.getContext('2d', { willReadFrequently: true })
  if (!target || !point || !ctx || !selectedAsset.value) return
  const pixel = ctx.getImageData(point.x, point.y, 1, 1).data
  if (tool.value === 'inspect') {
    pixelInfo.value = { x: point.x, y: point.y, color: rgbaHex(pixel[0]!, pixel[1]!, pixel[2]!), alpha: pixel[3]! }
    return
  }
  if (first) pushHistory()
  if (tool.value === 'eyedropper') {
    color.value = rgbaHex(pixel[0]!, pixel[1]!, pixel[2]!)
    tool.value = 'pencil'
    return
  }
  if (tool.value === 'fill') fill(ctx, point.x, point.y, hexRgba(color.value))
  else if (tool.value === 'eraser') ctx.clearRect(point.x, point.y, pixelSize.value, pixelSize.value)
  else {
    ctx.fillStyle = color.value
    ctx.fillRect(point.x, point.y, pixelSize.value, pixelSize.value)
  }
  dirty.value = true
}

function touchDistance(): number {
  const values = [...touchPoints.values()]
  return values.length < 2 ? 0 : Math.hypot(values[0]!.x - values[1]!.x, values[0]!.y - values[1]!.y)
}

function touchCentroid(): { x: number; y: number } {
  const values = [...touchPoints.values()]
  if (values.length < 2) return values[0] ?? { x: 0, y: 0 }
  return { x: (values[0]!.x + values[1]!.x) / 2, y: (values[0]!.y + values[1]!.y) / 2 }
}

function pointerDown(event: PointerEvent): void {
  if (event.pointerType === 'touch') {
    touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (touchPoints.size === 2) {
      pinchStartDistance = touchDistance()
      pinchStartZoom = zoom.value
      pinchStartCentroid = touchCentroid()
      pinchStartScroll = { left: canvasScroll.value?.scrollLeft ?? 0, top: canvasScroll.value?.scrollTop ?? 0 }
      return
    }
  }
  canvas.value?.setPointerCapture(event.pointerId)
  paint(event, true)
}

function pointerMove(event: PointerEvent): void {
  if (event.pointerType === 'touch' && touchPoints.has(event.pointerId)) {
    touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (touchPoints.size >= 2 && pinchStartDistance > 0) {
      event.preventDefault()
      zoom.value = Math.max(2, Math.min(32, Math.round(pinchStartZoom * touchDistance() / pinchStartDistance * 10) / 10))
      const center = touchCentroid()
      if (canvasScroll.value) {
        canvasScroll.value.scrollLeft = pinchStartScroll.left - (center.x - pinchStartCentroid.x)
        canvasScroll.value.scrollTop = pinchStartScroll.top - (center.y - pinchStartCentroid.y)
      }
      return
    }
  }
  if (!canvas.value?.hasPointerCapture(event.pointerId) || tool.value === 'fill' || tool.value === 'eyedropper') return
  paint(event)
}

function pointerUp(event: PointerEvent): void {
  touchPoints.delete(event.pointerId)
  if (touchPoints.size < 2) pinchStartDistance = 0
  if (canvas.value?.hasPointerCapture(event.pointerId)) canvas.value.releasePointerCapture(event.pointerId)
}

async function saveQuickEdit(): Promise<void> {
  if (!canvas.value || !selectedAsset.value) return
  busy.value = true
  try {
    const saved = await textureRepository.replaceTexturePixels(selectedAsset.value.id, await canvasBlob(canvas.value), canvas.value.width, canvas.value.height)
    assets.value = assets.value.map((entry) => entry.id === saved.id ? saved : entry)
    dirty.value = false
    toasts.push({ type: 'success', message: locale.t('Texture saved') })
  } finally {
    busy.value = false
  }
}

async function removeSelected(): Promise<void> {
  if (!selectedMaterial.value) return
  await textureRepository.deleteMaterial(selectedMaterial.value.id)
  materials.value = materials.value.filter((entry) => entry.id !== selectedMaterialId.value)
  assets.value = await textureRepository.listTextureAssets(props.projectId)
  selectedMaterialId.value = materials.value[0]?.id ?? ''
  toasts.push({ type: 'success', message: locale.t('Material deleted') })
}
</script>

<template>
  <main class="materials-view">
    <header class="topbar">
      <IconButton icon="arrow-left" :label="locale.t('Back to project workspace')" @click="router.push({ name: 'workspace', params: { id: projectId } })" />
      <div><strong>{{ locale.t('Materials') }}</strong><small>{{ project?.name ?? locale.t('Project') }}</small></div>
      <IconButton icon="plus" :label="locale.t('Create Material')" variant="surface" @click="openCreate" />
    </header>

    <section v-if="loading" class="state"><div class="spinner" /><strong>{{ locale.t('Loading Materials…') }}</strong></section>
    <section v-else-if="loadError || !project" class="state"><AppIcon name="alert-triangle" :size="34" /><h1>{{ locale.t('Materials unavailable') }}</h1><p>{{ loadError }}</p></section>

    <section v-else class="materials-shell">
      <header class="library-heading"><div><small>{{ locale.t('Project Library') }}</small><strong>{{ materials.length }} {{ locale.t('materials') }}</strong></div><button type="button" @click="openCreate">+ {{ locale.t('New') }}</button></header>

      <div v-if="materials.length" class="material-ribbon">
        <button v-for="material in materials" :key="material.id" type="button" class="material-card" :class="{ active: selectedMaterialId === material.id }" @click="selectedMaterialId = material.id">
          <MaterialSwatch :blob="assetFor(material)?.blob" :size="56" />
          <span><strong>{{ material.name }}</strong><small>{{ assetFor(material) ? `${assetFor(material)!.width}×${assetFor(material)!.height}` : locale.t('No texture') }}</small></span>
        </button>
      </div>
      <div v-else class="empty"><MaterialSwatch :size="62" /><strong>{{ locale.t('No materials yet') }}</strong><p>{{ locale.t('Create the first reusable texture material for this project.') }}</p><button type="button" @click="openCreate">+ {{ locale.t('Create Material') }}</button></div>

      <section v-if="selectedMaterial" class="quick-editor">
        <header class="selected-head">
          <MaterialSwatch :blob="selectedAsset?.blob" :size="64" />
          <div><small>{{ locale.t('Quick Edit') }}</small><strong>{{ selectedMaterial.name }}</strong><span><code>{{ selectedMaterial.identifier }}</code></span></div>
          <button type="button" class="danger" @click="removeSelected">{{ locale.t('Delete') }}</button>
        </header>

        <div class="material-actions">
          <button type="button" @click="openImport">{{ locale.t('Import Texture') }}</button>
          <button v-if="!selectedAsset" type="button" @click="createBlank(32)">{{ locale.t('New 32×32') }}</button>
          <button v-else type="button" @click="fitCanvas">{{ locale.t('Fit') }}</button>
          <output v-if="selectedAsset">{{ Math.round(zoom * 100) }}%</output>
        </div>

        <template v-if="selectedAsset">
          <nav class="paint-tools">
            <button v-for="entry in ['pencil', 'eraser', 'fill', 'eyedropper', 'inspect'] as const" :key="entry" type="button" :class="{ active: tool === entry }" @click="tool = entry">{{ locale.t(entry[0]!.toUpperCase() + entry.slice(1)) }}</button>
            <span class="spacer" />
            <button type="button" :disabled="!history.length" @click="undo">↶</button>
            <button type="button" :disabled="!future.length" @click="redo">↷</button>
          </nav>
          <div class="paint-options"><label>{{ locale.t('Color') }}<input v-model="color" type="color" /></label><label>{{ locale.t('Pixel') }}<select v-model.number="pixelSize"><option :value="1">1 px</option><option :value="2">2 px</option><option :value="4">4 px</option><option :value="8">8 px</option></select></label></div>
          <div class="canvas-stage">
            <div ref="canvasScroll" class="canvas-scroll">
              <canvas ref="canvas" :style="{ width: `${(canvas?.width || 32) * zoom}px`, height: `${(canvas?.height || 32) * zoom}px` }" @pointerdown="pointerDown" @pointermove="pointerMove" @pointerup="pointerUp" @pointercancel="pointerUp" />
            </div>
            <div v-if="pixelInfo" class="pixel-readout">X {{ pixelInfo.x }} · Y {{ pixelInfo.y }} · {{ pixelInfo.color }} · A {{ pixelInfo.alpha }}</div>
          </div>
          <footer class="editor-footer"><span>{{ selectedAsset.width }}×{{ selectedAsset.height }} · {{ locale.t('Pinch to zoom') }}</span><button type="button" :disabled="!dirty || busy" @click="saveQuickEdit">{{ locale.t('Save PNG') }}</button></footer>
        </template>
        <div v-else class="no-texture"><strong>{{ locale.t('This material is ready for a texture') }}</strong><p>{{ locale.t('Import PNG/JPEG or create a blank pixel canvas.') }}</p></div>
      </section>
    </section>

    <input ref="importInput" class="visually-hidden" type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" @change="importTexture" />
    <AppDialog :open="createOpen" :title="locale.t('Create Material')" :description="locale.t('Materials are reusable across every model in this project.')" @close="createOpen = false"><label class="dialog-field">{{ locale.t('Material Name') }}<input v-model="materialName" class="text-input" maxlength="80" autocomplete="off" @keydown.enter.prevent="createMaterial" /></label><template #actions><AppButton variant="ghost" @click="createOpen = false">{{ locale.t('Cancel') }}</AppButton><AppButton :loading="busy" @click="createMaterial">{{ locale.t('Create Material') }}</AppButton></template></AppDialog>
  </main>
</template>

<style scoped>
.materials-view { min-height:100dvh; background:var(--color-app-bg); }.topbar { position:sticky; z-index:20; top:0; min-height:calc(var(--header-height) + env(safe-area-inset-top)); display:grid; grid-template-columns:var(--touch-target) minmax(0,1fr) var(--touch-target); align-items:center; gap:.45rem; padding:env(safe-area-inset-top) max(.6rem,env(safe-area-inset-right)) 0 max(.6rem,env(safe-area-inset-left)); border-bottom:1px solid var(--color-border); background:color-mix(in srgb,var(--color-app-bg) 95%,transparent); backdrop-filter:blur(18px); }.topbar>div { min-width:0; display:grid; text-align:center; }.topbar strong,.topbar small { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.topbar strong { font-size:.84rem; }.topbar small { color:var(--color-text-subtle); font-size:.62rem; }.state { min-height:70dvh; display:grid; place-items:center; align-content:center; gap:.5rem; padding:2rem; text-align:center; }.state p { color:var(--color-text-subtle); }.spinner { width:2rem; height:2rem; border:3px solid var(--color-border); border-top-color:var(--color-accent); border-radius:50%; animation:spin .75s linear infinite; }@keyframes spin{to{transform:rotate(360deg)}}
.materials-shell { width:min(100%,64rem); margin:0 auto; padding-bottom:calc(1rem + env(safe-area-inset-bottom)); }.library-heading { min-height:3.5rem; display:flex; align-items:center; justify-content:space-between; gap:.5rem; padding:.55rem .75rem; }.library-heading>div { display:grid; }.library-heading small { color:var(--color-accent); font-size:.58rem; font-weight:850; text-transform:uppercase; letter-spacing:.08em; }.library-heading strong { font-size:.78rem; }.library-heading button,.empty button { min-height:2.55rem; border:1px solid var(--color-border); border-radius:.72rem; padding:0 .75rem; background:var(--color-surface); color:var(--color-accent); font-size:.68rem; font-weight:800; }
.material-ribbon { display:flex; gap:.55rem; overflow-x:auto; padding:.2rem .75rem .8rem; scrollbar-width:none; }.material-ribbon::-webkit-scrollbar { display:none; }.material-card { flex:0 0 10rem; min-height:5.6rem; display:flex; align-items:center; gap:.6rem; border:1px solid var(--color-border); border-radius:1rem; padding:.55rem; background:var(--color-surface); color:var(--color-text); text-align:left; }.material-card.active { border-color:var(--color-accent); background:color-mix(in srgb,var(--color-accent) 10%,var(--color-surface)); box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--color-accent) 25%,transparent); }.material-card>span:last-child { min-width:0; display:grid; gap:.1rem; }.material-card strong,.material-card small { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.material-card strong { font-size:.72rem; }.material-card small { color:var(--color-text-subtle); font-size:.59rem; }.empty { min-height:13rem; display:grid; place-items:center; align-content:center; gap:.4rem; padding:1rem; text-align:center; }.empty p,.no-texture p { margin:0; color:var(--color-text-subtle); font-size:.68rem; }
.quick-editor { overflow:hidden; margin:0 .7rem; border:1px solid var(--color-border); border-radius:1.1rem; background:color-mix(in srgb,var(--color-surface) 96%,#000); box-shadow:0 15px 40px #0003; }.selected-head { min-height:5.4rem; display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; gap:.7rem; padding:.65rem .7rem; border-bottom:1px solid var(--color-border); }.selected-head>div { min-width:0; display:grid; gap:.08rem; }.selected-head small { color:var(--color-accent); font-size:.58rem; font-weight:850; text-transform:uppercase; }.selected-head strong,.selected-head span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.selected-head strong { font-size:.82rem; }.selected-head span { color:var(--color-text-subtle); font-size:.6rem; }.danger { min-height:2.55rem; border:1px solid #d85c5c55; border-radius:.7rem; padding:0 .6rem; background:#38181844; color:#ef9292; font-size:.65rem; font-weight:780; }
.material-actions,.paint-options { display:flex; align-items:center; gap:.4rem; overflow-x:auto; padding:.45rem .6rem; border-bottom:1px solid var(--color-border); }.material-actions button,.paint-options button { flex:0 0 auto; min-height:2.55rem; border:1px solid var(--color-border); border-radius:.7rem; padding:0 .7rem; background:var(--color-input-bg); color:var(--color-text); font-size:.66rem; font-weight:780; }.material-actions output { flex:0 0 auto; color:var(--color-text-subtle); font-family:var(--font-mono); font-size:.62rem; }.paint-tools { display:flex; align-items:center; gap:.3rem; overflow-x:auto; padding:.45rem .55rem; border-bottom:1px solid var(--color-border); scrollbar-width:none; }.paint-tools::-webkit-scrollbar { display:none; }.paint-tools button { flex:0 0 auto; min-height:2.5rem; border:1px solid var(--color-border); border-radius:.65rem; padding:0 .62rem; background:var(--color-input-bg); color:var(--color-text-subtle); font-size:.64rem; font-weight:780; }.paint-tools button.active { border-color:var(--color-accent); background:color-mix(in srgb,var(--color-accent) 12%,var(--color-input-bg)); color:var(--color-accent); }.spacer { flex:1 0 .5rem; }.paint-options label { flex:0 0 auto; display:flex; align-items:center; gap:.35rem; color:var(--color-text-subtle); font-size:.62rem; }.paint-options input[type='color'] { width:2.5rem; height:2.5rem; border:0; border-radius:.65rem; padding:.2rem; background:var(--color-input-bg); }.paint-options select { min-height:2.5rem; border:1px solid var(--color-border); border-radius:.65rem; padding:0 .55rem; background:var(--color-input-bg); color:var(--color-text); font-size:16px; }
.canvas-stage { position:relative; height:min(52dvh,30rem); min-height:16rem; overflow:hidden; background:#0b0f0d; }.canvas-scroll { width:100%; height:100%; display:grid; place-items:start center; overflow:auto; padding:1rem; overscroll-behavior:contain; background-image:linear-gradient(45deg,#1d231f 25%,transparent 25%),linear-gradient(-45deg,#1d231f 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#1d231f 75%),linear-gradient(-45deg,transparent 75%,#1d231f 75%); background-size:20px 20px; background-position:0 0,0 10px,10px -10px,-10px 0; }.canvas-scroll canvas { display:block; max-width:none; border:1px solid #ffffff24; image-rendering:pixelated; touch-action:none; box-shadow:0 12px 38px #0008; }.pixel-readout { position:absolute; right:.6rem; bottom:.6rem; border:1px solid #ffffff18; border-radius:999px; padding:.28rem .48rem; background:#080c0add; color:#b9f3ca; font-family:var(--font-mono); font-size:.58rem; }.editor-footer { min-height:3rem; display:flex; align-items:center; justify-content:space-between; gap:.5rem; padding:.4rem .6rem; border-top:1px solid var(--color-border); color:var(--color-text-subtle); font-size:.61rem; }.editor-footer button { min-height:2.55rem; border:1px solid var(--color-accent); border-radius:.7rem; padding:0 .75rem; background:color-mix(in srgb,var(--color-accent) 14%,transparent); color:var(--color-accent); font-size:.66rem; font-weight:800; }.editor-footer button:disabled { opacity:.4; }.no-texture { min-height:12rem; display:grid; place-items:center; align-content:center; gap:.35rem; padding:1rem; text-align:center; }
.dialog-field { display:grid; gap:.35rem; color:var(--color-text-muted); font-size:.72rem; font-weight:700; }.text-input { min-height:var(--touch-target); border:1px solid var(--color-border-strong); border-radius:var(--radius-md); padding:0 .75rem; background:var(--color-input-bg); color:var(--color-text); font-size:16px; }.visually-hidden { position:fixed; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); }
@media (max-width:380px){.material-card{flex-basis:8.8rem}.selected-head{grid-template-columns:auto minmax(0,1fr)}.selected-head .danger{grid-column:1/-1}.canvas-stage{height:46dvh}}
</style>
