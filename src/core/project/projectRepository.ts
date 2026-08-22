import { AppError } from '@/core/errors/AppError'
import {
  cloneStudioCube,
  cloneStudioGroup,
  cloneStudioModelFolder,
  cloneStudioModel,
  cloneStudioReference,
  MODEL_SCHEMA_VERSION,
} from '@/core/model/modelFactory'
import {
  DEFAULT_PROJECT_ICON,
  MAX_RECOVERY_SNAPSHOTS,
  PROJECT_SCHEMA_VERSION,
} from '@/core/project/constants'
import { validateProjectInput, validateStoredProject } from '@/core/project/projectValidation'
import { remapResourcePayload } from '@/core/resources/resourceReferences'
import { type AddonsStudioDatabase, studioDatabase } from '@/core/storage/database'
import { assertSupportedProjectSchema } from '@/core/validation/projectSchema'
import type {
  CreateProjectInput,
  ProjectSnapshot,
  ProjectUpdate,
  StorageSummary,
  StudioProject,
} from '@/types/project'
import { createId } from '@/utils/createId'

function cloneProject(project: StudioProject): StudioProject {
  return {
    ...project,
    icon: { ...project.icon },
  }
}

export class ProjectRepository {
  constructor(private readonly database: AddonsStudioDatabase = studioDatabase) {}

  async createProject(input: CreateProjectInput): Promise<StudioProject> {
    const issues = validateProjectInput(input)
    if (issues[0]) throw new AppError('PROJECT_VALIDATION', issues[0].message)

    const now = Date.now()
    const project: StudioProject = {
      id: createId(),
      name: input.name.trim(),
      namespace: input.namespace.trim(),
      description: input.description?.trim() || undefined,
      icon: input.icon ? { ...input.icon } : { kind: 'builtin', value: DEFAULT_PROJECT_ICON },
      projectType: input.projectType,
      targetVersion: input.targetVersion,
      experimentalFeatures: input.experimentalFeatures,
      createdAt: now,
      updatedAt: now,
      schemaVersion: PROJECT_SCHEMA_VERSION,
      revision: 1,
      folderId: input.folderId,
    }

    try {
      await this.database.transaction(
        'rw',
        [this.database.projects, this.database.snapshots],
        async () => {
          await this.database.projects.add(project)
          await this.addSnapshot(project, 'created')
        },
      )
      return cloneProject(project)
    } catch (error) {
      if (error instanceof AppError) throw error
      throw new AppError(
        'PROJECT_SAVE_FAILED',
        'Addons Studio could not create this project. No existing projects were changed.',
        { cause: error },
      )
    }
  }

  async listProjects(): Promise<StudioProject[]> {
    const projects = await this.database.projects.orderBy('updatedAt').reverse().toArray()
    return projects.map((project) => {
      assertSupportedProjectSchema(project)
      return cloneProject(project)
    })
  }

  async getProject(id: string): Promise<StudioProject | undefined> {
    const project = await this.database.projects.get(id)
    if (!project) return undefined
    assertSupportedProjectSchema(project)
    return cloneProject(project)
  }

  async updateProject(id: string, changes: ProjectUpdate): Promise<StudioProject> {
    try {
      const existing = await this.database.projects.get(id)
      if (!existing) {
        throw new AppError('PROJECT_NOT_FOUND', 'This project is no longer available on this device.')
      }

      const updated: StudioProject = {
        ...existing,
        ...changes,
        id: existing.id,
        createdAt: existing.createdAt,
        schemaVersion: existing.schemaVersion,
        name: changes.name?.trim() ?? existing.name,
        namespace: changes.namespace?.trim() ?? existing.namespace,
        updatedAt: Date.now(),
        revision: existing.revision + 1,
      }

      if ('description' in changes) updated.description = changes.description?.trim() || undefined
      if (changes.icon) updated.icon = { ...changes.icon }

      const issues = validateStoredProject(updated)
      if (issues[0]) throw new AppError('PROJECT_VALIDATION', issues[0].message)

      await this.database.projects.put(updated)
      return cloneProject(updated)
    } catch (error) {
      if (error instanceof AppError) throw error
      throw new AppError(
        'PROJECT_SAVE_FAILED',
        'Addons Studio could not save this project. Your latest changes are still open. Try again.',
        { cause: error },
      )
    }
  }

  async duplicateProject(id: string): Promise<StudioProject> {
    const source = await this.getProject(id)
    if (!source) {
      throw new AppError('PROJECT_NOT_FOUND', 'This project is no longer available on this device.')
    }

    const namespace = await this.findAvailableNamespace(`${source.namespace}_copy`)
    const nameSuffix = ' Copy'
    const name = `${source.name.slice(0, 80 - nameSuffix.length)}${nameSuffix}`
    const now = Date.now()
    const duplicate: StudioProject = {
      ...cloneProject(source),
      id: createId(),
      name,
      namespace,
      createdAt: now,
      updatedAt: now,
      revision: 1,
    }

    try {
      const [
        sourceModels,
        currentAssets,
        legacyAssets,
        sourceTextureAssets,
        sourceMaterials,
        sourceBindings,
        sourceResources,
        sourceResourceFolders,
        sourceResourceAssets,
      ] = await Promise.all([
        this.database.models.where('projectId').equals(source.id).toArray(),
        this.database.modelEditorAssets.where('projectId').equals(source.id).toArray(),
        this.database.modelReferenceAssets.where('projectId').equals(source.id).toArray(),
        this.database.textureAssets.where('projectId').equals(source.id).toArray(),
        this.database.materials.where('projectId').equals(source.id).toArray(),
        this.database.textureBindings.where('projectId').equals(source.id).toArray(),
        this.database.resources.where('projectId').equals(source.id).toArray(),
        this.database.resourceFolders.where('projectId').equals(source.id).toArray(),
        this.database.resourceAssets.where('projectId').equals(source.id).toArray(),
      ])
      const sourceAssets = [...new Map(
        [...legacyAssets, ...currentAssets].map((asset) => [asset.id, asset]),
      ).values()]
      const modelIds = new Map(sourceModels.map((model) => [model.id, createId()]))
      const assetIds = new Map(sourceAssets.map((asset) => [asset.id, createId()]))
      const textureAssetIds = new Map(sourceTextureAssets.map((asset) => [asset.id, createId()]))
      const materialIds = new Map(sourceMaterials.map((material) => [material.id, createId()]))
      const resourceIds = new Map(sourceResources.map((resource) => [resource.id, createId()]))
      const resourceFolderIds = new Map(sourceResourceFolders.map((folder) => [folder.id, createId()]))
      const resourceAssetIds = new Map(sourceResourceAssets.map((asset) => [asset.id, createId()]))
      const nodeMaps = new Map(sourceModels.map((model) => {
        const normalized = cloneStudioModel(model)
        return [model.id, {
          elementIds: new Map(normalized.elements.map((element) => [element.id, createId()])),
          groupIds: new Map(normalized.groups.map((group) => [group.id, createId()])),
          folderIds: new Map(normalized.folders.map((folder) => [folder.id, createId()])),
        }]
      }))

      const duplicatedModels = sourceModels.map((model) => {
        const normalized = cloneStudioModel(model)
        const { elementIds, groupIds, folderIds } = nodeMaps.get(model.id)!
        return {
          ...normalized,
          id: modelIds.get(model.id)!,
          projectId: duplicate.id,
          elements: normalized.elements.map((element) => ({
            ...cloneStudioCube(element),
            id: elementIds.get(element.id)!,
            parentId: element.parentId ? groupIds.get(element.parentId) : undefined,
            folderId: element.folderId ? folderIds.get(element.folderId) : undefined,
          })),
          groups: normalized.groups.map((group) => ({
            ...cloneStudioGroup(group),
            id: groupIds.get(group.id)!,
            parentId: group.parentId ? groupIds.get(group.parentId) : undefined,
            folderId: group.folderId ? folderIds.get(group.folderId) : undefined,
          })),
          folders: normalized.folders.map((folder) => ({
            ...cloneStudioModelFolder(folder),
            id: folderIds.get(folder.id)!,
            parentId: folder.parentId ? folderIds.get(folder.parentId) : undefined,
          })),
          references: normalized.references
            .filter((reference) => assetIds.has(reference.assetId))
            .map((reference) => ({
              ...cloneStudioReference(reference),
              id: createId(),
              assetId: assetIds.get(reference.assetId)!,
            })),
          editor: {
            ...normalized.editor,
            background: {
              ...normalized.editor.background,
              customAssetId: normalized.editor.background.customAssetId
                ? assetIds.get(normalized.editor.background.customAssetId)
                : undefined,
              type: normalized.editor.background.type === 'custom'
                && !assetIds.has(normalized.editor.background.customAssetId ?? '')
                ? 'dark-studio' as const
                : normalized.editor.background.type,
            },
          },
          createdAt: now,
          updatedAt: now,
          schemaVersion: MODEL_SCHEMA_VERSION,
          revision: 1,
        }
      })
      const duplicatedAssets = sourceAssets.flatMap((asset) => {
        const modelId = modelIds.get(asset.modelId)
        if (!modelId) return []
        return [{
          ...asset,
          id: assetIds.get(asset.id)!,
          modelId,
          projectId: duplicate.id,
          kind: asset.kind ?? 'reference',
          width: Number.isFinite(asset.width) ? asset.width : 0,
          height: Number.isFinite(asset.height) ? asset.height : 0,
          createdAt: now,
        }]
      })
      const duplicatedTextureAssets = sourceTextureAssets.map((asset) => ({
        ...asset,
        id: textureAssetIds.get(asset.id)!,
        projectId: duplicate.id,
        // Blob data is immutable and IndexedDB performs its own structured clone.
        // Keeping the value intact also handles Safari/fake-indexeddb implementations
        // that restore a valid stored binary value without exposing Blob#slice.
        blob: asset.blob,
        createdAt: now,
        updatedAt: now,
      }))
      const duplicatedMaterials = sourceMaterials.map((material) => ({
        ...material,
        id: materialIds.get(material.id)!,
        projectId: duplicate.id,
        textureAssetId: material.textureAssetId
          ? textureAssetIds.get(material.textureAssetId)
          : undefined,
        folderId: material.folderId ? resourceFolderIds.get(material.folderId) : undefined,
        createdAt: now,
        updatedAt: now,
        revision: 1,
      }))
      const duplicatedResourceFolders = sourceResourceFolders.map((folder) => ({
        ...folder,
        id: resourceFolderIds.get(folder.id)!,
        projectId: duplicate.id,
        parentId: folder.parentId ? resourceFolderIds.get(folder.parentId) : undefined,
        createdAt: now,
        updatedAt: now,
      }))
      const duplicatedResources = sourceResources.map((resource) => {
        return {
          ...resource,
          id: resourceIds.get(resource.id)!,
          projectId: duplicate.id,
          folderId: resource.folderId ? resourceFolderIds.get(resource.folderId) : undefined,
          payload: remapResourcePayload(resource, {
            resourceIds,
            resourceAssetIds,
            materialIds,
          }),
          createdAt: now,
          updatedAt: now,
          revision: 1,
        }
      })
      const duplicatedResourceAssets = sourceResourceAssets.map((asset) => ({
        ...asset,
        id: resourceAssetIds.get(asset.id)!,
        projectId: duplicate.id,
        resourceId: asset.resourceId ? resourceIds.get(asset.resourceId) : undefined,
        blob: asset.blob,
        createdAt: now,
        updatedAt: now,
      }))
      const duplicatedBindings = sourceBindings.flatMap((binding) => {
        const modelId = modelIds.get(binding.modelId)
        const cubeId = nodeMaps.get(binding.modelId)?.elementIds.get(binding.cubeId)
        const materialId = materialIds.get(binding.materialId)
        if (!modelId || !cubeId || !materialId) return []
        return [{
          ...binding,
          id: createId(),
          projectId: duplicate.id,
          modelId,
          cubeId,
          materialId,
          uv: { ...binding.uv },
          updatedAt: now,
        }]
      })

      await this.database.transaction(
        'rw',
        [
          this.database.projects,
          this.database.snapshots,
          this.database.models,
          this.database.modelReferenceAssets,
          this.database.modelEditorAssets,
          this.database.textureAssets,
          this.database.materials,
          this.database.textureBindings,
          this.database.resources,
          this.database.resourceFolders,
          this.database.resourceAssets,
        ],
        async () => {
          await this.database.projects.add(duplicate)
          await this.addSnapshot(duplicate, 'created')
          if (duplicatedModels.length) await this.database.models.bulkAdd(duplicatedModels)
          if (duplicatedAssets.length) {
            await this.database.modelEditorAssets.bulkAdd(duplicatedAssets)
          }
          if (duplicatedTextureAssets.length) {
            await this.database.textureAssets.bulkAdd(duplicatedTextureAssets)
          }
          if (duplicatedMaterials.length) await this.database.materials.bulkAdd(duplicatedMaterials)
          if (duplicatedBindings.length) {
            await this.database.textureBindings.bulkAdd(duplicatedBindings)
          }
          if (duplicatedResourceFolders.length) {
            await this.database.resourceFolders.bulkAdd(duplicatedResourceFolders)
          }
          if (duplicatedResources.length) await this.database.resources.bulkAdd(duplicatedResources)
          if (duplicatedResourceAssets.length) {
            await this.database.resourceAssets.bulkAdd(duplicatedResourceAssets)
          }
        },
      )
      return cloneProject(duplicate)
    } catch (error) {
      throw new AppError(
        'PROJECT_SAVE_FAILED',
        'Addons Studio could not duplicate this project. No partial copy was kept.',
        { cause: error },
      )
    }
  }

  async deleteProject(id: string): Promise<void> {
    try {
      await this.database.transaction(
        'rw',
        [
          this.database.projects,
          this.database.snapshots,
          this.database.models,
          this.database.modelReferenceAssets,
          this.database.modelEditorAssets,
          this.database.textureAssets,
          this.database.materials,
          this.database.textureBindings,
          this.database.resources,
          this.database.resourceFolders,
          this.database.resourceAssets,
        ],
        async () => {
          await this.database.projects.delete(id)
          await this.database.snapshots.where('projectId').equals(id).delete()
          await this.database.models.where('projectId').equals(id).delete()
          await this.database.modelReferenceAssets.where('projectId').equals(id).delete()
          await this.database.modelEditorAssets.where('projectId').equals(id).delete()
          await this.database.textureAssets.where('projectId').equals(id).delete()
          await this.database.materials.where('projectId').equals(id).delete()
          await this.database.textureBindings.where('projectId').equals(id).delete()
          await this.database.resources.where('projectId').equals(id).delete()
          await this.database.resourceFolders.where('projectId').equals(id).delete()
          await this.database.resourceAssets.where('projectId').equals(id).delete()
        },
      )
    } catch (error) {
      throw new AppError(
        'PROJECT_DELETE_FAILED',
        'Addons Studio could not delete this project. Nothing was removed.',
        { cause: error },
      )
    }
  }

  async createRecoverySnapshot(
    projectId: string,
    reason: ProjectSnapshot['reason'] = 'recovery',
  ): Promise<ProjectSnapshot | undefined> {
    const project = await this.database.projects.get(projectId)
    if (!project) return undefined

    return this.database.transaction(
      'rw',
      this.database.snapshots,
      async () => {
        const snapshot = await this.addSnapshot(project, reason)
        await this.pruneSnapshots(projectId)
        return snapshot
      },
    )
  }

  async listSnapshots(projectId: string): Promise<ProjectSnapshot[]> {
    return this.database.snapshots.where('projectId').equals(projectId).reverse().sortBy('createdAt')
  }

  async getStorageSummary(): Promise<StorageSummary> {
    const projectCount = await this.database.projects.count()

    try {
      const estimate = await globalThis.navigator?.storage?.estimate()
      return {
        projectCount,
        usageBytes: estimate?.usage,
        quotaBytes: estimate?.quota,
      }
    } catch {
      return { projectCount }
    }
  }

  async clearTemporaryCache(): Promise<number> {
    if (!('caches' in globalThis)) return 0

    const keys = await globalThis.caches.keys()
    const appKeys = keys.filter((key) => key.includes('addons-studio'))
    const results = await Promise.all(appKeys.map((key) => globalThis.caches.delete(key)))
    return results.filter(Boolean).length
  }

  private async findAvailableNamespace(base: string): Promise<string> {
    let candidate = base.slice(0, 64)
    let suffix = 2

    while ((await this.database.projects.where('namespace').equals(candidate).count()) > 0) {
      const marker = `_${suffix}`
      candidate = `${base.slice(0, 64 - marker.length)}${marker}`
      suffix += 1
    }

    return candidate
  }

  private async addSnapshot(
    project: StudioProject,
    reason: ProjectSnapshot['reason'],
  ): Promise<ProjectSnapshot> {
    const snapshot: ProjectSnapshot = {
      id: createId(),
      projectId: project.id,
      createdAt: Date.now(),
      reason,
      project: cloneProject(project),
    }
    await this.database.snapshots.add(snapshot)
    return snapshot
  }

  private async pruneSnapshots(projectId: string): Promise<void> {
    const snapshots = await this.database.snapshots
      .where('projectId')
      .equals(projectId)
      .sortBy('createdAt')
    const surplus = snapshots.slice(0, Math.max(0, snapshots.length - MAX_RECOVERY_SNAPSHOTS))
    await this.database.snapshots.bulkDelete(surplus.map((snapshot) => snapshot.id))
  }
}

export const projectRepository = new ProjectRepository()
