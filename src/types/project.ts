import type { StudioIconName, StudioIconTone } from '@/core/icons/studioIcons'

export const PROJECT_TYPES = ['addon', 'resource_pack', 'behavior_pack'] as const

export type ProjectType = (typeof PROJECT_TYPES)[number]

export interface ProjectIcon {
  kind: 'builtin' | 'image'
  value: string
}

export interface StudioProject {
  id: string
  name: string
  namespace: string
  description?: string
  icon: ProjectIcon
  projectType: ProjectType
  targetVersion: string
  experimentalFeatures: boolean
  createdAt: number
  updatedAt: number
  schemaVersion: number
  revision: number
  /** Undefined means that the project is displayed at the root level. */
  folderId?: string
}

export interface CreateProjectInput {
  name: string
  namespace: string
  description?: string
  icon?: ProjectIcon
  projectType: ProjectType
  targetVersion: string
  experimentalFeatures: boolean
  folderId?: string
}

export type ProjectUpdate = Partial<
  Pick<
    StudioProject,
    | 'name'
    | 'namespace'
    | 'description'
    | 'icon'
    | 'projectType'
    | 'targetVersion'
    | 'experimentalFeatures'
    | 'folderId'
  >
>

export interface StudioProjectFolder {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  schemaVersion: number
}

export interface CreateProjectFolderInput {
  name: string
}

export interface ProjectSnapshot {
  id: string
  projectId: string
  createdAt: number
  reason: 'created' | 'recovery' | 'manual'
  project: StudioProject
}

export interface StudioSetting<T = unknown> {
  key: string
  value: T
  updatedAt: number
}

export interface StorageSummary {
  projectCount: number
  usageBytes?: number
  quotaBytes?: number
}

export const RESOURCE_CATEGORY_IDS = [
  'blocks',
  'items',
  'entities',
  'models',
  'materials',
  'textures',
  'animations',
  'particles',
  'audio',
  'recipes',
  'functions',
  'scripts',
  'languages',
] as const

export type ResourceCategoryId = (typeof RESOURCE_CATEGORY_IDS)[number]

export type ResourceTemplateGroup = 'gameplay' | 'resources' | 'logic'

export interface ResourceTemplate {
  id: string
  category: ResourceCategoryId
  group: ResourceTemplateGroup
  name: string
  icon: StudioIconName
  tone: StudioIconTone
  description: string
  supportedVersions?: string[]
  status: 'coming_soon' | 'available'
}
