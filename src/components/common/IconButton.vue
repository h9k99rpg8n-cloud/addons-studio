<script setup lang="ts">
import AppIcon from '@/components/common/AppIcon.vue'

withDefaults(
  defineProps<{
    icon: string
    label: string
    variant?: 'surface' | 'ghost' | 'danger'
    disabled?: boolean
  }>(),
  {
    variant: 'ghost',
    disabled: false,
  },
)
</script>

<template>
  <button
    type="button"
    class="icon-button"
    :class="`icon-button--${variant}`"
    :aria-label="label"
    :title="label"
    :disabled="disabled"
  >
    <AppIcon :name="icon" :size="22" />
  </button>
</template>

<style scoped>
.icon-button {
  width: var(--touch-target);
  height: var(--touch-target);
  flex: none;
  display: inline-grid;
  place-items: center;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition:
    transform var(--motion-fast),
    color var(--motion-fast),
    background var(--motion-fast);
  -webkit-tap-highlight-color: transparent;
}

.icon-button:active:not(:disabled) {
  transform: scale(0.94);
}

.icon-button--surface {
  border-color: var(--color-border);
  background: var(--color-surface-raised);
  color: var(--color-text);
}

.icon-button--danger {
  color: var(--color-danger);
}

.icon-button:disabled {
  opacity: 0.5;
}
</style>
