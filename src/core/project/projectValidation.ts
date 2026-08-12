import { isMaintainedBedrockVersion } from '@/core/project/bedrockVersions'
import { PROJECT_TYPES, type CreateProjectInput, type StudioProject } from '@/types/project'

export interface ValidationIssue {
  field: keyof Pick<CreateProjectInput, 'name' | 'namespace' | 'targetVersion'>
  message: string
}

export function normalizeNamespace(value: string): string {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')

  return normalized || 'project'
}

export function isValidNamespace(value: string): boolean {
  return value.length >= 2 && value.length <= 64 && /^[a-z0-9_]+$/.test(value)
}

export function validateProjectInput(input: CreateProjectInput): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const name = input.name.trim()
  const namespace = input.namespace.trim()

  if (!name) {
    issues.push({ field: 'name', message: 'Project name is required.' })
  } else if (name.length > 80) {
    issues.push({ field: 'name', message: 'Project name must be 80 characters or fewer.' })
  }

  if (!namespace) {
    issues.push({ field: 'namespace', message: 'Namespace is required.' })
  } else if (!isValidNamespace(namespace)) {
    issues.push({
      field: 'namespace',
      message: 'Use 2–64 lowercase letters, numbers, and underscores only.',
    })
  }

  if (!isMaintainedBedrockVersion(input.targetVersion)) {
    issues.push({ field: 'targetVersion', message: 'Choose a supported target version.' })
  }

  if (!PROJECT_TYPES.includes(input.projectType)) {
    issues.push({ field: 'name', message: 'Choose a valid project type.' })
  }

  return issues
}

export function validateStoredProject(project: StudioProject): ValidationIssue[] {
  return validateProjectInput(project)
}
