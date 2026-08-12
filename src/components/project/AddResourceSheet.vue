<script setup lang="ts">
import { computed } from 'vue'

import AppBadge from '@/components/common/AppBadge.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import BottomSheet from '@/components/common/BottomSheet.vue'
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
            <span><AppIcon :name="template.icon" :size="23" /></span>
            <strong>{{ template.name }}</strong>
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
  gap: 1.25rem;
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
  min-height: 6.9rem;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-content: space-between;
  gap: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 0.7rem;
  background: var(--color-surface-raised);
  color: var(--color-text);
  text-align: left;
}

.resource-picker__grid button:active {
  border-color: var(--color-accent);
  background: var(--color-accent-soft);
}

.resource-picker__grid button > span:first-child {
  width: 2.7rem;
  height: 2.7rem;
  display: grid;
  grid-column: 1 / -1;
  place-items: center;
  border-radius: var(--radius-md);
  background: var(--color-accent-soft);
  color: var(--color-accent-strong);
}

.resource-picker__grid strong {
  overflow: hidden;
  align-self: center;
  font-size: 0.82rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (min-width: 560px) {
  .resource-picker__grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
