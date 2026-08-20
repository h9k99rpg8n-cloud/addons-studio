<script setup lang="ts">
import { useRouter } from 'vue-router'

import AppBadge from '@/components/common/AppBadge.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import BrandMark from '@/components/common/BrandMark.vue'
import IconButton from '@/components/common/IconButton.vue'
import AppHeader from '@/components/navigation/AppHeader.vue'
import { RELEASE_NOTES } from '@/core/app/releaseNotes'
import { useLocaleStore } from '@/stores/locale'

const router = useRouter()
const locale = useLocaleStore()
</script>

<template>
  <main class="page-shell release-notes">
    <AppHeader :title="locale.t('Release Notes')" subtitle="Addons Studio">
      <template #leading><IconButton icon="arrow-left" :label="locale.t('Back')" @click="router.back()" /></template>
    </AppHeader>
    <section class="release-brand"><BrandMark :size="64" /><div><h1>{{ locale.t('What’s New') }}</h1><p>{{ locale.t('Addons Studio release history') }}</p></div></section>
    <article v-for="(release, index) in RELEASE_NOTES" :key="release.version" class="release-card">
      <header><div><small>Alpha {{ release.version }}</small><h2>{{ locale.t(release.title) }}</h2></div><AppBadge v-if="index === 0" tone="accent">{{ locale.t('Current') }}</AppBadge></header>
      <p>{{ locale.t(release.subtitle) }}</p>
      <ul><li v-for="highlight in release.highlights" :key="highlight"><AppIcon name="check-circle" :size="18" />{{ locale.t(highlight) }}</li></ul>
    </article>
  </main>
</template>

<style scoped>
.release-notes { display: grid; gap: var(--space-4); }
.release-brand { display: flex; align-items: center; gap: var(--space-4); padding: var(--space-4); }
.release-brand h1, .release-brand p { margin: 0; }
.release-brand p { margin-top: 0.2rem; color: var(--color-text-muted); }
.release-card { border: 1px solid var(--color-border); border-radius: var(--radius-xl); padding: var(--space-4); background: var(--color-surface); box-shadow: var(--shadow-card); }
.release-card header { display: flex; align-items: start; justify-content: space-between; gap: var(--space-2); }
.release-card h2 { margin: 0.15rem 0 0; font-size: 1.05rem; }
.release-card small { color: var(--color-accent-strong); font-weight: 800; }
.release-card > p { color: var(--color-text-muted); }
.release-card ul { display: grid; gap: 0.55rem; margin: 0; padding: 0; list-style: none; }
.release-card li { display: grid; grid-template-columns: auto 1fr; gap: 0.55rem; color: var(--color-text-muted); font-size: 0.82rem; line-height: 1.4; }
.release-card li svg { color: var(--color-accent-strong); }
</style>
