import type { StudioMetadataValue, StudioModel } from '@/types/model'

import {
  cloneStudioCube,
  cloneStudioGroup,
  cloneStudioMetadata,
  cloneStudioModelFolder,
  MODEL_SCHEMA_VERSION,
} from '../modelFactory'
import { validateModelInput, validateStoredModel } from '../modelValidation'
import { ModelJsonError } from './modelJsonError'
import {
  STUDIO_MODEL_JSON_FORMAT,
  STUDIO_MODEL_JSON_VERSION,
  type StudioModelJsonDocument,
} from './modelJsonTypes'

function assertFiniteMetadata(value: StudioMetadataValue, path: string): void {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new ModelJsonError('invalid-model', `Model cannot be exported. ${path} contains an invalid number.`)
  }
  if (Array.isArray(value)) value.forEach((entry, index) => assertFiniteMetadata(entry, `${path}[${index}]`))
  else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, entry]) => assertFiniteMetadata(entry, `${path}.${key}`))
  }
}

export function createStudioModelJson(
  model: StudioModel,
  overrides: { name?: string; identifier?: string } = {},
): StudioModelJsonDocument {
  const name = overrides.name?.trim() || model.name
  const identifier = overrides.identifier?.trim() || model.identifier
  const inputIssue = validateModelInput({ name, identifier })[0]
  if (inputIssue) throw new ModelJsonError('invalid-model', `Model cannot be exported. ${inputIssue.message}`)
  const integrityIssue = validateStoredModel({ ...model, name, identifier })[0]
  if (integrityIssue) throw new ModelJsonError('invalid-model', `Model cannot be exported. ${integrityIssue.message}`)

  const everyId = [
    ...model.elements.map((entry) => entry.id),
    ...model.groups.map((entry) => entry.id),
    ...model.folders.map((entry) => entry.id),
  ]
  if (new Set(everyId).size !== everyId.length) {
    throw new ModelJsonError('invalid-model', 'Model cannot be exported. Object and folder IDs must be unique.')
  }
  if (model.metadata) {
    Object.entries(model.metadata).forEach(([key, value]) => assertFiniteMetadata(value, `metadata.${key}`))
  }
  return {
    format: STUDIO_MODEL_JSON_FORMAT,
    formatVersion: STUDIO_MODEL_JSON_VERSION,
    schemaVersion: MODEL_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    model: {
      name,
      identifier,
      cubes: model.elements.map(cloneStudioCube),
      groups: model.groups.map(cloneStudioGroup),
      folders: model.folders.map(cloneStudioModelFolder),
      metadata: cloneStudioMetadata(model.metadata),
    },
    editor: model.references.length || model.editor.background.customAssetId
      ? { omittedAssets: ['references', 'background'] }
      : undefined,
  }
}

export function serializeStudioModelJson(
  model: StudioModel,
  overrides: { name?: string; identifier?: string } = {},
): string {
  return `${JSON.stringify(createStudioModelJson(model, overrides), null, 2)}\n`
}

export function modelJsonFilename(name: string): string {
  const safe = name.trim().toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'model'
  return `${safe}.model.json`
}
