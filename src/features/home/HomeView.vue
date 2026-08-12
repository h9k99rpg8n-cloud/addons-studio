<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import AppBadge from '@/components/common/AppBadge.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import BrandMark from '@/components/common/BrandMark.vue'
import IconButton from '@/components/common/IconButton.vue'
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
const selectedProject = ref<StudioProject>()
const actionsOpen = ref(false)

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

function openProject(project: StudioProject): void {
  void router.push({ name: 'workspace', params: { id: project.id } })
}

function openActions(project: StudioProject): void {
  selectedProject.value = project
  actionsOpen.value = true
}

function importPlaceholder(): void {
  toasts.push({
    type: 'info',
    message: 'Project import is coming in a future Addons Studio update.',
  })
}
</script>

<template>
  <main class="home-view page-shell">
    <AppHeader title="Addons Studio" subtitle="0.0.1-dev · Pre-Alpha">
      <template #leading><BrandMark :size="42" /></template>
      <template #actions>
        <IconButton
          icon="settings"
          label="Open settings"
          variant="surface"
          @click="router.push({ name: 'settings' })"
        />
      </template>
    </AppHeader>

    <section class="home-intro" aria-labelledby="home-heading">
      <p class="eyebrow">Mobile creation workspace</p>
      <h2 id="home-heading">What will you build?</h2>
      <p>Start a Bedrock project or continue where you left off.</p>
    </section>

    <section class="home-actions" aria-label="Project actions">
      <RouterLink :to="{ name: 'create-project' }" class="action-card action-card--primary">
        <span class="action-card__icon"><AppIcon name="plus" :size="26" /></span>
        <span><strong>New Project</strong><small>Build from a clean foundation</small></span>
        <AppIcon name="chevron-right" :size="20" />
      </RouterLink>
      <RouterLink :to="{ name: 'projects' }" class="action-card">
        <span class="action-card__icon"><AppIcon name="folder" :size="25" /></span>
        <span><strong>My Projects</strong><small>{{ projects.projects.length }} stored locally</small></span>
        <AppIcon name="chevron-right" :size="20" />
      </RouterLink>
      <button type="button" class="action-card" @click="importPlaceholder">
        <span class="action-card__icon"><AppIcon name="upload" :size="24" /></span>
        <span>
          <strong>Import Project <AppBadge>Coming soon</AppBadge></strong>
          <small>Import is not implemented in 0.0.1</small>
        </span>
        <AppIcon name="info" :size="19" />
      </button>
    </section>

    <section class="recent-projects" aria-labelledby="recent-heading">
      <header class="section-heading">
        <div>
          <p class="eyebrow">On this device</p>
          <h2 id="recent-heading">Recent projects</h2>
        </div>
        <RouterLink v-if="projects.projects.length" :to="{ name: 'projects' }">View all</RouterLink>
      </header>

      <div v-if="projects.loading" class="project-skeletons" aria-label="Loading projects">
        <div v-for="index in 2" :key="index" class="skeleton project-skeleton" />
      </div>

      <div v-else-if="projects.recentProjects.length" class="project-list">
        <ProjectCard
          v-for="project in projects.recentProjects"
          :key="project.id"
          :project="project"
          @open="openProject(project)"
          @menu="openActions(project)"
        />
      </div>

      <div v-else class="empty-card">
        <span><AppIcon name="blocks" :size="27" /></span>
        <div>
          <strong>Your workspace is clean</strong>
          <p>Create your first project. No demo data will be added behind your back.</p>
        </div>
      </div>
    </section>

    <ProjectActionsController
      :project="selectedProject"
      :open="actionsOpen"
      @close="actionsOpen = false"
    />
  </main>
</template>

<style scoped>
.home-intro {
  padding: clamp(1.2rem, 5vw, 2rem) 0 1rem;
}

.home-intro h2 {
  margin: 0.25rem 0 0;
  font-size: clamp(1.65rem, 8vw, 2.35rem);
  letter-spacing: -0.035em;
}

.home-intro > p:last-child {
  margin: 0.5rem 0 0;
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

.home-actions {
  display: grid;
  gap: 0.65rem;
}

.action-card {
  width: 100%;
  min-height: 4.9rem;
  display: grid;
  grid-template-columns: 3rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.8rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: 0.7rem 0.8rem;
  background: var(--color-surface);
  color: var(--color-text);
  text-align: left;
  text-decoration: none;
  box-shadow: var(--shadow-card);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.action-card:active {
  background: var(--color-surface-raised);
  transform: scale(0.99);
}

.action-card--primary {
  border-color: var(--color-accent-border);
  background: var(--color-accent-soft);
}

.action-card__icon {
  width: 3rem;
  height: 3rem;
  display: grid;
  place-items: center;
  border-radius: var(--radius-lg);
  background: var(--color-surface-raised);
  color: var(--color-accent-strong);
}

.action-card > span:nth-child(2) {
  min-width: 0;
  display: grid;
  gap: 0.2rem;
}

.action-card strong {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.96rem;
}

.action-card small {
  overflow: hidden;
  color: var(--color-text-subtle);
  font-size: 0.74rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-projects {
  margin-top: 2rem;
}

.section-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.8rem;
}

.section-heading h2 {
  margin: 0.2rem 0 0;
  font-size: 1.15rem;
}

.section-heading a {
  min-height: var(--touch-target);
  display: inline-flex;
  align-items: center;
  color: var(--color-accent-strong);
  font-size: 0.8rem;
  font-weight: 750;
  text-decoration: none;
}

.project-list,
.project-skeletons {
  display: grid;
  gap: 0.7rem;
}

.project-skeleton {
  height: 6.3rem;
  border-radius: var(--radius-xl);
}

.empty-card {
  display: grid;
  grid-template-columns: 3rem minmax(0, 1fr);
  gap: 0.85rem;
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-xl);
  padding: 1.1rem;
  background: var(--color-surface-muted);
}

.empty-card > span {
  width: 3rem;
  height: 3rem;
  display: grid;
  place-items: center;
  border-radius: var(--radius-lg);
  background: var(--color-accent-soft);
  color: var(--color-accent-strong);
}

.empty-card strong {
  font-size: 0.9rem;
}

.empty-card p {
  margin: 0.35rem 0 0;
  color: var(--color-text-subtle);
  font-size: 0.76rem;
  line-height: 1.45;
}

@media (min-width: 720px) {
  .home-actions {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .action-card {
    min-height: 9rem;
    grid-template-columns: 1fr auto;
    align-content: space-between;
  }

  .action-card__icon,
  .action-card > span:nth-child(2) {
    grid-column: 1 / -1;
  }

  .project-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
