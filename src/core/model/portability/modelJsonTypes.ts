import type { StudioCube, StudioGroup, StudioMetadataValue, StudioModelFolder } from '@/types/model'

export const STUDIO_MODEL_JSON_FORMAT = 'addons-studio-model'
export const STUDIO_MODEL_JSON_VERSION = 1

export interface StudioModelJsonDocument {
  format: typeof STUDIO_MODEL_JSON_FORMAT
  formatVersion: typeof STUDIO_MODEL_JSON_VERSION
  schemaVersion: number
  exportedAt: string
  model: {
    name: string
    identifier: string
    cubes: StudioCube[]
    groups: StudioGroup[]
    folders: StudioModelFolder[]
    metadata?: Record<string, StudioMetadataValue>
  }
  /**
   * Editor images are intentionally not embedded. This keeps `.model.json`
   * reviewable and prevents multi-megabyte base64 records.
   */
  editor?: {
    omittedAssets?: ('references' | 'background')[]
  }
}

export type RecognizedModelJsonFormat = 'studio' | 'bedrock-geometry'

export interface ImportedModelDraft {
  format: RecognizedModelJsonFormat
  name: string
  identifier: string
  elements: StudioCube[]
  groups: StudioGroup[]
  folders: StudioModelFolder[]
  metadata?: Record<string, StudioMetadataValue>
  warnings: string[]
}

export interface ModelJsonAdapter {
  readonly format: RecognizedModelJsonFormat
  canRead(value: unknown): boolean
  read(value: unknown): ImportedModelDraft
}
