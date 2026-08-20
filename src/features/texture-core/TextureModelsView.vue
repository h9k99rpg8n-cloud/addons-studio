<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import AppButton from '@/components/common/AppButton.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import IconButton from '@/components/common/IconButton.vue'
import StudioIcon from '@/components/common/StudioIcon.vue'
import { toAppError } from '@/core/errors/AppError'
import { modelRepository } from '@/core/model/modelRepository'
import { textureRepository } from '@/core/texture/textureRepository'
import { useLocaleStore } from '@/stores/locale'
import { useProjectStore } from '@/stores/projects'
import type { StudioModel } from '@/types/model'

const props = defineProps<{ projectId: string }>()
const router = useRouter()
const projects = useProjectStore()
const locale = useLocaleStore()
const models = ref<StudioModel[]>([])
const materialCounts = ref<Record<string, number>>({})
const loading = ref(true)
const loadError = ref('')

const project = computed(() =>
  projects.activeProject?.id === props.projectId
    ? projects.activeProject
    : projects.projects.find((entry) => entry.id === props.projectId),
)

onMounted(async () => {
  try {
    await projects.loadProjects()
    await projects.openProject(props.projectId)
    models.value = await modelRepository.listModels(props.projectId)
    for (const model of models.value) {
      const workspace = await textureRepository.getWorkspace(model.id)
      materialCounts.value[model.id] = workspace.materials.length
    }
  } catch (error) {
    loadError.value = toAppError(error, locale.t('Addons Studio could not load Texture Core.')).userMessage
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <main class="texture-models-view">
    <header class="texture-topbar">
      <IconButton
        icon="arrow-left"
        :label="locale.t('Back to project workspace')"
        @click="router.push({ name: 'workspace', params: { id: projectId } })"
      />
      <div>
        <strong>{{ locale.t('Texture Core') }}</strong>
        <small>{{ project?.name ?? locale.t('Project') }}</small>
      </div>
      <span class="core-badge">0.2</span>
    </header>

    <section v-if="loading" class="content model-grid" :aria-label="locale.t('Loading models')">
      <div v-for="index in 3" :key="index" class="skeleton model-skeleton" />
    </section>

    <section v-else-if="loadError || !project" class="empty-state">
      <span><AppIcon name="alert-triangle" :size="30" /></span>
      <h1>{{ locale.t('Texture Core unavailable') }}</h1>
      <p>{{ loadError || locale.t('This local project could not be found.') }}</p>
      <AppButton @click="router.replace({ name: 'projects' })">{{ locale.t('Back to Projects') }}</AppButton>
    </section>

    <div v-else class="content">
      <section class="texture-intro">
        <span class="icon-surface"><StudioIcon name="material" :size="32" /></span>
        <div>
          <p class="eyebrow">{{ locale.t('Texture Core 0.2') }}</p>
          <h1>{{ locale.t('Give your models a material') }}</h1>
          <p>{{ locale.t('Choose a Model Core resource, import or create a material, edit pixels, and prepare UV assignments without changing geometry.') }}</p>
        </div>
      </section>

      <section v-if="models.length" class="model-section">
        <header>
          <h2>{{ locale.t('Choose a model') }}</h2>
          <span>{{ models.length }}</span>
        </header>
        <div class="model-grid">
          <button
            v-for="model in models"
            :key="model.id"
            type="button"
            class="model-card"
            @click="router.push({ name: 'texture-core', params: { projectId, modelId: model.id } })"
          >
            <span class="model-card__icon"><StudioIcon name="model" :size="28" /></span>
            <span class="model-card__copy">
              <strong>{{ model.name }}</strong>
              <code>{{ model.identifier }}</code>
              <small>{{ locale.t('{cubes} cubes · {materials} materials', { cubes: model.elements.length, materials: materialCounts[model.id] ?? 0 }) }}</small>
            </span>
            <AppIcon name="chevron-right" :size="20" />
          </button>
        </div>
      </section>

      <section v-else class="empty-state inline-empty">
        <span><StudioIcon name="material" :size="38" /></span>
        <h2>{{ locale.t('Texture Core needs a model first') }}</h2>
        <p>{{ locale.t('Create geometry in Model Studio, then return here to texture it.') }}</p>
        <AppButton @click="router.push({ name: 'models', params: { projectId } })">{{ locale.t('Open Model Studio') }}</AppButton>
      </section>
    </div>
  </main>
</template>

<style scoped>
.texture-models-view { min-height: 100dvh; }
.texture-topbar {
  position: sticky;
  z-index: var(--z-header);
  top: 0;
  min-height: calc(var(--header-height) + env(safe-area-inset-top));
  display: grid;
  grid-template-columns: var(--touch-target) minmax(0, 1fr) var(--touch-target);
  align-items: center;
  gap: 0.55rem;
  padding: env(safe-area-inset-top) max(var(--page-gutter), env(safe-area-inset-right)) 0 max(var(--page-gutter), env(safe-area-inset-left));
  border-bottom: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-app-bg) 94%, transparent);
  backdrop-filter: blur(16px);
}
.texture-topbar > div { min-width: 0; display: grid; text-align: center; }
.texture-topbar strong { font-size: 0.9rem; }
.texture-topbar small { color: var(--color-text-subtle); font-size: 0.65rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.core-badge { justify-self: end; min-width: 2.5rem; border: 1px solid var(--color-border-strong); border-radius: 999px; padding: 0.25rem 0.45rem; color: var(--color-accent-strong); font: 700 0.68rem/1 var(--font-mono); text-align: center; }
.content { width: min(100%, var(--content-max)); margin: 0 auto; padding: 1rem max(var(--page-gutter), env(safe-area-inset-right)) 2rem max(var(--page-gutter), env(safe-area-inset-left)); }
.texture-intro { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 0.9rem; border: 1px solid var(--color-border); border-radius: var(--radius-xl); padding: var(--card-padding); background: radial-gradient(circle at 0 0, var(--color-brand-glow), transparent 42%), var(--color-surface); box-shadow: var(--shadow-card); }
.icon-surface { width: 3.4rem; height: 3.4rem; display: grid; place-items: center; border-radius: var(--radius-lg); background: var(--color-accent-soft); color: var(--color-accent-strong); }
.texture-intro h1 { margin: 0.15rem 0 0; font-size: 1.22rem; }
.texture-intro p:last-child { margin: 0.35rem 0 0; color: var(--color-text-muted); font-size: 0.74rem; line-height: 1.45; }
.model-section { margin-top: 1.5rem; }
.model-section > header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.7rem; }
.model-section h2 { margin: 0; font-size: 1rem; }
.model-section header span { color: var(--color-text-subtle); font-size: 0.72rem; font-weight: 700; }
.model-grid { display: grid; gap: 0.65rem; }
.model-card { min-height: 5rem; display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 0.75rem; width: 100%; border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 0.7rem; background: var(--color-surface); color: var(--color-text); text-align: left; box-shadow: var(--shadow-card); }
.model-card__icon { width: 2.9rem; height: 2.9rem; display: grid; place-items: center; border-radius: var(--radius-md); background: var(--color-accent-soft); color: var(--color-accent-strong); }
.model-card__copy { min-width: 0; display: grid; gap: 0.16rem; }
.model-card strong, .model-card code, .model-card small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.model-card strong { font-size: 0.84rem; }
.model-card code { color: var(--color-text-muted); font-size: 0.65rem; }
.model-card small { color: var(--color-text-subtle); font-size: 0.65rem; }
.model-skeleton { height: 5rem; border-radius: var(--radius-lg); }
.empty-state { min-height: 60dvh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem var(--page-gutter); text-align: center; }
.inline-empty { min-height: 18rem; }
.empty-state > span { width: 4rem; height: 4rem; display: grid; place-items: center; border-radius: var(--radius-xl); background: var(--color-accent-soft); color: var(--color-accent-strong); }
.empty-state h1, .empty-state h2 { margin: 0.9rem 0 0; }
.empty-state p { max-width: 25rem; margin: 0.4rem 0 1rem; color: var(--color-text-muted); font-size: 0.8rem; line-height: 1.5; }
@media (min-width: 680px) { .model-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
