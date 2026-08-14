import { defineStore } from 'pinia'

import { type AppLanguage, SPANISH_MESSAGES } from '@/core/i18n/messages'

const STORAGE_KEY = 'addons-studio:language'

function interpolate(message: string, values?: Record<string, string | number>): string {
  if (!values) return message
  return message.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))
}

export const useLocaleStore = defineStore('locale', {
  state: () => ({ language: 'en' as AppLanguage, initialized: false }),
  actions: {
    initialize(): void {
      if (this.initialized) return
      const stored = globalThis.localStorage?.getItem(STORAGE_KEY)
      this.language = stored === 'es' ? 'es' : 'en'
      this.applyDocumentLanguage()
      this.initialized = true
    },
    setLanguage(language: AppLanguage): void {
      this.language = language
      globalThis.localStorage?.setItem(STORAGE_KEY, language)
      this.applyDocumentLanguage()
    },
    t(message: string, values?: Record<string, string | number>): string {
      const translated = this.language === 'es' ? SPANISH_MESSAGES[message] ?? message : message
      return interpolate(translated, values)
    },
    applyDocumentLanguage(): void {
      if (globalThis.document) document.documentElement.lang = this.language
    },
  },
})

export { STORAGE_KEY as LOCALE_STORAGE_KEY }
