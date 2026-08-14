<script setup lang="ts">
import AppIcon from '@/components/common/AppIcon.vue'
import BottomSheet from '@/components/common/BottomSheet.vue'
import { useLocaleStore } from '@/stores/locale'
import type { StudioEditorBackgroundSettings, StudioEditorBackgroundType } from '@/types/model'

defineProps<{
  open: boolean
  background: StudioEditorBackgroundSettings
  hasCustomImage: boolean
  importing?: boolean
}>()

defineEmits<{
  close: []
  select: [type: StudioEditorBackgroundType]
  import: []
  removeCustom: []
  update: [settings: StudioEditorBackgroundSettings]
}>()

const locale = useLocaleStore()

const options: readonly { id: StudioEditorBackgroundType; label: string; description: string }[] = [
  { id: 'dark-studio', label: 'Dark Studio', description: 'Neutral default environment' },
  { id: 'sky', label: 'Sky', description: 'Bright blue procedural atmosphere' },
  { id: 'night', label: 'Night', description: 'Deep blue low-light environment' },
  { id: 'sunset', label: 'Sunset', description: 'Warm orange and purple atmosphere' },
  { id: 'snow', label: 'Snow', description: 'Bright, cool environment' },
  { id: 'custom', label: 'Custom Image', description: 'Editor-only PNG or JPG' },
]

</script>

<template>
  <BottomSheet :open="open" :title="locale.t('Editor Background')" :description="locale.t('Atmosphere behind the scene · never exported model content')" @close="$emit('close')">
    <div class="background-settings">
      <div class="background-options">
        <button
          v-for="option in options"
          :key="option.id"
          type="button"
          :class="{ active: background.type === option.id }"
          @click="option.id === 'custom' && !hasCustomImage ? $emit('import') : $emit('select', option.id)"
        >
          <span class="background-swatch" :class="`background-swatch--${option.id}`"><AppIcon v-if="option.id === 'custom'" name="image-plus" :size="20" /></span>
          <span><strong>{{ locale.t(option.label) }}</strong><small>{{ locale.t(option.id === 'custom' && importing ? 'Opening image…' : option.description) }}</small></span>
          <AppIcon v-if="background.type === option.id" name="check" :size="19" />
        </button>
      </div>

      <section v-if="hasCustomImage" class="custom-controls">
        <header><strong>{{ locale.t('Custom Image') }}</strong><button type="button" @click="$emit('import')">{{ locale.t('Replace') }}</button></header>
        <div class="fit-options" :aria-label="locale.t('Custom background fit')">
          <button v-for="fit in (['fit', 'fill', 'stretch'] as const)" :key="fit" type="button" :class="{ active: background.fit === fit }" @click="$emit('update', { ...background, fit })">{{ locale.t(fit[0]!.toUpperCase() + fit.slice(1)) }}</button>
        </div>
        <label><span>{{ locale.t('Opacity') }} <strong>{{ Math.round(background.opacity * 100) }}%</strong></span><input :value="background.opacity" type="range" min="0.1" max="1" step="0.05" @input="$emit('update', { ...background, opacity: Number(($event.target as HTMLInputElement).value) })" /></label>
        <label><span>{{ locale.t('Brightness') }} <strong>{{ Math.round(background.brightness * 100) }}%</strong></span><input :value="background.brightness" type="range" min="0.25" max="1.5" step="0.05" @input="$emit('update', { ...background, brightness: Number(($event.target as HTMLInputElement).value) })" /></label>
        <button type="button" class="remove-custom" @click="$emit('removeCustom')">{{ locale.t('Remove Custom Image & Reset') }}</button>
      </section>
    </div>
  </BottomSheet>
</template>

<style scoped>
.background-settings { display: grid; gap: var(--space-5); padding-bottom: var(--space-2); }
.background-options { display: grid; gap: var(--space-2); }
.background-options > button { min-height: 4rem; display: grid; grid-template-columns: 2.8rem minmax(0, 1fr) 1.5rem; align-items: center; gap: var(--space-3); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 0.55rem; background: var(--color-surface-raised); color: var(--color-text); text-align: left; }
.background-options > button.active { border-color: var(--color-accent); background: #112d1d; }
.background-options > button > span:nth-child(2) { min-width: 0; display: grid; gap: 0.18rem; }
.background-options strong { font-size: 0.8rem; }
.background-options small { color: var(--color-text-muted); font-size: 0.68rem; }
.background-swatch { width: 2.8rem; height: 2.8rem; display: grid; place-items: center; border: 1px solid rgb(255 255 255 / 0.12); border-radius: var(--radius-md); background: #090c0e; color: var(--color-text-muted); }
.background-swatch--sky { background: linear-gradient(#70b9e9, #e5f1f7); }
.background-swatch--night { background: linear-gradient(#07142d, #17325a); }
.background-swatch--sunset { background: linear-gradient(#4c4079, #e99268); }
.background-swatch--snow { background: linear-gradient(#b9d9e9, #f4fafc); }
.custom-controls { display: grid; gap: var(--space-3); border-top: 1px solid var(--color-border); padding-top: var(--space-4); }
.custom-controls header,
.custom-controls label > span { display: flex; align-items: center; justify-content: space-between; }
.custom-controls header button { min-height: var(--touch-target); border: 0; background: transparent; color: var(--color-accent-strong); font-size: 0.78rem; }
.fit-options { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-2); }
.fit-options button,
.remove-custom { min-height: var(--touch-target); border: 1px solid var(--color-border-strong); border-radius: var(--radius-md); background: var(--color-input-bg); color: var(--color-text-muted); text-transform: capitalize; }
.fit-options button.active { border-color: var(--color-accent); color: var(--color-accent-strong); }
.custom-controls label { display: grid; gap: var(--space-2); color: var(--color-text-muted); font-size: 0.76rem; }
.custom-controls input { min-height: var(--touch-target); accent-color: var(--color-accent); }
.remove-custom { color: var(--color-danger); }
</style>
