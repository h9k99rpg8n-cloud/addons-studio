<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import AppIcon from '@/components/common/AppIcon.vue'
import BottomSheet from '@/components/common/BottomSheet.vue'
import StudioIcon from '@/components/common/StudioIcon.vue'
import { getGroupChildren } from '@/core/model/modelHierarchy'
import { useLocaleStore } from '@/stores/locale'
import type { StudioCube, StudioGroup, StudioModel, StudioModelFolder } from '@/types/model'

type OutlinerRow =
  | { kind: 'folder'; id: string; depth: number; folder: StudioModelFolder }
  | { kind: 'group'; id: string; depth: number; group: StudioGroup }
  | { kind: 'cube'; id: string; depth: number; cube: StudioCube; group?: StudioGroup }

const props = defineProps<{
  open: boolean
  model: StudioModel
  selectedNodeId?: string
  selectedNodeIds?: string[]
  multiSelect?: boolean
  isolationActive?: boolean
}>()

defineEmits<{
  close: []
  selectNode: [id: string, additive?: boolean]
  createGroup: []
  createFolder: [parentId?: string]
  renameFolder: [id: string]
  deleteFolder: [id: string]
  showActions: [id: string]
  toggleElement: [id: string]
  toggleGroup: [id: string]
  toggleNodeLock: [id: string]
  setMultiSelect: [enabled: boolean]
  exitIsolation: []
}>()

const locale = useLocaleStore()
const expanded = ref(new Set<string>())

watch(
  () => [...props.model.groups.map((group) => group.id), ...props.model.folders.map((folder) => folder.id)],
  (ids) => {
    const available = new Set(ids)
    expanded.value = new Set([...expanded.value].filter((id) => available.has(id)))
  },
  { immediate: true },
)

function toggleExpanded(id: string): void {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}

function appendGroup(rows: OutlinerRow[], group: StudioGroup, depth: number): void {
  rows.push({ kind: 'group', id: group.id, depth, group })
  if (expanded.value.has(group.id)) {
    getGroupChildren(props.model, group.id).forEach((cube) =>
      rows.push({ kind: 'cube', id: cube.id, depth: depth + 1, cube, group }),
    )
  }
}

function appendFolder(rows: OutlinerRow[], folder: StudioModelFolder, depth: number): void {
  rows.push({ kind: 'folder', id: folder.id, depth, folder })
  if (!expanded.value.has(folder.id)) return
  props.model.groups.filter((group) => group.folderId === folder.id).forEach((group) => appendGroup(rows, group, depth + 1))
  props.model.elements.filter((cube) => cube.folderId === folder.id && !cube.parentId).forEach((cube) => rows.push({ kind: 'cube', id: cube.id, depth: depth + 1, cube }))
  props.model.folders.filter((entry) => entry.parentId === folder.id).forEach((entry) => appendFolder(rows, entry, depth + 1))
}

const rows = computed(() => {
  const entries: OutlinerRow[] = []
  props.model.folders.filter((folder) => !folder.parentId).forEach((folder) => appendFolder(entries, folder, 0))
  props.model.groups.filter((group) => !group.folderId).forEach((group) => appendGroup(entries, group, 0))
  props.model.elements.filter((cube) => !cube.parentId && !cube.folderId).forEach((cube) => entries.push({ kind: 'cube', id: cube.id, depth: 0, cube }))
  return entries
})

function isSelected(id: string): boolean {
  return props.selectedNodeIds?.includes(id) ?? props.selectedNodeId === id
}

function folderSummary(folder: StudioModelFolder): string {
  const cubes = props.model.elements.filter((cube) => cube.folderId === folder.id && !cube.parentId).length
  const groups = props.model.groups.filter((group) => group.folderId === folder.id).length
  const children = props.model.folders.filter((entry) => entry.parentId === folder.id).length
  return `${cubes} ${locale.t('cubes')} · ${groups} ${locale.t('groups')}${children ? ` · ${children} ${locale.t('folder')}` : ''}`
}

function status(visible: boolean, locked: boolean, context: string): string {
  return [context, locale.t(visible ? 'Visible' : 'Hidden'), locale.t(locked ? 'Locked' : 'Unlocked')].join(' · ')
}
</script>

<template>
  <BottomSheet :open="open" :title="locale.t('Outliner')" :description="`${model.folders.length} ${locale.t('folders')} · ${model.groups.length} ${locale.t('groups')} · ${model.elements.length} ${locale.t('cubes')}`" @close="$emit('close')">
    <div class="outliner">
      <header class="outliner-header">
        <span><StudioIcon name="model" :size="19" /><strong>{{ locale.t('Model Studio') }}</strong></span>
        <div>
          <button type="button" :class="{ active: multiSelect }" :aria-pressed="multiSelect" @click="$emit('setMultiSelect', !multiSelect)"><AppIcon name="check" :size="18" />{{ multiSelect ? locale.t('Done') : locale.t('Multi-select') }}</button>
          <button type="button" @click="$emit('createGroup')"><AppIcon name="boxes" :size="18" />{{ selectedNodeIds && selectedNodeIds.length >= 2 ? locale.t('Create Group') : locale.t('New Group') }}</button>
          <button type="button" @click="$emit('createFolder')"><AppIcon name="folder-plus" :size="18" />{{ locale.t('Folder') }}</button>
        </div>
      </header>

      <button v-if="isolationActive" type="button" class="isolation-banner" @click="$emit('exitIsolation')"><AppIcon name="eye" :size="18" />{{ locale.t('Exit Isolation / Show All') }}</button>

      <div v-if="rows.length" class="outliner-list">
        <article v-for="row in rows" :key="row.id" class="outliner-row" :class="[`outliner-row--${row.kind}`, { 'outliner-row--selected': row.kind !== 'folder' && isSelected(row.id), 'outliner-row--locked': row.kind === 'group' ? row.group.locked : row.kind === 'cube' ? row.cube.locked || row.group?.locked : false, 'outliner-row--hidden': row.kind === 'group' ? !row.group.visible : row.kind === 'cube' ? !row.cube.visible || row.group?.visible === false : false }]" :style="{ '--row-depth': row.depth }">
          <template v-if="row.kind === 'folder'">
            <button type="button" :aria-label="`${expanded.has(row.id) ? 'Collapse' : 'Expand'} ${row.folder.name}`" @click="toggleExpanded(row.id)"><AppIcon name="chevron-right" :size="19" :class="{ 'expand-icon--open': expanded.has(row.id) }" /></button>
            <button type="button" class="outliner-row__select" @click="toggleExpanded(row.id)"><AppIcon name="folder-open" :size="20" /><span><strong>{{ row.folder.name }}</strong><small>{{ folderSummary(row.folder) }} · {{ locale.t('Organization only') }}</small></span></button>
            <button type="button" :disabled="Boolean(row.folder.parentId) || model.folders.some((folder) => folder.parentId === row.id)" :aria-label="`Add child folder to ${row.folder.name}`" @click="$emit('createFolder', row.id)"><AppIcon name="folder-plus" :size="18" /></button>
            <button type="button" :aria-label="`Rename ${row.folder.name}`" @click="$emit('renameFolder', row.id)"><AppIcon name="pencil" :size="18" /></button>
            <button type="button" :aria-label="`Delete ${row.folder.name}`" @click="$emit('deleteFolder', row.id)"><AppIcon name="trash" :size="18" /></button>
          </template>

          <template v-else-if="row.kind === 'group'">
            <button type="button" :aria-label="`${expanded.has(row.id) ? 'Collapse' : 'Expand'} ${row.group.name}`" @click="toggleExpanded(row.id)"><AppIcon name="chevron-right" :size="19" :class="{ 'expand-icon--open': expanded.has(row.id) }" /></button>
            <button type="button" class="outliner-row__select" :aria-pressed="isSelected(row.id)" @click="$emit('selectNode', row.id, multiSelect)"><span v-if="multiSelect" class="selection-checkbox"><AppIcon v-if="isSelected(row.id)" name="check" :size="15" /></span><AppIcon v-else name="boxes" :size="20" /><span><strong>{{ row.group.name }}</strong><small>{{ status(row.group.visible, row.group.locked, `${getGroupChildren(model, row.id).length} ${locale.t('cubes')} · ${locale.t('Structural')}`) }}</small></span></button>
            <button type="button" :aria-label="`${row.group.locked ? 'Unlock' : 'Lock'} ${row.group.name}`" @click="$emit('toggleNodeLock', row.id)"><AppIcon :name="row.group.locked ? 'lock' : 'unlock'" :size="18" /></button>
            <button type="button" :aria-label="`${row.group.visible ? 'Hide' : 'Show'} ${row.group.name}`" @click="$emit('toggleGroup', row.id)"><AppIcon :name="row.group.visible ? 'eye' : 'eye-off'" :size="18" /></button>
            <button type="button" :aria-label="`${row.group.name} actions`" @click="$emit('showActions', row.id)"><AppIcon name="more-vertical" :size="18" /></button>
          </template>

          <template v-else>
            <button type="button" class="outliner-row__select" :aria-pressed="isSelected(row.id)" @click="$emit('selectNode', row.id, multiSelect)"><span v-if="multiSelect" class="selection-checkbox"><AppIcon v-if="isSelected(row.id)" name="check" :size="15" /></span><AppIcon v-else name="box" :size="20" /><span><strong>{{ row.cube.name }}</strong><small>{{ status(row.cube.visible && row.group?.visible !== false, row.cube.locked || row.group?.locked === true, row.group ? `${locale.t('Cube')} · ${row.group.name}` : locale.t('Cube')) }}</small></span></button>
            <button type="button" :aria-label="`${row.cube.locked ? 'Unlock' : 'Lock'} ${row.cube.name}`" @click="$emit('toggleNodeLock', row.id)"><AppIcon :name="row.cube.locked ? 'lock' : 'unlock'" :size="18" /></button>
            <button type="button" :aria-label="`${row.cube.visible ? 'Hide' : 'Show'} ${row.cube.name}`" @click="$emit('toggleElement', row.id)"><AppIcon :name="row.cube.visible ? 'eye' : 'eye-off'" :size="18" /></button>
            <button type="button" :aria-label="`${row.cube.name} actions`" @click="$emit('showActions', row.id)"><AppIcon name="more-vertical" :size="18" /></button>
          </template>
        </article>
      </div>
      <p v-else class="outliner-empty">{{ locale.t('No cubes yet. Use + Cube in the bottom toolbar.') }}</p>
    </div>
  </BottomSheet>
</template>

<style scoped>
.outliner { display: grid; gap: var(--space-3); padding-bottom: var(--space-2); }
.outliner-header { display: grid; gap: var(--space-2); }
.outliner-header > span, .outliner-header > div { display: flex; align-items: center; gap: var(--space-2); }
.outliner-header > span { color: var(--color-accent-strong); }
.outliner-header > div { overflow-x: auto; }
.outliner-header button { min-height: var(--touch-target); display: inline-flex; align-items: center; gap: 0.35rem; flex: 0 0 auto; border: 0; border-radius: var(--radius-md); padding: 0 0.55rem; background: transparent; color: var(--color-accent-strong); font-size: 0.7rem; font-weight: 760; }
.outliner-header button.active { background: var(--color-accent-soft); }
.isolation-banner { width: 100%; min-height: var(--touch-target); display: flex; align-items: center; justify-content: center; gap: var(--space-2); border: 1px solid #6f5a1d; border-radius: var(--radius-lg); background: #29230f; color: #f2d570; font-size: 0.74rem; font-weight: 780; }
.outliner-list { display: grid; gap: 0.38rem; }
.outliner-row { min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr) repeat(3, var(--touch-target)); align-items: center; margin-left: calc(var(--row-depth) * 0.85rem); border: 1px solid var(--color-border); border-radius: var(--radius-lg); overflow: hidden; background: var(--color-surface-raised); }
.outliner-row--group, .outliner-row--folder { grid-template-columns: var(--touch-target) minmax(0, 1fr) repeat(3, var(--touch-target)); }
.outliner-row--folder { border-style: dashed; }
.outliner-row--group { border-left-color: var(--color-accent); }
.outliner-row--selected { border-color: var(--color-accent); box-shadow: inset 3px 0 var(--color-accent); }
.outliner-row--locked { border-style: dashed; }
.outliner-row--hidden { opacity: 0.62; }
.outliner-row button { min-width: var(--touch-target); min-height: var(--touch-target); display: grid; place-items: center; border: 0; background: transparent; color: var(--color-text-muted); }
.outliner-row button:disabled { opacity: 0.25; }
.outliner-row__select { grid-template-columns: auto minmax(0, 1fr) !important; justify-content: start !important; gap: var(--space-2); padding: 0.45rem 0.65rem; color: var(--color-text) !important; text-align: left; }
.outliner-row__select > span:last-child { min-width: 0; display: grid; gap: 0.12rem; }
.outliner-row__select strong, .outliner-row__select small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.outliner-row__select strong { font-size: 0.8rem; }
.outliner-row__select small { color: var(--color-text-subtle); font-size: 0.63rem; }
.selection-checkbox { width: 1.2rem; height: 1.2rem; display: grid; place-items: center; border: 1px solid var(--color-border-strong); border-radius: 0.32rem; background: var(--color-input-bg); }
.outliner-row--selected .selection-checkbox { border-color: var(--color-accent); background: var(--color-accent); color: #07100b; }
.expand-icon--open { transform: rotate(90deg); }
.outliner-empty { margin: 0; border: 1px dashed var(--color-border-strong); border-radius: var(--radius-lg); padding: var(--space-4); color: var(--color-text-subtle); font-size: 0.74rem; }
</style>
