<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import type { StudioTextureAsset, StudioTextureBinding, StudioUvRect, TextureFace } from '@/types/texture'

const props = defineProps<{
  asset?: StudioTextureAsset
  binding?: StudioTextureBinding
  face: TextureFace
  disabled?: boolean
}>()

const emit = defineEmits<{
  change: [uv: StudioUvRect]
  commit: [uv: StudioUvRect]
}>()

const stage = ref<HTMLDivElement>()
const textureUrl = ref('')
const gesture = ref<{
  pointerId: number
  mode: 'move' | 'resize'
  startX: number
  startY: number
  startUv: StudioUvRect
}>()

const textureWidth = computed(() => Math.max(1, props.asset?.width ?? 16))
const textureHeight = computed(() => Math.max(1, props.asset?.height ?? 16))
const activeUv = computed<StudioUvRect>(() => props.binding?.uv ?? {
  x: 0,
  y: 0,
  width: textureWidth.value,
  height: textureHeight.value,
  rotation: 0,
  flipHorizontal: false,
  flipVertical: false,
})

const overlayStyle = computed(() => ({
  left: `${activeUv.value.x / textureWidth.value * 100}%`,
  top: `${activeUv.value.y / textureHeight.value * 100}%`,
  width: `${activeUv.value.width / textureWidth.value * 100}%`,
  height: `${activeUv.value.height / textureHeight.value * 100}%`,
  transform: `rotate(${activeUv.value.rotation}deg) scaleX(${activeUv.value.flipHorizontal ? -1 : 1}) scaleY(${activeUv.value.flipVertical ? -1 : 1})`,
}))

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

onBeforeUnmount(releaseUrl)

function clampUv(uv: StudioUvRect): StudioUvRect {
  const width = Math.min(textureWidth.value, Math.max(1, Math.round(uv.width)))
  const height = Math.min(textureHeight.value, Math.max(1, Math.round(uv.height)))
  return {
    ...uv,
    width,
    height,
    x: Math.min(textureWidth.value - width, Math.max(0, Math.round(uv.x))),
    y: Math.min(textureHeight.value - height, Math.max(0, Math.round(uv.y))),
  }
}

function startGesture(event: PointerEvent, mode: 'move' | 'resize'): void {
  if (props.disabled || !props.binding || !stage.value) return
  event.preventDefault()
  event.stopPropagation()
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  gesture.value = {
    pointerId: event.pointerId,
    mode,
    startX: event.clientX,
    startY: event.clientY,
    startUv: { ...activeUv.value },
  }
}

function moveGesture(event: PointerEvent): void {
  const current = gesture.value
  const rect = stage.value?.getBoundingClientRect()
  if (!current || current.pointerId !== event.pointerId || !rect) return
  event.preventDefault()
  const dx = (event.clientX - current.startX) / Math.max(1, rect.width) * textureWidth.value
  const dy = (event.clientY - current.startY) / Math.max(1, rect.height) * textureHeight.value
  const next = current.mode === 'move'
    ? { ...current.startUv, x: current.startUv.x + dx, y: current.startUv.y + dy }
    : { ...current.startUv, width: current.startUv.width + dx, height: current.startUv.height + dy }
  emit('change', clampUv(next))
}

function finishGesture(event: PointerEvent): void {
  const current = gesture.value
  if (!current || current.pointerId !== event.pointerId) return
  const target = event.currentTarget as HTMLElement
  if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId)
  gesture.value = undefined
  emit('commit', clampUv(activeUv.value))
}

function rotate(): void {
  if (!props.binding) return
  const order: StudioUvRect['rotation'][] = [0, 90, 180, 270]
  const index = order.indexOf(activeUv.value.rotation)
  const next = clampUv({ ...activeUv.value, rotation: order[(index + 1) % order.length]! })
  emit('change', next)
  emit('commit', next)
}

function flipHorizontal(): void {
  if (!props.binding) return
  const next = { ...activeUv.value, flipHorizontal: !activeUv.value.flipHorizontal }
  emit('change', next)
  emit('commit', next)
}

function flipVertical(): void {
  if (!props.binding) return
  const next = { ...activeUv.value, flipVertical: !activeUv.value.flipVertical }
  emit('change', next)
  emit('commit', next)
}

function fitTexture(): void {
  if (!props.binding) return
  const next: StudioUvRect = {
    x: 0,
    y: 0,
    width: textureWidth.value,
    height: textureHeight.value,
    rotation: 0,
    flipHorizontal: false,
    flipVertical: false,
  }
  emit('change', next)
  emit('commit', next)
}
</script>

<template>
  <section class="uv-workspace">
    <header class="uv-toolbar">
      <div>
        <strong>{{ face.toUpperCase() }}</strong>
        <span v-if="binding">{{ activeUv.x }}, {{ activeUv.y }} · {{ activeUv.width }}×{{ activeUv.height }} px</span>
        <span v-else>Assign a material to map this face</span>
      </div>
      <div class="uv-actions" aria-label="UV tools">
        <button type="button" :disabled="!binding" title="Rotate 90°" @click="rotate">↻</button>
        <button type="button" :disabled="!binding" title="Flip horizontal" @click="flipHorizontal">↔</button>
        <button type="button" :disabled="!binding" title="Flip vertical" @click="flipVertical">↕</button>
        <button type="button" :disabled="!binding" title="Fit texture" @click="fitTexture">Fit</button>
      </div>
    </header>

    <div class="uv-stage-wrap">
      <div
        ref="stage"
        class="uv-stage"
        :style="{ aspectRatio: `${textureWidth} / ${textureHeight}` }"
      >
        <div class="checker" />
        <img v-if="textureUrl" :src="textureUrl" alt="" draggable="false" />
        <div v-else class="empty-texture">No texture</div>
        <div
          v-if="binding"
          class="uv-island"
          :style="overlayStyle"
          @pointerdown="startGesture($event, 'move')"
          @pointermove="moveGesture"
          @pointerup="finishGesture"
          @pointercancel="finishGesture"
        >
          <span>{{ face }}</span>
          <button
            type="button"
            class="resize-handle"
            aria-label="Resize UV face"
            @pointerdown.stop="startGesture($event, 'resize')"
            @pointermove.stop="moveGesture"
            @pointerup.stop="finishGesture"
            @pointercancel.stop="finishGesture"
          />
        </div>
      </div>
    </div>

    <footer class="uv-hint">
      <span>1 px precision</span>
      <span>Drag the face · corner handle resizes</span>
    </footer>
  </section>
</template>

<style scoped>
.uv-workspace { display: grid; min-height: 0; background: #0e1210; color: #f3f6f4; }
.uv-toolbar { min-height: 3.35rem; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; padding: 0.5rem 0.65rem; border-bottom: 1px solid #ffffff16; background: #141917; }
.uv-toolbar > div:first-child { min-width: 0; display: grid; gap: 0.08rem; }
.uv-toolbar strong { font-size: 0.76rem; letter-spacing: 0.08em; }
.uv-toolbar span { overflow: hidden; color: #9eaaa3; font-size: 0.64rem; text-overflow: ellipsis; white-space: nowrap; }
.uv-actions { display: flex; flex: 0 0 auto; gap: 0.3rem; }
.uv-actions button { min-width: 2.5rem; min-height: 2.5rem; border: 1px solid #ffffff18; border-radius: 0.7rem; background: #202723; color: #e8eee9; font-size: 0.78rem; font-weight: 800; }
.uv-actions button:disabled { opacity: 0.35; }
.uv-stage-wrap { min-height: 13rem; display: grid; place-items: center; overflow: auto; padding: 1rem; overscroll-behavior: contain; }
.uv-stage { position: relative; width: min(100%, 34rem); max-height: 50dvh; overflow: hidden; border: 1px solid #ffffff20; border-radius: 0.55rem; box-shadow: 0 18px 50px #0008; touch-action: none; }
.checker { position: absolute; inset: 0; background-color: #242a27; background-image: linear-gradient(45deg, #313834 25%, transparent 25%), linear-gradient(-45deg, #313834 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #313834 75%), linear-gradient(-45deg, transparent 75%, #313834 75%); background-size: 20px 20px; background-position: 0 0, 0 10px, 10px -10px, -10px 0; }
.uv-stage > img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: fill; image-rendering: pixelated; pointer-events: none; user-select: none; }
.empty-texture { position: absolute; inset: 0; display: grid; place-items: center; color: #829087; font-size: 0.72rem; }
.uv-island { position: absolute; z-index: 2; display: grid; place-items: center; box-sizing: border-box; border: 2px solid #63df8b; background: #63df8b24; box-shadow: 0 0 0 1px #07110a, 0 0 18px #3ddb7040; transform-origin: center; touch-action: none; }
.uv-island > span { max-width: 90%; overflow: hidden; border-radius: 999px; padding: 0.16rem 0.38rem; background: #07110acc; color: #bdf6ce; font-size: 0.58rem; font-weight: 850; text-overflow: ellipsis; text-transform: uppercase; pointer-events: none; }
.resize-handle { position: absolute; right: -0.8rem; bottom: -0.8rem; width: 2rem; height: 2rem; border: 2px solid #07110a; border-radius: 50%; background: #63df8b; box-shadow: 0 2px 12px #0008; touch-action: none; }
.uv-hint { min-height: 2.45rem; display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; padding: 0.35rem 0.65rem calc(0.35rem + env(safe-area-inset-bottom)); border-top: 1px solid #ffffff12; color: #8e9a93; font-size: 0.6rem; }
@media (max-width: 390px) { .uv-actions button { min-width: 2.25rem; min-height: 2.25rem; }.uv-stage-wrap { padding: 0.65rem; }.uv-hint span:last-child { display: none; } }
</style>
