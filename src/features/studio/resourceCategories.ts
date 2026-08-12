import type { StudioIconName, StudioIconTone } from '@/core/icons/studioIcons'
import type { ResourceCategoryId } from '@/types/project'

export interface ResourceCategoryDefinition {
  id: ResourceCategoryId
  label: string
  description: string
  icon: StudioIconName
  tone: StudioIconTone
}

export const RESOURCE_CATEGORIES: readonly ResourceCategoryDefinition[] = [
  { id: 'blocks', label: 'Blocks', description: 'Custom Bedrock blocks', icon: 'block', tone: 'brand' },
  { id: 'items', label: 'Items', description: 'Tools, food, and objects', icon: 'item', tone: 'gold' },
  { id: 'entities', label: 'Entities', description: 'Mobs and custom actors', icon: 'entity', tone: 'orange' },
  { id: 'models', label: 'Models', description: 'Geometry and bones', icon: 'model', tone: 'sky' },
  {
    id: 'materials',
    label: 'Materials',
    description: 'Texture, UV, and rendering',
    icon: 'material',
    tone: 'gold',
  },
  { id: 'animations', label: 'Animations', description: 'Motion and timelines', icon: 'animation', tone: 'violet' },
  { id: 'particles', label: 'Particles', description: 'Visual effects', icon: 'particle', tone: 'rose' },
  { id: 'audio', label: 'Audio', description: 'Sounds and music', icon: 'audio', tone: 'cyan' },
  { id: 'recipes', label: 'Recipes', description: 'Crafting definitions', icon: 'recipe', tone: 'orange' },
  { id: 'functions', label: 'Functions', description: 'Command functions', icon: 'function', tone: 'sky' },
  { id: 'scripts', label: 'Scripts', description: 'Script API source', icon: 'script', tone: 'violet' },
  { id: 'languages', label: 'Languages', description: 'Names and localization', icon: 'language', tone: 'cyan' },
] as const
