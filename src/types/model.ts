export interface StudioVector3 {
  x: number
  y: number
  z: number
}

export interface StudioVector2 {
  x: number
  y: number
}

export interface StudioCube {
  id: string
  type: 'cube'
  name: string
  position: StudioVector3
  size: StudioVector3
  /** Euler rotation stored in degrees for a touch-friendly Bedrock workflow. */
  rotation: StudioVector3
  visible: boolean
  /** Reserved for the future bone hierarchy without changing stable element IDs. */
  parentId?: string
}

export type StudioModelElement = StudioCube

export type StudioReferenceView = 'front' | 'side' | 'top'

export interface StudioReferenceImage {
  id: string
  assetId: string
  name: string
  view: StudioReferenceView
  position: StudioVector3
  size: StudioVector2
  opacity: number
  visible: boolean
}

export interface StudioModel {
  id: string
  projectId: string
  name: string
  identifier: string
  elements: StudioModelElement[]
  references: StudioReferenceImage[]
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

export type ModelTransformTool = 'select' | 'orbit' | 'move' | 'rotate' | 'scale'

export interface StudioElementTransform {
  position: StudioVector3
  size: StudioVector3
  rotation: StudioVector3
}
