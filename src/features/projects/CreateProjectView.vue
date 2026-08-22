<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import AppButton from '@/components/common/AppButton.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import IconButton from '@/components/common/IconButton.vue'
import StudioIcon from '@/components/common/StudioIcon.vue'
import ProjectIcon from '@/components/project/ProjectIcon.vue'
import { toAppError } from '@/core/errors/AppError'
import {
  BEDROCK_VERSIONS,
  DEFAULT_BEDROCK_VERSION,
} from '@/core/project/bedrockVersions'
import {
  normalizeNamespace,
  validateProjectInput,
  type ValidationIssue,
} from '@/core/project/projectValidation'
import { completeWelcome } from '@/core/storage/preferences'
import { useLocaleStore } from '@/stores/locale'
import { useProjectStore } from '@/stores/projects'
import { useToastStore } from '@/stores/toasts'
import type { CreateProjectInput, ProjectIcon as ProjectIconType, ProjectType } from '@/types/project'
import { createImportedProjectIcon } from '@/utils/projectIcon'

const router = useRouter()
const locale = useLocaleStore()
const projects = useProjectStore()
const toasts = useToastStore()
const form = reactive<CreateProjectInput>({
  name: '',
  namespace: 'project',
  description: '',
  icon: { kind: 'builtin', value: 'project' },
  projectType: 'addon',
  targetVersion: DEFAULT_BEDROCK_VERSION,
  experimentalFeatures: false,
})

const namespaceTouched = ref(false)
const validationIssues = ref<ValidationIssue[]>([])
const iconError = ref('')
const importingIcon = ref(false)
const creating = ref(false)
const fileInput = ref<HTMLInputElement>()

const builtInIcons = [
  { id: 'project', label: 'Project' },
  { id: 'block', label: 'Block' },
  { id: 'resource-pack', label: 'Resource Pack' },
  { id: 'behavior-pack', label: 'Behavior Pack' },
  { id: 'layers', label: 'Layers' },
  { id: 'sparkle', label: 'Spark' },
] as const

const projectTypes: readonly { value: ProjectType; label: string; description: string }[] = [
  { value: 'addon', label: 'Add-on', description: 'Resource and behavior foundations together' },
  { value: 'resource_pack', label: 'Resource Pack', description: 'Visual and client-side resources' },
  { value: 'behavior_pack', label: 'Behavior Pack', description: 'Gameplay and server-side behavior' },
]

const descriptionLength = computed(() => form.description?.length ?? 0)

watch(
  () => form.name,
  (name) => {
    if (!namespaceTouched.value) form.namespace = normalizeNamespace(name)
    clearIssue('name')
  },
)

function clearIssue(field: ValidationIssue['field']): void {
  validationIssues.value = validationIssues.value.filter((issue) => issue.field !== field)
}

function fieldError(field: ValidationIssue['field']): string | undefined {
  return validationIssues.value.find((issue) => issue.field === field)?.message
}

function chooseBuiltInIcon(value: string): void {
  form.icon = { kind: 'builtin', value }
  iconError.value = ''
}

async function importIcon(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  importingIcon.value = true
  iconError.value = ''
  try {
    form.icon = await createImportedProjectIcon(file)
  } catch (error) {
    iconError.value = error instanceof Error ? error.message : locale.t('The selected image could not be used.')
  } finally {
    importingIcon.value = false
    input.value = ''
  }
}

function updateNamespace(value: string): void {
  namespaceTouched.value = true
  form.namespace = value
  clearIssue('namespace')
}

async function submit(): Promise<void> {
  validationIssues.value = validateProjectInput(form)
  if (validationIssues.value.length > 0) {
    await nextTick()
    const firstField = validationIssues.value[0]?.field
    document.querySelector<HTMLElement>(`[data-field="${firstField}"]`)?.focus()
    return
  }

  creating.value = true
  try {
    const project = await projects.createProject(form)
    completeWelcome()
    toasts.push({ type: 'success', message: locale.t('Project created') })
    await router.replace({ name: 'workspace', params: { id: project.id } })
  } catch (error) {
    toasts.push({
      type: 'error',
      message: toAppError(error, 'Addons Studio could not create this project.').userMessage,
    })
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <main class="create-project-view">
    <header class="editor-topbar">
      <IconButton icon="arrow-left" :label="locale.t('Go back')" @click="router.back()" />
      <div>
        <p class="eyebrow">{{ locale.t('New local workspace') }}</p>
        <h1>{{ locale.t('Create Project') }}</h1>
      </div>
      <span aria-hidden="true" />
    </header>

    <form id="create-project-form" class="project-form" novalidate @submit.prevent="submit">
      <section class="form-section" aria-labelledby="identity-heading">
        <header class="form-section__heading">
          <span>01</span>
          <div><h2 id="identity-heading">{{ locale.t('Identity') }}</h2><p>{{ locale.t('Name the project and its Bedrock namespace.') }}</p></div>
        </header>

        <label class="field-group">
          <span class="field-label">{{ locale.t('Project Name') }} <em>{{ locale.t('Required') }}</em></span>
          <input
            v-model="form.name"
            data-field="name"
            class="text-input"
            :class="{ 'text-input--error': fieldError('name') }"
            type="text"
            maxlength="80"
            placeholder="Río Grande Urbanismo"
            autocomplete="off"
            :aria-invalid="Boolean(fieldError('name'))"
            :aria-describedby="fieldError('name') ? 'project-name-error' : undefined"
          />
          <span v-if="fieldError('name')" id="project-name-error" class="field-error" role="alert">
            {{ locale.t(fieldError('name') ?? '') }}
          </span>
        </label>

        <label class="field-group">
          <span class="field-label">{{ locale.t('Namespace') }} <em>{{ locale.t('Required') }}</em></span>
          <span class="namespace-input">
            <span aria-hidden="true">as:</span>
            <input
              :value="form.namespace"
              data-field="namespace"
              type="text"
              maxlength="64"
              autocapitalize="none"
              autocomplete="off"
              spellcheck="false"
              :aria-invalid="Boolean(fieldError('namespace'))"
              :aria-describedby="fieldError('namespace') ? 'namespace-error' : 'namespace-help'"
              @input="updateNamespace(($event.target as HTMLInputElement).value)"
            />
          </span>
          <span id="namespace-help" class="field-help">{{ locale.t('Lowercase letters, numbers, and underscores.') }}</span>
          <span v-if="fieldError('namespace')" id="namespace-error" class="field-error" role="alert">
            {{ locale.t(fieldError('namespace') ?? '') }}
          </span>
        </label>

        <label class="field-group">
          <span class="field-label">{{ locale.t('Description') }} <small>{{ descriptionLength }}/240</small></span>
          <textarea
            v-model="form.description"
            class="text-input text-area"
            maxlength="240"
            rows="3"
            :placeholder="locale.t('Optional project notes')"
          />
        </label>
      </section>

      <section class="form-section" aria-labelledby="icon-heading">
        <header class="form-section__heading">
          <span>02</span>
          <div><h2 id="icon-heading">{{ locale.t('Project Icon') }}</h2><p>{{ locale.t('Choose a lightweight built-in mark or a device image.') }}</p></div>
        </header>

        <div class="icon-picker">
          <ProjectIcon :icon="(form.icon as ProjectIconType)" size="large" />
          <div class="icon-picker__details">
            <strong>{{ locale.t('Workspace preview') }}</strong>
            <small>{{ locale.t('Imported images are cropped and resized locally.') }}</small>
            <AppButton variant="secondary" :loading="importingIcon" @click="fileInput?.click()">
              <template #icon><AppIcon name="upload" :size="18" /></template>
              {{ locale.t('Choose PNG/JPG') }}
            </AppButton>
            <input
              ref="fileInput"
              class="visually-hidden"
              type="file"
              accept="image/png,image/jpeg"
              @change="importIcon"
            />
          </div>
        </div>
        <p v-if="iconError" class="field-error" role="alert">{{ iconError }}</p>

        <fieldset class="built-in-icons">
          <legend class="field-label">{{ locale.t('Built-in icons') }}</legend>
          <div>
            <button
              v-for="icon in builtInIcons"
              :key="icon.id"
              type="button"
              :class="{ 'is-selected': form.icon?.kind === 'builtin' && form.icon.value === icon.id }"
              :aria-pressed="form.icon?.kind === 'builtin' && form.icon.value === icon.id"
              :aria-label="locale.t(icon.label)"
              @click="chooseBuiltInIcon(icon.id)"
            >
              <StudioIcon :name="icon.id" :size="24" />
            </button>
          </div>
        </fieldset>
      </section>

      <section class="form-section" aria-labelledby="configuration-heading">
        <header class="form-section__heading">
          <span>03</span>
          <div><h2 id="configuration-heading">{{ locale.t('Configuration') }}</h2><p>{{ locale.t('Set the pack foundation and version target.') }}</p></div>
        </header>

        <fieldset class="option-cards">
          <legend class="field-label">{{ locale.t('Project Type') }}</legend>
          <label v-for="option in projectTypes" :key="option.value">
            <input v-model="form.projectType" type="radio" :value="option.value" />
            <span>
              <span><strong>{{ locale.t(option.label) }}</strong><AppIcon name="check" :size="18" /></span>
              <small>{{ locale.t(option.description) }}</small>
            </span>
          </label>
        </fieldset>

        <label class="field-group">
          <span class="field-label">{{ locale.t('Target Minecraft Version') }}</span>
          <span class="select-wrap">
            <select
              v-model="form.targetVersion"
              data-field="targetVersion"
              :aria-invalid="Boolean(fieldError('targetVersion'))"
              @change="clearIssue('targetVersion')"
            >
              <option v-for="version in BEDROCK_VERSIONS" :key="version.value" :value="version.value">
                {{ version.label }}{{ version.status === 'current' ? ` — ${locale.t('Current')}` : '' }}
              </option>
            </select>
            <AppIcon name="chevron-right" :size="18" />
          </span>
          <span class="field-help">{{ locale.t('The maintained list can grow without changing the wizard.') }}</span>
          <span v-if="fieldError('targetVersion')" class="field-error" role="alert">
            {{ locale.t(fieldError('targetVersion') ?? '') }}
          </span>
        </label>
      </section>

      <section class="form-section" aria-labelledby="experiments-heading">
        <header class="form-section__heading">
          <span>04</span>
          <div><h2 id="experiments-heading">{{ locale.t('Experiments') }}</h2><p>{{ locale.t('Reserve experimental behavior for future Bedrock tools.') }}</p></div>
        </header>

        <label class="experiment-option">
          <span>
            <strong>{{ locale.t('Enable experimental project features') }}</strong>
            <small>{{ locale.t('No unsupported Minecraft experiment flags are applied.') }}</small>
          </span>
          <input v-model="form.experimentalFeatures" type="checkbox" role="switch" />
        </label>
        <p class="field-help experiment-help">
          {{ locale.t('Leave this off for “No experiments.” Actual experiment definitions will be registered in a future release.') }}
        </p>
      </section>
    </form>

    <footer class="create-project-footer">
      <AppButton
        form="create-project-form"
        type="submit"
        size="large"
        block
        :loading="creating"
      >
        <template #icon><AppIcon name="plus" :size="21" /></template>
        {{ locale.t('Create Project') }}
      </AppButton>
    </footer>
  </main>
</template>

<style scoped>
.create-project-view {
  min-height: 100dvh;
  padding-bottom: calc(5.6rem + env(safe-area-inset-bottom));
}

.editor-topbar {
  position: sticky;
  z-index: var(--z-header);
  top: 0;
  min-height: calc(4.25rem + env(safe-area-inset-top));
  display: grid;
  grid-template-columns: var(--touch-target) minmax(0, 1fr) var(--touch-target);
  align-items: center;
  gap: 0.65rem;
  padding: env(safe-area-inset-top) max(var(--page-gutter), env(safe-area-inset-right)) 0
    max(var(--page-gutter), env(safe-area-inset-left));
  border-bottom: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-app-bg) 92%, transparent);
  backdrop-filter: blur(16px);
}

.editor-topbar h1 {
  margin: 0.12rem 0 0;
  font-size: 1.15rem;
}

.project-form {
  width: min(100%, 700px);
  display: grid;
  gap: 0.9rem;
  margin: 0 auto;
  padding: 1rem max(var(--page-gutter), env(safe-area-inset-right)) 2rem
    max(var(--page-gutter), env(safe-area-inset-left));
}

.form-section {
  min-width: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: 1rem;
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.form-section__heading {
  display: grid;
  grid-template-columns: 2rem minmax(0, 1fr);
  gap: 0.65rem;
  margin-bottom: 1.1rem;
}

.form-section__heading > span {
  width: 2rem;
  height: 2rem;
  display: grid;
  place-items: center;
  border-radius: 0.65rem;
  background: var(--color-accent-soft);
  color: var(--color-accent-strong);
  font-family: var(--font-mono);
  font-size: 0.68rem;
  font-weight: 800;
}

.form-section__heading h2 {
  margin: 0;
  font-size: 1rem;
}

.form-section__heading p {
  margin: 0.2rem 0 0;
  color: var(--color-text-subtle);
  font-size: 0.74rem;
  line-height: 1.4;
}

.field-group {
  display: grid;
  gap: 0.42rem;
  margin-top: 0.9rem;
}

.field-group:first-of-type {
  margin-top: 0;
}

.field-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  color: var(--color-text-muted);
  font-size: 0.76rem;
  font-style: normal;
  font-weight: 750;
}

.field-label em {
  color: var(--color-accent-strong);
  font-size: 0.65rem;
  font-style: normal;
  text-transform: uppercase;
}

.field-label small {
  color: var(--color-text-subtle);
  font-weight: 600;
}

.text-area {
  min-height: 6rem;
  resize: vertical;
}

.namespace-input {
  min-height: 3rem;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  background: var(--color-input-bg);
  overflow: hidden;
}

.namespace-input:focus-within {
  border-color: var(--color-accent);
  box-shadow: var(--focus-ring);
}

.namespace-input > span {
  align-self: stretch;
  display: grid;
  place-items: center;
  border-right: 1px solid var(--color-border);
  padding: 0 0.75rem;
  color: var(--color-text-subtle);
  font-family: var(--font-mono);
  font-size: 0.75rem;
}

.namespace-input input {
  width: 100%;
  min-height: 2.9rem;
  border: 0;
  outline: 0;
  padding: 0 0.75rem;
  background: transparent;
  color: var(--color-text);
  font-family: var(--font-mono);
  font-size: 1rem;
}

.icon-picker {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 1rem;
}

.icon-picker__details {
  min-width: 0;
  display: grid;
  justify-items: start;
  gap: 0.32rem;
}

.icon-picker__details strong {
  font-size: 0.86rem;
}

.icon-picker__details small {
  margin-bottom: 0.35rem;
  color: var(--color-text-subtle);
  font-size: 0.7rem;
  line-height: 1.4;
}

.built-in-icons {
  margin: 1rem 0 0;
  border: 0;
  padding: 0;
}

.built-in-icons > div {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 0.45rem;
  margin-top: 0.55rem;
}

.built-in-icons button {
  min-width: 0;
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-raised);
  color: var(--color-text-muted);
}

.built-in-icons button.is-selected {
  border-color: var(--color-accent);
  background: var(--color-accent-soft);
  color: var(--color-accent-strong);
  box-shadow: var(--focus-ring);
}

.option-cards {
  display: grid;
  gap: 0.5rem;
  margin: 0;
  border: 0;
  padding: 0;
}

.option-cards legend {
  margin-bottom: 0.5rem;
}

.option-cards label {
  position: relative;
}

.option-cards input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.option-cards label > span {
  min-height: 4rem;
  display: grid;
  align-content: center;
  gap: 0.22rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 0.75rem 0.8rem;
  background: var(--color-surface-raised);
}

.option-cards label > span > span {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.option-cards label svg {
  opacity: 0;
  color: var(--color-accent-strong);
}

.option-cards small {
  color: var(--color-text-subtle);
  font-size: 0.7rem;
}

.option-cards input:checked + span {
  border-color: var(--color-accent);
  background: var(--color-accent-soft);
}

.option-cards input:checked + span svg {
  opacity: 1;
}

.option-cards input:focus-visible + span {
  box-shadow: var(--focus-ring);
}

.select-wrap {
  position: relative;
  display: grid;
  align-items: center;
}

.select-wrap select {
  width: 100%;
  min-height: 3rem;
  appearance: none;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  padding: 0 2.7rem 0 0.8rem;
  background: var(--color-input-bg);
  color: var(--color-text);
  font: inherit;
  font-size: 1rem;
}

.select-wrap svg {
  position: absolute;
  right: 0.85rem;
  transform: rotate(90deg);
  color: var(--color-text-subtle);
  pointer-events: none;
}

.experiment-option {
  min-height: 4.5rem;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 0.8rem;
  background: var(--color-surface-raised);
}

.experiment-option > span {
  display: grid;
  gap: 0.25rem;
}

.experiment-option strong {
  font-size: 0.84rem;
}

.experiment-option small {
  color: var(--color-text-subtle);
  font-size: 0.68rem;
  line-height: 1.4;
}

.experiment-option input {
  width: 3rem;
  height: 1.75rem;
  appearance: none;
  border: 1px solid var(--color-border-strong);
  border-radius: 999px;
  padding: 0.18rem;
  background: var(--color-border-strong);
  transition: background var(--motion-fast);
}

.experiment-option input::before {
  display: block;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 50%;
  background: white;
  box-shadow: 0 1px 4px rgb(0 0 0 / 0.25);
  content: '';
  transition: transform var(--motion-fast);
}

.experiment-option input:checked {
  border-color: var(--color-accent);
  background: var(--color-accent);
}

.experiment-option input:checked::before {
  transform: translateX(1.2rem);
}

.experiment-help {
  display: block;
  margin-top: 0.6rem;
  line-height: 1.45;
}

.create-project-footer {
  position: fixed;
  z-index: var(--z-navigation);
  inset: auto 0 0;
  padding: 0.7rem max(var(--page-gutter), env(safe-area-inset-right))
    calc(0.7rem + env(safe-area-inset-bottom)) max(var(--page-gutter), env(safe-area-inset-left));
  border-top: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-app-bg) 94%, transparent);
  backdrop-filter: blur(18px);
}

.create-project-footer > * {
  max-width: 700px;
  margin: 0 auto;
}

@media (max-width: 360px) {
  .built-in-icons > div {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (orientation: landscape) and (max-height: 540px) {
  .editor-topbar {
    position: relative;
  }

  .create-project-footer {
    position: sticky;
  }

  .create-project-view {
    padding-bottom: env(safe-area-inset-bottom);
  }
}
</style>
