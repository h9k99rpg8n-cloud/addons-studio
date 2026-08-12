<script setup lang="ts">
import { computed } from 'vue'

import StudioIcon from '@/components/common/StudioIcon.vue'
import {
  isStudioIconName,
  type StudioIconName,
} from '@/core/icons/studioIcons'
import type { ProjectIcon } from '@/types/project'

const props = withDefaults(
  defineProps<{
    icon: ProjectIcon
    size?: 'small' | 'regular' | 'large'
  }>(),
  { size: 'regular' },
)

const legacyBuiltInIcons: Readonly<Record<string, StudioIconName>> = {
  blocks: 'block',
  package: 'project',
  box: 'block',
  layers: 'layers',
  code: 'script',
  sparkles: 'sparkle',
}

const builtInIcon = computed<StudioIconName>(() => {
  if (props.icon.kind !== 'builtin') return 'project'
  if (isStudioIconName(props.icon.value)) return props.icon.value
  return legacyBuiltInIcons[props.icon.value] ?? 'project'
})
</script>

<template>
  <span
    class="project-icon"
    :class="[`project-icon--${size}`, { 'project-icon--builtin': icon.kind === 'builtin' }]"
  >
    <img v-if="icon.kind === 'image'" :src="icon.value" alt="" />
    <StudioIcon
      v-else
      :name="builtInIcon"
      :size="size === 'large' ? 36 : size === 'small' ? 21 : 27"
    />
  </span>
</template>

<style scoped>
.project-icon {
  width: 3.25rem;
  height: 3.25rem;
  flex: none;
  display: grid;
  place-items: center;
  overflow: hidden;
  border: 1px solid var(--tone-brand-border);
  border-radius: var(--radius-lg);
  background: var(--tone-brand-soft);
  color: var(--tone-brand);
  --studio-icon-accent: var(--color-brand-secondary);
}

.project-icon--small {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: var(--radius-md);
}

.project-icon--large {
  width: 4.5rem;
  height: 4.5rem;
  border-radius: var(--radius-xl);
}

.project-icon--builtin {
  box-shadow: inset 0 1px 0 color-mix(in srgb, white 7%, transparent);
}

.project-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
