import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ViewportReferences from '@/features/model-studio/components/ViewportReferences.vue'
import type { StudioReferenceImage } from '@/types/model'

function reference(id: string, view: StudioReferenceImage['view']): StudioReferenceImage {
  return {
    id,
    assetId: `asset-${id}`,
    name: `${view} guide`,
    view,
    position: { x: 5, y: -3 },
    scale: 1.25,
    rotation: 12,
    opacity: 0.6,
    visible: true,
    flipHorizontal: true,
    flipVertical: false,
  }
}

describe('ViewportReferences', () => {
  it('resolves only guides assigned to the individual standard viewport', async () => {
    const front = reference('front', 'front')
    const right = reference('right', 'right')
    const wrapper = mount(ViewportReferences, {
      props: {
        references: [front, right],
        view: 'front',
        assetUrls: { 'asset-front': 'blob:front', 'asset-right': 'blob:right' },
      },
    })

    expect(wrapper.findAll('img')).toHaveLength(1)
    expect(wrapper.get('img').attributes('src')).toBe('blob:front')
    expect(wrapper.get('img').attributes('style')).toContain('left: 55%')
    expect(wrapper.get('img').attributes('style')).toContain('scale(-1.25, 1.25)')

    await wrapper.setProps({ view: 'right' })
    expect(wrapper.findAll('img')).toHaveLength(1)
    expect(wrapper.get('img').attributes('src')).toBe('blob:right')

    await wrapper.setProps({ view: 'perspective' })
    expect(wrapper.findAll('img')).toHaveLength(0)
  })

  it('does not render hidden or unavailable references', () => {
    const hidden = { ...reference('hidden', 'front'), visible: false }
    const wrapper = mount(ViewportReferences, {
      props: { references: [hidden, reference('missing', 'front')], view: 'front', assetUrls: {} },
    })
    expect(wrapper.findAll('img')).toHaveLength(0)
  })
})
