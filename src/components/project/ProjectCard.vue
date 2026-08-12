<script setup lang="ts">
import AppIcon from '@/components/common/AppIcon.vue'
import IconButton from '@/components/common/IconButton.vue'
import ProjectIcon from '@/components/project/ProjectIcon.vue'
import type { ProjectType, StudioProject } from '@/types/project'
import { formatRelativeDate } from '@/utils/format'

defineProps<{
  project: StudioProject
}>()

defineEmits<{
  open: []
  menu: []
}>()

const projectTypeLabels: Record<ProjectType, string> = {
  addon: 'Add-on',
  resource_pack: 'Resource Pack',
  behavior_pack: 'Behavior Pack',
}
</script>

<template>
  <article class="project-card">
    <button type="button" class="project-card__open" @click="$emit('open')">
      <ProjectIcon :icon="project.icon" />
      <span class="project-card__content">
        <strong>{{ project.name }}</strong>
        <span class="project-card__namespace">{{ project.namespace }}</span>
        <span class="project-card__meta">
          {{ projectTypeLabels[project.projectType] }} · {{ project.targetVersion }} ·
          {{ formatRelativeDate(project.updatedAt) }}
        </span>
      </span>
      <AppIcon name="chevron-right" :size="19" class="project-card__chevron" />
    </button>
    <IconButton
      class="project-card__menu"
      icon="more-vertical"
      :label="`Project actions for ${project.name}`"
      @click="$emit('menu')"
    />
  </article>
</template>

<style scoped>
.project-card {
  position: relative;
  min-width: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.project-card__open {
  width: 100%;
  min-height: 6.3rem;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.85rem;
  border: 0;
  border-radius: inherit;
  padding: 0.95rem 3rem 0.95rem 0.95rem;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.project-card__open:active {
  background: var(--color-surface-raised);
}

.project-card__content {
  min-width: 0;
  display: grid;
  gap: 0.2rem;
}

.project-card__content strong,
.project-card__namespace,
.project-card__meta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-card__content strong {
  font-size: 0.98rem;
  line-height: 1.3;
}

.project-card__namespace {
  color: var(--color-accent-strong);
  font-family: var(--font-mono);
  font-size: 0.73rem;
}

.project-card__meta {
  color: var(--color-text-subtle);
  font-size: 0.72rem;
}

.project-card__chevron {
  color: var(--color-text-subtle);
}

.project-card__menu {
  position: absolute;
  z-index: 1;
  inset: 0.48rem 0.35rem auto auto;
}
</style>
