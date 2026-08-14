import { strFromU8, strToU8, unzip, zip, type Unzipped, type Zippable } from 'fflate'

import { AppError } from '@/core/errors/AppError'
import {
  cloneEditorState,
  cloneStudioCube,
  cloneStudioGroup,
  cloneStudioModel,
  cloneStudioModelFolder,
  cloneStudioReference,
  MODEL_SCHEMA_VERSION,
} from '@/core/model/modelFactory'
import { validateStoredModel } from '@/core/model/modelValidation'
import { importModelJson } from '@/core/model/portability/modelJsonImporter'
import { serializeStudioModelJson } from '@/core/model/portability/modelJsonExporter'
import { DEFAULT_PROJECT_ICON, PROJECT_SCHEMA_VERSION } from '@/core/project/constants'
import { type AddonsStudioDatabase, studioDatabase } from '@/core/storage/database'
import type { ModelEditorAsset, StudioEditorState, StudioModel, StudioReferenceImage } from '@/types/model'
import type { ProjectSnapshot, StudioProject } from '@/types/project'
import { createId } from '@/utils/createId'

export const PROJECT_PACKAGE_FORMAT = 'addons-studio-project'
export const PROJECT_PACKAGE_VERSION = 1
const MAX_COMPRESSED_PACKAGE_BYTES = 256 * 1024 * 1024
const MAX_EXPANDED_PACKAGE_BYTES = 512 * 1024 * 1024

export type ProjectPackageStage =
  | 'reading'
  | 'validating'
  | 'models'
  | 'assets'
  | 'finishing'

interface PackageModelEditorRecord {
  sourceModelId: string
  editor: StudioEditorState
  references: StudioReferenceImage[]
  createdAt: number
  updatedAt: number
}

interface PackageAssetRecord {
  id: string
  modelId: string
  kind: ModelEditorAsset['kind']
  name: string
  mimeType: ModelEditorAsset['mimeType']
  width: number
  height: number
  createdAt: number
  path: string
}

interface PackageProjectFolderRecord {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  schemaVersion: number
}

export interface ProjectPackageManifest {
  format: typeof PROJECT_PACKAGE_FORMAT
  formatVersion: typeof PROJECT_PACKAGE_VERSION
  exportedAt: string
  project: Omit<StudioProject, 'folderId'>
  content: {
    models: number
    cubes: number
    groups: number
    modelFolders: number
    editorAssets: number
  }
  projectFolder?: PackageProjectFolderRecord
  models: { id: string; modelPath: string; editorPath: string }[]
  assets: PackageAssetRecord[]
}

export interface InspectedProjectPackage {
  manifest: ProjectPackageManifest
  entries: Unzipped
  compressedBytes: number
  expandedBytes: number
}

export interface ProjectPackagePreview {
  name: string
  namespace: string
  description?: string
  icon: StudioProject['icon']
  formatVersion: number
  content: ProjectPackageManifest['content']
}

export interface ProjectPackageExport {
  blob: Blob
  filename: string
  manifest: ProjectPackageManifest
}

function zipAsync(entries: Zippable): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    zip(entries, { level: 6 }, (error, data) => error ? reject(error) : resolve(data))
  })
}

function unzipAsync(data: Uint8Array): Promise<Unzipped> {
  return new Promise((resolve, reject) => {
    unzip(data, (error, entries) => error ? reject(error) : resolve(entries))
  })
}

async function blobBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') return new Uint8Array(await blob.arrayBuffer())
  if (typeof globalThis.FileReader === 'undefined') {
    return new Uint8Array(await new Response(blob).arrayBuffer())
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('The editor asset could not be read.'))
    reader.onload = () => {
      if (!(reader.result instanceof ArrayBuffer)) {
        reject(new Error('The editor asset did not contain binary data.'))
        return
      }
      resolve(new Uint8Array(reader.result))
    }
    reader.readAsArrayBuffer(blob)
  })
}

function safeFilename(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'project'
}

function readJson(entries: Unzipped, path: string): unknown {
  const entry = entries[path]
  if (!entry) throw new AppError('PROJECT_IMPORT_FAILED', `The project package is missing ${path}.`)
  try {
    return JSON.parse(strFromU8(entry)) as unknown
  } catch (error) {
    throw new AppError('PROJECT_IMPORT_FAILED', `The project package contains invalid JSON in ${path}.`, { cause: error })
  }
}

function isPackagePath(value: unknown, prefix: string): value is string {
  return typeof value === 'string'
    && value.startsWith(prefix)
    && !value.includes('..')
    && !value.includes('\\')
    && !value.startsWith('/')
}

function isFiniteCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0
}

function isManifest(value: unknown): value is ProjectPackageManifest {
  if (!value || typeof value !== 'object') return false
  const manifest = value as Partial<ProjectPackageManifest>
  const project = manifest.project as Partial<StudioProject> | undefined
  const content = manifest.content as Partial<ProjectPackageManifest['content']> | undefined
  if (manifest.format !== PROJECT_PACKAGE_FORMAT || manifest.formatVersion !== PROJECT_PACKAGE_VERSION) return false
  if (!project
    || typeof project.id !== 'string'
    || typeof project.name !== 'string'
    || !project.name.trim()
    || project.name.length > 80
    || typeof project.namespace !== 'string'
    || !/^[a-z0-9_]{2,64}$/.test(project.namespace)
    || !['addon', 'resource_pack', 'behavior_pack'].includes(project.projectType ?? '')
    || typeof project.targetVersion !== 'string'
    || !project.targetVersion.trim()
    || !Number.isFinite(project.createdAt)
    || !Number.isFinite(project.updatedAt)
  ) return false
  if (project.icon && (
    !['builtin', 'image'].includes(project.icon.kind)
    || typeof project.icon.value !== 'string'
    || !project.icon.value
  )) return false
  if (!content
    || !isFiniteCount(content.models)
    || !isFiniteCount(content.cubes)
    || !isFiniteCount(content.groups)
    || !isFiniteCount(content.modelFolders)
    || !isFiniteCount(content.editorAssets)
  ) return false
  if (!Array.isArray(manifest.models) || !Array.isArray(manifest.assets)) return false
  const modelIds = new Set<string>()
  const modelPaths = new Set<string>()
  for (const model of manifest.models) {
    if (!model || typeof model !== 'object'
      || typeof model.id !== 'string'
      || modelIds.has(model.id)
      || !isPackagePath(model.modelPath, 'models/')
      || !isPackagePath(model.editorPath, 'models/')
      || modelPaths.has(model.modelPath)
      || modelPaths.has(model.editorPath)
    ) return false
    modelIds.add(model.id)
    modelPaths.add(model.modelPath)
    modelPaths.add(model.editorPath)
  }
  const assetIds = new Set<string>()
  const assetPaths = new Set<string>()
  for (const asset of manifest.assets) {
    if (!asset || typeof asset !== 'object'
      || typeof asset.id !== 'string'
      || assetIds.has(asset.id)
      || !modelIds.has(asset.modelId)
      || !['reference', 'background'].includes(asset.kind)
      || !['image/png', 'image/jpeg'].includes(asset.mimeType)
      || typeof asset.name !== 'string'
      || !Number.isFinite(asset.width)
      || !Number.isFinite(asset.height)
      || !isPackagePath(asset.path, 'editor-assets/')
      || assetPaths.has(asset.path)
    ) return false
    assetIds.add(asset.id)
    assetPaths.add(asset.path)
  }
  if (content.models !== manifest.models.length || content.editorAssets !== manifest.assets.length) return false
  const folder = manifest.projectFolder
  if (folder && (
    typeof folder.id !== 'string'
    || typeof folder.name !== 'string'
    || !Number.isFinite(folder.createdAt)
    || !Number.isFinite(folder.updatedAt)
    || !Number.isFinite(folder.schemaVersion)
  )) return false
  return true
}

function remapModelIds(model: ReturnType<typeof importModelJson>['model'], folderSourceIds: string[]) {
  const cubeIds = new Map(model.elements.map((cube) => [cube.id, createId()]))
  const groupIds = new Map(model.groups.map((group) => [group.id, createId()]))
  const folderIds = new Map(folderSourceIds.map((id) => [id, createId()]))
  model.elements = model.elements.map((cube) => ({
    ...cloneStudioCube(cube),
    id: cubeIds.get(cube.id)!,
    parentId: cube.parentId ? groupIds.get(cube.parentId) : undefined,
    folderId: cube.folderId ? folderIds.get(cube.folderId) : undefined,
  }))
  model.groups = model.groups.map((group) => ({
    ...cloneStudioGroup(group),
    id: groupIds.get(group.id)!,
    parentId: group.parentId ? groupIds.get(group.parentId) : undefined,
    folderId: group.folderId ? folderIds.get(group.folderId) : undefined,
  }))
  model.folders = model.folders.map((folder) => ({
    ...cloneStudioModelFolder(folder),
    id: folderIds.get(folder.id)!,
    parentId: folder.parentId ? folderIds.get(folder.parentId) : undefined,
  }))
}

export class ProjectPackageService {
  constructor(private readonly database: AddonsStudioDatabase = studioDatabase) {}

  async exportProject(
    projectId: string,
    onStage?: (stage: ProjectPackageStage) => void,
  ): Promise<ProjectPackageExport> {
    onStage?.('reading')
    const project = await this.database.projects.get(projectId)
    if (!project) throw new AppError('PROJECT_NOT_FOUND', 'This project is no longer available on this device.')
    const [models, currentAssets, legacyAssets, projectFolder] = await Promise.all([
      this.database.models.where('projectId').equals(projectId).toArray(),
      this.database.modelEditorAssets.where('projectId').equals(projectId).toArray(),
      this.database.modelReferenceAssets.where('projectId').equals(projectId).toArray(),
      project.folderId ? this.database.projectFolders.get(project.folderId) : undefined,
    ])
    const assets = [...new Map([...legacyAssets, ...currentAssets].map((asset) => [asset.id, asset])).values()]
    onStage?.('validating')
    for (const model of models) {
      const issue = validateStoredModel(cloneStudioModel(model))[0]
      if (issue) throw new AppError('PROJECT_EXPORT_FAILED', `Project cannot be exported. ${issue.message}`)
    }
    onStage?.('models')
    const entries: Zippable = {}
    const packageModels = models.map((source) => {
      const model = cloneStudioModel(source)
      const modelPath = `models/${model.id}/model.json`
      const editorPath = `models/${model.id}/editor.json`
      entries[modelPath] = strToU8(serializeStudioModelJson(model))
      const editor: PackageModelEditorRecord = {
        sourceModelId: model.id,
        editor: cloneEditorState(model.editor),
        references: model.references.map(cloneStudioReference),
        createdAt: model.createdAt,
        updatedAt: model.updatedAt,
      }
      entries[editorPath] = strToU8(JSON.stringify(editor))
      return { id: model.id, modelPath, editorPath }
    })
    onStage?.('assets')
    const packageAssets: PackageAssetRecord[] = []
    for (const asset of assets) {
      const extension = asset.mimeType === 'image/png' ? 'png' : 'jpg'
      const path = `editor-assets/${asset.id}.${extension}`
      entries[path] = await blobBytes(asset.blob)
      packageAssets.push({
        id: asset.id,
        modelId: asset.modelId,
        kind: asset.kind ?? 'reference',
        name: asset.name,
        mimeType: asset.mimeType,
        width: asset.width ?? 0,
        height: asset.height ?? 0,
        createdAt: asset.createdAt,
        path,
      })
    }
    const { folderId, ...portableProject } = project
    void folderId
    const manifest: ProjectPackageManifest = {
      format: PROJECT_PACKAGE_FORMAT,
      formatVersion: PROJECT_PACKAGE_VERSION,
      exportedAt: new Date().toISOString(),
      project: { ...portableProject, icon: { ...project.icon } },
      content: {
        models: models.length,
        cubes: models.reduce((sum, model) => sum + model.elements.length, 0),
        groups: models.reduce((sum, model) => sum + (model.groups?.length ?? 0), 0),
        modelFolders: models.reduce((sum, model) => sum + (model.folders?.length ?? 0), 0),
        editorAssets: packageAssets.length,
      },
      projectFolder: projectFolder ? { ...projectFolder } : undefined,
      models: packageModels,
      assets: packageAssets,
    }
    entries['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2))
    onStage?.('finishing')
    try {
      const data = await zipAsync(entries)
      return {
        blob: new Blob([data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer], { type: 'application/x-addons-studio-project' }),
        filename: `${safeFilename(project.name)}.addonsstudio`,
        manifest,
      }
    } catch (error) {
      throw new AppError('PROJECT_EXPORT_FAILED', 'Addons Studio could not create the project package.', { cause: error })
    }
  }

  async inspectPackage(file: Blob, onStage?: (stage: ProjectPackageStage) => void): Promise<InspectedProjectPackage> {
    onStage?.('reading')
    if (file.size > MAX_COMPRESSED_PACKAGE_BYTES) {
      throw new AppError('PROJECT_IMPORT_FAILED', 'This project package is too large to open safely on a mobile device.')
    }
    let entries: Unzipped
    try {
      entries = await unzipAsync(new Uint8Array(await file.arrayBuffer()))
    } catch (error) {
      throw new AppError('PROJECT_IMPORT_FAILED', 'This file is not a readable Addons Studio project package.', { cause: error })
    }
    onStage?.('validating')
    const parsed = readJson(entries, 'manifest.json')
    if (!isManifest(parsed)) {
      throw new AppError('PROJECT_IMPORT_FAILED', 'This project package uses an unrecognized or unsupported format.')
    }
    for (const model of parsed.models) {
      if (!entries[model.modelPath] || !entries[model.editorPath]) {
        throw new AppError('PROJECT_IMPORT_FAILED', 'The project package is missing required model data.')
      }
    }
    for (const asset of parsed.assets) {
      if (!entries[asset.path]) {
        throw new AppError('PROJECT_IMPORT_FAILED', `The project package is missing editor asset “${asset.name}”.`)
      }
    }
    const expandedBytes = Object.values(entries).reduce((sum, entry) => sum + entry.byteLength, 0)
    if (expandedBytes > MAX_EXPANDED_PACKAGE_BYTES) {
      throw new AppError('PROJECT_IMPORT_FAILED', 'This project package expands beyond the safe mobile import limit.')
    }
    return {
      manifest: parsed,
      entries,
      compressedBytes: file.size,
      expandedBytes,
    }
  }

  previewPackage(inspected: InspectedProjectPackage): ProjectPackagePreview {
    const { project, content, formatVersion } = inspected.manifest
    return {
      name: project.name,
      namespace: project.namespace,
      description: project.description,
      icon: project.icon ?? { kind: 'builtin', value: DEFAULT_PROJECT_ICON },
      formatVersion,
      content,
    }
  }

  async importPackage(
    inspected: InspectedProjectPackage,
    onStage?: (stage: ProjectPackageStage) => void,
  ): Promise<StudioProject> {
    onStage?.('validating')
    await this.assertStorageAvailable(inspected.expandedBytes)
    const now = Date.now()
    const projectId = createId()
    const namespace = await this.availableNamespace(inspected.manifest.project.namespace)
    const importedProject: StudioProject = {
      ...inspected.manifest.project,
      id: projectId,
      namespace,
      icon: inspected.manifest.project.icon
        ? { ...inspected.manifest.project.icon }
        : { kind: 'builtin', value: DEFAULT_PROJECT_ICON },
      folderId: undefined,
      createdAt: now,
      updatedAt: now,
      schemaVersion: PROJECT_SCHEMA_VERSION,
      revision: 1,
    }
    const importedFolder = inspected.manifest.projectFolder
      ? {
          ...inspected.manifest.projectFolder,
          id: createId(),
          name: await this.availableFolderName(inspected.manifest.projectFolder.name),
          createdAt: now,
          updatedAt: now,
        }
      : undefined
    importedProject.folderId = importedFolder?.id
    const modelIds = new Map(inspected.manifest.models.map((entry) => [entry.id, createId()]))
    const assetIds = new Map(inspected.manifest.assets.map((entry) => [entry.id, createId()]))
    const importedModels: StudioModel[] = []
    onStage?.('models')
    for (const entry of inspected.manifest.models) {
      const core = strFromU8(inspected.entries[entry.modelPath]!)
      const imported = importModelJson(core, projectId).model
      const editor = readJson(inspected.entries, entry.editorPath) as PackageModelEditorRecord
      if (!editor || editor.sourceModelId !== entry.id || !Array.isArray(editor.references) || !editor.editor) {
        throw new AppError('PROJECT_IMPORT_FAILED', 'The project package contains invalid Model Studio editor data.')
      }
      remapModelIds(imported, imported.folders.map((folder) => folder.id))
      imported.id = modelIds.get(entry.id)!
      imported.editor = cloneEditorState(editor.editor)
      imported.references = editor.references.map((reference) => ({
        ...cloneStudioReference(reference),
        id: createId(),
        assetId: assetIds.get(reference.assetId) ?? '',
      }))
      if (imported.references.some((reference) => !reference.assetId)) {
        throw new AppError('PROJECT_IMPORT_FAILED', 'A model reference points to a missing editor asset.')
      }
      const customId = imported.editor.background.customAssetId
      if (customId) {
        const remapped = assetIds.get(customId)
        if (!remapped) throw new AppError('PROJECT_IMPORT_FAILED', 'A custom background asset is missing from the package.')
        imported.editor.background.customAssetId = remapped
      }
      imported.createdAt = now
      imported.updatedAt = now
      imported.schemaVersion = MODEL_SCHEMA_VERSION
      imported.revision = 1
      const issue = validateStoredModel(imported)[0]
      if (issue) throw new AppError('PROJECT_IMPORT_FAILED', `Imported model is invalid. ${issue.message}`)
      importedModels.push(imported)
    }
    const actualContent = {
      models: importedModels.length,
      cubes: importedModels.reduce((sum, entry) => sum + entry.elements.length, 0),
      groups: importedModels.reduce((sum, entry) => sum + entry.groups.length, 0),
      modelFolders: importedModels.reduce((sum, entry) => sum + entry.folders.length, 0),
    }
    if (actualContent.models !== inspected.manifest.content.models
      || actualContent.cubes !== inspected.manifest.content.cubes
      || actualContent.groups !== inspected.manifest.content.groups
      || actualContent.modelFolders !== inspected.manifest.content.modelFolders
    ) {
      throw new AppError('PROJECT_IMPORT_FAILED', 'The project package content summary does not match its model data.')
    }
    onStage?.('assets')
    const importedAssets: ModelEditorAsset[] = inspected.manifest.assets.map((asset) => ({
      id: assetIds.get(asset.id)!,
      modelId: modelIds.get(asset.modelId)!,
      projectId,
      kind: asset.kind,
      name: asset.name,
      mimeType: asset.mimeType,
      blob: new Blob([inspected.entries[asset.path]!], { type: asset.mimeType }),
      width: asset.width,
      height: asset.height,
      createdAt: now,
    }))
    if (importedAssets.some((asset) => !asset.modelId)) {
      throw new AppError('PROJECT_IMPORT_FAILED', 'An editor asset references a missing model.')
    }
    const snapshot: ProjectSnapshot = {
      id: createId(),
      projectId,
      createdAt: now,
      reason: 'created',
      project: { ...importedProject, icon: { ...importedProject.icon } },
    }
    onStage?.('finishing')
    try {
      await this.database.transaction(
        'rw',
        [
          this.database.projects,
          this.database.snapshots,
          this.database.projectFolders,
          this.database.models,
          this.database.modelEditorAssets,
        ],
        async () => {
          if (importedFolder) await this.database.projectFolders.add(importedFolder)
          await this.database.projects.add(importedProject)
          await this.database.snapshots.add(snapshot)
          if (importedModels.length) await this.database.models.bulkAdd(importedModels)
          if (importedAssets.length) await this.database.modelEditorAssets.bulkAdd(importedAssets)
        },
      )
      return { ...importedProject, icon: { ...importedProject.icon } }
    } catch (error) {
      throw new AppError(
        'PROJECT_IMPORT_FAILED',
        'Addons Studio could not import this project. No partial project was kept.',
        { cause: error },
      )
    }
  }

  private async availableNamespace(preferred: string): Promise<string> {
    let candidate = preferred
    let suffix = 1
    while (await this.database.projects.where('namespace').equals(candidate).count()) {
      const marker = suffix === 1 ? '_imported' : `_imported_${suffix}`
      candidate = `${preferred.slice(0, Math.max(1, 64 - marker.length))}${marker}`
      suffix += 1
    }
    return candidate
  }

  private async availableFolderName(preferred: string): Promise<string> {
    const normalized = preferred.trim() || 'Imported Projects'
    const existing = await this.database.projectFolders.toArray()
    const names = new Set(existing.map((folder) => folder.name.toLocaleLowerCase()))
    if (!names.has(normalized.toLocaleLowerCase())) return normalized
    let suffix = 2
    while (names.has(`${normalized} ${suffix}`.toLocaleLowerCase())) suffix += 1
    return `${normalized} ${suffix}`
  }

  private async assertStorageAvailable(expandedBytes: number): Promise<void> {
    try {
      const estimate = await globalThis.navigator?.storage?.estimate()
      if (!estimate?.quota || estimate.usage === undefined) return
      const available = estimate.quota - estimate.usage
      if (available < expandedBytes * 1.2) {
        throw new AppError(
          'PROJECT_IMPORT_FAILED',
          'This device does not appear to have enough local storage for the project package.',
        )
      }
    } catch (error) {
      if (error instanceof AppError) throw error
      // Storage estimation is advisory. IndexedDB remains transactional if the
      // browser cannot provide a quota estimate.
    }
  }
}

export const projectPackageService = new ProjectPackageService()
