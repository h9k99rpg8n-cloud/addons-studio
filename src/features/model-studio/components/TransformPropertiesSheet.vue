<script setup lang="ts">
import { ref, watch } from 'vue'

import BottomSheet from '@/components/common/BottomSheet.vue'
import { cloneStudioCube, cloneStudioGroup } from '@/core/model/modelFactory'
import type { StudioModelNode } from '@/types/model'
import type { StudioAxis } from '@/core/model/modelHierarchy'

type NumericOperation = 'generic' | 'move' | 'scale' | 'rotate'

const props = defineProps<{
  open: boolean
  node?: StudioModelNode
}>()

const emit = defineEmits<{
  close: []
  begin: []
  preview: [payload: { node: StudioModelNode; operation: NumericOperation; axis?: StudioAxis }]
  commit: [payload: { after: StudioModelNode; label: string; operation: NumericOperation; axis?: StudioAxis }]
}>()

const draft = ref<StudioModelNode>()
const beforeEdit = ref<StudioModelNode>()
const activeLabel = ref<string>()
const activeOperation = ref<NumericOperation>('generic')
const activeAxis = ref<StudioAxis>()

function cloneNode(node: StudioModelNode): StudioModelNode {
  return node.type === 'cube' ? cloneStudioCube(node) : cloneStudioGroup(node)
}

watch(
  () => [props.open, props.node] as const,
  () => {
    // Live previews replace the model node. Do not feed those derived position/
    // pivot values back into the user's draft while the same field is active,
    // otherwise a symmetric resize can apply its center offset a second time.
    if (props.node && !beforeEdit.value) draft.value = cloneNode(props.node)
  },
  { immediate: true, deep: true },
)

function beginEdit(label: string, operation: NumericOperation, axis?: StudioAxis): void {
  if (!props.node) return
  beforeEdit.value = cloneNode(props.node)
  activeLabel.value = label
  activeOperation.value = operation
  activeAxis.value = axis
  emit('begin')
}

function preview(): void {
  if (!draft.value) return
  if (draft.value.type === 'cube') {
    draft.value.size.x = Math.max(0.25, Number(draft.value.size.x) || 0.25)
    draft.value.size.y = Math.max(0.25, Number(draft.value.size.y) || 0.25)
    draft.value.size.z = Math.max(0.25, Number(draft.value.size.z) || 0.25)
  } else {
    draft.value.scale.x = Math.max(0.05, Number(draft.value.scale.x) || 0.05)
    draft.value.scale.y = Math.max(0.05, Number(draft.value.scale.y) || 0.05)
    draft.value.scale.z = Math.max(0.05, Number(draft.value.scale.z) || 0.05)
  }
  emit('preview', {
    node: cloneNode(draft.value),
    operation: activeOperation.value,
    axis: activeAxis.value,
  })
}

function commit(): void {
  if (!draft.value || !beforeEdit.value) return
  preview()
  const before = cloneNode(beforeEdit.value)
  const after = cloneNode(draft.value)
  const label = activeLabel.value ?? `Edit ${after.type}`
  beforeEdit.value = undefined
  activeLabel.value = undefined
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    emit('commit', {
      after,
      label,
      operation: activeOperation.value,
      axis: activeAxis.value,
    })
  }
  activeOperation.value = 'generic'
  activeAxis.value = undefined
}

function finishAndClose(): void {
  // iOS can dismiss the sheet/keyboard without dispatching a reliable change
  // event. Flushing the active edit here keeps numeric edits undoable.
  commit()
  emit('close')
}
</script>

<template>
  <BottomSheet
    :open="open && Boolean(node)"
    :title="node?.name ?? 'Object Properties'"
    description="Exact values update the viewport immediately"
    @close="finishAndClose"
  >
    <div v-if="draft" class="transform-editor">
      <label class="name-field">
        <span>Name</span>
        <input
          v-model="draft.name"
          class="text-input"
          maxlength="60"
          autocomplete="off"
          @focus="beginEdit(`Rename ${draft.type}`, 'generic')"
          @input="preview"
          @blur="commit"
        />
      </label>

      <fieldset>
        <legend>Position</legend>
        <label v-for="axis in (['x', 'y', 'z'] as const)" :key="`position-${axis}`">
          <span :class="`axis axis--${axis}`">{{ axis.toUpperCase() }}</span>
          <input
            v-model.number="draft.position[axis]"
            type="number"
            inputmode="decimal"
            step="0.1"
            @focus="beginEdit(`Move ${draft.type}`, 'move', axis)"
            @input="preview"
            @blur="commit"
          />
        </label>
      </fieldset>

      <fieldset>
        <legend>{{ draft.type === 'cube' ? 'Size' : 'Group Scale' }}</legend>
        <label v-for="axis in (['x', 'y', 'z'] as const)" :key="`size-${axis}`">
          <span :class="`axis axis--${axis}`">{{ axis.toUpperCase() }}</span>
          <input
            v-if="draft.type === 'cube'"
            v-model.number="draft.size[axis]"
            type="number"
            inputmode="decimal"
            min="0.25"
            step="0.25"
            @focus="beginEdit(`Resize ${draft.type}`, 'scale', axis)"
            @input="preview"
            @blur="commit"
          />
          <input
            v-else
            v-model.number="draft.scale[axis]"
            type="number"
            inputmode="decimal"
            min="0.05"
            step="0.05"
            @focus="beginEdit(`Resize ${draft.type}`, 'scale', axis)"
            @input="preview"
            @blur="commit"
          />
        </label>
      </fieldset>

      <fieldset>
        <legend>Rotation (degrees)</legend>
        <label v-for="axis in (['x', 'y', 'z'] as const)" :key="`rotation-${axis}`">
          <span :class="`axis axis--${axis}`">{{ axis.toUpperCase() }}</span>
          <input
            v-model.number="draft.rotation[axis]"
            type="number"
            inputmode="decimal"
            step="1"
            @focus="beginEdit(`Rotate ${draft.type}`, 'rotate', axis)"
            @input="preview"
            @blur="commit"
          />
        </label>
      </fieldset>
    </div>
  </BottomSheet>
</template>

<style scoped>
.transform-editor {
  display: grid;
  gap: var(--space-5);
  padding-bottom: var(--space-2);
}

.name-field {
  display: grid;
  gap: var(--space-2);
}

.name-field > span,
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

fieldset legend {
  grid-column: 1 / -1;
  margin-bottom: var(--space-2);
}

fieldset label {
  min-width: 0;
  display: grid;
  grid-template-columns: 1.6rem minmax(0, 1fr);
  align-items: center;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-input-bg);
}

fieldset label:focus-within {
  border-color: var(--color-accent);
  box-shadow: var(--focus-ring);
}

fieldset input {
  width: 100%;
  min-width: 0;
  min-height: 3rem;
  border: 0;
  outline: 0;
  padding: 0 0.35rem;
  background: transparent;
  color: var(--color-text);
  font-family: var(--font-mono);
  font-size: 1rem;
}

.axis {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  font-weight: 850;
  text-align: center;
}

.axis--x { color: #f46b73; }
.axis--y { color: #62d77c; }
.axis--z { color: #62a9ff; }
</style>
