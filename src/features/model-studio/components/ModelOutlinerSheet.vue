<script setup lang="ts">
import { ref, watch } from 'vue'

import AppIcon from '@/components/common/AppIcon.vue'
import BottomSheet from '@/components/common/BottomSheet.vue'
import StudioIcon from '@/components/common/StudioIcon.vue'
import { getGroupChildren } from '@/core/model/modelHierarchy'
import type { StudioModel } from '@/types/model'

const props = defineProps<{
  open: boolean
  model: StudioModel
  selectedNodeId?: string
  selectedReferenceId?: string
}>()

defineEmits<{
  close: []
  selectNode: [id: string]
  selectReference: [id: string]
  createGroup: []
  renameNode: [id: string]
  duplicateNode: [id: string]
  showActions: [id: string]
  toggleElement: [id: string]
  deleteElement: [id: string]
  toggleGroup: [id: string]
  deleteGroup: [id: string]
  editReference: [id: string]
  toggleReference: [id: string]
  toggleReferenceLock: [id: string]
  deleteReference: [id: string]
}>()

const expanded = ref(new Set<string>())

watch(
  () => props.model.groups.map((group) => group.id),
  (ids) => {
    const available = new Set(ids)
    expanded.value = new Set([...expanded.value].filter((id) => available.has(id)))
    if (!expanded.value.size && ids[0]) expanded.value.add(ids[0])
  },
  { immediate: true },
)

function toggleExpanded(id: string): void {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}

function rootElements(): StudioModel['elements'] {
  return props.model.elements.filter((element) => !element.parentId)
}
</script>

<template>
  <BottomSheet
    :open="open"
    title="Outliner"
    :description="`${model.groups.length} groups · ${model.elements.length} cubes · ${model.references.length} references`"
    @close="$emit('close')"
  >
    <div class="outliner">
      <section>
        <header>
          <span><StudioIcon name="model" :size="19" /><h3>Model</h3></span>
          <button type="button" class="new-group" @click="$emit('createGroup')"><AppIcon name="folder-plus" :size="18" />New Group</button>
        </header>
        <div v-if="model.elements.length || model.groups.length" class="outliner-list">
          <template v-for="group in model.groups" :key="group.id">
            <article
              class="outliner-row outliner-row--group"
              :class="{ 'outliner-row--selected': selectedNodeId === group.id }"
            >
              <button type="button" :aria-label="`${expanded.has(group.id) ? 'Collapse' : 'Expand'} ${group.name}`" @click="toggleExpanded(group.id)">
                <AppIcon name="chevron-right" :size="19" :class="{ 'expand-icon--open': expanded.has(group.id) }" />
              </button>
              <button type="button" class="outliner-row__select" @click="$emit('selectNode', group.id)">
                <AppIcon name="folder" :size="20" />
                <span><strong>{{ group.name }}</strong><small>{{ getGroupChildren(model, group.id).length }} cubes</small></span>
              </button>
              <button type="button" :aria-label="`Duplicate ${group.name}`" @click="$emit('duplicateNode', group.id)"><AppIcon name="copy" :size="18" /></button>
              <button type="button" :aria-label="`${group.visible ? 'Hide' : 'Show'} ${group.name}`" @click="$emit('toggleGroup', group.id)"><AppIcon :name="group.visible ? 'eye' : 'eye-off'" :size="18" /></button>
              <button type="button" :aria-label="`${group.name} actions`" @click="$emit('showActions', group.id)"><AppIcon name="more-vertical" :size="18" /></button>
            </article>

            <article
              v-for="element in (expanded.has(group.id) ? getGroupChildren(model, group.id) : [])"
              :key="element.id"
              class="outliner-row outliner-row--child"
              :class="{ 'outliner-row--selected': selectedNodeId === element.id }"
            >
              <button type="button" class="outliner-row__select" @click="$emit('selectNode', element.id)">
                <AppIcon name="box" :size="19" />
                <span><strong>{{ element.name }}</strong><small>Cube · {{ group.name }}</small></span>
              </button>
              <button type="button" :aria-label="`Duplicate ${element.name}`" @click="$emit('duplicateNode', element.id)"><AppIcon name="copy" :size="18" /></button>
              <button type="button" :aria-label="`${element.visible ? 'Hide' : 'Show'} ${element.name}`" @click="$emit('toggleElement', element.id)"><AppIcon :name="element.visible ? 'eye' : 'eye-off'" :size="18" /></button>
              <button type="button" :aria-label="`${element.name} actions`" @click="$emit('showActions', element.id)"><AppIcon name="more-vertical" :size="18" /></button>
            </article>
          </template>

          <article
            v-for="element in rootElements()"
            :key="element.id"
            class="outliner-row"
            :class="{ 'outliner-row--selected': selectedNodeId === element.id }"
          >
            <button type="button" class="outliner-row__select" @click="$emit('selectNode', element.id)">
              <AppIcon name="box" :size="20" />
              <span><strong>{{ element.name }}</strong><small>Cube · Model Root</small></span>
            </button>
            <button type="button" :aria-label="`Duplicate ${element.name}`" @click="$emit('duplicateNode', element.id)"><AppIcon name="copy" :size="18" /></button>
            <button type="button" :aria-label="`${element.visible ? 'Hide' : 'Show'} ${element.name}`" @click="$emit('toggleElement', element.id)">
              <AppIcon :name="element.visible ? 'eye' : 'eye-off'" :size="18" />
            </button>
            <button type="button" :aria-label="`${element.name} actions`" @click="$emit('showActions', element.id)"><AppIcon name="more-vertical" :size="18" /></button>
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
              <span><strong>{{ reference.name }}</strong><small>{{ reference.locked ? 'Locked' : 'Unlocked' }} · {{ reference.view }}</small></span>
            </button>
            <button type="button" :aria-label="`${reference.locked ? 'Unlock' : 'Lock'} ${reference.name}`" @click="$emit('toggleReferenceLock', reference.id)">
              <AppIcon :name="reference.locked ? 'lock' : 'unlock'" :size="18" />
            </button>
            <button type="button" :aria-label="`${reference.visible ? 'Hide' : 'Show'} ${reference.name}`" @click="$emit('toggleReference', reference.id)">
              <AppIcon :name="reference.visible ? 'eye' : 'eye-off'" :size="18" />
            </button>
            <button type="button" aria-label="Edit reference" @click="$emit('editReference', reference.id)">
              <AppIcon name="sliders" :size="18" />
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
  justify-content: space-between;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
  color: var(--color-accent-strong);
}

.outliner section > header > span { display: flex; align-items: center; gap: var(--space-2); }

.new-group {
  min-height: var(--touch-target);
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border: 0;
  background: transparent;
  color: var(--color-accent-strong);
  font-size: 0.7rem;
  font-weight: 760;
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

.outliner-row--group { grid-template-columns: var(--touch-target) minmax(0, 1fr) repeat(3, var(--touch-target)); }
.outliner-row--child { margin-left: 1rem; grid-template-columns: minmax(0, 1fr) repeat(3, var(--touch-target)); border-left-color: var(--color-accent); }
.expand-icon--open { transform: rotate(90deg); }

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
