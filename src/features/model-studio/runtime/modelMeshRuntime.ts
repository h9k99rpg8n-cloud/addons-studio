import type { Mesh, MeshStandardMaterial, Scene } from 'three'

import {
  elementCenter,
  isNodeEffectivelyVisible,
} from '@/core/model/modelHierarchy'
import type { StudioCube, StudioModel } from '@/types/model'
import type { ThreeModule } from './modelViewportTypes'
import { stablePreviewMaterialIndex } from './viewportMath'

export function applyStudioCubeToMesh(
  three: ThreeModule,
  model: StudioModel,
  element: StudioCube,
  mesh: Mesh,
  isolation?: Set<string>,
): void {
  const center = elementCenter(element)
  mesh.position.set(center.x, center.y, center.z)
  mesh.scale.set(element.size.x, element.size.y, element.size.z)
  mesh.rotation.set(
    three.MathUtils.degToRad(element.rotation.x),
    three.MathUtils.degToRad(element.rotation.y),
    three.MathUtils.degToRad(element.rotation.z),
  )
  mesh.visible = isNodeEffectivelyVisible(model, element)
    && (!isolation || isolation.has(element.id))
}

export function syncStudioCubeMeshes(options: {
  three: ThreeModule
  scene: Scene
  model: StudioModel
  meshes: Map<string, Mesh>
  materials: MeshStandardMaterial[]
  lowPower?: boolean
  isolation?: Set<string>
}): void {
  const { three, scene, model, meshes, materials, lowPower, isolation } = options
  const currentIds = new Set(model.elements.map((element) => element.id))

  for (const [id, mesh] of meshes) {
    if (currentIds.has(id)) continue
    scene.remove(mesh)
    mesh.geometry.dispose()
    meshes.delete(id)
  }

  for (const element of model.elements) {
    let mesh = meshes.get(element.id)
    if (!mesh) {
      const index = stablePreviewMaterialIndex(element.id, materials.length)
      mesh = new three.Mesh(new three.BoxGeometry(1, 1, 1), materials[index]!)
      mesh.userData.elementId = element.id
      mesh.castShadow = !lowPower
      mesh.receiveShadow = !lowPower
      scene.add(mesh)
      meshes.set(element.id, mesh)
    }
    applyStudioCubeToMesh(three, model, element, mesh, isolation)
  }
}
