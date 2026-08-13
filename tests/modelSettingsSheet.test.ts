import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ModelSettingsSheet from '@/features/model-studio/components/ModelSettingsSheet.vue'
import type { StudioModelingSettings } from '@/types/model'

const BottomSheetStub = {
  name: 'BottomSheet',
  template: '<section><slot /></section>',
}

describe('Model Studio settings sheet', () => {
  it('emits real Resize, control, transform-space, and language preferences', async () => {
    const settings: StudioModelingSettings = {
      resizeDirection: 'symmetric',
      controlMode: 'hybrid',
      transformSpace: 'global',
      language: 'en',
    }
    const wrapper = mount(ModelSettingsSheet, {
      props: { open: true, settings },
      global: { stubs: { BottomSheet: BottomSheetStub } },
    })
    const click = async (label: string) => {
      const button = wrapper.findAll('button').find((entry) => entry.text().includes(label))
      expect(button).toBeDefined()
      await button!.trigger('click')
    }

    await click('Positive Side')
    await click('Tactilismos')
    await click('Parent')
    await click('Español')

    expect(wrapper.emitted('update')?.map((entry) => entry[0])).toEqual([
      { ...settings, resizeDirection: 'positive' },
      { ...settings, controlMode: 'tactilismos' },
      { ...settings, transformSpace: 'parent' },
      { ...settings, language: 'es' },
    ])
  })
})
