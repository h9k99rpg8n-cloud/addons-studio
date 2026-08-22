import { computed, onMounted, ref, toValue, type MaybeRefOrGetter } from 'vue'

import { toAppError } from '@/core/errors/AppError'
import { useProjectStore } from '@/stores/projects'

export function useProjectContext(projectId: MaybeRefOrGetter<string>) {
  const projects = useProjectStore()
  const loading = ref(true)
  const error = ref('')
  const project = computed(() => {
    const id = toValue(projectId)
    return projects.activeProject?.id === id
      ? projects.activeProject
      : projects.projects.find((entry) => entry.id === id)
  })

  async function load(): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      await projects.loadProjects()
      await projects.openProject(toValue(projectId))
    } catch (reason) {
      error.value = toAppError(reason, 'Addons Studio could not open this project.').userMessage
    } finally {
      loading.value = false
    }
  }

  onMounted(load)
  return { projects, project, loading, error, reloadProject: load }
}

