<script setup lang="ts">
import { ref, watch } from 'vue'

import AppButton from '@/components/common/AppButton.vue'
import AppDialog from '@/components/common/AppDialog.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import BottomSheet from '@/components/common/BottomSheet.vue'
import { toAppError } from '@/core/errors/AppError'
import { useLocaleStore } from '@/stores/locale'
import { useProjectStore } from '@/stores/projects'
import { useToastStore } from '@/stores/toasts'
import type { StudioProjectFolder } from '@/types/project'

const props = defineProps<{
  folder?: StudioProjectFolder
  projectCount: number
  open: boolean
}>()

const emit = defineEmits<{
  close: []
  deleted: [folderId: string]
}>()

const projects = useProjectStore()
const toasts = useToastStore()
const locale = useLocaleStore()
const renameOpen = ref(false)
const deleteOpen = ref(false)
const renameValue = ref('')
const errorMessage = ref('')
const busy = ref(false)

watch(
  () => props.folder,
  (folder) => {
    renameValue.value = folder?.name ?? ''
  },
  { immediate: true },
)

function chooseRename(): void {
  emit('close')
  errorMessage.value = ''
  renameValue.value = props.folder?.name ?? ''
  renameOpen.value = true
}

function chooseDelete(): void {
  emit('close')
  deleteOpen.value = true
}

async function rename(): Promise<void> {
  if (!props.folder) return
  busy.value = true
  errorMessage.value = ''
  try {
    await projects.renameFolder(props.folder.id, renameValue.value)
    renameOpen.value = false
    toasts.push({ type: 'success', message: locale.t('Folder renamed') })
  } catch (error) {
    errorMessage.value = toAppError(error, 'Addons Studio could not rename this folder.').userMessage
  } finally {
    busy.value = false
  }
}

async function remove(): Promise<void> {
  if (!props.folder) return
  busy.value = true
  const id = props.folder.id
  try {
    const movedCount = await projects.deleteFolder(id)
    deleteOpen.value = false
    toasts.push({
      type: 'success',
      message:
        movedCount > 0
          ? locale.t(movedCount === 1
            ? 'Folder deleted. {count} project was moved to My Projects.'
            : 'Folder deleted. {count} projects were moved to My Projects.', { count: movedCount })
          : locale.t('Folder deleted'),
    })
    emit('deleted', id)
  } catch (error) {
    toasts.push({
      type: 'error',
      message: toAppError(error, 'Addons Studio could not delete this folder.').userMessage,
    })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <BottomSheet
    :open="open && Boolean(folder)"
    :title="folder?.name ?? locale.t('Folder actions')"
    :description="locale.t('Organize this local folder')"
    @close="$emit('close')"
  >
    <div class="folder-actions">
      <button type="button" @click="chooseRename">
        <span><AppIcon name="pencil" :size="21" /></span>
        <span><strong>{{ locale.t('Rename') }}</strong><small>{{ locale.t('Change the folder name') }}</small></span>
      </button>
      <button type="button" class="folder-actions__danger" @click="chooseDelete">
        <span><AppIcon name="trash" :size="21" /></span>
        <span><strong>{{ locale.t('Delete folder') }}</strong><small>{{ locale.t('Projects will be kept safely') }}</small></span>
      </button>
    </div>
  </BottomSheet>

  <AppDialog
    :open="renameOpen"
    :title="`${locale.t('Rename')} “${folder?.name ?? locale.t('folder')}”`"
    @close="renameOpen = false"
  >
    <label class="field-label" for="rename-folder">{{ locale.t('Folder Name') }}</label>
    <input
      id="rename-folder"
      v-model="renameValue"
      class="text-input"
      maxlength="60"
      autocomplete="off"
      @keydown.enter.prevent="rename"
    />
    <p v-if="errorMessage" class="field-error" role="alert">{{ errorMessage }}</p>
    <template #actions>
      <AppButton variant="ghost" @click="renameOpen = false">{{ locale.t('Cancel') }}</AppButton>
      <AppButton :loading="busy" @click="rename">{{ locale.t('Rename') }}</AppButton>
    </template>
  </AppDialog>

  <AppDialog
    :open="deleteOpen"
    :title="`${locale.t('Delete')} “${folder?.name ?? locale.t('folder')}”?`"
    :description="
      projectCount > 0
        ? locale.t(projectCount === 1 ? '{count} project will be moved to the root My Projects list. Nothing inside will be deleted.' : '{count} projects will be moved to the root My Projects list. Nothing inside will be deleted.', { count: projectCount })
        : locale.t('The empty folder will be removed. No projects will be deleted.')
    "
    @close="deleteOpen = false"
  >
    <div class="safe-delete-note">
      <AppIcon name="folder-output" :size="22" />
      <span>{{ locale.t('Delete only the folder; keep every project.') }}</span>
    </div>
    <template #actions>
      <AppButton variant="ghost" @click="deleteOpen = false">{{ locale.t('Cancel') }}</AppButton>
      <AppButton variant="danger" :loading="busy" @click="remove">{{ locale.t('Delete Folder') }}</AppButton>
    </template>
  </AppDialog>
</template>

<style scoped>
.folder-actions {
  display: grid;
  gap: 0.45rem;
}

.folder-actions button {
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

.folder-actions button:active {
  background: var(--color-surface-raised);
}

.folder-actions button > span:first-child {
  width: 2.75rem;
  height: 2.75rem;
  display: grid;
  place-items: center;
  border-radius: var(--radius-md);
  background: var(--color-surface-raised);
}

.folder-actions button > span:last-child {
  display: grid;
  gap: 0.17rem;
}

.folder-actions small {
  color: var(--color-text-subtle);
  font-size: 0.75rem;
}

.folder-actions__danger strong,
.folder-actions__danger > span:first-child {
  color: var(--color-danger);
}

.safe-delete-note {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  border: 1px solid var(--color-accent-border);
  border-radius: var(--radius-md);
  padding: 0.75rem;
  background: var(--color-accent-soft);
  color: var(--color-accent-strong);
  font-size: 0.82rem;
  font-weight: 650;
}
</style>
