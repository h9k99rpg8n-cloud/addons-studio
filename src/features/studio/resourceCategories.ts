import type { ResourceCategoryId } from '@/types/project'

export interface ResourceCategoryDefinition {
  id: ResourceCategoryId
  label: string
  description: string
  icon: string
}

export const RESOURCE_CATEGORIES: readonly ResourceCategoryDefinition[] = [
  { id: 'blocks', label: 'Blocks', description: 'Custom Bedrock blocks', icon: 'blocks' },
  { id: 'items', label: 'Items', description: 'Tools, food, and objects', icon: 'gem' },
  { id: 'entities', label: 'Entities', description: 'Mobs and custom actors', icon: 'rabbit' },
  { id: 'models', label: 'Models', description: 'Geometry and bones', icon: 'boxes' },
  {
    id: 'materials',
    label: 'Materials',
    description: 'Texture, UV, and rendering',
    icon: 'circle-dot',
  },
  { id: 'animations', label: 'Animations', description: 'Motion and timelines', icon: 'activity' },
  { id: 'particles', label: 'Particles', description: 'Visual effects', icon: 'sparkles' },
  { id: 'audio', label: 'Audio', description: 'Sounds and music', icon: 'audio-lines' },
  { id: 'recipes', label: 'Recipes', description: 'Crafting definitions', icon: 'cooking-pot' },
  { id: 'functions', label: 'Functions', description: 'Command functions', icon: 'terminal' },
  { id: 'scripts', label: 'Scripts', description: 'Script API source', icon: 'braces' },
  { id: 'languages', label: 'Languages', description: 'Names and localization', icon: 'languages' },
] as const
