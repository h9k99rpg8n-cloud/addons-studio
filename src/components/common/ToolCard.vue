<script setup lang="ts">
import AppIcon from '@/components/common/AppIcon.vue'

withDefaults(defineProps<{
  title: string
  description: string
  icon: string
  meta?: string
  disabled?: boolean
}>(), { meta: '', disabled: false })

defineEmits<{ open: [] }>()
</script>

<template>
  <article v-if="disabled" class="tool-card tool-card--disabled" aria-disabled="true">
    <span class="tool-card__icon"><AppIcon :name="icon" :size="25" /></span>
    <span class="tool-card__copy"><strong>{{ title }}</strong><small>{{ description }}</small></span>
    <span v-if="meta" class="tool-card__meta">{{ meta }}</span>
  </article>
  <button v-else type="button" class="tool-card" @click="$emit('open')">
    <span class="tool-card__icon"><AppIcon :name="icon" :size="25" /></span>
    <span class="tool-card__copy"><strong>{{ title }}</strong><small>{{ description }}</small></span>
    <span v-if="meta" class="tool-card__meta">{{ meta }}</span>
    <AppIcon name="chevron-right" :size="19" />
  </button>
</template>

<style scoped>
.tool-card {
  min-width: 0;
  min-height: 6.1rem;
  display: grid;
  grid-template-columns: 3rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.8rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: 0.85rem;
  background: var(--color-surface);
  color: var(--color-text);
  box-shadow: var(--shadow-card);
  text-align: left;
  transition: var(--transition-interactive), box-shadow var(--motion-fast);
}

button.tool-card:active { transform: scale(0.985); }
.tool-card__icon { width: 3rem; height: 3rem; display: grid; place-items: center; border-radius: var(--radius-lg); background: var(--color-accent-soft); color: var(--color-accent-strong); }
.tool-card__copy { min-width: 0; display: grid; gap: 0.24rem; }
.tool-card strong { font-size: 0.87rem; letter-spacing: -0.01em; }
.tool-card small { display: -webkit-box; overflow: hidden; color: var(--color-text-subtle); font-size: 0.68rem; line-height: 1.4; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.tool-card__meta { grid-column: 2; justify-self: start; border-radius: var(--radius-pill); padding: 0.2rem 0.46rem; background: var(--color-surface-raised); color: var(--color-text-subtle); font-size: 0.58rem; font-weight: 800; }
.tool-card--disabled { opacity: 0.72; }

@media (min-width: 620px) {
  .tool-card { min-height: 7rem; grid-template-columns: 3.25rem minmax(0, 1fr) auto; }
  .tool-card__icon { width: 3.25rem; height: 3.25rem; }
}
</style>
