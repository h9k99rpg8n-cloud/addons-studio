import { AppError } from '@/core/errors/AppError'
import { type AddonsStudioDatabase, studioDatabase } from '@/core/storage/database'
import {
  RESOURCE_SCHEMA_VERSION,
  type StudioResource,
  type StudioResourceAsset,
  type StudioResourceFolder,
  type StudioResourceType,
} from '@/types/resource'
import { createId } from '@/utils/createId'

function cloneResource<T>(resource: StudioResource<T>): StudioResource<T> {
  return structuredClone(resource)
}

function cleanName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, 80)
}

export class ResourceRepository {
  constructor(private readonly database: AddonsStudioDatabase = studioDatabase) {}

  async list<T = unknown>(projectId: string, type?: StudioResourceType): Promise<StudioResource<T>[]> {
    const records = type
      ? await this.database.resources.where('[projectId+type]').equals([projectId, type]).toArray()
      : await this.database.resources.where('projectId').equals(projectId).toArray()
    return records.sort((a, b) => b.updatedAt - a.updatedAt).map((record) => cloneResource(record as StudioResource<T>))
  }

  async get<T = unknown>(id: string): Promise<StudioResource<T> | undefined> {
    const resource = await this.database.resources.get(id)
    return resource ? cloneResource(resource as StudioResource<T>) : undefined
  }

  async count(projectId: string, type?: StudioResourceType): Promise<number> {
    return type
      ? this.database.resources.where('[projectId+type]').equals([projectId, type]).count()
      : this.database.resources.where('projectId').equals(projectId).count()
  }

  async create<T>(input: {
    projectId: string
    type: StudioResourceType
    name: string
    identifier?: string
    folderId?: string
    payload: T
  }): Promise<StudioResource<T>> {
    const name = cleanName(input.name)
    if (!name) throw new AppError('RESOURCE_INVALID', 'Give this resource a name before saving it.')
    if (!(await this.database.projects.get(input.projectId))) {
      throw new AppError('PROJECT_NOT_FOUND', 'This project is no longer available on this device.')
    }
    if (input.folderId) await this.assertFolder(input.projectId, input.type, input.folderId)
    const now = Date.now()
    const resource: StudioResource<T> = {
      id: createId(),
      projectId: input.projectId,
      type: input.type,
      name,
      identifier: input.identifier?.trim() || undefined,
      folderId: input.folderId,
      payload: structuredClone(input.payload),
      createdAt: now,
      updatedAt: now,
      schemaVersion: RESOURCE_SCHEMA_VERSION,
      revision: 1,
    }
    try {
      await this.database.transaction('rw', [this.database.resources, this.database.projects], async () => {
        await this.database.resources.add(resource as StudioResource)
        await this.database.projects.update(input.projectId, { updatedAt: now })
      })
      return cloneResource(resource)
    } catch (error) {
      throw new AppError('RESOURCE_SAVE_FAILED', 'Addons Studio could not save this resource.', { cause: error })
    }
  }

  async update<T>(id: string, changes: Partial<Pick<StudioResource<T>, 'name' | 'identifier' | 'folderId' | 'payload'>>): Promise<StudioResource<T>> {
    const current = await this.get<T>(id)
    if (!current) throw new AppError('RESOURCE_NOT_FOUND', 'This resource is no longer available.')
    if (changes.folderId) await this.assertFolder(current.projectId, current.type, changes.folderId)
    const name = changes.name === undefined ? current.name : cleanName(changes.name)
    if (!name) throw new AppError('RESOURCE_INVALID', 'Give this resource a name before saving it.')
    const updated: StudioResource<T> = {
      ...current,
      ...changes,
      name,
      identifier: changes.identifier === undefined ? current.identifier : changes.identifier.trim() || undefined,
      payload: changes.payload === undefined ? current.payload : structuredClone(changes.payload),
      updatedAt: Date.now(),
      revision: current.revision + 1,
    }
    try {
      await this.database.transaction('rw', [this.database.resources, this.database.projects], async () => {
        await this.database.resources.put(updated as StudioResource)
        await this.database.projects.update(current.projectId, { updatedAt: updated.updatedAt })
      })
      return cloneResource(updated)
    } catch (error) {
      throw new AppError('RESOURCE_SAVE_FAILED', 'Addons Studio could not save this resource.', { cause: error })
    }
  }

  async delete(id: string): Promise<void> {
    const resource = await this.database.resources.get(id)
    if (!resource) return
    try {
      await this.database.transaction('rw', [this.database.resources, this.database.resourceAssets], async () => {
        await this.database.resources.delete(id)
        await this.database.resourceAssets.where('resourceId').equals(id).delete()
      })
    } catch (error) {
      throw new AppError('RESOURCE_DELETE_FAILED', 'Addons Studio could not delete this resource.', { cause: error })
    }
  }

  async listFolders(projectId: string, resourceType: StudioResourceFolder['resourceType']): Promise<StudioResourceFolder[]> {
    return this.database.resourceFolders
      .where('[projectId+resourceType]')
      .equals([projectId, resourceType])
      .sortBy('name')
  }

  async createFolder(input: { projectId: string; resourceType: StudioResourceFolder['resourceType']; name: string; parentId?: string }): Promise<StudioResourceFolder> {
    const name = cleanName(input.name)
    if (!name) throw new AppError('RESOURCE_INVALID', 'Give this folder a name.')
    if (input.parentId) {
      const parent = await this.database.resourceFolders.get(input.parentId)
      if (!parent || parent.projectId !== input.projectId || parent.resourceType !== input.resourceType || parent.parentId) {
        throw new AppError('RESOURCE_INVALID', 'Only one folder level is supported here.')
      }
    }
    const now = Date.now()
    const folder: StudioResourceFolder = {
      id: createId(),
      projectId: input.projectId,
      resourceType: input.resourceType,
      name,
      parentId: input.parentId,
      createdAt: now,
      updatedAt: now,
      schemaVersion: RESOURCE_SCHEMA_VERSION,
    }
    await this.database.resourceFolders.add(folder)
    return { ...folder }
  }

  async renameFolder(id: string, name: string): Promise<StudioResourceFolder> {
    const folder = await this.database.resourceFolders.get(id)
    const cleaned = cleanName(name)
    if (!folder || !cleaned) throw new AppError('RESOURCE_INVALID', 'This folder could not be renamed.')
    const updated = { ...folder, name: cleaned, updatedAt: Date.now() }
    await this.database.resourceFolders.put(updated)
    return updated
  }

  async deleteFolder(id: string): Promise<void> {
    const folder = await this.database.resourceFolders.get(id)
    if (!folder) return
    await this.database.transaction('rw', [this.database.resourceFolders, this.database.resources, this.database.materials], async () => {
      await this.database.resources.where('folderId').equals(id).modify({ folderId: undefined })
      await this.database.materials.where('folderId').equals(id).modify({ folderId: undefined })
      const children = await this.database.resourceFolders.where('parentId').equals(id).toArray()
      for (const child of children) {
        await this.database.resources.where('folderId').equals(child.id).modify({ folderId: undefined })
        await this.database.materials.where('folderId').equals(child.id).modify({ folderId: undefined })
      }
      await this.database.resourceFolders.bulkDelete([id, ...children.map((child) => child.id)])
    })
  }

  async addAsset(input: {
    projectId: string
    resourceId?: string
    kind: StudioResourceAsset['kind']
    file: File
  }): Promise<StudioResourceAsset> {
    if (input.resourceId) {
      const resource = await this.database.resources.get(input.resourceId)
      if (!resource || resource.projectId !== input.projectId) {
        throw new AppError('RESOURCE_INVALID', 'This file does not belong to the selected project resource.')
      }
    }
    const extension = input.file.name.split('.').pop()?.toLowerCase() ?? ''
    const now = Date.now()
    const asset: StudioResourceAsset = {
      id: createId(),
      projectId: input.projectId,
      resourceId: input.resourceId,
      kind: input.kind,
      name: input.file.name.slice(0, 160),
      extension,
      mimeType: input.file.type || 'application/octet-stream',
      blob: input.file,
      byteLength: input.file.size,
      createdAt: now,
      updatedAt: now,
    }
    await this.database.resourceAssets.add(asset)
    return { ...asset }
  }

  async getAsset(id: string): Promise<StudioResourceAsset | undefined> {
    const asset = await this.database.resourceAssets.get(id)
    return asset ? { ...asset } : undefined
  }

  async attachAsset(assetId: string, resourceId: string): Promise<StudioResourceAsset> {
    const [asset, resource] = await Promise.all([
      this.database.resourceAssets.get(assetId),
      this.database.resources.get(resourceId),
    ])
    if (!asset || !resource || asset.projectId !== resource.projectId) {
      throw new AppError('RESOURCE_INVALID', 'This file could not be attached to the selected resource.')
    }
    const updated = { ...asset, resourceId, updatedAt: Date.now() }
    await this.database.resourceAssets.put(updated)
    return { ...updated }
  }

  async deleteAsset(id: string): Promise<void> {
    await this.database.resourceAssets.delete(id)
  }

  private async assertFolder(projectId: string, type: StudioResourceType, folderId: string): Promise<void> {
    const folder = await this.database.resourceFolders.get(folderId)
    if (!folder || folder.projectId !== projectId || folder.resourceType !== type) {
      throw new AppError('RESOURCE_INVALID', 'The selected folder is not available for this resource.')
    }
  }
}

export const resourceRepository = new ResourceRepository()
