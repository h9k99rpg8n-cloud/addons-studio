<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import AppButton from '@/components/common/AppButton.vue'
import AppDialog from '@/components/common/AppDialog.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import StudioPageHeader from '@/components/common/StudioPageHeader.vue'
import { useProjectContext } from '@/composables/useProjectContext'
import { toAppError } from '@/core/errors/AppError'
import { BLOCKBENCH_WEB_URL } from '@/core/integrations/blockbenchIntegration'
import { resourceRepository } from '@/core/resources/resourceRepository'
import { textureRepository } from '@/core/texture/textureRepository'
import { useLocaleStore } from '@/stores/locale'
import { useToastStore } from '@/stores/toasts'
import type { StudioResourceFolder } from '@/types/resource'
import type { StudioMaterial, StudioTextureAsset } from '@/types/texture'
import { downloadBlob } from '@/utils/download'

import MaterialSwatch from './MaterialSwatch.vue'

const props = defineProps<{ projectId: string }>()
const locale = useLocaleStore()
const toasts = useToastStore()
const { project, loading: projectLoading, error: projectError } = useProjectContext(() => props.projectId)

const materials = ref<StudioMaterial[]>([])
const assets = ref<StudioTextureAsset[]>([])
const folders = ref<StudioResourceFolder[]>([])
const query = ref('')
const folderFilter = ref('all')
const loading = ref(true)
const busy = ref(false)
const loadError = ref('')
const importInput = ref<HTMLInputElement>()
const replaceInput = ref<HTMLInputElement>()
const folderOpen = ref(false)
const folderActionsOpen = ref(false)
const actionsOpen = ref(false)
const folderName = ref('')
const selected = ref<StudioMaterial>()
const editName = ref('')
const editFolder = ref('')
const usageCount = ref(0)
const usageItems = ref<string[]>([])
const activeFolder = computed(() => folders.value.find((folder) => folder.id === folderFilter.value))
const editFolderName = ref('')

const filteredMaterials = computed(() => {
  const needle = query.value.trim().toLowerCase()
  return materials.value.filter((material) => {
    const inFolder = folderFilter.value === 'all'
      || (folderFilter.value === 'root' ? !material.folderId : material.folderId === folderFilter.value)
    return inFolder && (!needle || `${material.name} ${material.identifier}`.toLowerCase().includes(needle))
  })
})

function assetFor(material: StudioMaterial): StudioTextureAsset | undefined {
  return assets.value.find((asset) => asset.id === material.textureAssetId)
}

async function loadLibrary(): Promise<void> {
  loading.value = true
  try {
    ;[materials.value, assets.value, folders.value] = await Promise.all([
      textureRepository.listMaterials(props.projectId),
      textureRepository.listTextureAssets(props.projectId),
      resourceRepository.listFolders(props.projectId, 'material'),
    ])
  } catch (error) {
    loadError.value = toAppError(error, locale.t('Addons Studio could not load Materials.')).userMessage
  } finally {
    loading.value = false
  }
}

onMounted(loadLibrary)

async function importImages(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const files = [...(input.files ?? [])]
  if (!files.length) return
  busy.value = true
  let imported = 0
  for (const file of files) {
    let provisionalMaterialId: string | undefined
    try {
      const name = file.name.replace(/\.[^.]+$/, '') || locale.t('Material')
      const material = await textureRepository.createMaterial({ projectId: props.projectId, name })
      provisionalMaterialId = material.id
      const result = await textureRepository.importTexture(material.id, file)
      materials.value.unshift(result.material)
      assets.value.unshift(result.asset)
      imported += 1
    } catch (error) {
      if (provisionalMaterialId) await textureRepository.deleteMaterial(provisionalMaterialId).catch(() => undefined)
      toasts.push({ type: 'error', message: `${file.name}: ${toAppError(error, locale.t('Texture import failed.')).userMessage}` })
    }
  }
  if (imported) toasts.push({ type: 'success', message: locale.t('{count} materials imported.', { count: imported }) })
  input.value = ''
  busy.value = false
}

async function createFolder(): Promise<void> {
  try {
    const folder = await resourceRepository.createFolder({ projectId: props.projectId, resourceType: 'material', name: folderName.value })
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
  materials.value = materials.value.map((material) => material.folderId === id
    ? { ...material, folderId: undefined }
    : material)
  folderFilter.value = 'root'
  folderActionsOpen.value = false
}

async function openActions(material: StudioMaterial): Promise<void> {
  selected.value = material
  editName.value = material.name
  editFolder.value = material.folderId ?? ''
  actionsOpen.value = true
  const [bindings, blocks, blockModels] = await Promise.all([
    textureRepository.countMaterialBindings(material.id),
    resourceRepository.list(props.projectId, 'block'),
    resourceRepository.list(props.projectId, 'block_model'),
  ])
  const linkedResources = [...blocks, ...blockModels]
    .filter((resource) => JSON.stringify(resource.payload).includes(material.id))
  usageCount.value = bindings + linkedResources.length
  usageItems.value = [
    ...linkedResources.map((resource) => resource.name),
    ...(bindings ? [locale.t('{count} legacy model face bindings', { count: bindings })] : []),
  ]
}

async function saveActions(): Promise<void> {
  if (!selected.value) return
  let updated = await textureRepository.renameMaterial(selected.value.id, editName.value)
  updated = await textureRepository.moveMaterial(updated.id, editFolder.value || undefined)
  materials.value = materials.value.map((material) => material.id === updated.id ? updated : material)
  actionsOpen.value = false
}

async function duplicateSelected(): Promise<void> {
  if (!selected.value) return
  const result = await textureRepository.duplicateMaterial(selected.value.id)
  materials.value.unshift(result.material)
  if (result.asset) assets.value.unshift(result.asset)
  actionsOpen.value = false
  toasts.push({ type: 'success', message: locale.t('Material duplicated') })
}

async function deleteSelected(): Promise<void> {
  if (!selected.value) return
  await textureRepository.deleteMaterial(selected.value.id)
  materials.value = materials.value.filter((material) => material.id !== selected.value?.id)
  assets.value = await textureRepository.listTextureAssets(props.projectId)
  actionsOpen.value = false
  toasts.push({ type: 'success', message: locale.t('Material deleted') })
}

function replaceSelected(): void {
  replaceInput.value?.click()
}

async function replaceImage(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !selected.value) return
  try {
    const oldAssetId = selected.value.textureAssetId
    const result = await textureRepository.importTexture(selected.value.id, file)
    materials.value = materials.value.map((material) => material.id === result.material.id ? result.material : material)
    if (oldAssetId) assets.value = assets.value.filter((asset) => asset.id !== oldAssetId)
    assets.value.unshift(result.asset)
    selected.value = result.material
    toasts.push({ type: 'success', message: locale.t('Texture replaced') })
  } catch (error) {
    toasts.push({ type: 'error', message: toAppError(error, locale.t('Addons Studio could not import this texture.')).userMessage })
  } finally {
    input.value = ''
  }
}

function blobDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(blob)
  })
}

async function editInBlockbench(material: StudioMaterial): Promise<void> {
  const asset = assetFor(material)
  if (!asset) return
  const popup = window.open('about:blank', '_blank')
  if (popup) popup.opener = null
  try {
    const data = await blobDataUrl(asset.blob)
    const params = new URLSearchParams({ loadtype: 'image', loadname: asset.name, loaddata: data })
    const url = `${BLOCKBENCH_WEB_URL}?${params.toString()}`
    if (url.length < 60_000 && popup) popup.location.replace(url)
    else {
      if (popup) popup.location.replace(BLOCKBENCH_WEB_URL)
      downloadBlob(asset.blob, `${asset.name}.${asset.mimeType === 'image/png' ? 'png' : 'jpg'}`)
      toasts.push({ type: 'info', message: locale.t('The image was downloaded. Import it into Blockbench to edit it.') })
    }
  } catch (error) {
    popup?.close()
    toasts.push({ type: 'error', message: toAppError(error, locale.t('This image could not be opened.')).userMessage })
  }
}

function editSelectedInBlockbench(): void {
  if (selected.value) void editInBlockbench(selected.value)
}
</script>

<template>
  <main class="materials-view">
    <StudioPageHeader :title="locale.t('Materials')" :subtitle="project?.name" :eyebrow="locale.t('Reusable image library')" icon="image">
      <template #actions>
        <button class="header-action" type="button" :aria-label="locale.t('New Folder')" @click="folderOpen = true"><AppIcon name="folder-plus" :size="21" /></button>
        <button class="header-action header-action--primary" type="button" :aria-label="locale.t('Import images')" @click="importInput?.click()"><AppIcon name="upload" :size="21" /></button>
      </template>
    </StudioPageHeader>

    <div class="materials-body">
      <section v-if="projectLoading || loading" class="state">{{ locale.t('Loading Materials…') }}</section>
      <section v-else-if="projectError || loadError || !project" class="state state--error">{{ projectError || loadError }}</section>
      <template v-else>
        <section class="material-intro">
          <div><strong>{{ locale.t('Project material memory') }}</strong><p>{{ locale.t('Import each texture once, reuse it in blocks and models, and send it to Blockbench when it needs editing.') }}</p></div>
          <button type="button" :disabled="busy" @click="importInput?.click()"><AppIcon name="image-plus" :size="19" />{{ locale.t('Import PNG/JPG') }}</button>
        </section>

        <div class="library-tools">
          <label><AppIcon name="search" :size="19" /><input v-model="query" type="search" :placeholder="locale.t('Search materials')" /></label>
          <button type="button" @click="folderOpen = true"><AppIcon name="folder-plus" :size="19" />{{ locale.t('Folder') }}</button>
          <button v-if="activeFolder" type="button" :aria-label="locale.t('Folder actions')" @click="openFolderActions"><AppIcon name="more-vertical" :size="19" /></button>
        </div>
        <div v-if="folders.length" class="folder-tabs"><button type="button" :class="{active:folderFilter==='all'}" @click="folderFilter='all'">{{ locale.t('All') }}</button><button type="button" :class="{active:folderFilter==='root'}" @click="folderFilter='root'">{{ locale.t('Root') }}</button><button v-for="folder in folders" :key="folder.id" type="button" :class="{active:folderFilter===folder.id}" @click="folderFilter=folder.id">{{ folder.name }}</button></div>

        <section v-if="filteredMaterials.length" class="material-grid">
          <article v-for="material in filteredMaterials" :key="material.id" class="material-card">
            <button type="button" class="material-card__main" @click="openActions(material)"><MaterialSwatch :blob="assetFor(material)?.blob" :size="86" /><span><strong>{{ material.name }}</strong><code>{{ material.identifier }}</code><small v-if="assetFor(material)">{{ assetFor(material)!.width }}×{{ assetFor(material)!.height }} · {{ assetFor(material)!.mimeType.replace('image/','').toUpperCase() }}</small><small v-else>{{ locale.t('No image') }}</small></span></button>
            <button v-if="assetFor(material)" type="button" class="material-card__edit" @click="editInBlockbench(material)"><AppIcon name="external-link" :size="17" />{{ locale.t('Edit in Blockbench') }}</button>
          </article>
        </section>
        <section v-else class="empty"><span><AppIcon name="image" :size="34" /></span><h2>{{ locale.t('No materials here') }}</h2><p>{{ locale.t('Import PNG or JPG files from Photos or Files. Addons Studio does not include a duplicate paint editor anymore.') }}</p><AppButton size="large" @click="importInput?.click()">{{ locale.t('Import images') }}</AppButton></section>
      </template>
    </div>

    <input ref="importInput" class="visually-hidden" type="file" multiple accept="image/png,image/jpeg,.png,.jpg,.jpeg" @change="importImages" />
    <input ref="replaceInput" class="visually-hidden" type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" @change="replaceImage" />

    <AppDialog :open="folderOpen" :title="locale.t('New Material Folder')" @close="folderOpen = false"><label class="field">{{ locale.t('Folder Name') }}<input v-model="folderName" maxlength="80" @keydown.enter.prevent="createFolder" /></label><template #actions><AppButton variant="ghost" @click="folderOpen=false">{{ locale.t('Cancel') }}</AppButton><AppButton @click="createFolder">{{ locale.t('Create Folder') }}</AppButton></template></AppDialog>

    <AppDialog :open="actionsOpen" :title="locale.t('Material details')" @close="actionsOpen=false">
      <div v-if="selected" class="material-detail"><MaterialSwatch :blob="assetFor(selected)?.blob" :size="96" /><p><strong>{{ selected.name }}</strong><code>{{ selected.identifier }}</code><small>{{ usageCount }} {{ locale.t('resource uses') }}</small></p></div>
      <div class="usage-list"><strong>{{ locale.t('Used by') }}</strong><ul v-if="usageItems.length"><li v-for="item in usageItems" :key="item">{{ item }}</li></ul><small v-else>{{ locale.t('No project resources use this material yet.') }}</small></div>
      <label class="field">{{ locale.t('Name') }}<input v-model="editName" maxlength="80" /></label>
      <label class="field">{{ locale.t('Folder') }}<select v-model="editFolder"><option value="">{{ locale.t('Root') }}</option><option v-for="folder in folders" :key="folder.id" :value="folder.id">{{ folder.name }}</option></select></label>
      <div class="action-list"><button type="button" @click="replaceSelected"><AppIcon name="upload" :size="19" />{{ locale.t('Replace image') }}</button><button type="button" @click="duplicateSelected"><AppIcon name="copy" :size="19" />{{ locale.t('Duplicate') }}</button><button v-if="selected && assetFor(selected)" type="button" @click="editSelectedInBlockbench"><AppIcon name="external-link" :size="19" />{{ locale.t('Edit in Blockbench') }}</button><button type="button" class="danger" @click="deleteSelected"><AppIcon name="trash" :size="19" />{{ locale.t('Delete') }}</button></div>
      <template #actions><AppButton variant="ghost" @click="actionsOpen=false">{{ locale.t('Cancel') }}</AppButton><AppButton @click="saveActions">{{ locale.t('Save') }}</AppButton></template>
    </AppDialog>

    <AppDialog :open="folderActionsOpen" :title="locale.t('Folder actions')" @close="folderActionsOpen=false">
      <label class="field">{{ locale.t('Folder Name') }}<input v-model="editFolderName" maxlength="80" /></label>
      <div class="action-list"><button type="button" class="danger" @click="deleteActiveFolder"><AppIcon name="trash" :size="19" />{{ locale.t('Delete folder and move contents to Root') }}</button></div>
      <template #actions><AppButton variant="ghost" @click="folderActionsOpen=false">{{ locale.t('Cancel') }}</AppButton><AppButton @click="renameActiveFolder">{{ locale.t('Save') }}</AppButton></template>
    </AppDialog>
  </main>
</template>

<style scoped>
.materials-body{width:min(100%,var(--content-max));margin:0 auto;padding:1rem max(var(--page-gutter),env(safe-area-inset-right)) 2rem max(var(--page-gutter),env(safe-area-inset-left))}.header-action{width:44px;height:44px;display:grid;place-items:center;border:1px solid var(--color-border);border-radius:var(--radius-md);background:var(--color-surface);color:var(--color-text)}.header-action--primary{border-color:var(--color-accent);background:var(--color-accent);color:var(--color-on-accent)}.state{min-height:50dvh;display:grid;place-items:center;color:var(--color-text-subtle)}.state--error{color:var(--color-danger)}.material-intro{display:grid;gap:.8rem;border:1px solid var(--color-border);border-radius:var(--radius-xl);padding:1rem;background:var(--color-surface)}.material-intro strong{font-size:.9rem}.material-intro p{margin:.25rem 0 0;color:var(--color-text-subtle);font-size:.69rem;line-height:1.5}.material-intro button{min-height:44px;display:flex;align-items:center;justify-content:center;gap:.5rem;border:0;border-radius:var(--radius-md);padding:0 1rem;background:var(--color-accent);color:var(--color-on-accent);font-size:.72rem;font-weight:850}.library-tools{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:.55rem;margin:1rem 0 .75rem}.library-tools label{min-height:44px;display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:.55rem;border:1px solid var(--color-border);border-radius:var(--radius-md);padding:0 .75rem;background:var(--color-input-bg);color:var(--color-text-subtle)}.library-tools input{min-width:0;border:0;outline:0;background:transparent;color:var(--color-text);font:inherit;font-size:16px}.library-tools>button{min-height:44px;display:flex;align-items:center;gap:.4rem;border:1px solid var(--color-border);border-radius:var(--radius-md);padding:0 .75rem;background:var(--color-surface);color:var(--color-text);font-size:.68rem;font-weight:800}.folder-tabs{display:flex;gap:.4rem;overflow-x:auto;margin-bottom:.8rem;scrollbar-width:none}.folder-tabs button{flex:none;min-height:40px;border:1px solid var(--color-border);border-radius:var(--radius-pill);padding:0 .75rem;background:var(--color-surface);color:var(--color-text-subtle);font-size:.65rem;font-weight:750}.folder-tabs button.active{border-color:var(--color-accent);background:var(--color-accent-soft);color:var(--color-accent-strong)}.material-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.65rem}.material-card{min-width:0;overflow:hidden;border:1px solid var(--color-border);border-radius:var(--radius-xl);background:var(--color-surface);box-shadow:var(--shadow-card)}.material-card__main{width:100%;min-height:9.5rem;display:grid;place-items:center;align-content:center;gap:.55rem;border:0;padding:.8rem;background:transparent;color:var(--color-text);text-align:center}.material-card__main>span:last-child{min-width:0;width:100%;display:grid;gap:.12rem}.material-card strong,.material-card code,.material-card small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.material-card strong{font-size:.76rem}.material-card code{color:var(--color-text-subtle);font-size:.55rem}.material-card small{color:var(--color-text-subtle);font-size:.57rem}.material-card__edit{width:100%;min-height:44px;display:flex;align-items:center;justify-content:center;gap:.35rem;border:0;border-top:1px solid var(--color-border);background:var(--color-surface-raised);color:var(--color-text-muted);font-size:.62rem;font-weight:800}.empty{min-height:45dvh;display:grid;place-items:center;align-content:center;gap:.45rem;text-align:center}.empty>span{width:4.3rem;height:4.3rem;display:grid;place-items:center;border-radius:var(--radius-xl);background:var(--color-accent-soft);color:var(--color-accent-strong)}.empty h2{margin:.5rem 0 0;font-size:1rem}.empty p{max-width:29rem;margin:0 0 .7rem;color:var(--color-text-subtle);font-size:.7rem;line-height:1.5}.material-detail{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:.75rem;margin-bottom:.8rem}.material-detail p{min-width:0;display:grid;gap:.15rem;margin:0}.material-detail strong,.material-detail code{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.material-detail code,.material-detail small{color:var(--color-text-subtle);font-size:.62rem}.field{display:grid;gap:.35rem;color:var(--color-text-muted);font-size:.7rem;font-weight:750}.field input,.field select{min-height:44px;border:1px solid var(--color-border-strong);border-radius:var(--radius-md);padding:0 .75rem;background:var(--color-input-bg);color:var(--color-text);font:inherit;font-size:16px}.action-list{display:grid;gap:.4rem;margin-top:.8rem}.action-list button{min-height:44px;display:flex;align-items:center;gap:.55rem;border:1px solid var(--color-border);border-radius:var(--radius-md);padding:0 .75rem;background:var(--color-surface-raised);color:var(--color-text);font-size:.7rem;font-weight:750}.action-list .danger{border-color:var(--color-danger-border);background:var(--color-danger-soft);color:var(--color-danger)}.visually-hidden{position:fixed;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}@media(min-width:680px){.material-intro{grid-template-columns:minmax(0,1fr) auto;align-items:center}.material-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(min-width:1000px){.material-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
.usage-list{display:grid;gap:.35rem;margin:.2rem 0 .8rem;border:1px solid var(--color-border);border-radius:var(--radius-md);padding:.7rem;background:var(--color-surface-muted)}.usage-list>strong{font-size:.68rem}.usage-list ul{display:grid;gap:.25rem;margin:0;padding-left:1rem;color:var(--color-text-muted);font-size:.64rem}.usage-list>small{color:var(--color-text-subtle);font-size:.63rem;line-height:1.4}
</style>
