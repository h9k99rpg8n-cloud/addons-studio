import { describe, expect, it } from 'vitest'

import { DEFAULT_BEDROCK_VERSION } from '@/core/project/bedrockVersions'
import {
  isValidNamespace,
  normalizeNamespace,
  validateProjectInput,
} from '@/core/project/projectValidation'
import type { CreateProjectInput } from '@/types/project'

function validInput(overrides: Partial<CreateProjectInput> = {}): CreateProjectInput {
  return {
    name: 'Río Grande Urbanismo',
    namespace: 'rio_grande_urbanismo',
    projectType: 'addon',
    targetVersion: DEFAULT_BEDROCK_VERSION,
    experimentalFeatures: false,
    ...overrides,
  }
}

describe('project creation validation', () => {
  it('normalizes accented project names into safe namespaces', () => {
    expect(normalizeNamespace('  Río Grande — Urbanismo!  ')).toBe('rio_grande_urbanismo')
    expect(normalizeNamespace('***')).toBe('project')
  })

  it('accepts lowercase letters, numbers, and underscores', () => {
    expect(isValidNamespace('rio_grande_26')).toBe(true)
    expect(isValidNamespace('Río Grande')).toBe(false)
    expect(isValidNamespace('has-a-dash')).toBe(false)
  })

  it('rejects missing names, unsafe namespaces, and unknown targets', () => {
    const issues = validateProjectInput(
      validInput({ name: ' ', namespace: 'Not Safe', targetVersion: '9.99.9' }),
    )

    expect(issues.map((issue) => issue.field)).toEqual(['name', 'namespace', 'targetVersion'])
  })

  it('accepts a complete project draft', () => {
    expect(validateProjectInput(validInput())).toEqual([])
  })
})
