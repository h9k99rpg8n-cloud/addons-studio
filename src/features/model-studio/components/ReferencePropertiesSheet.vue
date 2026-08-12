<script setup lang="ts">
import { ref, watch } from 'vue'

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
}>()

const draft = ref<StudioReferenceImage>()

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
</script>

<template>
  <BottomSheet
    :open="open && Boolean(reference)"
    :title="reference?.name ?? 'Reference Image'"
    description="Reference images are editor aids, not Minecraft textures"
    @close="$emit('close')"
  >
    <div v-if="draft" class="reference-editor">
      <label class="full-field">
        <span>Name</span>
        <input v-model="draft.name" class="text-input" maxlength="80" @input="update" />
      </label>

      <fieldset>
        <legend>Position</legend>
        <label v-for="axis in (['x', 'y', 'z'] as const)" :key="axis">
          <span>{{ axis.toUpperCase() }}</span>
          <input v-model.number="draft.position[axis]" type="number" inputmode="decimal" step="0.1" @input="update" />
        </label>
      </fieldset>

      <fieldset class="two-columns">
        <legend>Reference Size</legend>
        <label><span>W</span><input v-model.number="draft.size.x" type="number" inputmode="decimal" min="0.25" step="0.25" @input="update" /></label>
        <label><span>H</span><input v-model.number="draft.size.y" type="number" inputmode="decimal" min="0.25" step="0.25" @input="update" /></label>
      </fieldset>

      <label class="opacity-field">
        <span>Opacity <strong>{{ Math.round(draft.opacity * 100) }}%</strong></span>
        <input v-model.number="draft.opacity" type="range" min="0.05" max="1" step="0.05" @input="update" />
      </label>

      <label class="visibility-field">
        <input v-model="draft.visible" type="checkbox" @change="update" />
        <span>Show reference in viewport</span>
      </label>
    </div>
  </BottomSheet>
</template>

<style scoped>
.reference-editor {
  display: grid;
  gap: var(--space-5);
  padding-bottom: var(--space-2);
}

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
