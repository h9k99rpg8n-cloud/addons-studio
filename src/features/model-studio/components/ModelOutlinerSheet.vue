<script setup lang="ts">
import AppIcon from '@/components/common/AppIcon.vue'
import BottomSheet from '@/components/common/BottomSheet.vue'
import StudioIcon from '@/components/common/StudioIcon.vue'
import type { StudioModel } from '@/types/model'

defineProps<{
  open: boolean
  model: StudioModel
  selectedElementId?: string
  selectedReferenceId?: string
}>()

defineEmits<{
  close: []
  selectElement: [id: string]
  selectReference: [id: string]
  renameElement: [id: string]
  toggleElement: [id: string]
  deleteElement: [id: string]
  editReference: [id: string]
  toggleReference: [id: string]
  deleteReference: [id: string]
}>()
</script>

<template>
  <BottomSheet
    :open="open"
    title="Outliner"
    :description="`${model.elements.length} cubes · ${model.references.length} references`"
    @close="$emit('close')"
  >
    <div class="outliner">
      <section>
        <header><StudioIcon name="model" :size="19" /><h3>Model</h3></header>
        <div v-if="model.elements.length" class="outliner-list">
          <article
            v-for="element in model.elements"
            :key="element.id"
            class="outliner-row"
            :class="{ 'outliner-row--selected': selectedElementId === element.id }"
          >
            <button type="button" class="outliner-row__select" @click="$emit('selectElement', element.id)">
              <AppIcon name="box" :size="20" />
              <span><strong>{{ element.name }}</strong><small>Cube</small></span>
            </button>
            <button type="button" :aria-label="`Rename ${element.name}`" @click="$emit('renameElement', element.id)">
              <AppIcon name="pencil" :size="18" />
            </button>
            <button type="button" :aria-label="`${element.visible ? 'Hide' : 'Show'} ${element.name}`" @click="$emit('toggleElement', element.id)">
              <AppIcon :name="element.visible ? 'eye' : 'eye-off'" :size="18" />
            </button>
            <button type="button" class="outliner-row__delete" :aria-label="`Delete ${element.name}`" @click="$emit('deleteElement', element.id)">
              <AppIcon name="trash" :size="18" />
            </button>
          </article>
        </div>
        <p v-else class="outliner-empty">No cubes yet. Use + Cube in the bottom toolbar.</p>
      </section>

      <section v-if="model.references.length">
        <header><AppIcon name="image-plus" :size="19" /><h3>References</h3></header>
        <div class="outliner-list">
          <article
            v-for="reference in model.references"
            :key="reference.id"
            class="outliner-row"
            :class="{ 'outliner-row--selected': selectedReferenceId === reference.id }"
          >
            <button type="button" class="outliner-row__select" @click="$emit('selectReference', reference.id)">
              <AppIcon name="file" :size="20" />
              <span><strong>{{ reference.name }}</strong><small>{{ reference.view }} reference</small></span>
            </button>
            <button type="button" aria-label="Edit reference" @click="$emit('editReference', reference.id)">
              <AppIcon name="sliders" :size="18" />
            </button>
            <button type="button" :aria-label="`${reference.visible ? 'Hide' : 'Show'} ${reference.name}`" @click="$emit('toggleReference', reference.id)">
              <AppIcon :name="reference.visible ? 'eye' : 'eye-off'" :size="18" />
            </button>
            <button type="button" class="outliner-row__delete" :aria-label="`Delete ${reference.name}`" @click="$emit('deleteReference', reference.id)">
              <AppIcon name="trash" :size="18" />
            </button>
          </article>
        </div>
      </section>
    </div>
  </BottomSheet>
</template>

<style scoped>
.outliner {
  display: grid;
  gap: var(--space-5);
  padding-bottom: var(--space-2);
}

.outliner section > header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
  color: var(--color-accent-strong);
}

.outliner h3 {
  margin: 0;
  color: var(--color-text);
  font-size: 0.82rem;
}

.outliner-list {
  display: grid;
  gap: 0.38rem;
}

.outliner-row {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) repeat(3, var(--touch-target));
  align-items: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--color-surface-raised);
}

.outliner-row--selected {
  border-color: var(--color-accent);
  box-shadow: inset 3px 0 var(--color-accent);
}

.outliner-row button {
  min-width: var(--touch-target);
  min-height: var(--touch-target);
  display: grid;
  place-items: center;
  border: 0;
  background: transparent;
  color: var(--color-text-muted);
}

.outliner-row__select {
  grid-template-columns: auto minmax(0, 1fr) !important;
  justify-content: start !important;
  gap: var(--space-2);
  padding: 0.45rem 0.65rem;
  color: var(--color-text) !important;
  text-align: left;
}

.outliner-row__select > span {
  min-width: 0;
  display: grid;
  gap: 0.12rem;
}

.outliner-row__select strong,
.outliner-row__select small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.outliner-row__select strong { font-size: 0.8rem; }
.outliner-row__select small { color: var(--color-text-subtle); font-size: 0.65rem; }
.outliner-row__delete { color: var(--color-danger) !important; }

.outliner-empty {
  margin: 0;
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  color: var(--color-text-subtle);
  font-size: 0.74rem;
  line-height: 1.5;
}
</style>
