import type { CreateStudioModelInput, StudioModel } from '@/types/model'

export interface ModelValidationIssue {
  field: 'name' | 'identifier'
  message: string
}

export function normalizeModelSegment(value: string): string {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')

  return normalized || 'model'
}

export function createModelIdentifier(namespace: string, name: string): string {
  return `geometry.${normalizeModelSegment(namespace)}.${normalizeModelSegment(name)}`
}

export function isValidModelIdentifier(value: string): boolean {
  return (
    value.length >= 12 &&
    value.length <= 128 &&
    /^geometry\.[a-z0-9_]+(?:\.[a-z0-9_]+)+$/.test(value)
  )
}

export function validateModelInput(
  input: Pick<CreateStudioModelInput, 'name' | 'identifier'>,
): ModelValidationIssue[] {
  const issues: ModelValidationIssue[] = []
  const name = input.name.trim()
  const identifier = input.identifier.trim()

  if (!name) issues.push({ field: 'name', message: 'Model name is required.' })
  else if (name.length > 80) {
    issues.push({ field: 'name', message: 'Model name must be 80 characters or fewer.' })
  }

  if (!identifier) {
    issues.push({ field: 'identifier', message: 'Model identifier is required.' })
  } else if (!isValidModelIdentifier(identifier)) {
    issues.push({
      field: 'identifier',
      message: 'Use geometry.namespace.name with lowercase letters, numbers, and underscores.',
    })
  }

  return issues
}

export function validateStoredModel(model: StudioModel): ModelValidationIssue[] {
  const issues = validateModelInput(model)
  for (const element of model.elements) {
    if (element.size.x <= 0 || element.size.y <= 0 || element.size.z <= 0) {
      issues.push({ field: 'name', message: 'Cube dimensions must be greater than zero.' })
      break
    }
  }
  return issues
}
