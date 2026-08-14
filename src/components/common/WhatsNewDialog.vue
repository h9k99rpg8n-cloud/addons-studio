<script setup lang="ts">
import AppButton from '@/components/common/AppButton.vue'
import AppDialog from '@/components/common/AppDialog.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import BrandMark from '@/components/common/BrandMark.vue'
import { CURRENT_RELEASE_NOTE } from '@/core/app/releaseNotes'
import { useLocaleStore } from '@/stores/locale'

defineProps<{ open: boolean }>()
defineEmits<{ acknowledge: [] }>()
const locale = useLocaleStore()
</script>

<template>
  <AppDialog
    :open="open"
    :title="locale.t('What’s New')"
    :description="`Addons Studio Alpha ${CURRENT_RELEASE_NOTE.version}`"
    @close="$emit('acknowledge')"
  >
    <div class="release-hero">
      <span><BrandMark :size="58" /></span>
      <div>
        <strong>{{ locale.t(CURRENT_RELEASE_NOTE.title) }}</strong>
        <small>{{ locale.t(CURRENT_RELEASE_NOTE.subtitle) }}</small>
      </div>
    </div>
    <ul class="release-highlights">
      <li v-for="highlight in CURRENT_RELEASE_NOTE.highlights" :key="highlight">
        <AppIcon name="check-circle" :size="19" />
        <span>{{ locale.t(highlight) }}</span>
      </li>
    </ul>
    <template #actions>
      <AppButton variant="ghost" @click="$emit('acknowledge')">{{ locale.t('Skip') }}</AppButton>
      <AppButton @click="$emit('acknowledge')">{{ locale.t('Continue') }}</AppButton>
    </template>
  </AppDialog>
</template>

<style scoped>
.release-hero { display: flex; align-items: center; gap: var(--space-4); border: 1px solid var(--color-accent-border); border-radius: var(--radius-xl); padding: var(--space-4); background: var(--color-accent-soft); }
.release-hero > span { width: 4.2rem; height: 4.2rem; display: grid; place-items: center; border-radius: var(--radius-xl); background: var(--color-surface); }
.release-hero div { display: grid; gap: 0.2rem; }
.release-hero strong { font-size: 1.05rem; }
.release-hero small { color: var(--color-text-muted); line-height: 1.35; }
.release-highlights { display: grid; gap: 0.75rem; margin: var(--space-4) 0 0; padding: 0; list-style: none; }
.release-highlights li { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 0.65rem; align-items: start; color: var(--color-text-muted); font-size: 0.86rem; line-height: 1.45; }
.release-highlights svg { color: var(--color-accent-strong); }
</style>
