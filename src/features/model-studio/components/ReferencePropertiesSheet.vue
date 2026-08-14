<script setup lang="ts">
import { ref, watch } from 'vue'

import AppButton from '@/components/common/AppButton.vue'
import BottomSheet from '@/components/common/BottomSheet.vue'
import { cloneStudioReference } from '@/core/model/modelFactory'
import { useLocaleStore } from '@/stores/locale'
import type { StudioReferenceImage } from '@/types/model'

const props = defineProps<{
  open: boolean
  reference?: StudioReferenceImage
}>()
const locale = useLocaleStore()

const emit = defineEmits<{
  close: []
  update: [reference: StudioReferenceImage]
  commit: [payload: { before: StudioReferenceImage; after: StudioReferenceImage; label: string }]
  delete: [id: string]
}>()

const draft = ref<StudioReferenceImage>()
const beforeEdit = ref<StudioReferenceImage>()
const activeLabel = ref('Edit reference')

watch(
  () => [props.open, props.reference] as const,
  () => {
    if (props.reference && !beforeEdit.value) draft.value = cloneStudioReference(props.reference)
  },
  { immediate: true, deep: true },
)

function normalizeDraft(): void {
  if (!draft.value) return
  draft.value.position.x = Number(draft.value.position.x) || 0
  draft.value.position.y = Number(draft.value.position.y) || 0
  draft.value.scale = Math.min(20, Math.max(0.05, Number(draft.value.scale) || 0.05))
  draft.value.rotation = Number(draft.value.rotation) || 0
  draft.value.opacity = Math.min(1, Math.max(0.05, Number(draft.value.opacity) || 0.05))
}

function update(): void {
  if (!draft.value) return
  normalizeDraft()
  emit('update', cloneStudioReference(draft.value))
}

function beginEdit(label: string): void {
  if (!props.reference || beforeEdit.value) return
  beforeEdit.value = cloneStudioReference(props.reference)
  activeLabel.value = label
}

function commit(): void {
  if (!draft.value || !beforeEdit.value) return
  update()
  const before = cloneStudioReference(beforeEdit.value)
  const after = cloneStudioReference(draft.value)
  beforeEdit.value = undefined
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    emit('commit', { before, after, label: activeLabel.value })
  }
}

function toggleValue(label: string): void {
  beginEdit(label)
  update()
  commit()
}

function close(): void {
  commit()
  emit('close')
}
</script>

<template>
  <BottomSheet
    :open="open && Boolean(reference)"
    :title="reference?.name ?? locale.t('Reference Image')"
    :description="locale.t('Viewport guide · never model geometry or a Minecraft texture')"
    @close="close"
  >
    <div v-if="draft" class="reference-editor">
      <div class="guide-note">
        {{ locale.t('This guide appears only in its assigned standard view and never participates in selection or model bounds.') }}
      </div>

      <label class="full-field">
        <span>{{ locale.t('Name') }}</span>
        <input v-model="draft.name" maxlength="80" autocomplete="off" @focus="beginEdit('Rename reference')" @input="update" @blur="commit" />
      </label>

      <label class="full-field">
        <span>{{ locale.t('Assigned View') }}</span>
        <select v-model="draft.view" @focus="beginEdit('Change reference view')" @change="update(); commit()">
          <option value="front">{{ locale.t('Front') }}</option>
          <option value="back">{{ locale.t('Back view') }}</option>
          <option value="left">{{ locale.t('Left') }}</option>
          <option value="right">{{ locale.t('Right') }}</option>
          <option value="top">{{ locale.t('Top') }}</option>
          <option value="bottom">{{ locale.t('Bottom') }}</option>
        </select>
      </label>

      <fieldset class="two-columns">
        <legend>{{ locale.t('Viewport Position') }}</legend>
        <label v-for="axis in (['x', 'y'] as const)" :key="axis">
          <span>{{ axis.toUpperCase() }}</span>
          <input v-model.number="draft.position[axis]" type="number" inputmode="decimal" step="0.5" @focus="beginEdit('Move reference')" @input="update" @blur="commit" />
        </label>
      </fieldset>

      <fieldset class="two-columns">
        <legend>{{ locale.t('Guide Transform') }}</legend>
        <label><span>{{ locale.t('Scale') }}</span><input v-model.number="draft.scale" type="number" inputmode="decimal" min="0.05" max="20" step="0.05" @focus="beginEdit('Scale reference')" @input="update" @blur="commit" /></label>
        <label><span>{{ locale.t('Rotate') }}</span><input v-model.number="draft.rotation" type="number" inputmode="decimal" step="1" @focus="beginEdit('Rotate reference')" @input="update" @blur="commit" /></label>
      </fieldset>

      <label class="opacity-field">
        <span>{{ locale.t('Opacity') }} <strong>{{ Math.round(draft.opacity * 100) }}%</strong></span>
        <input v-model.number="draft.opacity" type="range" min="0.05" max="1" step="0.05" @pointerdown="beginEdit('Change reference opacity')" @input="update" @change="commit" />
      </label>

      <div class="toggle-grid">
        <button type="button" :aria-pressed="draft.flipHorizontal" @click="draft.flipHorizontal = !draft.flipHorizontal; toggleValue('Flip reference horizontally')">{{ locale.t('Flip Horizontal') }}</button>
        <button type="button" :aria-pressed="draft.flipVertical" @click="draft.flipVertical = !draft.flipVertical; toggleValue('Flip reference vertically')">{{ locale.t('Flip Vertical') }}</button>
      </div>

      <label class="visibility-field">
        <input v-model="draft.visible" type="checkbox" @change="toggleValue(draft.visible ? 'Show reference' : 'Hide reference')" />
        <span>{{ locale.t('Show reference in its assigned viewport') }}</span>
      </label>

      <AppButton variant="danger" @click="emit('delete', draft.id)">{{ locale.t('Delete Reference') }}</AppButton>
    </div>
  </BottomSheet>
</template>

<style scoped>
.reference-editor { display: grid; gap: var(--space-5); padding-bottom: var(--space-2); }
.guide-note { border: 1px solid #315b45; border-radius: var(--radius-lg); padding: var(--space-3); background: #10291c; color: #a9d8b9; font-size: 0.74rem; line-height: 1.45; }
.full-field,
.opacity-field { display: grid; gap: var(--space-2); }
.full-field > span,
.opacity-field > span,
fieldset legend { color: var(--color-text-muted); font-size: 0.76rem; font-weight: 780; }
.full-field input,
.full-field select { min-height: 3rem; border: 1px solid var(--color-border-strong); border-radius: var(--radius-md); padding: 0 var(--space-3); background: var(--color-input-bg); color: var(--color-text); font-size: 1rem; }
fieldset { display: grid; gap: var(--space-2); margin: 0; border: 0; padding: 0; }
fieldset.two-columns { grid-template-columns: repeat(2, minmax(0, 1fr)); }
fieldset legend { grid-column: 1 / -1; margin-bottom: var(--space-2); }
fieldset label { min-width: 0; display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; border: 1px solid var(--color-border-strong); border-radius: var(--radius-md); overflow: hidden; background: var(--color-input-bg); }
fieldset label span { padding-left: 0.55rem; color: var(--color-text-muted); font-size: 0.72rem; font-weight: 800; }
fieldset input { width: 100%; min-width: 0; min-height: 3rem; border: 0; outline: 0; padding: 0 0.5rem; background: transparent; color: var(--color-text); font-family: var(--font-mono); font-size: 1rem; }
.opacity-field > span { display: flex; justify-content: space-between; }
.opacity-field input { min-height: var(--touch-target); accent-color: var(--color-accent); }
.toggle-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-2); }
.toggle-grid button { min-height: var(--touch-target); border: 1px solid var(--color-border-strong); border-radius: var(--radius-md); background: var(--color-input-bg); color: var(--color-text-muted); font-size: 0.76rem; font-weight: 760; }
.toggle-grid button[aria-pressed='true'] { border-color: var(--color-accent); background: #123421; color: #83e6a3; }
.visibility-field { min-height: var(--touch-target); display: flex; align-items: center; gap: var(--space-3); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 0 var(--space-3); background: var(--color-surface-raised); font-size: 0.78rem; }
.visibility-field input { width: 1.25rem; height: 1.25rem; accent-color: var(--color-accent); }
</style>
