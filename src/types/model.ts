export interface StudioVector3 {
  x: number
  y: number
  z: number
}

export interface StudioVector2 {
  x: number
  y: number
}

export type StudioMetadataValue =
  | string
  | number
  | boolean
  | null
  | StudioMetadataValue[]
  | { [key: string]: StudioMetadataValue }

export interface StudioNodeBase {
  id: string
  name: string
  visible: boolean
  /** Locked nodes remain visible but cannot be picked or transformed from the viewport. */
  locked: boolean
  /** Absolute editor pivot in model space. Future bones can reuse this value. */
  pivot: StudioVector3
  /** Stable reset target retained while the node moves with its geometry. */
  defaultPivot: StudioVector3
  /** Optional parent group. Nested group editing is reserved for a later Alpha. */
  parentId?: string
  /** Version-tolerant product metadata copied by duplicate and project-copy flows. */
  metadata?: Record<string, StudioMetadataValue>
}

export interface StudioCube {
  id: StudioNodeBase['id']
  type: 'cube'
  name: StudioNodeBase['name']
  position: StudioVector3
  size: StudioVector3
  /** Euler rotation stored in degrees for a touch-friendly Bedrock workflow. */
  rotation: StudioVector3
  visible: StudioNodeBase['visible']
  locked: StudioNodeBase['locked']
  pivot: StudioNodeBase['pivot']
  defaultPivot: StudioNodeBase['defaultPivot']
  parentId?: StudioNodeBase['parentId']
  metadata?: StudioNodeBase['metadata']
}

export interface StudioGroup {
  id: StudioNodeBase['id']
  type: 'group'
  name: StudioNodeBase['name']
  /** Logical group handle position. Child geometry remains stored in model space. */
  position: StudioVector3
  rotation: StudioVector3
  scale: StudioVector3
  visible: StudioNodeBase['visible']
  locked: StudioNodeBase['locked']
  pivot: StudioNodeBase['pivot']
  defaultPivot: StudioNodeBase['defaultPivot']
  parentId?: StudioNodeBase['parentId']
  metadata?: StudioNodeBase['metadata']
}

export type StudioModelElement = StudioCube
export type StudioModelNode = StudioCube | StudioGroup

export type StudioReferenceView = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom'

export interface StudioReferenceImage {
  id: string
  assetId: string
  name: string
  view: StudioReferenceView
  position: StudioVector3
  size: StudioVector2
  opacity: number
  visible: boolean
  /** Locked references never participate in viewport picking. */
  locked: boolean
}

export type StudioCameraView =
  | 'perspective'
  | 'isometric'
  | 'front'
  | 'back'
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'

export type StudioViewportLayout = 1 | 2

export interface StudioSnappingSettings {
  /** World-unit step. `null` means Off. */
  transform: number | null
  customTransform: number
  /** Degree step. `null` means Off. */
  rotation: number | null
}

export type StudioResizeDirection = 'symmetric' | 'positive' | 'negative'
export type StudioControlMode = 'gizmos' | 'tactilismos' | 'hybrid'
export type StudioTransformSpace = 'global' | 'local' | 'parent'
export type StudioEditorLanguage = 'en' | 'es'

export interface StudioModelingSettings {
  resizeDirection: StudioResizeDirection
  controlMode: StudioControlMode
  transformSpace: StudioTransformSpace
  /** Language foundation only; full application localization comes later. */
  language: StudioEditorLanguage
}

export interface StudioEditorState {
  snapping: StudioSnappingSettings
  modeling: StudioModelingSettings
  viewportLayout: StudioViewportLayout
  viewportViews: StudioCameraView[]
}

export interface StudioModel {
  id: string
  projectId: string
  name: string
  identifier: string
  elements: StudioModelElement[]
  groups: StudioGroup[]
  references: StudioReferenceImage[]
  editor: StudioEditorState
  createdAt: number
  updatedAt: number
  schemaVersion: number
  revision: number
}

export interface ModelReferenceAsset {
  id: string
  modelId: string
  projectId: string
  name: string
  mimeType: 'image/png' | 'image/jpeg'
  blob: Blob
  createdAt: number
}

export interface CreateStudioModelInput {
  projectId: string
  name: string
  identifier: string
}

export type ModelTransformTool = 'select' | 'move' | 'rotate' | 'scale' | 'pivot'

export interface StudioElementTransform {
  position: StudioVector3
  size: StudioVector3
  rotation: StudioVector3
}
