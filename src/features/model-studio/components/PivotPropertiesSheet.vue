<script setup lang="ts">
import { ref, watch } from 'vue'

import AppButton from '@/components/common/AppButton.vue'
import BottomSheet from '@/components/common/BottomSheet.vue'
import { nodePivotCenter } from '@/core/model/modelHierarchy'
import type { StudioModel, StudioModelNode, StudioVector3 } from '@/types/model'

const props = defineProps<{
  open: boolean
  model: StudioModel
  node?: StudioModelNode
}>()

const emit = defineEmits<{
  close: []
  begin: []
  preview: [pivot: StudioVector3]
  commit: [payload: { pivot: StudioVector3; label: string }]
}>()

const draft = ref<StudioVector3>({ x: 0, y: 0, z: 0 })
const before = ref<StudioVector3>()
const activeLabel = ref('Edit pivot')

function clonePivot(pivot: StudioVector3): StudioVector3 {
  return { x: pivot.x, y: pivot.y, z: pivot.z }
}

watch(
  () => [props.open, props.node] as const,
  () => {
    if (props.node) draft.value = clonePivot(props.node.pivot)
  },
  { immediate: true, deep: true },
)

function beginEdit(label = 'Edit pivot'): void {
  if (!props.node) return
  before.value = clonePivot(props.node.pivot)
  activeLabel.value = label
  emit('begin')
}

function preview(): void {
  draft.value = {
    x: Number(draft.value.x) || 0,
    y: Number(draft.value.y) || 0,
    z: Number(draft.value.z) || 0,
  }
  emit('preview', clonePivot(draft.value))
}

function commit(): void {
  if (!before.value) return
  preview()
  const changed = JSON.stringify(before.value) !== JSON.stringify(draft.value)
  before.value = undefined
  if (changed) emit('commit', { pivot: clonePivot(draft.value), label: activeLabel.value })
}

function applyPreset(label: string, pivot: StudioVector3): void {
  beginEdit(label)
  draft.value = clonePivot(pivot)
  preview()
  commit()
}

function close(): void {
  commit()
  emit('close')
}
</script>

<template>
  <BottomSheet
    :open="open && Boolean(node)"
    :title="`Edit Pivot · ${node?.name ?? 'Object'}`"
    description="The pivot is an animation-ready anchor. Moving it does not move geometry."
    @close="close"
  >
    <div v-if="node" class="pivot-editor">
      <fieldset>
        <legend>Pivot Coordinates</legend>
        <label v-for="axis in (['x', 'y', 'z'] as const)" :key="axis">
          <span :class="`axis axis--${axis}`">{{ axis.toUpperCase() }}</span>
          <input
            v-model.number="draft[axis]"
            type="number"
            inputmode="decimal"
            step="0.1"
            @focus="beginEdit('Edit pivot')"
            @input="preview"
            @blur="commit"
          />
        </label>
      </fieldset>

      <div class="pivot-actions">
        <AppButton variant="secondary" @click="applyPreset('Center pivot', nodePivotCenter(model, node))">Center Pivot</AppButton>
        <AppButton variant="secondary" @click="applyPreset('Reset pivot', node.defaultPivot)">Reset Pivot</AppButton>
        <AppButton variant="secondary" @click="applyPreset('Pivot to origin', { x: 0, y: 0, z: 0 })">Pivot to Origin</AppButton>
      </div>
    </div>
  </BottomSheet>
</template>

<style scoped>
.pivot-editor { display: grid; gap: var(--space-5); padding-bottom: var(--space-2); }
fieldset { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-2); margin: 0; border: 0; padding: 0; }
legend { grid-column: 1 / -1; margin-bottom: var(--space-2); color: var(--color-text-muted); font-size: 0.76rem; font-weight: 780; }
fieldset label { min-width: 0; display: grid; grid-template-columns: 1.6rem minmax(0, 1fr); align-items: center; border: 1px solid var(--color-border-strong); border-radius: var(--radius-md); overflow: hidden; background: var(--color-input-bg); }
fieldset label:focus-within { border-color: var(--color-accent); box-shadow: var(--focus-ring); }
fieldset input { width: 100%; min-width: 0; min-height: 3rem; border: 0; outline: 0; background: transparent; color: var(--color-text); font-family: var(--font-mono); font-size: 1rem; }
.axis { font-family: var(--font-mono); font-size: 0.72rem; font-weight: 850; text-align: center; }
.axis--x { color: #f46b73; }
.axis--y { color: #62d77c; }
.axis--z { color: #62a9ff; }
.pivot-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-2); }
.pivot-actions > :last-child { grid-column: 1 / -1; }
</style>
