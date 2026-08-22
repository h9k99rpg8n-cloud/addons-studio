<script setup lang="ts">
import StudioPageHeader from '@/components/common/StudioPageHeader.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import { useProjectContext } from '@/composables/useProjectContext'
import { useLocaleStore } from '@/stores/locale'

const props = defineProps<{ projectId: string }>()
const locale = useLocaleStore()
const { project } = useProjectContext(() => props.projectId)
</script>

<template>
  <main>
    <StudioPageHeader :title="locale.t('World')" :subtitle="project?.name" :eyebrow="locale.t('Advanced generation')" icon="globe" />
    <section class="empty-hub">
      <span><AppIcon name="leaf" :size="32" /></span>
      <p>{{ locale.t('World tools will appear here only when they generate valid Bedrock content.') }}</p>
      <small>{{ locale.t('Plants, Trees, Biomes, Structures, Ore Generation, and Dimensions are not exposed as fake buttons.') }}</small>
    </section>
  </main>
</template>

<style scoped>
.empty-hub{width:min(100% - 2rem,42rem);min-height:55dvh;display:grid;place-items:center;align-content:center;gap:.65rem;margin:0 auto;text-align:center}.empty-hub>span{width:4.5rem;height:4.5rem;display:grid;place-items:center;border-radius:var(--radius-xl);background:var(--color-accent-soft);color:var(--color-accent-strong)}.empty-hub p{max-width:32rem;margin:.4rem 0 0;font-size:.9rem;font-weight:750;line-height:1.5}.empty-hub small{max-width:31rem;color:var(--color-text-subtle);font-size:.7rem;line-height:1.5}
</style>
