export type TextureFace = 'north' | 'south' | 'east' | 'west' | 'up' | 'down'
export type UvPrecision = 0.25 | 0.5 | 1 | 2 | 4

/** A binary image owned by the project material library, not by one model. */
export interface StudioTextureAsset {
  id: string
  projectId: string
  name: string
  mimeType: 'image/png' | 'image/jpeg'
  blob: Blob
  width: number
  height: number
  createdAt: number
  updatedAt: number
}

/** Materials are reusable across every model in a project. */
export interface StudioMaterial {
  id: string
  projectId: string
  name: string
  identifier: string
  textureAssetId?: string
  /** Rework metadata. Materials remain project-scoped and folders never affect consumers. */
  folderId?: string
  createdAt: number
  updatedAt: number
  revision: number
}

export interface StudioUvRect {
  x: number
  y: number
  width: number
  height: number
  rotation: 0 | 90 | 180 | 270
  flipHorizontal: boolean
  flipVertical: boolean
}

/** Bindings are the model-specific bridge between geometry and reusable materials. */
export interface StudioTextureBinding {
  id: string
  projectId: string
  modelId: string
  cubeId: string
  face: TextureFace
  materialId: string
  uv: StudioUvRect
  updatedAt: number
}

export interface TextureWorkspaceSummary {
  materials: StudioMaterial[]
  assets: StudioTextureAsset[]
  bindings: StudioTextureBinding[]
}
