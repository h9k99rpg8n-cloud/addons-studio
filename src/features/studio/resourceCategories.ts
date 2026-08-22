import type { StudioIconName, StudioIconTone } from '@/core/icons/studioIcons'
import type { ResourceCategoryId } from '@/types/project'

export interface ResourceCategoryDefinition {
  id: ResourceCategoryId
  label: string
  description: string
  icon: StudioIconName
  tone: StudioIconTone
  status: 'available' | 'coming_soon'
}

export const RESOURCE_CATEGORIES: readonly ResourceCategoryDefinition[] = [
  { id: 'blocks', label: 'Blocks', description: 'Guided Bedrock blocks', icon: 'block', tone: 'brand', status: 'available' },
  { id: 'items', label: 'Items', description: 'Tools, food, and objects', icon: 'item', tone: 'gold', status: 'coming_soon' },
  { id: 'entities', label: 'Entities', description: 'Mobs and custom actors', icon: 'entity', tone: 'orange', status: 'coming_soon' },
  { id: 'models', label: 'Models', description: 'Blockbench model library', icon: 'model', tone: 'sky', status: 'available' },
  {
    id: 'materials',
    label: 'Materials',
    description: 'Import and organize reusable images',
    icon: 'material',
    tone: 'gold',
    status: 'available',
  },
  { id: 'animations', label: 'Animations', description: 'Motion and timelines', icon: 'animation', tone: 'violet', status: 'coming_soon' },
  { id: 'particles', label: 'Particles', description: 'Visual effects', icon: 'particle', tone: 'rose', status: 'coming_soon' },
  { id: 'audio', label: 'Audio', description: 'Sounds and music', icon: 'audio', tone: 'cyan', status: 'coming_soon' },
  { id: 'recipes', label: 'Recipes', description: 'Crafting definitions', icon: 'recipe', tone: 'orange', status: 'coming_soon' },
  { id: 'functions', label: 'Functions', description: 'Command functions', icon: 'function', tone: 'sky', status: 'coming_soon' },
  { id: 'scripts', label: 'Scripts', description: 'Script API source', icon: 'script', tone: 'violet', status: 'coming_soon' },
  { id: 'languages', label: 'Languages', description: 'Names and localization', icon: 'language', tone: 'cyan', status: 'coming_soon' },
] as const
