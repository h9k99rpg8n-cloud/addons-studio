import type {
  DataTexture,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
} from 'three'

import type { ThreeModule } from './modelViewportTypes'

export interface StudioPreviewMaterialSet {
  materials: MeshStandardMaterial[]
  texture: DataTexture
}

export function disposeMaterial(material: Material | Material[]): void {
  if (Array.isArray(material)) material.forEach((entry) => entry.dispose())
  else material.dispose()
}

export function disposeObject(object: Object3D): void {
  object.traverse((child) => {
    const mesh = child as Mesh
    mesh.geometry?.dispose()
    if (mesh.material) disposeMaterial(mesh.material)
  })
}

/**
 * Original Addons Studio editor-only pixel preview. It is deliberately tiny,
 * neutral, and deterministic so untextured cuboids remain readable without
 * pretending they already have a Minecraft texture.
 */
export function createStudioPreviewMaterials(
  three: ThreeModule,
): StudioPreviewMaterialSet {
  const size = 8
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4
      const checker = (x + y) % 2 === 0
      const accent = ((x * 3 + y * 5) % 7) === 0
      const value = accent ? 205 : checker ? 242 : 224
      data[index] = value
      data[index + 1] = value
      data[index + 2] = value
      data[index + 3] = 255
    }
  }

  const texture = new three.DataTexture(data, size, size, three.RGBAFormat)
  texture.magFilter = three.NearestFilter
  texture.minFilter = three.NearestFilter
  texture.wrapS = three.RepeatWrapping
  texture.wrapT = three.RepeatWrapping
  texture.colorSpace = three.SRGBColorSpace
  texture.generateMipmaps = false
  texture.needsUpdate = true

  const palette = [0x8ea39b, 0x83998f, 0x94a7a1, 0x87958f, 0x8d98a5, 0xa3978d]
  const materials = palette.map((color) => new three.MeshStandardMaterial({
    color,
    map: texture,
    roughness: 0.72,
    metalness: 0.025,
  }))

  return { materials, texture }
}

export function disposeStudioPreviewMaterials(set: StudioPreviewMaterialSet | undefined): void {
  if (!set) return
  set.materials.forEach((material) => material.dispose())
  set.texture.dispose()
}
