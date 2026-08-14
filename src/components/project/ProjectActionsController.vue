<script setup lang="ts">
import { ref, watch } from 'vue'

import AppButton from '@/components/common/AppButton.vue'
import AppDialog from '@/components/common/AppDialog.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import BottomSheet from '@/components/common/BottomSheet.vue'
import { toAppError } from '@/core/errors/AppError'
import {
  projectPackageService,
  type ProjectPackageStage,
} from '@/core/project/projectPackageService'
import { useProjectStore } from '@/stores/projects'
import { useLocaleStore } from '@/stores/locale'
import { useToastStore } from '@/stores/toasts'
import type { StudioProject } from '@/types/project'
import { downloadBlob } from '@/utils/download'

const props = defineProps<{
  project?: StudioProject
  open: boolean
}>()

const emit = defineEmits<{
  close: []
  deleted: [projectId: string]
  duplicated: [project: StudioProject]
}>()

const projects = useProjectStore()
const toasts = useToastStore()
const locale = useLocaleStore()
const renameOpen = ref(false)
const deleteOpen = ref(false)
const moveOpen = ref(false)
const renameValue = ref('')
const renameError = ref('')
const busy = ref(false)
const exportProgressOpen = ref(false)
const exportStage = ref<ProjectPackageStage>('reading')
const exportStatus = ref<'working' | 'done' | 'error'>('working')
const exportError = ref('')

const packageStageLabels: Readonly<Record<ProjectPackageStage, string>> = {
  reading: 'Reading project',
  validating: 'Validating models',
  models: 'Packaging models',
  assets: 'Packaging editor assets',
  finishing: 'Creating package',
}

function packageStageLabel(stage: ProjectPackageStage): string {
  return locale.t(packageStageLabels[stage])
}

watch(
  () => props.project,
  (project) => {
    if (project) renameValue.value = project.name
  },
  { immediate: true },
)

function chooseRename(): void {
  emit('close')
  renameError.value = ''
  renameValue.value = props.project?.name ?? ''
  renameOpen.value = true
}

function chooseDelete(): void {
  emit('close')
  deleteOpen.value = true
}

function chooseMove(): void {
  emit('close')
  moveOpen.value = true
}

async function move(folderId?: string): Promise<void> {
  if (!props.project) return
  busy.value = true
  try {
    await projects.moveProjectToFolder(props.project.id, folderId)
    moveOpen.value = false
    const folder = projects.folders.find((entry) => entry.id === folderId)
    toasts.push({
      type: 'success',
      message: folder
        ? locale.t('Project moved to {name}', { name: folder.name })
        : locale.t('Project moved to My Projects'),
    })
  } catch (error) {
    toasts.push({
      type: 'error',
      message: toAppError(error, locale.t('Addons Studio could not move this project.')).userMessage,
    })
  } finally {
    busy.value = false
  }
}

async function rename(): Promise<void> {
  if (!props.project) return
  if (!renameValue.value.trim()) {
    renameError.value = locale.t('Project name is required.')
    return
  }

  busy.value = true
  renameError.value = ''
  try {
    await projects.renameProject(props.project.id, renameValue.value)
    renameOpen.value = false
    toasts.push({ type: 'success', message: locale.t('Project renamed') })
  } catch (error) {
    renameError.value = toAppError(error, locale.t('Addons Studio could not rename this project.')).userMessage
  } finally {
    busy.value = false
  }
}

async function duplicate(): Promise<void> {
  if (!props.project) return
  emit('close')
  busy.value = true
  try {
    const duplicateProject = await projects.duplicateProject(props.project.id)
    toasts.push({ type: 'success', message: locale.t('Project duplicated') })
    emit('duplicated', duplicateProject)
  } catch (error) {
    toasts.push({
      type: 'error',
      message: toAppError(error, locale.t('Addons Studio could not duplicate this project.')).userMessage,
    })
  } finally {
    busy.value = false
  }
}

async function exportProject(): Promise<void> {
  if (!props.project) return
  emit('close')
  exportProgressOpen.value = true
  exportStatus.value = 'working'
  exportStage.value = 'reading'
  exportError.value = ''
  try {
    await projects.flushPendingSaves()
    const result = await projectPackageService.exportProject(
      props.project.id,
      (stage) => { exportStage.value = stage },
    )
    downloadBlob(result.blob, result.filename)
    exportStatus.value = 'done'
    toasts.push({ type: 'success', message: locale.t('Project package exported') })
  } catch (error) {
    exportStatus.value = 'error'
    exportError.value = toAppError(error, locale.t('Addons Studio could not export this project.')).userMessage
  }
}

async function remove(): Promise<void> {
  if (!props.project) return
  busy.value = true
  const id = props.project.id
  try {
    await projects.deleteProject(id)
    deleteOpen.value = false
    toasts.push({ type: 'success', message: locale.t('Project deleted') })
    emit('deleted', id)
  } catch (error) {
    toasts.push({
      type: 'error',
      message: toAppError(error, locale.t('Addons Studio could not delete this project.')).userMessage,
    })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <BottomSheet
    :open="open && Boolean(project)"
    :title="project?.name ?? locale.t('Project actions')"
    :description="locale.t('Manage this local project')"
    @close="$emit('close')"
  >
    <div class="action-list">
      <button type="button" @click="chooseRename">
        <span><AppIcon name="pencil" :size="21" /></span>
        <span><strong>{{ locale.t('Rename') }}</strong><small>{{ locale.t('Change the project name') }}</small></span>
      </button>
      <button type="button" :disabled="busy" @click="duplicate">
        <span><AppIcon name="copy" :size="21" /></span>
        <span><strong>{{ locale.t('Duplicate') }}</strong><small>{{ locale.t('Create an independent local copy') }}</small></span>
      </button>
      <button type="button" :disabled="busy" @click="chooseMove">
        <span><AppIcon name="folder-output" :size="21" /></span>
        <span><strong>{{ locale.t('Move to Folder') }}</strong><small>{{ locale.t('Choose a folder or the root list') }}</small></span>
      </button>
      <button type="button" :disabled="busy" @click="exportProject">
        <span><AppIcon name="download" :size="21" /></span>
        <span><strong>{{ locale.t('Export Project (Beta)') }}</strong><small>{{ locale.t('Versioned package with models and editor assets') }}</small></span>
      </button>
      <button type="button" class="action-list__danger" @click="chooseDelete">
        <span><AppIcon name="trash" :size="21" /></span>
        <span><strong>{{ locale.t('Delete') }}</strong><small>{{ locale.t('Remove the project from this device') }}</small></span>
      </button>
    </div>
  </BottomSheet>

  <BottomSheet
    :open="exportProgressOpen"
    :title="locale.t(exportStatus === 'working' ? 'Exporting Project' : exportStatus === 'done' ? 'Project exported' : 'Export stopped safely')"
    :description="exportStatus === 'working' ? packageStageLabel(exportStage) : undefined"
    @close="exportStatus === 'working' ? undefined : (exportProgressOpen = false)"
  >
    <div class="export-progress" :class="`export-progress--${exportStatus}`" aria-live="polite">
      <span v-if="exportStatus === 'working'" class="export-spinner" />
      <span v-else><AppIcon :name="exportStatus === 'done' ? 'check' : 'alert-triangle'" :size="29" /></span>
      <strong>{{ exportStatus === 'working' ? packageStageLabel(exportStage) : exportStatus === 'done' ? locale.t('{name} is ready', { name: project?.name ?? locale.t('Project') }) : locale.t('No project data was changed') }}</strong>
      <p>{{ exportStatus === 'working' ? locale.t('Keep Addons Studio open while the package is prepared.') : exportStatus === 'done' ? locale.t('The .addonsstudio download contains a validated, restorable local project package.') : exportError }}</p>
      <AppButton v-if="exportStatus !== 'working'" block variant="secondary" @click="exportProgressOpen = false">{{ locale.t('Close') }}</AppButton>
    </div>
  </BottomSheet>

  <BottomSheet
    :open="moveOpen && Boolean(project)"
    :title="locale.t('Move Project')"
    :description="locale.t('Choose where to keep “{name}”.', { name: project?.name ?? locale.t('project') })"
    @close="moveOpen = false"
  >
    <div class="move-list">
      <button
        type="button"
        :class="{ 'move-list__current': !project?.folderId }"
        :disabled="busy || !project?.folderId"
        @click="move(undefined)"
      >
        <span><AppIcon name="layers" :size="21" /></span>
        <span><strong>{{ locale.t('My Projects') }}</strong><small>{{ locale.t('Root project list') }}</small></span>
        <AppIcon v-if="!project?.folderId" name="check" :size="19" />
      </button>
      <button
        v-for="folder in projects.folders"
        :key="folder.id"
        type="button"
        :class="{ 'move-list__current': project?.folderId === folder.id }"
        :disabled="busy || project?.folderId === folder.id"
        @click="move(folder.id)"
      >
        <span><AppIcon name="folder-open" :size="21" /></span>
        <span><strong>{{ folder.name }}</strong><small>{{ locale.t('Project folder') }}</small></span>
        <AppIcon v-if="project?.folderId === folder.id" name="check" :size="19" />
      </button>
    </div>
    <p v-if="!projects.folders.length" class="move-empty">
      {{ locale.t('Create a folder from My Projects first. This project is already at the root.') }}
    </p>
  </BottomSheet>

  <AppDialog
    :open="renameOpen"
    :title="locale.t('Rename “{name}”', { name: project?.name ?? locale.t('project') })"
    @close="renameOpen = false"
  >
    <label class="field-label" for="rename-project">{{ locale.t('Project Name') }}</label>
    <input
      id="rename-project"
      v-model="renameValue"
      class="text-input"
      maxlength="80"
      autocomplete="off"
      @keydown.enter.prevent="rename"
    />
    <p v-if="renameError" class="field-error" role="alert">{{ renameError }}</p>
    <template #actions>
      <AppButton variant="ghost" @click="renameOpen = false">{{ locale.t('Cancel') }}</AppButton>
      <AppButton :loading="busy" @click="rename">{{ locale.t('Rename') }}</AppButton>
    </template>
  </AppDialog>

  <AppDialog
    :open="deleteOpen"
    :title="locale.t('Delete “{name}”?', { name: project?.name ?? locale.t('project') })"
    :description="locale.t('This cannot be undone. Project data, models, references, and local recovery snapshots will be removed.')"
    @close="deleteOpen = false"
  >
    <div class="delete-warning">
      <AppIcon name="alert-triangle" :size="22" />
      <span>{{ locale.t('This action only affects this device.') }}</span>
    </div>
    <template #actions>
      <AppButton variant="ghost" @click="deleteOpen = false">{{ locale.t('Cancel') }}</AppButton>
      <AppButton variant="danger" :loading="busy" @click="remove">{{ locale.t('Delete') }}</AppButton>
    </template>
  </AppDialog>
</template>

<style scoped>
.action-list {
  display: grid;
  gap: 0.45rem;
}

.action-list button {
  min-height: 4rem;
  display: grid;
  grid-template-columns: 2.75rem minmax(0, 1fr);
  align-items: center;
  gap: 0.75rem;
  border: 0;
  border-radius: var(--radius-lg);
  padding: 0.55rem 0.65rem;
  background: transparent;
  color: var(--color-text);
  text-align: left;
}

.action-list button:active {
  background: var(--color-surface-raised);
}

.action-list button > span:first-child {
  width: 2.75rem;
  height: 2.75rem;
  display: grid;
  place-items: center;
  border-radius: var(--radius-md);
  background: var(--color-surface-raised);
  color: var(--color-text-muted);
}

.action-list button > span:last-child {
  min-width: 0;
  display: grid;
  gap: 0.17rem;
}

.action-list strong {
  font-size: 0.94rem;
}

.action-list small {
  color: var(--color-text-subtle);
  font-size: 0.75rem;
}

.action-list__danger strong,
.action-list__danger > span:first-child {
  color: var(--color-danger);
}

.delete-warning {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  border: 1px solid var(--color-warning-border);
  border-radius: var(--radius-md);
  padding: 0.75rem;
  background: var(--color-warning-soft);
  color: var(--color-warning-text);
  font-size: 0.82rem;
  font-weight: 650;
}

.move-list {
  display: grid;
  gap: 0.45rem;
}

.export-progress { display: grid; justify-items: center; gap: var(--space-3); padding: var(--space-2) 0; text-align: center; }
.export-progress > span { width: 4rem; height: 4rem; display: grid; place-items: center; border-radius: var(--radius-xl); background: var(--color-accent-soft); color: var(--color-accent-strong); }
.export-progress p { max-width: 28rem; margin: 0; color: var(--color-text-muted); font-size: 0.8rem; line-height: 1.5; }
.export-progress--error > span { background: var(--color-danger-soft); color: var(--color-danger); }
.export-spinner { width: 1.5rem !important; height: 1.5rem !important; border: 3px solid currentColor; border-right-color: transparent; border-radius: 50% !important; background: transparent !important; animation: spin 0.75s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.move-list button {
  min-height: 4rem;
  display: grid;
  grid-template-columns: 2.75rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 0.55rem 0.65rem;
  background: var(--color-surface-raised);
  color: var(--color-text);
  text-align: left;
}

.move-list button > span:first-child {
  width: 2.75rem;
  height: 2.75rem;
  display: grid;
  place-items: center;
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-accent-strong);
}

.move-list button > span:nth-child(2) {
  min-width: 0;
  display: grid;
  gap: 0.17rem;
}

.move-list small {
  color: var(--color-text-subtle);
  font-size: 0.72rem;
}

.move-list__current {
  border-color: var(--color-accent);
  background: var(--color-accent-soft) !important;
}

.move-empty {
  margin: 0.8rem 0 0;
  color: var(--color-text-subtle);
  font-size: 0.75rem;
  line-height: 1.45;
}
</style>
