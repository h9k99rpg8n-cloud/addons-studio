import { onBeforeUnmount, onMounted } from 'vue'

import {
  loadProductivityState,
  PRODUCTIVITY_STATE_EVENT,
  pruneUsageSessions,
  saveProductivityState,
  type ProductivityBetaState,
} from '@/core/productivity/productivityBeta'
import { useToastStore } from '@/stores/toasts'
import { useLocaleStore } from '@/stores/locale'

export function useProductivityLifecycle(): void {
  const toasts = useToastStore()
  const locale = useLocaleStore()
  let state: ProductivityBetaState | undefined
  let usageStartedAt: number | undefined
  let timerHandle: ReturnType<typeof setTimeout> | undefined
  let usageCheckpoint: ReturnType<typeof setInterval> | undefined

  const commitUsage = async () => {
    if (!state?.enabled || !state.usageEnabled || usageStartedAt === undefined) return
    const endedAt = Date.now()
    if (endedAt > usageStartedAt) {
      state.usageSessions = pruneUsageSessions([
        ...state.usageSessions,
        { startedAt: usageStartedAt, endedAt },
      ])
      usageStartedAt = endedAt
      await saveProductivityState(state)
    }
  }

  const updateUsageState = () => {
    const active = document.visibilityState === 'visible' && document.hasFocus()
    const shouldTrack = active && state?.enabled && state.usageEnabled
    if (shouldTrack && usageStartedAt === undefined) {
      usageStartedAt = Date.now()
    } else if (!shouldTrack && usageStartedAt !== undefined) {
      void commitUsage().finally(() => { usageStartedAt = undefined })
    }
  }

  const checkTimers = async () => {
    if (timerHandle) clearTimeout(timerHandle)
    if (!state?.enabled) return
    const now = Date.now()
    const completed = state.timers.filter((timer) => !timer.completedAt && timer.endsAt <= now)
    if (completed.length) {
      state.timers = state.timers.map((timer) =>
        completed.some((entry) => entry.id === timer.id) ? { ...timer, completedAt: now } : timer,
      )
      await saveProductivityState(state)
      completed.forEach((timer) => {
        const NotificationApi = globalThis.Notification
        if (NotificationApi?.permission === 'granted') new NotificationApi(timer.label)
        else toasts.push({ type: 'info', message: `${locale.t('Timer complete')}: ${timer.label}` })
      })
    }
    const next = state.timers.filter((timer) => !timer.completedAt).sort((a, b) => a.endsAt - b.endsAt)[0]
    timerHandle = setTimeout(() => void checkTimers(), next
      ? Math.max(1_000, Math.min(60_000, next.endsAt - Date.now()))
      : 60_000)
  }

  const refreshState = async () => {
    state = await loadProductivityState()
    updateUsageState()
    void checkTimers()
  }

  const onStateUpdated = () => { void refreshState() }

  onMounted(async () => {
    state = await loadProductivityState()
    document.addEventListener('visibilitychange', updateUsageState)
    window.addEventListener('focus', updateUsageState)
    window.addEventListener('blur', updateUsageState)
    window.addEventListener('pagehide', commitUsage)
    window.addEventListener(PRODUCTIVITY_STATE_EVENT, onStateUpdated)
    updateUsageState()
    void checkTimers()
    usageCheckpoint = setInterval(() => void commitUsage(), 60_000)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', updateUsageState)
    window.removeEventListener('focus', updateUsageState)
    window.removeEventListener('blur', updateUsageState)
    window.removeEventListener('pagehide', commitUsage)
    window.removeEventListener(PRODUCTIVITY_STATE_EVENT, onStateUpdated)
    if (timerHandle) clearTimeout(timerHandle)
    if (usageCheckpoint) clearInterval(usageCheckpoint)
    void commitUsage()
  })
}
