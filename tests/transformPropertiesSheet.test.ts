import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import TransformPropertiesSheet from '@/features/model-studio/components/TransformPropertiesSheet.vue'
import { createStudioCube } from '@/core/model/modelFactory'

const BottomSheetStub = {
  name: 'BottomSheet',
  emits: ['close'],
  template: '<section><button class="sheet-close" @click="$emit(\'close\')">Close</button><slot /></section>',
}

describe('Model Studio numeric properties', () => {
  it('commits a focused transform when the field loses focus', async () => {
    const cube = createStudioCube()
    const wrapper = mount(TransformPropertiesSheet, {
      props: { open: true, element: cube },
      global: { stubs: { BottomSheet: BottomSheetStub } },
    })

    const rotationY = wrapper.findAll('input[type="number"]')[7]
    await rotationY?.trigger('focus')
    await rotationY?.setValue('90')
    await rotationY?.trigger('blur')

    expect(wrapper.emitted('commit')).toHaveLength(1)
    expect(wrapper.emitted('commit')?.[0]?.[0]).toMatchObject({
      label: 'Rotate cube',
      before: { rotation: { y: 0 } },
      after: { rotation: { y: 90 } },
    })
  })

  it('flushes the active edit when the sheet closes', async () => {
    const cube = createStudioCube()
    const wrapper = mount(TransformPropertiesSheet, {
      props: { open: true, element: cube },
      global: { stubs: { BottomSheet: BottomSheetStub } },
    })

    const positionX = wrapper.findAll('input[type="number"]')[0]
    await positionX?.trigger('focus')
    await positionX?.setValue('4')
    await wrapper.get('.sheet-close').trigger('click')

    expect(wrapper.emitted('commit')).toHaveLength(1)
    expect(wrapper.emitted('commit')?.[0]?.[0]).toMatchObject({
      label: 'Move cube',
      before: { position: { x: 0 } },
      after: { position: { x: 4 } },
    })
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
