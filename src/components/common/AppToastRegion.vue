<script setup lang="ts">
import { storeToRefs } from 'pinia'

import AppIcon from '@/components/common/AppIcon.vue'
import IconButton from '@/components/common/IconButton.vue'
import { useToastStore } from '@/stores/toasts'
import type { ToastType } from '@/types/app'

const toasts = useToastStore()
const { messages } = storeToRefs(toasts)

const iconByType: Record<ToastType, string> = {
  success: 'check-circle',
  info: 'info',
  warning: 'alert-triangle',
  error: 'circle-x',
}
</script>

<template>
  <div class="toast-region" aria-live="polite" aria-atomic="false">
    <TransitionGroup name="toast">
      <div
        v-for="message in messages"
        :key="message.id"
        class="toast"
        :class="`toast--${message.type}`"
        role="status"
      >
        <AppIcon :name="iconByType[message.type]" :size="20" />
        <p>{{ message.message }}</p>
        <IconButton icon="x" label="Dismiss notification" @click="toasts.remove(message.id)" />
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-region {
  position: fixed;
  z-index: var(--z-toast);
  inset: calc(0.75rem + env(safe-area-inset-top)) var(--page-gutter) auto;
  display: grid;
  justify-items: center;
  gap: 0.55rem;
  pointer-events: none;
}

.toast {
  width: min(100%, 460px);
  min-height: var(--touch-target);
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.65rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-lg);
  padding: 0.35rem 0.35rem 0.35rem 0.8rem;
  background: var(--color-surface-strong);
  box-shadow: var(--shadow-float);
  pointer-events: auto;
}

.toast p {
  margin: 0;
  font-size: 0.86rem;
  font-weight: 650;
  line-height: 1.35;
}

.toast--success > :first-child {
  color: var(--color-success);
}

.toast--info > :first-child {
  color: var(--color-info);
}

.toast--warning > :first-child {
  color: var(--color-warning-text);
}

.toast--error > :first-child {
  color: var(--color-danger);
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity var(--motion-medium),
    transform var(--motion-medium);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-0.75rem) scale(0.98);
}
</style>
