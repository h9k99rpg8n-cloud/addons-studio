import type {
  BlockResourcePayload,
  ModelResourcePayload,
  StudioResource,
} from '@/types/resource'

export interface ResourceReferenceMaps {
  resourceIds: ReadonlyMap<string, string>
  resourceAssetIds: ReadonlyMap<string, string>
  materialIds: ReadonlyMap<string, string>
}

/**
 * Clones a portable resource payload and remaps every implemented cross-resource
 * reference. Unknown future payloads are preserved byte-for-byte by structured clone.
 */
export function remapResourcePayload(
  resource: StudioResource,
  maps: ResourceReferenceMaps,
): unknown {
  const payload = structuredClone(resource.payload)
  if (!payload || typeof payload !== 'object') return payload

  if (resource.type === 'model') {
    const model = payload as ModelResourcePayload
    model.assetId = maps.resourceAssetIds.get(model.assetId) ?? model.assetId
    return model
  }

  if (resource.type === 'block' || resource.type === 'block_model') {
    const block = payload as BlockResourcePayload
    for (const [key, value] of Object.entries(block.textures ?? {})) {
      if (key !== 'mode' && typeof value === 'string') {
        ;(block.textures as unknown as Record<string, unknown>)[key] = maps.materialIds.get(value) ?? value
      }
    }
    if (block.customModel?.resourceId) {
      block.customModel.resourceId = maps.resourceIds.get(block.customModel.resourceId)
        ?? block.customModel.resourceId
    }
    if (block.recipe.linkedRecipeId) {
      block.recipe.linkedRecipeId = maps.resourceIds.get(block.recipe.linkedRecipeId)
        ?? block.recipe.linkedRecipeId
    }
    block.pluginIds = block.pluginIds.map((id) => maps.resourceIds.get(id) ?? id)
    return block
  }

  return payload
}
