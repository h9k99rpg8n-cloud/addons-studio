import { describe, expect, it } from 'vitest'

import {
  createModelIdentifier,
  isValidModelIdentifier,
  normalizeModelSegment,
  validateModelInput,
} from '@/core/model/modelValidation'

describe('model resource validation', () => {
  it('normalizes names into a Bedrock-style geometry identifier', () => {
    expect(normalizeModelSegment('Río Grande!')).toBe('rio_grande')
    expect(createModelIdentifier('rio_grande', 'Vertical Slab')).toBe(
      'geometry.rio_grande.vertical_slab',
    )
  })

  it('accepts lowercase dotted identifiers and rejects unsafe values', () => {
    expect(isValidModelIdentifier('geometry.rio_grande.vertical_slab')).toBe(true)
    expect(isValidModelIdentifier('Geometry.Rio Grande.Slab')).toBe(false)
    expect(validateModelInput({ name: '', identifier: 'bad value' })).toHaveLength(2)
  })
})
