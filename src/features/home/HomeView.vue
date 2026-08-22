<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import AppButton from '@/components/common/AppButton.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import BrandMark from '@/components/common/BrandMark.vue'
import ProjectActionsController from '@/components/project/ProjectActionsController.vue'
import ProjectCard from '@/components/project/ProjectCard.vue'
import ProjectImportController from '@/components/project/ProjectImportController.vue'
import { toAppError } from '@/core/errors/AppError'
import { resourceRepository } from '@/core/resources/resourceRepository'
import { textureRepository } from '@/core/texture/textureRepository'
import { useLocaleStore } from '@/stores/locale'
import { useProjectStore } from '@/stores/projects'
import { useToastStore } from '@/stores/toasts'
import type { StudioProject } from '@/types/project'
import type { StudioResourceType } from '@/types/resource'
import { formatRelativeDate } from '@/utils/format'

const router = useRouter()
const locale = useLocaleStore()
const projects = useProjectStore()
const toasts = useToastStore()
const importing = ref<InstanceType<typeof ProjectImportController>>()
const loadingResources = ref(true)
interface RecentActivity {
  id: string
  projectId: string
  type: StudioResourceType | 'material'
  name: string
  updatedAt: number
}
const latestResources = ref<RecentActivity[]>([])
const selectedProject = ref<StudioProject>()
const actionsOpen = ref(false)

const recent = computed(() => projects.projects.slice(0, 4))
const pinned = computed(() => projects.projects.filter((project) => project.pinned).slice(0, 4))
const active = computed(() => projects.activeProject ?? projects.projects[0])

const typeIcons: Record<string, string> = {
  model: 'cuboid', block: 'blocks', block_model: 'boxes', material: 'image', item: 'package', entity: 'shapes', recipe: 'cooking-pot', plugin: 'network', function: 'code',
}

function projectName(id: string): string {
  return projects.projects.find((project) => project.id === id)?.name ?? locale.t('Project')
}

async function loadResources(): Promise<void> {
  loadingResources.value = true
  try {
    const batches = await Promise.all(projects.projects.slice(0, 8).map(async (project) => {
      const [resources, materials] = await Promise.all([
        resourceRepository.list(project.id),
        textureRepository.listMaterials(project.id),
      ])
      return [
        ...resources.map(({ id, projectId, type, name, updatedAt }) => ({ id, projectId, type, name, updatedAt })),
        ...materials.map(({ id, projectId, name, updatedAt }) => ({ id, projectId, type: 'material' as const, name, updatedAt })),
      ]
    }))
    latestResources.value = batches.flat().sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6)
  } catch (error) {
    latestResources.value = []
    toasts.push({
      type: 'warning',
      message: toAppError(error, locale.t('Recent resource activity is unavailable right now.')).userMessage,
    })
  } finally {
    loadingResources.value = false
  }
}

onMounted(async () => {
  await projects.loadProjects()
  await loadResources()
})

function openProject(project: StudioProject): void {
  void projects.openProject(project.id).then(() => router.push({ name: 'workspace', params: { id: project.id } }))
}

function openActions(project: StudioProject): void {
  selectedProject.value = project
  actionsOpen.value = true
}

async function togglePin(project: StudioProject): Promise<void> {
  await projects.updateProject(project.id, { pinned: !project.pinned }, true)
  toasts.push({ type: 'info', message: locale.t(project.pinned ? 'Project unpinned' : 'Project pinned') })
}

function openResource(resource: RecentActivity): void {
  if (resource.type === 'model') void router.push({ name: 'models', params: { projectId: resource.projectId } })
  else if (resource.type === 'block') void router.push({ name: 'block-editor', params: { projectId: resource.projectId, resourceId: resource.id } })
  else if (resource.type === 'block_model') void router.push({ name: 'block-model-editor', params: { projectId: resource.projectId, resourceId: resource.id } })
  else if (resource.type === 'material') void router.push({ name: 'materials', params: { projectId: resource.projectId } })
}
</script>

<template>
  <main class="home-view">
    <header class="home-header">
      <div class="home-brand"><BrandMark :size="52" /><div><strong>Addons Studio</strong><span>Rework Update</span></div></div>
      <button type="button" :aria-label="locale.t('Settings')" @click="router.push({name:'settings'})"><AppIcon name="settings" :size="22" /></button>
    </header>

    <div class="home-body">
      <section class="hero">
        <div><p>{{ locale.t('BEDROCK CREATION WORKSPACE') }}</p><h1>{{ locale.t('Build the add-on. Use the right tool for every job.') }}</h1><span>{{ locale.t('Organize projects, generate Bedrock resources, and move specialized editing to Blockbench.') }}</span></div>
        <div class="hero-actions"><AppButton size="large" @click="router.push({name:'create-project'})"><template #icon><AppIcon name="plus" :size="21" /></template>{{ locale.t('Create project') }}</AppButton><AppButton size="large" variant="secondary" @click="importing?.openPicker()"><template #icon><AppIcon name="upload" :size="21" /></template>{{ locale.t('Import project') }}</AppButton></div>
      </section>

      <section v-if="active" class="active-project">
        <div><p>{{ locale.t('Current project') }}</p><strong>{{ active.name }}</strong><code>{{ active.namespace }}</code></div>
        <div class="active-project__actions"><button type="button" @click="router.push({name:'create-hub',params:{projectId:active.id}})"><AppIcon name="plus-circle" :size="19" />{{ locale.t('Create') }}</button><button type="button" @click="router.push({name:'workspace',params:{id:active.id}})"><AppIcon name="folder" :size="19" />{{ locale.t('Open') }}</button></div>
      </section>

      <section v-if="pinned.length" class="home-section">
        <header><div><p>{{ locale.t('Pinned') }}</p><h2>{{ locale.t('Keep close') }}</h2></div><span>{{ pinned.length }}</span></header>
        <div class="project-grid"><div v-for="project in pinned" :key="project.id" class="project-wrap"><ProjectCard :project="project" @open="openProject(project)" @menu="openActions(project)" /><button type="button" class="pin-button" :aria-label="locale.t('Unpin project')" @click="togglePin(project)"><AppIcon name="pin-off" :size="17" /></button></div></div>
      </section>

      <section class="home-section">
        <header><div><p>{{ locale.t('Recent') }}</p><h2>{{ locale.t('Projects') }}</h2></div><button type="button" @click="router.push({name:'projects'})">{{ locale.t('View all') }} <AppIcon name="chevron-right" :size="17" /></button></header>
        <div v-if="projects.loading" class="project-grid"><div v-for="item in 2" :key="item" class="skeleton project-skeleton" /></div>
        <div v-else-if="recent.length" class="project-grid"><div v-for="project in recent" :key="project.id" class="project-wrap"><ProjectCard :project="project" @open="openProject(project)" @menu="openActions(project)" /><button v-if="!project.pinned" type="button" class="pin-button" :aria-label="locale.t('Pin project')" @click="togglePin(project)"><AppIcon name="pin" :size="17" /></button></div></div>
        <div v-else class="empty-projects"><span><AppIcon name="folder" :size="30" /></span><strong>{{ locale.t('Your first project starts here') }}</strong><p>{{ locale.t('Projects stay local in IndexedDB and work offline after the PWA shell is installed.') }}</p></div>
      </section>

      <section class="home-section modified-section">
        <header><div><p>{{ locale.t('Activity') }}</p><h2>{{ locale.t('Last modified') }}</h2></div></header>
        <div v-if="loadingResources" class="resource-list"><div v-for="item in 3" :key="item" class="skeleton resource-skeleton" /></div>
        <div v-else-if="latestResources.length" class="resource-list"><button v-for="resource in latestResources" :key="resource.id" type="button" @click="openResource(resource)"><span><AppIcon :name="typeIcons[resource.type] ?? 'file'" :size="20" /></span><span><strong>{{ resource.name }}</strong><small>{{ projectName(resource.projectId) }} · {{ locale.t(resource.type.replace('_',' ')) }}</small></span><time>{{ formatRelativeDate(resource.updatedAt, Date.now(), locale.language) }}</time></button></div>
        <p v-else class="no-activity">{{ locale.t('Created models and blocks will appear here.') }}</p>
      </section>
    </div>

    <ProjectImportController ref="importing" @imported="openProject" />
    <ProjectActionsController :project="selectedProject" :open="actionsOpen" @close="actionsOpen=false" @deleted="loadResources" />
  </main>
</template>

<style scoped>
.home-view{min-height:100dvh}.home-header{min-height:calc(var(--header-height) + env(safe-area-inset-top));display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:calc(env(safe-area-inset-top) + .55rem) max(var(--page-gutter),env(safe-area-inset-right)) .55rem max(var(--page-gutter),env(safe-area-inset-left));border-bottom:1px solid var(--color-border)}.home-brand{display:flex;align-items:center;gap:.7rem}.home-brand>div{display:grid}.home-brand strong{font-size:.95rem;letter-spacing:-.03em}.home-brand span{color:var(--color-accent);font-size:.61rem;font-weight:850;text-transform:uppercase;letter-spacing:.08em}.home-header>button{width:44px;height:44px;display:grid;place-items:center;border:1px solid var(--color-border);border-radius:var(--radius-md);background:var(--color-surface);color:var(--color-text)}.home-body{width:min(100%,var(--content-max));margin:0 auto;padding:1rem max(var(--page-gutter),env(safe-area-inset-right)) 2rem max(var(--page-gutter),env(safe-area-inset-left))}.hero{position:relative;overflow:hidden;display:grid;gap:1.2rem;border:1px solid var(--color-border);border-radius:var(--radius-2xl);padding:clamp(1.15rem,5vw,2rem);background:var(--color-surface);box-shadow:var(--shadow-card)}.hero::after{position:absolute;right:-3rem;top:-3rem;width:10rem;height:10rem;border:2rem solid var(--color-accent);border-radius:50%;opacity:.08;content:''}.hero>div{position:relative;z-index:1}.hero p,.home-section header p,.active-project p{margin:0;color:var(--color-accent);font-size:.59rem;font-weight:900;letter-spacing:.09em;text-transform:uppercase}.hero h1{max-width:42rem;margin:.4rem 0 0;font-size:clamp(1.65rem,7vw,3rem);line-height:1.02;letter-spacing:-.055em}.hero>div>span{display:block;max-width:34rem;margin:.65rem 0 0;color:var(--color-text-muted);font-size:.74rem;line-height:1.5}.hero-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.55rem}.active-project{display:grid;gap:.7rem;margin-top:.8rem;border:1px solid var(--color-border);border-radius:var(--radius-xl);padding:.85rem;background:var(--color-surface-muted)}.active-project>div:first-child{min-width:0;display:grid;gap:.1rem}.active-project strong,.active-project code{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.active-project strong{margin-top:.2rem;font-size:.88rem}.active-project code{color:var(--color-text-subtle);font-size:.6rem}.active-project__actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.45rem}.active-project__actions button{min-height:44px;display:flex;align-items:center;justify-content:center;gap:.4rem;border:1px solid var(--color-border);border-radius:var(--radius-md);background:var(--color-surface);color:var(--color-text);font-size:.68rem;font-weight:800}.home-section{margin-top:1.5rem}.home-section>header{display:flex;align-items:end;justify-content:space-between;gap:1rem;margin-bottom:.7rem}.home-section h2{margin:.16rem 0 0;font-size:1.15rem}.home-section header>span{color:var(--color-text-subtle);font-family:var(--font-mono);font-size:.65rem}.home-section header>button{min-height:44px;display:flex;align-items:center;gap:.2rem;border:0;background:transparent;color:var(--color-text-muted);font-size:.67rem;font-weight:780}.project-grid{display:grid;gap:.7rem}.project-wrap{position:relative}.pin-button{position:absolute;z-index:2;right:3.2rem;top:.48rem;width:44px;height:44px;display:grid;place-items:center;border:0;border-radius:var(--radius-md);background:transparent;color:var(--color-text-subtle)}.project-skeleton{height:7rem;border-radius:var(--radius-xl)}.empty-projects{min-height:10rem;display:grid;place-items:center;align-content:center;gap:.35rem;border:1px dashed var(--color-border-strong);border-radius:var(--radius-xl);padding:1rem;text-align:center}.empty-projects>span{color:var(--color-accent)}.empty-projects strong{font-size:.8rem}.empty-projects p{max-width:27rem;margin:0;color:var(--color-text-subtle);font-size:.67rem;line-height:1.45}.resource-list{display:grid;gap:.45rem}.resource-list>button{min-width:0;min-height:4rem;display:grid;grid-template-columns:2.6rem minmax(0,1fr) auto;align-items:center;gap:.65rem;border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:.55rem .65rem;background:var(--color-surface);color:var(--color-text);text-align:left}.resource-list>button>span:first-child{width:2.6rem;height:2.6rem;display:grid;place-items:center;border-radius:var(--radius-md);background:var(--color-accent-soft);color:var(--color-accent-strong)}.resource-list>button>span:nth-child(2){min-width:0;display:grid;gap:.12rem}.resource-list strong,.resource-list small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.resource-list strong{font-size:.74rem}.resource-list small{color:var(--color-text-subtle);font-size:.58rem}.resource-list time{color:var(--color-text-subtle);font-size:.58rem}.resource-skeleton{height:4rem;border-radius:var(--radius-lg)}.no-activity{margin:0;border:1px dashed var(--color-border);border-radius:var(--radius-lg);padding:1rem;color:var(--color-text-subtle);font-size:.68rem;text-align:center}@media(min-width:680px){.hero{grid-template-columns:minmax(0,1fr) auto;align-items:end}.hero-actions{width:20rem}.active-project{grid-template-columns:minmax(0,1fr) 16rem;align-items:center}.project-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(min-width:1000px){.home-body{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(18rem,.75fr);gap:0 1rem}.hero,.active-project{grid-column:1/-1}.home-section{grid-column:1}.modified-section{grid-column:2;grid-row:3/6}}
</style>
