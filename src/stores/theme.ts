import { defineStore } from 'pinia'

import type { ResolvedTheme, ThemePreference } from '@/types/app'

const THEME_KEY = 'addons-studio:theme'
const THEME_COLOR: Record<ResolvedTheme, string> = {
  light: '#f3f7f4',
  dark: '#0b1016',
}

function loadPreference(): ThemePreference {
  try {
    const value = globalThis.localStorage?.getItem(THEME_KEY)
    if (value === 'system' || value === 'light' || value === 'dark') return value
  } catch {
    // Storage can be unavailable in private browsing modes.
  }
  return 'system'
}

export const useThemeStore = defineStore('theme', {
  state: () => ({
    preference: loadPreference() as ThemePreference,
    resolved: 'dark' as ResolvedTheme,
    initialized: false,
    mediaQuery: undefined as MediaQueryList | undefined,
  }),
  actions: {
    initialize(): void {
      if (this.initialized) return
      this.initialized = true
      this.mediaQuery = globalThis.matchMedia?.('(prefers-color-scheme: dark)')
      this.mediaQuery?.addEventListener('change', this.handleSystemTheme)
      this.apply()
    },
    setPreference(preference: ThemePreference): void {
      this.preference = preference
      try {
        globalThis.localStorage?.setItem(THEME_KEY, preference)
      } catch {
        // Applying the theme still works when persistence is unavailable.
      }
      this.apply()
    },
    apply(): void {
      const systemIsDark = this.mediaQuery?.matches ?? false
      this.resolved = this.preference === 'system' ? (systemIsDark ? 'dark' : 'light') : this.preference

      if (globalThis.document) {
        document.documentElement.dataset.theme = this.resolved
        document.documentElement.style.colorScheme = this.resolved
        document
          .querySelector('meta[name="theme-color"]')
          ?.setAttribute('content', THEME_COLOR[this.resolved] ?? THEME_COLOR.dark)
      }
    },
    handleSystemTheme(): void {
      if (this.preference === 'system') this.apply()
    },
    dispose(): void {
      this.mediaQuery?.removeEventListener('change', this.handleSystemTheme)
      this.mediaQuery = undefined
      this.initialized = false
    },
  },
})
