<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import AppButton from '@/components/common/AppButton.vue'
import AppDialog from '@/components/common/AppDialog.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import IconButton from '@/components/common/IconButton.vue'
import StudioIcon from '@/components/common/StudioIcon.vue'
import { toAppError } from '@/core/errors/AppError'
import { modelRepository } from '@/core/model/modelRepository'
import { textureRepository } from '@/core/texture/textureRepository'
import { resetUvRect, textureUvService } from '@/core/texture/textureUvService'
import { useLocaleStore } from '@/stores/locale'
import { useToastStore } from '@/stores/toasts'
import type { StudioModel } from '@/types/model'
import type {
  StudioMaterial,
  StudioTextureAsset,
  StudioTextureBinding,
  StudioUvRect,
  TextureFace,
  UvPrecision,
} from '@/types/texture'

import MaterialSwatch from './MaterialSwatch.vue'
import TextureModelPreview from './TextureModelPreview.vue'
import TexturePaintCanvas from './TexturePaintCanvas.vue'
import TextureUvWorkspace from './TextureUvWorkspace.vue'

const props = defineProps<{ projectId: string; modelId: string }>()
const router = useRouter()
const locale = useLocaleStore()
const toasts = useToastStore()

const model = ref<StudioModel>()
const materials = ref<StudioMaterial[]>([])
const assets = ref<StudioTextureAsset[]>([])
const bindings = ref<StudioTextureBinding[]>([])
const loading = ref(true)
const loadError = ref('')
const busy = ref(false)
const createOpen = ref(false)
const materialName = ref('Material')
const selectedMaterialId = ref('')
const selectedCubeId = ref('')
const selectedFace = ref<TextureFace>('north')
const selectedFaces = ref<TextureFace[]>(['north'])
const multiSelect = ref(false)
const mode = ref<'material' | 'uv' | 'paint'>('uv')
const inspectorOpen = ref(false)
const previewHeight = ref(270)
const uvPrecision = ref<UvPrecision>(1)
const paintDirty = ref(false)
const importInput = ref<HTMLInputElement>()
let dividerPointer: { id: number; startY: number; startHeight: number } | undefined

const faces: readonly TextureFace[] = ['north', 'south', 'east', 'west', 'up', 'down']
const selectedMaterial = computed(() => materials.value.find((entry) => entry.id === selectedMaterialId.value))
const selectedAsset = computed(() => assets.value.find((entry) => entry.id === selectedMaterial.value?.textureAssetId))
const selectedCube = computed(() => model.value?.elements.find((entry) => entry.id === selectedCubeId.value))
const selectedBinding = computed(() => bindings.value.find((entry) => entry.cubeId === selectedCubeId.value && entry.face === selectedFace.value))
const selectedFaceMaterial = computed(() => materials.value.find((entry) => entry.id === selectedBinding.value?.materialId))
const cubeBindings = computed(() => bindings.value.filter((entry) => entry.cubeId === selectedCubeId.value))
const atlasBindings = computed(() => cubeBindings.value.filter((entry) => entry.materialId === selectedMaterialId.value))
const editorStyle = computed(() => ({ '--preview-height': `${previewHeight.value}px` }))

function assetForMaterial(material: StudioMaterial): StudioTextureAsset | undefined {
  return assets.value.find((entry) => entry.id === material.textureAssetId)
}

function faceLabel(face: TextureFace): string {
  return locale.t(face[0]!.toUpperCase() + face.slice(1))
}

async function loadWorkspace(): Promise<void> {
  loading.value = true
  loadError.value = ''
  try {
    const loadedModel = await modelRepository.getModel(props.modelId)
    if (!loadedModel || loadedModel.projectId !== props.projectId) throw new Error('Model unavailable')
    model.value = loadedModel
    selectedCubeId.value = loadedModel.elements[0]?.id ?? ''
    const workspace = await textureRepository.getWorkspace(props.modelId)
    materials.value = workspace.materials
    assets.value = workspace.assets
    bindings.value = workspace.bindings
    selectedMaterialId.value = workspace.materials[0]?.id ?? ''
  } catch (error) {
    loadError.value = toAppError(error, locale.t('Addons Studio could not open Texture Core.')).userMessage
  } finally {
    loading.value = false
  }
}

onMounted(loadWorkspace)

watch(selectedBinding, (binding) => {
  if (binding && materials.value.some((entry) => entry.id === binding.materialId)) selectedMaterialId.value = binding.materialId
})

function startCreateMaterial(): void {
  materialName.value = `Material ${materials.value.length + 1}`
  createOpen.value = true
}

async function createMaterial(): Promise<void> {
  busy.value = true
  try {
    const created = await textureRepository.createMaterial({ projectId: props.projectId, name: materialName.value })
    materials.value.push(created)
    selectedMaterialId.value = created.id
    createOpen.value = false
    toasts.push({ type: 'success', message: locale.t('Material created') })
  } catch (error) {
    toasts.push({ type: 'error', message: toAppError(error, locale.t('Addons Studio could not create this material.')).userMessage })
  } finally {
    busy.value = false
  }
}

function openTexturePicker(): void {
  if (!selectedMaterial.value) {
    toasts.push({ type: 'info', message: locale.t('Create or select a material first.') })
    return
  }
  importInput.value?.click()
}

async function importTexture(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !selectedMaterial.value) return
  busy.value = true
  try {
    const previousAssetId = selectedMaterial.value.textureAssetId
    const result = await textureRepository.importTexture(selectedMaterial.value.id, file)
    materials.value = materials.value.map((entry) => entry.id === result.material.id ? result.material : entry)
    if (previousAssetId) assets.value = assets.value.filter((entry) => entry.id !== previousAssetId)
    assets.value.push(result.asset)
    selectedMaterialId.value = result.material.id
    toasts.push({ type: 'success', message: locale.t('Texture imported successfully') })
  } catch (error) {
    toasts.push({ type: 'error', message: toAppError(error, locale.t('Addons Studio could not import this texture.')).userMessage })
  } finally {
    input.value = ''
    busy.value = false
  }
}

function canvasToBlob(target: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => target.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG encode failed')), 'image/png'))
}

async function createBlankTexture(size = 32): Promise<void> {
  if (!selectedMaterial.value) {
    toasts.push({ type: 'info', message: locale.t('Create or select a material first.') })
    return
  }
  const temp = document.createElement('canvas')
  temp.width = size
  temp.height = size
  temp.getContext('2d')!.clearRect(0, 0, size, size)
  const file = new File([await canvasToBlob(temp)], `${selectedMaterial.value.identifier}_${size}.png`, { type: 'image/png' })
  const previousAssetId = selectedMaterial.value.textureAssetId
  const result = await textureRepository.importTexture(selectedMaterial.value.id, file)
  materials.value = materials.value.map((entry) => entry.id === result.material.id ? result.material : entry)
  if (previousAssetId) assets.value = assets.value.filter((entry) => entry.id !== previousAssetId)
  assets.value.push(result.asset)
  selectedMaterialId.value = result.material.id
  mode.value = 'paint'
}

async function saveFaceBinding(face: TextureFace, announce = false): Promise<StudioTextureBinding | undefined> {
  if (!model.value || !selectedCube.value || !selectedMaterial.value) return
  const asset = selectedAsset.value
  try {
    const saved = await textureRepository.saveFaceBinding({
      projectId: props.projectId,
      modelId: props.modelId,
      cubeId: selectedCube.value.id,
      face,
      materialId: selectedMaterial.value.id,
      textureWidth: asset?.width ?? 16,
      textureHeight: asset?.height ?? 16,
    })
    const index = bindings.value.findIndex((entry) => entry.id === saved.id)
    if (index >= 0) bindings.value[index] = saved
    else bindings.value.push(saved)
    if (announce) toasts.push({ type: 'success', message: locale.t('Material assigned to face') })
    return saved
  } catch (error) {
    toasts.push({ type: 'error', message: toAppError(error, locale.t('Addons Studio could not assign this material.')).userMessage })
  }
}

async function applyMaterialToFace(face = selectedFace.value): Promise<void> {
  await saveFaceBinding(face, true)
}

async function applyMaterialToSelection(): Promise<void> {
  if (!selectedMaterial.value || !selectedCube.value) return
  busy.value = true
  try {
    const targetFaces = selectedFaces.value.length ? selectedFaces.value : [selectedFace.value]
    for (const face of targetFaces) await saveFaceBinding(face)
    toasts.push({ type: 'success', message: `${locale.t('Material assigned')} · ${targetFaces.length} ${locale.t('faces')}` })
  } finally {
    busy.value = false
  }
}

async function applyMaterialToCube(): Promise<void> {
  if (!selectedCube.value || !selectedMaterial.value) return
  busy.value = true
  try {
    for (const face of faces) await saveFaceBinding(face)
    selectedFaces.value = [...faces]
    toasts.push({ type: 'success', message: locale.t('Material assigned to cube') })
  } finally {
    busy.value = false
  }
}

function selectCube(cubeId: string): void {
  selectedCubeId.value = cubeId
  selectedFaces.value = [selectedFace.value]
}

function selectFace(face: TextureFace): void {
  selectedFace.value = face
  if (!multiSelect.value) selectedFaces.value = [face]
  else if (!selectedFaces.value.includes(face)) selectedFaces.value = [...selectedFaces.value, face]
  mode.value = 'uv'
}

function toggleFace(face: TextureFace): void {
  selectedFace.value = face
  if (!multiSelect.value) {
    selectedFaces.value = [face]
    return
  }
  if (selectedFaces.value.includes(face)) {
    selectedFaces.value = selectedFaces.value.filter((entry) => entry !== face)
    if (!selectedFaces.value.length) selectedFaces.value = [face]
  } else selectedFaces.value = [...selectedFaces.value, face]
}

function toggleMultiSelect(): void {
  multiSelect.value = !multiSelect.value
  if (!multiSelect.value) selectedFaces.value = [selectedFace.value]
}

function updateBindingDraft(bindingId: string, uv: StudioUvRect): void {
  bindings.value = bindings.value.map((entry) => entry.id === bindingId ? { ...entry, uv: { ...uv } } : entry)
}

async function persistBinding(bindingId: string, uv: StudioUvRect): Promise<void> {
  const asset = selectedAsset.value
  try {
    const saved = await textureUvService.updateBindingUv(bindingId, uv, asset?.width ?? 16, asset?.height ?? 16, uvPrecision.value)
    bindings.value = bindings.value.map((entry) => entry.id === saved.id ? saved : entry)
  } catch (error) {
    toasts.push({ type: 'error', message: toAppError(error, locale.t('Addons Studio could not save this UV map.')).userMessage })
  }
}

function updateActiveDraft(uv: StudioUvRect): void {
  if (selectedBinding.value) updateBindingDraft(selectedBinding.value.id, uv)
}

async function persistActive(uv: StudioUvRect): Promise<void> {
  if (selectedBinding.value) await persistBinding(selectedBinding.value.id, uv)
}

async function applyBoxUv(): Promise<void> {
  if (!selectedCube.value || !selectedMaterial.value) {
    toasts.push({ type: 'info', message: locale.t('Choose a cube and material first.') })
    return
  }
  busy.value = true
  try {
    for (const face of faces) await saveFaceBinding(face)
    const saved = await textureUvService.applyBoxLayout(
      props.modelId,
      selectedCube.value.id,
      selectedCube.value.size,
      selectedAsset.value?.width ?? 16,
      selectedAsset.value?.height ?? 16,
    )
    const savedMap = new Map(saved.map((entry) => [entry.id, entry]))
    bindings.value = bindings.value.map((entry) => savedMap.get(entry.id) ?? entry)
    selectedFaces.value = [...faces]
    toasts.push({ type: 'success', message: locale.t('Box UV generated') })
  } catch (error) {
    toasts.push({ type: 'error', message: toAppError(error, locale.t('Addons Studio could not generate Box UV.')).userMessage })
  } finally {
    busy.value = false
  }
}

async function resetSelectedUv(): Promise<void> {
  const asset = selectedAsset.value
  if (!asset) return
  const selected = cubeBindings.value.filter((entry) => selectedFaces.value.includes(entry.face) && entry.materialId === selectedMaterialId.value)
  if (!selected.length) return
  const saved = await textureUvService.updateManyBindingsUv(
    selected.map((entry) => ({ bindingId: entry.id, uv: resetUvRect(asset.width, asset.height) })),
    asset.width,
    asset.height,
    uvPrecision.value,
  )
  const map = new Map(saved.map((entry) => [entry.id, entry]))
  bindings.value = bindings.value.map((entry) => map.get(entry.id) ?? entry)
  toasts.push({ type: 'success', message: locale.t('Selected UV faces reset') })
}

async function savePaint(blob: Blob, width: number, height: number): Promise<void> {
  const asset = selectedAsset.value
  if (!asset) return
  busy.value = true
  try {
    const saved = await textureRepository.replaceTexturePixels(asset.id, blob, width, height)
    assets.value = assets.value.map((entry) => entry.id === saved.id ? saved : entry)
    paintDirty.value = false
    toasts.push({ type: 'success', message: locale.t('Texture saved') })
  } catch (error) {
    toasts.push({ type: 'error', message: toAppError(error, locale.t('Addons Studio could not save this texture.')).userMessage })
  } finally {
    busy.value = false
  }
}

function startDivider(event: PointerEvent): void {
  const target = event.currentTarget as HTMLElement
  target.setPointerCapture(event.pointerId)
  dividerPointer = { id: event.pointerId, startY: event.clientY, startHeight: previewHeight.value }
}

function moveDivider(event: PointerEvent): void {
  if (!dividerPointer || dividerPointer.id !== event.pointerId) return
  previewHeight.value = Math.max(180, Math.min(globalThis.innerHeight * 0.58, dividerPointer.startHeight + event.clientY - dividerPointer.startY))
}

function finishDivider(event: PointerEvent): void {
  if (!dividerPointer || dividerPointer.id !== event.pointerId) return
  const target = event.currentTarget as HTMLElement
  if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId)
  dividerPointer = undefined
}

onBeforeUnmount(() => { dividerPointer = undefined })
</script>

<template>
  <main class="texture-core-view">
    <header class="topbar">
      <IconButton icon="arrow-left" :label="locale.t('Back to Texture Core')" @click="router.push({ name: 'texture-models', params: { projectId } })" />
      <div class="title-stack"><strong>{{ model?.name ?? locale.t('Texture Core') }}</strong><small>Texture Core 0.2 · {{ paintDirty ? locale.t('Unsaved paint') : locale.t('Saved') }}</small></div>
      <div class="top-actions"><IconButton icon="info" :label="locale.t('Inspector')" variant="surface" @click="inspectorOpen = !inspectorOpen" /></div>
    </header>

    <section v-if="loading" class="loading-state"><div class="spinner" /><strong>{{ locale.t('Preparing Texture Core…') }}</strong><small>{{ locale.t('Loading geometry, materials, UV atlas, and paint tools') }}</small></section>
    <section v-else-if="loadError || !model" class="error-state"><AppIcon name="alert-triangle" :size="34" /><h1>{{ locale.t('Texture Core unavailable') }}</h1><p>{{ loadError }}</p></section>

    <section v-else class="editor-shell" :style="editorStyle">
      <section class="preview-shell">
        <TextureModelPreview :model="model" :texture="selectedAsset" :selected-cube-id="selectedCubeId" :selected-face="selectedFace" @select-cube="selectCube" @select-face="selectFace" />
        <div class="preview-hud"><span>{{ selectedCube?.name ?? locale.t('Select a cube') }}</span><b>{{ faceLabel(selectedFace) }}</b><i>{{ selectedFaces.length }}×</i></div>
        <div class="cube-strip"><button v-for="cube in model.elements" :key="cube.id" type="button" :class="{ active: cube.id === selectedCubeId }" @click="selectCube(cube.id)">{{ cube.name }}</button></div>
      </section>

      <button class="split-handle" type="button" aria-label="Resize 3D and texture workspaces" @pointerdown="startDivider" @pointermove="moveDivider" @pointerup="finishDivider" @pointercancel="finishDivider"><span /></button>

      <section class="workspace-panel">
        <template v-if="mode === 'material'">
          <header class="workspace-heading"><div><p>{{ locale.t('Materials') }}</p><strong>{{ locale.t('Project material library') }}</strong></div><button type="button" class="compact-action" @click="startCreateMaterial">+ {{ locale.t('Material') }}</button></header>
          <div v-if="materials.length" class="material-ribbon">
            <button v-for="material in materials" :key="material.id" type="button" class="material-card" :class="{ active: selectedMaterialId === material.id }" @click="selectedMaterialId = material.id">
              <MaterialSwatch :blob="assetForMaterial(material)?.blob" :size="50" /><span><strong>{{ material.name }}</strong><small>{{ assetForMaterial(material) ? `${assetForMaterial(material)!.width}×${assetForMaterial(material)!.height}` : locale.t('No texture') }}</small></span>
            </button>
          </div>
          <div v-else class="mini-empty"><StudioIcon name="material" :size="36" /><strong>{{ locale.t('No materials yet') }}</strong><p>{{ locale.t('Create a material, then import a texture or start with a blank pixel canvas.') }}</p></div>
          <div v-if="selectedMaterial" class="material-command-bar">
            <button type="button" @click="openTexturePicker">{{ locale.t('Import Texture') }}</button><button type="button" @click="createBlankTexture(16)">16×16</button><button type="button" @click="createBlankTexture(32)">32×32</button><button type="button" @click="createBlankTexture(64)">64×64</button><button type="button" @click="createBlankTexture(128)">128×128</button>
            <button type="button" :disabled="!selectedCube" @click="applyMaterialToCube">{{ locale.t('Apply cube') }}</button><button type="button" :disabled="!selectedCube" @click="applyMaterialToSelection">{{ locale.t('Apply selection') }}</button>
          </div>
          <div v-if="selectedMaterial" class="material-preview-card"><MaterialSwatch :blob="selectedAsset?.blob" :size="72" /><div><strong>{{ selectedMaterial.name }}</strong><small><code>{{ selectedMaterial.identifier }}</code></small><span>{{ selectedAsset ? `${selectedAsset.width}×${selectedAsset.height} · ${selectedAsset.mimeType.replace('image/', '').toUpperCase()}` : locale.t('Texture not assigned') }}</span></div></div>
        </template>

        <template v-else-if="mode === 'uv'">
          <div class="uv-context-bar">
            <select v-model="selectedCubeId" aria-label="Cube"><option v-for="cube in model.elements" :key="cube.id" :value="cube.id">{{ cube.name }}</option></select>
            <div class="face-strip"><button v-for="face in faces" :key="face" type="button" :class="{ active: selectedFace === face, selected: selectedFaces.includes(face) }" @click="toggleFace(face)">{{ faceLabel(face) }}</button></div>
            <button type="button" class="multi-button" :class="{ active: multiSelect }" @click="toggleMultiSelect">Multi</button>
          </div>
          <div class="uv-powerbar">
            <label><span>{{ locale.t('Precision') }}</span><select v-model.number="uvPrecision"><option :value="0.25">0.25 px</option><option :value="0.5">0.5 px</option><option :value="1">1 px</option><option :value="2">2 px</option><option :value="4">4 px</option></select></label>
            <button type="button" :disabled="!selectedMaterial || !selectedCube" @click="applyBoxUv">{{ locale.t('Auto Box UV') }}</button>
            <button type="button" :disabled="!selectedAsset || !selectedFaces.length" @click="resetSelectedUv">{{ locale.t('Reset selected') }}</button>
            <span>{{ atlasBindings.length }}/6 {{ locale.t('mapped') }}</span>
          </div>
          <div v-if="!selectedBinding" class="map-face-prompt"><div><strong>{{ locale.t('This face is not mapped yet') }}</strong><small>{{ selectedMaterial ? locale.t('Apply the selected material to create its UV island.') : locale.t('Choose a material first.') }}</small></div><button type="button" :disabled="!selectedMaterial" @click="applyMaterialToFace()">{{ locale.t('Map face') }}</button></div>
          <TextureUvWorkspace
            :asset="selectedAsset"
            :binding="selectedBinding"
            :bindings="atlasBindings"
            :face="selectedFace"
            :selected-faces="selectedFaces"
            :precision="uvPrecision"
            :disabled="busy"
            @change="updateActiveDraft"
            @commit="persistActive"
            @change-binding="updateBindingDraft"
            @commit-binding="persistBinding"
            @select-face="selectFace"
            @box-uv="applyBoxUv"
          />
        </template>

        <TexturePaintCanvas v-else :asset="selectedAsset" :disabled="busy" @save="savePaint" @dirty-change="paintDirty = $event" />
      </section>

      <nav class="mode-tabs" :aria-label="locale.t('Texture tools')"><button type="button" :class="{ active: mode === 'material' }" @click="mode = 'material'"><StudioIcon name="material" :size="20" /><span>{{ locale.t('Material') }}</span></button><button type="button" :class="{ active: mode === 'uv' }" @click="mode = 'uv'"><AppIcon name="grid-3x3" :size="20" /><span>UV 2.0</span></button><button type="button" :class="{ active: mode === 'paint' }" @click="mode = 'paint'"><AppIcon name="pencil" :size="20" /><span>Paint 2.0</span></button></nav>

      <aside v-if="inspectorOpen" class="inspector-drawer"><header><div><small>{{ locale.t('Inspector') }}</small><strong>{{ selectedCube?.name ?? '—' }} · {{ faceLabel(selectedFace) }}</strong></div><button type="button" @click="inspectorOpen = false">×</button></header><dl><div><dt>{{ locale.t('Cube') }}</dt><dd>{{ selectedCube?.name ?? '—' }}</dd></div><div><dt>{{ locale.t('Faces') }}</dt><dd>{{ selectedFaces.map(faceLabel).join(', ') }}</dd></div><div><dt>{{ locale.t('Material') }}</dt><dd>{{ selectedFaceMaterial?.name ?? selectedMaterial?.name ?? '—' }}</dd></div><div><dt>{{ locale.t('Texture') }}</dt><dd>{{ selectedAsset ? `${selectedAsset.width}×${selectedAsset.height}` : '—' }}</dd></div><div><dt>UV</dt><dd>{{ selectedBinding ? `${selectedBinding.uv.x}, ${selectedBinding.uv.y} · ${selectedBinding.uv.width}×${selectedBinding.uv.height} · ${selectedBinding.uv.rotation}°` : locale.t('Not mapped yet') }}</dd></div><div><dt>{{ locale.t('Precision') }}</dt><dd>{{ uvPrecision }} px</dd></div></dl></aside>
    </section>

    <input ref="importInput" class="visually-hidden" type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" @change="importTexture" />
    <AppDialog :open="createOpen" :title="locale.t('Create Material')" :description="locale.t('Materials connect a Texture Core image to a model.')" @close="createOpen = false"><label class="dialog-field">{{ locale.t('Material Name') }}<input v-model="materialName" class="text-input" maxlength="80" autocomplete="off" @keydown.enter.prevent="createMaterial" /></label><template #actions><AppButton variant="ghost" @click="createOpen = false">{{ locale.t('Cancel') }}</AppButton><AppButton :loading="busy" @click="createMaterial">{{ locale.t('Create Material') }}</AppButton></template></AppDialog>
  </main>
</template>

<style scoped>
.texture-core-view { min-height: 100dvh; overflow: hidden; background: var(--color-app-bg); }.topbar { position: relative; z-index: 20; min-height: calc(var(--header-height) + env(safe-area-inset-top)); display: grid; grid-template-columns: var(--touch-target) minmax(0,1fr) auto; align-items: center; gap: .4rem; padding: env(safe-area-inset-top) max(.55rem,env(safe-area-inset-right)) 0 max(.55rem,env(safe-area-inset-left)); border-bottom: 1px solid var(--color-border); background: color-mix(in srgb,var(--color-app-bg) 95%,transparent); backdrop-filter: blur(18px); }.title-stack { min-width:0; display:grid; text-align:center; }.title-stack strong,.title-stack small { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.title-stack strong { font-size:.84rem; }.title-stack small { color:var(--color-text-subtle); font-size:.62rem; }.loading-state,.error-state { min-height:calc(100dvh - var(--header-height)); display:grid; place-items:center; align-content:center; gap:.55rem; padding:2rem; text-align:center; }.loading-state small,.error-state p { color:var(--color-text-subtle); font-size:.74rem; }.spinner { width:2rem; height:2rem; border:3px solid var(--color-border); border-top-color:var(--color-accent); border-radius:50%; animation:spin .75s linear infinite; }@keyframes spin { to { transform:rotate(360deg); } }
.editor-shell { position:relative; height:calc(100dvh - var(--header-height) - env(safe-area-inset-top)); display:grid; grid-template-rows:minmax(11rem,var(--preview-height)) .9rem minmax(0,1fr) calc(3.7rem + env(safe-area-inset-bottom)); overflow:hidden; }.preview-shell { position:relative; min-height:0; overflow:hidden; background:#111613; }.preview-hud { position:absolute; z-index:3; top:.6rem; left:.6rem; display:flex; align-items:center; gap:.3rem; border:1px solid #ffffff1c; border-radius:999px; padding:.28rem .45rem; background:#07110acc; color:#dce7df; font-size:.61rem; pointer-events:none; }.preview-hud b { color:#72e594; }.preview-hud i { color:#a5b0a9; font-style:normal; }.cube-strip { position:absolute; z-index:3; right:.45rem; bottom:.45rem; left:.45rem; display:flex; gap:.35rem; overflow-x:auto; padding:.2rem; scrollbar-width:none; }.cube-strip::-webkit-scrollbar { display:none; }.cube-strip button { flex:0 0 auto; min-height:2.35rem; max-width:9rem; overflow:hidden; border:1px solid #ffffff18; border-radius:.75rem; padding:0 .65rem; background:#111b16db; color:#cbd6cf; font-size:.65rem; font-weight:760; text-overflow:ellipsis; white-space:nowrap; }.cube-strip button.active { border-color:#62d884; background:#173923e8; color:#b9f7ca; }.split-handle { position:relative; z-index:5; display:grid; place-items:center; border:0; border-top:1px solid #ffffff12; border-bottom:1px solid #000; background:#171d1a; touch-action:none; }.split-handle span { width:2.8rem; height:.22rem; border-radius:999px; background:#667169; }
.workspace-panel { min-height:0; overflow:auto; overscroll-behavior:contain; background:#0f1311; }.workspace-heading { min-height:3.2rem; display:flex; align-items:center; justify-content:space-between; gap:.6rem; padding:.45rem .65rem; border-bottom:1px solid #ffffff12; }.workspace-heading > div { display:grid; gap:.05rem; }.workspace-heading p { margin:0; color:#6fdd90; font-size:.58rem; font-weight:850; letter-spacing:.08em; text-transform:uppercase; }.workspace-heading strong { font-size:.76rem; }.compact-action,.multi-button { min-height:2.5rem; border:1px solid #ffffff18; border-radius:.7rem; padding:0 .7rem; background:#1b2b21; color:#bdf4cc; font-size:.7rem; font-weight:800; }.material-ribbon { display:flex; gap:.55rem; overflow-x:auto; padding:.7rem; scrollbar-width:none; }.material-ribbon::-webkit-scrollbar { display:none; }.material-card { flex:0 0 9.5rem; min-height:5.4rem; display:flex; align-items:center; gap:.55rem; border:1px solid #ffffff14; border-radius:1rem; padding:.55rem; background:#171c19; color:#e2e9e4; text-align:left; }.material-card.active { border-color:#5bd77f; background:#173421; }.material-card > span:last-child { min-width:0; display:grid; gap:.1rem; }.material-card strong,.material-card small { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.material-card strong { font-size:.72rem; }.material-card small { color:#8d9992; font-size:.58rem; }.material-command-bar { display:flex; gap:.4rem; overflow-x:auto; padding:0 .7rem .7rem; }.material-command-bar button,.map-face-prompt button,.uv-powerbar button { flex:0 0 auto; min-height:2.7rem; border:1px solid #ffffff18; border-radius:.75rem; padding:0 .75rem; background:#202823; color:#e5ece7; font-size:.68rem; font-weight:780; }.material-command-bar button:disabled,.map-face-prompt button:disabled,.uv-powerbar button:disabled { opacity:.4; }.material-preview-card { display:flex; align-items:center; gap:.8rem; margin:0 .7rem .8rem; border:1px solid #ffffff12; border-radius:1rem; padding:.75rem; background:#151a17; }.material-preview-card > div { min-width:0; display:grid; gap:.12rem; }.material-preview-card small,.material-preview-card span { color:#8d9992; font-size:.62rem; }.mini-empty { min-height:10rem; display:grid; place-items:center; align-content:center; gap:.35rem; padding:1.2rem; color:#9aa59e; text-align:center; }.mini-empty p { max-width:22rem; margin:0; font-size:.68rem; line-height:1.45; }
.uv-context-bar { min-height:3rem; display:flex; align-items:center; gap:.45rem; padding:.4rem .55rem; border-bottom:1px solid #ffffff12; background:#151a17; }.uv-context-bar select,.uv-powerbar select { min-height:2.5rem; max-width:8.5rem; border:1px solid #ffffff18; border-radius:.65rem; padding:0 .55rem; background:#202622; color:#edf2ee; font-size:16px; }.face-strip { min-width:0; display:flex; flex:1; gap:.3rem; overflow-x:auto; scrollbar-width:none; }.face-strip::-webkit-scrollbar { display:none; }.face-strip button { flex:0 0 auto; min-height:2.5rem; border:1px solid #ffffff14; border-radius:.65rem; padding:0 .62rem; background:#202622; color:#9ea9a2; font-size:.64rem; font-weight:780; }.face-strip button.selected { border-color:#4b8d5e; color:#b5d9bf; }.face-strip button.active,.multi-button.active { border-color:#62dc86; background:#183a23; color:#c3f6d0; }.multi-button { padding:0 .6rem; background:#202622; color:#a6b0aa; }.uv-powerbar { display:flex; align-items:center; gap:.4rem; overflow-x:auto; padding:.4rem .55rem; border-bottom:1px solid #ffffff10; background:#111613; }.uv-powerbar label { display:flex; align-items:center; gap:.3rem; color:#929e96; font-size:.62rem; }.uv-powerbar span { flex:0 0 auto; color:#8f9b94; font-size:.62rem; }.map-face-prompt { display:flex; align-items:center; justify-content:space-between; gap:.6rem; margin:.55rem; border:1px solid #e1ba4d50; border-radius:.8rem; padding:.55rem; background:#2a2415; }.map-face-prompt > div { min-width:0; display:grid; gap:.1rem; }.map-face-prompt strong { font-size:.68rem; }.map-face-prompt small { color:#bdad82; font-size:.6rem; }
.mode-tabs { z-index:10; display:grid; grid-template-columns:repeat(3,1fr); border-top:1px solid var(--color-border); padding-bottom:env(safe-area-inset-bottom); background:color-mix(in srgb,var(--color-surface) 96%,#000); }.mode-tabs button { min-height:3.7rem; display:grid; place-items:center; align-content:center; gap:.12rem; border:0; border-top:2px solid transparent; background:transparent; color:var(--color-text-subtle); font-size:.62rem; font-weight:800; }.mode-tabs button.active { border-top-color:var(--color-accent); color:var(--color-accent); background:color-mix(in srgb,var(--color-accent) 8%,transparent); }
.inspector-drawer { position:absolute; z-index:25; top:.55rem; right:max(.55rem,env(safe-area-inset-right)); width:min(20rem,calc(100% - 1.1rem)); max-height:calc(100% - 1.1rem); overflow:auto; border:1px solid #ffffff18; border-radius:1rem; padding:.65rem; background:#171c19f5; box-shadow:0 18px 55px #000a; backdrop-filter:blur(18px); }.inspector-drawer header { display:flex; align-items:center; justify-content:space-between; gap:.5rem; }.inspector-drawer header > div { min-width:0; display:grid; }.inspector-drawer header small { color:#68d888; font-size:.58rem; font-weight:850; text-transform:uppercase; }.inspector-drawer header strong { overflow:hidden; font-size:.76rem; text-overflow:ellipsis; white-space:nowrap; }.inspector-drawer header button { width:2.5rem; height:2.5rem; border:0; border-radius:50%; background:#252d28; color:#fff; font-size:1.2rem; }.inspector-drawer dl { display:grid; gap:.15rem; margin:.65rem 0 0; }.inspector-drawer dl div { display:grid; grid-template-columns:5rem minmax(0,1fr); gap:.5rem; padding:.48rem 0; border-top:1px solid #ffffff0e; }.inspector-drawer dt { color:#8e9992; font-size:.62rem; }.inspector-drawer dd { margin:0; overflow-wrap:anywhere; color:#e4eae6; font-size:.65rem; text-align:right; }
.dialog-field { display:grid; gap:.35rem; color:var(--color-text-muted); font-size:.72rem; font-weight:700; }.text-input { min-height:var(--touch-target); border:1px solid var(--color-border-strong); border-radius:var(--radius-md); padding:0 .75rem; background:var(--color-input-bg); color:var(--color-text); font-size:16px; }.visually-hidden { position:fixed; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); }
@media (min-width:720px) { .editor-shell { width:min(100%,72rem); margin:0 auto; border-right:1px solid var(--color-border); border-left:1px solid var(--color-border); } }@media (max-width:390px) { .workspace-heading strong { font-size:.7rem; }.material-card { flex-basis:8.6rem; }.uv-context-bar select { max-width:6.6rem; }.uv-powerbar label span { display:none; } }
</style>
