<script setup lang="ts">
import { useRouter } from 'vue-router'

import AppIcon from '@/components/common/AppIcon.vue'
import StudioPageHeader from '@/components/common/StudioPageHeader.vue'
import ToolCard from '@/components/common/ToolCard.vue'
import { useProjectContext } from '@/composables/useProjectContext'
import { useLocaleStore } from '@/stores/locale'

const props = defineProps<{ projectId: string }>()
const router = useRouter()
const locale = useLocaleStore()
const { project, loading, error } = useProjectContext(() => props.projectId)
</script>

<template>
  <main class="hub-page">
    <StudioPageHeader :title="locale.t('Assets')" :subtitle="project?.name" :eyebrow="locale.t('Project library')" icon="shapes" />
    <div class="hub-body">
      <section v-if="loading" class="state">{{ locale.t('Opening project') }}</section>
      <section v-else-if="error || !project" class="state">{{ error }}</section>
      <template v-else>
        <header class="heading"><p>{{ locale.t('Available now') }}</p><h2>{{ locale.t('Reusable assets') }}</h2></header>
        <div class="grid">
          <ToolCard
            :title="locale.t('Materials')"
            :description="locale.t('Import, organize, preview, and reuse project textures without a second paint editor.')"
            icon="image"
            :meta="locale.t('Image library')"
            @open="router.push({ name: 'materials', params: { projectId } })"
          />
        </div>
        <header class="heading heading--planned"><p>{{ locale.t('Specialized integrations') }}</p><h2>{{ locale.t('Planned asset tools') }}</h2></header>
        <div class="grid grid--planned">
          <ToolCard :title="locale.t('Particles')" :description="locale.t('Bedrock particle editing through a specialized mobile-ready workflow.')" icon="sparkles" :meta="locale.t('Planned')" disabled />
          <ToolCard :title="locale.t('Sounds')" :description="locale.t('A focused audio workflow for trim, volume, fades, loops, and preview.')" icon="audio-lines" :meta="locale.t('Planned')" disabled />
          <ToolCard :title="locale.t('Animations')" :description="locale.t('Animation assets managed here and edited with the appropriate model tool.')" icon="film" :meta="locale.t('Planned')" disabled />
        </div>
        <section class="availability">
          <AppIcon name="info" :size="20" />
          <div><strong>{{ locale.t('No dead tools') }}</strong><p>{{ locale.t('Particles, Sounds, and Animations will appear here only when their specialized integrations are ready.') }}</p></div>
        </section>
      </template>
    </div>
  </main>
</template>

<style scoped>
.hub-body { width:min(100%,var(--content-max)); margin:0 auto; padding:1rem max(var(--page-gutter),env(safe-area-inset-right)) 2rem max(var(--page-gutter),env(safe-area-inset-left)); }.state{min-height:45dvh;display:grid;place-items:center;color:var(--color-text-subtle)}.heading p{margin:0;color:var(--color-accent);font-size:.62rem;font-weight:850;text-transform:uppercase;letter-spacing:.08em}.heading h2{margin:.18rem 0 .8rem;font-size:1.25rem}.heading--planned{margin-top:1.35rem}.grid{display:grid;gap:.75rem}.grid--planned{opacity:.86}.availability{display:grid;grid-template-columns:auto minmax(0,1fr);gap:.7rem;margin-top:1rem;border:1px solid var(--color-border);border-radius:var(--radius-xl);padding:1rem;background:var(--color-surface-muted);color:var(--color-text-muted)}.availability strong{font-size:.78rem}.availability p{margin:.25rem 0 0;color:var(--color-text-subtle);font-size:.67rem;line-height:1.45}@media(min-width:680px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
