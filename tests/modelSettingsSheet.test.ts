import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, expect, it } from 'vitest'

import { createDefaultEditorState } from '@/core/model/modelFactory'
import ModelSettingsSheet from '@/features/model-studio/components/ModelSettingsSheet.vue'

const BottomSheetStub = {
  name: 'BottomSheet',
  template: '<section><slot /></section>',
}

describe('Model Studio settings sheet', () => {
  it('emits real Resize, control, transform-space, and language preferences', async () => {
    const defaults = createDefaultEditorState()
    const settings = defaults.modeling
    const wrapper = mount(ModelSettingsSheet, {
      props: {
        open: true,
        settings,
        snapping: defaults.snapping,
        camera: defaults.camera,
        experimental: defaults.experimental,
      },
      global: { plugins: [createPinia()], stubs: { BottomSheet: BottomSheetStub } },
    })
    const click = async (label: string) => {
      const button = wrapper.findAll('button').find((entry) => entry.text().includes(label))
      expect(button).toBeDefined()
      await button!.trigger('click')
    }

    await click('Gizmos & Controls')
    await click('Touch Gizmo')
    await click('Parent')
    await click('Model Studio Settings')
    await click('Resize')
    await click('Positive Side')
    await click('Model Studio Settings')
    await click('Language')
    await click('Español')

    const updates = wrapper.emitted('update')?.map((entry) => entry[0]) ?? []
    expect(updates).toContainEqual({ ...settings, controlMode: 'touch-gizmo' })
    expect(updates).toContainEqual({ ...settings, transformSpace: 'parent' })
    expect(updates).toContainEqual({ ...settings, resizeDirection: 'positive' })
    expect(updates).toContainEqual({ ...settings, language: 'es' })
  })
})
