import { describe, expect, it } from 'vitest'

import {
  isStudioIconName,
  STUDIO_ICONS,
  STUDIO_ICON_NAMES,
} from '@/core/icons/studioIcons'
import { INITIAL_RESOURCE_TEMPLATES } from '@/core/project/resourceTemplateRegistry'
import { RESOURCE_CATEGORIES } from '@/features/studio/resourceCategories'

describe('Addons Studio product icon registry', () => {
  it('contains unique, drawable typed icons', () => {
    expect(new Set(STUDIO_ICON_NAMES).size).toBe(STUDIO_ICON_NAMES.length)
    expect(STUDIO_ICON_NAMES.length).toBeGreaterThanOrEqual(18)

    for (const name of STUDIO_ICON_NAMES) {
      const definition = STUDIO_ICONS[name]
      expect(definition.base.length).toBeGreaterThan(0)
      expect(definition.base.every(Boolean)).toBe(true)
    }
  })

  it('covers every workspace category and contextual resource template', () => {
    for (const category of RESOURCE_CATEGORIES) {
      expect(isStudioIconName(category.icon)).toBe(true)
    }

    for (const template of INITIAL_RESOURCE_TEMPLATES) {
      expect(isStudioIconName(template.icon)).toBe(true)
    }
  })

  it('reserves the material-ball mark for Material', () => {
    expect(RESOURCE_CATEGORIES.find((category) => category.id === 'materials')).toMatchObject({
      icon: 'material',
      tone: 'gold',
    })
    expect(STUDIO_ICONS.material.fills).toHaveLength(1)
  })
})
