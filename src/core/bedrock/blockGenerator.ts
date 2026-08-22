import { strToU8, zip } from 'fflate'

import type { StudioProject } from '@/types/project'
import type { BlockResourcePayload, ModelResourcePayload, StudioResource } from '@/types/resource'
import type { StudioMaterial, StudioTextureAsset } from '@/types/texture'

interface BlockPackageInput {
  project: StudioProject
  block: StudioResource<BlockResourcePayload>
  materials: StudioMaterial[]
  textureAssets: StudioTextureAsset[]
  model?: StudioResource<ModelResourcePayload>
  modelAsset?: Blob
}

export interface GeneratedBlockPackage {
  blob: Blob
  filename: string
  warnings: string[]
  files: string[]
}

const LANGUAGE_CODES: Record<string, string> = {
  en: 'en_US',
  'en-US': 'en_US',
  es: 'es_ES',
  'es-MX': 'es_MX',
  pt: 'pt_BR',
  fr: 'fr_FR',
  de: 'de_DE',
  ja: 'ja_JP',
}

const NAME_COLORS: Record<string, string> = {
  '#ffffff': 'f',
  '#000000': '0',
  '#ffff55': 'e',
  '#55ff55': 'a',
  '#55ffff': 'b',
  '#ff5555': 'c',
  '#ff55ff': 'd',
  '#5555ff': '9',
  '#ffaa00': '6',
  '#aaaaaa': '7',
}

function zipAsync(entries: Record<string, Uint8Array>): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    zip(entries, { level: 6 }, (error, data) => error ? reject(error) : resolve(data))
  })
}

function safeName(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'block'
}

function text(value: unknown): Uint8Array {
  return strToU8(typeof value === 'string' ? value : JSON.stringify(value, null, 2))
}

async function blobBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer())
}

function assignedMaterialIds(payload: BlockResourcePayload): string[] {
  const values = Object.entries(payload.textures)
    .filter(([key]) => key !== 'mode')
    .map(([, value]) => value)
    .filter((value): value is string => typeof value === 'string' && Boolean(value))
  return [...new Set(values)]
}

function materialKey(material: StudioMaterial): string {
  return safeName(material.identifier)
}

function makeMaterialInstances(
  payload: BlockResourcePayload,
  materialsById: Map<string, StudioMaterial>,
): Record<string, { texture: string; render_method: string }> {
  const renderMethod = payload.customModel?.renderMethod ?? (
    payload.transparency === 'cutout' ? 'alpha_test' : payload.transparency === 'blend' ? 'blend' : 'opaque'
  )
  const instance = (materialId?: string) => {
    const material = materialId ? materialsById.get(materialId) : undefined
    return material ? { texture: materialKey(material), render_method: renderMethod } : undefined
  }
  if (payload.textures.mode === 'all') {
    const all = instance(payload.textures.all)
    return all ? { '*': all } : {}
  }
  if (payload.textures.mode === 'top_side_bottom') {
    const side = instance(payload.textures.side)
    const top = instance(payload.textures.top)
    const bottom = instance(payload.textures.bottom)
    return Object.fromEntries([
      side && ['*', side],
      top && ['up', top],
      bottom && ['down', bottom],
    ].filter(Boolean) as [string, { texture: string; render_method: string }][])
  }
  return Object.fromEntries((['north', 'south', 'east', 'west', 'up', 'down'] as const)
    .flatMap((face) => {
      const value = instance(payload.textures[face])
      return value ? [[face, value] as const] : []
    }))
}

export async function generateBlockPackage(input: BlockPackageInput): Promise<GeneratedBlockPackage> {
  const { project, block } = input
  if (!block.identifier || !/^[a-z0-9_]+:[a-z0-9_]+$/.test(block.identifier)) {
    throw new Error('The block identifier is invalid.')
  }
  const payload = block.payload
  const warnings: string[] = []
  const entries: Record<string, Uint8Array> = {}
  const shortName = block.identifier.split(':')[1]!
  const materialsById = new Map(input.materials.map((material) => [material.id, material]))
  const assetsById = new Map(input.textureAssets.map((asset) => [asset.id, asset]))
  const materialInstances = makeMaterialInstances(payload, materialsById)

  if (!Object.keys(materialInstances).length) warnings.push('No texture material is assigned yet.')
  if (payload.light.vibrantColorEnabled) warnings.push('The selected Vibrant Visuals color is preserved in Addons Studio but is not emitted as an unsupported block JSON field.')
  if (payload.pluginIds.length) warnings.push('Plugin links are preserved but Plugin code generation is not enabled in this Rework build.')
  if (payload.recipe.enabled && !payload.recipe.linkedRecipeId) warnings.push('Recipe is enabled, but no central recipe is linked yet.')

  const components: Record<string, unknown> = {
    'minecraft:display_name': `tile.${block.identifier}.name`,
    'minecraft:destructible_by_mining': { seconds_to_destroy: Math.max(0, payload.destroyTime) },
    'minecraft:destructible_by_explosion': { explosion_resistance: Math.max(0, payload.explosionResistance) },
    'minecraft:friction': Math.max(0, Math.min(0.9, payload.friction)),
    'minecraft:map_color': payload.mapColor,
    'minecraft:light_dampening': payload.blocksLight ? 15 : 0,
    'minecraft:collision_box': payload.collision === 'none' ? false : true,
    'minecraft:selection_box': payload.selectionBox === 'none' ? false : true,
  }
  if (Object.keys(materialInstances).length) components['minecraft:material_instances'] = materialInstances
  if (payload.light.enabled) components['minecraft:light_emission'] = Math.max(0, Math.min(15, Math.round(payload.light.level)))
  if (payload.flammable) components['minecraft:flammable'] = { catch_chance_modifier: 30, destroy_chance_modifier: 10 }
  if (payload.dropIdentifier) {
    components['minecraft:loot'] = `loot_tables/blocks/${shortName}.json`
    entries[`behavior_pack/loot_tables/blocks/${shortName}.json`] = text({
      pools: [{ rolls: 1, entries: [{ type: 'item', name: payload.dropIdentifier, weight: 1 }] }],
    })
  }
  if (block.type === 'block_model' && input.model?.identifier) {
    components['minecraft:geometry'] = input.model.identifier
    if (input.modelAsset) {
      entries[`resource_pack/models/blocks/${safeName(input.model.name)}.geo.json`] = await blobBytes(input.modelAsset)
    } else {
      warnings.push('The selected custom model file could not be included.')
    }
  }

  entries[`behavior_pack/blocks/${shortName}.json`] = text({
    format_version: project.targetVersion,
    'minecraft:block': {
      description: {
        identifier: block.identifier,
        ...(payload.creativeCategory === 'none'
          ? {}
          : { menu_category: { category: payload.creativeCategory } }),
      },
      components,
    },
  })

  const terrainData: Record<string, { textures: string }> = {}
  for (const materialId of assignedMaterialIds(payload)) {
    const material = materialsById.get(materialId)
    const asset = material?.textureAssetId ? assetsById.get(material.textureAssetId) : undefined
    if (!material || !asset) {
      warnings.push(`Material ${material?.name ?? materialId} does not have an image.`)
      continue
    }
    const key = materialKey(material)
    const extension = asset.mimeType === 'image/png' ? 'png' : 'jpg'
    const path = `textures/blocks/${key}`
    terrainData[key] = { textures: path }
    entries[`resource_pack/${path}.${extension}`] = await blobBytes(asset.blob)
  }
  entries['resource_pack/textures/terrain_texture.json'] = text({
    resource_pack_name: `${project.namespace}_resources`,
    texture_name: 'atlas.terrain',
    texture_data: terrainData,
  })

  const translations = payload.translations.length
    ? payload.translations
    : [{ locale: 'en', name: payload.displayName }]
  const languageCodes = [...new Set(translations.map((translation) => LANGUAGE_CODES[translation.locale] ?? translation.locale.replace('-', '_')))]
  entries['resource_pack/texts/languages.json'] = text(languageCodes)
  for (const code of languageCodes) {
    const translation = translations.find((entry) => (LANGUAGE_CODES[entry.locale] ?? entry.locale.replace('-', '_')) === code)
    const color = NAME_COLORS[payload.nameColor.toLowerCase()] ?? 'f'
    entries[`resource_pack/texts/${code}.lang`] = text(`tile.${block.identifier}.name=§${color}${translation?.name || payload.displayName}\n`)
  }

  entries['addons-studio-resource.json'] = text({
    format: 'addons-studio-resource',
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    project: { name: project.name, namespace: project.namespace, targetVersion: project.targetVersion },
    resource: block,
    warnings,
  })

  const data = await zipAsync(entries)
  return {
    blob: new Blob([data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer], { type: 'application/zip' }),
    filename: `${safeName(block.name)}_bedrock_files.zip`,
    warnings,
    files: Object.keys(entries).sort(),
  }
}
