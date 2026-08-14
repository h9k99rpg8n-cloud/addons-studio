<script setup lang="ts">
import AppIcon from '@/components/common/AppIcon.vue'
import IconButton from '@/components/common/IconButton.vue'
import { useLocaleStore } from '@/stores/locale'
import type { StudioProjectFolder } from '@/types/project'

defineProps<{
  folder: StudioProjectFolder
  projectCount: number
}>()

defineEmits<{
  open: []
  menu: []
}>()

const locale = useLocaleStore()
</script>

<template>
  <article class="folder-card">
    <button type="button" class="folder-card__open" @click="$emit('open')">
      <span class="folder-card__icon"><AppIcon name="folder-open" :size="29" /></span>
      <span class="folder-card__content">
        <strong>{{ folder.name }}</strong>
        <small>{{ projectCount }} {{ locale.t(projectCount === 1 ? 'project' : 'projects') }}</small>
      </span>
      <AppIcon name="chevron-right" :size="19" class="folder-card__chevron" />
    </button>
    <IconButton
      class="folder-card__menu"
      icon="more-vertical"
      :label="`${locale.t('Folder actions for')} ${folder.name}`"
      @click="$emit('menu')"
    />
  </article>
</template>

<style scoped>
.folder-card {
  position: relative;
  min-width: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.folder-card__open {
  width: 100%;
  min-height: 5.6rem;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  border: 0;
  border-radius: inherit;
  padding: var(--card-padding) 3.1rem var(--card-padding) var(--card-padding);
  background: transparent;
  color: var(--color-text);
  text-align: left;
}

.folder-card__open:active {
  background: var(--color-surface-raised);
}

.folder-card__icon {
  width: 3.15rem;
  height: 3.15rem;
  display: grid;
  place-items: center;
  border: 1px solid var(--color-accent-border);
  border-radius: var(--radius-lg);
  background: var(--color-accent-soft);
  color: var(--color-accent-strong);
}

.folder-card__content {
  min-width: 0;
  display: grid;
  gap: 0.25rem;
}

.folder-card__content strong,
.folder-card__content small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-card__content strong {
  font-size: 1rem;
}

.folder-card__content small,
.folder-card__chevron {
  color: var(--color-text-subtle);
  font-size: 0.72rem;
}

.folder-card__menu {
  position: absolute;
  z-index: 1;
  inset: 0.48rem 0.35rem auto auto;
}
</style>
