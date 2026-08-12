<script setup lang="ts">
import AppIcon from '@/components/common/AppIcon.vue'
import type { ProjectIcon } from '@/types/project'

withDefaults(
  defineProps<{
    icon: ProjectIcon
    size?: 'small' | 'regular' | 'large'
  }>(),
  { size: 'regular' },
)
</script>

<template>
  <span class="project-icon" :class="`project-icon--${size}`">
    <img v-if="icon.kind === 'image'" :src="icon.value" alt="" />
    <AppIcon v-else :name="icon.value" :size="size === 'large' ? 34 : size === 'small' ? 20 : 26" />
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
  border: 1px solid var(--color-accent-border);
  border-radius: var(--radius-lg);
  background: var(--color-accent-soft);
  color: var(--color-accent-strong);
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

.project-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
