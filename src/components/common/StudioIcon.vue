<script setup lang="ts">
import { computed } from 'vue'

import {
  STUDIO_ICONS,
  type StudioIconName,
} from '@/core/icons/studioIcons'

const props = withDefaults(
  defineProps<{
    name: StudioIconName
    size?: number
    strokeWidth?: number
    label?: string
  }>(),
  {
    size: 24,
    strokeWidth: 1.7,
    label: undefined,
  },
)

const definition = computed(() => STUDIO_ICONS[props.name])
</script>

<template>
  <svg
    class="studio-icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    :aria-label="label"
    :aria-hidden="label ? undefined : 'true'"
    focusable="false"
    role="img"
  >
    <path
      v-for="path in definition.fills"
      :key="`fill-${path}`"
      class="studio-icon__fill"
      :d="path"
    />
    <path
      v-for="path in definition.base"
      :key="`base-${path}`"
      class="studio-icon__base"
      :d="path"
      :stroke-width="strokeWidth"
    />
    <path
      v-for="path in definition.accent"
      :key="`accent-${path}`"
      class="studio-icon__accent"
      :d="path"
      :stroke-width="strokeWidth"
    />
    <path
      v-for="path in definition.dashed"
      :key="`dashed-${path}`"
      class="studio-icon__dashed"
      :d="path"
      :stroke-width="strokeWidth"
    />
  </svg>
</template>

<style scoped>
.studio-icon {
  flex: none;
  overflow: visible;
}

.studio-icon__base,
.studio-icon__accent,
.studio-icon__dashed {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.studio-icon__base {
  stroke: currentColor;
}

.studio-icon__accent {
  stroke: var(--studio-icon-accent, currentColor);
}

.studio-icon__fill {
  fill: var(--studio-icon-accent, currentColor);
  opacity: 0.2;
}

.studio-icon__dashed {
  stroke: var(--studio-icon-accent, currentColor);
  stroke-dasharray: 1.7 2.2;
}
</style>
