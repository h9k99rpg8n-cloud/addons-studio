import { studioDatabase } from '@/core/storage/database'
import { createId } from '@/utils/createId'

export const PRODUCTIVITY_SETTING_KEY = 'developer-beta:productivity'
export const PRODUCTIVITY_STATE_EVENT = 'addons-studio:productivity-updated'

export interface LocalTimer {
  id: string
  label: string
  createdAt: number
  endsAt: number
  completedAt?: number
}

export interface RoutineActivity {
  id: string
  name: string
  completedDate?: string
  createdAt: number
}

export interface UsageSession {
  startedAt: number
  endedAt: number
}

export interface ProductivityBetaState {
  enabled: boolean
  usageEnabled: boolean
  timers: LocalTimer[]
  routine: RoutineActivity[]
  usageSessions: UsageSession[]
}

export const DEFAULT_PRODUCTIVITY_STATE: Readonly<ProductivityBetaState> = Object.freeze({
  enabled: false,
  usageEnabled: false,
  timers: [],
  routine: [],
  usageSessions: [],
})

function cloneState(state: ProductivityBetaState): ProductivityBetaState {
  return {
    enabled: state.enabled === true,
    usageEnabled: state.usageEnabled === true,
    timers: (state.timers ?? []).map((timer) => ({ ...timer })),
    routine: (state.routine ?? []).map((activity) => ({ ...activity })),
    usageSessions: (state.usageSessions ?? []).map((session) => ({ ...session })),
  }
}

export async function loadProductivityState(): Promise<ProductivityBetaState> {
  const setting = await studioDatabase.settings.get(PRODUCTIVITY_SETTING_KEY)
  return setting?.value && typeof setting.value === 'object'
    ? cloneState({ ...DEFAULT_PRODUCTIVITY_STATE, ...setting.value } as ProductivityBetaState)
    : cloneState(DEFAULT_PRODUCTIVITY_STATE)
}

export async function saveProductivityState(state: ProductivityBetaState): Promise<void> {
  await studioDatabase.settings.put({
    key: PRODUCTIVITY_SETTING_KEY,
    value: cloneState(state),
    updatedAt: Date.now(),
  })
  globalThis.dispatchEvent?.(new Event(PRODUCTIVITY_STATE_EVENT))
}

export function createLocalTimer(label: string, durationMs: number, now = Date.now()): LocalTimer {
  if (!Number.isFinite(durationMs) || durationMs < 1_000 || durationMs > 7 * 24 * 60 * 60 * 1000) {
    throw new Error('Choose a timer between one second and seven days.')
  }
  return {
    id: createId(),
    label: label.trim() || 'Addons Studio timer',
    createdAt: now,
    endsAt: now + durationMs,
  }
}

export function createRoutineActivity(name: string, now = Date.now()): RoutineActivity {
  const normalized = name.trim()
  if (!normalized) throw new Error('Activity name is required.')
  return { id: createId(), name: normalized.slice(0, 100), createdAt: now }
}

export function localDateKey(timestamp = Date.now()): string {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function usageSummary(state: ProductivityBetaState, now = Date.now()): { todayMs: number; weekMs: number } {
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const weekStart = new Date(todayStart)
  const weekday = (weekStart.getDay() + 6) % 7
  weekStart.setDate(weekStart.getDate() - weekday)
  const overlap = (session: UsageSession, start: number) =>
    Math.max(0, Math.min(now, session.endedAt) - Math.max(start, session.startedAt))
  return {
    todayMs: state.usageSessions.reduce((sum, session) => sum + overlap(session, todayStart.getTime()), 0),
    weekMs: state.usageSessions.reduce((sum, session) => sum + overlap(session, weekStart.getTime()), 0),
  }
}

export function pruneUsageSessions(sessions: UsageSession[], now = Date.now()): UsageSession[] {
  const cutoff = now - 90 * 24 * 60 * 60 * 1000
  return sessions.filter((session) => session.endedAt >= cutoff).slice(-2_000)
}
