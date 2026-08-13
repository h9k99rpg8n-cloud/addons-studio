import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { createEmptyStudioModel, createStudioCube, createStudioGroup } from '@/core/model/modelFactory'
import ModelOutlinerSheet from '@/features/model-studio/components/ModelOutlinerSheet.vue'

const BottomSheetStub = {
  name: 'BottomSheet',
  template: '<section><slot /></section>',
}

describe('Model Studio Outliner', () => {
  it('renders hierarchy status, touch actions, multi-selection, and reference lock state', async () => {
    const model = createEmptyStudioModel('project', 'Model', 'geometry.project.model')
    const cube = createStudioCube()
    const group = createStudioGroup(0, [cube])
    cube.parentId = group.id
    model.groups.push(group)
    model.elements.push(cube)
    model.references.push({
      id: 'reference',
      assetId: 'asset',
      name: 'Front Guide',
      view: 'front',
      position: { x: 0, y: 0, z: 0 },
      size: { x: 16, y: 16 },
      opacity: 0.5,
      visible: true,
      locked: true,
    })

    const wrapper = mount(ModelOutlinerSheet, {
      props: { open: true, model },
      global: {
        stubs: {
          BottomSheet: BottomSheetStub,
          AppIcon: { template: '<i />' },
          StudioIcon: { template: '<i />' },
        },
      },
    })

    expect(wrapper.text()).toContain('Group')
    expect(wrapper.text()).toContain('Cube · Group')
    expect(wrapper.text()).toContain('Locked · front')

    await wrapper.get('[aria-label="Group actions"]').trigger('click')
    await wrapper.get('[aria-label="Lock Group"]').trigger('click')
    await wrapper.get('.new-group').trigger('click')
    await wrapper.get('[aria-label="Unlock Front Guide"]').trigger('click')
    expect(wrapper.emitted('showActions')?.[0]).toEqual([group.id])
    expect(wrapper.emitted('toggleNodeLock')?.[0]).toEqual([group.id])
    expect(wrapper.emitted('setMultiSelect')?.[0]).toEqual([true])
    expect(wrapper.emitted('toggleReferenceLock')?.[0]).toEqual(['reference'])
  })
})
