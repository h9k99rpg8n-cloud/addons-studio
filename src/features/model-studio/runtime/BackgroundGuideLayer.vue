<script setup lang="ts">
import type {
  StudioCameraView,
  StudioEditorBackgroundSettings,
  StudioReferenceImage,
} from '@/types/model'

import EditorBackgroundLayer from '../components/EditorBackgroundLayer.vue'
import ViewportReferences from '../components/ViewportReferences.vue'

defineProps<{
  background: StudioEditorBackgroundSettings
  customUrl?: string
  references: StudioReferenceImage[]
  view: StudioCameraView
  assetUrls: Record<string, string>
}>()

const emit = defineEmits<{
  backgroundError: []
  guideError: [reference: StudioReferenceImage]
}>()
</script>

<template>
  <div class="background-guide-layer" aria-hidden="true">
    <EditorBackgroundLayer
      :background="background"
      :custom-url="customUrl"
      @image-error="emit('backgroundError')"
    />
    <ViewportReferences
      :references="references"
      :view="view"
      :asset-urls="assetUrls"
      @image-error="emit('guideError', $event)"
    />
  </div>
</template>

<style scoped>
.background-guide-layer {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}
</style>
