export const STUDIO_RESOURCE_TYPES = [
  'model',
  'block',
  'block_model',
  'item',
  'entity',
  'plant',
  'plugin',
  'function',
  'recipe',
  'particle',
  'sound',
  'animation',
] as const

export type StudioResourceType = (typeof STUDIO_RESOURCE_TYPES)[number]

export type StudioAssetKind = 'model' | 'image' | 'audio' | 'document'

export interface StudioResource<TPayload = unknown> {
  id: string
  projectId: string
  type: StudioResourceType
  name: string
  identifier?: string
  folderId?: string
  payload: TPayload
  createdAt: number
  updatedAt: number
  schemaVersion: number
  revision: number
}

export interface StudioResourceFolder {
  id: string
  projectId: string
  resourceType: StudioResourceType | 'material'
  name: string
  parentId?: string
  createdAt: number
  updatedAt: number
  schemaVersion: number
}

export interface StudioResourceAsset {
  id: string
  projectId: string
  resourceId?: string
  kind: StudioAssetKind
  name: string
  extension: string
  mimeType: string
  blob: Blob
  byteLength: number
  createdAt: number
  updatedAt: number
}

export type ModelFileFormat = 'bedrock_geometry' | 'bbmodel' | 'studio_legacy'

export interface ModelResourcePayload {
  format: ModelFileFormat
  assetId: string
  originalFilename: string
  cubeCount?: number
  boneCount?: number
  textureReferences?: string[]
}

export type BlockTextureMode = 'all' | 'top_side_bottom' | 'per_face'

export interface BlockTranslation {
  locale: string
  name: string
}

export interface BlockTextureAssignment {
  mode: BlockTextureMode
  all?: string
  top?: string
  side?: string
  bottom?: string
  north?: string
  south?: string
  east?: string
  west?: string
  up?: string
  down?: string
}

export interface BlockLightSettings {
  enabled: boolean
  level: number
  vibrantColorEnabled: boolean
  color: string
}

export interface BlockRecipeSettings {
  enabled: boolean
  linkedRecipeId?: string
}

export interface BlockResourcePayload {
  displayName: string
  nameColor: string
  translations: BlockTranslation[]
  textures: BlockTextureAssignment
  light: BlockLightSettings
  transparency: 'opaque' | 'cutout' | 'blend'
  blocksLight: boolean
  destroyTime: number
  explosionResistance: number
  recommendedTool: 'none' | 'pickaxe' | 'axe' | 'shovel' | 'hoe' | 'sword'
  requiredToolLevel: 'none' | 'wood' | 'stone' | 'iron' | 'diamond' | 'netherite'
  dropIdentifier: string
  silkTouch: boolean
  fortune: boolean
  sound: string
  collision: 'full' | 'none' | 'custom'
  selectionBox: 'full' | 'none' | 'custom'
  flammable: boolean
  friction: number
  movementSpeed: number
  mapColor: string
  orientation: 'none' | 'cardinal' | 'facing'
  creativeCategory: 'construction' | 'nature' | 'equipment' | 'items' | 'none'
  maxStackSize: number
  recipe: BlockRecipeSettings
  pluginIds: string[]
  customModel?: {
    resourceId?: string
    scale: StudioVectorLike
    position: StudioVectorLike
    rotation: StudioVectorLike
    collision: 'automatic' | 'full' | 'none' | 'custom'
    renderMethod: 'opaque' | 'alpha_test' | 'blend'
    animationsEnabled: boolean
  }
}

export interface StudioVectorLike {
  x: number
  y: number
  z: number
}

export const RESOURCE_SCHEMA_VERSION = 1
