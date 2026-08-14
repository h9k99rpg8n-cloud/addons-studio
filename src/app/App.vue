<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import AppConnectivity from '@/components/common/AppConnectivity.vue'
import AppErrorBoundary from '@/components/common/AppErrorBoundary.vue'
import AppToastRegion from '@/components/common/AppToastRegion.vue'
import WhatsNewDialog from '@/components/common/WhatsNewDialog.vue'
import MainLayout from '@/components/navigation/MainLayout.vue'
import { useAutosaveLifecycle } from '@/composables/useAutosaveLifecycle'
import { useProductivityLifecycle } from '@/composables/useProductivityLifecycle'
import { CURRENT_RELEASE_STORAGE_VALUE } from '@/core/app/releaseNotes'
import {
  acknowledgeRelease,
  hasAcknowledgedRelease,
  hasCompletedWelcome,
} from '@/core/storage/preferences'

useAutosaveLifecycle()
useProductivityLifecycle()
const currentRoute = useRoute()
const whatsNewOpen = ref(false)

watch(
  () => currentRoute.name,
  (name) => {
    whatsNewOpen.value = name !== 'welcome'
      && hasCompletedWelcome()
      && !hasAcknowledgedRelease(CURRENT_RELEASE_STORAGE_VALUE)
  },
  { immediate: true },
)

function acknowledgeWhatsNew(): void {
  acknowledgeRelease(CURRENT_RELEASE_STORAGE_VALUE)
  whatsNewOpen.value = false
}
</script>

<template>
  <AppErrorBoundary>
    <RouterView v-slot="{ Component, route }">
      <MainLayout v-if="route.meta.mainNav">
        <component :is="Component" :key="route.name" />
      </MainLayout>
      <component :is="Component" v-else :key="route.fullPath" />
    </RouterView>
  </AppErrorBoundary>
  <AppConnectivity />
  <AppToastRegion />
  <WhatsNewDialog :open="whatsNewOpen" @acknowledge="acknowledgeWhatsNew" />
</template>
