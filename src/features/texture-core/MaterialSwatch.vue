<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'

import StudioIcon from '@/components/common/StudioIcon.vue'

const props = defineProps<{ blob?: Blob; size?: number }>()
const url = ref('')

function release(): void {
  if (url.value) URL.revokeObjectURL(url.value)
  url.value = ''
}

watch(
  () => props.blob,
  (blob) => {
    release()
    if (blob) url.value = URL.createObjectURL(blob)
  },
  { immediate: true },
)

onBeforeUnmount(release)
</script>

<template>
  <span class="material-swatch" :style="{ width: `${size ?? 44}px`, height: `${size ?? 44}px` }">
    <img v-if="url" :src="url" alt="" />
    <StudioIcon v-else name="material" :size="Math.round((size ?? 44) * 0.58)" />
  </span>
</template>

<style scoped>
.material-swatch {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, currentColor 12%, transparent);
  border-radius: 50%;
  background: #eef1ee;
  color: #25272d;
}
.material-swatch img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  image-rendering: pixelated;
}
</style>
