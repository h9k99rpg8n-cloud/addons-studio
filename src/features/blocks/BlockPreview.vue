<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps<{
  top?: Blob
  side?: Blob
  bottom?: Blob
  north?: Blob
  east?: Blob
}>()

const urls = ref<Record<string, string>>({})

function release(): void {
  Object.values(urls.value).forEach((url) => URL.revokeObjectURL(url))
  urls.value = {}
}

watch(
  () => [props.top, props.side, props.bottom, props.north, props.east],
  (values) => {
    release()
    const keys = ['top', 'side', 'bottom', 'north', 'east']
    urls.value = Object.fromEntries(values.flatMap((blob, index) => blob ? [[keys[index]!, URL.createObjectURL(blob)]] : []))
  },
  { immediate: true },
)

onBeforeUnmount(release)

const topStyle = computed(() => ({ backgroundImage: urls.value.top ? `url(${urls.value.top})` : undefined }))
const frontStyle = computed(() => ({ backgroundImage: urls.value.north || urls.value.side ? `url(${urls.value.north || urls.value.side})` : undefined }))
const rightStyle = computed(() => ({ backgroundImage: urls.value.east || urls.value.side ? `url(${urls.value.east || urls.value.side})` : undefined }))
</script>

<template>
  <div class="block-preview" aria-label="Block texture preview">
    <div class="block-preview__stage">
      <div class="cube">
        <span class="face face--front" :style="frontStyle" />
        <span class="face face--right" :style="rightStyle" />
        <span class="face face--top" :style="topStyle" />
      </div>
    </div>
    <small>16 × 16 × 16</small>
  </div>
</template>

<style scoped>
.block-preview { min-height: 12rem; display: grid; place-items: center; align-content: center; gap: 1.2rem; overflow: hidden; border: 1px solid var(--color-border); border-radius: var(--radius-xl); background: var(--color-surface-muted); perspective: 700px; }
.block-preview__stage { width: 7.5rem; height: 7.5rem; display: grid; place-items: center; }
.cube { position: relative; width: 5.5rem; height: 5.5rem; transform: rotateX(-25deg) rotateY(38deg); transform-style: preserve-3d; }
.face { position: absolute; inset: 0; border: 2px solid #0c0d10; background-color: #6d7078; background-position: center; background-size: cover; image-rendering: pixelated; backface-visibility: hidden; }
.face--front { transform: translateZ(2.75rem); }
.face--right { transform: rotateY(90deg) translateZ(2.75rem); filter: brightness(.78); }
.face--top { transform: rotateX(90deg) translateZ(2.75rem); filter: brightness(1.18); }
.block-preview small { color: var(--color-text-subtle); font-family: var(--font-mono); font-size: .62rem; }
</style>
