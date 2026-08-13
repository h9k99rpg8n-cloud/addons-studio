<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import AppBadge from '@/components/common/AppBadge.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import BrandMark from '@/components/common/BrandMark.vue'
import IconButton from '@/components/common/IconButton.vue'
import StudioIcon from '@/components/common/StudioIcon.vue'
import AppHeader from '@/components/navigation/AppHeader.vue'
import ProjectActionsController from '@/components/project/ProjectActionsController.vue'
import ProjectCard from '@/components/project/ProjectCard.vue'
import { toAppError } from '@/core/errors/AppError'
import { APP_RELEASE_LABEL } from '@/core/app/release'
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
    <AppHeader title="Addons Studio" :subtitle="`${APP_RELEASE_LABEL} · Mobile Studio`">
      <template #leading>
        <span class="home-brand"><BrandMark :size="38" /></span>
      </template>
      <template #actions>
        <IconButton
          icon="settings"
          label="Open settings"
          variant="surface"
          @click="router.push({ name: 'settings' })"
        />
      </template>
    </AppHeader>

    <section class="home-hero" aria-labelledby="home-heading">
      <div class="home-hero__copy">
        <p class="eyebrow">Create Bedrock without limits</p>
        <h2 id="home-heading">Your ideas, built locally.</h2>
        <p>Start a Bedrock project or continue creating right where you left off.</p>
        <span class="home-hero__status">
          <AppIcon name="shield" :size="16" /> Private by default · Saved on this device
        </span>
      </div>
      <span class="home-hero__art" aria-hidden="true">
        <StudioIcon name="workspace" :size="76" :stroke-width="1.25" />
      </span>
    </section>

    <section class="home-actions" aria-label="Project actions">
      <RouterLink :to="{ name: 'create-project' }" class="action-card action-card--primary">
        <span class="action-card__icon action-card__icon--product">
          <StudioIcon name="add-resource" :size="29" />
        </span>
        <span><strong>New Project</strong><small>Build from a clean, local foundation</small></span>
        <AppIcon name="chevron-right" :size="20" />
      </RouterLink>
      <RouterLink :to="{ name: 'projects' }" class="action-card">
        <span class="action-card__icon action-card__icon--product">
          <StudioIcon name="project" :size="27" />
        </span>
        <span><strong>My Projects</strong><small>{{ projects.projects.length }} stored locally</small></span>
        <AppIcon name="chevron-right" :size="20" />
      </RouterLink>
      <button type="button" class="action-card" @click="importPlaceholder">
        <span class="action-card__icon"><AppIcon name="upload" :size="24" /></span>
        <span>
          <strong>Import Project <AppBadge>Coming soon</AppBadge></strong>
          <small>Import is not implemented in Alpha 0.0.3.5</small>
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
        <span><StudioIcon name="workspace" :size="29" /></span>
        <div>
          <strong>Your workspace is clean</strong>
          <p>Create your first project. No demo data will be added behind your back.</p>
        </div>
      </div>
    </section>

    <aside class="home-tip">
      <span><StudioIcon name="material" :size="23" /></span>
      <p><strong>Model Studio has begun.</strong> Build cube geometry with touch controls while Materials, logic, and advanced editors remain clearly marked for future releases.</p>
    </aside>

    <ProjectActionsController
      :project="selectedProject"
      :open="actionsOpen"
      @close="actionsOpen = false"
    />
  </main>
</template>

<style scoped>
.home-brand {
  width: 2.85rem;
  height: 2.85rem;
  display: grid;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.home-hero {
  position: relative;
  min-height: 13.5rem;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-4);
  overflow: hidden;
  margin: var(--space-3) 0 var(--space-4);
  border: 1px solid var(--color-accent-border);
  border-radius: var(--radius-2xl);
  padding: clamp(1.15rem, 5vw, 1.65rem);
  background:
    radial-gradient(circle at 92% 5%, var(--color-brand-glow), transparent 42%),
    var(--color-surface);
  box-shadow: var(--shadow-card);
}

.home-hero::after {
  position: absolute;
  inset: auto -4rem -5rem auto;
  width: 11rem;
  height: 11rem;
  border: 1px solid color-mix(in srgb, var(--color-brand-primary) 18%, transparent);
  border-radius: 50%;
  content: '';
  pointer-events: none;
}

.home-hero__copy {
  position: relative;
  z-index: 1;
  min-width: 0;
}

.home-hero h2 {
  max-width: 16ch;
  margin: var(--space-2) 0 0;
  font-size: var(--font-size-title);
  letter-spacing: -0.045em;
  line-height: var(--line-height-tight);
}

.home-hero__copy > p:not(.eyebrow) {
  max-width: 34rem;
  margin: var(--space-3) 0 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-body);
  line-height: var(--line-height-body);
}

.home-hero__status {
  min-height: 1.9rem;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  padding: 0.3rem 0.55rem;
  background: var(--color-surface-muted);
  color: var(--color-text-subtle);
  font-size: 0.64rem;
  font-weight: 700;
}

.home-hero__status svg {
  color: var(--color-accent-strong);
}

.home-hero__art {
  position: relative;
  z-index: 1;
  width: 6rem;
  height: 6rem;
  display: grid;
  place-items: center;
  border: 1px solid var(--tone-brand-border);
  border-radius: 1.8rem;
  background: var(--tone-brand-soft);
  color: var(--tone-brand);
  box-shadow: inset 0 1px 0 color-mix(in srgb, white 7%, transparent);
  --studio-icon-accent: var(--color-brand-secondary);
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
  gap: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: var(--space-3);
  background: var(--color-surface);
  color: var(--color-text);
  text-align: left;
  text-decoration: none;
  box-shadow: var(--shadow-card);
  cursor: pointer;
  transition: var(--transition-interactive), box-shadow var(--motion-fast) ease;
  -webkit-tap-highlight-color: transparent;
}

.action-card:active {
  background: var(--color-surface-raised);
  transform: scale(0.99);
}

.action-card--primary {
  border-color: var(--color-accent-border);
  background: color-mix(in srgb, var(--color-accent-soft) 72%, var(--color-surface));
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

.action-card__icon--product {
  border: 1px solid var(--tone-brand-border);
  background: var(--tone-brand-soft);
  color: var(--tone-brand);
  --studio-icon-accent: var(--color-brand-secondary);
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
  margin-top: var(--space-8);
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
  --studio-icon-accent: var(--color-brand-secondary);
}

.home-tip {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: var(--space-3);
  margin-top: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
  background: var(--color-surface-muted);
}

.home-tip > span {
  width: 2.4rem;
  height: 2.4rem;
  display: grid;
  place-items: center;
  border-radius: var(--radius-md);
  background: var(--tone-gold-soft);
  color: var(--tone-gold);
  --studio-icon-accent: var(--tone-brand);
}

.home-tip p {
  margin: 0;
  color: var(--color-text-subtle);
  font-size: 0.7rem;
  line-height: 1.5;
}

.home-tip strong {
  color: var(--color-text-muted);
}

@media (max-width: 390px) {
  .home-hero__art {
    position: absolute;
    right: -1.4rem;
    bottom: -1.4rem;
    opacity: 0.26;
    transform: rotate(-7deg);
  }

  .home-hero__copy {
    grid-column: 1 / -1;
  }
}

@media (hover: hover) and (pointer: fine) {
  .action-card:hover {
    border-color: var(--color-border-strong);
    box-shadow: var(--shadow-card-hover);
    transform: translateY(-1px);
  }
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
