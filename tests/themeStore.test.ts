import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useThemeStore } from '@/stores/theme'

describe('theme store', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    setActivePinia(createPinia())
  })

  afterEach(() => {
    useThemeStore().dispose()
  })

  it('uses the system theme by default', () => {
    const theme = useThemeStore()
    theme.initialize()

    expect(theme.preference).toBe('system')
    expect(theme.resolved).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('persists an explicit light theme', () => {
    const theme = useThemeStore()
    theme.initialize()
    theme.setPreference('light')

    expect(theme.resolved).toBe('light')
    expect(localStorage.getItem('addons-studio:theme')).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})
