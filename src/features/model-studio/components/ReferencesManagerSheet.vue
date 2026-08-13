<script setup lang="ts">
import AppIcon from '@/components/common/AppIcon.vue'
import BottomSheet from '@/components/common/BottomSheet.vue'
import type { StudioReferenceImage } from '@/types/model'

defineProps<{
  open: boolean
  references: StudioReferenceImage[]
  assetUrls: Record<string, string>
  importing?: boolean
}>()

defineEmits<{
  close: []
  add: []
  edit: [id: string]
  toggle: [id: string]
  delete: [id: string]
}>()

function viewLabel(view: StudioReferenceImage['view']): string {
  return view.charAt(0).toUpperCase() + view.slice(1)
}
</script>

<template>
  <BottomSheet
    :open="open"
    title="References"
    description="Viewport-aligned modeling guides · never model geometry"
    @close="$emit('close')"
  >
    <div class="references-manager">
      <button class="add-reference" type="button" :disabled="importing" @click="$emit('add')">
        <AppIcon name="image-plus" :size="22" />
        <span><strong>{{ importing ? 'Opening image…' : 'Add Reference' }}</strong><small>PNG or JPG · assign Front, Back, Left, Right, Top, or Bottom</small></span>
      </button>

      <div v-if="references.length" class="reference-list">
        <article v-for="reference in references" :key="reference.id" class="reference-row">
          <button type="button" class="reference-row__main" @click="$emit('edit', reference.id)">
            <span class="reference-row__preview">
              <img v-if="assetUrls[reference.assetId]" :src="assetUrls[reference.assetId]" alt="" />
              <AppIcon v-else name="alert-triangle" :size="19" />
            </span>
            <span>
              <strong>{{ viewLabel(reference.view) }} · {{ reference.name }}</strong>
              <small>{{ Math.round(reference.opacity * 100) }}% opacity · {{ reference.visible ? 'Visible' : 'Hidden' }}<template v-if="!assetUrls[reference.assetId]"> · Image unavailable</template></small>
            </span>
          </button>
          <button type="button" :aria-label="`${reference.visible ? 'Hide' : 'Show'} ${reference.name}`" @click="$emit('toggle', reference.id)">
            <AppIcon :name="reference.visible ? 'eye' : 'eye-off'" :size="19" />
          </button>
          <button type="button" :aria-label="`Delete ${reference.name}`" @click="$emit('delete', reference.id)">
            <AppIcon name="trash" :size="19" />
          </button>
        </article>
      </div>

      <div v-else class="empty-references">
        <AppIcon name="image-plus" :size="27" />
        <strong>No references yet</strong>
        <p>Add a front, side, or top guide and model directly over it.</p>
      </div>
    </div>
  </BottomSheet>
</template>

<style scoped>
.references-manager { display: grid; gap: var(--space-4); padding-bottom: var(--space-2); }
.add-reference,
.reference-row { min-height: var(--touch-target); border: 1px solid var(--color-border-strong); border-radius: var(--radius-lg); background: var(--color-surface-raised); color: var(--color-text); }
.add-reference { width: 100%; min-height: 4.25rem; display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3); text-align: left; color: var(--color-accent-strong); }
.add-reference span,
.reference-row__main > span:last-child { min-width: 0; display: grid; gap: 0.18rem; }
.add-reference strong,
.reference-row strong { font-size: 0.82rem; }
.add-reference small,
.reference-row small { color: var(--color-text-muted); font-size: 0.7rem; line-height: 1.35; }
.reference-list { display: grid; gap: var(--space-2); }
.reference-row { display: grid; grid-template-columns: minmax(0, 1fr) var(--touch-target) var(--touch-target); overflow: hidden; }
.reference-row > button { min-width: var(--touch-target); min-height: var(--touch-target); border: 0; background: transparent; color: var(--color-text-muted); }
.reference-row__main { display: flex; align-items: center; gap: var(--space-3); padding: 0.55rem; text-align: left; }
.reference-row__preview { width: 2.9rem; height: 2.9rem; flex: 0 0 auto; display: grid; place-items: center; overflow: hidden; border-radius: var(--radius-md); background: #090c0e; color: var(--color-warning); }
.reference-row__preview img { width: 100%; height: 100%; object-fit: contain; }
.empty-references { display: grid; justify-items: center; gap: var(--space-2); border: 1px dashed var(--color-border-strong); border-radius: var(--radius-lg); padding: var(--space-6) var(--space-4); color: var(--color-text-muted); text-align: center; }
.empty-references strong { color: var(--color-text); font-size: 0.85rem; }
.empty-references p { max-width: 18rem; margin: 0; font-size: 0.74rem; line-height: 1.5; }
</style>
