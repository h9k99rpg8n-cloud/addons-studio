<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import AppIcon from '@/components/common/AppIcon.vue'

const online = ref(globalThis.navigator?.onLine ?? true)

const update = () => {
  online.value = globalThis.navigator?.onLine ?? true
}

onMounted(() => {
  globalThis.addEventListener('online', update)
  globalThis.addEventListener('offline', update)
})

onBeforeUnmount(() => {
  globalThis.removeEventListener('online', update)
  globalThis.removeEventListener('offline', update)
})
</script>

<template>
  <Transition name="offline">
    <div v-if="!online" class="offline-banner" role="status">
      <AppIcon name="wifi-off" :size="17" />
      Offline — local projects remain available
    </div>
  </Transition>
</template>

<style scoped>
.offline-banner {
  position: fixed;
  z-index: var(--z-banner);
  inset: auto 50% calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 0.75rem) auto;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transform: translateX(50%);
  border: 1px solid var(--color-warning-border);
  border-radius: 999px;
  padding: 0.55rem 0.8rem;
  background: var(--color-warning-soft);
  color: var(--color-warning-text);
  box-shadow: var(--shadow-float);
  font-size: 0.78rem;
  font-weight: 720;
  white-space: nowrap;
}

.offline-enter-active,
.offline-leave-active {
  transition: opacity var(--motion-medium);
}

.offline-enter-from,
.offline-leave-to {
  opacity: 0;
}
</style>
