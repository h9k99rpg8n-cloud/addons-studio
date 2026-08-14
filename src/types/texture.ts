export type TextureFace = 'north' | 'south' | 'east' | 'west' | 'up' | 'down'

export interface StudioTextureAsset {
  id: string
  projectId: string
  modelId: string
  name: string
  mimeType: 'image/png' | 'image/jpeg'
  blob: Blob
  width: number
  height: number
  createdAt: number
  updatedAt: number
}

export interface StudioMaterial {
  id: string
  projectId: string
  modelId: string
  name: string
  identifier: string
  textureAssetId?: string
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
