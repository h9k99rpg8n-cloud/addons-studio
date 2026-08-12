<script setup lang="ts">
import AppConnectivity from '@/components/common/AppConnectivity.vue'
import AppErrorBoundary from '@/components/common/AppErrorBoundary.vue'
import AppToastRegion from '@/components/common/AppToastRegion.vue'
import MainLayout from '@/components/navigation/MainLayout.vue'
import { useAutosaveLifecycle } from '@/composables/useAutosaveLifecycle'

useAutosaveLifecycle()
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
</template>
