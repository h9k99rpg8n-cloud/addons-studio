<script setup lang="ts">
import BottomNavigation from '@/components/navigation/BottomNavigation.vue'
</script>

<template>
  <div class="main-layout">
    <div class="main-layout__content"><slot /></div>
    <BottomNavigation />
  </div>
</template>

<style scoped>
.main-layout {
  min-height: 100dvh;
}

.main-layout__content {
  min-height: 100dvh;
  padding-bottom: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 1rem);
}
</style>
