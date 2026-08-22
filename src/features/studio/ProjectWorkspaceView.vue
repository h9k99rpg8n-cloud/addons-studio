<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import AppBadge from '@/components/common/AppBadge.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import StudioPageHeader from '@/components/common/StudioPageHeader.vue'
import ToolCard from '@/components/common/ToolCard.vue'
import ProjectActionsController from '@/components/project/ProjectActionsController.vue'
import ProjectIcon from '@/components/project/ProjectIcon.vue'
import { useProjectContext } from '@/composables/useProjectContext'
import { resourceRepository } from '@/core/resources/resourceRepository'
import { textureRepository } from '@/core/texture/textureRepository'
import { useLocaleStore } from '@/stores/locale'
import type { StudioResourceType } from '@/types/resource'
import { formatRelativeDate } from '@/utils/format'

const props = defineProps<{ id: string }>()
const router = useRouter()
const locale = useLocaleStore()
const { project, loading, error } = useProjectContext(() => props.id)
const menuOpen = ref(false)
const counts = ref<Record<string, number>>({})

onMounted(async () => {
  const types: StudioResourceType[] = ['model', 'block', 'block_model']
  const values = await Promise.all(types.map((type) => resourceRepository.count(props.id, type)))
  counts.value = Object.fromEntries(types.map((type, index) => [type, values[index] ?? 0]))
  counts.value.material = await textureRepository.countMaterials(props.id)
})
</script>

<template>
  <main>
    <StudioPageHeader :title="locale.t('Project')" :subtitle="project?.name" :eyebrow="locale.t('Project control center')" icon="folder">
      <template #actions><button class="header-action" type="button" :disabled="!project" :aria-label="locale.t('Project menu')" @click="menuOpen=true"><AppIcon name="more-vertical" :size="21" /></button></template>
    </StudioPageHeader>
    <div class="project-body">
      <section v-if="loading" class="state">{{ locale.t('Opening project') }}</section>
      <section v-else-if="error || !project" class="state state--error">{{ error }}</section>
      <template v-else>
        <section class="project-hero">
          <ProjectIcon :icon="project.icon" size="large" />
          <div><div class="badges"><AppBadge tone="accent">{{ locale.t(project.projectType.replace('_',' ')) }}</AppBadge><AppBadge>{{ project.targetVersion }}</AppBadge><AppBadge v-if="project.experimentalFeatures" tone="warning">{{ locale.t('Experimental') }}</AppBadge></div><h1>{{ project.name }}</h1><code>{{ project.namespace }}</code><p>{{ project.description || locale.t('No project description yet.') }}</p></div>
        </section>

        <section class="project-stats">
          <div><span>{{ counts.block ?? 0 }}</span><small>{{ locale.t('Blocks') }}</small></div>
          <div><span>{{ counts.block_model ?? 0 }}</span><small>{{ locale.t('Block Models') }}</small></div>
          <div><span>{{ counts.model ?? 0 }}</span><small>{{ locale.t('Models') }}</small></div>
          <div><span>{{ counts.material ?? 0 }}</span><small>{{ locale.t('Materials') }}</small></div>
        </section>

        <section class="project-section"><header><p>{{ locale.t('Workspace') }}</p><h2>{{ locale.t('Continue building') }}</h2></header><div class="tool-grid"><ToolCard :title="locale.t('Create')" :description="locale.t('Models, standard blocks, and custom block models')" icon="plus-circle" @open="router.push({name:'create-hub',params:{projectId:id}})" /><ToolCard :title="locale.t('Assets')" :description="locale.t('Reusable project materials and future specialized assets')" icon="shapes" @open="router.push({name:'assets-hub',params:{projectId:id}})" /><ToolCard :title="locale.t('Code')" :description="locale.t('Reusable Plugins, Functions, and Recipes when enabled')" icon="code-xml" @open="router.push({name:'code-hub',params:{projectId:id}})" /><ToolCard :title="locale.t('World')" :description="locale.t('Advanced world-generation tools when ready')" icon="globe" @open="router.push({name:'world-hub',params:{projectId:id}})" /></div></section>

        <section class="project-details"><header><p>{{ locale.t('Project information') }}</p><h2>{{ locale.t('Local workspace') }}</h2></header><dl><div><dt>{{ locale.t('Type') }}</dt><dd>{{ locale.t(project.projectType.replace('_',' ')) }}</dd></div><div><dt>{{ locale.t('Target Bedrock') }}</dt><dd>{{ project.targetVersion }}</dd></div><div><dt>{{ locale.t('Last edited') }}</dt><dd>{{ formatRelativeDate(project.updatedAt,Date.now(),locale.language) }}</dd></div><div><dt>{{ locale.t('Storage') }}</dt><dd>{{ locale.t('This device') }}</dd></div></dl><p><AppIcon name="database" :size="18" />{{ locale.t('Previous editor data remains preserved locally for compatibility. Retired editors are not loaded.') }}</p></section>
      </template>
    </div>
    <ProjectActionsController :project="project" :open="menuOpen" @close="menuOpen=false" @deleted="router.replace({name:'projects'})" />
  </main>
</template>

<style scoped>
.project-body{width:min(100%,var(--content-max));margin:0 auto;padding:1rem max(var(--page-gutter),env(safe-area-inset-right)) 2rem max(var(--page-gutter),env(safe-area-inset-left))}.header-action{width:44px;height:44px;display:grid;place-items:center;border:1px solid var(--color-border);border-radius:var(--radius-md);background:var(--color-surface);color:var(--color-text)}.state{min-height:55dvh;display:grid;place-items:center;color:var(--color-text-subtle)}.state--error{color:var(--color-danger)}.project-hero{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:1rem;border:1px solid var(--color-border);border-radius:var(--radius-2xl);padding:1rem;background:var(--color-surface);box-shadow:var(--shadow-card)}.project-hero>div{min-width:0}.badges{display:flex;flex-wrap:wrap;gap:.35rem}.project-hero h1,.project-hero code{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.project-hero h1{margin:.55rem 0 .1rem;font-size:clamp(1.25rem,5vw,1.8rem);letter-spacing:-.04em}.project-hero code{color:var(--color-accent);font-size:.63rem}.project-hero p{display:-webkit-box;overflow:hidden;margin:.35rem 0 0;color:var(--color-text-subtle);font-size:.68rem;line-height:1.45;-webkit-box-orient:vertical;-webkit-line-clamp:2}.project-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.5rem;margin-top:.7rem}.project-stats>div{min-width:0;display:grid;place-items:center;gap:.12rem;border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:.65rem .25rem;background:var(--color-surface-muted)}.project-stats span{font-family:var(--font-mono);font-size:.9rem;font-weight:850}.project-stats small{overflow:hidden;max-width:100%;color:var(--color-text-subtle);font-size:.52rem;text-overflow:ellipsis;white-space:nowrap}.project-section,.project-details{margin-top:1.4rem}.project-section>header p,.project-details>header p{margin:0;color:var(--color-accent);font-size:.59rem;font-weight:900;text-transform:uppercase;letter-spacing:.09em}.project-section h2,.project-details h2{margin:.15rem 0 .7rem;font-size:1.1rem}.tool-grid{display:grid;gap:.65rem}.project-details{border:1px solid var(--color-border);border-radius:var(--radius-xl);padding:1rem;background:var(--color-surface)}.project-details dl{display:grid;gap:.15rem;margin:0}.project-details dl>div{min-height:2.7rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;border-bottom:1px solid var(--color-border)}.project-details dt{color:var(--color-text-subtle);font-size:.68rem}.project-details dd{margin:0;font-size:.68rem;font-weight:750}.project-details>p{display:flex;gap:.55rem;margin:.8rem 0 0;color:var(--color-text-subtle);font-size:.63rem;line-height:1.45}@media(min-width:720px){.tool-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.project-stats small{font-size:.62rem}}
</style>
