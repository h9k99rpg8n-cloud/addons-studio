<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import AppButton from '@/components/common/AppButton.vue'
import AppDialog from '@/components/common/AppDialog.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import StudioPageHeader from '@/components/common/StudioPageHeader.vue'
import { useProjectContext } from '@/composables/useProjectContext'
import { toAppError } from '@/core/errors/AppError'
import { resourceRepository } from '@/core/resources/resourceRepository'
import { useLocaleStore } from '@/stores/locale'
import { useToastStore } from '@/stores/toasts'
import type { BlockResourcePayload, StudioResource } from '@/types/resource'

const props = defineProps<{ projectId: string; resourceType: 'block' | 'block_model' }>()
const router = useRouter()
const locale = useLocaleStore()
const toasts = useToastStore()
const { project, loading: projectLoading, error: projectError } = useProjectContext(() => props.projectId)
const resources = ref<StudioResource<BlockResourcePayload>[]>([])
const query = ref('')
const loading = ref(true)
const loadError = ref('')
const deleteOpen = ref(false)
const selected = ref<StudioResource<BlockResourcePayload>>()

const isModel = computed(() => props.resourceType === 'block_model')
const title = computed(() => locale.t(isModel.value ? 'Block Model' : 'Blocks'))
const filtered = computed(() => {
  const needle = query.value.trim().toLowerCase()
  return resources.value.filter((resource) => !needle || `${resource.name} ${resource.identifier}`.toLowerCase().includes(needle))
})

onMounted(async () => {
  try {
    resources.value = await resourceRepository.list<BlockResourcePayload>(props.projectId, props.resourceType)
  } catch (error) {
    loadError.value = toAppError(error, locale.t('Addons Studio could not load these blocks.')).userMessage
  } finally {
    loading.value = false
  }
})

function openEditor(resource?: StudioResource<BlockResourcePayload>): void {
  void router.push({
    name: isModel.value ? 'block-model-editor' : 'block-editor',
    params: { projectId: props.projectId, ...(resource ? { resourceId: resource.id } : {}) },
  })
}

function confirmDelete(resource: StudioResource<BlockResourcePayload>): void {
  selected.value = resource
  deleteOpen.value = true
}

async function deleteResource(): Promise<void> {
  if (!selected.value) return
  await resourceRepository.delete(selected.value.id)
  resources.value = resources.value.filter((resource) => resource.id !== selected.value?.id)
  deleteOpen.value = false
  toasts.push({ type: 'success', message: locale.t('Resource deleted') })
}
</script>

<template>
  <main>
    <StudioPageHeader :title="title" :subtitle="project?.name" :eyebrow="locale.t(isModel ? 'Custom geometry blocks' : 'Standard Bedrock blocks')" :icon="isModel ? 'boxes' : 'blocks'">
      <template #actions><button class="header-create" type="button" :aria-label="locale.t('Create')" @click="openEditor()"><AppIcon name="plus" :size="21" /></button></template>
    </StudioPageHeader>
    <div class="blocks-body">
      <section v-if="projectLoading || loading" class="state">{{ locale.t('Opening project') }}</section>
      <section v-else-if="projectError || loadError || !project" class="state state--error">{{ projectError || loadError }}</section>
      <template v-else>
        <div class="blocks-toolbar">
          <label><AppIcon name="search" :size="19" /><input v-model="query" type="search" :placeholder="locale.t('Search blocks')" /></label>
          <AppButton @click="openEditor()">+ {{ locale.t('Create') }}</AppButton>
        </div>
        <section v-if="filtered.length" class="blocks-grid">
          <article v-for="resource in filtered" :key="resource.id" class="block-card">
            <button class="block-card__main" type="button" @click="openEditor(resource)"><span><AppIcon :name="isModel ? 'boxes' : 'blocks'" :size="27" /></span><span><strong>{{ resource.name }}</strong><code>{{ resource.identifier }}</code><small>{{ resource.payload.light.enabled ? `${locale.t('Light')} ${resource.payload.light.level}` : locale.t('No light') }} · {{ locale.t(resource.payload.transparency) }}</small></span><AppIcon name="chevron-right" :size="19" /></button>
            <button type="button" :aria-label="locale.t('Delete')" @click="confirmDelete(resource)"><AppIcon name="trash" :size="18" /></button>
          </article>
        </section>
        <section v-else class="empty"><span><AppIcon :name="isModel ? 'boxes' : 'blocks'" :size="34" /></span><h2>{{ locale.t(isModel ? 'No block models yet' : 'No blocks yet') }}</h2><p>{{ locale.t(isModel ? 'Create a custom-geometry block using a saved Blockbench model.' : 'Create a guided block without writing the JSON by hand.') }}</p><AppButton size="large" @click="openEditor()">{{ locale.t(isModel ? 'Create Block Model' : 'Create Block') }}</AppButton></section>
      </template>
    </div>
    <AppDialog :open="deleteOpen" :title="locale.t('Delete “{name}”?', { name: selected?.name ?? '' })" :description="locale.t('This removes the block definition from this project. Shared materials and models stay available.')" @close="deleteOpen=false"><template #actions><AppButton variant="ghost" @click="deleteOpen=false">{{ locale.t('Cancel') }}</AppButton><AppButton variant="danger" @click="deleteResource">{{ locale.t('Delete') }}</AppButton></template></AppDialog>
  </main>
</template>

<style scoped>
.blocks-body{width:min(100%,var(--content-max));margin:0 auto;padding:1rem max(var(--page-gutter),env(safe-area-inset-right)) 2rem max(var(--page-gutter),env(safe-area-inset-left))}.header-create{width:44px;height:44px;display:grid;place-items:center;border:0;border-radius:var(--radius-md);background:var(--color-accent);color:var(--color-on-accent)}.state{min-height:50dvh;display:grid;place-items:center;color:var(--color-text-subtle)}.state--error{color:var(--color-danger)}.blocks-toolbar{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:.55rem;margin-bottom:.85rem}.blocks-toolbar label{min-height:44px;display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:.55rem;border:1px solid var(--color-border);border-radius:var(--radius-md);padding:0 .75rem;background:var(--color-input-bg);color:var(--color-text-subtle)}.blocks-toolbar input{min-width:0;border:0;outline:0;background:transparent;color:var(--color-text);font:inherit;font-size:16px}.blocks-grid{display:grid;gap:.65rem}.block-card{min-width:0;display:grid;grid-template-columns:minmax(0,1fr) 44px;align-items:center;border:1px solid var(--color-border);border-radius:var(--radius-xl);overflow:hidden;background:var(--color-surface);box-shadow:var(--shadow-card)}.block-card__main{min-width:0;min-height:6rem;display:grid;grid-template-columns:3rem minmax(0,1fr) auto;align-items:center;gap:.7rem;border:0;padding:.7rem;background:transparent;color:var(--color-text);text-align:left}.block-card__main>span:first-child{width:3rem;height:3rem;display:grid;place-items:center;border-radius:var(--radius-lg);background:var(--color-accent-soft);color:var(--color-accent-strong)}.block-card__main>span:nth-child(2){min-width:0;display:grid;gap:.15rem}.block-card strong,.block-card code{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.block-card strong{font-size:.8rem}.block-card code{color:var(--color-text-subtle);font-size:.56rem}.block-card small{color:var(--color-text-subtle);font-size:.58rem}.block-card>button:last-child{width:44px;height:44px;display:grid;place-items:center;border:0;border-left:1px solid var(--color-border);background:transparent;color:var(--color-text-subtle)}.empty{min-height:50dvh;display:grid;place-items:center;align-content:center;gap:.45rem;text-align:center}.empty>span{width:4.5rem;height:4.5rem;display:grid;place-items:center;border-radius:var(--radius-xl);background:var(--color-accent-soft);color:var(--color-accent-strong)}.empty h2{margin:.5rem 0 0;font-size:1rem}.empty p{max-width:28rem;margin:0 0 .7rem;color:var(--color-text-subtle);font-size:.7rem;line-height:1.5}@media(min-width:760px){.blocks-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
