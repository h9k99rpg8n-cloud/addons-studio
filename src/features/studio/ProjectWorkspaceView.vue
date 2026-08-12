<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import AppBadge from '@/components/common/AppBadge.vue'
import AppButton from '@/components/common/AppButton.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import IconButton from '@/components/common/IconButton.vue'
import StudioIcon from '@/components/common/StudioIcon.vue'
import AddResourceSheet from '@/components/project/AddResourceSheet.vue'
import ProjectActionsController from '@/components/project/ProjectActionsController.vue'
import ProjectIcon from '@/components/project/ProjectIcon.vue'
import ResourceCategoryCard from '@/components/project/ResourceCategoryCard.vue'
import { toAppError } from '@/core/errors/AppError'
import { modelRepository } from '@/core/model/modelRepository'
import { RESOURCE_CATEGORIES } from '@/features/studio/resourceCategories'
import { useProjectStore } from '@/stores/projects'
import { useToastStore } from '@/stores/toasts'
import type { ProjectType, ResourceTemplate } from '@/types/project'

const props = defineProps<{ id: string }>()
const router = useRouter()
const projects = useProjectStore()
const toasts = useToastStore()
const loading = ref(true)
const loadError = ref('')
const addOpen = ref(false)
const projectMenuOpen = ref(false)
const modelCount = ref(0)

const project = computed(() =>
  projects.activeProject?.id === props.id
    ? projects.activeProject
    : projects.projects.find((entry) => entry.id === props.id),
)

const projectTypeLabels: Record<ProjectType, string> = {
  addon: 'Add-on',
  resource_pack: 'Resource Pack',
  behavior_pack: 'Behavior Pack',
}

onMounted(async () => {
  try {
    await projects.loadProjects()
    await projects.openProject(props.id)
    modelCount.value = await modelRepository.countModels(props.id)
  } catch (error) {
    loadError.value = toAppError(error, 'Addons Studio could not open this project.').userMessage
  } finally {
    loading.value = false
  }
})

function openCategory(id: string, label: string): void {
  if (id === 'models') {
    void router.push({ name: 'models', params: { projectId: props.id } })
    return
  }
  toasts.push({
    type: 'info',
    message: `${label} tools are coming in a future Addons Studio update.`,
  })
}

function selectTemplate(template: ResourceTemplate): void {
  addOpen.value = false
  if (template.id === 'model' && template.status === 'available') {
    void router.push({ name: 'models', params: { projectId: props.id } })
    return
  }
  toasts.push({ type: 'info', message: template.description })
}

function categoryCount(id: string): number {
  return id === 'models' ? modelCount.value : 0
}

function afterDelete(): void {
  void router.replace({ name: 'projects' })
}
</script>

<template>
  <main class="workspace-view">
    <header class="workspace-topbar">
      <IconButton
        icon="arrow-left"
        label="Back to projects"
        @click="router.push({ name: 'projects' })"
      />
      <div>
        <strong>{{ project?.name ?? 'Project Workspace' }}</strong>
        <small v-if="project">{{ project.namespace }}</small>
      </div>
      <IconButton
        icon="more-vertical"
        label="Project menu"
        :disabled="!project"
        @click="projectMenuOpen = true"
      />
    </header>

    <section v-if="loading" class="workspace-loading" aria-label="Opening project">
      <div class="skeleton workspace-loading__hero" />
      <div class="workspace-loading__grid">
        <div v-for="index in 8" :key="index" class="skeleton" />
      </div>
    </section>

    <section v-else-if="loadError || !project" class="workspace-error">
      <span><AppIcon name="alert-triangle" :size="30" /></span>
      <h1>Project unavailable</h1>
      <p>{{ loadError || 'This local project could not be found.' }}</p>
      <AppButton @click="router.replace({ name: 'projects' })">Back to Projects</AppButton>
    </section>

    <div v-else class="workspace-content">
      <section class="project-overview">
        <ProjectIcon :icon="project.icon" size="large" />
        <div>
          <div class="project-overview__badges">
            <AppBadge tone="accent">{{ projectTypeLabels[project.projectType] }}</AppBadge>
            <AppBadge>{{ project.targetVersion }}</AppBadge>
            <AppBadge>Alpha workspace</AppBadge>
            <AppBadge v-if="project.experimentalFeatures" tone="warning">Experimental</AppBadge>
          </div>
          <h1>{{ project.name }}</h1>
          <p>{{ project.description || 'A clean Bedrock project ready for future resources.' }}</p>
        </div>
      </section>

      <section class="resources-section" aria-labelledby="resources-heading">
        <header>
          <div>
            <p class="eyebrow">Project Workspace</p>
            <h2 id="resources-heading">Resources</h2>
          </div>
          <span>{{ modelCount }} total</span>
        </header>
        <div class="resource-grid">
          <ResourceCategoryCard
            v-for="category in RESOURCE_CATEGORIES"
            :key="category.id"
            :category="category"
            :count="categoryCount(category.id)"
            @open="openCategory(category.id, category.label)"
          />
        </div>
      </section>

      <aside class="foundation-note">
        <StudioIcon name="workspace" :size="23" />
        <div>
          <strong>Model Studio is now available</strong>
          <p>
            Create local cube-based models with touch transforms. Other resource editors and Minecraft export remain clearly marked for future updates.
          </p>
        </div>
      </aside>
    </div>

    <footer v-if="project" class="workspace-add">
      <AppButton size="large" block @click="addOpen = true">
        <template #icon><StudioIcon name="add-resource" :size="23" /></template>
        Add Resource
      </AppButton>
    </footer>

    <AddResourceSheet
      v-if="project"
      :open="addOpen"
      :target-version="project.targetVersion"
      @close="addOpen = false"
      @select="selectTemplate"
    />
    <ProjectActionsController
      :project="project"
      :open="projectMenuOpen"
      @close="projectMenuOpen = false"
      @deleted="afterDelete"
    />
  </main>
</template>

<style scoped>
.workspace-view {
  min-height: 100dvh;
  padding-bottom: calc(5.7rem + env(safe-area-inset-bottom));
}

.workspace-topbar {
  position: sticky;
  z-index: var(--z-header);
  top: 0;
  min-height: calc(var(--header-height) + env(safe-area-inset-top));
  display: grid;
  grid-template-columns: var(--touch-target) minmax(0, 1fr) var(--touch-target);
  align-items: center;
  gap: 0.55rem;
  padding: env(safe-area-inset-top) max(var(--page-gutter), env(safe-area-inset-right)) 0
    max(var(--page-gutter), env(safe-area-inset-left));
  border-bottom: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-app-bg) 92%, transparent);
  backdrop-filter: blur(16px);
}

.workspace-topbar > div {
  min-width: 0;
  display: grid;
  text-align: center;
}

.workspace-topbar strong,
.workspace-topbar small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workspace-topbar strong {
  font-size: 0.9rem;
}

.workspace-topbar small {
  margin-top: 0.12rem;
  color: var(--color-text-subtle);
  font-family: var(--font-mono);
  font-size: 0.63rem;
}

.workspace-content,
.workspace-loading {
  width: min(100%, var(--content-max));
  margin: 0 auto;
  padding: 1rem max(var(--page-gutter), env(safe-area-inset-right)) 2rem
    max(var(--page-gutter), env(safe-area-inset-left));
}

.project-overview {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  overflow: hidden;
  padding: var(--card-padding);
  background:
    radial-gradient(circle at 100% 0, var(--color-brand-glow), transparent 38%),
    var(--color-surface);
  box-shadow: var(--shadow-card);
}

.project-overview::after {
  position: absolute;
  right: -2.75rem;
  bottom: -3.75rem;
  width: 8rem;
  height: 8rem;
  border: 1px solid color-mix(in srgb, var(--color-accent) 14%, transparent);
  border-radius: 50%;
  content: '';
  pointer-events: none;
}

.project-overview > * {
  position: relative;
  z-index: 1;
}

.project-overview__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.project-overview h1 {
  overflow: hidden;
  margin: 0.55rem 0 0;
  font-size: clamp(1.25rem, 6vw, 1.75rem);
  letter-spacing: -0.025em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-overview p {
  display: -webkit-box;
  overflow: hidden;
  margin: 0.3rem 0 0;
  color: var(--color-text-muted);
  font-size: 0.74rem;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.resources-section {
  margin-top: 1.65rem;
}

.resources-section > header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.resources-section h2 {
  margin: 0.18rem 0 0;
  font-size: 1.18rem;
}

.resources-section > header > span {
  color: var(--color-text-subtle);
  font-size: 0.72rem;
  font-weight: 700;
}

.resource-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}

.foundation-note {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--space-3);
  margin-top: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--card-padding);
  background: var(--color-surface-muted);
  color: var(--color-text-muted);
}

.foundation-note > :first-child {
  color: var(--color-accent-strong);
  --studio-icon-accent: var(--color-brand-secondary);
}

.foundation-note strong {
  color: var(--color-text);
  font-size: 0.8rem;
}

.foundation-note p {
  margin: 0.25rem 0 0;
  font-size: 0.7rem;
  line-height: 1.5;
}

.workspace-add {
  position: fixed;
  z-index: var(--z-navigation);
  inset: auto 0 0;
  padding: var(--space-3) max(var(--page-gutter), env(safe-area-inset-right))
    calc(var(--space-3) + env(safe-area-inset-bottom)) max(var(--page-gutter), env(safe-area-inset-left));
  border-top: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-app-bg) 94%, transparent);
  backdrop-filter: blur(18px);
}

.workspace-add > * {
  max-width: var(--content-max);
  margin: 0 auto;
}

.workspace-loading__hero {
  height: 7.5rem;
  border-radius: var(--radius-xl);
}

.workspace-loading__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem;
  margin-top: 1.5rem;
}

.workspace-loading__grid > div {
  height: 8.5rem;
  border-radius: var(--radius-xl);
}

.workspace-error {
  min-height: calc(100dvh - 5rem);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem var(--page-gutter);
  text-align: center;
}

.workspace-error > span {
  width: 4rem;
  height: 4rem;
  display: grid;
  place-items: center;
  border-radius: var(--radius-xl);
  background: var(--color-warning-soft);
  color: var(--color-warning-text);
}

.workspace-error h1 {
  margin: 1rem 0 0;
  font-size: 1.25rem;
}

.workspace-error p {
  max-width: 25rem;
  margin: 0.45rem 0 1.2rem;
  color: var(--color-text-muted);
  font-size: 0.85rem;
}

@media (min-width: 680px) {
  .resource-grid,
  .workspace-loading__grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (orientation: landscape) and (max-height: 540px) {
  .workspace-topbar {
    position: relative;
  }

  .workspace-add {
    position: sticky;
  }

  .workspace-view {
    padding-bottom: env(safe-area-inset-bottom);
  }
}
</style>
