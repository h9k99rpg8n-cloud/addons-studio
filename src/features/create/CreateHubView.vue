<script setup lang="ts">
import { useRouter } from 'vue-router'

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
    <StudioPageHeader
      :title="locale.t('Create')"
      :subtitle="project?.name ?? locale.t('Choose a project to start creating.')"
      :eyebrow="locale.t('Bedrock resources')"
      icon="plus-circle"
    />

    <div class="hub-page__body">
      <section v-if="loading" class="hub-state"><div class="spinner" /><p>{{ locale.t('Opening project') }}</p></section>
      <section v-else-if="error || !project" class="hub-state"><h1>{{ locale.t('Project unavailable') }}</h1><p>{{ error }}</p></section>
      <template v-else>
        <header class="section-heading">
          <div><p>{{ locale.t('Available now') }}</p><h2>{{ locale.t('Create content') }}</h2></div>
          <span>{{ project.namespace }}</span>
        </header>
        <div class="tool-grid">
          <ToolCard
            :title="locale.t('Models')"
            :description="locale.t('Import Bedrock geometry or Blockbench projects, then continue editing in Blockbench.')"
            icon="cuboid"
            meta="Blockbench"
            @open="router.push({ name: 'models', params: { projectId } })"
          />
          <ToolCard
            :title="locale.t('Blocks')"
            :description="locale.t('Create a standard Bedrock block with guided properties and generated files.')"
            icon="blocks"
            :meta="locale.t('Guided')"
            @open="router.push({ name: 'blocks', params: { projectId } })"
          />
          <ToolCard
            :title="locale.t('Block Model')"
            :description="locale.t('Build a custom-geometry block using a saved or imported Blockbench model.')"
            icon="boxes"
            :meta="locale.t('Custom geometry')"
            @open="router.push({ name: 'block-models', params: { projectId } })"
          />
        </div>

        <header class="section-heading section-heading--planned">
          <div><p>{{ locale.t('Product roadmap') }}</p><h2>{{ locale.t('Guided creators in development') }}</h2></div>
          <span>{{ locale.t('Coming soon') }}</span>
        </header>
        <div class="tool-grid tool-grid--planned">
          <ToolCard
            :title="locale.t('Items')"
            :description="locale.t('Guided item definitions, names, icons, stacks, and behaviors.')"
            icon="hammer"
            :meta="locale.t('Planned')"
            disabled
          />
          <ToolCard
            :title="locale.t('Entities')"
            :description="locale.t('Entity profiles connected to models, behaviors, animations, and sounds.')"
            icon="rabbit"
            :meta="locale.t('Planned')"
            disabled
          />
          <ToolCard
            :title="locale.t('Plants')"
            :description="locale.t('A contextual creator for growth stages, drops, and world conditions.')"
            icon="leaf"
            :meta="locale.t('Planned')"
            disabled
          />
        </div>

        <aside class="workflow-note">
          <span>01</span>
          <div><strong>{{ locale.t('Addons Studio organizes. Specialized tools edit.') }}</strong><p>{{ locale.t('Modeling, UV mapping, texturing, and animation now open in Blockbench instead of duplicating another editor inside this app.') }}</p></div>
        </aside>
      </template>
    </div>
  </main>
</template>

<style scoped>
.hub-page__body { width: min(100%, var(--content-max)); margin: 0 auto; padding: 1rem max(var(--page-gutter), env(safe-area-inset-right)) 2rem max(var(--page-gutter), env(safe-area-inset-left)); }
.hub-state { min-height: 45dvh; display: grid; place-items: center; align-content: center; gap: 0.5rem; color: var(--color-text-subtle); text-align: center; }
.spinner { width: 2rem; height: 2rem; border: 3px solid var(--color-border); border-top-color: var(--color-accent); border-radius: 50%; animation: spin .7s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
.section-heading { display: flex; align-items: end; justify-content: space-between; gap: 1rem; margin: 0.25rem 0 0.8rem; }
.section-heading p { margin: 0; color: var(--color-accent); font-size: 0.62rem; font-weight: 850; letter-spacing: 0.08em; text-transform: uppercase; }
.section-heading h2 { margin: 0.18rem 0 0; font-size: 1.25rem; }
.section-heading > span { color: var(--color-text-subtle); font-family: var(--font-mono); font-size: 0.65rem; }
.tool-grid { display: grid; gap: 0.72rem; }
.section-heading--planned { margin-top: 1.35rem; }
.tool-grid--planned { opacity: 0.86; }
.workflow-note { display: grid; grid-template-columns: auto minmax(0,1fr); gap: 0.8rem; margin-top: 1rem; border: 1px solid var(--color-border); border-radius: var(--radius-xl); padding: 1rem; background: var(--color-surface-muted); }
.workflow-note > span { width: 2.3rem; height: 2.3rem; display: grid; place-items: center; border-radius: var(--radius-md); background: var(--color-accent); color: var(--color-on-accent); font-family: var(--font-mono); font-size: 0.66rem; font-weight: 900; }
.workflow-note strong { font-size: 0.8rem; }.workflow-note p { margin: 0.25rem 0 0; color: var(--color-text-subtle); font-size: 0.68rem; line-height: 1.45; }
@media (min-width: 680px) { .tool-grid { grid-template-columns: repeat(2, minmax(0,1fr)); } }
</style>
