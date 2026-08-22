<script setup lang="ts">
import AppIcon from '@/components/common/AppIcon.vue'
import BrandMark from '@/components/common/BrandMark.vue'

withDefaults(defineProps<{
  title: string
  subtitle?: string
  eyebrow?: string
  icon?: string
  brand?: boolean
}>(), {
  subtitle: '',
  eyebrow: '',
  icon: '',
  brand: false,
})
</script>

<template>
  <header class="studio-page-header">
    <div v-if="brand || icon" class="studio-page-header__icon">
      <BrandMark v-if="brand" :size="52" />
      <AppIcon v-else :name="icon" :size="25" />
    </div>
    <div class="studio-page-header__copy">
      <p v-if="eyebrow">{{ eyebrow }}</p>
      <h1>{{ title }}</h1>
      <span v-if="subtitle">{{ subtitle }}</span>
    </div>
    <div v-if="$slots.actions" class="studio-page-header__actions"><slot name="actions" /></div>
  </header>
</template>

<style scoped>
.studio-page-header {
  min-height: calc(var(--header-height) + env(safe-area-inset-top));
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.8rem;
  padding: calc(env(safe-area-inset-top) + 0.7rem) max(var(--page-gutter), env(safe-area-inset-right)) 0.7rem
    max(var(--page-gutter), env(safe-area-inset-left));
  border-bottom: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-app-bg) 94%, transparent);
}

.studio-page-header__icon { width: 3.25rem; height: 3.25rem; display: grid; place-items: center; border-radius: var(--radius-lg); background: var(--color-accent); color: var(--color-on-accent); }
.studio-page-header__copy { min-width: 0; }
.studio-page-header__copy p { margin: 0 0 0.12rem; color: var(--color-accent); font-size: 0.61rem; font-weight: 850; letter-spacing: 0.09em; text-transform: uppercase; }
.studio-page-header h1 { overflow: hidden; margin: 0; font-size: clamp(1.15rem, 5vw, 1.55rem); letter-spacing: -0.035em; text-overflow: ellipsis; white-space: nowrap; }
.studio-page-header__copy span { display: block; overflow: hidden; margin-top: 0.18rem; color: var(--color-text-subtle); font-size: 0.7rem; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
.studio-page-header__actions { display: flex; align-items: center; gap: 0.4rem; }

@media (min-width: 880px) {
  .studio-page-header { position: sticky; z-index: var(--z-header); top: 0; min-height: 5rem; padding-top: 0.7rem; backdrop-filter: blur(18px); }
}
</style>

