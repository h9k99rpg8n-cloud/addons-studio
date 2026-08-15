<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

import type { StudioTextureAsset } from '@/types/texture'

const props = defineProps<{
  asset?: StudioTextureAsset
  disabled?: boolean
}>()

const emit = defineEmits<{
  save: [blob: Blob, width: number, height: number]
  dirtyChange: [dirty: boolean]
}>()

type PaintTool = 'pencil' | 'eraser' | 'fill' | 'eyedropper' | 'inspect' | 'line' | 'rectangle' | 'replace'
type PixelPoint = { x: number; y: number }

const canvas = ref<HTMLCanvasElement>()
const scroll = ref<HTMLDivElement>()
const tool = ref<PaintTool>('pencil')
const color = ref('#4f8f62')
const opacity = ref(100)
const brushSize = ref(1)
const zoom = ref(10)
const showGrid = ref(true)
const mirrorX = ref(false)
const mirrorY = ref(false)
const history = ref<ImageData[]>([])
const future = ref<ImageData[]>([])
const dirty = ref(false)
const pixelInfo = ref<{ x: number; y: number; color: string; alpha: number }>()
const gestureStart = ref<PixelPoint>()
const lastPoint = ref<PixelPoint>()
const touches = new Map<number, PixelPoint>()
let objectUrl: string | undefined
let pinchStartDistance = 0
let pinchStartZoom = 10
let pinchStartCentroid: PixelPoint = { x: 0, y: 0 }
let pinchStartScroll = { left: 0, top: 0 }

const tools: readonly PaintTool[] = ['pencil', 'eraser', 'fill', 'eyedropper', 'line', 'rectangle', 'replace', 'inspect']
const canvasSize = computed(() => ({ width: canvas.value?.width ?? props.asset?.width ?? 32, height: canvas.value?.height ?? props.asset?.height ?? 32 }))
const canvasStyle = computed(() => ({
  width: `${canvasSize.value.width * zoom.value}px`,
  height: `${canvasSize.value.height * zoom.value}px`,
}))
const gridStyle = computed(() => ({
  backgroundSize: `${zoom.value}px ${zoom.value}px`,
}))

function setDirty(value: boolean): void {
  dirty.value = value
  emit('dirtyChange', value)
}

function releaseUrl(): void {
  if (objectUrl) URL.revokeObjectURL(objectUrl)
  objectUrl = undefined
}

async function loadAsset(): Promise<void> {
  await nextTick()
  const target = canvas.value
  if (!target) return
  const ctx = target.getContext('2d', { willReadFrequently: true })
  if (!ctx) return
  history.value = []
  future.value = []
  pixelInfo.value = undefined
  setDirty(false)
  const asset = props.asset
  if (!asset) {
    target.width = 32
    target.height = 32
    ctx.clearRect(0, 0, target.width, target.height)
    fit()
    return
  }
  releaseUrl()
  objectUrl = URL.createObjectURL(asset.blob)
  const image = new Image()
  image.decoding = 'async'
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('Texture decode failed'))
    image.src = objectUrl!
  })
  target.width = asset.width
  target.height = asset.height
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, target.width, target.height)
  ctx.drawImage(image, 0, 0, target.width, target.height)
  fit()
}

watch(() => props.asset?.blob, () => { void loadAsset() }, { immediate: true })
onBeforeUnmount(releaseUrl)

function fit(): void {
  const width = Math.max(1, canvasSize.value.width)
  const available = Math.max(180, Math.min(globalThis.innerWidth - 30, 560))
  zoom.value = Math.max(2, Math.min(32, Math.floor(available / width)))
}

function canvasToBlob(target: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => target.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG encode failed')), 'image/png'))
}

async function save(): Promise<void> {
  if (!canvas.value || !dirty.value || props.disabled) return
  emit('save', await canvasToBlob(canvas.value), canvas.value.width, canvas.value.height)
  setDirty(false)
}

function pushHistory(): void {
  const target = canvas.value
  const ctx = target?.getContext('2d', { willReadFrequently: true })
  if (!target || !ctx) return
  history.value.push(ctx.getImageData(0, 0, target.width, target.height))
  if (history.value.length > 64) history.value.shift()
  future.value = []
}

function restoreImage(data: ImageData): void {
  const target = canvas.value
  const ctx = target?.getContext('2d', { willReadFrequently: true })
  if (!target || !ctx) return
  ctx.putImageData(data, 0, 0)
  setDirty(true)
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

function pointForEvent(event: PointerEvent): PixelPoint | undefined {
  const target = canvas.value
  if (!target) return undefined
  const rect = target.getBoundingClientRect()
  const x = Math.floor((event.clientX - rect.left) / Math.max(1, rect.width) * target.width)
  const y = Math.floor((event.clientY - rect.top) / Math.max(1, rect.height) * target.height)
  if (x < 0 || y < 0 || x >= target.width || y >= target.height) return undefined
  return { x, y }
}

function rgbaToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`
}

function hexToRgba(hex: string): [number, number, number, number] {
  const value = Number.parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255, Math.round(opacity.value / 100 * 255)]
}

function mirroredPoints(point: PixelPoint): PixelPoint[] {
  const target = canvas.value
  if (!target) return [point]
  const points = [point]
  if (mirrorX.value) points.push({ x: target.width - 1 - point.x, y: point.y })
  if (mirrorY.value) points.push({ x: point.x, y: target.height - 1 - point.y })
  if (mirrorX.value && mirrorY.value) points.push({ x: target.width - 1 - point.x, y: target.height - 1 - point.y })
  return [...new Map(points.map((entry) => [`${entry.x}:${entry.y}`, entry])).values()]
}

function paintSquare(ctx: CanvasRenderingContext2D, point: PixelPoint, erase = false): void {
  const size = brushSize.value
  for (const mirrored of mirroredPoints(point)) {
    if (erase) ctx.clearRect(mirrored.x, mirrored.y, size, size)
    else {
      const [r, g, b, a] = hexToRgba(color.value)
      ctx.fillStyle = `rgba(${r},${g},${b},${a / 255})`
      ctx.fillRect(mirrored.x, mirrored.y, size, size)
    }
  }
}

function drawLine(ctx: CanvasRenderingContext2D, from: PixelPoint, to: PixelPoint, erase = false): void {
  let x0 = from.x
  let y0 = from.y
  const x1 = to.x
  const y1 = to.y
  const dx = Math.abs(x1 - x0)
  const sx = x0 < x1 ? 1 : -1
  const dy = -Math.abs(y1 - y0)
  const sy = y0 < y1 ? 1 : -1
  let error = dx + dy
  while (true) {
    paintSquare(ctx, { x: x0, y: y0 }, erase)
    if (x0 === x1 && y0 === y1) break
    const doubled = 2 * error
    if (doubled >= dy) { error += dy; x0 += sx }
    if (doubled <= dx) { error += dx; y0 += sy }
  }
}

function drawRectangle(ctx: CanvasRenderingContext2D, from: PixelPoint, to: PixelPoint): void {
  const left = Math.min(from.x, to.x)
  const right = Math.max(from.x, to.x)
  const top = Math.min(from.y, to.y)
  const bottom = Math.max(from.y, to.y)
  drawLine(ctx, { x: left, y: top }, { x: right, y: top })
  drawLine(ctx, { x: right, y: top }, { x: right, y: bottom })
  drawLine(ctx, { x: right, y: bottom }, { x: left, y: bottom })
  drawLine(ctx, { x: left, y: bottom }, { x: left, y: top })
}

function floodFill(ctx: CanvasRenderingContext2D, startPoint: PixelPoint): void {
  const width = ctx.canvas.width
  const height = ctx.canvas.height
  const image = ctx.getImageData(0, 0, width, height)
  const data = image.data
  const offset = (startPoint.y * width + startPoint.x) * 4
  const target = [data[offset], data[offset + 1], data[offset + 2], data[offset + 3]]
  const replacement = hexToRgba(color.value)
  if (target.every((value, index) => value === replacement[index])) return
  const stack: PixelPoint[] = [startPoint]
  while (stack.length) {
    const point = stack.pop()!
    if (point.x < 0 || point.y < 0 || point.x >= width || point.y >= height) continue
    const index = (point.y * width + point.x) * 4
    if (!target.every((value, channel) => data[index + channel] === value)) continue
    data[index] = replacement[0]
    data[index + 1] = replacement[1]
    data[index + 2] = replacement[2]
    data[index + 3] = replacement[3]
    stack.push(
      { x: point.x + 1, y: point.y },
      { x: point.x - 1, y: point.y },
      { x: point.x, y: point.y + 1 },
      { x: point.x, y: point.y - 1 },
    )
  }
  ctx.putImageData(image, 0, 0)
}

function replaceColor(ctx: CanvasRenderingContext2D, point: PixelPoint): void {
  const image = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
  const data = image.data
  const start = (point.y * ctx.canvas.width + point.x) * 4
  const target = [data[start], data[start + 1], data[start + 2], data[start + 3]]
  const replacement = hexToRgba(color.value)
  for (let index = 0; index < data.length; index += 4) {
    if (target.every((value, channel) => data[index + channel] === value)) {
      data[index] = replacement[0]
      data[index + 1] = replacement[1]
      data[index + 2] = replacement[2]
      data[index + 3] = replacement[3]
    }
  }
  ctx.putImageData(image, 0, 0)
}

function inspect(point: PixelPoint): void {
  const ctx = canvas.value?.getContext('2d', { willReadFrequently: true })
  if (!ctx) return
  const pixel = ctx.getImageData(point.x, point.y, 1, 1).data
  pixelInfo.value = { x: point.x, y: point.y, color: rgbaToHex(pixel[0]!, pixel[1]!, pixel[2]!), alpha: pixel[3]! }
}

function applyInstantTool(point: PixelPoint): boolean {
  const ctx = canvas.value?.getContext('2d', { willReadFrequently: true })
  if (!ctx) return false
  if (tool.value === 'inspect') { inspect(point); return true }
  if (tool.value === 'eyedropper') {
    inspect(point)
    if (pixelInfo.value) color.value = pixelInfo.value.color
    tool.value = 'pencil'
    return true
  }
  if (tool.value === 'fill') {
    pushHistory()
    floodFill(ctx, point)
    setDirty(true)
    return true
  }
  if (tool.value === 'replace') {
    pushHistory()
    replaceColor(ctx, point)
    setDirty(true)
    return true
  }
  return false
}

function touchDistance(): number {
  const values = [...touches.values()]
  if (values.length < 2) return 0
  return Math.hypot(values[0]!.x - values[1]!.x, values[0]!.y - values[1]!.y)
}

function touchCentroid(): PixelPoint {
  const values = [...touches.values()]
  if (values.length < 2) return values[0] ?? { x: 0, y: 0 }
  return { x: (values[0]!.x + values[1]!.x) / 2, y: (values[0]!.y + values[1]!.y) / 2 }
}

function pointerDown(event: PointerEvent): void {
  if (props.disabled) return
  if (event.pointerType === 'touch') {
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (touches.size === 2) {
      pinchStartDistance = touchDistance()
      pinchStartZoom = zoom.value
      pinchStartCentroid = touchCentroid()
      pinchStartScroll = { left: scroll.value?.scrollLeft ?? 0, top: scroll.value?.scrollTop ?? 0 }
      return
    }
  }
  const point = pointForEvent(event)
  if (!point || applyInstantTool(point)) return
  canvas.value?.setPointerCapture(event.pointerId)
  gestureStart.value = point
  lastPoint.value = point
  pushHistory()
  const ctx = canvas.value?.getContext('2d', { willReadFrequently: true })
  if (!ctx) return
  if (tool.value === 'pencil') paintSquare(ctx, point)
  if (tool.value === 'eraser') paintSquare(ctx, point, true)
  if (tool.value === 'pencil' || tool.value === 'eraser') setDirty(true)
}

function pointerMove(event: PointerEvent): void {
  if (event.pointerType === 'touch' && touches.has(event.pointerId)) {
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (touches.size >= 2 && pinchStartDistance > 0) {
      event.preventDefault()
      zoom.value = Math.max(2, Math.min(40, Math.round(pinchStartZoom * touchDistance() / pinchStartDistance * 10) / 10))
      const centroid = touchCentroid()
      if (scroll.value) {
        scroll.value.scrollLeft = pinchStartScroll.left - (centroid.x - pinchStartCentroid.x)
        scroll.value.scrollTop = pinchStartScroll.top - (centroid.y - pinchStartCentroid.y)
      }
      return
    }
  }
  if (!canvas.value?.hasPointerCapture(event.pointerId)) return
  const point = pointForEvent(event)
  const ctx = canvas.value.getContext('2d', { willReadFrequently: true })
  if (!point || !ctx || !lastPoint.value) return
  if (tool.value === 'pencil' || tool.value === 'eraser') {
    drawLine(ctx, lastPoint.value, point, tool.value === 'eraser')
    lastPoint.value = point
    setDirty(true)
  }
}

function pointerUp(event: PointerEvent): void {
  touches.delete(event.pointerId)
  if (touches.size < 2) pinchStartDistance = 0
  const target = canvas.value
  if (!target?.hasPointerCapture(event.pointerId)) return
  const point = pointForEvent(event)
  const ctx = target.getContext('2d', { willReadFrequently: true })
  if (point && ctx && gestureStart.value) {
    if (tool.value === 'line') { drawLine(ctx, gestureStart.value, point); setDirty(true) }
    if (tool.value === 'rectangle') { drawRectangle(ctx, gestureStart.value, point); setDirty(true) }
  }
  target.releasePointerCapture(event.pointerId)
  gestureStart.value = undefined
  lastPoint.value = undefined
}
</script>

<template>
  <section class="paint-studio">
    <header class="paint-toolbar">
      <div class="tool-strip">
        <button v-for="entry in tools" :key="entry" type="button" :class="{ active: tool === entry }" @click="tool = entry">{{ entry }}</button>
      </div>
      <div class="history-actions">
        <button type="button" :disabled="!history.length" @click="undo">↶</button>
        <button type="button" :disabled="!future.length" @click="redo">↷</button>
      </div>
    </header>

    <div class="paint-options">
      <label><span>Color</span><input v-model="color" type="color" /></label>
      <label><span>Opacity</span><select v-model.number="opacity"><option :value="25">25%</option><option :value="50">50%</option><option :value="75">75%</option><option :value="100">100%</option></select></label>
      <label><span>Pixel</span><select v-model.number="brushSize"><option :value="1">1 px</option><option :value="2">2 px</option><option :value="4">4 px</option><option :value="8">8 px</option></select></label>
      <button type="button" :class="{ active: mirrorX }" @click="mirrorX = !mirrorX">Mirror X</button>
      <button type="button" :class="{ active: mirrorY }" @click="mirrorY = !mirrorY">Mirror Y</button>
      <button type="button" :class="{ active: showGrid }" @click="showGrid = !showGrid">Grid</button>
      <button type="button" @click="fit">Fit</button>
      <output>{{ Math.round(zoom * 100) }}%</output>
    </div>

    <div class="canvas-stage">
      <div ref="scroll" class="canvas-scroll">
        <div class="canvas-frame" :style="canvasStyle">
          <canvas
            ref="canvas"
            :style="canvasStyle"
            @pointerdown="pointerDown"
            @pointermove="pointerMove"
            @pointerup="pointerUp"
            @pointercancel="pointerUp"
          />
          <div v-if="showGrid && zoom >= 6" class="pixel-grid" :style="gridStyle" />
        </div>
      </div>
      <div v-if="pixelInfo" class="pixel-readout">X {{ pixelInfo.x }} · Y {{ pixelInfo.y }} · {{ pixelInfo.color }} · A {{ pixelInfo.alpha }}</div>
    </div>

    <footer class="paint-footer">
      <span>{{ canvasSize.width }}×{{ canvasSize.height }} px · pinch to zoom · {{ mirrorX || mirrorY ? 'mirror active' : 'free paint' }}</span>
      <button type="button" :disabled="!dirty || disabled" @click="save">Save PNG</button>
    </footer>
  </section>
</template>

<style scoped>
.paint-studio { min-height: 0; display: grid; grid-template-rows: auto auto minmax(13rem,1fr) auto; background: #0e1210; color: #eef3ef; }
.paint-toolbar { min-height: 3.1rem; display: flex; align-items: center; gap: .4rem; padding: .4rem .55rem; border-bottom: 1px solid #ffffff12; background: #151a17; }.tool-strip { min-width: 0; display: flex; flex: 1; gap: .3rem; overflow-x: auto; scrollbar-width: none; }.tool-strip::-webkit-scrollbar { display: none; }.tool-strip button,.history-actions button,.paint-options button { flex: 0 0 auto; min-height: 2.55rem; border: 1px solid #ffffff14; border-radius: .65rem; padding: 0 .65rem; background: #202622; color: #aab4ae; font-size: .65rem; font-weight: 780; text-transform: capitalize; }.tool-strip button.active,.paint-options button.active { border-color: #62dc86; background: #183a23; color: #c3f6d0; }.history-actions { display: flex; gap: .25rem; }.history-actions button { min-width: 2.55rem; padding: 0; font-size: 1rem; }
.paint-options { display: flex; align-items: center; gap: .45rem; overflow-x: auto; padding: .45rem .6rem; border-bottom: 1px solid #ffffff10; scrollbar-width: none; }.paint-options::-webkit-scrollbar { display:none; }.paint-options label { flex: 0 0 auto; display: flex; align-items: center; gap: .35rem; color: #95a099; font-size: .62rem; }.paint-options input[type='color'] { width: 2.5rem; height: 2.5rem; border: 0; border-radius: .65rem; padding: .2rem; background: #202622; }.paint-options select { min-height: 2.55rem; border: 1px solid #ffffff14; border-radius: .65rem; padding: 0 .45rem; background: #202622; color: #eef3ef; font-size: 16px; }.paint-options output { min-width: 3rem; color: #aeb9b2; font-family: var(--font-mono); font-size: .62rem; }
.canvas-stage { position: relative; min-height: 13rem; overflow: hidden; background: #0b0f0d; }.canvas-scroll { width: 100%; height: 100%; overflow: auto; display: grid; place-items: start center; padding: 1rem; background-image: linear-gradient(45deg,#1d231f 25%,transparent 25%),linear-gradient(-45deg,#1d231f 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#1d231f 75%),linear-gradient(-45deg,transparent 75%,#1d231f 75%); background-size:20px 20px; background-position:0 0,0 10px,10px -10px,-10px 0; overscroll-behavior: contain; }.canvas-frame { position: relative; flex: 0 0 auto; }.canvas-frame canvas { position: absolute; inset: 0; display: block; max-width: none; border: 1px solid #ffffff24; image-rendering: pixelated; touch-action: none; box-shadow: 0 12px 35px #0008; }.pixel-grid { position: absolute; inset: 0; pointer-events: none; background-image: linear-gradient(to right,#ffffff25 1px,transparent 1px),linear-gradient(to bottom,#ffffff25 1px,transparent 1px); }.pixel-readout { position: absolute; right: .6rem; bottom: .6rem; border: 1px solid #ffffff18; border-radius: 999px; padding: .28rem .48rem; background: #080c0add; color: #b9f3ca; font-family: var(--font-mono); font-size: .58rem; pointer-events: none; }
.paint-footer { min-height: 2.8rem; display: flex; align-items: center; justify-content: space-between; gap: .5rem; padding: .35rem .6rem calc(.35rem + env(safe-area-inset-bottom)); border-top: 1px solid #ffffff10; color: #8f9a93; font-size: .6rem; }.paint-footer button { min-height: 2.55rem; border: 1px solid #55d77c55; border-radius: .7rem; padding: 0 .75rem; background: #173823; color: #c1f6cf; font-size: .66rem; font-weight: 800; }.paint-footer button:disabled { opacity: .4; }
</style>
