<script setup lang="ts">
import StudioPageHeader from '@/components/common/StudioPageHeader.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import ToolCard from '@/components/common/ToolCard.vue'
import { useProjectContext } from '@/composables/useProjectContext'
import { useLocaleStore } from '@/stores/locale'

const props = defineProps<{ projectId: string }>()
const locale = useLocaleStore()
const { project } = useProjectContext(() => props.projectId)
</script>

<template>
  <main>
    <StudioPageHeader :title="locale.t('Code')" :subtitle="project?.name" :eyebrow="locale.t('Reusable logic')" icon="code-xml" />
    <section class="code-hub">
      <div class="code-hub__intro">
        <span><AppIcon name="network" :size="30" /></span>
        <div><strong>{{ locale.t('Visual logic foundation') }}</strong><p>{{ locale.t('Plugins, Functions, and Recipes will share one reusable project logic system.') }}</p></div>
      </div>
      <div class="code-hub__grid">
        <ToolCard :title="locale.t('Plugins')" :description="locale.t('Reusable behaviors built with a future touch-first visual node editor.')" icon="network" :meta="locale.t('Planned')" disabled />
        <ToolCard :title="locale.t('Functions')" :description="locale.t('Reusable command flows callable from events, plugins, and other functions.')" icon="terminal" :meta="locale.t('Planned')" disabled />
        <ToolCard :title="locale.t('Recipes')" :description="locale.t('A central library for shaped, shapeless, furnace, smoker, blast, and campfire recipes.')" icon="cooking-pot" :meta="locale.t('Planned')" disabled />
      </div>
      <small class="code-hub__note">{{ locale.t('These are product modules, not active editor buttons. They will be enabled only when their Bedrock output is ready.') }}</small>
    </section>
  </main>
</template>

<style scoped>
.code-hub{width:min(100%,var(--content-max));margin:0 auto;padding:1rem max(var(--page-gutter),env(safe-area-inset-right)) 2rem max(var(--page-gutter),env(safe-area-inset-left))}.code-hub__intro{display:grid;grid-template-columns:auto minmax(0,1fr);gap:.8rem;align-items:center;margin-bottom:1rem;border:1px solid var(--color-border);border-radius:var(--radius-xl);padding:1rem;background:var(--color-surface-muted)}.code-hub__intro>span{width:3.4rem;height:3.4rem;display:grid;place-items:center;border-radius:var(--radius-lg);background:var(--color-accent);color:var(--color-on-accent)}.code-hub__intro strong{font-size:.87rem}.code-hub__intro p{margin:.25rem 0 0;color:var(--color-text-subtle);font-size:.7rem;line-height:1.45}.code-hub__grid{display:grid;gap:.75rem;opacity:.86}.code-hub__note{display:block;margin-top:1rem;color:var(--color-text-subtle);font-size:.68rem;line-height:1.5}@media(min-width:680px){.code-hub__grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
