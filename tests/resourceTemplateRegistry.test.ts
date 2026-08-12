import { describe, expect, it } from 'vitest'

import {
  INITIAL_RESOURCE_TEMPLATES,
  ResourceTemplateRegistry,
} from '@/core/project/resourceTemplateRegistry'

describe('ResourceTemplateRegistry', () => {
  it('registers initial contextual resource definitions', () => {
    const registry = new ResourceTemplateRegistry()
    registry.registerMany(INITIAL_RESOURCE_TEMPLATES)

    expect(registry.get('material')).toMatchObject({
      category: 'materials',
      name: 'Material',
      status: 'coming_soon',
    })
    expect(registry.list()).toHaveLength(11)
  })

  it('prevents duplicate template ids', () => {
    const registry = new ResourceTemplateRegistry()
    registry.register(INITIAL_RESOURCE_TEMPLATES[0]!)

    expect(() => registry.register(INITIAL_RESOURCE_TEMPLATES[0]!)).toThrow(
      'already registered',
    )
  })

  it('can filter future templates by supported Bedrock version', () => {
    const registry = new ResourceTemplateRegistry()
    registry.register({
      ...INITIAL_RESOURCE_TEMPLATES[0]!,
      id: 'future-block',
      supportedVersions: ['1.26.40'],
    })

    expect(registry.list('1.26.40')).toHaveLength(1)
    expect(registry.list('1.26.30')).toHaveLength(0)
  })
})
