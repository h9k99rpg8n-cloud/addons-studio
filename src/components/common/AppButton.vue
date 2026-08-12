<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
    size?: 'regular' | 'large'
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
    loading?: boolean
    block?: boolean
  }>(),
  {
    variant: 'primary',
    size: 'regular',
    type: 'button',
    disabled: false,
    loading: false,
    block: false,
  },
)
</script>

<template>
  <button
    class="app-button"
    :class="[`app-button--${variant}`, `app-button--${size}`, { 'app-button--block': block }]"
    :type="type"
    :disabled="disabled || loading"
    :aria-busy="loading"
  >
    <span v-if="loading" class="app-button__spinner" aria-hidden="true" />
    <slot v-else name="icon" />
    <span class="app-button__label"><slot /></span>
  </button>
</template>

<style scoped>
.app-button {
  min-height: var(--touch-target);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  padding: 0.65rem 1rem;
  color: var(--color-text);
  font: inherit;
  font-weight: 720;
  line-height: 1.2;
  cursor: pointer;
  transition:
    transform var(--motion-fast),
    background-color var(--motion-fast),
    border-color var(--motion-fast);
  -webkit-tap-highlight-color: transparent;
}

.app-button:active:not(:disabled) {
  transform: scale(0.98);
}

.app-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.app-button--primary {
  background: var(--color-accent);
  color: var(--color-on-accent);
  box-shadow: var(--shadow-accent);
}

.app-button--secondary {
  background: var(--color-surface-raised);
  border-color: var(--color-border-strong);
}

.app-button--ghost {
  background: transparent;
  color: var(--color-text-muted);
}

.app-button--danger {
  background: var(--color-danger);
  color: white;
}

.app-button--large {
  min-height: 54px;
  border-radius: var(--radius-lg);
  font-size: 1rem;
}

.app-button--block {
  width: 100%;
}

.app-button__spinner {
  width: 1.15rem;
  height: 1.15rem;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 999px;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
