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
const color = ref('#4f8f62')
const tool = ref<'pencil' | 'eraser' | 'fill' | 'eyedropper'>('pencil')
const pixelSize = ref(1)
const zoom = ref(12)
const history = ref<ImageData[]>([])
const future = ref<ImageData[]>([])
const dirty = ref(false)
const busy = ref(false)
let canvasUrl = ''

const project = computed(() =>
  projects.activeProject?.id === props.projectId
    ? projects.activeProject
    : projects.projects.find((entry) => entry.id === props.projectId),
)
const selectedMaterial = computed(() => materials.value.find((entry) => entry.id === selectedMaterialId.value))
const selectedAsset = computed(() => assets.value.find((entry) => entry.id === selectedMaterial.value?.textureAssetId))

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

function assetFor(material: StudioMaterial): StudioTextureAsset | undefined {
  return assets.value.find((entry) => entry.id === material.textureAssetId)
}

async function loadCanvas(): Promise<void> {
  const target = canvas.value
  if (!target) return
  const ctx = target.getContext('2d', { willReadFrequently: true })
  if (!ctx) return
  releaseCanvasUrl()
  history.value = []
  future.value = []
  dirty.value = false
  const asset = selectedAsset.value
  if (!asset) {
    target.width = 32
    target.height = 32
    ctx.clearRect(0, 0, target.width, target.height)
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
    assets.value = assets.value.filter((entry) => entry.id !== previousAssetId)
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
  const file = new File([blob], `${selectedMaterial.value.identifier}_${size}.png`, { type: 'image/png' })
  const result = await textureRepository.importTexture(selectedMaterial.value.id, file)
  materials.value = materials.value.map((entry) => entry.id === result.material.id ? result.material : entry)
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
  const x = Math.floor((event.clientX - rect.left) / rect.width * target.width)
  const y = Math.floor((event.clientY - rect.top) / rect.height * target.height)
  return x >= 0 && y >= 0 && x < target.width && y < target.height ? { x, y } : undefined
}

function hexRgba(hex: string): [number, number, number, number] {
  const value = Number.parseInt(hex.replace('#', ''), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255, 255]
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
  if (first) pushHistory()
  if (tool.value === 'eyedropper') {
    const pixel = ctx.getImageData(point.x, point.y, 1, 1).data
    color.value = `#${[pixel[0], pixel[1], pixel[2]].map((entry) => entry!.toString(16).padStart(2, '0')).join('')}`
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

function pointerDown(event: PointerEvent): void {
  canvas.value?.setPointerCapture(event.pointerId)
  paint(event, true)
}

function pointerMove(event: PointerEvent): void {
  if (!canvas.value?.hasPointerCapture(event.pointerId) || tool.value === 'fill' || tool.value === 'eyedropper') return
  paint(event)
}

async function saveQuickEdit(): Promise<void> {
  if (!canvas.value || !selectedAsset.value) return
  busy.value = true
  try {
    const saved = await textureRepository.replaceTexturePixels(
      selectedAsset.value.id,
      await canvasBlob(canvas.value),
      canvas.value.width,
      canvas.value.height,
    )
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

    <div v-else class="content">
      <section class="intro">
        <div><p class="eyebrow">{{ locale.t('Project Library') }}</p><h1>{{ locale.t('Reusable materials') }}</h1><p>{{ locale.t('Materials belong to the project. Create or fix a texture here, then reuse it across Model Core and Texture Core.') }}</p></div>
        <AppButton @click="openCreate">+ {{ locale.t('Material') }}</AppButton>
      </section>

      <div class="layout">
        <section class="library">
          <header><h2>{{ locale.t('Materials') }}</h2><span>{{ materials.length }}</span></header>
          <div v-if="materials.length" class="material-list">
            <button v-for="material in materials" :key="material.id" type="button" :class="{ active: selectedMaterialId === material.id }" @click="selectedMaterialId = material.id">
              <MaterialSwatch :blob="assetFor(material)?.blob" :size="46" />
              <span><strong>{{ material.name }}</strong><small>{{ material.identifier }}</small></span>
            </button>
          </div>
          <div v-else class="empty"><strong>{{ locale.t('No materials yet') }}</strong><p>{{ locale.t('Create the first reusable texture material for this project.') }}</p></div>
        </section>

        <section v-if="selectedMaterial" class="editor">
          <header class="editor-head"><div><p class="eyebrow">{{ locale.t('Quick Edit') }}</p><h2>{{ selectedMaterial.name }}</h2></div><MaterialSwatch :blob="selectedAsset?.blob" :size="52" /></header>
          <div class="actions"><AppButton variant="secondary" @click="openImport">{{ locale.t('Import Texture') }}</AppButton><AppButton v-if="!selectedAsset" variant="secondary" @click="createBlank(32)">{{ locale.t('New 32×32') }}</AppButton></div>

          <template v-if="selectedAsset">
            <div class="toolbar"><button v-for="entry in ['pencil', 'eraser', 'fill', 'eyedropper'] as const" :key="entry" type="button" :class="{ active: tool === entry }" @click="tool = entry">{{ locale.t(entry[0]!.toUpperCase() + entry.slice(1)) }}</button></div>
            <div class="options"><label>{{ locale.t('Color') }}<input v-model="color" type="color" /></label><label>{{ locale.t('Pixel size') }}<select v-model.number="pixelSize"><option :value="1">1 px</option><option :value="2">2 px</option><option :value="4">4 px</option><option :value="8">8 px</option></select></label><label>{{ locale.t('Zoom') }}<input v-model.number="zoom" type="range" min="4" max="24" /><output>{{ zoom }}×</output></label></div>
            <div class="history"><button type="button" :disabled="!history.length" @click="undo">↶ {{ locale.t('Undo') }}</button><button type="button" :disabled="!future.length" @click="redo">↷ {{ locale.t('Redo') }}</button></div>
            <div class="canvas-stage"><div><canvas ref="canvas" :style="{ width: `${(canvas?.width || 32) * zoom}px`, height: `${(canvas?.height || 32) * zoom}px` }" @pointerdown="pointerDown" @pointermove="pointerMove" /></div></div>
            <footer><span>{{ selectedAsset.width }}×{{ selectedAsset.height }} · {{ selectedAsset.mimeType.replace('image/', '').toUpperCase() }}</span><AppButton :disabled="!dirty" :loading="busy" @click="saveQuickEdit">{{ locale.t('Save PNG') }}</AppButton></footer>
          </template>
          <div v-else class="empty compact"><strong>{{ locale.t('No texture assigned') }}</strong><p>{{ locale.t('Import PNG/JPEG or create a blank pixel canvas.') }}</p></div>

          <aside class="inspector"><p class="eyebrow">{{ locale.t('Inspector') }}</p><dl><div><dt>{{ locale.t('Identifier') }}</dt><dd><code>{{ selectedMaterial.identifier }}</code></dd></div><div><dt>{{ locale.t('Texture') }}</dt><dd>{{ selectedAsset?.name ?? locale.t('None') }}</dd></div><div><dt>{{ locale.t('Scope') }}</dt><dd>{{ locale.t('Entire project') }}</dd></div></dl><AppButton variant="danger" @click="removeSelected">{{ locale.t('Delete Material') }}</AppButton></aside>
        </section>
      </div>
    </div>

    <input ref="importInput" class="visually-hidden" type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" @change="importTexture" />
    <AppDialog :open="createOpen" :title="locale.t('Create Material')" :description="locale.t('This material can be reused by any model in this project.')" @close="createOpen = false"><label class="dialog-field">{{ locale.t('Material Name') }}<input v-model="materialName" class="text-input" maxlength="80" @keydown.enter.prevent="createMaterial" /></label><template #actions><AppButton variant="ghost" @click="createOpen = false">{{ locale.t('Cancel') }}</AppButton><AppButton :loading="busy" @click="createMaterial">{{ locale.t('Create Material') }}</AppButton></template></AppDialog>
  </main>
</template>

<style scoped>
.materials-view { min-height: 100dvh; padding-bottom: calc(1rem + env(safe-area-inset-bottom)); }
.topbar { position: sticky; z-index: var(--z-header); top: 0; min-height: calc(var(--header-height) + env(safe-area-inset-top)); display: grid; grid-template-columns: var(--touch-target) minmax(0,1fr) var(--touch-target); align-items: center; padding: env(safe-area-inset-top) max(var(--page-gutter), env(safe-area-inset-right)) 0 max(var(--page-gutter), env(safe-area-inset-left)); border-bottom: 1px solid var(--color-border); background: color-mix(in srgb, var(--color-app-bg) 94%, transparent); backdrop-filter: blur(16px); }
.topbar > div { min-width: 0; display: grid; text-align: center; }.topbar strong,.topbar small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.topbar small { color: var(--color-text-subtle); font-size: .64rem; }
.content { width: min(100%, var(--content-max)); margin: 0 auto; padding: 1rem max(var(--page-gutter), env(safe-area-inset-right)) 2rem max(var(--page-gutter), env(safe-area-inset-left)); }.intro { display: flex; align-items: end; justify-content: space-between; gap: 1rem; border: 1px solid var(--color-border); border-radius: var(--radius-xl); padding: var(--card-padding); background: radial-gradient(circle at 0 0,var(--color-brand-glow),transparent 44%),var(--color-surface); }.intro h1 { margin: .15rem 0 0; font-size: 1.25rem; }.intro p:last-child { max-width: 38rem; margin: .35rem 0 0; color: var(--color-text-muted); font-size: .74rem; line-height: 1.45; }
.layout { display: grid; gap: 1rem; margin-top: 1rem; }.library,.editor { border: 1px solid var(--color-border); border-radius: var(--radius-xl); padding: .8rem; background: var(--color-surface); }.library > header,.editor-head { display: flex; align-items: center; justify-content: space-between; gap: .7rem; }.library h2,.editor h2 { margin: 0; font-size: 1rem; }.library header span { color: var(--color-text-subtle); font-size: .7rem; }
.material-list { display: grid; gap: .45rem; margin-top: .65rem; }.material-list > button { min-height: 4rem; display: grid; grid-template-columns: auto minmax(0,1fr); align-items: center; gap: .65rem; border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: .5rem; background: var(--color-surface-muted); color: var(--color-text); text-align: left; }.material-list > button.active { border-color: var(--color-accent); box-shadow: 0 0 0 1px var(--color-accent); }.material-list button > span:last-child { min-width: 0; display: grid; }.material-list strong,.material-list small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.material-list small { color: var(--color-text-subtle); font: .62rem var(--font-mono); }
.actions { display: grid; grid-template-columns: 1fr 1fr; gap: .5rem; margin: .7rem 0; }.toolbar { display: grid; grid-template-columns: repeat(4,1fr); gap: .3rem; }.toolbar button,.history button { min-height: var(--touch-target); border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface-muted); color: var(--color-text-muted); font-size: .66rem; font-weight: 700; }.toolbar button.active { border-color: var(--color-accent); background: var(--color-accent-soft); color: var(--color-accent-strong); }.options { display: grid; grid-template-columns: auto auto 1fr; gap: .5rem; align-items: end; margin: .6rem 0; }.options label,.dialog-field { display: grid; gap: .25rem; color: var(--color-text-muted); font-size: .67rem; font-weight: 700; }.options select { min-height: var(--touch-target); border: 1px solid var(--color-border-strong); border-radius: var(--radius-md); padding: 0 .55rem; background: var(--color-input-bg); color: var(--color-text); font-size: 16px; }.options input[type='color'] { width: 3rem; height: var(--touch-target); border: 1px solid var(--color-border-strong); border-radius: var(--radius-md); }.options label:last-child { grid-template-columns: 1fr auto; }.options label:last-child input { grid-column: 1/-1; }.history { display: grid; grid-template-columns: 1fr 1fr; gap: .4rem; margin-bottom: .5rem; }
.canvas-stage { min-height: 18rem; overflow: hidden; border: 1px solid var(--color-border); border-radius: var(--radius-lg); background-color: #ddd; background-image: linear-gradient(45deg,#bbb 25%,transparent 25%),linear-gradient(-45deg,#bbb 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#bbb 75%),linear-gradient(-45deg,transparent 75%,#bbb 75%); background-size: 16px 16px; background-position: 0 0,0 8px,8px -8px,-8px 0; }.canvas-stage > div { width: 100%; max-height: 58dvh; overflow: auto; padding: 1rem; }.canvas-stage canvas { display: block; margin: auto; image-rendering: pixelated; touch-action: none; box-shadow: 0 0 0 1px #0003; }.editor footer { display: flex; align-items: center; justify-content: space-between; gap: .6rem; margin-top: .6rem; color: var(--color-text-subtle); font: .66rem var(--font-mono); }
.inspector { margin-top: .8rem; border-top: 1px solid var(--color-border); padding-top: .75rem; }.inspector dl { display: grid; gap: .35rem; }.inspector dl div { display: grid; grid-template-columns: 5rem minmax(0,1fr); gap: .5rem; }.inspector dt { color: var(--color-text-subtle); font-size: .66rem; }.inspector dd { min-width: 0; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .7rem; }.inspector .app-button { margin-top: .6rem; }
.empty { min-height: 8rem; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 1px dashed var(--color-border-strong); border-radius: var(--radius-lg); padding: 1rem; text-align: center; }.empty.compact { min-height: 6rem; }.empty p { margin: .25rem 0 0; color: var(--color-text-muted); font-size: .7rem; }.state { min-height: 70dvh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; text-align: center; }.state p { color: var(--color-text-muted); }.spinner { width: 2.4rem; height: 2.4rem; border: 3px solid var(--color-border-strong); border-top-color: var(--color-accent); border-radius: 50%; animation: spin .8s linear infinite; }@keyframes spin{to{transform:rotate(360deg)}}
@media(min-width:760px){.layout{grid-template-columns:minmax(15rem,.75fr) minmax(0,1.55fr)}}@media(max-width:420px){.intro{align-items:start;flex-direction:column}.options{grid-template-columns:1fr 1fr}.options label:last-child{grid-column:1/-1}}
</style>
