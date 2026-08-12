<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<template>
  <header class="app-header">
    <div class="app-header__leading">
      <slot name="leading" />
      <div class="app-header__titles">
        <h1>{{ title }}</h1>
        <p v-if="subtitle">{{ subtitle }}</p>
      </div>
    </div>
    <div class="app-header__actions"><slot name="actions" /></div>
  </header>
</template>

<style scoped>
.app-header {
  min-height: 4.25rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: calc(0.6rem + env(safe-area-inset-top)) 0 0.6rem;
}

.app-header__leading,
.app-header__actions {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.7rem;
}

.app-header__titles {
  min-width: 0;
}

.app-header h1 {
  overflow: hidden;
  margin: 0;
  font-size: clamp(1.15rem, 5vw, 1.42rem);
  line-height: 1.15;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-header p {
  overflow: hidden;
  margin: 0.22rem 0 0;
  color: var(--color-text-muted);
  font-size: 0.76rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
