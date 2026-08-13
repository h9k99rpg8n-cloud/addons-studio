import type { CreateStudioModelInput, StudioModel, StudioVector3 } from '@/types/model'

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
  const groupIds = new Set(model.groups.map((group) => group.id))
  const nodeIds = new Set<string>()
  for (const element of model.elements) {
    if (nodeIds.has(element.id)) {
      issues.push({ field: 'name', message: 'Model node IDs must be unique.' })
      break
    }
    nodeIds.add(element.id)
    if (
      !Number.isFinite(element.size.x)
      || !Number.isFinite(element.size.y)
      || !Number.isFinite(element.size.z)
      || element.size.x <= 0
      || element.size.y <= 0
      || element.size.z <= 0
    ) {
      issues.push({ field: 'name', message: 'Cube dimensions must be greater than zero.' })
      break
    }
    if (![element.position, element.rotation, element.pivot, element.defaultPivot].every(isFiniteVector)) {
      issues.push({ field: 'name', message: 'Cube transforms must contain finite numbers.' })
      break
    }
    if (element.parentId && !groupIds.has(element.parentId)) {
      issues.push({ field: 'name', message: 'Every grouped cube must reference an existing group.' })
      break
    }
  }
  for (const group of model.groups) {
    if (nodeIds.has(group.id)) {
      issues.push({ field: 'name', message: 'Model node IDs must be unique.' })
      break
    }
    nodeIds.add(group.id)
    if (group.parentId) {
      issues.push({ field: 'name', message: 'Nested groups are not supported in this Alpha.' })
      break
    }
    if (
      ![group.position, group.rotation, group.scale, group.pivot, group.defaultPivot].every(isFiniteVector)
    ) {
      issues.push({ field: 'name', message: 'Group transforms must contain finite numbers.' })
      break
    }
    if (group.scale.x <= 0 || group.scale.y <= 0 || group.scale.z <= 0) {
      issues.push({ field: 'name', message: 'Group scale must be greater than zero.' })
      break
    }
  }
  const referenceIds = new Set<string>()
  for (const reference of model.references) {
    if (referenceIds.has(reference.id)) {
      issues.push({ field: 'name', message: 'Reference IDs must be unique.' })
      break
    }
    referenceIds.add(reference.id)
    if (
      !reference.assetId
      || !['front', 'back', 'left', 'right', 'top', 'bottom'].includes(reference.view)
      || !Number.isFinite(reference.position.x)
      || !Number.isFinite(reference.position.y)
      || !Number.isFinite(reference.scale)
      || reference.scale <= 0
      || !Number.isFinite(reference.rotation)
      || !Number.isFinite(reference.opacity)
      || reference.opacity <= 0
      || reference.opacity > 1
    ) {
      issues.push({ field: 'name', message: 'Reference guide settings are invalid.' })
      break
    }
  }
  return issues
}

function isFiniteVector(vector: StudioVector3): boolean {
  return Number.isFinite(vector.x) && Number.isFinite(vector.y) && Number.isFinite(vector.z)
}
