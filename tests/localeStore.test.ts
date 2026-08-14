import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LOCALE_STORAGE_KEY, useLocaleStore } from '@/stores/locale'

describe('English and Spanish localization', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('uses English as the source language and switches user-facing strings to Spanish', () => {
    const locale = useLocaleStore()
    expect(locale.language).toBe('en')
    expect(locale.t('Model Studio Settings')).toBe('Model Studio Settings')
    locale.setLanguage('es')
    expect(locale.t('Model Studio Settings')).toBe('Ajustes de Model Studio')
    expect(locale.t('Touch Gizmo')).toBe('Gizmo táctil')
    expect(locale.t('Multi-select')).toBe('Multiselección')
    expect(locale.t('Project package exported')).toBe('Paquete de proyecto exportado')
    expect(locale.t('{name} is ready', { name: 'Río Grande' })).toBe('Río Grande está listo')
    expect(locale.t('3D modeling is not available on this device or browser.')).toBe('El modelado 3D no está disponible en este dispositivo o navegador.')
    expect(locale.t('geometry.rio_grande.barrel')).toBe('geometry.rio_grande.barrel')
  })

  it('persists the selected locale without translating technical identifiers', () => {
    const locale = useLocaleStore()
    locale.setLanguage('es')
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('es')
    setActivePinia(createPinia())
    const reopened = useLocaleStore()
    reopened.initialize()
    expect(reopened.language).toBe('es')
    expect(reopened.t('.model.json')).toBe('.model.json')
  })
})
