import type { StudioModel } from '@/types/model'

import {
  cloneStudioCube,
  cloneStudioGroup,
  cloneStudioMetadata,
  cloneStudioModelFolder,
  createEmptyStudioModel,
} from '../modelFactory'
import { validateStoredModel } from '../modelValidation'
import { bedrockGeometryAdapter } from './bedrockGeometryAdapter'
import { ModelJsonError } from './modelJsonError'
import type { ImportedModelDraft, ModelJsonAdapter } from './modelJsonTypes'
import { studioJsonAdapter } from './studioJsonAdapter'

const ADAPTERS: readonly ModelJsonAdapter[] = [studioJsonAdapter, bedrockGeometryAdapter]

export function parseModelJson(source: string): unknown {
  try {
    return JSON.parse(source) as unknown
  } catch {
    throw new ModelJsonError('malformed-json', 'This JSON file could not be read. Check that it contains valid JSON.')
  }
}

export function detectModelJson(value: unknown): ModelJsonAdapter {
  const adapter = ADAPTERS.find((candidate) => candidate.canRead(value))
  if (!adapter) {
    throw new ModelJsonError('unrecognized-format', 'This JSON file is not a recognized model format.')
  }
  return adapter
}

export function importModelJsonDraft(source: string): ImportedModelDraft {
  const parsed = parseModelJson(source)
  return detectModelJson(parsed).read(parsed)
}

export function importedDraftToStudioModel(
  projectId: string,
  draft: ImportedModelDraft,
): StudioModel {
  const model = createEmptyStudioModel(projectId, draft.name, draft.identifier)
  model.elements = draft.elements.map(cloneStudioCube)
  model.groups = draft.groups.map(cloneStudioGroup)
  model.folders = draft.folders.map(cloneStudioModelFolder)
  model.metadata = cloneStudioMetadata(draft.metadata)
  const issue = validateStoredModel(model)[0]
  if (issue) throw new ModelJsonError('invalid-model', `Model cannot be imported. ${issue.message}`)
  return model
}

export function importModelJson(source: string, projectId: string): {
  model: StudioModel
  draft: ImportedModelDraft
} {
  const draft = importModelJsonDraft(source)
  return { model: importedDraftToStudioModel(projectId, draft), draft }
}
