<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import AppButton from '@/components/common/AppButton.vue'
import AppDialog from '@/components/common/AppDialog.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import IconButton from '@/components/common/IconButton.vue'
import StudioIcon from '@/components/common/StudioIcon.vue'
import { toAppError } from '@/core/errors/AppError'
import { modelRepository } from '@/core/model/modelRepository'
import {
  createModelIdentifier,
  validateModelInput,
} from '@/core/model/modelValidation'
import { useProjectStore } from '@/stores/projects'
import { useToastStore } from '@/stores/toasts'
import type { StudioModel } from '@/types/model'

const props = defineProps<{ projectId: string }>()
const router = useRouter()
const projects = useProjectStore()
const toasts = useToastStore()
const models = ref<StudioModel[]>([])
const loading = ref(true)
const loadError = ref('')
const createOpen = ref(false)
const deleteOpen = ref(false)
const selectedModel = ref<StudioModel>()
const modelName = ref('')
const identifier = ref('')
const identifierTouched = ref(false)
const nameError = ref('')
const identifierError = ref('')
const busy = ref(false)

const project = computed(() =>
  projects.activeProject?.id === props.projectId
    ? projects.activeProject
    : projects.projects.find((entry) => entry.id === props.projectId),
)

watch(modelName, (name) => {
  if (!identifierTouched.value && project.value) {
    identifier.value = createModelIdentifier(project.value.namespace, name)
  }
})

onMounted(async () => {
  try {
    await projects.loadProjects()
    await projects.openProject(props.projectId)
    models.value = await modelRepository.listModels(props.projectId)
  } catch (error) {
    loadError.value = toAppError(error, 'Addons Studio could not load model resources.').userMessage
  } finally {
    loading.value = false
  }
})

function startCreate(): void {
  modelName.value = ''
  identifier.value = project.value
    ? createModelIdentifier(project.value.namespace, '')
    : 'geometry.project.model'
  identifierTouched.value = false
  nameError.value = ''
  identifierError.value = ''
  createOpen.value = true
}

async function createModel(): Promise<void> {
  const issues = validateModelInput({ name: modelName.value, identifier: identifier.value })
  nameError.value = issues.find((issue) => issue.field === 'name')?.message ?? ''
  identifierError.value = issues.find((issue) => issue.field === 'identifier')?.message ?? ''
  if (issues.length) return

  busy.value = true
  try {
    const model = await modelRepository.createModel({
      projectId: props.projectId,
      name: modelName.value,
      identifier: identifier.value,
    })
    models.value.unshift(model)
    createOpen.value = false
    toasts.push({ type: 'success', message: 'Model created' })
    await router.push({
      name: 'model-studio',
      params: { projectId: props.projectId, modelId: model.id },
    })
  } catch (error) {
    identifierError.value = toAppError(error, 'Addons Studio could not create this model.').userMessage
  } finally {
    busy.value = false
  }
}

function confirmDelete(model: StudioModel): void {
  selectedModel.value = model
  deleteOpen.value = true
}

async function deleteModel(): Promise<void> {
  if (!selectedModel.value) return
  busy.value = true
  try {
    const id = selectedModel.value.id
    await modelRepository.deleteModel(id)
    models.value = models.value.filter((model) => model.id !== id)
    deleteOpen.value = false
    toasts.push({ type: 'success', message: 'Model deleted' })
  } catch (error) {
    toasts.push({
      type: 'error',
      message: toAppError(error, 'Addons Studio could not delete this model.').userMessage,
    })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <main class="models-view">
    <header class="models-topbar">
      <IconButton
        icon="arrow-left"
        label="Back to project workspace"
        @click="router.push({ name: 'workspace', params: { id: projectId } })"
      />
      <div><strong>Models</strong><small>{{ project?.name ?? 'Project' }}</small></div>
      <IconButton icon="plus" label="Create model" variant="surface" @click="startCreate" />
    </header>

    <section v-if="loading" class="models-content models-grid" aria-label="Loading models">
      <div v-for="index in 3" :key="index" class="skeleton model-skeleton" />
    </section>

    <section v-else-if="loadError || !project" class="model-empty">
      <span><AppIcon name="alert-triangle" :size="30" /></span>
      <h1>Models unavailable</h1>
      <p>{{ loadError || 'This local project could not be found.' }}</p>
      <AppButton @click="router.replace({ name: 'projects' })">Back to Projects</AppButton>
    </section>

    <div v-else class="models-content">
      <section class="models-intro">
        <span class="icon-surface tone-sky"><StudioIcon name="model" :size="31" /></span>
        <div>
          <p class="eyebrow">Modeling Workflow</p>
          <h1>Cube-based Bedrock modeling</h1>
          <p>Create geometry locally with touch tools, exact numeric transforms, references, and autosave.</p>
        </div>
      </section>

      <section v-if="models.length" class="models-section" aria-labelledby="model-list-heading">
        <header><h2 id="model-list-heading">Project Models</h2><span>{{ models.length }}</span></header>
        <div class="models-grid">
          <article v-for="model in models" :key="model.id" class="model-card">
            <button
              type="button"
              class="model-card__open"
              @click="router.push({ name: 'model-studio', params: { projectId, modelId: model.id } })"
            >
              <span class="model-card__icon"><StudioIcon name="model" :size="27" /></span>
              <span class="model-card__copy">
                <strong>{{ model.name }}</strong>
                <code>{{ model.identifier }}</code>
                <small>{{ model.elements.length }} cubes · {{ model.references.length }} references</small>
              </span>
              <AppIcon name="chevron-right" :size="19" />
            </button>
            <IconButton
              class="model-card__delete"
              icon="trash"
              :label="`Delete ${model.name}`"
              variant="danger"
              @click="confirmDelete(model)"
            />
          </article>
        </div>
      </section>

      <section v-else class="model-empty">
        <span><StudioIcon name="model" :size="36" /></span>
        <h2>No models yet</h2>
        <p>Create the first model resource in this project. Nothing is exported to Minecraft yet.</p>
        <AppButton size="large" @click="startCreate">
          <template #icon><AppIcon name="plus" :size="21" /></template>
          Create Model
        </AppButton>
      </section>
    </div>

    <footer v-if="project && !loading" class="models-create">
      <AppButton block size="large" @click="startCreate">
        <template #icon><AppIcon name="plus" :size="21" /></template>
        Create Model
      </AppButton>
    </footer>

    <AppDialog
      :open="createOpen"
      title="Create Model"
      description="The identifier becomes the future Bedrock geometry identifier."
      @close="createOpen = false"
    >
      <div class="model-form">
        <label for="model-name">Model Name</label>
        <input
          id="model-name"
          v-model="modelName"
          class="text-input"
          maxlength="80"
          autocomplete="off"
          placeholder="Vertical Slab"
          :aria-invalid="Boolean(nameError)"
        />
        <p v-if="nameError" class="field-error" role="alert">{{ nameError }}</p>

        <label for="model-identifier">Identifier</label>
        <input
          id="model-identifier"
          v-model="identifier"
          class="text-input model-identifier"
          maxlength="128"
          autocapitalize="none"
          autocomplete="off"
          spellcheck="false"
          :aria-invalid="Boolean(identifierError)"
          @input="identifierTouched = true"
          @keydown.enter.prevent="createModel"
        />
        <p v-if="identifierError" class="field-error" role="alert">{{ identifierError }}</p>
      </div>
      <template #actions>
        <AppButton variant="ghost" @click="createOpen = false">Cancel</AppButton>
        <AppButton :loading="busy" @click="createModel">Create Model</AppButton>
      </template>
    </AppDialog>

    <AppDialog
      :open="deleteOpen"
      :title="`Delete “${selectedModel?.name ?? 'model'}”?`"
      description="The model and its reference images will be removed from this device. The project itself stays safe."
      @close="deleteOpen = false"
    >
      <template #actions>
        <AppButton variant="ghost" @click="deleteOpen = false">Cancel</AppButton>
        <AppButton variant="danger" :loading="busy" @click="deleteModel">Delete Model</AppButton>
      </template>
    </AppDialog>
  </main>
</template>

<style scoped>
.models-view {
  min-height: 100dvh;
  padding-bottom: calc(5.7rem + env(safe-area-inset-bottom));
}

.models-topbar {
  position: sticky;
  z-index: var(--z-header);
  top: 0;
  min-height: calc(var(--header-height) + env(safe-area-inset-top));
  display: grid;
  grid-template-columns: var(--touch-target) minmax(0, 1fr) var(--touch-target);
  align-items: center;
  gap: var(--space-2);
  padding: env(safe-area-inset-top) max(var(--page-gutter), env(safe-area-inset-right)) 0 max(var(--page-gutter), env(safe-area-inset-left));
  border-bottom: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-app-bg) 94%, transparent);
  backdrop-filter: blur(16px);
}

.models-topbar > div {
  min-width: 0;
  display: grid;
  text-align: center;
}

.models-topbar strong,
.models-topbar small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.models-topbar small {
  color: var(--color-text-subtle);
  font-size: 0.65rem;
}

.models-content {
  width: min(100%, var(--content-max));
  margin: 0 auto;
  padding: var(--space-4) max(var(--page-gutter), env(safe-area-inset-right)) var(--space-8) max(var(--page-gutter), env(safe-area-inset-left));
}

.models-intro {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: var(--card-padding);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.models-intro h1 {
  margin: 0.2rem 0 0;
  font-size: 1.2rem;
}

.models-intro p:not(.eyebrow) {
  margin: 0.35rem 0 0;
  color: var(--color-text-muted);
  font-size: 0.75rem;
  line-height: 1.45;
}

.models-section {
  margin-top: var(--space-6);
}

.models-section > header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-2);
}

.models-section h2 {
  margin: 0;
  font-size: 0.9rem;
}

.models-section header span {
  color: var(--color-text-subtle);
  font-family: var(--font-mono);
  font-size: 0.7rem;
}

.models-grid {
  display: grid;
  gap: var(--space-3);
}

.model-skeleton {
  height: 6.5rem;
  border-radius: var(--radius-xl);
}

.model-card {
  position: relative;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.model-card__open {
  width: 100%;
  min-height: 7.25rem;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  border: 0;
  border-radius: inherit;
  padding: var(--card-padding) 3.2rem var(--card-padding) var(--card-padding);
  background: transparent;
  color: var(--color-text);
  text-align: left;
}

.model-card__icon {
  width: 3.2rem;
  height: 3.2rem;
  display: grid;
  place-items: center;
  border: 1px solid var(--tone-sky-border);
  border-radius: var(--radius-lg);
  background: var(--tone-sky-soft);
  color: var(--tone-sky);
}

.model-card__copy {
  min-width: 0;
  display: grid;
  gap: 0.25rem;
}

.model-card__copy strong,
.model-card__copy code,
.model-card__copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-card__copy code {
  color: var(--color-accent-strong);
  font-size: 0.68rem;
}

.model-card__copy small {
  color: var(--color-text-subtle);
  font-size: 0.7rem;
}

.model-card__delete {
  position: absolute;
  inset: 0.45rem 0.35rem auto auto;
}

.model-empty {
  min-height: 55dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem var(--page-gutter);
  text-align: center;
}

.model-empty > span {
  width: 4.5rem;
  height: 4.5rem;
  display: grid;
  place-items: center;
  border-radius: var(--radius-xl);
  background: var(--tone-sky-soft);
  color: var(--tone-sky);
}

.model-empty h1,
.model-empty h2 {
  margin: 1rem 0 0;
  font-size: 1.25rem;
}

.model-empty p {
  max-width: 24rem;
  margin: 0.45rem 0 1.2rem;
  color: var(--color-text-muted);
  font-size: 0.82rem;
  line-height: 1.5;
}

.models-create {
  position: fixed;
  z-index: var(--z-navigation);
  inset: auto 0 0;
  padding: var(--space-3) max(var(--page-gutter), env(safe-area-inset-right)) calc(var(--space-3) + env(safe-area-inset-bottom)) max(var(--page-gutter), env(safe-area-inset-left));
  border-top: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-app-bg) 94%, transparent);
  backdrop-filter: blur(18px);
}

.models-create > * {
  max-width: var(--content-max);
  margin: 0 auto;
}

.model-form {
  display: grid;
  gap: 0.45rem;
}

.model-form label {
  margin-top: 0.35rem;
  color: var(--color-text-muted);
  font-size: 0.75rem;
  font-weight: 750;
}

.model-identifier {
  font-family: var(--font-mono);
  font-size: 0.83rem;
}

@media (min-width: 720px) {
  .models-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
