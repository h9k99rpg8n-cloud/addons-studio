<script setup lang="ts">
withDefaults(
  defineProps<{
    tone?: 'neutral' | 'accent' | 'warning'
  }>(),
  { tone: 'neutral' },
)
</script>

<template>
  <span class="app-badge" :class="`app-badge--${tone}`"><slot /></span>
</template>

<style scoped>
.app-badge {
  display: inline-flex;
  align-items: center;
  min-height: 1.5rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  padding: 0.18rem 0.55rem;
  background: var(--color-surface-raised);
  color: var(--color-text-muted);
  font-size: 0.72rem;
  font-weight: 760;
  line-height: 1;
  white-space: nowrap;
}

.app-badge--accent {
  border-color: var(--color-accent-border);
  background: var(--color-accent-soft);
  color: var(--color-accent-strong);
}

.app-badge--warning {
  border-color: var(--color-warning-border);
  background: var(--color-warning-soft);
  color: var(--color-warning-text);
}
</style>
