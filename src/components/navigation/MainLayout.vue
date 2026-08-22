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
.main-layout { min-height: 100dvh; }

.main-layout__content {
  min-height: 100dvh;
  padding-bottom: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 1rem);
}

@media (min-width: 880px) {
  .main-layout__content {
    margin-left: 15.5rem;
    padding-bottom: 0;
  }
}
</style>
