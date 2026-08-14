<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'

import AppButton from '@/components/common/AppButton.vue'
import AppDialog from '@/components/common/AppDialog.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import BottomSheet from '@/components/common/BottomSheet.vue'
import ProjectIcon from '@/components/project/ProjectIcon.vue'
import { toAppError } from '@/core/errors/AppError'
import {
  projectPackageService,
  type InspectedProjectPackage,
  type ProjectPackagePreview,
  type ProjectPackageStage,
} from '@/core/project/projectPackageService'
import { useProjectStore } from '@/stores/projects'
import { useLocaleStore } from '@/stores/locale'
import { useToastStore } from '@/stores/toasts'
import type { StudioProject } from '@/types/project'

const emit = defineEmits<{
  imported: [project: StudioProject]
}>()

const projects = useProjectStore()
const toasts = useToastStore()
const locale = useLocaleStore()
const input = ref<HTMLInputElement>()
const inspected = shallowRef<InspectedProjectPackage>()
const preview = ref<ProjectPackagePreview>()
const previewOpen = ref(false)
const progressOpen = ref(false)
const stage = ref<ProjectPackageStage>('reading')
const status = ref<'working' | 'done' | 'error'>('working')
const errorMessage = ref('')
const importedProject = ref<StudioProject>()

const stageLabels: Readonly<Record<ProjectPackageStage, string>> = {
  reading: 'Reading package',
  validating: 'Validating manifest',
  models: 'Importing models',
  assets: 'Importing editor assets',
  finishing: 'Finishing safely',
}

const stageOrder: readonly ProjectPackageStage[] = ['reading', 'validating', 'models', 'assets', 'finishing']
const currentStageIndex = computed(() => stageOrder.indexOf(stage.value))

function openPicker(): void {
  if (status.value === 'working' && progressOpen.value) return
  input.value?.click()
}

defineExpose({ openPicker })

function updateStage(next: ProjectPackageStage): void {
  stage.value = next
}

async function inspectFile(event: Event): Promise<void> {
  const fileInput = event.target as HTMLInputElement
  const file = fileInput.files?.[0]
  if (!file) return
  progressOpen.value = true
  previewOpen.value = false
  status.value = 'working'
  errorMessage.value = ''
  importedProject.value = undefined
  stage.value = 'reading'
  try {
    inspected.value = await projectPackageService.inspectPackage(file, updateStage)
    preview.value = projectPackageService.previewPackage(inspected.value)
    progressOpen.value = false
    previewOpen.value = true
  } catch (error) {
    status.value = 'error'
    errorMessage.value = toAppError(error, 'Addons Studio could not inspect this project package.').userMessage
  } finally {
    fileInput.value = ''
  }
}

async function confirmImport(): Promise<void> {
  if (!inspected.value) return
  previewOpen.value = false
  progressOpen.value = true
  status.value = 'working'
  errorMessage.value = ''
  stage.value = 'validating'
  try {
    const project = await projectPackageService.importPackage(inspected.value, updateStage)
    await projects.loadProjects(true)
    importedProject.value = project
    status.value = 'done'
    toasts.push({ type: 'success', message: 'Project imported successfully.' })
    emit('imported', project)
  } catch (error) {
    status.value = 'error'
    errorMessage.value = toAppError(error, 'Addons Studio could not import this project.').userMessage
  }
}

function closeProgress(): void {
  if (status.value === 'working') return
  progressOpen.value = false
  inspected.value = undefined
  preview.value = undefined
}
</script>

<template>
  <input
    ref="input"
    class="visually-hidden"
    type="file"
    accept=".addonsstudio,.myproject.addonsstudio,application/zip,application/x-addons-studio-project"
    @change="inspectFile"
  />

  <AppDialog
    :open="previewOpen && Boolean(preview)"
    :title="locale.t('Import Project (Beta)')"
    :description="locale.t('This feature is in beta. Verify your imported project before relying on it.')"
    @close="previewOpen = false"
  >
    <div v-if="preview" class="package-preview">
      <ProjectIcon :icon="preview.icon" size="large" />
      <div><strong>{{ preview.name }}</strong><code>{{ preview.namespace }}</code><small>{{ locale.t('Format version') }} {{ preview.formatVersion }}</small></div>
    </div>
    <p v-if="preview?.description" class="preview-description">{{ preview.description }}</p>
    <dl v-if="preview" class="package-summary">
      <div><dt>{{ locale.t('Models') }}</dt><dd>{{ preview.content.models }}</dd></div>
      <div><dt>{{ locale.t('Cubes') }}</dt><dd>{{ preview.content.cubes }}</dd></div>
      <div><dt>{{ locale.t('Groups') }}</dt><dd>{{ preview.content.groups }}</dd></div>
      <div><dt>{{ locale.t('Editor assets') }}</dt><dd>{{ preview.content.editorAssets }}</dd></div>
    </dl>
    <p class="beta-warning"><AppIcon name="alert-triangle" :size="19" />{{ locale.t('The imported project is created as a new local copy. Existing projects are never overwritten.') }}</p>
    <template #actions>
      <AppButton variant="ghost" @click="previewOpen = false">{{ locale.t('Cancel') }}</AppButton>
      <AppButton @click="confirmImport">{{ locale.t('Import Project') }}</AppButton>
    </template>
  </AppDialog>

  <BottomSheet
    :open="progressOpen"
    :title="locale.t(status === 'done' ? 'Project imported successfully.' : status === 'error' ? 'Import stopped safely' : 'Importing Project')"
    :description="status === 'working' ? locale.t('Keep Addons Studio open while the project is being imported.') : undefined"
    @close="closeProgress"
  >
    <div v-if="status === 'working'" class="package-stages" aria-live="polite">
      <div v-for="(entry, index) in stageOrder" :key="entry" :class="{ active: entry === stage, complete: index < currentStageIndex }">
        <span><AppIcon v-if="index < currentStageIndex" name="check" :size="17" /><span v-else-if="entry === stage" class="stage-spinner" /><span v-else>{{ index + 1 }}</span></span>
        <strong>{{ locale.t(stageLabels[entry]) }}</strong>
      </div>
    </div>
    <div v-else-if="status === 'done'" class="package-result">
      <span><AppIcon name="check" :size="28" /></span>
      <strong>{{ importedProject?.name }}</strong>
      <p>{{ locale.t('Models and editor assets were restored into a new local project.') }}</p>
      <AppButton block @click="closeProgress">{{ locale.t('Continue') }}</AppButton>
    </div>
    <div v-else class="package-result package-result--error">
      <span><AppIcon name="alert-triangle" :size="28" /></span>
      <p>{{ errorMessage }}</p>
      <AppButton block variant="secondary" @click="closeProgress">{{ locale.t('Close') }}</AppButton>
    </div>
  </BottomSheet>
</template>

<style scoped>
.package-preview { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: var(--space-3); }
.package-preview > div { min-width: 0; display: grid; gap: 0.2rem; }
.package-preview strong, .package-preview code { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.package-preview code { color: var(--color-accent-strong); font-size: 0.74rem; }
.package-preview small, .preview-description { color: var(--color-text-subtle); font-size: 0.72rem; }
.preview-description { margin: var(--space-3) 0 0; line-height: 1.5; }
.package-summary { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.45rem; margin: var(--space-4) 0 0; }
.package-summary div { border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 0.65rem; background: var(--color-surface-raised); }
.package-summary dt { color: var(--color-text-subtle); font-size: 0.66rem; }
.package-summary dd { margin: 0.25rem 0 0; font-family: var(--font-mono); font-weight: 800; }
.beta-warning { display: flex; gap: 0.55rem; margin: var(--space-4) 0 0; border: 1px solid var(--color-warning-border); border-radius: var(--radius-md); padding: 0.7rem; background: var(--color-warning-soft); color: var(--color-warning-text); font-size: 0.74rem; line-height: 1.4; }
.package-stages { display: grid; gap: 0.5rem; }
.package-stages > div { min-height: var(--touch-target); display: grid; grid-template-columns: 2rem 1fr; align-items: center; gap: 0.65rem; color: var(--color-text-subtle); }
.package-stages > div > span { width: 1.75rem; height: 1.75rem; display: grid; place-items: center; border: 1px solid var(--color-border-strong); border-radius: 50%; font-size: 0.68rem; }
.package-stages .active, .package-stages .complete { color: var(--color-text); }
.package-stages .active > span, .package-stages .complete > span { border-color: var(--color-accent); background: var(--color-accent-soft); color: var(--color-accent-strong); }
.stage-spinner { width: 0.8rem !important; height: 0.8rem !important; border: 2px solid currentColor !important; border-right-color: transparent !important; border-radius: 50%; animation: spin 0.75s linear infinite; }
.package-result { display: grid; justify-items: center; gap: var(--space-3); text-align: center; }
.package-result > span { width: 4rem; height: 4rem; display: grid; place-items: center; border-radius: var(--radius-xl); background: var(--color-success-soft); color: var(--color-success); }
.package-result p { margin: 0; color: var(--color-text-muted); font-size: 0.8rem; line-height: 1.5; }
.package-result .app-button { margin-top: var(--space-2); }
.package-result--error > span { background: var(--color-danger-soft); color: var(--color-danger); }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
