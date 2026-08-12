import { onBeforeUnmount, onMounted } from 'vue'

import { logger } from '@/core/errors/logger'
import { RECOVERY_INTERVAL_MS } from '@/core/project/constants'
import { useProjectStore } from '@/stores/projects'

export function useAutosaveLifecycle(): void {
  const projects = useProjectStore()
  let recoveryTimer: ReturnType<typeof setInterval> | undefined

  const flush = () => {
    void projects.flushPendingSaves().catch((error: unknown) => {
      logger.error('Lifecycle save failed', {
        area: 'project-persistence',
        action: 'pagehide',
        details: { error },
      })
    })
  }

  const handleVisibility = () => {
    if (document.visibilityState === 'hidden') flush()
  }

  onMounted(() => {
    globalThis.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', handleVisibility)
    recoveryTimer = setInterval(() => {
      void projects.createRecoverySnapshots()
    }, RECOVERY_INTERVAL_MS)
  })

  onBeforeUnmount(() => {
    globalThis.removeEventListener('pagehide', flush)
    document.removeEventListener('visibilitychange', handleVisibility)
    if (recoveryTimer) clearInterval(recoveryTimer)
    flush()
  })
}
