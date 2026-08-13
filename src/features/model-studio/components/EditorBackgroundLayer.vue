<script setup lang="ts">
import { computed, type CSSProperties } from 'vue'

import type { StudioEditorBackgroundSettings } from '@/types/model'

const props = defineProps<{
  background: StudioEditorBackgroundSettings
  customUrl?: string
}>()

const emit = defineEmits<{ imageError: [] }>()

const fit = computed<CSSProperties['objectFit']>(() => {
  if (props.background.fit === 'fit') return 'contain'
  if (props.background.fit === 'stretch') return 'fill'
  return 'cover'
})

const imageStyle = computed<CSSProperties>(() => ({
  objectFit: fit.value,
  opacity: props.background.opacity,
  filter: `brightness(${props.background.brightness})`,
}))
</script>

<template>
  <div
    class="editor-background"
    :class="`editor-background--${background.type}`"
    aria-hidden="true"
  >
    <img
      v-if="background.type === 'custom' && customUrl"
      :src="customUrl"
      alt=""
      draggable="false"
      decoding="async"
      :style="imageStyle"
      @error="emit('imageError')"
    />
  </div>
</template>

<style scoped>
.editor-background {
  position: absolute;
  z-index: 0;
  inset: 0;
  overflow: hidden;
  background: #0a0d10;
  pointer-events: none;
}

.editor-background::after {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, transparent 40%, rgb(0 0 0 / 0.14));
  content: '';
}

.editor-background--sky {
  background: linear-gradient(180deg, #74b9e8 0%, #b9ddf4 50%, #e7f2f7 100%);
}

.editor-background--sky::before {
  position: absolute;
  inset: 12% -10% auto;
  height: 32%;
  background: radial-gradient(ellipse at 25% 50%, rgb(255 255 255 / 0.5), transparent 30%), radial-gradient(ellipse at 70% 35%, rgb(255 255 255 / 0.35), transparent 26%);
  content: '';
}

.editor-background--night {
  background: radial-gradient(circle at 78% 18%, #dbe8e5 0 1.2%, transparent 1.5%), radial-gradient(circle at 25% 22%, rgb(255 255 255 / 0.58) 0 0.25%, transparent 0.4%), linear-gradient(180deg, #08142b 0%, #14294b 58%, #101923 100%);
}

.editor-background--sunset {
  background: radial-gradient(circle at 72% 66%, #ffd28a 0 4%, rgb(255 178 101 / 0.58) 9%, transparent 22%), linear-gradient(180deg, #4a3f76 0%, #b96379 48%, #ee9b68 72%, #4c3c49 100%);
}

.editor-background--snow {
  background: linear-gradient(172deg, transparent 0 56%, rgb(229 241 246 / 0.92) 56.5% 72%, rgb(195 219 231 / 0.9) 72.5%), linear-gradient(180deg, #b7d6e7 0%, #e6f1f6 65%, #f5fafb 100%);
}

.editor-background--custom { background: #0a0d10; }
.editor-background img { width: 100%; height: 100%; display: block; }
</style>
