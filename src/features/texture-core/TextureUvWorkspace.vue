<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { normalizeUvRect } from '@/core/texture/textureUvService'
import { useLocaleStore } from '@/stores/locale'
import type {
  StudioTextureAsset,
  StudioTextureBinding,
  StudioUvRect,
  TextureFace,
  UvPrecision,
} from '@/types/texture'

const locale = useLocaleStore()

const props = defineProps<{
  asset?: StudioTextureAsset
  binding?: StudioTextureBinding
  bindings?: StudioTextureBinding[]
  face: TextureFace
  selectedFaces?: TextureFace[]
  precision?: UvPrecision
  disabled?: boolean
}>()

const emit = defineEmits<{
  change: [uv: StudioUvRect]
  commit: [uv: StudioUvRect]
  changeBinding: [bindingId: string, uv: StudioUvRect]
  commitBinding: [bindingId: string, uv: StudioUvRect]
  selectFace: [face: TextureFace]
  boxUv: []
}>()

const stage = ref<HTMLDivElement>()
const textureUrl = ref('')
const clipboard = ref<StudioUvRect>()
const gesture = ref<{
  pointerId: number
  bindingId: string
  mode: 'move' | 'resize'
  startX: number
  startY: number
  stageWidth: number
  stageHeight: number
  textureWidth: number
  textureHeight: number
  precision: UvPrecision
  startUv: StudioUvRect
  lastUv: StudioUvRect
}>()

const textureWidth = computed(() => Math.max(1, props.asset?.width ?? 16))
const textureHeight = computed(() => Math.max(1, props.asset?.height ?? 16))
const precision = computed<UvPrecision>(() => props.precision ?? 1)
const visibleBindings = computed(() => {
  if (props.bindings?.length) return props.bindings
  return props.binding ? [props.binding] : []
})
const activeBinding = computed(() => {
  return visibleBindings.value.find((entry) => entry.face === props.face) ?? props.binding
})
const activeUv = computed<StudioUvRect>(() => activeBinding.value?.uv ?? {
  x: 0,
  y: 0,
  width: textureWidth.value,
  height: textureHeight.value,
  rotation: 0,
  flipHorizontal: false,
  flipVertical: false,
})
const selectedFaceSet = computed(() => new Set(props.selectedFaces?.length ? props.selectedFaces : [props.face]))

function releaseUrl(): void {
  if (textureUrl.value) URL.revokeObjectURL(textureUrl.value)
  textureUrl.value = ''
}

watch(
  () => props.asset?.blob,
  (blob) => {
    releaseUrl()
    if (blob) textureUrl.value = URL.createObjectURL(blob)
  },
  { immediate: true },
)

function clampUv(uv: StudioUvRect): StudioUvRect {
  return normalizeUvRect(uv, textureWidth.value, textureHeight.value, precision.value)
}

function clampGestureUv(
  uv: StudioUvRect,
  current: NonNullable<typeof gesture.value>,
): StudioUvRect {
  return normalizeUvRect(uv, current.textureWidth, current.textureHeight, current.precision)
}

function styleFor(binding: StudioTextureBinding): Record<string, string> {
  const uv = clampUv(binding.uv)
  return {
    left: `${uv.x / textureWidth.value * 100}%`,
    top: `${uv.y / textureHeight.value * 100}%`,
    width: `${uv.width / textureWidth.value * 100}%`,
    height: `${uv.height / textureHeight.value * 100}%`,
    '--uv-rotation': `${uv.rotation}deg`,
    '--uv-flip-x': uv.flipHorizontal ? '-1' : '1',
    '--uv-flip-y': uv.flipVertical ? '-1' : '1',
  }
}

function publish(binding: StudioTextureBinding, uv: StudioUvRect, commit = false): void {
  const next = clampUv(uv)
  if (commit) {
    if (binding.id === activeBinding.value?.id) emit('commit', next)
    emit('commitBinding', binding.id, next)
    return
  }
  if (binding.id === activeBinding.value?.id) emit('change', next)
  emit('changeBinding', binding.id, next)
}

function startGesture(event: PointerEvent, binding: StudioTextureBinding, mode: 'move' | 'resize'): void {
  if (props.disabled || !stage.value || gesture.value || (event.pointerType === 'mouse' && event.button !== 0)) return
  event.preventDefault()
  event.stopPropagation()
  emit('selectFace', binding.face)
  const target = event.currentTarget as HTMLElement
  const rect = stage.value.getBoundingClientRect()
  try {
    target.setPointerCapture(event.pointerId)
  } catch {
    // Continue without capture when Safari ends pointer ownership early.
  }
  gesture.value = {
    pointerId: event.pointerId,
    bindingId: binding.id,
    mode,
    startX: event.clientX,
    startY: event.clientY,
    stageWidth: Math.max(1, rect.width),
    stageHeight: Math.max(1, rect.height),
    textureWidth: textureWidth.value,
    textureHeight: textureHeight.value,
    precision: precision.value,
    startUv: { ...binding.uv },
    lastUv: clampUv(binding.uv),
  }
}

function moveGesture(event: PointerEvent): void {
  const current = gesture.value
  if (!current || current.pointerId !== event.pointerId) return
  const binding = visibleBindings.value.find((entry) => entry.id === current.bindingId)
  if (!binding) return
  event.preventDefault()
  const dx = (event.clientX - current.startX) / current.stageWidth * current.textureWidth
  const dy = (event.clientY - current.startY) / current.stageHeight * current.textureHeight
  const next = current.mode === 'move'
    ? { ...current.startUv, x: current.startUv.x + dx, y: current.startUv.y + dy }
    : { ...current.startUv, width: current.startUv.width + dx, height: current.startUv.height + dy }
  current.lastUv = clampGestureUv(next, current)
  publish(binding, current.lastUv)
}

function finishGesture(event: PointerEvent): void {
  const current = gesture.value
  if (!current || current.pointerId !== event.pointerId) return
  const binding = visibleBindings.value.find((entry) => entry.id === current.bindingId)
  const target = event.currentTarget as HTMLElement
  gesture.value = undefined
  try {
    if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId)
  } catch {
    // The browser already released capture; the stored final UV remains valid.
  }
  if (binding) publish(binding, current.lastUv, true)
  else emit('commitBinding', current.bindingId, current.lastUv)
}

function commitPendingGesture(): void {
  const current = gesture.value
  if (!current) return
  gesture.value = undefined
  emit('commitBinding', current.bindingId, current.lastUv)
  if (current.bindingId === activeBinding.value?.id) emit('commit', current.lastUv)
}

onBeforeUnmount(() => {
  commitPendingGesture()
  releaseUrl()
})

function transformActive(transform: (uv: StudioUvRect) => StudioUvRect): void {
  const binding = activeBinding.value
  if (!binding) return
  const next = clampUv(transform(binding.uv))
  publish(binding, next)
  publish(binding, next, true)
}

function rotate(): void {
  transformActive((uv) => {
    const order: StudioUvRect['rotation'][] = [0, 90, 180, 270]
    const index = order.indexOf(uv.rotation)
    return { ...uv, rotation: order[(index + 1) % order.length]! }
  })
}

function flipHorizontal(): void {
  transformActive((uv) => ({ ...uv, flipHorizontal: !uv.flipHorizontal }))
}

function flipVertical(): void {
  transformActive((uv) => ({ ...uv, flipVertical: !uv.flipVertical }))
}

function fitTexture(): void {
  transformActive(() => ({
    x: 0,
    y: 0,
    width: textureWidth.value,
    height: textureHeight.value,
    rotation: 0,
    flipHorizontal: false,
    flipVertical: false,
  }))
}

function resetActive(): void {
  fitTexture()
}

function copyActive(): void {
  if (!activeBinding.value) return
  clipboard.value = { ...activeBinding.value.uv }
}

function pasteActive(): void {
  if (!clipboard.value) return
  transformActive(() => ({ ...clipboard.value! }))
}
</script>

<template>
  <section class="uv-workspace">
    <header class="uv-toolbar">
      <div class="uv-summary">
        <strong>UV 2.0 · {{ locale.t(face[0]!.toUpperCase() + face.slice(1)) }}</strong>
        <span v-if="activeBinding">{{ activeUv.x }}, {{ activeUv.y }} · {{ activeUv.width }}×{{ activeUv.height }} px · {{ visibleBindings.length }} {{ locale.t('islands') }}</span>
        <span v-else>{{ locale.t('Assign a material to map this face') }}</span>
      </div>
      <div class="precision-control" aria-label="UV precision">
        <span>{{ locale.t('Snap') }}</span>
        <output>{{ precision }} px</output>
      </div>
    </header>

    <div class="uv-actions" aria-label="UV tools">
      <button type="button" :disabled="disabled" class="primary" @click="emit('boxUv')">{{ locale.t('Box UV') }}</button>
      <button type="button" :disabled="!activeBinding" title="Rotate 90°" @click="rotate">↻ 90°</button>
      <button type="button" :disabled="!activeBinding" title="Flip horizontal" @click="flipHorizontal">↔</button>
      <button type="button" :disabled="!activeBinding" title="Flip vertical" @click="flipVertical">↕</button>
      <button type="button" :disabled="!activeBinding" @click="copyActive">{{ locale.t('Copy') }}</button>
      <button type="button" :disabled="!activeBinding || !clipboard" @click="pasteActive">{{ locale.t('Paste') }}</button>
      <button type="button" :disabled="!activeBinding" @click="resetActive">{{ locale.t('Reset') }}</button>
      <button type="button" :disabled="!activeBinding" @click="fitTexture">{{ locale.t('Fit') }}</button>
    </div>

    <div class="uv-stage-wrap">
      <div ref="stage" class="uv-stage" :style="{ aspectRatio: `${textureWidth} / ${textureHeight}` }" @contextmenu.prevent>
        <div class="checker" />
        <img v-if="textureUrl" :src="textureUrl" alt="" draggable="false" />
        <div v-else class="empty-texture">{{ locale.t('No texture') }}</div>

        <div
          v-for="entry in visibleBindings"
          :key="entry.id"
          class="uv-island"
          :class="{ active: entry.face === face, selected: selectedFaceSet.has(entry.face) }"
          :style="styleFor(entry)"
          @pointerdown="startGesture($event, entry, 'move')"
          @pointermove="moveGesture"
          @pointerup="finishGesture"
          @pointercancel="finishGesture"
          @lostpointercapture="finishGesture"
          @click.stop="emit('selectFace', entry.face)"
        >
          <span>{{ locale.t(entry.face[0]!.toUpperCase() + entry.face.slice(1)) }}</span>
          <i class="orientation-mark" aria-hidden="true">↗</i>
          <button
            v-if="entry.face === face"
            type="button"
            class="resize-handle"
            aria-label="Resize UV face"
            @pointerdown.stop="startGesture($event, entry, 'resize')"
            @pointermove.stop="moveGesture"
            @pointerup.stop="finishGesture"
            @pointercancel.stop="finishGesture"
            @lostpointercapture.stop="finishGesture"
          />
        </div>
      </div>
    </div>

    <footer class="uv-hint">
      <span>{{ precision }} px · {{ selectedFaceSet.size }} {{ locale.t(selectedFaceSet.size === 1 ? 'face selected' : 'faces selected') }}</span>
      <span>{{ locale.t('Tap an island · drag to move · corner to resize') }}</span>
    </footer>
  </section>
</template>

<style scoped>
.uv-workspace { display: grid; min-height: 0; background: #0e1210; color: #f3f6f4; }
.uv-toolbar { min-height: 3.35rem; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; padding: 0.5rem 0.65rem; border-bottom: 1px solid #ffffff16; background: #141917; }
.uv-summary { min-width: 0; display: grid; gap: 0.08rem; }.uv-summary strong { font-size: 0.76rem; letter-spacing: 0.04em; }.uv-summary span { overflow: hidden; color: #9eaaa3; font-size: 0.64rem; text-overflow: ellipsis; white-space: nowrap; }
.precision-control { display: flex; flex: 0 0 auto; align-items: center; gap: .35rem; color: #8f9a94; font-size: .6rem; }.precision-control output { min-width: 3rem; color: #baf4cb; font-family: var(--font-mono); }
.uv-actions { display: flex; gap: .35rem; overflow-x: auto; padding: .42rem .55rem; border-bottom: 1px solid #ffffff10; background: #111613; scrollbar-width: none; }.uv-actions::-webkit-scrollbar { display: none; }.uv-actions button { flex: 0 0 auto; min-height: 2.75rem; border: 1px solid #ffffff18; border-radius: .7rem; padding: 0 .72rem; background: #202723; color: #e8eee9; font-size: .7rem; font-weight: 800; white-space: nowrap; }.uv-actions button.primary { border-color: #56d67c66; background: #173823; color: #c1f6cf; }.uv-actions button:disabled { opacity: .35; }
.uv-stage-wrap { min-height: 13rem; display: grid; place-items: center; overflow: auto; padding: 1rem; overscroll-behavior: contain; }
.uv-stage { position: relative; width: min(100%, 34rem); max-height: 50dvh; overflow: hidden; border: 1px solid #ffffff20; border-radius: 0.55rem; box-shadow: 0 18px 50px #0008; touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
.checker { position: absolute; inset: 0; background-color: #242a27; background-image: linear-gradient(45deg, #313834 25%, transparent 25%), linear-gradient(-45deg, #313834 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #313834 75%), linear-gradient(-45deg, transparent 75%, #313834 75%); background-size: 20px 20px; background-position: 0 0, 0 10px, 10px -10px, -10px 0; }
.uv-stage > img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: fill; image-rendering: pixelated; pointer-events: none; user-select: none; }
.empty-texture { position: absolute; inset: 0; display: grid; place-items: center; color: #829087; font-size: 0.72rem; }
.uv-island { position: absolute; z-index: 2; display: grid; place-items: center; box-sizing: border-box; border: 1px solid #90a198; background: #aab9b018; touch-action: none; }.uv-island.selected { border-color: #75b98a; background: #67ba7e25; }.uv-island.active { z-index: 4; border: 2px solid #63df8b; background: #63df8b30; box-shadow: 0 0 0 1px #07110a, 0 0 18px #3ddb7040; }
.uv-island > span { max-width: 90%; overflow: hidden; border-radius: 999px; padding: 0.16rem 0.38rem; background: #07110acc; color: #d9e5dd; font-size: 0.55rem; font-weight: 850; text-overflow: ellipsis; text-transform: uppercase; pointer-events: none; }.uv-island.active > span { color: #bdf6ce; }
.orientation-mark { position: absolute; top: .18rem; right: .22rem; color: #d8f7e1; font-size: .7rem; font-style: normal; line-height: 1; pointer-events: none; transform: rotate(var(--uv-rotation)) scaleX(var(--uv-flip-x)) scaleY(var(--uv-flip-y)); }
.resize-handle { position: absolute; right: -1.2rem; bottom: -1.2rem; width: 2.75rem; height: 2.75rem; border: 0; border-radius: 50%; background: transparent; touch-action: none; }.resize-handle::after { content: ''; position: absolute; right: .58rem; bottom: .58rem; width: .82rem; height: .82rem; border: 2px solid #07110a; border-radius: 50%; background: #63df8b; box-shadow: 0 2px 12px #0008; }
.uv-hint { min-height: 2.45rem; display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; padding: 0.35rem 0.65rem; border-top: 1px solid #ffffff12; color: #8e9a93; font-size: 0.6rem; }
@media (max-width: 390px) { .uv-toolbar { gap: .35rem; }.precision-control span { display: none; }.uv-stage-wrap { padding: 0.65rem; }.uv-hint span:last-child { display: none; } }
</style>
