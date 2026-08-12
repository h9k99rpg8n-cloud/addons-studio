<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import AppButton from '@/components/common/AppButton.vue'
import AppDialog from '@/components/common/AppDialog.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import BottomSheet from '@/components/common/BottomSheet.vue'
import IconButton from '@/components/common/IconButton.vue'
import { toAppError } from '@/core/errors/AppError'
import {
  createElementCommand,
  deleteElementCommand,
  ModelCommandHistory,
  updateElementCommand,
} from '@/core/model/modelHistory'
import {
  cloneStudioCube,
  cloneStudioReference,
  createStudioCube,
} from '@/core/model/modelFactory'
import { modelPersistenceService } from '@/core/model/modelPersistenceService'
import { modelRepository } from '@/core/model/modelRepository'
import { useToastStore } from '@/stores/toasts'
import type {
  ModelReferenceAsset,
  ModelTransformTool,
  StudioModel,
  StudioModelElement,
  StudioReferenceImage,
} from '@/types/model'

import ModelOutlinerSheet from './components/ModelOutlinerSheet.vue'
import ModelViewport from './components/ModelViewport.vue'
import ReferencePropertiesSheet from './components/ReferencePropertiesSheet.vue'
import TransformPropertiesSheet from './components/TransformPropertiesSheet.vue'

const props = defineProps<{ projectId: string; modelId: string }>()
const router = useRouter()
const toasts = useToastStore()
const model = ref<StudioModel>()
const assets = ref<ModelReferenceAsset[]>([])
const loading = ref(true)
const loadError = ref('')
const tool = ref<ModelTransformTool>('orbit')
const selectedElementId = ref<string>()
const selectedReferenceId = ref<string>()
const propertiesOpen = ref(false)
const referencePropertiesOpen = ref(false)
const outlinerOpen = ref(false)
const moreOpen = ref(false)
const renameOpen = ref(false)
const renameValue = ref('')
const renameTargetId = ref<string>()
const deleteReferenceOpen = ref(false)
const deleteReferenceTarget = ref<StudioReferenceImage>()
const referenceInput = ref<HTMLInputElement>()
const importingReference = ref(false)
const saveStatus = ref<'saved' | 'saving' | 'error'>('saved')
const historyVersion = ref(0)
const history = new ModelCommandHistory()
let saveSequence = 0

const selectedElement = computed(() =>
  model.value?.elements.find((element) => element.id === selectedElementId.value),
)
const selectedReference = computed(() =>
  model.value?.references.find((reference) => reference.id === selectedReferenceId.value),
)
const canUndo = computed(() => {
  void historyVersion.value
  return history.canUndo
})
const canRedo = computed(() => {
  void historyVersion.value
  return history.canRedo
})

const tools: readonly { id: ModelTransformTool; label: string; icon: string }[] = [
  { id: 'select', label: 'Select', icon: 'pointer' },
  { id: 'orbit', label: 'Camera', icon: 'camera' },
  { id: 'move', label: 'Move', icon: 'move-3d' },
  { id: 'rotate', label: 'Rotate', icon: 'rotate-3d' },
  { id: 'scale', label: 'Resize', icon: 'scale' },
]

onMounted(async () => {
  try {
    const [storedModel, storedAssets] = await Promise.all([
      modelRepository.getModel(props.modelId),
      modelRepository.listReferenceAssets(props.modelId),
    ])
    if (!storedModel || storedModel.projectId !== props.projectId) {
      loadError.value = 'This model is no longer available in the project.'
      return
    }
    model.value = storedModel
    assets.value = storedAssets
  } catch (error) {
    loadError.value = toAppError(error, 'Addons Studio could not open this model.').userMessage
  } finally {
    loading.value = false
  }
  globalThis.addEventListener('pagehide', flushOnHide)
})

onBeforeUnmount(() => {
  globalThis.removeEventListener('pagehide', flushOnHide)
  void modelPersistenceService.flush(props.modelId)
})

function flushOnHide(): void {
  void modelPersistenceService.flush(props.modelId)
}

function replaceElement(element: StudioModelElement): void {
  if (!model.value) return
  const index = model.value.elements.findIndex((entry) => entry.id === element.id)
  if (index >= 0) model.value.elements.splice(index, 1, cloneStudioCube(element))
}

function scheduleSave(): void {
  if (!model.value) return
  const sequence = ++saveSequence
  saveStatus.value = 'saving'
  modelPersistenceService.schedule(model.value, {
    onSaved: (saved) => {
      if (!model.value) return
      model.value.updatedAt = saved.updatedAt
      model.value.revision = saved.revision
      if (sequence === saveSequence) saveStatus.value = 'saved'
    },
    onError: (error) => {
      if (sequence === saveSequence) saveStatus.value = 'error'
      toasts.push({
        type: 'error',
        message: toAppError(error, 'Addons Studio could not save this model.').userMessage,
      })
    },
  })
}

async function saveNow(): Promise<void> {
  if (!model.value) return
  moreOpen.value = false
  scheduleSave()
  try {
    await modelPersistenceService.flush(model.value.id)
    saveStatus.value = 'saved'
  } catch {
    saveStatus.value = 'error'
  }
}

function bumpHistory(): void {
  historyVersion.value += 1
}

function addCube(): void {
  if (!model.value) return
  const cube = createStudioCube(model.value.elements.length)
  history.execute(createElementCommand(cube, model.value.elements.length), model.value)
  bumpHistory()
  selectedElementId.value = cube.id
  selectedReferenceId.value = undefined
  tool.value = 'move'
  scheduleSave()
}

function previewElement(element: StudioModelElement): void {
  replaceElement(element)
}

function commitElement(payload: {
  before: StudioModelElement
  after: StudioModelElement
  label: string
}): void {
  if (!model.value) return
  replaceElement(payload.after)
  history.recordApplied(updateElementCommand(payload.before, payload.after, payload.label))
  bumpHistory()
  scheduleSave()
}

function deleteElement(id: string): void {
  if (!model.value) return
  const index = model.value.elements.findIndex((element) => element.id === id)
  const element = model.value.elements[index]
  if (!element || index < 0) return
  history.execute(deleteElementCommand(element, index), model.value)
  bumpHistory()
  if (selectedElementId.value === id) selectedElementId.value = undefined
  scheduleSave()
}

function toggleElement(id: string): void {
  if (!model.value) return
  const element = model.value.elements.find((entry) => entry.id === id)
  if (!element) return
  const before = cloneStudioCube(element)
  const after = cloneStudioCube(element)
  after.visible = !after.visible
  history.execute(updateElementCommand(before, after, after.visible ? 'Show cube' : 'Hide cube'), model.value)
  bumpHistory()
  scheduleSave()
}

function beginRenameElement(id: string): void {
  const element = model.value?.elements.find((entry) => entry.id === id)
  if (!element) return
  outlinerOpen.value = false
  renameTargetId.value = id
  renameValue.value = element.name
  renameOpen.value = true
}

function renameElement(): void {
  if (!model.value || !renameTargetId.value || !renameValue.value.trim()) return
  const element = model.value.elements.find((entry) => entry.id === renameTargetId.value)
  if (!element) return
  const before = cloneStudioCube(element)
  const after = cloneStudioCube(element)
  after.name = renameValue.value.trim().slice(0, 60)
  history.execute(updateElementCommand(before, after, 'Rename cube'), model.value)
  bumpHistory()
  renameOpen.value = false
  scheduleSave()
}

function undo(): void {
  if (!model.value) return
  const command = history.undo(model.value)
  if (!command) return
  if (selectedElementId.value && !model.value.elements.some((entry) => entry.id === selectedElementId.value)) {
    selectedElementId.value = undefined
  }
  bumpHistory()
  scheduleSave()
}

function redo(): void {
  if (!model.value) return
  const command = history.redo(model.value)
  if (!command) return
  bumpHistory()
  scheduleSave()
}

function chooseTool(nextTool: ModelTransformTool): void {
  tool.value = nextTool
}

function selectElement(id?: string): void {
  selectedElementId.value = id
  if (id) selectedReferenceId.value = undefined
}

function selectReference(id?: string): void {
  selectedReferenceId.value = id
  if (id) selectedElementId.value = undefined
}

function selectElementFromOutliner(id: string): void {
  selectElement(id)
  outlinerOpen.value = false
  tool.value = 'select'
}

function editReference(id: string): void {
  selectReference(id)
  outlinerOpen.value = false
  referencePropertiesOpen.value = true
}

function updateReference(reference: StudioReferenceImage): void {
  if (!model.value) return
  const index = model.value.references.findIndex((entry) => entry.id === reference.id)
  if (index < 0) return
  model.value.references.splice(index, 1, cloneStudioReference(reference))
  scheduleSave()
}

function toggleReference(id: string): void {
  const reference = model.value?.references.find((entry) => entry.id === id)
  if (!reference) return
  updateReference({ ...cloneStudioReference(reference), visible: !reference.visible })
}

function confirmDeleteReference(id: string): void {
  const reference = model.value?.references.find((entry) => entry.id === id)
  if (!reference) return
  outlinerOpen.value = false
  deleteReferenceTarget.value = reference
  deleteReferenceOpen.value = true
}

async function deleteReference(): Promise<void> {
  if (!model.value || !deleteReferenceTarget.value) return
  const reference = deleteReferenceTarget.value
  try {
    await modelPersistenceService.flush(model.value.id)
    model.value = await modelRepository.deleteReference(model.value, reference.id)
    assets.value = assets.value.filter((asset) => asset.id !== reference.assetId)
    if (selectedReferenceId.value === reference.id) selectedReferenceId.value = undefined
    deleteReferenceOpen.value = false
    saveStatus.value = 'saved'
    toasts.push({ type: 'success', message: 'Reference image removed' })
  } catch (error) {
    toasts.push({
      type: 'error',
      message: toAppError(error, 'The reference image could not be removed.').userMessage,
    })
  }
}

function openReferencePicker(): void {
  referenceInput.value?.click()
}

function decodeImage(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve()
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Image decode failed'))
    }
    image.src = url
  })
}

async function importReference(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !model.value) return
  importingReference.value = true
  try {
    await decodeImage(file)
    await modelPersistenceService.flush(model.value.id)
    const result = await modelRepository.addReferenceAsset(model.value, file)
    model.value = result.model
    assets.value.push(result.asset)
    selectedReferenceId.value = result.reference.id
    selectedElementId.value = undefined
    referencePropertiesOpen.value = true
    saveStatus.value = 'saved'
    toasts.push({ type: 'success', message: 'Reference image added' })
  } catch (error) {
    toasts.push({
      type: 'error',
      message: toAppError(error, 'The reference image could not be opened.').userMessage,
    })
  } finally {
    importingReference.value = false
  }
}

function showOutliner(): void {
  moreOpen.value = false
  outlinerOpen.value = true
}
</script>

<template>
  <main class="model-studio">
    <header class="studio-topbar">
      <IconButton
        icon="arrow-left"
        label="Back to Models"
        @click="router.push({ name: 'models', params: { projectId } })"
      />
      <div class="studio-topbar__title">
        <strong>{{ model?.name ?? 'Model Studio' }}</strong>
        <small :class="`save-status--${saveStatus}`">
          {{ saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? 'Save failed' : 'Saved' }}
        </small>
      </div>
      <IconButton icon="undo" label="Undo" :disabled="!canUndo" @click="undo" />
      <IconButton icon="redo" label="Redo" :disabled="!canRedo" @click="redo" />
      <IconButton icon="more-vertical" label="Model menu" @click="moreOpen = true" />
    </header>

    <section v-if="loading" class="studio-loading" aria-label="Opening Model Studio">
      <div class="studio-loading__message"><span class="spinner" />Preparing 3D workspace…</div>
    </section>

    <section v-else-if="loadError || !model" class="studio-error">
      <span><AppIcon name="alert-triangle" :size="31" /></span>
      <h1>Model unavailable</h1>
      <p>{{ loadError || 'This model could not be found.' }}</p>
      <AppButton @click="router.replace({ name: 'models', params: { projectId } })">Back to Models</AppButton>
    </section>

    <template v-else>
      <ModelViewport
        class="studio-viewport"
        :model="model"
        :assets="assets"
        :selected-element-id="selectedElementId"
        :selected-reference-id="selectedReferenceId"
        :tool="tool"
        @select-element="selectElement"
        @select-reference="selectReference"
        @preview-element="previewElement"
        @commit-element="commitElement"
        @error="(message) => toasts.push({ type: 'error', message })"
      />

      <nav class="studio-toolbar" aria-label="Modeling tools">
        <div class="studio-toolbar__scroll">
          <button
            v-for="entry in tools"
            :key="entry.id"
            type="button"
            :class="{ 'tool-button--active': tool === entry.id }"
            :disabled="['move', 'rotate', 'scale'].includes(entry.id) && !selectedElement"
            @click="chooseTool(entry.id)"
          >
            <AppIcon :name="entry.icon" :size="21" />
            <span>{{ entry.label }}</span>
          </button>
          <button type="button" class="tool-button--create" @click="addCube">
            <AppIcon name="plus" :size="21" />
            <span>Cube</span>
          </button>
          <button
            type="button"
            :disabled="importingReference"
            @click="openReferencePicker"
          >
            <AppIcon name="image-plus" :size="21" />
            <span>Reference</span>
          </button>
          <button
            v-if="selectedElement"
            type="button"
            @click="propertiesOpen = true"
          >
            <AppIcon name="sliders" :size="21" />
            <span>Values</span>
          </button>
          <button
            v-if="selectedReference"
            type="button"
            @click="referencePropertiesOpen = true"
          >
            <AppIcon name="sliders" :size="21" />
            <span>Reference</span>
          </button>
        </div>
      </nav>

      <input
        ref="referenceInput"
        class="visually-hidden"
        type="file"
        accept="image/png,image/jpeg"
        @change="importReference"
      />

      <TransformPropertiesSheet
        :open="propertiesOpen"
        :element="selectedElement"
        @close="propertiesOpen = false"
        @preview="previewElement"
        @commit="commitElement"
      />
      <ReferencePropertiesSheet
        :open="referencePropertiesOpen"
        :reference="selectedReference"
        @close="referencePropertiesOpen = false"
        @update="updateReference"
      />
      <ModelOutlinerSheet
        :open="outlinerOpen"
        :model="model"
        :selected-element-id="selectedElementId"
        :selected-reference-id="selectedReferenceId"
        @close="outlinerOpen = false"
        @select-element="selectElementFromOutliner"
        @select-reference="editReference"
        @rename-element="beginRenameElement"
        @toggle-element="toggleElement"
        @delete-element="deleteElement"
        @edit-reference="editReference"
        @toggle-reference="toggleReference"
        @delete-reference="confirmDeleteReference"
      />

      <BottomSheet
        :open="moreOpen"
        title="Model Studio"
        :description="model.identifier"
        @close="moreOpen = false"
      >
        <div class="studio-menu">
          <button type="button" @click="showOutliner">
            <span><AppIcon name="list-tree" :size="22" /></span>
            <span><strong>Outliner</strong><small>Select, rename, hide, or delete objects</small></span>
          </button>
          <button type="button" @click="saveNow">
            <span><AppIcon name="save" :size="22" /></span>
            <span><strong>Save Now</strong><small>Autosave is already active</small></span>
          </button>
          <button type="button" disabled>
            <span><AppIcon name="palette" :size="22" /></span>
            <span><strong>Materials</strong><small>Coming soon</small></span>
          </button>
        </div>
      </BottomSheet>

      <AppDialog :open="renameOpen" title="Rename Cube" @close="renameOpen = false">
        <label class="field-label" for="rename-model-element">Object Name</label>
        <input
          id="rename-model-element"
          v-model="renameValue"
          class="text-input"
          maxlength="60"
          autocomplete="off"
          @keydown.enter.prevent="renameElement"
        />
        <template #actions>
          <AppButton variant="ghost" @click="renameOpen = false">Cancel</AppButton>
          <AppButton :disabled="!renameValue.trim()" @click="renameElement">Rename</AppButton>
        </template>
      </AppDialog>

      <AppDialog
        :open="deleteReferenceOpen"
        :title="`Delete “${deleteReferenceTarget?.name ?? 'reference'}”?`"
        description="This removes only the modeling reference. It does not delete a project texture."
        @close="deleteReferenceOpen = false"
      >
        <template #actions>
          <AppButton variant="ghost" @click="deleteReferenceOpen = false">Cancel</AppButton>
          <AppButton variant="danger" @click="deleteReference">Delete Reference</AppButton>
        </template>
      </AppDialog>
    </template>
  </main>
</template>

<style scoped>
.model-studio {
  height: 100dvh;
  min-height: 20rem;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  overflow: hidden;
  background: #080b0d;
  color: #f4f7f5;
  --color-text: #f4f7f5;
  --color-text-muted: #bdc7c1;
  --color-text-subtle: #89978f;
  --color-surface: #111619;
  --color-surface-raised: #171d20;
  --color-surface-strong: #111619;
  --color-input-bg: #0c1012;
  --color-border: #27302c;
  --color-border-strong: #3b4740;
  --color-backdrop: rgb(0 0 0 / 0.68);
}

.studio-topbar {
  z-index: var(--z-header);
  min-height: calc(3.55rem + env(safe-area-inset-top));
  display: grid;
  grid-template-columns: var(--touch-target) minmax(0, 1fr) repeat(3, var(--touch-target));
  align-items: end;
  gap: 0.12rem;
  padding: env(safe-area-inset-top) max(0.35rem, env(safe-area-inset-right)) 0.28rem max(0.35rem, env(safe-area-inset-left));
  border-bottom: 1px solid #252e29;
  background: #0c1012;
}

.studio-topbar__title {
  min-width: 0;
  align-self: center;
  display: grid;
  padding: 0 0.35rem;
}

.studio-topbar__title strong,
.studio-topbar__title small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.studio-topbar__title strong { font-size: 0.82rem; }
.studio-topbar__title small { margin-top: 0.1rem; font-size: 0.58rem; }
.save-status--saved { color: #70d991; }
.save-status--saving { color: #f0c85a; }
.save-status--error { color: #ff7e87; }

.studio-viewport { min-height: 0; }

.studio-toolbar {
  z-index: var(--z-navigation);
  min-width: 0;
  padding: 0.38rem max(0.35rem, env(safe-area-inset-right)) calc(0.38rem + env(safe-area-inset-bottom)) max(0.35rem, env(safe-area-inset-left));
  border-top: 1px solid #27302c;
  background: #0c1012;
}

.studio-toolbar__scroll {
  display: flex;
  gap: 0.3rem;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.studio-toolbar__scroll::-webkit-scrollbar { display: none; }

.studio-toolbar button {
  min-width: 3.55rem;
  min-height: 3.35rem;
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  border: 1px solid transparent;
  border-radius: 0.72rem;
  padding: 0.25rem 0.4rem;
  background: transparent;
  color: #aab6af;
}

.studio-toolbar button span { font-size: 0.58rem; font-weight: 720; }
.studio-toolbar button:disabled { opacity: 0.32; }
.studio-toolbar .tool-button--active {
  border-color: #3ca967;
  background: #123421;
  color: #72df98;
}

.studio-toolbar .tool-button--create {
  border-color: #34784d;
  background: #183c27;
  color: #80e5a1;
}

.studio-loading,
.studio-error {
  grid-row: 2 / 4;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: #080b0d;
}

.studio-loading__message {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  color: #abb8b0;
  font-size: 0.78rem;
}

.spinner {
  width: 1.35rem;
  height: 1.35rem;
  border: 2px solid #3b4740;
  border-right-color: #55cf7d;
  border-radius: 50%;
  animation: studio-spin 0.8s linear infinite;
}

@keyframes studio-spin { to { transform: rotate(360deg); } }

.studio-error {
  flex-direction: column;
  text-align: center;
}

.studio-error > span {
  width: 4rem;
  height: 4rem;
  display: grid;
  place-items: center;
  border-radius: var(--radius-xl);
  background: #332b13;
  color: #f3cb5c;
}

.studio-error h1 { margin: 1rem 0 0; font-size: 1.2rem; }
.studio-error p { max-width: 24rem; margin: 0.4rem 0 1.1rem; color: #aeb9b2; font-size: 0.78rem; line-height: 1.5; }

.studio-menu {
  display: grid;
  gap: 0.4rem;
}

.studio-menu button {
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

.studio-menu button:active:not(:disabled) { background: var(--color-surface-raised); }
.studio-menu button:disabled { opacity: 0.52; }
.studio-menu button > span:first-child {
  width: 2.75rem;
  height: 2.75rem;
  display: grid;
  place-items: center;
  border-radius: var(--radius-md);
  background: var(--color-surface-raised);
  color: #6bd78e;
}
.studio-menu button > span:last-child { min-width: 0; display: grid; gap: 0.15rem; }
.studio-menu strong { font-size: 0.86rem; }
.studio-menu small { color: var(--color-text-subtle); font-size: 0.7rem; }

@media (orientation: landscape) and (max-height: 540px) {
  .studio-topbar { min-height: calc(3.15rem + env(safe-area-inset-top)); }
  .studio-toolbar button { min-height: 2.85rem; }
  .studio-toolbar { padding-top: 0.22rem; padding-bottom: calc(0.22rem + env(safe-area-inset-bottom)); }
}
</style>
