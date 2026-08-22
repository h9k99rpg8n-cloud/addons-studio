<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import AppButton from '@/components/common/AppButton.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import StudioPageHeader from '@/components/common/StudioPageHeader.vue'
import { useProjectContext } from '@/composables/useProjectContext'
import { generateBlockPackage } from '@/core/bedrock/blockGenerator'
import { toAppError } from '@/core/errors/AppError'
import { BLOCKBENCH_WEB_URL, buildBlockbenchUrl, createStarterBedrockModel, safeModelFilename } from '@/core/integrations/blockbenchIntegration'
import { resourceRepository } from '@/core/resources/resourceRepository'
import { textureRepository } from '@/core/texture/textureRepository'
import { useLocaleStore } from '@/stores/locale'
import { useToastStore } from '@/stores/toasts'
import type { BlockResourcePayload, ModelResourcePayload, StudioResource } from '@/types/resource'
import type { StudioMaterial, StudioTextureAsset } from '@/types/texture'
import { downloadBlob } from '@/utils/download'

import BlockPreview from './BlockPreview.vue'

const props = defineProps<{
  projectId: string
  resourceId?: string
  resourceType: 'block' | 'block_model'
}>()

const router = useRouter()
const locale = useLocaleStore()
const toasts = useToastStore()
const { project, loading: projectLoading, error: projectError } = useProjectContext(() => props.projectId)
const loading = ref(true)
const busy = ref(false)
const loadError = ref('')
const name = ref('New Block')
const identifier = ref('')
const translations = ref([{ locale: 'en', name: 'New Block' }, { locale: 'es', name: 'Bloque nuevo' }])
const selectedLanguage = ref('pt')
const materialInput = ref<HTMLInputElement>()
const savedResource = ref<StudioResource<BlockResourcePayload>>()
const materials = ref<StudioMaterial[]>([])
const assets = ref<StudioTextureAsset[]>([])
const models = ref<StudioResource<ModelResourcePayload>[]>([])

const languageChoices = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
  { code: 'pt', label: 'Português' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'ja', label: '日本語' },
  { code: 'it', label: 'Italiano' },
  { code: 'ko', label: '한국어' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'pl', label: 'Polski' },
  { code: 'ru', label: 'Русский' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'zh-CN', label: '简体中文' },
  { code: 'zh-TW', label: '繁體中文' },
] as const

function defaultPayload(): BlockResourcePayload {
  return {
    displayName: 'New Block',
    nameColor: '#ffffff',
    translations: [],
    textures: { mode: 'all' },
    light: { enabled: false, level: 0, vibrantColorEnabled: false, color: '#ffffff' },
    transparency: 'opaque',
    blocksLight: true,
    destroyTime: 1.5,
    explosionResistance: 6,
    recommendedTool: 'none',
    requiredToolLevel: 'none',
    dropIdentifier: '',
    silkTouch: false,
    fortune: false,
    sound: 'stone',
    collision: 'full',
    selectionBox: 'full',
    flammable: false,
    friction: 0.6,
    movementSpeed: 1,
    mapColor: '#808080',
    orientation: 'none',
    creativeCategory: 'construction',
    maxStackSize: 64,
    recipe: { enabled: false },
    pluginIds: [],
    customModel: props.resourceType === 'block_model'
      ? {
        scale: { x: 1, y: 1, z: 1 },
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        collision: 'automatic',
        renderMethod: 'opaque',
        animationsEnabled: false,
      }
      : undefined,
  }
}

const payload = reactive<BlockResourcePayload>(defaultPayload())
const isModel = computed(() => props.resourceType === 'block_model')
const pageTitle = computed(() => locale.t(isModel.value ? 'Block Model' : 'Block'))
const validIdentifier = computed(() => /^[a-z0-9_]+:[a-z0-9_]+$/.test(identifier.value))

function assetForMaterialId(id?: string): StudioTextureAsset | undefined {
  const material = materials.value.find((entry) => entry.id === id)
  return assets.value.find((asset) => asset.id === material?.textureAssetId)
}

const previewTop = computed(() => assetForMaterialId(payload.textures.mode === 'all' ? payload.textures.all : payload.textures.top ?? payload.textures.up))
const previewSide = computed(() => assetForMaterialId(payload.textures.mode === 'all' ? payload.textures.all : payload.textures.side))
const previewBottom = computed(() => assetForMaterialId(payload.textures.mode === 'all' ? payload.textures.all : payload.textures.bottom ?? payload.textures.down))
const previewNorth = computed(() => assetForMaterialId(payload.textures.mode === 'per_face' ? payload.textures.north : undefined))
const previewEast = computed(() => assetForMaterialId(payload.textures.mode === 'per_face' ? payload.textures.east : undefined))

watch(name, (value) => {
  payload.displayName = value
  if (!props.resourceId && project.value) {
    const suffix = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'block'
    identifier.value = `${project.value.namespace}:${suffix}`
    const english = translations.value.find((entry) => entry.locale === 'en')
    if (english) english.name = value
  }
})

onMounted(async () => {
  try {
    ;[materials.value, assets.value, models.value] = await Promise.all([
      textureRepository.listMaterials(props.projectId),
      textureRepository.listTextureAssets(props.projectId),
      resourceRepository.list<ModelResourcePayload>(props.projectId, 'model'),
    ])
    if (props.resourceId) {
      const resource = await resourceRepository.get<BlockResourcePayload>(props.resourceId)
      if (!resource || resource.projectId !== props.projectId || resource.type !== props.resourceType) throw new Error('Resource unavailable')
      savedResource.value = resource
      name.value = resource.name
      identifier.value = resource.identifier ?? ''
      Object.assign(payload, defaultPayload(), structuredClone(resource.payload))
      translations.value = resource.payload.translations.length
        ? structuredClone(resource.payload.translations)
        : [{ locale: 'en', name: resource.payload.displayName }]
    } else if (project.value) {
      identifier.value = `${project.value.namespace}:new_block`
    }
  } catch (error) {
    loadError.value = toAppError(error, locale.t('Addons Studio could not open this block.')).userMessage
  } finally {
    loading.value = false
  }
})

function addLanguage(): void {
  const requested = selectedLanguage.value.trim()
  const known = languageChoices.find((choice) => (
    choice.code.toLowerCase() === requested.toLowerCase()
    || choice.label.toLocaleLowerCase() === requested.toLocaleLowerCase()
  ))
  const parts = (known?.code ?? requested.replace('_', '-')).split('-')
  const code = parts.length === 1
    ? parts[0]!.toLowerCase()
    : `${parts[0]!.toLowerCase()}-${parts[1]!.toUpperCase()}`
  if (!/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(code)) {
    toasts.push({ type: 'warning', message: locale.t('Use a language code such as it or zh-CN.') })
    return
  }
  if (translations.value.some((entry) => entry.locale === code)) return
  translations.value.push({ locale: code, name: name.value })
  selectedLanguage.value = ''
}

function removeLanguage(code: string): void {
  if (translations.value.length <= 1) return
  translations.value = translations.value.filter((entry) => entry.locale !== code)
}

function assignImportedMaterial(materialId: string): void {
  if (payload.textures.mode === 'all') {
    payload.textures.all = materialId
    return
  }
  if (payload.textures.mode === 'top_side_bottom') {
    const field = (['top', 'side', 'bottom'] as const).find((key) => !payload.textures[key]) ?? 'side'
    payload.textures[field] = materialId
    return
  }
  const face = (['north', 'south', 'east', 'west', 'up', 'down'] as const)
    .find((key) => !payload.textures[key]) ?? 'north'
  payload.textures[face] = materialId
}

async function importMaterialImage(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  let provisionalMaterialId: string | undefined
  try {
    const materialName = file.name.replace(/\.[^.]+$/, '') || locale.t('Material')
    const material = await textureRepository.createMaterial({ projectId: props.projectId, name: materialName })
    provisionalMaterialId = material.id
    const result = await textureRepository.importTexture(material.id, file)
    materials.value.unshift(result.material)
    assets.value.unshift(result.asset)
    assignImportedMaterial(result.material.id)
    toasts.push({ type: 'success', message: locale.t('Material imported and selected') })
  } catch (error) {
    if (provisionalMaterialId) await textureRepository.deleteMaterial(provisionalMaterialId).catch(() => undefined)
    toasts.push({ type: 'error', message: toAppError(error, locale.t('Texture import failed.')).userMessage })
  } finally {
    input.value = ''
  }
}

async function save(showToast = true): Promise<StudioResource<BlockResourcePayload> | undefined> {
  if (!name.value.trim()) {
    toasts.push({ type: 'warning', message: locale.t('Give this block a name.') })
    return undefined
  }
  if (!validIdentifier.value) {
    toasts.push({ type: 'warning', message: locale.t('Use an identifier such as namespace:block_name.') })
    return undefined
  }
  if (isModel.value && !payload.customModel?.resourceId) {
    toasts.push({ type: 'warning', message: locale.t('Choose a Blockbench model for this custom block.') })
    return undefined
  }
  busy.value = true
  try {
    const nextPayload = structuredClone({ ...payload, displayName: name.value, translations: translations.value })
    const resource = savedResource.value
      ? await resourceRepository.update<BlockResourcePayload>(savedResource.value.id, { name: name.value, identifier: identifier.value, payload: nextPayload })
      : await resourceRepository.create<BlockResourcePayload>({ projectId: props.projectId, type: props.resourceType, name: name.value, identifier: identifier.value, payload: nextPayload })
    savedResource.value = resource
    if (showToast) toasts.push({ type: 'success', message: locale.t('Block saved') })
    if (!props.resourceId) {
      await router.replace({
        name: isModel.value ? 'block-model-editor' : 'block-editor',
        params: { projectId: props.projectId, resourceId: resource.id },
      })
    }
    return resource
  } catch (error) {
    toasts.push({ type: 'error', message: toAppError(error, locale.t('Addons Studio could not save this block.')).userMessage })
    return undefined
  } finally {
    busy.value = false
  }
}

async function exportFiles(): Promise<void> {
  const resource = await save(false)
  if (!resource || !project.value) return
  try {
    const model = resource.payload.customModel?.resourceId
      ? models.value.find((entry) => entry.id === resource.payload.customModel?.resourceId)
      : undefined
    const modelAsset = model ? await resourceRepository.getAsset(model.payload.assetId) : undefined
    const result = await generateBlockPackage({
      project: project.value,
      block: resource,
      materials: materials.value,
      textureAssets: assets.value,
      model,
      modelAsset: modelAsset?.blob,
    })
    downloadBlob(result.blob, result.filename)
    toasts.push({ type: result.warnings.length ? 'warning' : 'success', message: result.warnings.length ? locale.t('Files exported with {count} warnings.', { count: result.warnings.length }) : locale.t('Bedrock files exported') })
  } catch (error) {
    toasts.push({ type: 'error', message: toAppError(error, locale.t('Addons Studio could not export this block.')).userMessage })
  }
}

function openUvMapping(): void {
  const selectedModel = payload.customModel?.resourceId
    ? models.value.find((model) => model.id === payload.customModel?.resourceId)
    : undefined
  if (selectedModel) {
    void openStoredModel(selectedModel)
    return
  }
  const geometryName = `geometry.${project.value?.namespace ?? 'addons_studio'}.${identifier.value.split(':')[1] || 'block'}`
  const starter = createStarterBedrockModel({ name: name.value, identifier: geometryName })
  const url = buildBlockbenchUrl(safeModelFilename(name.value, starter.format), starter.text)
  window.open(url ?? BLOCKBENCH_WEB_URL, '_blank', 'noopener,noreferrer')
  toasts.push({ type: 'info', message: locale.t('Blockbench opened with a 16×16×16 cube. Import the selected material images there to adjust UV mapping.') })
}

async function openStoredModel(model: StudioResource<ModelResourcePayload>): Promise<void> {
  const popup = window.open('about:blank', '_blank')
  if (popup) popup.opener = null
  const asset = await resourceRepository.getAsset(model.payload.assetId)
  if (!asset) {
    popup?.close()
    return
  }
  const text = await asset.blob.text()
  const url = buildBlockbenchUrl(model.payload.originalFilename, text)
  if (popup && url) popup.location.replace(url)
  else {
    if (popup) popup.location.replace(BLOCKBENCH_WEB_URL)
    downloadBlob(asset.blob, model.payload.originalFilename)
  }
}
</script>

<template>
  <main class="block-editor">
    <StudioPageHeader :title="pageTitle" :subtitle="project?.name" :eyebrow="savedResource ? locale.t('Editing resource') : locale.t('New resource')" :icon="isModel ? 'boxes' : 'blocks'">
      <template #actions><button class="header-action" type="button" :disabled="busy" :aria-label="locale.t('Export files')" @click="exportFiles"><AppIcon name="download" :size="20" /></button><button class="header-action header-action--primary" type="button" :disabled="busy" :aria-label="locale.t('Save')" @click="save()"><AppIcon name="save" :size="20" /></button></template>
    </StudioPageHeader>

    <div class="editor-body">
      <section v-if="projectLoading || loading" class="state">{{ locale.t('Opening project') }}</section>
      <section v-else-if="projectError || loadError || !project" class="state state--error">{{ projectError || loadError }}</section>
      <template v-else>
        <div class="editor-layout">
          <form class="editor-form" @submit.prevent="save()">
            <section class="form-card identity-card">
              <header><span>01</span><div><h2>{{ locale.t('Identity') }}</h2><p>{{ locale.t('Human name and Bedrock identifier') }}</p></div></header>
              <label>{{ locale.t('Display Name') }}<input v-model="name" maxlength="80" /></label>
              <label>{{ locale.t('Internal identifier') }}<input v-model="identifier" :class="{ invalid: identifier && !validIdentifier }" autocapitalize="off" spellcheck="false" /><small>{{ project.namespace }}:example_block</small></label>
              <label>{{ locale.t('Name color') }}<span class="color-field"><input v-model="payload.nameColor" type="color" /><code>{{ payload.nameColor }}</code></span></label>
            </section>

            <section class="form-card">
              <header><span>02</span><div><h2>{{ locale.t('Languages') }}</h2><p>{{ locale.t('Addons Studio generates the matching .lang entries.') }}</p></div></header>
              <div class="translation-list"><div v-for="entry in translations" :key="entry.locale"><strong>{{ entry.locale }}</strong><input v-model="entry.name" :aria-label="`${entry.locale} name`" /><button type="button" :disabled="translations.length<=1" @click="removeLanguage(entry.locale)"><AppIcon name="x" :size="17" /></button></div></div>
              <div class="add-language"><input v-model="selectedLanguage" list="block-language-options" type="search" :placeholder="locale.t('Search or enter language code')" autocapitalize="off" spellcheck="false" @keydown.enter.prevent="addLanguage" /><datalist id="block-language-options"><option v-for="choice in languageChoices" :key="choice.code" :value="choice.code">{{ choice.label }}</option></datalist><button type="button" @click="addLanguage">+ {{ locale.t('Add language') }}</button></div>
            </section>

            <section v-if="isModel" class="form-card">
              <header><span>03</span><div><h2>{{ locale.t('Blockbench Model') }}</h2><p>{{ locale.t('The geometry stays editable as an external model resource.') }}</p></div></header>
              <label>{{ locale.t('Saved model') }}<select v-model="payload.customModel!.resourceId"><option value="">{{ locale.t('Choose model') }}</option><option v-for="model in models" :key="model.id" :value="model.id">{{ model.name }} · {{ model.identifier }}</option></select></label>
              <div class="inline-actions"><button type="button" @click="router.push({name:'models',params:{projectId}})"><AppIcon name="folder" :size="18" />{{ locale.t('Model library') }}</button><button type="button" :disabled="!payload.customModel?.resourceId" @click="openUvMapping"><AppIcon name="external-link" :size="18" />{{ locale.t('Edit in Blockbench') }}</button></div>
              <details><summary>{{ locale.t('Transform & rendering') }}</summary><div class="details-grid"><label>{{ locale.t('Render method') }}<select v-model="payload.customModel!.renderMethod"><option value="opaque">{{ locale.t('Opaque') }}</option><option value="alpha_test">{{ locale.t('Cutout') }}</option><option value="blend">{{ locale.t('Transparent') }}</option></select></label><label>{{ locale.t('Collision') }}<select v-model="payload.customModel!.collision"><option value="automatic">{{ locale.t('Automatic') }}</option><option value="full">{{ locale.t('Full block') }}</option><option value="none">{{ locale.t('None') }}</option><option value="custom">{{ locale.t('Custom') }}</option></select></label><div class="vector"><strong>{{ locale.t('Scale') }}</strong><input v-model.number="payload.customModel!.scale.x" type="number" step="0.01" aria-label="Scale X" /><input v-model.number="payload.customModel!.scale.y" type="number" step="0.01" aria-label="Scale Y" /><input v-model.number="payload.customModel!.scale.z" type="number" step="0.01" aria-label="Scale Z" /></div><div class="vector"><strong>{{ locale.t('Position') }}</strong><input v-model.number="payload.customModel!.position.x" type="number" step="0.25" aria-label="Position X" /><input v-model.number="payload.customModel!.position.y" type="number" step="0.25" aria-label="Position Y" /><input v-model.number="payload.customModel!.position.z" type="number" step="0.25" aria-label="Position Z" /></div><div class="vector"><strong>{{ locale.t('Rotation') }}</strong><input v-model.number="payload.customModel!.rotation.x" type="number" step="1" aria-label="Rotation X" /><input v-model.number="payload.customModel!.rotation.y" type="number" step="1" aria-label="Rotation Y" /><input v-model.number="payload.customModel!.rotation.z" type="number" step="1" aria-label="Rotation Z" /></div></div></details>
            </section>

            <section class="form-card">
              <header><span>{{ isModel ? '04' : '03' }}</span><div><h2>{{ locale.t('Materials') }}</h2><p>{{ locale.t('Choose reusable images from the project library.') }}</p></div></header>
              <label>{{ locale.t('Texture layout') }}<select v-model="payload.textures.mode"><option value="all">{{ locale.t('Same texture on every face') }}</option><option value="top_side_bottom">{{ locale.t('Top / side / bottom') }}</option><option value="per_face">{{ locale.t('One texture per face') }}</option></select></label>
              <label v-if="payload.textures.mode==='all'">{{ locale.t('All faces') }}<select v-model="payload.textures.all"><option value="">{{ locale.t('Choose material') }}</option><option v-for="material in materials" :key="material.id" :value="material.id">{{ material.name }}</option></select></label>
              <div v-else-if="payload.textures.mode==='top_side_bottom'" class="details-grid"><label>{{ locale.t('Top') }}<select v-model="payload.textures.top"><option value="">—</option><option v-for="material in materials" :key="material.id" :value="material.id">{{ material.name }}</option></select></label><label>{{ locale.t('Side') }}<select v-model="payload.textures.side"><option value="">—</option><option v-for="material in materials" :key="material.id" :value="material.id">{{ material.name }}</option></select></label><label>{{ locale.t('Bottom') }}<select v-model="payload.textures.bottom"><option value="">—</option><option v-for="material in materials" :key="material.id" :value="material.id">{{ material.name }}</option></select></label></div>
              <div v-else class="face-grid"><label v-for="face in ['north','south','east','west','up','down'] as const" :key="face">{{ locale.t(face) }}<select v-model="payload.textures[face]"><option value="">—</option><option v-for="material in materials" :key="material.id" :value="material.id">{{ material.name }}</option></select></label></div>
              <div class="inline-actions inline-actions--materials"><button type="button" @click="router.push({name:'materials',params:{projectId}})"><AppIcon name="image" :size="18" />{{ locale.t('Material library') }}</button><button type="button" @click="materialInput?.click()"><AppIcon name="image-plus" :size="18" />{{ locale.t('Import from device') }}</button><button type="button" @click="openUvMapping"><AppIcon name="external-link" :size="18" />{{ locale.t('Edit mapping UV') }}</button></div>
              <input ref="materialInput" class="visually-hidden" type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" @change="importMaterialImage" />
            </section>

            <section class="form-card">
              <header><span>{{ isModel ? '05' : '04' }}</span><div><h2>{{ locale.t('Lighting') }}</h2><p>{{ locale.t('Only relevant options appear when light is enabled.') }}</p></div></header>
              <label class="switch-row"><span><strong>{{ locale.t('Emits light') }}</strong><small>{{ locale.t('Minecraft light level 0–15') }}</small></span><input v-model="payload.light.enabled" type="checkbox" /></label>
              <template v-if="payload.light.enabled"><label>{{ locale.t('Light level') }}<input v-model.number="payload.light.level" type="range" min="0" max="15" step="1" /><output>{{ payload.light.level }}</output></label><label class="switch-row"><span><strong>{{ locale.t('Colored light') }}</strong><small>Vibrant Visuals</small></span><input v-model="payload.light.vibrantColorEnabled" type="checkbox" /></label><label v-if="payload.light.vibrantColorEnabled">RGB / HEX<span class="color-field"><input v-model="payload.light.color" type="color" /><code>{{ payload.light.color }}</code></span><small class="warning">{{ locale.t('Colored lighting depends on Vibrant Visuals and is preserved as editor metadata until a supported Bedrock field is available.') }}</small></label></template>
            </section>

            <details class="form-card" open><summary><span>{{ isModel ? '06' : '05' }}</span><div><h2>{{ locale.t('Physical properties') }}</h2><p>{{ locale.t('Mining, collision, sound, and movement') }}</p></div><AppIcon name="chevron-right" :size="19" /></summary><div class="details-grid"><label>{{ locale.t('Transparency') }}<select v-model="payload.transparency"><option value="opaque">{{ locale.t('Opaque') }}</option><option value="cutout">{{ locale.t('Cutout') }}</option><option value="blend">{{ locale.t('Transparent') }}</option></select></label><label>{{ locale.t('Destroy time') }}<input v-model.number="payload.destroyTime" type="number" min="0" step="0.1" /></label><label>{{ locale.t('Explosion resistance') }}<input v-model.number="payload.explosionResistance" type="number" min="0" step="0.1" /></label><label>{{ locale.t('Recommended tool') }}<select v-model="payload.recommendedTool"><option value="none">{{ locale.t('None') }}</option><option value="pickaxe">{{ locale.t('Pickaxe') }}</option><option value="axe">{{ locale.t('Axe') }}</option><option value="shovel">{{ locale.t('Shovel') }}</option><option value="hoe">{{ locale.t('Hoe') }}</option><option value="sword">{{ locale.t('Sword') }}</option></select></label><label>{{ locale.t('Required level') }}<select v-model="payload.requiredToolLevel"><option value="none">{{ locale.t('None') }}</option><option value="wood">{{ locale.t('Wood') }}</option><option value="stone">{{ locale.t('Stone') }}</option><option value="iron">{{ locale.t('Iron') }}</option><option value="diamond">{{ locale.t('Diamond') }}</option><option value="netherite">{{ locale.t('Netherite') }}</option></select></label><label>{{ locale.t('Sound material') }}<select v-model="payload.sound"><option value="stone">Stone</option><option value="wood">Wood</option><option value="metal">Metal</option><option value="glass">Glass</option><option value="grass">Grass</option><option value="cloth">Cloth</option></select></label><label>{{ locale.t('Collision Box') }}<select v-model="payload.collision"><option value="full">{{ locale.t('Full block') }}</option><option value="none">{{ locale.t('None') }}</option><option value="custom">{{ locale.t('Custom') }}</option></select></label><label>{{ locale.t('Selection Box') }}<select v-model="payload.selectionBox"><option value="full">{{ locale.t('Full block') }}</option><option value="none">{{ locale.t('None') }}</option><option value="custom">{{ locale.t('Custom') }}</option></select></label><label>{{ locale.t('Friction') }}<input v-model.number="payload.friction" type="number" min="0" max="0.9" step="0.05" /></label><label>{{ locale.t('Walk speed') }}<input v-model.number="payload.movementSpeed" type="number" min="0" max="4" step="0.05" /></label><label>{{ locale.t('Map color') }}<span class="color-field"><input v-model="payload.mapColor" type="color" /><code>{{ payload.mapColor }}</code></span></label><label>{{ locale.t('Orientation') }}<select v-model="payload.orientation"><option value="none">{{ locale.t('None') }}</option><option value="cardinal">{{ locale.t('Cardinal') }}</option><option value="facing">{{ locale.t('Facing') }}</option></select></label><label>{{ locale.t('Creative category') }}<select v-model="payload.creativeCategory"><option value="construction">{{ locale.t('Construction') }}</option><option value="nature">{{ locale.t('Nature') }}</option><option value="equipment">{{ locale.t('Equipment') }}</option><option value="items">{{ locale.t('Items') }}</option><option value="none">{{ locale.t('Hidden') }}</option></select></label><label>{{ locale.t('Max stack') }}<input v-model.number="payload.maxStackSize" type="number" min="1" max="64" step="1" /></label></div><div class="switch-list"><label class="switch-row"><span><strong>{{ locale.t('Blocks light') }}</strong></span><input v-model="payload.blocksLight" type="checkbox" /></label><label class="switch-row"><span><strong>{{ locale.t('Flammable') }}</strong></span><input v-model="payload.flammable" type="checkbox" /></label><label class="switch-row"><span><strong>Silk Touch</strong></span><input v-model="payload.silkTouch" type="checkbox" /></label><label class="switch-row"><span><strong>Fortune</strong></span><input v-model="payload.fortune" type="checkbox" /></label></div><label>{{ locale.t('Drop identifier') }}<input v-model="payload.dropIdentifier" placeholder="minecraft:stone" autocapitalize="off" spellcheck="false" /></label></details>

            <section class="form-card">
              <header><span>{{ isModel ? '07' : '06' }}</span><div><h2>{{ locale.t('Recipe') }}</h2><p>{{ locale.t('Optional and linked from the central recipe library') }}</p></div></header>
              <label class="switch-row"><span><strong>{{ locale.t('Has recipe') }}</strong><small>{{ locale.t('Keep off when this block should not be crafted.') }}</small></span><input v-model="payload.recipe.enabled" type="checkbox" /></label>
              <p v-if="payload.recipe.enabled" class="warning">{{ locale.t('The central Recipes editor is not enabled in this Rework build, so no fake recipe is generated.') }}</p>
            </section>

            <footer class="save-bar"><AppButton variant="secondary" size="large" @click="exportFiles"><template #icon><AppIcon name="download" :size="20" /></template>{{ locale.t('Export files') }}</AppButton><AppButton size="large" :loading="busy" @click="save()"><template #icon><AppIcon name="save" :size="20" /></template>{{ locale.t('Save Block') }}</AppButton></footer>
          </form>

          <aside class="preview-column"><div class="preview-sticky"><BlockPreview :top="previewTop?.blob" :side="previewSide?.blob" :bottom="previewBottom?.blob" :north="previewNorth?.blob" :east="previewEast?.blob" /><div class="preview-meta"><strong>{{ name }}</strong><code>{{ identifier || `${project.namespace}:block` }}</code><span>{{ locale.t(isModel ? 'Custom geometry block' : 'Standard block') }}</span></div></div></aside>
        </div>
      </template>
    </div>
  </main>
</template>

<style scoped>
.editor-body{width:min(100%,var(--content-max));margin:0 auto;padding:1rem max(var(--page-gutter),env(safe-area-inset-right)) 2rem max(var(--page-gutter),env(safe-area-inset-left))}.header-action{width:44px;height:44px;display:grid;place-items:center;border:1px solid var(--color-border);border-radius:var(--radius-md);background:var(--color-surface);color:var(--color-text)}.header-action--primary{border-color:var(--color-accent);background:var(--color-accent);color:var(--color-on-accent)}.state{min-height:55dvh;display:grid;place-items:center;color:var(--color-text-subtle)}.state--error{color:var(--color-danger)}.editor-layout{display:grid;gap:1rem}.editor-form{min-width:0;display:grid;gap:.8rem}.form-card{min-width:0;border:1px solid var(--color-border);border-radius:var(--radius-xl);padding:var(--card-padding);background:var(--color-surface);box-shadow:var(--shadow-card)}.form-card>header,.form-card>summary{display:grid;grid-template-columns:2.35rem minmax(0,1fr) auto;align-items:center;gap:.7rem;margin-bottom:.85rem}.form-card>header>span,.form-card>summary>span{width:2.35rem;height:2.35rem;display:grid;place-items:center;border-radius:var(--radius-md);background:var(--color-accent);color:var(--color-on-accent);font-family:var(--font-mono);font-size:.62rem;font-weight:900}.form-card h2{margin:0;font-size:.92rem}.form-card header p,.form-card summary p{margin:.15rem 0 0;color:var(--color-text-subtle);font-size:.63rem;line-height:1.4}.form-card>label,.details-grid>label,.face-grid>label{display:grid;gap:.35rem;margin-top:.7rem;color:var(--color-text-muted);font-size:.69rem;font-weight:720}.form-card input:not([type='checkbox']):not([type='color']):not([type='range']),.form-card select{width:100%;min-height:44px;border:1px solid var(--color-border-strong);border-radius:var(--radius-md);padding:0 .75rem;background:var(--color-input-bg);color:var(--color-text);font:inherit;font-size:16px}.form-card input.invalid{border-color:var(--color-danger)}.form-card label>small{color:var(--color-text-subtle);font-size:.58rem;font-weight:500}.color-field{min-height:44px;display:flex;align-items:center;gap:.65rem;border:1px solid var(--color-border-strong);border-radius:var(--radius-md);padding:.3rem .55rem;background:var(--color-input-bg)}.color-field input{width:2.25rem;height:2.25rem;border:0;padding:0;background:transparent}.color-field code{color:var(--color-text-subtle);font-size:.65rem}.translation-list{display:grid;gap:.45rem}.translation-list>div{display:grid;grid-template-columns:3rem minmax(0,1fr) 44px;align-items:center;gap:.45rem}.translation-list strong{text-transform:uppercase;font-family:var(--font-mono);font-size:.61rem}.translation-list input{min-width:0;min-height:44px;border:1px solid var(--color-border);border-radius:var(--radius-md);padding:0 .7rem;background:var(--color-input-bg);color:var(--color-text);font-size:16px}.translation-list button{width:44px;height:44px;display:grid;place-items:center;border:0;border-radius:var(--radius-md);background:transparent;color:var(--color-text-subtle)}.add-language{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:.5rem;margin-top:.65rem}.add-language button,.inline-actions button{min-height:44px;display:flex;align-items:center;justify-content:center;gap:.4rem;border:1px solid var(--color-border);border-radius:var(--radius-md);padding:0 .7rem;background:var(--color-surface-raised);color:var(--color-text);font-size:.65rem;font-weight:780}.inline-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.5rem;margin-top:.75rem}.details-grid,.face-grid{display:grid;gap:0 .7rem}.face-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.form-card details{margin-top:.75rem;border-top:1px solid var(--color-border);padding-top:.75rem}.form-card details summary{min-height:44px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;font-size:.72rem;font-weight:780}.vector{display:grid;grid-template-columns:4rem repeat(3,minmax(0,1fr));align-items:center;gap:.4rem;margin-top:.7rem}.vector strong{font-size:.65rem}.vector input{min-width:0!important;padding:0 .35rem!important;text-align:center}.switch-row{min-height:3.4rem!important;display:flex!important;align-items:center;justify-content:space-between;gap:1rem;border-bottom:1px solid var(--color-border);margin-top:0!important}.switch-row>span{display:grid;gap:.1rem}.switch-row strong{font-size:.72rem}.switch-row input{width:2.8rem;height:1.55rem;accent-color:var(--color-accent)}.switch-list{margin-top:.7rem}.form-card input[type='range']{width:100%;accent-color:var(--color-accent)}.form-card output{color:var(--color-accent);font-family:var(--font-mono);font-size:.7rem}.warning{margin:.7rem 0 0;border-left:3px solid var(--color-warning);padding:.6rem .7rem;background:var(--color-warning-soft);color:var(--color-warning-text);font-size:.65rem;line-height:1.45}.form-card>summary{margin:-.15rem 0 0;list-style:none;cursor:pointer}.form-card>summary::-webkit-details-marker{display:none}.form-card[open]>summary>svg{transform:rotate(90deg)}.save-bar{position:sticky;z-index:10;bottom:calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + .4rem);display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.5rem;border:1px solid var(--color-border);border-radius:var(--radius-xl);padding:.55rem;background:color-mix(in srgb,var(--color-app-bg) 92%,transparent);backdrop-filter:blur(18px)}.preview-column{order:-1}.preview-sticky{display:grid;gap:.65rem}.preview-meta{display:grid;gap:.15rem;border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:.75rem;background:var(--color-surface)}.preview-meta strong,.preview-meta code{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.preview-meta strong{font-size:.78rem}.preview-meta code,.preview-meta span{color:var(--color-text-subtle);font-size:.6rem}@media(min-width:720px){.details-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.face-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(min-width:960px){.editor-layout{grid-template-columns:minmax(0,1fr) 20rem;align-items:start}.preview-column{order:0}.preview-sticky{position:sticky;top:6rem}.save-bar{bottom:1rem}}
.add-language > input{min-width:0;min-height:44px;border:1px solid var(--color-border-strong);border-radius:var(--radius-md);padding:0 .75rem;background:var(--color-input-bg);color:var(--color-text);font-size:16px}
.inline-actions--materials > button:last-child{grid-column:1/-1}
</style>
