/* eslint-disable vue/one-component-per-file -- the inline harness keeps this integration test self-contained */
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, reactive } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'

import { createEmptyStudioModel, createStudioCube } from '@/core/model/modelFactory'
import {
  applyHierarchyState,
  buildNodeTransformState,
  captureNodeTransform,
  type StudioAxis,
  type StudioNodeTransformSession,
} from '@/core/model/modelHierarchy'
import TransformPropertiesSheet from '@/features/model-studio/components/TransformPropertiesSheet.vue'
import type { StudioModelNode } from '@/types/model'

const BottomSheetStub = defineComponent({
  name: 'BottomSheet',
  setup(_, { slots }) {
    return () => h('section', slots.default?.())
  },
})

describe('Model Studio numeric Resize workflow', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('previews and commits one symmetric resize without applying the center offset twice', async () => {
    const model = reactive(createEmptyStudioModel('project', 'Resize', 'geometry.project.resize'))
    model.elements.push(createStudioCube(0))
    let session: StudioNodeTransformSession | undefined

    const Harness = defineComponent({
      setup() {
        const begin = () => {
          session = captureNodeTransform(model, model.elements[0]!.id)
        }
        const preview = (payload: {
          node: StudioModelNode
          operation: 'generic' | 'move' | 'scale' | 'rotate'
          axis?: StudioAxis
        }) => {
          session ??= captureNodeTransform(model, payload.node.id)
          applyHierarchyState(model, buildNodeTransformState(session!, payload.node, {
            operation: payload.operation,
            axis: payload.axis,
            resizeDirection: 'symmetric',
            transformSpace: 'global',
          }))
        }
        const commit = (payload: {
          after: StudioModelNode
          operation: 'generic' | 'move' | 'scale' | 'rotate'
          axis?: StudioAxis
        }) => {
          session ??= captureNodeTransform(model, payload.after.id)
          const applied = captureNodeTransform(model, payload.after.id)
          applyHierarchyState(model, applied!.before)
          session = undefined
        }
        return () => h(TransformPropertiesSheet, {
          open: true,
          node: model.elements[0],
          onBegin: begin,
          onPreview: preview,
          onCommit: commit,
        })
      },
    })

    const wrapper = mount(Harness, {
      global: { stubs: { BottomSheet: BottomSheetStub } },
    })
    const sizeX = wrapper.findAll('fieldset')[1]!.findAll('input')[0]!
    await sizeX.trigger('focus')
    await sizeX.setValue('20')

    expect(model.elements[0]!.size.x).toBe(20)
    expect(model.elements[0]!.position.x).toBe(-2)

    await sizeX.trigger('blur')

    expect(model.elements[0]!.size.x).toBe(20)
    expect(model.elements[0]!.position.x).toBe(-2)
  })
})
