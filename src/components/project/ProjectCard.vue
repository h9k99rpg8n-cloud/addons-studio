<script setup lang="ts">
import AppIcon from '@/components/common/AppIcon.vue'
import IconButton from '@/components/common/IconButton.vue'
import StudioIcon from '@/components/common/StudioIcon.vue'
import ProjectIcon from '@/components/project/ProjectIcon.vue'
import type { StudioIconName } from '@/core/icons/studioIcons'
import { useLocaleStore } from '@/stores/locale'
import type { ProjectType, StudioProject } from '@/types/project'
import { formatRelativeDate } from '@/utils/format'

defineProps<{
  project: StudioProject
}>()

defineEmits<{
  open: []
  menu: []
}>()

const locale = useLocaleStore()

const projectTypeLabels: Record<ProjectType, string> = {
  addon: 'Add-on',
  resource_pack: 'Resource Pack',
  behavior_pack: 'Behavior Pack',
}

const projectTypeIcons: Record<ProjectType, StudioIconName> = {
  addon: 'project',
  resource_pack: 'resource-pack',
  behavior_pack: 'behavior-pack',
}
</script>

<template>
  <article class="project-card">
    <button type="button" class="project-card__open" @click="$emit('open')">
      <ProjectIcon :icon="project.icon" />
      <span class="project-card__content">
        <span class="project-card__heading">
          <strong>{{ project.name }}</strong>
        </span>
        <span class="project-card__namespace">{{ project.namespace }}</span>
        <span class="project-card__meta" :aria-label="locale.t('Project details')">
          <span>
            <StudioIcon :name="projectTypeIcons[project.projectType]" :size="14" />
            {{ locale.t(projectTypeLabels[project.projectType]) }}
          </span>
          <span>{{ project.targetVersion }}</span>
          <span>{{ locale.t('Edited') }} {{ formatRelativeDate(project.updatedAt, Date.now(), locale.language) }}</span>
        </span>
      </span>
      <AppIcon name="chevron-right" :size="19" class="project-card__chevron" />
    </button>
    <IconButton
      class="project-card__menu"
      icon="more-vertical"
      :label="`${locale.t('Project actions for')} ${project.name}`"
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
  transition: var(--transition-interactive), box-shadow var(--motion-fast) ease;
}

.project-card__open {
  width: 100%;
  min-height: 7rem;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  border: 0;
  border-radius: inherit;
  padding: var(--card-padding) 3.1rem var(--card-padding) var(--card-padding);
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
  gap: 0.25rem;
}

.project-card__heading,
.project-card__content strong,
.project-card__namespace {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-card__content strong {
  font-size: 1rem;
  line-height: 1.3;
}

.project-card__namespace {
  color: var(--color-accent-strong);
  font-family: var(--font-mono);
  font-size: 0.72rem;
}

.project-card__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem;
  margin-top: 0.15rem;
  color: var(--color-text-subtle);
  font-size: 0.68rem;
}

.project-card__meta > span {
  min-height: 1.45rem;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  padding: 0.17rem 0.38rem;
  background: var(--color-surface-raised);
}

.project-card__meta > span:first-child {
  color: var(--color-text-muted);
}

.project-card__chevron {
  color: var(--color-text-subtle);
}

.project-card__menu {
  position: absolute;
  z-index: 1;
  inset: 0.48rem 0.35rem auto auto;
}

@media (hover: hover) and (pointer: fine) {
  .project-card:hover {
    border-color: var(--color-border-strong);
    box-shadow: var(--shadow-card-hover);
    transform: translateY(-1px);
  }
}
</style>
