import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createLocalTimer,
  createRoutineActivity,
  loadProductivityState,
  localDateKey,
  PRODUCTIVITY_SETTING_KEY,
  PRODUCTIVITY_STATE_EVENT,
  pruneUsageSessions,
  saveProductivityState,
  usageSummary,
} from '@/core/productivity/productivityBeta'
import { studioDatabase } from '@/core/storage/database'

describe('Developer Beta productivity tools', () => {
  beforeEach(async () => {
    await studioDatabase.settings.delete(PRODUCTIVITY_SETTING_KEY)
  })

  afterEach(async () => {
    await studioDatabase.settings.delete(PRODUCTIVITY_SETTING_KEY)
  })

  it('creates validated local timers and routine activities', () => {
    const timer = createLocalTimer('Modeling break', 20 * 60_000, 1_000)
    expect(timer).toMatchObject({ label: 'Modeling break', createdAt: 1_000, endsAt: 1_201_000 })
    expect(createRoutineActivity('  Finish barrel  ', 2_000)).toMatchObject({ name: 'Finish barrel', createdAt: 2_000 })
    expect(() => createLocalTimer('Invalid', 0)).toThrow('between one second and seven days')
    expect(() => createRoutineActivity('   ')).toThrow('required')
  })

  it('persists only local opt-in state and announces updates', async () => {
    const onUpdate = vi.fn()
    globalThis.addEventListener(PRODUCTIVITY_STATE_EVENT, onUpdate)
    const state = await loadProductivityState()
    state.enabled = true
    state.usageEnabled = true
    state.routine.push(createRoutineActivity('Export JSON', 10))
    await saveProductivityState(state)

    expect(await loadProductivityState()).toMatchObject({
      enabled: true,
      usageEnabled: true,
      routine: [{ name: 'Export JSON' }],
    })
    expect(onUpdate).toHaveBeenCalledOnce()
    globalThis.removeEventListener(PRODUCTIVITY_STATE_EVENT, onUpdate)
  })

  it('calculates foreground usage for today and this week and prunes old sessions', () => {
    const now = new Date(2026, 7, 13, 12).getTime()
    const state = {
      enabled: true,
      usageEnabled: true,
      timers: [],
      routine: [],
      usageSessions: [
        { startedAt: now - 90_000, endedAt: now - 30_000 },
        { startedAt: now - 100 * 24 * 60 * 60_000, endedAt: now - 99 * 24 * 60 * 60_000 },
      ],
    }
    expect(usageSummary(state, now)).toEqual({ todayMs: 60_000, weekMs: 60_000 })
    expect(pruneUsageSessions(state.usageSessions, now)).toHaveLength(1)
    expect(localDateKey(now)).toMatch(/^2026-08-13$/)
  })
})
