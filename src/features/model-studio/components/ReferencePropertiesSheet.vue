<script setup lang="ts">
import { ref, watch } from 'vue'

import AppButton from '@/components/common/AppButton.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import BottomSheet from '@/components/common/BottomSheet.vue'
import { cloneStudioReference } from '@/core/model/modelFactory'
import type { StudioReferenceImage } from '@/types/model'

const props = defineProps<{
  open: boolean
  reference?: StudioReferenceImage
}>()

const emit = defineEmits<{
  close: []
  update: [reference: StudioReferenceImage]
  commit: [payload: { before: StudioReferenceImage; after: StudioReferenceImage; label: string }]
  toggleLock: [id: string]
  delete: [id: string]
}>()

const draft = ref<StudioReferenceImage>()
const beforeEdit = ref<StudioReferenceImage>()
const activeLabel = ref('Edit reference')

watch(
  () => [props.open, props.reference] as const,
  () => {
    if (props.reference) draft.value = cloneStudioReference(props.reference)
  },
  { immediate: true, deep: true },
)

function update(): void {
  if (!draft.value) return
  draft.value.size.x = Math.max(0.25, Number(draft.value.size.x) || 0.25)
  draft.value.size.y = Math.max(0.25, Number(draft.value.size.y) || 0.25)
  draft.value.opacity = Math.min(1, Math.max(0.05, Number(draft.value.opacity) || 0.05))
  emit('update', cloneStudioReference(draft.value))
}

function beginEdit(label: string): void {
  if (!props.reference || props.reference.locked) return
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
    :title="reference?.name ?? 'Reference Image'"
    description="Reference images are editor aids, not Minecraft textures"
    @close="close"
  >
    <div v-if="draft" class="reference-editor">
      <div class="lock-state" :class="{ 'lock-state--unlocked': !draft.locked }">
        <AppIcon :name="draft.locked ? 'lock' : 'unlock'" :size="21" />
        <span><strong>{{ draft.locked ? 'Reference Locked' : 'Reference Unlocked' }}</strong><small>{{ draft.locked ? 'It cannot intercept selection or move accidentally.' : 'Properties are editable until you lock it again.' }}</small></span>
        <AppButton variant="secondary" @click="$emit('toggleLock', draft.id)">{{ draft.locked ? 'Unlock' : 'Lock' }}</AppButton>
      </div>

      <div :inert="draft.locked || undefined" :class="{ 'reference-fields--locked': draft.locked }" class="reference-fields">
        <label class="full-field">
          <span>Name</span>
          <input v-model="draft.name" class="text-input" maxlength="80" @focus="beginEdit('Rename reference')" @input="update" @blur="commit" />
        </label>

        <label class="full-field">
          <span>View / Orientation</span>
          <select v-model="draft.view" class="text-input" @focus="beginEdit('Change reference view')" @change="commit">
            <option value="front">Front</option>
            <option value="back">Back</option>
            <option value="left">Left</option>
            <option value="right">Right</option>
            <option value="top">Top</option>
            <option value="bottom">Bottom</option>
          </select>
        </label>

        <fieldset>
          <legend>Position</legend>
          <label v-for="axis in (['x', 'y', 'z'] as const)" :key="axis">
            <span>{{ axis.toUpperCase() }}</span>
            <input v-model.number="draft.position[axis]" type="number" inputmode="decimal" step="0.1" @focus="beginEdit('Move reference')" @input="update" @blur="commit" />
          </label>
        </fieldset>

        <fieldset class="two-columns">
          <legend>Reference Size</legend>
          <label><span>W</span><input v-model.number="draft.size.x" type="number" inputmode="decimal" min="0.25" step="0.25" @focus="beginEdit('Resize reference')" @input="update" @blur="commit" /></label>
          <label><span>H</span><input v-model.number="draft.size.y" type="number" inputmode="decimal" min="0.25" step="0.25" @focus="beginEdit('Resize reference')" @input="update" @blur="commit" /></label>
        </fieldset>

        <label class="opacity-field">
          <span>Opacity <strong>{{ Math.round(draft.opacity * 100) }}%</strong></span>
          <input v-model.number="draft.opacity" type="range" min="0.05" max="1" step="0.05" @pointerdown="beginEdit('Change reference opacity')" @input="update" @change="commit" />
        </label>

        <label class="visibility-field">
          <input v-model="draft.visible" type="checkbox" @change="toggleValue(draft.visible ? 'Show reference' : 'Hide reference')" />
          <span>Show reference in viewport</span>
        </label>
      </div>

      <AppButton variant="danger" @click="$emit('delete', draft.id)">Delete Reference</AppButton>
    </div>
  </BottomSheet>
</template>

<style scoped>
.reference-editor {
  display: grid;
  gap: var(--space-5);
  padding-bottom: var(--space-2);
}

.reference-fields { display: grid; gap: var(--space-5); }
.reference-fields--locked { opacity: 0.48; }
.lock-state {
  display: grid;
  grid-template-columns: 2rem minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  border: 1px solid #6f5a1d;
  border-radius: var(--radius-lg);
  padding: var(--space-3);
  background: #29230f;
  color: #f2d570;
}
.lock-state--unlocked { border-color: #34784d; background: #123421; color: #80e5a1; }
.lock-state span { min-width: 0; display: grid; gap: 0.12rem; }
.lock-state strong { font-size: 0.76rem; }
.lock-state small { color: var(--color-text-muted); font-size: 0.64rem; line-height: 1.4; }

.full-field,
.opacity-field {
  display: grid;
  gap: var(--space-2);
}

.full-field > span,
.opacity-field > span,
fieldset legend {
  color: var(--color-text-muted);
  font-size: 0.76rem;
  font-weight: 780;
}

fieldset {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-2);
  margin: 0;
  border: 0;
  padding: 0;
}

fieldset.two-columns { grid-template-columns: repeat(2, minmax(0, 1fr)); }
fieldset legend { grid-column: 1 / -1; margin-bottom: var(--space-2); }

fieldset label {
  display: grid;
  grid-template-columns: 1.5rem minmax(0, 1fr);
  align-items: center;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-input-bg);
}

fieldset label span {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  font-weight: 850;
  text-align: center;
}

fieldset input {
  width: 100%;
  min-width: 0;
  min-height: 3rem;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--color-text);
  font-family: var(--font-mono);
  font-size: 1rem;
}

.opacity-field > span {
  display: flex;
  justify-content: space-between;
}

.opacity-field input { min-height: var(--touch-target); accent-color: var(--color-accent); }

.visibility-field {
  min-height: var(--touch-target);
  display: flex;
  align-items: center;
  gap: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 0 var(--space-3);
  background: var(--color-surface-raised);
  font-size: 0.78rem;
}

.visibility-field input { width: 1.25rem; height: 1.25rem; accent-color: var(--color-accent); }
</style>
