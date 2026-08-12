<script setup lang="ts">
import AppIcon from '@/components/common/AppIcon.vue'
import type { ResourceCategoryDefinition } from '@/features/studio/resourceCategories'

defineProps<{
  category: ResourceCategoryDefinition
  count?: number
}>()

defineEmits<{ open: [] }>()
</script>

<template>
  <button type="button" class="resource-card" @click="$emit('open')">
    <span
      class="resource-card__icon"
      :class="{ 'resource-card__icon--material': category.id === 'materials' }"
    >
      <span v-if="category.id === 'materials'" class="material-orb" aria-hidden="true" />
      <AppIcon v-else :name="category.icon" :size="25" />
    </span>
    <span class="resource-card__content">
      <strong>{{ category.label }}</strong>
      <small>{{ category.description }}</small>
    </span>
    <span class="resource-card__count">{{ count ?? 0 }}</span>
  </button>
</template>

<style scoped>
.resource-card {
  min-width: 0;
  min-height: 8.5rem;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-content: space-between;
  gap: 0.65rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: 0.85rem;
  background: var(--color-surface);
  color: var(--color-text);
  text-align: left;
  box-shadow: var(--shadow-card);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.resource-card:active {
  border-color: var(--color-accent-border);
  background: var(--color-surface-raised);
  transform: scale(0.985);
}

.resource-card__icon {
  width: 2.85rem;
  height: 2.85rem;
  display: grid;
  place-items: center;
  border-radius: var(--radius-lg);
  background: var(--color-accent-soft);
  color: var(--color-accent-strong);
}

.resource-card__content {
  min-width: 0;
  display: grid;
  grid-column: 1 / -1;
  gap: 0.22rem;
}

.resource-card__content strong {
  overflow: hidden;
  font-size: 0.9rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.resource-card__content small {
  overflow: hidden;
  color: var(--color-text-subtle);
  font-size: 0.68rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.resource-card__count {
  align-self: start;
  min-width: 1.75rem;
  min-height: 1.75rem;
  display: grid;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-surface-raised);
  color: var(--color-text-subtle);
  font-family: var(--font-mono);
  font-size: 0.68rem;
  font-weight: 800;
}

.material-orb {
  width: 1.75rem;
  height: 1.75rem;
  border: 1px solid color-mix(in srgb, var(--color-accent) 70%, white);
  border-radius: 50%;
  background: radial-gradient(circle at 34% 28%, white 0 5%, var(--color-accent) 28%, #163c32 78%);
  box-shadow: inset -0.25rem -0.3rem 0.45rem rgb(0 0 0 / 0.28);
}
</style>
