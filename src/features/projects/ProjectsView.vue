<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import AppButton from '@/components/common/AppButton.vue'
import AppDialog from '@/components/common/AppDialog.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import IconButton from '@/components/common/IconButton.vue'
import StudioIcon from '@/components/common/StudioIcon.vue'
import AppHeader from '@/components/navigation/AppHeader.vue'
import ProjectActionsController from '@/components/project/ProjectActionsController.vue'
import ProjectCard from '@/components/project/ProjectCard.vue'
import ProjectFolderActionsController from '@/components/project/ProjectFolderActionsController.vue'
import ProjectFolderCard from '@/components/project/ProjectFolderCard.vue'
import ProjectImportController from '@/components/project/ProjectImportController.vue'
import { toAppError } from '@/core/errors/AppError'
import { useProjectStore } from '@/stores/projects'
import { useLocaleStore } from '@/stores/locale'
import { useToastStore } from '@/stores/toasts'
import type { StudioProject, StudioProjectFolder } from '@/types/project'

const props = defineProps<{ folderId?: string }>()
const router = useRouter()
const projects = useProjectStore()
const toasts = useToastStore()
const locale = useLocaleStore()
const query = ref('')
const selectedProject = ref<StudioProject>()
const selectedFolder = ref<StudioProjectFolder>()
const projectActionsOpen = ref(false)
const folderActionsOpen = ref(false)
const createFolderOpen = ref(false)
const folderName = ref('')
const folderError = ref('')
const folderBusy = ref(false)
const projectImport = ref<InstanceType<typeof ProjectImportController>>()

const currentFolder = computed(() =>
  props.folderId ? projects.folders.find((folder) => folder.id === props.folderId) : undefined,
)

const visibleProjects = computed(() =>
  props.folderId ? projects.projectsInFolder(props.folderId) : projects.rootProjects,
)

const filteredProjects = computed(() => {
  const needle = query.value.trim().toLowerCase()
  if (!needle) return visibleProjects.value
  return visibleProjects.value.filter(
    (project) =>
      project.name.toLowerCase().includes(needle) ||
      project.namespace.toLowerCase().includes(needle),
  )
})

const filteredFolders = computed(() => {
  if (props.folderId) return []
  const needle = query.value.trim().toLowerCase()
  if (!needle) return projects.folders
  return projects.folders.filter((folder) => folder.name.toLowerCase().includes(needle))
})

const visibleItemCount = computed(() => filteredFolders.value.length + filteredProjects.value.length)

onMounted(async () => {
  try {
    await projects.loadProjects()
    if (props.folderId && !currentFolder.value) {
      toasts.push({ type: 'warning', message: 'That folder is no longer available.' })
      await router.replace({ name: 'projects' })
    }
  } catch (error) {
    toasts.push({
      type: 'error',
      message: toAppError(error, 'Addons Studio could not load local projects.').userMessage,
    })
  }
})

function folderProjectCount(id: string): number {
  return projects.projectsInFolder(id).length
}

function openProjectActions(project: StudioProject): void {
  selectedProject.value = project
  projectActionsOpen.value = true
}

function openFolderActions(folder: StudioProjectFolder): void {
  selectedFolder.value = folder
  folderActionsOpen.value = true
}

function showCreateFolder(): void {
  folderName.value = ''
  folderError.value = ''
  createFolderOpen.value = true
}

async function createFolder(): Promise<void> {
  folderBusy.value = true
  folderError.value = ''
  try {
    await projects.createFolder(folderName.value)
    createFolderOpen.value = false
    toasts.push({ type: 'success', message: 'Folder created' })
  } catch (error) {
    folderError.value = toAppError(error, 'Addons Studio could not create this folder.').userMessage
  } finally {
    folderBusy.value = false
  }
}
</script>

<template>
  <main class="projects-view page-shell">
    <AppHeader
      :title="currentFolder?.name ?? locale.t('My Projects')"
      :subtitle="
        currentFolder
          ? `${visibleProjects.length} ${visibleProjects.length === 1 ? 'project' : 'projects'}`
          : `${projects.projects.length} projects · ${projects.folders.length} folders`
      "
    >
      <template v-if="currentFolder" #leading>
        <IconButton
          icon="arrow-left"
          label="Back to My Projects"
          @click="router.push({ name: 'projects' })"
        />
      </template>
      <template #actions>
        <IconButton
          icon="plus"
          label="Create project"
          variant="surface"
          @click="router.push({ name: 'create-project' })"
        />
      </template>
    </AppHeader>

    <div v-if="!currentFolder" class="project-toolbar">
      <AppButton variant="secondary" @click="showCreateFolder">
        <template #icon><AppIcon name="folder-plus" :size="20" /></template>
        {{ locale.t('New Folder') }}
      </AppButton>
      <AppButton @click="router.push({ name: 'create-project' })">
        <template #icon><AppIcon name="plus" :size="20" /></template>
        {{ locale.t('New Project') }}
      </AppButton>
      <AppButton class="project-toolbar__import" variant="secondary" @click="projectImport?.openPicker()">
        <template #icon><AppIcon name="upload" :size="20" /></template>
        {{ locale.t('Import Project (Beta)') }}
      </AppButton>
    </div>

    <label class="search-field">
      <AppIcon name="search" :size="19" />
      <span class="visually-hidden">{{ locale.t('Search projects and folders') }}</span>
      <input v-model="query" type="search" :placeholder="locale.t('Search projects and folders')" />
    </label>

    <div v-if="projects.loading" class="projects-grid" aria-label="Loading projects">
      <div v-for="index in 4" :key="index" class="skeleton project-skeleton" />
    </div>

    <template v-else-if="visibleItemCount">
      <section v-if="filteredFolders.length" class="content-section" aria-labelledby="folders-heading">
        <header><h2 id="folders-heading">{{ locale.t('Folders') }}</h2><span>{{ filteredFolders.length }}</span></header>
        <div class="projects-grid folders-grid">
          <ProjectFolderCard
            v-for="folder in filteredFolders"
            :key="folder.id"
            :folder="folder"
            :project-count="folderProjectCount(folder.id)"
            @open="router.push({ name: 'project-folder', params: { folderId: folder.id } })"
            @menu="openFolderActions(folder)"
          />
        </div>
      </section>

      <section v-if="filteredProjects.length" class="content-section" aria-labelledby="projects-heading">
        <header>
          <h2 id="projects-heading">{{ locale.t(currentFolder ? 'Projects' : 'Root Projects') }}</h2>
          <span>{{ filteredProjects.length }}</span>
        </header>
        <div class="projects-grid">
          <ProjectCard
            v-for="project in filteredProjects"
            :key="project.id"
            :project="project"
            @open="router.push({ name: 'workspace', params: { id: project.id } })"
            @menu="openProjectActions(project)"
          />
        </div>
      </section>
    </template>

    <section v-else-if="query" class="empty-state">
      <span><AppIcon name="search" :size="30" /></span>
      <h2>{{ locale.t('No matching projects or folders') }}</h2>
      <p>{{ locale.t('Try a different name or namespace.') }}</p>
      <AppButton variant="secondary" @click="query = ''">{{ locale.t('Clear search') }}</AppButton>
    </section>

    <section v-else class="empty-state">
      <span>
        <AppIcon v-if="currentFolder" name="folder-open" :size="35" />
        <StudioIcon v-else name="project" :size="35" />
      </span>
      <h2>{{ locale.t(currentFolder ? 'This folder is empty' : 'No projects yet') }}</h2>
      <p>
        {{
          currentFolder
            ? locale.t('Move a project here from its menu, or create a new project.')
            : locale.t('Projects and folders stay on this device in IndexedDB.')
        }}
      </p>
      <AppButton size="large" @click="router.push({ name: 'create-project' })">
        <template #icon><StudioIcon name="add-resource" :size="22" /></template>
        {{ locale.t('Create Project') }}
      </AppButton>
    </section>

    <ProjectActionsController
      :project="selectedProject"
      :open="projectActionsOpen"
      @close="projectActionsOpen = false"
    />
    <ProjectFolderActionsController
      :folder="selectedFolder"
      :project-count="selectedFolder ? folderProjectCount(selectedFolder.id) : 0"
      :open="folderActionsOpen"
      @close="folderActionsOpen = false"
    />
    <ProjectImportController ref="projectImport" />

    <AppDialog
      :open="createFolderOpen"
      :title="locale.t('New Folder')"
      description="Folders organize projects locally. Nested folders are not included yet."
      @close="createFolderOpen = false"
    >
      <label class="field-label" for="new-folder-name">{{ locale.t('Folder Name') }}</label>
      <input
        id="new-folder-name"
        v-model="folderName"
        class="text-input"
        maxlength="60"
        autocomplete="off"
        placeholder="Río Grande"
        @keydown.enter.prevent="createFolder"
      />
      <p v-if="folderError" class="field-error" role="alert">{{ folderError }}</p>
      <template #actions>
        <AppButton variant="ghost" @click="createFolderOpen = false">{{ locale.t('Cancel') }}</AppButton>
        <AppButton :loading="folderBusy" @click="createFolder">{{ locale.t('Create Folder') }}</AppButton>
      </template>
    </AppDialog>
  </main>
</template>

<style scoped>
.project-toolbar {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
  margin: 0.35rem 0 var(--space-3);
}

.project-toolbar__import { grid-column: 1 / -1; }

.search-field {
  min-height: 3rem;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0.65rem;
  margin: 0.45rem 0 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 0 0.85rem;
  background: var(--color-surface);
  color: var(--color-text-subtle);
  box-shadow: var(--shadow-card);
}

.search-field:focus-within {
  border-color: var(--color-accent);
  box-shadow: var(--focus-ring);
}

.search-field input {
  width: 100%;
  min-height: 2.9rem;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--color-text);
  font: inherit;
  font-size: 1rem;
}

.content-section + .content-section {
  margin-top: var(--space-6);
}

.content-section > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-2);
}

.content-section h2 {
  margin: 0;
  font-size: 0.82rem;
  letter-spacing: 0.035em;
  text-transform: uppercase;
}

.content-section header span {
  color: var(--color-text-subtle);
  font-family: var(--font-mono);
  font-size: 0.68rem;
}

.projects-grid {
  display: grid;
  gap: 0.75rem;
}

.project-skeleton {
  height: 6.3rem;
  border-radius: var(--radius-xl);
}

.empty-state {
  min-height: 46dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  text-align: center;
}

.empty-state > span {
  width: 4.5rem;
  height: 4.5rem;
  display: grid;
  place-items: center;
  border-radius: var(--radius-xl);
  background: var(--color-accent-soft);
  color: var(--color-accent-strong);
  --studio-icon-accent: var(--color-brand-secondary);
}

.empty-state h2 {
  margin: 1rem 0 0;
  font-size: 1.25rem;
}

.empty-state p {
  max-width: 22rem;
  margin: 0.45rem 0 1.25rem;
  color: var(--color-text-muted);
  font-size: 0.85rem;
  line-height: 1.5;
}

@media (min-width: 720px) {
  .projects-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
