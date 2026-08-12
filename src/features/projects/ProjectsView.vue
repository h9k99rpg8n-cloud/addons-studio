<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import AppButton from '@/components/common/AppButton.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import IconButton from '@/components/common/IconButton.vue'
import StudioIcon from '@/components/common/StudioIcon.vue'
import AppHeader from '@/components/navigation/AppHeader.vue'
import ProjectActionsController from '@/components/project/ProjectActionsController.vue'
import ProjectCard from '@/components/project/ProjectCard.vue'
import { toAppError } from '@/core/errors/AppError'
import { useProjectStore } from '@/stores/projects'
import { useToastStore } from '@/stores/toasts'
import type { StudioProject } from '@/types/project'

const router = useRouter()
const projects = useProjectStore()
const toasts = useToastStore()
const query = ref('')
const selectedProject = ref<StudioProject>()
const actionsOpen = ref(false)

const filteredProjects = computed(() => {
  const needle = query.value.trim().toLowerCase()
  if (!needle) return projects.projects
  return projects.projects.filter(
    (project) =>
      project.name.toLowerCase().includes(needle) ||
      project.namespace.toLowerCase().includes(needle),
  )
})

onMounted(async () => {
  try {
    await projects.loadProjects()
  } catch (error) {
    toasts.push({
      type: 'error',
      message: toAppError(error, 'Addons Studio could not load local projects.').userMessage,
    })
  }
})

function openActions(project: StudioProject): void {
  selectedProject.value = project
  actionsOpen.value = true
}
</script>

<template>
  <main class="projects-view page-shell">
    <AppHeader title="My Projects" :subtitle="`${projects.projects.length} stored locally`">
      <template #actions>
        <IconButton
          icon="plus"
          label="Create project"
          variant="surface"
          @click="router.push({ name: 'create-project' })"
        />
      </template>
    </AppHeader>

    <label class="search-field">
      <AppIcon name="search" :size="19" />
      <span class="visually-hidden">Search projects</span>
      <input v-model="query" type="search" placeholder="Search name or namespace" />
    </label>

    <div v-if="projects.loading" class="projects-grid" aria-label="Loading projects">
      <div v-for="index in 4" :key="index" class="skeleton project-skeleton" />
    </div>

    <section v-else-if="filteredProjects.length" class="projects-grid" aria-label="Local projects">
      <ProjectCard
        v-for="project in filteredProjects"
        :key="project.id"
        :project="project"
        @open="router.push({ name: 'workspace', params: { id: project.id } })"
        @menu="openActions(project)"
      />
    </section>

    <section v-else-if="query" class="empty-state">
      <span><AppIcon name="search" :size="30" /></span>
      <h2>No matching projects</h2>
      <p>Try a different name or namespace.</p>
      <AppButton variant="secondary" @click="query = ''">Clear search</AppButton>
    </section>

    <section v-else class="empty-state">
      <span><StudioIcon name="project" :size="35" /></span>
      <h2>No projects yet</h2>
      <p>Your projects stay on this device in IndexedDB. Start with a clean one.</p>
      <AppButton size="large" @click="router.push({ name: 'create-project' })">
        <template #icon><StudioIcon name="add-resource" :size="22" /></template>
        Create Project
      </AppButton>
    </section>

    <ProjectActionsController
      :project="selectedProject"
      :open="actionsOpen"
      @close="actionsOpen = false"
    />
  </main>
</template>

<style scoped>
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

.projects-grid {
  display: grid;
  gap: 0.75rem;
}

.project-skeleton {
  height: 6.3rem;
  border-radius: var(--radius-xl);
}

.empty-state {
  min-height: 52dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 2rem 1rem;
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
