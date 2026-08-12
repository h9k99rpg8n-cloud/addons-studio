<script setup lang="ts">
import StudioIcon from '@/components/common/StudioIcon.vue'
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
      class="resource-card__icon icon-surface"
      :class="`tone-${category.tone}`"
    >
      <StudioIcon :name="category.icon" :size="28" />
    </span>
    <span
      class="resource-card__status"
      :class="{ 'resource-card__status--available': category.status === 'available' }"
    >{{ category.status === 'available' ? 'Open' : 'Coming soon' }}</span>
    <span class="resource-card__content">
      <strong>{{ category.label }}</strong>
      <small>{{ category.description }}</small>
    </span>
    <span class="resource-card__count" :aria-label="`${count ?? 0} resources`">{{ count ?? 0 }}</span>
  </button>
</template>

<style scoped>
.resource-card {
  min-width: 0;
  min-height: 9.4rem;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-content: space-between;
  gap: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: var(--card-padding);
  background: var(--color-surface);
  color: var(--color-text);
  text-align: left;
  box-shadow: var(--shadow-card);
  cursor: pointer;
  transition: var(--transition-interactive);
  -webkit-tap-highlight-color: transparent;
}

.resource-card:active {
  border-color: var(--tone-border, var(--color-accent-border));
  background: var(--color-surface-raised);
  transform: scale(0.985);
}

.resource-card__icon {
  width: 3.15rem;
  height: 3.15rem;
}

.resource-card__status {
  align-self: start;
  justify-self: end;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  padding: 0.22rem 0.42rem;
  background: var(--color-surface-muted);
  color: var(--color-text-subtle);
  font-size: 0.62rem;
  font-weight: 760;
  letter-spacing: 0.02em;
}

.resource-card__status--available {
  border-color: var(--color-accent-border);
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
  font-size: 0.94rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.resource-card__content small {
  overflow: hidden;
  color: var(--color-text-subtle);
  font-size: var(--font-size-caption);
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

@media (hover: hover) and (pointer: fine) {
  .resource-card:hover {
    border-color: var(--tone-border, var(--color-accent-border));
    box-shadow: var(--shadow-card-hover);
    transform: translateY(-1px);
  }
}
</style>
