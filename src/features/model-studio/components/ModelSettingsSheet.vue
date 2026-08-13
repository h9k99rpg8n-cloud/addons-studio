<script setup lang="ts">
import BottomSheet from '@/components/common/BottomSheet.vue'
import type {
  StudioControlMode,
  StudioEditorLanguage,
  StudioModelingSettings,
  StudioResizeDirection,
  StudioTransformSpace,
} from '@/types/model'

defineProps<{
  open: boolean
  settings: StudioModelingSettings
}>()

const emit = defineEmits<{
  close: []
  update: [settings: StudioModelingSettings]
}>()

function update<K extends keyof StudioModelingSettings>(
  settings: StudioModelingSettings,
  key: K,
  value: StudioModelingSettings[K],
): void {
  emit('update', { ...settings, [key]: value })
}

const resizeOptions: readonly { value: StudioResizeDirection; label: string; help: string }[] = [
  { value: 'symmetric', label: 'Both / Symmetric', help: 'Keeps the visual center fixed.' },
  { value: 'positive', label: 'Positive Side', help: 'Keeps the negative side fixed.' },
  { value: 'negative', label: 'Negative Side', help: 'Keeps the positive side fixed.' },
]

const controlOptions: readonly { value: StudioControlMode; label: string; help: string }[] = [
  { value: 'gizmos', label: 'Gizmos', help: 'Use Addons Studio axis handles.' },
  { value: 'tactilismos', label: 'Tactilismos', help: 'Hold the selected object for direct touch transforms.' },
  { value: 'hybrid', label: 'Hybrid', help: 'Use gizmos and safe direct-touch gestures together.' },
]

const spaceOptions: readonly { value: StudioTransformSpace; label: string; help: string }[] = [
  { value: 'global', label: 'Global', help: 'Axes follow the green world grid.' },
  { value: 'local', label: 'Local', help: 'Axes follow the selected object rotation.' },
  { value: 'parent', label: 'Parent', help: 'Axes follow the parent group; root objects use Global.' },
]

const languageOptions: readonly { value: StudioEditorLanguage; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
]
</script>

<template>
  <BottomSheet
    :open="open"
    title="Model Studio Settings"
    description="Touch and transform behavior for this model"
    @close="emit('close')"
  >
    <div class="model-settings">
      <fieldset>
        <legend>Resize Direction</legend>
        <button
          v-for="option in resizeOptions"
          :key="option.value"
          type="button"
          :class="{ active: settings.resizeDirection === option.value }"
          :aria-pressed="settings.resizeDirection === option.value"
          @click="update(settings, 'resizeDirection', option.value)"
        >
          <strong>{{ option.label }}</strong><small>{{ option.help }}</small>
        </button>
      </fieldset>

      <fieldset>
        <legend>Control Mode</legend>
        <button
          v-for="option in controlOptions"
          :key="option.value"
          type="button"
          :class="{ active: settings.controlMode === option.value }"
          :aria-pressed="settings.controlMode === option.value"
          @click="update(settings, 'controlMode', option.value)"
        >
          <strong>{{ option.label }}</strong><small>{{ option.help }}</small>
        </button>
      </fieldset>

      <fieldset>
        <legend>Transform Space</legend>
        <button
          v-for="option in spaceOptions"
          :key="option.value"
          type="button"
          :class="{ active: settings.transformSpace === option.value }"
          :aria-pressed="settings.transformSpace === option.value"
          @click="update(settings, 'transformSpace', option.value)"
        >
          <strong>{{ option.label }}</strong><small>{{ option.help }}</small>
        </button>
      </fieldset>

      <fieldset>
        <legend>Language Foundation</legend>
        <div class="language-options">
          <button
            v-for="option in languageOptions"
            :key="option.value"
            type="button"
            :class="{ active: settings.language === option.value }"
            :aria-pressed="settings.language === option.value"
            @click="update(settings, 'language', option.value)"
          >
            <strong>{{ option.label }}</strong>
          </button>
        </div>
        <p>The preference is ready for future localization. This Alpha remains primarily in English.</p>
      </fieldset>
    </div>
  </BottomSheet>
</template>

<style scoped>
.model-settings { display: grid; gap: var(--space-5); padding-bottom: var(--space-2); }
fieldset { display: grid; gap: 0.45rem; margin: 0; border: 0; padding: 0; }
legend { margin-bottom: var(--space-2); color: var(--color-text-muted); font-size: 0.78rem; font-weight: 800; }
button {
  min-height: 3.55rem;
  display: grid;
  gap: 0.15rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-lg);
  padding: 0.55rem 0.7rem;
  background: var(--color-input-bg);
  color: var(--color-text);
  text-align: left;
}
button strong { font-size: 0.82rem; }
button small { color: var(--color-text-subtle); font-size: 0.68rem; line-height: 1.35; }
button.active { border-color: var(--color-accent); background: #123421; box-shadow: inset 3px 0 var(--color-accent); }
.language-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.45rem; }
.language-options button { min-height: var(--touch-target); text-align: center; }
p { margin: 0; color: var(--color-text-subtle); font-size: 0.68rem; line-height: 1.45; }
</style>
