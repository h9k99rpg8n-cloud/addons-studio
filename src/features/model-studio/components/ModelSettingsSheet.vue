<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import AppIcon from '@/components/common/AppIcon.vue'
import BottomSheet from '@/components/common/BottomSheet.vue'
import { createDefaultEditorState } from '@/core/model/modelFactory'
import { useLocaleStore } from '@/stores/locale'
import type {
  StudioCameraSettings,
  StudioControlMode,
  StudioExperimentalSettings,
  StudioModelingSettings,
  StudioResizeDirection,
  StudioSnappingSettings,
  StudioTransformSpace,
} from '@/types/model'

type SettingsPage = 'root' | 'controls' | 'resize' | 'precision' | 'camera' | 'appearance' | 'language'

const props = defineProps<{
  open: boolean
  settings: StudioModelingSettings
  snapping: StudioSnappingSettings
  camera: StudioCameraSettings
  /** Kept for Snapshot 3 prop compatibility. No user-facing Touch Rotate experiment remains. */
  experimental: StudioExperimentalSettings
}>()

const emit = defineEmits<{
  close: []
  update: [settings: StudioModelingSettings]
  updateSnapping: [settings: StudioSnappingSettings]
  updateCamera: [settings: StudioCameraSettings]
  updateExperimental: [settings: StudioExperimentalSettings]
  openBackground: []
  requestReset: []
}>()

const locale = useLocaleStore()
const page = ref<SettingsPage>('root')
watch(() => props.open, (open) => { if (!open) page.value = 'root' })

const pageTitle = computed(() => ({
  root: 'Model Studio Settings',
  controls: 'Gizmos & Controls',
  resize: 'Resize',
  precision: 'Precision',
  camera: 'Camera',
  appearance: 'Appearance',
  language: 'Language',
})[page.value])

const categories: readonly { id: Exclude<SettingsPage, 'root'>; label: string; icon: string; detail: string }[] = [
  { id: 'controls', label: 'Gizmos & Controls', icon: 'move-3d', detail: 'Control mode and default transform space' },
  { id: 'resize', label: 'Resize', icon: 'scale', detail: 'Symmetric, positive, or negative boundary' },
  { id: 'precision', label: 'Precision', icon: 'magnet', detail: 'Independent Move, Resize, and Rotate snapping' },
  { id: 'camera', label: 'Camera', icon: 'camera', detail: 'Orbit, pan, zoom, and touch profile' },
  { id: 'appearance', label: 'Appearance', icon: 'palette', detail: 'Editor environment and modeling guides' },
  { id: 'language', label: 'Language', icon: 'languages', detail: 'English or Español' },
]

const resizeOptions: readonly { value: StudioResizeDirection; label: string; help: string }[] = [
  { value: 'symmetric', label: 'Both / Symmetric', help: 'Keeps the visual center fixed.' },
  { value: 'positive', label: 'Positive Side', help: 'Keeps the negative side fixed.' },
  { value: 'negative', label: 'Negative Side', help: 'Keeps the positive side fixed.' },
]

const controlOptions: readonly { value: StudioControlMode; label: string; help: string }[] = [
  { value: 'gizmos', label: 'Classic Gizmos', help: 'Use Addons Studio axis handles.' },
  { value: 'touch-gizmo', label: 'Touch Gizmo', help: 'Move, resize, and rotate the selected object directly with touch.' },
  { value: 'hybrid', label: 'Hybrid', help: 'Use classic gizmos and safe direct touch together.' },
]

const cameraProfiles = [
  { id: 'standard', label: 'Standard' },
  { id: 'one-finger', label: 'One-finger focused' },
  { id: 'two-finger', label: 'Two-finger focused' },
] as const

const spaceOptions: readonly StudioTransformSpace[] = ['global', 'local', 'parent']
const transformPresets: readonly (number | null)[] = [null, 1, 0.5, 0.25]
const rotationPresets: readonly (number | null)[] = [null, 1, 5, 15, 22.5, 45, 90]

function updateModeling<K extends keyof StudioModelingSettings>(key: K, value: StudioModelingSettings[K]): void {
  emit('update', { ...props.settings, [key]: value })
}

function updateSnap(key: keyof StudioSnappingSettings, value: number | null): void {
  emit('updateSnapping', { ...props.snapping, [key]: value })
}

function updateCamera(key: keyof StudioCameraSettings, value: StudioCameraSettings[keyof StudioCameraSettings]): void {
  emit('updateCamera', { ...props.camera, [key]: value })
}

function selectLanguage(language: 'en' | 'es'): void {
  locale.setLanguage(language)
  updateModeling('language', language)
}

function resetCamera(): void {
  emit('updateCamera', createDefaultEditorState().camera)
}
</script>

<template>
  <BottomSheet
    :open="open"
    :title="locale.t(pageTitle)"
    :description="page === 'root' ? locale.t('Focused Model Studio preferences') : undefined"
    @close="emit('close')"
  >
    <div class="model-settings">
      <button v-if="page !== 'root'" type="button" class="back-row" @click="page = 'root'">
        <AppIcon name="arrow-left" :size="20" />{{ locale.t('Model Studio Settings') }}
      </button>

      <div v-if="page === 'root'" class="navigation-list">
        <button v-for="category in categories" :key="category.id" type="button" @click="page = category.id">
          <span class="row-icon"><AppIcon :name="category.icon" :size="21" /></span>
          <span><strong>{{ locale.t(category.label) }}</strong><small>{{ locale.t(category.detail) }}</small></span>
          <AppIcon name="chevron-right" :size="20" />
        </button>
        <button type="button" class="reset-row" @click="emit('requestReset')">
          <span class="row-icon"><AppIcon name="rotate-3d" :size="21" /></span>
          <span><strong>{{ locale.t('Reset Model Studio Settings') }}</strong><small>{{ locale.t('Models, geometry, and editor images stay safe.') }}</small></span>
          <AppIcon name="chevron-right" :size="20" />
        </button>
      </div>

      <template v-else-if="page === 'controls'">
        <fieldset>
          <legend>{{ locale.t('Control Mode') }}</legend>
          <button
            v-for="option in controlOptions"
            :key="option.value"
            type="button"
            class="option-row"
            :class="{ active: settings.controlMode === option.value }"
            @click="updateModeling('controlMode', option.value)"
          >
            <span><strong>{{ locale.t(option.label) }}</strong><small>{{ locale.t(option.help) }}</small></span>
            <AppIcon v-if="settings.controlMode === option.value" name="check" :size="19" />
          </button>
        </fieldset>
        <fieldset>
          <legend>{{ locale.t('Transform Space') }}</legend>
          <div class="segmented">
            <button
              v-for="space in spaceOptions"
              :key="space"
              type="button"
              :class="{ active: settings.transformSpace === space }"
              @click="updateModeling('transformSpace', space)"
            >
              {{ locale.t(space[0]!.toUpperCase() + space.slice(1)) }}
            </button>
          </div>
          <p>{{ locale.t('Use the viewport quick selector to change this without reopening Settings.') }}</p>
        </fieldset>
      </template>

      <fieldset v-else-if="page === 'resize'">
        <legend>{{ locale.t('Resize Direction') }}</legend>
        <button
          v-for="option in resizeOptions"
          :key="option.value"
          type="button"
          class="option-row"
          :class="{ active: settings.resizeDirection === option.value }"
          @click="updateModeling('resizeDirection', option.value)"
        >
          <span><strong>{{ locale.t(option.label) }}</strong><small>{{ locale.t(option.help) }}</small></span>
          <AppIcon v-if="settings.resizeDirection === option.value" name="check" :size="19" />
        </button>
      </fieldset>

      <template v-else-if="page === 'precision'">
        <fieldset>
          <legend>{{ locale.t('Move snapping') }}</legend>
          <div class="preset-grid"><button v-for="value in transformPresets" :key="String(value)" type="button" :class="{ active: snapping.transform === value }" @click="updateSnap('transform', value)">{{ value ?? locale.t('Off') }}</button><button type="button" :class="{ active: snapping.transform === snapping.customTransform }" @click="updateSnap('transform', snapping.customTransform)">{{ locale.t('Custom') }}</button></div>
          <label>{{ locale.t('Custom') }}<input :value="snapping.customTransform" type="number" min="0.001" step="0.001" inputmode="decimal" @change="updateSnap('customTransform', Math.max(0.001, Number(($event.target as HTMLInputElement).value)))" /></label>
        </fieldset>
        <fieldset>
          <legend>{{ locale.t('Resize snapping') }}</legend>
          <div class="preset-grid"><button v-for="value in transformPresets" :key="String(value)" type="button" :class="{ active: (snapping.resize ?? snapping.transform) === value }" @click="updateSnap('resize', value)">{{ value ?? locale.t('Off') }}</button><button type="button" :class="{ active: (snapping.resize ?? snapping.transform) === snapping.customResize }" @click="updateSnap('resize', snapping.customResize ?? 0.125)">{{ locale.t('Custom') }}</button></div>
          <label>{{ locale.t('Custom') }}<input :value="snapping.customResize ?? 0.125" type="number" min="0.001" step="0.001" inputmode="decimal" @change="updateSnap('customResize', Math.max(0.001, Number(($event.target as HTMLInputElement).value)))" /></label>
        </fieldset>
        <fieldset>
          <legend>{{ locale.t('Rotate snapping') }}</legend>
          <div class="preset-grid preset-grid--rotation"><button v-for="value in rotationPresets" :key="String(value)" type="button" :class="{ active: snapping.rotation === value }" @click="updateSnap('rotation', value)">{{ value === null ? locale.t('Off') : `${value}°` }}</button><button type="button" :class="{ active: snapping.rotation === snapping.customRotation }" @click="updateSnap('rotation', snapping.customRotation ?? 1)">{{ locale.t('Custom') }}</button></div>
          <label>{{ locale.t('Custom degrees') }}<input :value="snapping.customRotation ?? 1" type="number" min="0.001" step="0.1" inputmode="decimal" @change="updateSnap('customRotation', Math.max(0.001, Number(($event.target as HTMLInputElement).value)))" /></label>
        </fieldset>
      </template>

      <template v-else-if="page === 'camera'">
        <fieldset>
          <legend>{{ locale.t('Touch navigation profile') }}</legend>
          <div class="profile-list">
            <button
              v-for="profile in cameraProfiles"
              :key="profile.id"
              type="button"
              class="option-row"
              :class="{ active: camera.profile === profile.id }"
              @click="updateCamera('profile', profile.id)"
            >
              <strong>{{ locale.t(profile.label) }}</strong>
              <AppIcon v-if="camera.profile === profile.id" name="check" :size="19" />
            </button>
          </div>
        </fieldset>
        <label class="slider-row"><span>{{ locale.t('Orbit sensitivity') }}<output>{{ camera.orbitSensitivity.toFixed(2) }}×</output></span><input :value="camera.orbitSensitivity" type="range" min="0.25" max="3" step="0.05" @input="updateCamera('orbitSensitivity', Number(($event.target as HTMLInputElement).value))" /></label>
        <label class="slider-row"><span>{{ locale.t('Pan sensitivity') }}<output>{{ camera.panSensitivity.toFixed(2) }}×</output></span><input :value="camera.panSensitivity" type="range" min="0.25" max="3" step="0.05" @input="updateCamera('panSensitivity', Number(($event.target as HTMLInputElement).value))" /></label>
        <label class="slider-row"><span>{{ locale.t('Zoom sensitivity') }}<output>{{ camera.zoomSensitivity.toFixed(2) }}×</output></span><input :value="camera.zoomSensitivity" type="range" min="0.25" max="3" step="0.05" @input="updateCamera('zoomSensitivity', Number(($event.target as HTMLInputElement).value))" /></label>
        <button type="button" class="secondary-action" @click="resetCamera">{{ locale.t('Restore camera defaults') }}</button>
      </template>

      <div v-else-if="page === 'appearance'" class="navigation-list">
        <button type="button" @click="emit('openBackground')"><span class="row-icon"><AppIcon name="palette" :size="21" /></span><span><strong>{{ locale.t('Background / Guide') }}</strong><small>{{ locale.t('Environment, custom image, and viewport-aligned references') }}</small></span><AppIcon name="chevron-right" :size="20" /></button>
      </div>

      <fieldset v-else-if="page === 'language'">
        <legend>{{ locale.t('Language') }}</legend>
        <div class="language-grid"><button v-for="option in [{ value: 'en', label: 'English' }, { value: 'es', label: 'Español' }]" :key="option.value" type="button" :class="{ active: locale.language === option.value }" @click="selectLanguage(option.value as 'en' | 'es')"><strong>{{ option.label }}</strong><AppIcon v-if="locale.language === option.value" name="check" :size="19" /></button></div>
        <p>{{ locale.t('Identifiers, namespaces, JSON keys, and file extensions never change.') }}</p>
      </fieldset>
    </div>
  </BottomSheet>
</template>

<style scoped>
.model-settings { display: grid; gap: var(--space-4); padding-bottom: var(--space-2); }
.back-row { min-height: var(--touch-target); display: inline-flex; align-items: center; gap: 0.5rem; justify-self: start; border: 0; background: transparent; color: var(--color-accent-strong); font-weight: 760; }
.navigation-list, fieldset, .profile-list { display: grid; gap: 0.45rem; }
.navigation-list > button, .option-row { min-height: 3.8rem; display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 0.65rem; border: 1px solid var(--color-border-strong); border-radius: var(--radius-lg); padding: 0.55rem 0.7rem; background: var(--color-input-bg); color: var(--color-text); text-align: left; }
.option-row { grid-template-columns: minmax(0, 1fr) auto; }
.navigation-list button > span:nth-child(2), .option-row > span { min-width: 0; display: grid; gap: 0.13rem; }
.navigation-list strong, .option-row strong { font-size: 0.82rem; }
.navigation-list small, .option-row small { color: var(--color-text-subtle); font-size: 0.67rem; line-height: 1.35; }
.row-icon { width: 2.45rem; height: 2.45rem; display: grid; place-items: center; border-radius: var(--radius-md); background: var(--color-accent-soft); color: var(--color-accent-strong); }
.reset-row .row-icon { color: var(--color-warning); background: var(--color-warning-soft); }
fieldset { margin: 0; border: 0; padding: 0; }
legend { margin-bottom: var(--space-2); color: var(--color-text-muted); font-size: 0.78rem; font-weight: 800; }
.option-row.active, .profile-list .active { border-color: var(--color-accent); background: var(--color-accent-soft); box-shadow: inset 3px 0 var(--color-accent); }
.segmented, .language-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.4rem; }
.segmented button, .language-grid button, .preset-grid button, .secondary-action { min-height: var(--touch-target); border: 1px solid var(--color-border-strong); border-radius: var(--radius-md); background: var(--color-input-bg); color: var(--color-text); }
.segmented button.active, .language-grid button.active, .preset-grid button.active { border-color: var(--color-accent); background: var(--color-accent-soft); color: var(--color-accent-strong); }
.language-grid { grid-template-columns: repeat(2, 1fr); }
.language-grid button { display: flex; align-items: center; justify-content: center; gap: 0.4rem; }
.preset-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0.35rem; }
.preset-grid--rotation { grid-template-columns: repeat(4, minmax(0, 1fr)); }
fieldset > label { display: grid; gap: 0.35rem; margin-top: 0.45rem; color: var(--color-text-muted); font-size: 0.72rem; font-weight: 740; }
fieldset input[type='number'] { min-height: var(--touch-target); border: 1px solid var(--color-border-strong); border-radius: var(--radius-md); padding: 0 0.7rem; background: var(--color-input-bg); color: var(--color-text); font-size: 16px; }
.slider-row { display: grid; gap: 0.5rem; }
.slider-row > span { display: flex; justify-content: space-between; gap: 1rem; color: var(--color-text-muted); font-size: 0.75rem; font-weight: 740; }
.slider-row input { min-height: var(--touch-target); accent-color: var(--color-accent); }
p { margin: 0.5rem 0 0; color: var(--color-text-subtle); font-size: 0.68rem; line-height: 1.45; }
@media (max-width: 360px) { .preset-grid { grid-template-columns: repeat(3, 1fr); } }
</style>
