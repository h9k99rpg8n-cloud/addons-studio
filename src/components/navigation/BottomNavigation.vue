<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import AppIcon from '@/components/common/AppIcon.vue'
import BrandMark from '@/components/common/BrandMark.vue'
import { useLocaleStore } from '@/stores/locale'
import { useProjectStore } from '@/stores/projects'

const locale = useLocaleStore()
const projects = useProjectStore()
const route = useRoute()

const projectId = computed(() => {
  const routeId = route.params.projectId ?? route.params.id
  return typeof routeId === 'string' ? routeId : projects.activeProject?.id
})

const items = computed(() => {
  const id = projectId.value
  const projectFallback = { name: 'projects' as const }
  return [
    { key: 'home', label: 'Home', icon: 'home', to: { name: 'home' as const } },
    { key: 'create', label: 'Create', icon: 'plus-circle', to: id ? { name: 'create-hub' as const, params: { projectId: id } } : projectFallback },
    { key: 'assets', label: 'Assets', icon: 'shapes', to: id ? { name: 'assets-hub' as const, params: { projectId: id } } : projectFallback },
    { key: 'code', label: 'Code', icon: 'code-xml', to: id ? { name: 'code-hub' as const, params: { projectId: id } } : projectFallback },
    { key: 'world', label: 'World', icon: 'globe', to: id ? { name: 'world-hub' as const, params: { projectId: id } } : projectFallback },
    { key: 'project', label: 'Project', icon: 'folder', to: id ? { name: 'workspace' as const, params: { id } } : projectFallback },
  ]
})
</script>

<template>
  <nav class="studio-navigation" :aria-label="locale.t('Main navigation')">
    <RouterLink class="studio-navigation__brand" :to="{ name: 'home' }" aria-label="Addons Studio Home">
      <BrandMark :size="42" />
      <span><strong>Addons Studio</strong><small>Rework</small></span>
    </RouterLink>

    <div class="studio-navigation__items">
      <RouterLink
        v-for="item in items"
        :key="item.key"
        :to="item.to"
        class="studio-navigation__item"
        :class="{ 'studio-navigation__item--active': route.meta.section === item.key || route.name === item.key }"
      >
        <span class="studio-navigation__icon"><AppIcon :name="item.icon" :size="22" /></span>
        <span>{{ locale.t(item.label) }}</span>
      </RouterLink>
    </div>

    <RouterLink class="studio-navigation__settings" :to="{ name: 'settings' }">
      <AppIcon name="settings" :size="21" />
      <span>{{ locale.t('Settings') }}</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.studio-navigation {
  position: fixed;
  z-index: var(--z-navigation);
  inset: auto 0 0;
  padding: 0 max(env(safe-area-inset-right), 0.3rem) env(safe-area-inset-bottom)
    max(env(safe-area-inset-left), 0.3rem);
  border-top: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-app-bg) 94%, transparent);
  backdrop-filter: blur(20px) saturate(130%);
}

.studio-navigation__brand,
.studio-navigation__settings { display: none; }

.studio-navigation__items {
  height: var(--bottom-nav-height);
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
}

.studio-navigation__item {
  min-width: 0;
  min-height: var(--touch-target);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.1rem;
  border-radius: var(--radius-sm);
  color: var(--color-text-subtle);
  font-size: clamp(0.52rem, 2.5vw, 0.66rem);
  font-weight: 680;
  text-decoration: none;
  -webkit-tap-highlight-color: transparent;
}

.studio-navigation__icon {
  width: 2.15rem;
  height: 1.75rem;
  display: grid;
  place-items: center;
  border-radius: var(--radius-pill);
  transition: var(--transition-interactive);
}

.studio-navigation__item:active .studio-navigation__icon { transform: scale(0.9); }

.studio-navigation__item--active { color: var(--color-text); }

.studio-navigation__item--active .studio-navigation__icon {
  background: var(--color-accent);
  color: var(--color-on-accent);
}

@media (min-width: 880px) {
  .studio-navigation {
    inset: 0 auto 0 0;
    width: 15.5rem;
    display: flex;
    flex-direction: column;
    padding: max(1rem, env(safe-area-inset-top)) 0.85rem max(1rem, env(safe-area-inset-bottom));
    border-top: 0;
    border-right: 1px solid var(--color-border);
    background: var(--color-surface-muted);
    backdrop-filter: none;
  }

  .studio-navigation__brand {
    min-height: 4rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.4rem;
    color: var(--color-text);
    text-decoration: none;
  }

  .studio-navigation__brand > span { min-width: 0; display: grid; }
  .studio-navigation__brand strong { font-size: 0.9rem; letter-spacing: -0.02em; }
  .studio-navigation__brand small { color: var(--color-accent); font-size: 0.65rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; }

  .studio-navigation__items {
    height: auto;
    display: grid;
    gap: 0.28rem;
    margin-top: 1.2rem;
  }

  .studio-navigation__item,
  .studio-navigation__settings {
    min-height: 3.25rem;
    display: grid;
    grid-template-columns: 2.35rem minmax(0, 1fr);
    align-items: center;
    gap: 0.65rem;
    border-radius: var(--radius-md);
    padding: 0 0.7rem;
    color: var(--color-text-muted);
    font-size: 0.78rem;
    font-weight: 720;
    text-decoration: none;
  }

  .studio-navigation__icon { width: 2.35rem; height: 2.35rem; border-radius: var(--radius-md); }
  .studio-navigation__item--active { background: var(--color-surface-raised); color: var(--color-text); }
  .studio-navigation__item--active .studio-navigation__icon { background: var(--color-accent); color: var(--color-on-accent); }

  .studio-navigation__settings { margin-top: auto; }
  .studio-navigation__settings.router-link-active { background: var(--color-surface-raised); color: var(--color-text); }
}
</style>
