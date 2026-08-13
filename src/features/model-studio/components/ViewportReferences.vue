<script setup lang="ts">
import { computed, type CSSProperties } from 'vue'

import type { StudioCameraView, StudioReferenceImage, StudioReferenceView } from '@/types/model'

const props = defineProps<{
  references: StudioReferenceImage[]
  view: StudioCameraView
  assetUrls: Record<string, string>
}>()

const emit = defineEmits<{
  imageError: [reference: StudioReferenceImage]
}>()

const referenceViews: readonly StudioReferenceView[] = [
  'front',
  'back',
  'left',
  'right',
  'top',
  'bottom',
]

const visibleReferences = computed(() => {
  if (!referenceViews.includes(props.view as StudioReferenceView)) return []
  return props.references.filter((reference) =>
    reference.visible
    && reference.view === props.view
    && Boolean(props.assetUrls[reference.assetId]),
  )
})

function referenceStyle(reference: StudioReferenceImage): CSSProperties {
  return {
    left: `${50 + reference.position.x}%`,
    top: `${50 - reference.position.y}%`,
    opacity: reference.opacity,
    transform: [
      'translate(-50%, -50%)',
      `rotate(${reference.rotation}deg)`,
      `scale(${reference.flipHorizontal ? -reference.scale : reference.scale}, ${reference.flipVertical ? -reference.scale : reference.scale})`,
    ].join(' '),
  }
}
</script>

<template>
  <div class="viewport-references" aria-hidden="true">
    <img
      v-for="reference in visibleReferences"
      :key="reference.id"
      :src="assetUrls[reference.assetId]"
      :alt="reference.name"
      :style="referenceStyle(reference)"
      draggable="false"
      decoding="async"
      @error="emit('imageError', reference)"
    />
  </div>
</template>

<style scoped>
.viewport-references {
  position: absolute;
  z-index: 1;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.viewport-references img {
  position: absolute;
  width: 72%;
  height: 72%;
  object-fit: contain;
  user-select: none;
  transform-origin: center;
  will-change: transform;
}
</style>
