import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, expect, it } from 'vitest'

import { createEmptyStudioModel, createStudioCube, createStudioGroup } from '@/core/model/modelFactory'
import { createModelFolder } from '@/core/model/modelFolders'
import ModelOutlinerSheet from '@/features/model-studio/components/ModelOutlinerSheet.vue'

const BottomSheetStub = {
  name: 'BottomSheet',
  template: '<section><slot /></section>',
}

describe('Model Studio Outliner', () => {
  it('renders folders and structural groups with touch actions and multi-selection', async () => {
    const model = createEmptyStudioModel('project', 'Model', 'geometry.project.model')
    const cube = createStudioCube()
    const group = createStudioGroup(0, [cube])
    const folder = createModelFolder(model, 'Head Pieces')
    group.folderId = folder.id
    cube.parentId = group.id
    model.folders.push(folder)
    model.groups.push(group)
    model.elements.push(cube)
    model.references.push({
      id: 'reference',
      assetId: 'asset',
      name: 'Front Guide',
      view: 'front',
      position: { x: 0, y: 0 },
      scale: 1,
      rotation: 0,
      opacity: 0.5,
      visible: true,
      flipHorizontal: false,
      flipVertical: false,
    })

    const wrapper = mount(ModelOutlinerSheet, {
      props: { open: true, model },
      global: {
        plugins: [createPinia()],
        stubs: {
          BottomSheet: BottomSheetStub,
          AppIcon: { template: '<i />' },
          StudioIcon: { template: '<i />' },
        },
      },
    })

    expect(wrapper.text()).toContain('Head Pieces')
    await wrapper.get('[aria-label="Expand Head Pieces"]').trigger('click')
    expect(wrapper.text()).toContain('Group')
    await wrapper.get('[aria-label="Expand Group"]').trigger('click')
    expect(wrapper.text()).toContain('Cube · Group')
    expect(wrapper.text()).not.toContain('Front Guide')

    await wrapper.get('[aria-label="Group actions"]').trigger('click')
    await wrapper.get('[aria-label="Lock Group"]').trigger('click')
    const multiSelect = wrapper.findAll('button').find((entry) => entry.text().includes('Multi-select'))
    await multiSelect!.trigger('click')
    expect(wrapper.emitted('showActions')?.[0]).toEqual([group.id])
    expect(wrapper.emitted('toggleNodeLock')?.[0]).toEqual([group.id])
    expect(wrapper.emitted('setMultiSelect')?.[0]).toEqual([true])
  })
})
