<script setup lang="ts">
import AppIcon from '@/components/common/AppIcon.vue'
import { useLocaleStore } from '@/stores/locale'

const locale = useLocaleStore()

const items = [
  { name: 'home', label: 'Home', icon: 'home' },
  { name: 'projects', label: 'Projects', icon: 'folder' },
  { name: 'learn', label: 'Learn', icon: 'book-open' },
  { name: 'settings', label: 'Settings', icon: 'settings' },
] as const
</script>

<template>
  <nav class="bottom-navigation" aria-label="Main navigation">
    <div class="bottom-navigation__inner">
      <RouterLink
        v-for="item in items"
        :key="item.name"
        :to="{ name: item.name }"
        class="bottom-navigation__item"
      >
        <span class="bottom-navigation__icon"><AppIcon :name="item.icon" :size="22" /></span>
        <span>{{ locale.t(item.label) }}</span>
      </RouterLink>
    </div>
  </nav>
</template>

<style scoped>
.bottom-navigation {
  position: fixed;
  z-index: var(--z-navigation);
  inset: auto 0 0;
  padding: 0 max(var(--page-gutter), env(safe-area-inset-right)) env(safe-area-inset-bottom)
    max(var(--page-gutter), env(safe-area-inset-left));
  background: color-mix(in srgb, var(--color-app-bg) 88%, transparent);
  border-top: 1px solid var(--color-border);
  backdrop-filter: blur(18px) saturate(140%);
}

.bottom-navigation__inner {
  width: min(100%, var(--content-max));
  height: var(--bottom-nav-height);
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin: 0 auto;
}

.bottom-navigation__item {
  min-width: 0;
  min-height: var(--touch-target);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.18rem;
  border-radius: var(--radius-md);
  color: var(--color-text-subtle);
  font-size: 0.68rem;
  font-weight: 700;
  text-decoration: none;
  transition: color var(--motion-fast) ease;
  -webkit-tap-highlight-color: transparent;
}

.bottom-navigation__icon {
  width: 2.25rem;
  height: 1.75rem;
  display: grid;
  place-items: center;
  border-radius: 999px;
  transition:
    color var(--motion-fast),
    background var(--motion-fast),
    transform var(--motion-fast);
}

.bottom-navigation__item:active .bottom-navigation__icon {
  transform: scale(0.9);
}

.bottom-navigation__item.router-link-active {
  color: var(--color-text);
}

.bottom-navigation__item.router-link-active .bottom-navigation__icon {
  border: 1px solid var(--color-accent-border);
  background: var(--color-accent-soft);
  color: var(--color-accent-strong);
}
</style>
