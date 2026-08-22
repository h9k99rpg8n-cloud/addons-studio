<script setup lang="ts">
import { computed, ref } from 'vue'

import AppButton from '@/components/common/AppButton.vue'
import AppDialog from '@/components/common/AppDialog.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import StudioPageHeader from '@/components/common/StudioPageHeader.vue'
import { useProjectContext } from '@/composables/useProjectContext'
import { toAppError } from '@/core/errors/AppError'
import {
  BLOCKBENCH_WEB_URL,
  buildBlockbenchUrl,
  createStarterBedrockModel,
  inspectModelFile,
  modelPayload,
  safeModelFilename,
} from '@/core/integrations/blockbenchIntegration'
import { resourceRepository } from '@/core/resources/resourceRepository'
import { useLocaleStore } from '@/stores/locale'
import { useToastStore } from '@/stores/toasts'
import type { ModelResourcePayload, StudioResource, StudioResourceFolder } from '@/types/resource'
import { downloadBlob } from '@/utils/download'

const props = defineProps<{ projectId: string }>()
const locale = useLocaleStore()
const toasts = useToastStore()
const { project, loading: projectLoading, error: projectError } = useProjectContext(() => props.projectId)

const models = ref<StudioResource<ModelResourcePayload>[]>([])
const folders = ref<StudioResourceFolder[]>([])
const query = ref('')
const folderFilter = ref('root')
const busy = ref(false)
const loadError = ref('')
const createOpen = ref(false)
const folderOpen = ref(false)
const folderActionsOpen = ref(false)
const actionsOpen = ref(false)
const importInput = ref<HTMLInputElement>()
const modelName = ref('New Model')
const identifier = ref('')
const folderName = ref('')
const selected = ref<StudioResource<ModelResourcePayload>>()
const editName = ref('')
const editFolder = ref('')
const editFolderName = ref('')
const activeFolder = computed(() => folders.value.find((folder) => folder.id === folderFilter.value))

const filteredModels = computed(() => {
  const needle = query.value.trim().toLowerCase()
  return models.value.filter((model) => {
    const inFolder = folderFilter.value === 'all'
      || (folderFilter.value === 'root' ? !model.folderId : model.folderId === folderFilter.value)
    const matches = !needle || `${model.name} ${model.identifier ?? ''} ${model.payload.originalFilename}`.toLowerCase().includes(needle)
    return inFolder && matches
  })
})

async function loadLibrary(): Promise<void> {
  try {
    ;[models.value, folders.value] = await Promise.all([
      resourceRepository.list<ModelResourcePayload>(props.projectId, 'model'),
      resourceRepository.listFolders(props.projectId, 'model'),
    ])
  } catch (error) {
    loadError.value = toAppError(error, locale.t('Addons Studio could not load Models.')).userMessage
  }
}

void loadLibrary()

function openCreate(): void {
  modelName.value = locale.t('New Model')
  const safe = `model_${models.value.length + 1}`
  identifier.value = `geometry.${project.value?.namespace ?? 'addons_studio'}.${safe}`
  createOpen.value = true
}

async function persistModelFile(input: { name: string; identifier?: string; inspection: Awaited<ReturnType<typeof inspectModelFile>> | ReturnType<typeof createStarterBedrockModel>; filename: string }): Promise<StudioResource<ModelResourcePayload>> {
  const normalizedFile = new File([input.inspection.text], input.filename, { type: 'application/json' })
  const asset = await resourceRepository.addAsset({ projectId: props.projectId, kind: 'model', file: normalizedFile })
  try {
    const resource = await resourceRepository.create<ModelResourcePayload>({
      projectId: props.projectId,
      type: 'model',
      name: input.name,
      identifier: input.identifier,
      payload: modelPayload(input.inspection, asset.id, input.filename),
    })
    await resourceRepository.attachAsset(asset.id, resource.id)
    models.value.unshift(resource)
    return resource
  } catch (error) {
    await resourceRepository.deleteAsset(asset.id)
    throw error
  }
}

async function createModel(): Promise<void> {
  if (!/^geometry\.[a-z0-9_]+(?:\.[a-z0-9_]+)+$/.test(identifier.value)) {
    toasts.push({ type: 'warning', message: locale.t('Use a geometry identifier such as geometry.namespace.model_name.') })
    return
  }
  const popup = window.open('about:blank', '_blank')
  if (popup) popup.opener = null
  busy.value = true
  try {
    const inspection = createStarterBedrockModel({ name: modelName.value, identifier: identifier.value })
    const filename = safeModelFilename(modelName.value, inspection.format)
    await persistModelFile({ name: modelName.value, identifier: identifier.value, inspection, filename })
    const url = buildBlockbenchUrl(filename, inspection.text)
    if (popup && url) popup.location.replace(url)
    else {
      popup?.close()
      downloadBlob(new Blob([inspection.text], { type: 'application/json' }), filename)
      window.open(BLOCKBENCH_WEB_URL, '_blank', 'noopener,noreferrer')
    }
    createOpen.value = false
    toasts.push({ type: 'success', message: locale.t('Model created and prepared for Blockbench.') })
  } catch (error) {
    popup?.close()
    toasts.push({ type: 'error', message: toAppError(error, locale.t('Addons Studio could not create this model.')).userMessage })
  } finally {
    busy.value = false
  }
}

async function importModels(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const files = [...(input.files ?? [])]
  if (!files.length) return
  busy.value = true
  let imported = 0
  for (const file of files) {
    try {
      const inspection = await inspectModelFile(file)
      const filename = safeModelFilename(inspection.name, inspection.format)
      await persistModelFile({ name: inspection.name, identifier: inspection.identifier, inspection, filename })
      imported += 1
    } catch (error) {
      toasts.push({ type: 'error', message: `${file.name}: ${toAppError(error, locale.t('Model import failed.')).userMessage}` })
    }
  }
  if (imported) toasts.push({ type: 'success', message: locale.t('{count} model files imported.', { count: imported }) })
  input.value = ''
  busy.value = false
}

async function openInBlockbench(model: StudioResource<ModelResourcePayload>): Promise<void> {
  const popup = window.open('about:blank', '_blank')
  if (popup) popup.opener = null
  try {
    const asset = await resourceRepository.getAsset(model.payload.assetId)
    if (!asset) throw new Error('Missing model asset')
    const text = await asset.blob.text()
    const url = buildBlockbenchUrl(model.payload.originalFilename, text)
    if (popup && url) {
      popup.location.replace(url)
      return
    }
    if (popup) popup.location.replace(BLOCKBENCH_WEB_URL)
    else window.open(BLOCKBENCH_WEB_URL, '_blank', 'noopener,noreferrer')
    downloadBlob(asset.blob, model.payload.originalFilename)
    toasts.push({ type: 'info', message: locale.t('The model was downloaded. Import it from Blockbench’s File menu.') })
  } catch (error) {
    popup?.close()
    toasts.push({ type: 'error', message: toAppError(error, locale.t('Addons Studio could not open this model.')).userMessage })
  }
}

async function downloadModel(model: StudioResource<ModelResourcePayload>): Promise<void> {
  const asset = await resourceRepository.getAsset(model.payload.assetId)
  if (!asset) return
  downloadBlob(asset.blob, model.payload.originalFilename)
}

function openActions(model: StudioResource<ModelResourcePayload>): void {
  selected.value = model
  editName.value = model.name
  editFolder.value = model.folderId ?? ''
  actionsOpen.value = true
}

async function saveActions(): Promise<void> {
  if (!selected.value) return
  const updated = await resourceRepository.update<ModelResourcePayload>(selected.value.id, {
    name: editName.value,
    folderId: editFolder.value || undefined,
  })
  models.value = models.value.map((model) => model.id === updated.id ? updated : model)
  actionsOpen.value = false
}

async function deleteSelected(): Promise<void> {
  if (!selected.value) return
  await resourceRepository.delete(selected.value.id)
  models.value = models.value.filter((model) => model.id !== selected.value?.id)
  actionsOpen.value = false
  toasts.push({ type: 'success', message: locale.t('Model removed from this project library.') })
}

async function createFolder(): Promise<void> {
  try {
    const folder = await resourceRepository.createFolder({ projectId: props.projectId, resourceType: 'model', name: folderName.value })
    folders.value.push(folder)
    folderName.value = ''
    folderOpen.value = false
  } catch (error) {
    toasts.push({ type: 'error', message: toAppError(error, locale.t('Addons Studio could not create this folder.')).userMessage })
  }
}

function openFolderActions(): void {
  if (!activeFolder.value) return
  editFolderName.value = activeFolder.value.name
  folderActionsOpen.value = true
}

async function renameActiveFolder(): Promise<void> {
  if (!activeFolder.value) return
  const updated = await resourceRepository.renameFolder(activeFolder.value.id, editFolderName.value)
  folders.value = folders.value.map((folder) => folder.id === updated.id ? updated : folder)
  folderActionsOpen.value = false
}

async function deleteActiveFolder(): Promise<void> {
  if (!activeFolder.value) return
  const id = activeFolder.value.id
  await resourceRepository.deleteFolder(id)
  folders.value = folders.value.filter((folder) => folder.id !== id && folder.parentId !== id)
  models.value = models.value.map((model) => model.folderId === id
    ? { ...model, folderId: undefined }
    : model)
  folderFilter.value = 'root'
  folderActionsOpen.value = false
}
</script>

<template>
  <main class="models-view">
    <StudioPageHeader
      :title="locale.t('Models')"
      :subtitle="project?.name"
      :eyebrow="locale.t('Blockbench model library')"
      icon="cuboid"
    >
      <template #actions>
        <button class="header-action" type="button" :aria-label="locale.t('Import model')" @click="importInput?.click()"><AppIcon name="upload" :size="21" /></button>
        <button class="header-action header-action--primary" type="button" :aria-label="locale.t('Create Model')" @click="openCreate"><AppIcon name="plus" :size="21" /></button>
      </template>
    </StudioPageHeader>

    <div class="models-body">
      <section v-if="projectLoading" class="state">{{ locale.t('Opening project') }}</section>
      <section v-else-if="projectError || loadError || !project" class="state state--error">{{ projectError || loadError }}</section>
      <template v-else>
        <section class="integration-banner">
          <div><span><AppIcon name="cuboid" :size="26" /></span><div><strong>Blockbench</strong><p>{{ locale.t('Addons Studio stores and organizes your model files. Blockbench handles modeling, UV, textures, and animation.') }}</p></div></div>
          <a :href="BLOCKBENCH_WEB_URL" target="_blank" rel="noopener noreferrer">{{ locale.t('Open Blockbench') }} <AppIcon name="external-link" :size="16" /></a>
        </section>

        <div class="library-tools">
          <label class="search"><AppIcon name="search" :size="19" /><input v-model="query" type="search" :placeholder="locale.t('Search models')" /></label>
          <button type="button" @click="folderOpen = true"><AppIcon name="folder-plus" :size="19" />{{ locale.t('Folder') }}</button>
          <button v-if="activeFolder" type="button" :aria-label="locale.t('Folder actions')" @click="openFolderActions"><AppIcon name="more-vertical" :size="19" /></button>
        </div>

        <div v-if="folders.length" class="folder-tabs" role="list">
          <button type="button" :class="{ active: folderFilter === 'root' }" @click="folderFilter = 'root'">{{ locale.t('Root') }}</button>
          <button type="button" :class="{ active: folderFilter === 'all' }" @click="folderFilter = 'all'">{{ locale.t('All') }}</button>
          <button v-for="folder in folders" :key="folder.id" type="button" :class="{ active: folderFilter === folder.id }" @click="folderFilter = folder.id">{{ folder.name }}</button>
        </div>

        <section v-if="filteredModels.length" class="model-grid">
          <article v-for="model in filteredModels" :key="model.id" class="model-card">
            <div class="model-card__preview"><AppIcon name="cuboid" :size="36" /><span>{{ model.payload.format === 'bbmodel' ? 'BB' : 'GEO' }}</span></div>
            <div class="model-card__copy"><strong>{{ model.name }}</strong><code>{{ model.identifier || model.payload.originalFilename }}</code><small>{{ model.payload.cubeCount ?? '—' }} {{ locale.t('cubes') }} · {{ model.payload.boneCount ?? '—' }} {{ locale.t('bones') }}</small></div>
            <button type="button" class="model-card__open" @click="openInBlockbench(model)">{{ locale.t('Edit in Blockbench') }}</button>
            <button type="button" class="model-card__menu" :aria-label="locale.t('Model actions')" @click="openActions(model)"><AppIcon name="more-vertical" :size="20" /></button>
          </article>
        </section>
        <section v-else class="empty">
          <span><AppIcon name="cuboid" :size="34" /></span><h2>{{ locale.t('No models here') }}</h2><p>{{ locale.t('Create a prepared Bedrock cube or import .json, .geo.json, or .bbmodel.') }}</p><AppButton size="large" @click="openCreate">{{ locale.t('Create Model') }}</AppButton>
        </section>
      </template>
    </div>

    <input ref="importInput" class="visually-hidden" type="file" multiple accept=".json,.geo.json,.bbmodel,application/json" @change="importModels" />

    <AppDialog :open="createOpen" :title="locale.t('Create Model in Blockbench')" :description="locale.t('A 16×16×16 Bedrock cube will be stored locally and opened in Blockbench.')" @close="createOpen = false">
      <label class="field">{{ locale.t('Model Name') }}<input v-model="modelName" maxlength="80" /></label>
      <label class="field">{{ locale.t('Identifier') }}<input v-model="identifier" autocapitalize="off" spellcheck="false" /></label>
      <template #actions><AppButton variant="ghost" @click="createOpen = false">{{ locale.t('Cancel') }}</AppButton><AppButton :loading="busy" @click="createModel">{{ locale.t('Create & Open') }}</AppButton></template>
    </AppDialog>

    <AppDialog :open="folderOpen" :title="locale.t('New Model Folder')" @close="folderOpen = false">
      <label class="field">{{ locale.t('Folder Name') }}<input v-model="folderName" maxlength="80" @keydown.enter.prevent="createFolder" /></label>
      <template #actions><AppButton variant="ghost" @click="folderOpen = false">{{ locale.t('Cancel') }}</AppButton><AppButton @click="createFolder">{{ locale.t('Create Folder') }}</AppButton></template>
    </AppDialog>

    <AppDialog :open="actionsOpen" :title="locale.t('Model actions')" @close="actionsOpen = false">
      <label class="field">{{ locale.t('Name') }}<input v-model="editName" maxlength="80" /></label>
      <label class="field">{{ locale.t('Folder') }}<select v-model="editFolder"><option value="">{{ locale.t('Root') }}</option><option v-for="folder in folders" :key="folder.id" :value="folder.id">{{ folder.name }}</option></select></label>
      <div class="dialog-actions-list"><button type="button" @click="selected && downloadModel(selected)"><AppIcon name="download" :size="19" />{{ locale.t('Download file') }}</button><button type="button" class="danger" @click="deleteSelected"><AppIcon name="trash" :size="19" />{{ locale.t('Delete') }}</button></div>
      <template #actions><AppButton variant="ghost" @click="actionsOpen = false">{{ locale.t('Cancel') }}</AppButton><AppButton @click="saveActions">{{ locale.t('Save') }}</AppButton></template>
    </AppDialog>

    <AppDialog :open="folderActionsOpen" :title="locale.t('Folder actions')" @close="folderActionsOpen = false">
      <label class="field">{{ locale.t('Folder Name') }}<input v-model="editFolderName" maxlength="80" /></label>
      <div class="dialog-actions-list"><button type="button" class="danger" @click="deleteActiveFolder"><AppIcon name="trash" :size="19" />{{ locale.t('Delete folder and move contents to Root') }}</button></div>
      <template #actions><AppButton variant="ghost" @click="folderActionsOpen = false">{{ locale.t('Cancel') }}</AppButton><AppButton @click="renameActiveFolder">{{ locale.t('Save') }}</AppButton></template>
    </AppDialog>
  </main>
</template>

<style scoped>
.models-body{width:min(100%,var(--content-max));margin:0 auto;padding:1rem max(var(--page-gutter),env(safe-area-inset-right)) 2rem max(var(--page-gutter),env(safe-area-inset-left))}.header-action{width:44px;height:44px;display:grid;place-items:center;border:1px solid var(--color-border);border-radius:var(--radius-md);background:var(--color-surface);color:var(--color-text)}.header-action--primary{border-color:var(--color-accent);background:var(--color-accent);color:var(--color-on-accent)}.state{min-height:50dvh;display:grid;place-items:center;color:var(--color-text-subtle);text-align:center}.state--error{color:var(--color-danger)}.integration-banner{display:grid;gap:.75rem;border:1px solid var(--color-border);border-radius:var(--radius-xl);padding:1rem;background:var(--color-surface)}.integration-banner>div{display:grid;grid-template-columns:auto minmax(0,1fr);gap:.75rem}.integration-banner>div>span{width:3rem;height:3rem;display:grid;place-items:center;border-radius:var(--radius-lg);background:#1f232a;color:#a8abb4}.integration-banner strong{font-size:.9rem}.integration-banner p{margin:.2rem 0 0;color:var(--color-text-subtle);font-size:.68rem;line-height:1.45}.integration-banner>a{min-height:44px;display:flex;align-items:center;justify-content:center;gap:.4rem;border-radius:var(--radius-md);background:var(--color-surface-raised);color:var(--color-text);font-size:.72rem;font-weight:800;text-decoration:none}.library-tools{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:.55rem;margin:1rem 0 .75rem}.search{min-height:44px;display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:.55rem;border:1px solid var(--color-border);border-radius:var(--radius-md);padding:0 .75rem;background:var(--color-input-bg);color:var(--color-text-subtle)}.search input{min-width:0;border:0;outline:0;background:transparent;color:var(--color-text);font:inherit;font-size:16px}.library-tools>button{min-height:44px;display:flex;align-items:center;gap:.4rem;border:1px solid var(--color-border);border-radius:var(--radius-md);padding:0 .75rem;background:var(--color-surface);color:var(--color-text);font-size:.68rem;font-weight:800}.folder-tabs{display:flex;gap:.4rem;overflow-x:auto;margin-bottom:.8rem;padding-bottom:.15rem;scrollbar-width:none}.folder-tabs button{flex:none;min-height:40px;border:1px solid var(--color-border);border-radius:var(--radius-pill);padding:0 .75rem;background:var(--color-surface);color:var(--color-text-subtle);font-size:.65rem;font-weight:750}.folder-tabs button.active{border-color:var(--color-accent);background:var(--color-accent-soft);color:var(--color-accent-strong)}.model-grid{display:grid;gap:.7rem}.model-card{position:relative;min-width:0;display:grid;grid-template-columns:4.6rem minmax(0,1fr) 44px;gap:.7rem;border:1px solid var(--color-border);border-radius:var(--radius-xl);padding:.75rem;background:var(--color-surface);box-shadow:var(--shadow-card)}.model-card__preview{position:relative;grid-row:1/3;width:4.6rem;height:4.6rem;display:grid;place-items:center;border-radius:var(--radius-lg);background:var(--color-surface-raised);color:var(--color-accent)}.model-card__preview span{position:absolute;right:.3rem;bottom:.25rem;color:var(--color-text-subtle);font-family:var(--font-mono);font-size:.5rem;font-weight:900}.model-card__copy{min-width:0;display:grid;align-content:center;gap:.16rem}.model-card__copy strong,.model-card__copy code{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.model-card__copy strong{font-size:.82rem}.model-card__copy code{color:var(--color-text-subtle);font-size:.58rem}.model-card__copy small{color:var(--color-text-subtle);font-size:.58rem}.model-card__open{grid-column:2;min-height:40px;border:1px solid var(--color-accent-border);border-radius:var(--radius-md);background:var(--color-accent-soft);color:var(--color-accent-strong);font-size:.65rem;font-weight:800}.model-card__menu{grid-column:3;grid-row:1/3;align-self:center;width:44px;height:44px;display:grid;place-items:center;border:0;border-radius:var(--radius-md);background:transparent;color:var(--color-text-subtle)}.empty{min-height:45dvh;display:grid;place-items:center;align-content:center;gap:.45rem;text-align:center}.empty>span{width:4.3rem;height:4.3rem;display:grid;place-items:center;border-radius:var(--radius-xl);background:var(--color-accent-soft);color:var(--color-accent-strong)}.empty h2{margin:.5rem 0 0;font-size:1rem}.empty p{max-width:28rem;margin:0 0 .7rem;color:var(--color-text-subtle);font-size:.7rem;line-height:1.5}.field{display:grid;gap:.35rem;color:var(--color-text-muted);font-size:.7rem;font-weight:750}.field input,.field select{min-height:44px;border:1px solid var(--color-border-strong);border-radius:var(--radius-md);padding:0 .75rem;background:var(--color-input-bg);color:var(--color-text);font:inherit;font-size:16px}.dialog-actions-list{display:grid;gap:.4rem;margin-top:.8rem}.dialog-actions-list button{min-height:44px;display:flex;align-items:center;gap:.55rem;border:1px solid var(--color-border);border-radius:var(--radius-md);padding:0 .75rem;background:var(--color-surface-raised);color:var(--color-text);font-size:.7rem;font-weight:750}.dialog-actions-list .danger{border-color:var(--color-danger-border);background:var(--color-danger-soft);color:var(--color-danger)}.visually-hidden{position:fixed;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}@media(min-width:680px){.integration-banner{grid-template-columns:minmax(0,1fr) auto;align-items:center}.integration-banner>a{padding:0 1rem}.model-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:380px){.model-card{grid-template-columns:4rem minmax(0,1fr) 44px}.model-card__preview{width:4rem;height:4rem}}
</style>
