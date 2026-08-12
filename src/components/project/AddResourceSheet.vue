<script setup lang="ts">
import { computed } from 'vue'

import AppBadge from '@/components/common/AppBadge.vue'
import BottomSheet from '@/components/common/BottomSheet.vue'
import StudioIcon from '@/components/common/StudioIcon.vue'
import { resourceTemplateRegistry } from '@/core/project/resourceTemplateRegistry'
import type { ResourceTemplate, ResourceTemplateGroup } from '@/types/project'

const props = defineProps<{
  open: boolean
  targetVersion: string
}>()

const emit = defineEmits<{
  close: []
  select: [template: ResourceTemplate]
}>()

const groups: readonly { id: ResourceTemplateGroup; label: string; description: string }[] = [
  { id: 'gameplay', label: 'Gameplay', description: 'Objects that affect the game' },
  { id: 'resources', label: 'Resources', description: 'Visual and audio building blocks' },
  { id: 'logic', label: 'Logic', description: 'Commands and scripting' },
]

const templates = computed(() => resourceTemplateRegistry.list(props.targetVersion))

function templatesFor(group: ResourceTemplateGroup): ResourceTemplate[] {
  return templates.value.filter((template) => template.group === group)
}
</script>

<template>
  <BottomSheet
    :open="open"
    title="Add Resource"
    description="Choose the kind of object you want to create"
    @close="$emit('close')"
  >
    <div class="resource-picker">
      <section v-for="group in groups" :key="group.id">
        <header>
          <h3>{{ group.label }}</h3>
          <p>{{ group.description }}</p>
        </header>
        <div class="resource-picker__grid">
          <button
            v-for="template in templatesFor(group.id)"
            :key="template.id"
            type="button"
            @click="emit('select', template)"
          >
            <span class="resource-picker__icon icon-surface" :class="`tone-${template.tone}`">
              <StudioIcon :name="template.icon" :size="27" />
            </span>
            <span class="resource-picker__copy">
              <strong>{{ template.name }}</strong>
              <small>{{ template.description }}</small>
            </span>
            <AppBadge>Coming soon</AppBadge>
          </button>
        </div>
      </section>
    </div>
  </BottomSheet>
</template>

<style scoped>
.resource-picker {
  display: grid;
  gap: var(--space-6);
  padding-bottom: 0.5rem;
}

.resource-picker section > header {
  margin-bottom: 0.55rem;
}

.resource-picker h3 {
  margin: 0;
  font-size: 0.86rem;
}

.resource-picker header p {
  margin: 0.2rem 0 0;
  color: var(--color-text-subtle);
  font-size: 0.68rem;
}

.resource-picker__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
}

.resource-picker__grid button {
  min-width: 0;
  min-height: 8.4rem;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-content: space-between;
  gap: var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
  background: var(--color-surface-raised);
  color: var(--color-text);
  text-align: left;
  cursor: pointer;
  transition: var(--transition-interactive);
}

.resource-picker__grid button:active {
  border-color: var(--color-accent);
  background: var(--color-accent-soft);
}

.resource-picker__icon {
  width: 3rem;
  height: 3rem;
  grid-row: 1;
  grid-column: 1;
}

.resource-picker__copy {
  min-width: 0;
  display: grid;
  grid-column: 1 / -1;
  gap: 0.15rem;
}

.resource-picker__grid button > :last-child {
  grid-row: 1;
  grid-column: 2;
  align-self: start;
  justify-self: end;
}

.resource-picker__copy strong {
  overflow: hidden;
  align-self: center;
  font-size: 0.82rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.resource-picker__copy small {
  display: -webkit-box;
  overflow: hidden;
  color: var(--color-text-subtle);
  font-size: 0.62rem;
  line-height: 1.35;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

@media (hover: hover) and (pointer: fine) {
  .resource-picker__grid button:hover {
    border-color: var(--tone-border, var(--color-accent-border));
  }
}

@media (min-width: 560px) {
  .resource-picker__grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
