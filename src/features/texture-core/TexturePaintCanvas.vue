<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import {
  floodFillPixels,
  linePixels,
  mirroredBrushPixels,
  paintSnapshotsEqual,
  type PaintPoint,
  type PaintSnapshot,
  pushUniquePaintHistory,
  rectanglePixels,
  replaceColorPixels,
  type Rgba,
} from '@/core/texture/texturePaintService'
import { useLocaleStore } from '@/stores/locale'
import type { StudioTextureAsset } from '@/types/texture'

const props = defineProps<{
  asset?: StudioTextureAsset
  disabled?: boolean
  persist?: (assetId: string, blob: Blob, width: number, height: number) => Promise<boolean>
}>()

const emit = defineEmits<{
  dirtyChange: [dirty: boolean]
}>()

type PaintTool = 'pencil' | 'eraser' | 'fill' | 'eyedropper' | 'inspect' | 'line' | 'rectangle' | 'replace'

interface ActivePaintGesture {
  pointerId: number
  pointerType: string
  tool: PaintTool
  startClient: PaintPoint
  startPoint: PaintPoint
  lastPoint: PaintPoint
  before: PaintSnapshot
  dirtyBefore: boolean
  started: boolean
}

const locale = useLocaleStore()
const canvas = ref<HTMLCanvasElement>()
const scroll = ref<HTMLDivElement>()
const interactionSurface = ref<HTMLDivElement>()
const tool = ref<PaintTool>('pencil')
const color = ref('#4f8f62')
const opacity = ref(100)
const brushSize = ref(1)
const zoom = ref(10)
const showGrid = ref(true)
const mirrorX = ref(false)
const mirrorY = ref(false)
const dirty = ref(false)
const saving = ref(false)
const interacting = ref(false)
const historyDepth = ref(0)
const futureDepth = ref(0)
const loadError = ref('')
const pixelInfo = ref<{ x: number; y: number; color: string; alpha: number }>()
const touches = new Map<number, PaintPoint>()
const history: PaintSnapshot[] = []
const future: PaintSnapshot[] = []
let gesture: ActivePaintGesture | undefined
let resizeObserver: ResizeObserver | undefined
let loadGeneration = 0
let loadedAssetId: string | undefined
let editRevision = 0
let savePromise: Promise<boolean> | undefined
let autosaveTimer: ReturnType<typeof setTimeout> | undefined
let pinchActive = false
let pinchStartDistance = 0
let pinchStartZoom = 10
let pinchStartCentroid: PaintPoint = { x: 0, y: 0 }
let pinchStartScroll = { left: 0, top: 0 }
let customZoom = false

const TOUCH_DEADZONE = 6
const tools: readonly PaintTool[] = ['pencil', 'eraser', 'fill', 'eyedropper', 'line', 'rectangle', 'replace', 'inspect']
const canvasSize = computed(() => ({
  width: canvas.value?.width ?? props.asset?.width ?? 32,
  height: canvas.value?.height ?? props.asset?.height ?? 32,
}))
const canvasStyle = computed(() => ({
  width: `${canvasSize.value.width * zoom.value}px`,
  height: `${canvasSize.value.height * zoom.value}px`,
}))
const gridStyle = computed(() => ({ backgroundSize: `${zoom.value}px ${zoom.value}px` }))

function toolLabel(entry: PaintTool): string {
  const labels: Record<PaintTool, string> = {
    pencil: 'Pencil',
    eraser: 'Eraser',
    fill: 'Fill',
    eyedropper: 'Eyedropper',
    inspect: 'Pixel Inspect',
    line: 'Line',
    rectangle: 'Rectangle',
    replace: 'Replace Color',
  }
  return locale.t(labels[entry])
}

function setDirty(value: boolean): void {
  if (dirty.value === value) return
  dirty.value = value
  emit('dirtyChange', value)
}

function context(): CanvasRenderingContext2D | undefined {
  return canvas.value?.getContext('2d', { willReadFrequently: true }) ?? undefined
}

function snapshot(): PaintSnapshot | undefined {
  const target = canvas.value
  const ctx = context()
  if (!target || !ctx) return undefined
  const image = ctx.getImageData(0, 0, target.width, target.height)
  return { width: target.width, height: target.height, data: new Uint8ClampedArray(image.data) }
}

function restore(data: PaintSnapshot): void {
  const target = canvas.value
  const ctx = context()
  if (!target || !ctx || target.width !== data.width || target.height !== data.height) return
  const image = ctx.createImageData(data.width, data.height)
  image.data.set(data.data)
  ctx.putImageData(image, 0, 0)
}

function updateHistoryDepths(): void {
  historyDepth.value = history.length
  futureDepth.value = future.length
}

function clearHistory(): void {
  history.splice(0)
  future.splice(0)
  updateHistoryDepths()
}

function rememberBefore(data: PaintSnapshot): void {
  pushUniquePaintHistory(history, data, 64)
  future.splice(0)
  updateHistoryDepths()
}

function markEdited(): void {
  editRevision += 1
  setDirty(true)
  if (autosaveTimer) clearTimeout(autosaveTimer)
  autosaveTimer = setTimeout(() => {
    autosaveTimer = undefined
    void save()
  }, 800)
}

async function decodeAsset(asset: StudioTextureAsset, generation: number): Promise<void> {
  const target = canvas.value
  const ctx = context()
  if (!target || !ctx) return
  const objectUrl = URL.createObjectURL(asset.blob)
  try {
    const image = new Image()
    image.decoding = 'async'
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Texture decode failed'))
      image.src = objectUrl
    })
    if (generation !== loadGeneration) return
    target.width = asset.width
    target.height = asset.height
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, target.width, target.height)
    ctx.drawImage(image, 0, 0, target.width, target.height)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

async function loadAsset(): Promise<void> {
  const generation = ++loadGeneration
  const asset = props.asset
  await nextTick()
  const target = canvas.value
  const ctx = context()
  if (!target || !ctx) return
  if (generation === loadGeneration) loadedAssetId = undefined
  loadError.value = ''
  clearHistory()
  pixelInfo.value = undefined
  setDirty(false)
  try {
    if (asset) await decodeAsset(asset, generation)
    else {
      target.width = 32
      target.height = 32
      ctx.clearRect(0, 0, target.width, target.height)
    }
    if (generation === loadGeneration) {
      loadedAssetId = asset?.id
      customZoom = false
      await nextTick()
      fit()
    }
  } catch {
    if (generation === loadGeneration) loadError.value = locale.t('This texture could not be opened.')
  }
}

watch(
  () => props.asset?.id,
  async (next, previous) => {
    if (previous && previous !== next && dirty.value) await save()
    await loadAsset()
  },
  { immediate: true },
)

function fit(): void {
  const width = Math.max(1, canvasSize.value.width)
  const available = Math.max(160, Math.min((scroll.value?.clientWidth ?? globalThis.innerWidth) - 28, 560))
  zoom.value = Math.max(2, Math.min(32, Math.floor(available / width)))
  customZoom = false
}

function canvasToBlob(target: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => target.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error('PNG encode failed')),
    'image/png',
  ))
}

async function performSave(): Promise<boolean> {
  const target = canvas.value
  const assetId = loadedAssetId
  if (!target || !dirty.value) return true
  if (!assetId || props.disabled || !props.persist) return false
  saving.value = true
  const revision = editRevision
  try {
    const blob = await canvasToBlob(target)
    const saved = await props.persist(assetId, blob, target.width, target.height)
    if (saved && revision === editRevision) setDirty(false)
    return saved
  } catch {
    return false
  } finally {
    saving.value = false
  }
}

function save(): Promise<boolean> {
  if (savePromise) return savePromise
  savePromise = performSave().finally(() => { savePromise = undefined })
  return savePromise
}

function undo(): void {
  const current = snapshot()
  const previous = history.pop()
  if (!current || !previous) return
  pushUniquePaintHistory(future, current, 64)
  restore(previous)
  markEdited()
  updateHistoryDepths()
}

function redo(): void {
  const current = snapshot()
  const next = future.pop()
  if (!current || !next) return
  pushUniquePaintHistory(history, current, 64)
  restore(next)
  markEdited()
  updateHistoryDepths()
}

function pointForCoordinates(clientX: number, clientY: number, clampToCanvas = false): PaintPoint | undefined {
  const target = canvas.value
  if (!target) return undefined
  const rect = target.getBoundingClientRect()
  const rawX = (clientX - rect.left) / Math.max(1, rect.width) * target.width
  const rawY = (clientY - rect.top) / Math.max(1, rect.height) * target.height
  if (!clampToCanvas && (rawX < 0 || rawY < 0 || rawX >= target.width || rawY >= target.height)) {
    return undefined
  }
  return {
    x: Math.max(0, Math.min(target.width - 1, Math.floor(rawX))),
    y: Math.max(0, Math.min(target.height - 1, Math.floor(rawY))),
  }
}

function rgbaToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`
}

function selectedRgba(): Rgba {
  const value = Number.parseInt(color.value.replace('#', '').padEnd(6, '0').slice(0, 6), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255, Math.round(opacity.value / 100 * 255)]
}

function inspect(point: PaintPoint): void {
  const ctx = context()
  if (!ctx) return
  const pixel = ctx.getImageData(point.x, point.y, 1, 1).data
  pixelInfo.value = {
    x: point.x,
    y: point.y,
    color: rgbaToHex(pixel[0]!, pixel[1]!, pixel[2]!),
    alpha: pixel[3]!,
  }
}

function paintPoint(ctx: CanvasRenderingContext2D, point: PaintPoint, erase = false): void {
  const target = canvas.value
  if (!target) return
  const [r, g, b, a] = selectedRgba()
  ctx.fillStyle = `rgba(${r},${g},${b},${a / 255})`
  for (const pixel of mirroredBrushPixels(
    point,
    target.width,
    target.height,
    brushSize.value,
    mirrorX.value,
    mirrorY.value,
  )) {
    if (erase) ctx.clearRect(pixel.x, pixel.y, 1, 1)
    else ctx.fillRect(pixel.x, pixel.y, 1, 1)
  }
}

function paintLine(ctx: CanvasRenderingContext2D, from: PaintPoint, to: PaintPoint, erase = false): void {
  for (const point of linePixels(from, to)) paintPoint(ctx, point, erase)
}

function paintRectangle(ctx: CanvasRenderingContext2D, from: PaintPoint, to: PaintPoint): void {
  for (const point of rectanglePixels(from, to)) paintPoint(ctx, point)
}

function applyFill(ctx: CanvasRenderingContext2D, point: PaintPoint): boolean {
  const image = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
  const changed = floodFillPixels(image.data, ctx.canvas.width, ctx.canvas.height, point, selectedRgba())
  if (changed) ctx.putImageData(image, 0, 0)
  return changed > 0
}

function applyReplace(ctx: CanvasRenderingContext2D, point: PaintPoint): boolean {
  const image = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
  const offset = (point.y * ctx.canvas.width + point.x) * 4
  const target: Rgba = [image.data[offset]!, image.data[offset + 1]!, image.data[offset + 2]!, image.data[offset + 3]!]
  const changed = replaceColorPixels(image.data, target, selectedRgba())
  if (changed) ctx.putImageData(image, 0, 0)
  return changed > 0
}

function touchDistance(): number {
  const values = [...touches.values()]
  if (values.length < 2) return 0
  return Math.hypot(values[0]!.x - values[1]!.x, values[0]!.y - values[1]!.y)
}

function touchCentroid(): PaintPoint {
  const values = [...touches.values()]
  if (values.length < 2) return values[0] ?? { x: 0, y: 0 }
  return { x: (values[0]!.x + values[1]!.x) / 2, y: (values[0]!.y + values[1]!.y) / 2 }
}

function safeCapture(target: HTMLElement, pointerId: number): void {
  try {
    target.setPointerCapture(pointerId)
  } catch {
    // Safari may reject capture if the pointer ended between event delivery and this call.
  }
}

function safeRelease(target: HTMLElement, pointerId: number): void {
  try {
    if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId)
  } catch {
    // The browser already released it; cleanup below remains authoritative.
  }
}

function beginPinch(): void {
  if (gesture) {
    restore(gesture.before)
    setDirty(gesture.dirtyBefore)
    gesture = undefined
  }
  interacting.value = true
  pinchActive = true
  pinchStartDistance = touchDistance()
  pinchStartZoom = zoom.value
  pinchStartCentroid = touchCentroid()
  pinchStartScroll = {
    left: scroll.value?.scrollLeft ?? 0,
    top: scroll.value?.scrollTop ?? 0,
  }
}

function pointerDown(event: PointerEvent): void {
  if (props.disabled || saving.value || (event.pointerType === 'mouse' && event.button !== 0)) return
  event.preventDefault()
  const surface = interactionSurface.value
  if (!surface) return
  safeCapture(surface, event.pointerId)
  if (event.pointerType === 'touch') {
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (touches.size >= 2) {
      beginPinch()
      return
    }
  }
  if (gesture) return
  const point = pointForCoordinates(event.clientX, event.clientY)
  const before = snapshot()
  if (!point || !before) {
    safeRelease(surface, event.pointerId)
    return
  }
  gesture = {
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    tool: tool.value,
    startClient: { x: event.clientX, y: event.clientY },
    startPoint: point,
    lastPoint: point,
    before,
    dirtyBefore: dirty.value,
    started: event.pointerType !== 'touch',
  }
  interacting.value = true
  if (gesture.started && (gesture.tool === 'pencil' || gesture.tool === 'eraser')) {
    const ctx = context()
    if (ctx) paintPoint(ctx, point, gesture.tool === 'eraser')
  }
}

function coalescedEvents(event: PointerEvent): PointerEvent[] {
  const events = event.getCoalescedEvents?.() ?? []
  const last = events.at(-1)
  if (!last || last.clientX !== event.clientX || last.clientY !== event.clientY) events.push(event)
  return events
}

function pointerMove(event: PointerEvent): void {
  if (event.pointerType === 'touch' && touches.has(event.pointerId)) {
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pinchActive && touches.size >= 2 && pinchStartDistance > 0) {
      event.preventDefault()
      customZoom = true
      zoom.value = Math.max(2, Math.min(
        40,
        Math.round(pinchStartZoom * touchDistance() / pinchStartDistance * 10) / 10,
      ))
      const centroid = touchCentroid()
      if (scroll.value) {
        scroll.value.scrollLeft = pinchStartScroll.left - (centroid.x - pinchStartCentroid.x)
        scroll.value.scrollTop = pinchStartScroll.top - (centroid.y - pinchStartCentroid.y)
      }
      return
    }
  }
  const active = gesture
  if (!active || active.pointerId !== event.pointerId || pinchActive) return
  event.preventDefault()
  const movement = Math.hypot(
    event.clientX - active.startClient.x,
    event.clientY - active.startClient.y,
  )
  if (!active.started && movement < TOUCH_DEADZONE) return
  const ctx = context()
  if (!ctx) return
  if (!active.started) {
    active.started = true
    if (active.tool === 'pencil' || active.tool === 'eraser') {
      paintPoint(ctx, active.startPoint, active.tool === 'eraser')
    }
  }
  if (active.tool !== 'pencil' && active.tool !== 'eraser') return
  for (const sample of coalescedEvents(event)) {
    const point = pointForCoordinates(sample.clientX, sample.clientY, true)
    if (!point) continue
    paintLine(ctx, active.lastPoint, point, active.tool === 'eraser')
    active.lastPoint = point
  }
}

function completeGesture(point: PaintPoint): void {
  const active = gesture
  const ctx = context()
  if (!active || !ctx) return
  if (active.tool === 'inspect') inspect(point)
  else if (active.tool === 'eyedropper') {
    inspect(point)
    if (pixelInfo.value) color.value = pixelInfo.value.color
    tool.value = 'pencil'
  } else if (active.tool === 'fill') applyFill(ctx, point)
  else if (active.tool === 'replace') applyReplace(ctx, point)
  else if (active.tool === 'line') paintLine(ctx, active.startPoint, point)
  else if (active.tool === 'rectangle') paintRectangle(ctx, active.startPoint, point)
  else if (!active.started) paintPoint(ctx, point, active.tool === 'eraser')
}

function finalizeGesture(): void {
  const active = gesture
  const current = snapshot()
  gesture = undefined
  interacting.value = pinchActive || touches.size > 0
  if (!active || !current) return
  if (paintSnapshotsEqual(active.before, current)) {
    setDirty(active.dirtyBefore)
    return
  }
  rememberBefore(active.before)
  markEdited()
}

function pointerUp(event: PointerEvent): void {
  event.preventDefault()
  const surface = interactionSurface.value
  if (event.pointerType === 'touch') touches.delete(event.pointerId)
  if (pinchActive) {
    if (touches.size < 2) pinchStartDistance = 0
    if (!touches.size) {
      pinchActive = false
      interacting.value = false
    }
    if (surface) safeRelease(surface, event.pointerId)
    return
  }
  if (gesture?.pointerId === event.pointerId) {
    const point = pointForCoordinates(event.clientX, event.clientY, true) ?? gesture.lastPoint
    completeGesture(point)
    finalizeGesture()
  }
  if (surface) safeRelease(surface, event.pointerId)
}

function pointerCancel(event: PointerEvent): void {
  const surface = interactionSurface.value
  if (event.pointerType === 'touch') touches.delete(event.pointerId)
  if (gesture?.pointerId === event.pointerId) finalizeGesture()
  if (touches.size < 2) pinchStartDistance = 0
  if (!touches.size) {
    pinchActive = false
    interacting.value = false
  }
  if (surface) safeRelease(surface, event.pointerId)
}

function selectTool(entry: PaintTool): void {
  if (interacting.value) return
  tool.value = entry
}

function saveWhenHidden(): void {
  if (document.visibilityState === 'hidden') void save()
}

function saveOnPageHide(): void {
  void save()
}

onMounted(() => {
  if (!scroll.value) return
  resizeObserver = new ResizeObserver(() => {
    if (!customZoom && !interacting.value) fit()
  })
  resizeObserver.observe(scroll.value)
  document.addEventListener('visibilitychange', saveWhenHidden)
  globalThis.addEventListener('pagehide', saveOnPageHide)
})

onBeforeUnmount(() => {
  loadGeneration += 1
  resizeObserver?.disconnect()
  document.removeEventListener('visibilitychange', saveWhenHidden)
  globalThis.removeEventListener('pagehide', saveOnPageHide)
  if (autosaveTimer) clearTimeout(autosaveTimer)
  touches.clear()
  if (gesture) finalizeGesture()
  void save()
})

defineExpose({ flush: save })
</script>

<template>
  <section class="paint-studio">
    <header class="paint-toolbar">
      <div class="tool-strip">
        <button
          v-for="entry in tools"
          :key="entry"
          type="button"
          :class="{ active: tool === entry }"
          :aria-pressed="tool === entry"
          :disabled="interacting"
          @click="selectTool(entry)"
        >
          {{ toolLabel(entry) }}
        </button>
      </div>
      <div class="history-actions">
        <button type="button" :disabled="!historyDepth || interacting" :aria-label="locale.t('Undo')" @click="undo">↶</button>
        <button type="button" :disabled="!futureDepth || interacting" :aria-label="locale.t('Redo')" @click="redo">↷</button>
      </div>
    </header>

    <div class="paint-options">
      <label><span>{{ locale.t('Color') }}</span><input v-model="color" type="color" /></label>
      <label><span>{{ locale.t('Opacity') }}</span><select v-model.number="opacity"><option :value="25">25%</option><option :value="50">50%</option><option :value="75">75%</option><option :value="100">100%</option></select></label>
      <label><span>{{ locale.t('Pixel') }}</span><select v-model.number="brushSize"><option :value="1">1 px</option><option :value="2">2 px</option><option :value="4">4 px</option><option :value="8">8 px</option></select></label>
      <button type="button" :class="{ active: mirrorX }" :aria-pressed="mirrorX" @click="mirrorX = !mirrorX">{{ locale.t('Mirror X') }}</button>
      <button type="button" :class="{ active: mirrorY }" :aria-pressed="mirrorY" @click="mirrorY = !mirrorY">{{ locale.t('Mirror Y') }}</button>
      <button type="button" :class="{ active: showGrid }" :aria-pressed="showGrid" @click="showGrid = !showGrid">{{ locale.t('Grid') }}</button>
      <button type="button" @click="fit">{{ locale.t('Fit') }}</button>
      <output>{{ Math.round(zoom * 100) }}%</output>
    </div>

    <div
      ref="interactionSurface"
      class="canvas-stage"
      @pointerdown="pointerDown"
      @pointermove="pointerMove"
      @pointerup="pointerUp"
      @pointercancel="pointerCancel"
      @lostpointercapture="pointerCancel"
      @contextmenu.prevent
    >
      <div ref="scroll" class="canvas-scroll">
        <div class="canvas-frame" :style="canvasStyle">
          <canvas ref="canvas" :style="canvasStyle" />
          <div v-if="showGrid && zoom >= 6" class="pixel-grid" :style="gridStyle" />
        </div>
      </div>
      <div v-if="!asset" class="canvas-empty">{{ locale.t('Create or import a texture before painting.') }}</div>
      <div v-if="loadError" class="canvas-error">{{ loadError }}</div>
      <div v-if="pixelInfo" class="pixel-readout">X {{ pixelInfo.x }} · Y {{ pixelInfo.y }} · {{ pixelInfo.color }} · A {{ pixelInfo.alpha }}</div>
    </div>

    <footer class="paint-footer">
      <span>{{ canvasSize.width }}×{{ canvasSize.height }} px · {{ locale.t('pinch to zoom') }} · {{ locale.t(mirrorX || mirrorY ? 'mirror active' : 'free paint') }}</span>
      <button type="button" :disabled="!dirty || disabled || saving" @click="save">
        {{ saving ? locale.t('Saving') : locale.t('Save PNG') }}
      </button>
    </footer>
  </section>
</template>

<style scoped>
.paint-studio { min-width: 0; min-height: 0; display: grid; grid-template-rows: auto auto minmax(11rem,1fr) auto; overflow: hidden; background: #0e1210; color: #eef3ef; user-select: none; -webkit-user-select: none; }
.paint-toolbar { min-width: 0; min-height: 3.25rem; display: flex; align-items: center; gap: .4rem; padding: .35rem .55rem; border-bottom: 1px solid #ffffff12; background: #151a17; }.tool-strip { min-width: 0; display: flex; flex: 1; gap: .35rem; overflow-x: auto; scrollbar-width: none; }.tool-strip::-webkit-scrollbar { display: none; }.tool-strip button,.history-actions button,.paint-options button { flex: 0 0 auto; min-height: 2.75rem; border: 1px solid #ffffff14; border-radius: .65rem; padding: 0 .72rem; background: #202622; color: #aab4ae; font-size: .7rem; font-weight: 780; white-space: nowrap; }.tool-strip button.active,.paint-options button.active { border-color: #62dc86; background: #183a23; color: #c3f6d0; }.tool-strip button:disabled,.history-actions button:disabled { opacity: .42; }.history-actions { display: flex; gap: .3rem; }.history-actions button { min-width: 2.75rem; padding: 0; font-size: 1rem; }
.paint-options { min-width: 0; display: flex; align-items: center; gap: .45rem; overflow-x: auto; padding: .4rem .6rem; border-bottom: 1px solid #ffffff10; scrollbar-width: none; }.paint-options::-webkit-scrollbar { display:none; }.paint-options label { flex: 0 0 auto; display: flex; align-items: center; gap: .35rem; color: #95a099; font-size: .66rem; }.paint-options input[type='color'] { width: 2.75rem; height: 2.75rem; border: 0; border-radius: .65rem; padding: .2rem; background: #202622; }.paint-options select { min-height: 2.75rem; border: 1px solid #ffffff14; border-radius: .65rem; padding: 0 .5rem; background: #202622; color: #eef3ef; font-size: 16px; }.paint-options output { min-width: 3rem; color: #aeb9b2; font-family: var(--font-mono); font-size: .66rem; }
.canvas-stage { position: relative; min-width: 0; min-height: 11rem; overflow: hidden; background: #0b0f0d; touch-action: none; overscroll-behavior: none; -webkit-touch-callout: none; }.canvas-scroll { box-sizing: border-box; width: 100%; height: 100%; overflow: auto; display: grid; place-items: start center; padding: 1rem; background-image: linear-gradient(45deg,#1d231f 25%,transparent 25%),linear-gradient(-45deg,#1d231f 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#1d231f 75%),linear-gradient(-45deg,transparent 75%,#1d231f 75%); background-size:20px 20px; background-position:0 0,0 10px,10px -10px,-10px 0; overscroll-behavior: none; touch-action: none; }.canvas-frame { position: relative; flex: 0 0 auto; }.canvas-frame canvas { position: absolute; inset: 0; display: block; max-width: none; border: 1px solid #ffffff24; image-rendering: pixelated; touch-action: none; box-shadow: 0 12px 35px #0008; }.pixel-grid { position: absolute; inset: 0; pointer-events: none; background-image: linear-gradient(to right,#ffffff25 1px,transparent 1px),linear-gradient(to bottom,#ffffff25 1px,transparent 1px); }.pixel-readout,.canvas-error { position: absolute; right: .6rem; bottom: .6rem; max-width: calc(100% - 1.2rem); border: 1px solid #ffffff18; border-radius: 999px; padding: .32rem .52rem; background: #080c0add; color: #b9f3ca; font-family: var(--font-mono); font-size: .62rem; pointer-events: none; }.canvas-error { left: .6rem; right: auto; border-color: #ff7b7b55; color: #ffd0d0; font-family: inherit; }.canvas-empty { position:absolute; inset:0; z-index:3; display:grid; place-items:center; padding:1.5rem; background:#0b0f0de8; color:#aab5ae; font-size:.78rem; font-weight:750; text-align:center; pointer-events:none; }
.paint-footer { min-width: 0; min-height: 3rem; display: flex; align-items: center; justify-content: space-between; gap: .5rem; padding: .35rem .6rem; border-top: 1px solid #ffffff10; color: #8f9a93; font-size: .62rem; }.paint-footer span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.paint-footer button { flex: 0 0 auto; min-height: 2.75rem; border: 1px solid #55d77c55; border-radius: .7rem; padding: 0 .8rem; background: #173823; color: #c1f6cf; font-size: .7rem; font-weight: 800; }.paint-footer button:disabled { opacity: .4; }
@media (max-width: 390px) { .paint-options label > span { display: none; }.paint-footer span { max-width: 58%; } }
@media (orientation: landscape) and (max-height: 520px) { .paint-studio { grid-template-rows: auto auto minmax(8rem,1fr) auto; }.paint-footer { min-height: 2.8rem; } }
</style>
