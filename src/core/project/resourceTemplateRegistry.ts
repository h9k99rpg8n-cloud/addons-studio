import type { ResourceTemplate } from '@/types/project'

export class ResourceTemplateRegistry {
  private readonly templates = new Map<string, ResourceTemplate>()

  register(template: ResourceTemplate): void {
    if (this.templates.has(template.id)) {
      throw new Error(`Resource template “${template.id}” is already registered.`)
    }

    this.templates.set(template.id, Object.freeze({ ...template }))
  }

  registerMany(templates: readonly ResourceTemplate[]): void {
    for (const template of templates) this.register(template)
  }

  get(id: string): ResourceTemplate | undefined {
    return this.templates.get(id)
  }

  list(targetVersion?: string): ResourceTemplate[] {
    return Array.from(this.templates.values()).filter(
      (template) =>
        !targetVersion ||
        !template.supportedVersions ||
        template.supportedVersions.includes(targetVersion),
    )
  }

  clear(): void {
    this.templates.clear()
  }
}

export const INITIAL_RESOURCE_TEMPLATES: readonly ResourceTemplate[] = [
  {
    id: 'block',
    category: 'blocks',
    group: 'gameplay',
    name: 'Block',
    icon: 'block',
    tone: 'brand',
    description: 'Guided block creation will arrive in a future update.',
    status: 'coming_soon',
  },
  {
    id: 'item',
    category: 'items',
    group: 'gameplay',
    name: 'Item',
    icon: 'item',
    tone: 'gold',
    description: 'Item creation is not available in this foundation release.',
    status: 'coming_soon',
  },
  {
    id: 'entity',
    category: 'entities',
    group: 'gameplay',
    name: 'Entity',
    icon: 'entity',
    tone: 'orange',
    description: 'Entity workflows are coming in a future update.',
    status: 'coming_soon',
  },
  {
    id: 'recipe',
    category: 'recipes',
    group: 'gameplay',
    name: 'Recipe',
    icon: 'recipe',
    tone: 'orange',
    description: 'Recipe editing is coming in a future update.',
    status: 'coming_soon',
  },
  {
    id: 'model',
    category: 'models',
    group: 'resources',
    name: 'Model',
    icon: 'model',
    tone: 'sky',
    description: 'Create a cube-based model in Model Studio.',
    status: 'available',
  },
  {
    id: 'material',
    category: 'materials',
    group: 'resources',
    name: 'Material',
    icon: 'material',
    tone: 'gold',
    description: 'Create a Texture Core material and attach a PNG or JPEG texture.',
    status: 'available',
  },
  {
    id: 'texture',
    category: 'textures',
    group: 'resources',
    name: 'Texture Core',
    icon: 'layers',
    tone: 'brand',
    description: 'Texture a Model Core resource with UV bindings and pixel tools.',
    status: 'available',
  },
  {
    id: 'animation',
    category: 'animations',
    group: 'resources',
    name: 'Animation',
    icon: 'animation',
    tone: 'violet',
    description: 'Animation tools are coming in a future update.',
    status: 'coming_soon',
  },
  {
    id: 'particle',
    category: 'particles',
    group: 'resources',
    name: 'Particle',
    icon: 'particle',
    tone: 'rose',
    description: 'Particle tools are coming in a future update.',
    status: 'coming_soon',
  },
  {
    id: 'audio',
    category: 'audio',
    group: 'resources',
    name: 'Audio',
    icon: 'audio',
    tone: 'cyan',
    description: 'Audio tools are coming in a future update.',
    status: 'coming_soon',
  },
  {
    id: 'function',
    category: 'functions',
    group: 'logic',
    name: 'Function',
    icon: 'function',
    tone: 'sky',
    description: 'Function editing is coming in a future update.',
    status: 'coming_soon',
  },
  {
    id: 'script',
    category: 'scripts',
    group: 'logic',
    name: 'Script',
    icon: 'script',
    tone: 'violet',
    description: 'Script editing is coming in a future update.',
    status: 'coming_soon',
  },
] as const

export const resourceTemplateRegistry = new ResourceTemplateRegistry()
resourceTemplateRegistry.registerMany(INITIAL_RESOURCE_TEMPLATES)
