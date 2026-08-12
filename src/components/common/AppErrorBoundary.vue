<script setup lang="ts">
import { onErrorCaptured, ref } from 'vue'

import AppButton from '@/components/common/AppButton.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import { logger } from '@/core/errors/logger'

const failed = ref(false)

onErrorCaptured((error, _instance, info) => {
  failed.value = true
  logger.error('View rendering failed', {
    area: 'error-boundary',
    action: info,
    details: { error },
  })
  return false
})

function reload(): void {
  globalThis.location.reload()
}
</script>

<template>
  <slot v-if="!failed" />
  <main v-else class="error-fallback">
    <div class="error-fallback__icon"><AppIcon name="alert-triangle" :size="30" /></div>
    <p class="eyebrow">Addons Studio hit a snag</p>
    <h1>Your local projects are still safe.</h1>
    <p>Reload the app to try again. This screen does not delete or reset project data.</p>
    <AppButton size="large" @click="reload">Reload Addons Studio</AppButton>
  </main>
</template>

<style scoped>
.error-fallback {
  min-height: 100dvh;
  display: grid;
  place-content: center;
  justify-items: start;
  gap: 0.85rem;
  padding: calc(2rem + env(safe-area-inset-top)) var(--page-gutter)
    calc(2rem + env(safe-area-inset-bottom));
}

.error-fallback__icon {
  width: 3.3rem;
  height: 3.3rem;
  display: grid;
  place-items: center;
  border-radius: var(--radius-lg);
  background: var(--color-warning-soft);
  color: var(--color-warning-text);
}

.error-fallback h1,
.error-fallback p {
  max-width: 34rem;
  margin: 0;
}

.error-fallback > p:not(.eyebrow) {
  color: var(--color-text-muted);
  line-height: 1.55;
}
</style>
