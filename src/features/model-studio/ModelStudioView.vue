<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { useRouter } from 'vue-router'

import AppButton from '@/components/common/AppButton.vue'
import AppDialog from '@/components/common/AppDialog.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import BottomSheet from '@/components/common/BottomSheet.vue'
import IconButton from '@/components/common/IconButton.vue'
import StudioIcon from '@/components/common/StudioIcon.vue'
import { toAppError } from '@/core/errors/AppError'
import {
  createElementCommand,
  createGroupCommand,
  createNodesCommand,
  captureModelStructure,
  deleteSelectionCommand,
  ModelCommandHistory,
  updateElementCommand,
  updateGroupCommand,
  updateHierarchyCommand,
  updateModelStructureCommand,
  updateReferenceCommand,
} from '@/core/model/modelHistory'
import {
  cloneStudioCube,
  cloneStudioGroup,
  cloneStudioModel,
  cloneStudioReference,
  cloneStudioModelFolder,
  createStudioCube,
  createStudioGroup,
  resetEditorPreferences,
} from '@/core/model/modelFactory'
import {
  createModelFolder,
  ModelFolderError,
  moveNodeToFolder,
  removeModelFolder,
  renameModelFolder,
} from '@/core/model/modelFolders'
import {
  fitInflateHandle,
  type StudioInflateHandle,
} from '@/core/model/modelInflate'
import {
  applyHierarchyState,
  buildNodeTransformState,
  buildPivotState,
  captureNodeTransform,
  getGroupChildren,
  getStudioNode,
  hierarchyBounds,
  isNodeEffectivelyLocked,
  type StudioHierarchyState,
  type StudioNodeTransformSession,
} from '@/core/model/modelHierarchy'
import {
  alignSelectionState,
  buildSelectionTranslationState,
  captureSelectionTransform,
  distributeSelectionState,
  duplicateAndMirrorSelection,
  duplicateSelection,
  isolatedElementIds,
  lockSelectionState,
  mirrorSelectionState,
  normalizeSelectionIds,
  selectionCanTransform,
  selectionElements,
  visibilitySelectionState,
  type StudioAlignment,
} from '@/core/model/modelProductivity'
import { modelPersistenceService } from '@/core/model/modelPersistenceService'
import { ModelEditorAssetRuntime } from '@/core/model/modelEditorAssetRuntime'
import { modelRepository } from '@/core/model/modelRepository'
import {
  modelJsonFilename,
  serializeStudioModelJson,
} from '@/core/model/portability/modelJsonExporter'
import { isValidModelIdentifier } from '@/core/model/modelValidation'
import { LOCALE_STORAGE_KEY, useLocaleStore } from '@/stores/locale'
import { useToastStore } from '@/stores/toasts'
import type {
  ModelEditorAsset,
  ModelTransformTool,
  StudioCameraView,
  StudioEditorBackgroundSettings,
  StudioEditorBackgroundType,
  StudioCameraSettings,
  StudioExperimentalSettings,
  StudioModel,
  StudioModelFolder,
  StudioModelingSettings,
  StudioModelNode,
  StudioReferenceImage,
  StudioReferenceView,
  StudioSnappingSettings,
  StudioVector3,
} from '@/types/model'
import type { StudioAxis } from '@/core/model/modelHierarchy'
import { downloadBlob } from '@/utils/download'

import ModelOutlinerSheet from './components/ModelOutlinerSheet.vue'
import BackgroundSettingsSheet from './components/BackgroundSettingsSheet.vue'
import ModelSettingsSheet from './components/ModelSettingsSheet.vue'
import ModelViewport from './components/ModelViewport.vue'
import PivotPropertiesSheet from './components/PivotPropertiesSheet.vue'
import ReferencePropertiesSheet from './components/ReferencePropertiesSheet.vue'
import ReferencesManagerSheet from './components/ReferencesManagerSheet.vue'
import TransformPropertiesSheet from './components/TransformPropertiesSheet.vue'

const props = defineProps<{ projectId: string; modelId: string }>()
const router = useRouter()
const toasts = useToastStore()
const locale = useLocaleStore()
const model = ref<StudioModel>()
const assets = shallowRef<ModelEditorAsset[]>([])
const assetUrls = ref<Record<string, string>>({})
const assetRuntime = new ModelEditorAssetRuntime()
const loading = ref(true)
const loadError = ref('')
const tool = ref<ModelTransformTool>('select')
const selectedNodeIds = ref<string[]>([])
const selectedNodeId = computed<string | undefined>({
  get: () => selectedNodeIds.value.at(-1),
  set: (id) => { selectedNodeIds.value = id ? [id] : [] },
})
const selectedReferenceId = ref<string>()
const propertiesOpen = ref(false)
const pivotPropertiesOpen = ref(false)
const referencePropertiesOpen = ref(false)
const referencesOpen = ref(false)
const backgroundOpen = ref(false)
const guideWorkflowOpen = ref(false)
const outlinerOpen = ref(false)
const moreOpen = ref(false)
const viewsOpen = ref(false)
const settingsOpen = ref(false)
const resetSettingsOpen = ref(false)
const exportModelOpen = ref(false)
const exportName = ref('')
const exportIdentifier = ref('')
const exportError = ref('')
const exportBusy = ref(false)
const exportApplyIdentity = ref(false)
const mirrorOpen = ref(false)
const arrangeOpen = ref(false)
const objectActionsOpen = ref(false)
const moveToGroupOpen = ref(false)
const moveToFolderOpen = ref(false)
const folderDialogOpen = ref(false)
const folderName = ref('')
const folderParentId = ref<string>()
const folderRenameTarget = ref<StudioModelFolder>()
const folderDeleteOpen = ref(false)
const folderDeleteTarget = ref<StudioModelFolder>()
const deleteSelectionOpen = ref(false)
const multiSelectMode = ref(false)
const isolatedIds = ref<string[]>([])
const renameOpen = ref(false)
const renameValue = ref('')
const renameTargetId = ref<string>()
const renameTargetType = ref<'cube' | 'group'>('cube')
const deleteReferenceOpen = ref(false)
const deleteReferenceTarget = ref<StudioReferenceImage>()
const referenceInput = ref<HTMLInputElement>()
const backgroundInput = ref<HTMLInputElement>()
const importingReference = ref(false)
const importingBackground = ref(false)
const saveStatus = ref<'saved' | 'saving' | 'error'>('saved')
const historyVersion = ref(0)
const history = new ModelCommandHistory()
const activeViewport = ref(0)
const maximizedViewport = ref<number>()
const inflateSource = ref<StudioInflateHandle>()
let numericSession: StudioNodeTransformSession | undefined
let pivotSession: StudioNodeTransformSession | undefined
let saveSequence = 0
const duplicateMemory = ref<{ ids: string[]; offset?: StudioVector3 }>()
const reportedImageErrors = new Set<string>()

const selectedNode = computed(() => model.value ? getStudioNode(model.value, selectedNodeId.value) : undefined)
const selectedNodes = computed(() => model.value
  ? selectedNodeIds.value
      .map((id) => getStudioNode(model.value!, id))
      .filter((node): node is StudioModelNode => Boolean(node))
  : [],
)
const selectionCount = computed(() => selectedNodes.value.length)
const selectedGroup = computed(() => selectionCount.value === 1 && selectedNode.value?.type === 'group' ? selectedNode.value : undefined)
const selectedCubes = computed(() => model.value ? selectionElements(model.value, selectedNodeIds.value) : [])
const selectionTransformable = computed(() => model.value
  ? selectionCanTransform(model.value, selectedNodeIds.value)
  : false,
)
const selectionDirectlyLocked = computed(() => selectedNodes.value.length
  ? selectedNodes.value.every((node) => node.locked)
  : false,
)
const selectionHasLockedNode = computed(() => model.value && selectedNodes.value.length
  ? selectedNodes.value.some((node) => isNodeEffectivelyLocked(model.value!, node))
  : false,
)
const selectionVisible = computed(() => selectedNodes.value.length > 0
  && selectedNodes.value.every((node) => node.visible),
)
const selectedAreCubes = computed(() => selectedNodes.value.length > 0
  && selectedNodes.value.every((node) => node.type === 'cube'),
)
const selectionCanMoveToFolder = computed(() => selectedNodes.value.length > 0
  && selectedNodes.value.every((node) => node.type === 'group' || !node.parentId),
)
const canDuplicateAgain = computed(() => Boolean(
  model.value
  && duplicateMemory.value?.offset
  && duplicateMemory.value.ids.length
  && duplicateMemory.value.ids.every((id) => Boolean(getStudioNode(model.value!, id))),
))
const isolationActive = computed(() => isolatedIds.value.length > 0)
const selectedReference = computed(() =>
  model.value?.references.find((reference) => reference.id === selectedReferenceId.value),
)
const customBackgroundAsset = computed(() => assets.value.find((asset) =>
  asset.id === model.value?.editor.background.customAssetId && asset.kind === 'background',
))
const canUndo = computed(() => {
  void historyVersion.value
  return history.canUndo
})
const canRedo = computed(() => {
  void historyVersion.value
  return history.canRedo
})
const viewportCount = computed(() => model.value?.editor.viewportLayout ?? 1)
const visibleViewportIndexes = computed(() => {
  if (maximizedViewport.value !== undefined) return [maximizedViewport.value]
  return Array.from({ length: viewportCount.value }, (_, index) => index)
})
const currentTransformSnap = computed(() => model.value?.editor.snapping.transform ?? null)
const currentResizeSnap = computed(() => model.value?.editor.snapping.resize
  ?? model.value?.editor.snapping.transform
  ?? null)
const currentRotationSnap = computed(() => model.value?.editor.snapping.rotation ?? null)
const interactionLocked = computed(() => [
  propertiesOpen.value,
  pivotPropertiesOpen.value,
  referencePropertiesOpen.value,
  referencesOpen.value,
  backgroundOpen.value,
  guideWorkflowOpen.value,
  outlinerOpen.value,
  moreOpen.value,
  viewsOpen.value,
  settingsOpen.value,
  mirrorOpen.value,
  arrangeOpen.value,
  objectActionsOpen.value,
  moveToGroupOpen.value,
  moveToFolderOpen.value,
  deleteSelectionOpen.value,
  renameOpen.value,
  deleteReferenceOpen.value,
  resetSettingsOpen.value,
  exportModelOpen.value,
  folderDialogOpen.value,
  folderDeleteOpen.value,
].some(Boolean))

const tools: readonly { id: ModelTransformTool; label: string; icon: string }[] = [
  { id: 'select', label: 'Select', icon: 'pointer' },
  { id: 'move', label: 'Move', icon: 'move-3d' },
  { id: 'rotate', label: 'Rotate', icon: 'rotate-3d' },
  { id: 'scale', label: 'Resize', icon: 'scale' },
  { id: 'pivot', label: 'Pivot', icon: 'crosshair' },
  { id: 'inflate', label: 'Inflate', icon: 'inflate' },
]

function reportImageError(key: string, message: string): void {
  if (reportedImageErrors.has(key)) return
  reportedImageErrors.add(key)
  toasts.push({ type: 'error', message })
}

function handleViewportError(message: string): void {
  reportImageError(`viewport:${message}`, message)
}

function refreshAssetUrls(): void {
  const runtime = assetRuntime.sync(assets.value)
  assetUrls.value = runtime.urls
  for (const id of runtime.failedIds) {
    reportImageError(id, 'Addons Studio could not restore this editor image from local storage.')
  }
}

function auditStoredAssets(): void {
  if (!model.value) return
  const available = new Set(assets.value.map((asset) => asset.id))
  for (const reference of model.value.references) {
    if (!available.has(reference.assetId)) {
      reportImageError(reference.assetId, 'Addons Studio could not restore this reference image from local storage.')
    }
  }
  const backgroundId = model.value.editor.background.customAssetId
  if (backgroundId && !available.has(backgroundId)) {
    reportImageError(backgroundId, 'Addons Studio could not restore the custom editor background from local storage.')
  }
}

onMounted(async () => {
  try {
    const [storedModel, storedAssets] = await Promise.all([
      modelRepository.getModel(props.modelId),
      modelRepository.listEditorAssets(props.modelId),
    ])
    if (!storedModel || storedModel.projectId !== props.projectId) {
      loadError.value = 'This model is no longer available in the project.'
      return
    }
    if (!globalThis.localStorage?.getItem(LOCALE_STORAGE_KEY) && storedModel.editor.modeling.language === 'es') {
      locale.setLanguage('es')
    }
    storedModel.editor.modeling.language = locale.language
    model.value = storedModel
    assets.value = storedAssets
    refreshAssetUrls()
    auditStoredAssets()
  } catch (error) {
    loadError.value = toAppError(error, 'Addons Studio could not open this model.').userMessage
  } finally {
    loading.value = false
  }
  globalThis.addEventListener('pagehide', flushOnHide)
})

onBeforeUnmount(() => {
  globalThis.removeEventListener('pagehide', flushOnHide)
  void modelPersistenceService.flush(props.modelId)
  assetRuntime.dispose()
})

function flushOnHide(): void {
  void modelPersistenceService.flush(props.modelId)
}

function scheduleSave(): void {
  if (!model.value) return
  const sequence = ++saveSequence
  saveStatus.value = 'saving'
  modelPersistenceService.schedule(model.value, {
    onSaved: (saved) => {
      if (!model.value) return
      model.value.updatedAt = saved.updatedAt
      model.value.revision = saved.revision
      if (sequence === saveSequence) saveStatus.value = 'saved'
    },
    onError: (error) => {
      if (sequence === saveSequence) saveStatus.value = 'error'
      toasts.push({
        type: 'error',
        message: toAppError(error, 'Addons Studio could not save this model.').userMessage,
      })
    },
  })
}

async function saveNow(): Promise<void> {
  if (!model.value) return
  moreOpen.value = false
  scheduleSave()
  try {
    await modelPersistenceService.flush(model.value.id)
    saveStatus.value = 'saved'
  } catch {
    saveStatus.value = 'error'
  }
}

function bumpHistory(): void {
  historyVersion.value += 1
}

function addCube(): void {
  if (!model.value) return
  const cube = createStudioCube(model.value.elements.length)
  if (selectedGroup.value) cube.parentId = selectedGroup.value.id
  history.execute(createElementCommand(cube, model.value.elements.length), model.value)
  bumpHistory()
  selectedNodeId.value = cube.id
  selectedReferenceId.value = undefined
  tool.value = 'move'
  scheduleSave()
}

function addGroup(): void {
  if (!model.value) return
  if (selectedAreCubes.value && selectedCubes.value.length >= 2) {
    const before = captureModelStructure(model.value)
    const group = createStudioGroup(model.value.groups.length, selectedCubes.value)
    const folderIds = new Set(selectedCubes.value.map((cube) => cube.folderId))
    group.folderId = folderIds.size === 1 ? selectedCubes.value[0]?.folderId : undefined
    const selected = new Set(selectedCubes.value.map((cube) => cube.id))
    const after = {
      elements: model.value.elements.map((cube) => selected.has(cube.id)
        ? { ...cloneStudioCube(cube), parentId: group.id, folderId: undefined }
        : cloneStudioCube(cube)),
      groups: [...model.value.groups.map(cloneStudioGroup), group],
      folders: model.value.folders.map(cloneStudioModelFolder),
    }
    history.execute(updateModelStructureCommand(before, after, 'Create group from selection'), model.value)
    selectedNodeIds.value = [group.id]
    multiSelectMode.value = false
    bumpHistory()
    scheduleSave()
    return
  }
  const group = createStudioGroup(model.value.groups.length)
  history.execute(createGroupCommand(group, model.value.groups.length), model.value)
  bumpHistory()
  selectedNodeId.value = group.id
  selectedReferenceId.value = undefined
  tool.value = 'select'
  scheduleSave()
}

function previewHierarchy(state: StudioHierarchyState): void {
  if (model.value) applyHierarchyState(model.value, state)
}

function commitHierarchy(payload: { before: StudioHierarchyState; after: StudioHierarchyState; label: string }): void {
  if (!model.value) return
  applyHierarchyState(model.value, payload.after)
  history.recordApplied(updateHierarchyCommand(payload.before, payload.after, payload.label))
  rememberDuplicateOffset(payload)
  bumpHistory()
  scheduleSave()
}

function rememberDuplicateOffset(payload: { before: StudioHierarchyState; after: StudioHierarchyState; label: string }): void {
  if (!duplicateMemory.value || !payload.label.toLowerCase().includes('move')) return
  const id = duplicateMemory.value.ids[0]
  const before = payload.before.elements.find((entry) => entry.id === id)
    ?? payload.before.groups.find((entry) => entry.id === id)
  const after = payload.after.elements.find((entry) => entry.id === id)
    ?? payload.after.groups.find((entry) => entry.id === id)
  if (!before || !after) return
  const offset = {
    x: after.position.x - before.position.x,
    y: after.position.y - before.position.y,
    z: after.position.z - before.position.z,
  }
  if (Object.values(offset).every(Number.isFinite) && Object.values(offset).some((value) => Math.abs(value) > 1e-6)) {
    duplicateMemory.value.offset = offset
  }
}

function duplicateNode(id = selectedNodeId.value): void {
  if (!model.value) return
  const ids = id && !selectedNodeIds.value.includes(id) ? [id] : selectedNodeIds.value
  if (!ids.length) return
  const duplicate = duplicateSelection(model.value, ids)
  if (!duplicate.selectedIds.length) return
  history.execute(
    createNodesCommand(duplicate.elements, duplicate.groups, ids.length > 1 ? 'Duplicate selection' : 'Duplicate object'),
    model.value,
  )
  selectedNodeIds.value = duplicate.selectedIds
  duplicateMemory.value = { ids: [...duplicate.selectedIds] }
  bumpHistory()
  objectActionsOpen.value = false
  outlinerOpen.value = false
  scheduleSave()
}

function duplicateAgain(): void {
  if (!model.value || !duplicateMemory.value?.offset) return
  const previousOffset = { ...duplicateMemory.value.offset }
  const duplicate = duplicateSelection(model.value, duplicateMemory.value.ids)
  if (!duplicate.selectedIds.length) return
  const temporary = cloneStudioModel(model.value)
  temporary.elements.push(...duplicate.elements.map(cloneStudioCube))
  temporary.groups.push(...duplicate.groups.map(cloneStudioGroup))
  const session = captureSelectionTransform(temporary, duplicate.selectedIds)
  if (!session) return
  const moved = buildSelectionTranslationState(session, previousOffset)
  history.execute(
    createNodesCommand(moved.elements, moved.groups, 'Duplicate Again'),
    model.value,
  )
  selectedNodeIds.value = duplicate.selectedIds
  duplicateMemory.value = { ids: [...duplicate.selectedIds], offset: previousOffset }
  objectActionsOpen.value = false
  bumpHistory()
  scheduleSave()
}

function toggleElement(id: string): void {
  if (!model.value) return
  const element = model.value.elements.find((entry) => entry.id === id)
  if (!element) return
  const before = cloneStudioCube(element)
  const after = cloneStudioCube(element)
  after.visible = !after.visible
  history.execute(updateElementCommand(before, after, after.visible ? 'Show cube' : 'Hide cube'), model.value)
  bumpHistory()
  scheduleSave()
}

function beginRenameNode(id: string): void {
  const node = model.value ? getStudioNode(model.value, id) : undefined
  if (!node) return
  outlinerOpen.value = false
  objectActionsOpen.value = false
  renameTargetId.value = id
  renameTargetType.value = node.type
  renameValue.value = node.name
  renameOpen.value = true
}

function renameNode(): void {
  if (!model.value || !renameTargetId.value || !renameValue.value.trim()) return
  const node = getStudioNode(model.value, renameTargetId.value)
  if (!node) return
  if (node.type === 'cube') {
    const before = cloneStudioCube(node)
    const after = cloneStudioCube(node)
    after.name = renameValue.value.trim().slice(0, 60)
    history.execute(updateElementCommand(before, after, 'Rename cube'), model.value)
  } else {
    const before = cloneStudioGroup(node)
    const after = cloneStudioGroup(node)
    after.name = renameValue.value.trim().slice(0, 60)
    history.execute(updateGroupCommand(before, after, 'Rename group'), model.value)
  }
  bumpHistory()
  renameOpen.value = false
  scheduleSave()
}

function toggleGroup(id: string): void {
  if (!model.value) return
  const group = model.value.groups.find((entry) => entry.id === id)
  if (!group) return
  const before = cloneStudioGroup(group)
  const after = cloneStudioGroup(group)
  after.visible = !after.visible
  history.execute(updateGroupCommand(before, after, after.visible ? 'Show group' : 'Hide group'), model.value)
  bumpHistory()
  scheduleSave()
}

function applyHierarchyOperation(
  state: { before: StudioHierarchyState; after: StudioHierarchyState } | undefined,
  label: string,
): void {
  if (!model.value || !state) return
  history.execute(updateHierarchyCommand(state.before, state.after, label), model.value)
  bumpHistory()
  scheduleSave()
}

function toggleNodeLock(id?: string): void {
  if (!model.value) return
  const ids = id && !selectedNodeIds.value.includes(id) ? [id] : selectedNodeIds.value
  if (!ids.length) return
  const nodes = ids.map((entry) => getStudioNode(model.value!, entry)).filter(Boolean) as StudioModelNode[]
  const shouldLock = !nodes.every((node) => node.locked)
  applyHierarchyOperation(
    lockSelectionState(model.value, ids, shouldLock),
    shouldLock ? 'Lock selection' : 'Unlock selection',
  )
  objectActionsOpen.value = false
}

function setSelectionVisibility(visible: boolean): void {
  if (!model.value) return
  applyHierarchyOperation(
    visibilitySelectionState(model.value, selectedNodeIds.value, visible),
    visible ? 'Show selection' : 'Hide selection',
  )
  objectActionsOpen.value = false
}

function confirmDeleteSelection(): void {
  if (!selectedNodeIds.value.length || selectionHasLockedNode.value) return
  objectActionsOpen.value = false
  deleteSelectionOpen.value = true
}

function deleteSelectedNodes(): void {
  if (!model.value || selectionHasLockedNode.value) return
  const command = deleteSelectionCommand(model.value, selectedNodeIds.value)
  if (!command) return
  history.execute(command, model.value)
  selectedNodeIds.value = []
  isolatedIds.value = []
  deleteSelectionOpen.value = false
  bumpHistory()
  scheduleSave()
}

function mirrorSelection(axis: StudioAxis, duplicate: boolean): void {
  if (!model.value || !selectionTransformable.value) return
  if (duplicate) {
    const mirrored = duplicateAndMirrorSelection(model.value, selectedNodeIds.value, axis)
    if (!mirrored.selectedIds.length) return
    history.execute(
      createNodesCommand(mirrored.elements, mirrored.groups, `Duplicate + Mirror ${axis.toUpperCase()}`),
      model.value,
    )
    selectedNodeIds.value = mirrored.selectedIds
    duplicateMemory.value = { ids: [...mirrored.selectedIds] }
    bumpHistory()
    scheduleSave()
  } else {
    applyHierarchyOperation(
      mirrorSelectionState(model.value, selectedNodeIds.value, axis),
      `Mirror ${axis.toUpperCase()}`,
    )
  }
  mirrorOpen.value = false
  objectActionsOpen.value = false
}

function alignSelection(axis: StudioAxis, alignment: StudioAlignment): void {
  if (!model.value) return
  applyHierarchyOperation(
    alignSelectionState(model.value, selectedNodeIds.value, axis, alignment),
    `Align ${alignment} ${axis.toUpperCase()}`,
  )
  arrangeOpen.value = false
}

function distributeSelection(axis: StudioAxis): void {
  if (!model.value) return
  applyHierarchyOperation(
    distributeSelectionState(model.value, selectedNodeIds.value, axis),
    `Distribute ${axis.toUpperCase()}`,
  )
  arrangeOpen.value = false
}

function isolateSelection(): void {
  if (!model.value || !selectedNodeIds.value.length) return
  isolatedIds.value = isolatedElementIds(model.value, selectedNodeIds.value)
  objectActionsOpen.value = false
}

function exitIsolation(): void {
  isolatedIds.value = []
}

function moveCubeToGroup(groupId?: string): void {
  if (!model.value || !selectedCubes.value.length) return
  const selectedIds = new Set(selectedCubes.value.map((cube) => cube.id))
  const before = selectedCubes.value.map(cloneStudioCube)
  const after = selectedCubes.value.map((cube) => {
    const sourceFolderId = cube.parentId
      ? model.value?.groups.find((group) => group.id === cube.parentId)?.folderId
      : cube.folderId
    return {
      ...cloneStudioCube(cube),
      parentId: groupId,
      folderId: groupId ? undefined : sourceFolderId,
    }
  })
  const target = groupId ? model.value.groups.find((group) => group.id === groupId) : undefined
  const remainingTargetChildren = target
    ? getGroupChildren(model.value, target.id).filter((cube) => !selectedIds.has(cube.id))
    : []
  if (target && remainingTargetChildren.length === 0) {
    const beforeGroup = cloneStudioGroup(target)
    const afterGroup = cloneStudioGroup(target)
    const center = hierarchyBounds(after)?.center ?? afterGroup.position
    afterGroup.position = { ...center }
    afterGroup.pivot = { ...center }
    afterGroup.defaultPivot = { ...center }
    history.execute(updateHierarchyCommand(
      { elements: before, groups: [beforeGroup] },
      { elements: after, groups: [afterGroup] },
      selectedCubes.value.length > 1 ? 'Move selection to group' : 'Move cube to group',
    ), model.value)
  } else {
    history.execute(updateHierarchyCommand(
      { elements: before, groups: [] },
      { elements: after, groups: [] },
      groupId ? 'Move selection to group' : 'Move selection to root',
    ), model.value)
  }
  bumpHistory()
  moveToGroupOpen.value = false
  objectActionsOpen.value = false
  scheduleSave()
}

function openCreateFolder(parentId?: string): void {
  folderRenameTarget.value = undefined
  folderParentId.value = parentId
  folderName.value = ''
  outlinerOpen.value = false
  folderDialogOpen.value = true
}

function openRenameFolder(folderId: string): void {
  const folder = model.value?.folders.find((entry) => entry.id === folderId)
  if (!folder) return
  folderRenameTarget.value = folder
  folderParentId.value = folder.parentId
  folderName.value = folder.name
  outlinerOpen.value = false
  folderDialogOpen.value = true
}

function saveModelFolder(): void {
  if (!model.value) return
  try {
    const before = captureModelStructure(model.value)
    const folders = model.value.folders.map(cloneStudioModelFolder)
    if (folderRenameTarget.value) {
      const index = folders.findIndex((entry) => entry.id === folderRenameTarget.value?.id)
      if (index < 0) return
      folders.splice(index, 1, renameModelFolder(folders[index]!, folderName.value))
    } else {
      folders.push(createModelFolder(model.value, folderName.value || 'Folder', folderParentId.value))
    }
    history.execute(updateModelStructureCommand(before, {
      elements: model.value.elements.map(cloneStudioCube),
      groups: model.value.groups.map(cloneStudioGroup),
      folders,
    }, folderRenameTarget.value ? 'Rename model folder' : 'Create model folder'), model.value)
    folderDialogOpen.value = false
    bumpHistory()
    scheduleSave()
  } catch (error) {
    toasts.push({
      type: 'warning',
      message: error instanceof ModelFolderError ? error.message : 'The model folder could not be saved.',
    })
  }
}

function confirmDeleteModelFolder(folderId: string): void {
  const folder = model.value?.folders.find((entry) => entry.id === folderId)
  if (!folder) return
  folderDeleteTarget.value = folder
  outlinerOpen.value = false
  folderDeleteOpen.value = true
}

function deleteModelFolder(): void {
  if (!model.value || !folderDeleteTarget.value) return
  try {
    const before = captureModelStructure(model.value)
    const after = removeModelFolder(model.value, folderDeleteTarget.value.id)
    history.execute(updateModelStructureCommand(before, after, 'Delete model folder'), model.value)
    folderDeleteOpen.value = false
    bumpHistory()
    scheduleSave()
  } catch (error) {
    toasts.push({ type: 'warning', message: error instanceof Error ? error.message : 'The model folder could not be deleted.' })
  }
}

function moveSelectionToFolder(folderId?: string): void {
  if (!model.value || !selectedNodeIds.value.length) return
  try {
    const before = captureModelStructure(model.value)
    const working = cloneStudioModel(model.value)
    for (const id of normalizeSelectionIds(working, selectedNodeIds.value)) {
      const moved = moveNodeToFolder(working, id, folderId)
      working.elements = moved.elements
      working.groups = moved.groups
    }
    history.execute(updateModelStructureCommand(before, captureModelStructure(working), 'Move selection to folder'), model.value)
    moveToFolderOpen.value = false
    objectActionsOpen.value = false
    bumpHistory()
    scheduleSave()
  } catch (error) {
    toasts.push({ type: 'warning', message: error instanceof Error ? error.message : 'The selection could not be moved.' })
  }
}

function selectInflateHandle(handle: StudioInflateHandle): void {
  if (!model.value) return
  if (!inflateSource.value) {
    inflateSource.value = handle
    return
  }
  const source = model.value.elements.find((cube) => cube.id === inflateSource.value?.cubeId)
  const target = model.value.elements.find((cube) => cube.id === handle.cubeId)
  if (!source || !target) {
    inflateSource.value = undefined
    return
  }
  try {
    const fitted = fitInflateHandle(source, inflateSource.value, target, handle, currentResizeSnap.value)
    history.execute(updateElementCommand(source, fitted.cube, `Inflate fit ${fitted.axes.map((axis) => axis.toUpperCase()).join('/')}`), model.value)
    selectedNodeId.value = source.id
    inflateSource.value = undefined
    bumpHistory()
    scheduleSave()
  } catch (error) {
    toasts.push({ type: 'warning', message: error instanceof Error ? error.message : 'Those Inflate points cannot be fitted.' })
  }
}

function openExportModel(): void {
  if (!model.value) return
  moreOpen.value = false
  exportName.value = model.value.name
  exportIdentifier.value = model.value.identifier
  exportApplyIdentity.value = false
  exportError.value = ''
  exportModelOpen.value = true
}

function exportModelJson(): void {
  if (!model.value) return
  exportError.value = ''
  if (!exportName.value.trim()) {
    exportError.value = 'Model name is required.'
    return
  }
  if (!isValidModelIdentifier(exportIdentifier.value.trim())) {
    exportError.value = 'Use geometry.namespace.name with lowercase letters, numbers, and underscores.'
    return
  }
  exportBusy.value = true
  try {
    const json = serializeStudioModelJson(model.value, {
      name: exportName.value,
      identifier: exportIdentifier.value,
    })
    downloadBlob(new Blob([json], { type: 'application/json' }), modelJsonFilename(exportName.value))
    if (exportApplyIdentity.value) {
      model.value.name = exportName.value.trim()
      model.value.identifier = exportIdentifier.value.trim()
      scheduleSave()
    }
    exportModelOpen.value = false
    toasts.push({ type: 'success', message: 'Model JSON exported' })
  } catch (error) {
    exportError.value = error instanceof Error ? error.message : 'Model could not be exported.'
  } finally {
    exportBusy.value = false
  }
}

function undo(): void {
  if (!model.value) return
  const command = history.undo(model.value)
  if (!command) return
  selectedNodeIds.value = selectedNodeIds.value.filter((id) => Boolean(getStudioNode(model.value!, id)))
  bumpHistory()
  scheduleSave()
}

function redo(): void {
  if (!model.value) return
  const command = history.redo(model.value)
  if (!command) return
  bumpHistory()
  scheduleSave()
}

function chooseTool(nextTool: ModelTransformTool): void {
  if (nextTool !== 'select' && !selectionTransformable.value) return
  if (nextTool === 'inflate' && (selectionCount.value !== 1 || selectedNode.value?.type !== 'cube')) return
  if (selectionCount.value > 1 && !['select', 'move'].includes(nextTool)) return
  if (nextTool !== 'inflate') inflateSource.value = undefined
  tool.value = nextTool
}

function beginNumericEdit(): void {
  if (!model.value || !selectedNodeId.value || selectionCount.value !== 1 || !selectionTransformable.value) return
  numericSession = captureNodeTransform(model.value, selectedNodeId.value)
}

function previewNumericNode(payload: {
  node: StudioModelNode
  operation: 'generic' | 'move' | 'scale' | 'rotate'
  axis?: StudioAxis
}): void {
  if (!model.value) return
  numericSession ??= captureNodeTransform(model.value, payload.node.id)
  if (!numericSession) return
  applyHierarchyState(model.value, buildNodeTransformState(numericSession, payload.node, {
    operation: payload.operation,
    axis: payload.axis,
    resizeDirection: model.value.editor.modeling.resizeDirection,
    transformSpace: model.value.editor.modeling.transformSpace,
  }))
}

function commitNumericNode(payload: {
  after: StudioModelNode
  label: string
  operation: 'generic' | 'move' | 'scale' | 'rotate'
  axis?: StudioAxis
}): void {
  if (!model.value) return
  numericSession ??= captureNodeTransform(model.value, payload.after.id)
  if (!numericSession) return
  // TransformPropertiesSheet always flushes a preview immediately before this
  // commit. Record that already-applied hierarchy instead of calculating the
  // transform again from a draft that can contain derived center coordinates.
  const applied = captureNodeTransform(model.value, payload.after.id)
  if (!applied) return
  commitHierarchy({ before: numericSession.before, after: applied.before, label: payload.label })
  numericSession = undefined
}

function beginPivotEdit(): void {
  if (!model.value || !selectedNodeId.value || selectionCount.value !== 1 || !selectionTransformable.value) return
  pivotSession = captureNodeTransform(model.value, selectedNodeId.value)
}

function previewPivot(pivot: StudioVector3): void {
  if (!model.value || !selectedNodeId.value) return
  pivotSession ??= captureNodeTransform(model.value, selectedNodeId.value)
  if (!pivotSession) return
  applyHierarchyState(model.value, buildPivotState(pivotSession, pivot))
}

function commitPivot(payload: { pivot: StudioVector3; label: string }): void {
  if (!model.value || !selectedNodeId.value) return
  pivotSession ??= captureNodeTransform(model.value, selectedNodeId.value)
  if (!pivotSession) return
  const after = buildPivotState(pivotSession, payload.pivot)
  commitHierarchy({ before: pivotSession.before, after, label: payload.label })
  pivotSession = undefined
}

function setCameraView(view: StudioCameraView, viewportIndex = activeViewport.value): void {
  if (!model.value) return
  model.value.editor.viewportViews[viewportIndex] = view
  scheduleSave()
}

function setViewportLayout(layout: 1 | 2): void {
  if (!model.value) return
  model.value.editor.viewportLayout = layout
  activeViewport.value = Math.min(activeViewport.value, layout - 1)
  maximizedViewport.value = undefined
  scheduleSave()
}

function toggleMaximize(index: number): void {
  maximizedViewport.value = maximizedViewport.value === index ? undefined : index
  activeViewport.value = index
}

function updateModelingSettings(settings: StudioModelingSettings): void {
  if (!model.value) return
  model.value.editor.modeling = {
    ...settings,
    controlMode: settings.controlMode === 'tactilismos' ? 'touch-gizmo' : settings.controlMode,
  }
  if (locale.language !== settings.language) locale.setLanguage(settings.language)
  scheduleSave()
}

function updateSnappingSettings(settings: StudioSnappingSettings): void {
  if (!model.value) return
  model.value.editor.snapping = { ...settings }
  scheduleSave()
}

function updateCameraSettings(settings: StudioCameraSettings): void {
  if (!model.value) return
  model.value.editor.camera = { ...settings }
  scheduleSave()
}

function updateExperimentalSettings(settings: StudioExperimentalSettings): void {
  if (!model.value) return
  model.value.editor.experimental = { ...settings }
  scheduleSave()
}

function updateTransformSpace(space: StudioModelingSettings['transformSpace']): void {
  if (!model.value) return
  model.value.editor.modeling.transformSpace = space
  scheduleSave()
}

function resetModelStudioSettings(): void {
  if (!model.value) return
  model.value.editor = resetEditorPreferences(model.value.editor, locale.language)
  resetSettingsOpen.value = false
  scheduleSave()
}

function showObjectActions(id: string): void {
  if (!selectedNodeIds.value.includes(id)) selectNode(id)
  outlinerOpen.value = false
  objectActionsOpen.value = true
}

function selectNode(id?: string, additive = false): void {
  if (!id) {
    selectedNodeIds.value = []
  } else if (additive || multiSelectMode.value) {
    const next = selectedNodeIds.value.includes(id)
      ? selectedNodeIds.value.filter((entry) => entry !== id)
      : [...selectedNodeIds.value, id]
    selectedNodeIds.value = model.value ? normalizeSelectionIds(model.value, next) : next
  } else {
    selectedNodeIds.value = [id]
  }
  if (id) selectedReferenceId.value = undefined
}

function selectReference(id?: string): void {
  selectedReferenceId.value = id
  if (id) selectedNodeId.value = undefined
}

function selectNodeFromOutliner(id: string, additive = false): void {
  selectNode(id, additive)
  if (!additive && !multiSelectMode.value) outlinerOpen.value = false
  tool.value = 'select'
}

function setMultiSelect(enabled: boolean): void {
  multiSelectMode.value = enabled
  tool.value = 'select'
}

function editReference(id: string): void {
  selectReference(id)
  outlinerOpen.value = false
  referencesOpen.value = false
  referencePropertiesOpen.value = true
}

function updateReference(reference: StudioReferenceImage): void {
  if (!model.value) return
  const index = model.value.references.findIndex((entry) => entry.id === reference.id)
  if (index < 0) return
  model.value.references.splice(index, 1, cloneStudioReference(reference))
  scheduleSave()
}

function commitReference(payload: { before: StudioReferenceImage; after: StudioReferenceImage; label: string }): void {
  if (!model.value) return
  const index = model.value.references.findIndex((entry) => entry.id === payload.after.id)
  if (index < 0) return
  model.value.references.splice(index, 1, cloneStudioReference(payload.after))
  history.recordApplied(updateReferenceCommand(payload.before, payload.after, payload.label))
  bumpHistory()
  scheduleSave()
}

function toggleReference(id: string): void {
  if (!model.value) return
  const reference = model.value.references.find((entry) => entry.id === id)
  if (!reference) return
  const before = cloneStudioReference(reference)
  const after = cloneStudioReference(reference)
  after.visible = !after.visible
  history.execute(updateReferenceCommand(before, after, after.visible ? 'Show reference' : 'Hide reference'), model.value)
  bumpHistory()
  scheduleSave()
}

function confirmDeleteReference(id: string): void {
  const reference = model.value?.references.find((entry) => entry.id === id)
  if (!reference) return
  outlinerOpen.value = false
  deleteReferenceTarget.value = reference
  deleteReferenceOpen.value = true
}

async function deleteReference(): Promise<void> {
  if (!model.value || !deleteReferenceTarget.value) return
  const reference = deleteReferenceTarget.value
  try {
    await modelPersistenceService.flush(model.value.id)
    model.value = await modelRepository.deleteReference(model.value, reference.id)
    assets.value = assets.value.filter((asset) => asset.id !== reference.assetId)
    refreshAssetUrls()
    if (selectedReferenceId.value === reference.id) selectedReferenceId.value = undefined
    deleteReferenceOpen.value = false
    saveStatus.value = 'saved'
    toasts.push({ type: 'success', message: 'Reference image removed' })
  } catch (error) {
    toasts.push({
      type: 'error',
      message: toAppError(error, 'The reference image could not be removed.').userMessage,
    })
  }
}

function openReferencePicker(): void {
  referenceInput.value?.click()
}

function activeReferenceView(): StudioReferenceView {
  const view = model.value?.editor.viewportViews[activeViewport.value]
  return ['front', 'back', 'left', 'right', 'top', 'bottom'].includes(view ?? '')
    ? view as StudioReferenceView
    : 'front'
}

async function importReference(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !model.value) return
  importingReference.value = true
  try {
    await modelPersistenceService.flush(model.value.id)
    const result = await modelRepository.addReferenceAsset(model.value, file, activeReferenceView())
    model.value = result.model
    assets.value = [...assets.value, result.asset]
    refreshAssetUrls()
    selectedReferenceId.value = result.reference.id
    selectedNodeId.value = undefined
    referencesOpen.value = false
    referencePropertiesOpen.value = true
    saveStatus.value = 'saved'
    toasts.push({ type: 'success', message: 'Reference image added' })
  } catch (error) {
    toasts.push({
      type: 'error',
      message: toAppError(error, 'The reference image could not be opened.').userMessage,
    })
  } finally {
    input.value = ''
    importingReference.value = false
  }
}

function openBackgroundPicker(): void {
  backgroundInput.value?.click()
}

function selectBackground(type: StudioEditorBackgroundType): void {
  if (!model.value) return
  if (type === 'custom' && !customBackgroundAsset.value) {
    openBackgroundPicker()
    return
  }
  model.value.editor.background = { ...model.value.editor.background, type }
  scheduleSave()
}

function updateBackground(settings: StudioEditorBackgroundSettings): void {
  if (!model.value) return
  model.value.editor.background = {
    ...settings,
    opacity: Math.min(1, Math.max(0.1, Number(settings.opacity) || 0.1)),
    brightness: Math.min(1.5, Math.max(0.25, Number(settings.brightness) || 0.25)),
  }
  scheduleSave()
}

async function importBackground(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !model.value) return
  importingBackground.value = true
  try {
    await modelPersistenceService.flush(model.value.id)
    const previousId = model.value.editor.background.customAssetId
    const result = await modelRepository.addBackgroundAsset(model.value, file)
    model.value = result.model
    assets.value = [
      ...assets.value.filter((asset) => asset.id !== previousId),
      result.asset,
    ]
    refreshAssetUrls()
    saveStatus.value = 'saved'
    toasts.push({ type: 'success', message: 'Custom editor background added' })
  } catch (error) {
    toasts.push({
      type: 'error',
      message: toAppError(error, 'This editor background image could not be opened.').userMessage,
    })
  } finally {
    input.value = ''
    importingBackground.value = false
  }
}

async function removeCustomBackground(): Promise<void> {
  if (!model.value) return
  const assetId = model.value.editor.background.customAssetId
  try {
    await modelPersistenceService.flush(model.value.id)
    model.value = await modelRepository.removeBackgroundAsset(model.value)
    assets.value = assets.value.filter((asset) => asset.id !== assetId)
    refreshAssetUrls()
    saveStatus.value = 'saved'
    toasts.push({ type: 'info', message: 'Editor background reset to Dark Studio' })
  } catch (error) {
    toasts.push({
      type: 'error',
      message: toAppError(error, 'The custom editor background could not be removed.').userMessage,
    })
  }
}

function showOutliner(): void {
  moreOpen.value = false
  outlinerOpen.value = true
}
</script>

<template>
  <main class="model-studio">
    <header class="studio-topbar">
      <IconButton
        icon="arrow-left"
        :label="locale.t('Back to Models')"
        @click="router.push({ name: 'models', params: { projectId } })"
      />
      <div class="studio-topbar__title">
        <strong>{{ model?.name ?? locale.t('Model Studio') }}</strong>
        <small :class="`save-status--${saveStatus}`">
          {{ locale.t(saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? 'Save failed' : 'Saved') }}
        </small>
      </div>
      <IconButton icon="undo" :label="locale.t('Undo')" :disabled="!canUndo" @click="undo" />
      <IconButton icon="redo" :label="locale.t('Redo')" :disabled="!canRedo" @click="redo" />
      <IconButton icon="more-vertical" :label="locale.t('Model menu')" @click="moreOpen = true" />
    </header>

    <section v-if="loading" class="studio-loading" :aria-label="locale.t('Opening Model Studio')">
      <div class="studio-loading__message"><span class="spinner" />{{ locale.t('Preparing 3D workspace…') }}</div>
    </section>

    <section v-else-if="loadError || !model" class="studio-error">
      <span><AppIcon name="alert-triangle" :size="31" /></span>
      <h1>{{ locale.t('Model unavailable') }}</h1>
      <p>{{ loadError || locale.t('This model could not be found.') }}</p>
      <AppButton @click="router.replace({ name: 'models', params: { projectId } })">{{ locale.t('Back to Models') }}</AppButton>
    </section>

    <template v-else>
      <section
        class="studio-viewports"
        :class="[`studio-viewports--${viewportCount}`, { 'studio-viewports--maximized': maximizedViewport !== undefined }]"
      >
        <ModelViewport
          v-for="index in visibleViewportIndexes"
          :key="index"
          class="studio-viewport"
          :model="model"
          :asset-urls="assetUrls"
          :background="model.editor.background"
          :selected-node-id="selectedNodeId"
          :selected-node-ids="selectedNodeIds"
          :selected-reference-id="selectedReferenceId"
          :tool="tool"
          :view="model.editor.viewportViews[index] ?? 'perspective'"
          :active="activeViewport === index"
          :low-power="viewportCount > 1 && activeViewport !== index"
          :maximized="maximizedViewport === index"
          :can-maximize="viewportCount > 1"
          :transform-snap="currentTransformSnap"
          :resize-snap="currentResizeSnap"
          :rotation-snap="currentRotationSnap"
          :resize-direction="model.editor.modeling.resizeDirection"
          :control-mode="model.editor.modeling.controlMode"
          :transform-space="model.editor.modeling.transformSpace"
          :camera-settings="model.editor.camera"
          :touch-rotate-enabled="model.editor.experimental.touchRotate"
          :interaction-locked="interactionLocked"
          :inflate-source="inflateSource"
          :multi-select="multiSelectMode"
          :isolated-element-ids="isolatedIds"
          @activate="activeViewport = index"
          @toggle-maximize="toggleMaximize(index)"
          @update-view="setCameraView($event, index)"
          @update-transform-space="updateTransformSpace"
          @select-node="selectNode"
          @select-reference="selectReference"
          @preview-hierarchy="previewHierarchy"
          @commit-hierarchy="commitHierarchy"
          @select-inflate-handle="selectInflateHandle"
          @error="handleViewportError"
        />
      </section>

      <nav class="studio-toolbar" :aria-label="locale.t('Modeling tools')">
        <div class="studio-toolbar__scroll">
          <button
            v-for="entry in tools"
            :key="entry.id"
            type="button"
            :class="{ 'tool-button--active': tool === entry.id }"
            :disabled="entry.id !== 'select' && (!selectionTransformable || (selectionCount > 1 && entry.id !== 'move') || (entry.id === 'inflate' && selectedNode?.type !== 'cube'))"
            @click="chooseTool(entry.id)"
          >
            <StudioIcon v-if="entry.id === 'inflate'" name="inflate" :size="21" />
            <AppIcon v-else :name="entry.icon" :size="21" />
            <span>{{ locale.t(entry.label) }}</span>
          </button>
          <button type="button" :class="{ 'tool-button--active': multiSelectMode }" @click="setMultiSelect(!multiSelectMode)">
            <AppIcon name="check" :size="21" />
            <span>{{ multiSelectMode ? `${locale.t('Multi-select')} ${selectionCount}` : locale.t('Multi-select') }}</span>
          </button>
          <button type="button" class="tool-button--create" @click="addCube">
            <AppIcon name="plus" :size="21" />
            <span>{{ locale.t('Cube') }}</span>
          </button>
          <button type="button" @click="addGroup">
            <AppIcon name="folder-plus" :size="21" />
            <span>{{ locale.t('Group') }}</span>
          </button>
          <button
            v-if="selectionCount === 1 && selectedNode && selectionTransformable"
            type="button"
            @click="propertiesOpen = true"
          >
            <AppIcon name="sliders" :size="21" />
            <span>{{ locale.t('Values') }}</span>
          </button>
          <button v-if="selectionCount" type="button" @click="objectActionsOpen = true">
            <AppIcon name="more-vertical" :size="21" />
            <span>{{ locale.t('Object') }}</span>
          </button>
          <button
            v-if="selectedReference"
            type="button"
            @click="referencePropertiesOpen = true"
          >
            <AppIcon name="sliders" :size="21" />
            <span>{{ locale.t('Reference') }}</span>
          </button>
        </div>
      </nav>

      <input
        ref="referenceInput"
        class="visually-hidden"
        type="file"
        accept="image/png,image/jpeg,.png,.jpg,.jpeg"
        @change="importReference"
      />
      <input
        ref="backgroundInput"
        class="visually-hidden"
        type="file"
        accept="image/png,image/jpeg,.png,.jpg,.jpeg"
        @change="importBackground"
      />

      <TransformPropertiesSheet
        :open="propertiesOpen"
        :node="selectedNode"
        @close="propertiesOpen = false"
        @begin="beginNumericEdit"
        @preview="previewNumericNode"
        @commit="commitNumericNode"
      />
      <ModelSettingsSheet
        :open="settingsOpen"
        :settings="model.editor.modeling"
        :snapping="model.editor.snapping"
        :camera="model.editor.camera"
        :experimental="model.editor.experimental"
        @close="settingsOpen = false"
        @update="updateModelingSettings"
        @update-snapping="updateSnappingSettings"
        @update-camera="updateCameraSettings"
        @update-experimental="updateExperimentalSettings"
        @open-background="settingsOpen = false; guideWorkflowOpen = true"
        @request-reset="settingsOpen = false; resetSettingsOpen = true"
      />
      <PivotPropertiesSheet
        :open="pivotPropertiesOpen"
        :model="model"
        :node="selectedNode"
        @close="pivotPropertiesOpen = false"
        @begin="beginPivotEdit"
        @preview="previewPivot"
        @commit="commitPivot"
      />
      <ReferencePropertiesSheet
        :open="referencePropertiesOpen"
        :reference="selectedReference"
        @close="referencePropertiesOpen = false"
        @update="updateReference"
        @commit="commitReference"
        @delete="confirmDeleteReference"
      />
      <ReferencesManagerSheet
        :open="referencesOpen"
        :references="model.references"
        :asset-urls="assetUrls"
        :importing="importingReference"
        @close="referencesOpen = false"
        @add="openReferencePicker"
        @edit="editReference"
        @toggle="toggleReference"
        @delete="confirmDeleteReference"
      />
      <BackgroundSettingsSheet
        :open="backgroundOpen"
        :background="model.editor.background"
        :has-custom-image="Boolean(customBackgroundAsset)"
        :importing="importingBackground"
        @close="backgroundOpen = false"
        @select="selectBackground"
        @import="openBackgroundPicker"
        @remove-custom="removeCustomBackground"
        @update="updateBackground"
      />
      <ModelOutlinerSheet
        :open="outlinerOpen"
        :model="model"
        :selected-node-id="selectedNodeId"
        :selected-node-ids="selectedNodeIds"
        :multi-select="multiSelectMode"
        :isolation-active="isolationActive"
        @close="outlinerOpen = false"
        @select-node="selectNodeFromOutliner"
        @create-group="addGroup"
        @create-folder="openCreateFolder"
        @rename-folder="openRenameFolder"
        @delete-folder="confirmDeleteModelFolder"
        @show-actions="showObjectActions"
        @toggle-element="toggleElement"
        @toggle-group="toggleGroup"
        @toggle-node-lock="toggleNodeLock"
        @set-multi-select="setMultiSelect"
        @exit-isolation="exitIsolation"
      />

      <BottomSheet
        :open="viewsOpen"
        :title="locale.t('Viewport Layout')"
        :description="locale.t('Choose one or two mobile-optimized viewports')"
        @close="viewsOpen = false"
      >
        <div class="view-sheet">
          <section>
            <h3>{{ locale.t('Layout') }}</h3>
            <div class="choice-grid choice-grid--two">
              <button type="button" :class="{ active: viewportCount === 1 }" @click="setViewportLayout(1)">{{ locale.t('1 Viewport') }}</button>
              <button type="button" :class="{ active: viewportCount === 2 }" @click="setViewportLayout(2)">{{ locale.t('2 Viewports') }}</button>
            </div>
            <p>{{ locale.t('Three and four viewports are coming later after mobile performance validation.') }}</p>
          </section>
        </div>
      </BottomSheet>

      <BottomSheet
        :open="objectActionsOpen && selectionCount > 0"
        :title="selectionCount > 1 ? `${selectionCount} ${locale.t('Selected Objects')}` : selectedNode?.name ?? locale.t('Object')"
        :description="locale.t(selectionCount > 1 ? 'Multi-selection actions' : selectedNode?.type === 'group' ? 'Group actions' : 'Cube actions')"
        @close="objectActionsOpen = false"
      >
        <div class="studio-menu">
          <button type="button" @click="duplicateNode()">
            <span><AppIcon name="copy" :size="22" /></span>
            <span><strong>{{ locale.t('Duplicate') }}</strong><small>{{ locale.t('Creates an independent copy with a new ID') }}</small></span>
          </button>
          <button type="button" :disabled="!canDuplicateAgain" @click="duplicateAgain">
            <span><AppIcon name="copy" :size="22" /></span>
            <span><strong>{{ locale.t('Duplicate Again') }}</strong><small>{{ locale.t(canDuplicateAgain ? 'Repeats the previous duplicate offset' : 'Move a duplicate first to record its offset') }}</small></span>
          </button>
          <button v-if="selectionCount === 1 && selectedNode" type="button" @click="beginRenameNode(selectedNode.id)">
            <span><AppIcon name="pencil" :size="22" /></span>
            <span><strong>{{ locale.t('Rename') }}</strong><small>{{ locale.t('Change the Outliner name') }}</small></span>
          </button>
          <button v-if="selectionCount === 1 && selectedNode" type="button" :disabled="!selectionTransformable" @click="objectActionsOpen = false; pivotPropertiesOpen = true">
            <span><AppIcon name="crosshair" :size="22" /></span>
            <span><strong>{{ locale.t('Edit Pivot') }}</strong><small>{{ locale.t('Center, reset, move, or send to origin') }}</small></span>
          </button>
          <button v-if="selectionCount >= 2 && selectedAreCubes" type="button" :disabled="!selectionTransformable" @click="objectActionsOpen = false; addGroup()">
            <span><AppIcon name="boxes" :size="22" /></span>
            <span><strong>{{ locale.t('Create Group') }}</strong><small>{{ locale.t('Create one structural group from this selection') }}</small></span>
          </button>
          <button v-if="selectedAreCubes" type="button" :disabled="!selectionTransformable" @click="objectActionsOpen = false; moveToGroupOpen = true">
            <span><AppIcon name="folder-output" :size="22" /></span>
            <span><strong>{{ locale.t('Move to Group') }}</strong><small>{{ locale.t('Place the cube in a group or back at root') }}</small></span>
          </button>
          <button type="button" :disabled="!selectionCanMoveToFolder" @click="objectActionsOpen = false; moveToFolderOpen = true">
            <span><AppIcon name="folder-output" :size="22" /></span>
            <span><strong>{{ locale.t('Move to Folder') }}</strong><small>{{ locale.t(selectionCanMoveToFolder ? 'Organize cubes or groups without transforming them' : 'Move the containing group instead of one of its children') }}</small></span>
          </button>
          <button type="button" :disabled="!selectionTransformable" @click="objectActionsOpen = false; mirrorOpen = true">
            <span><AppIcon name="layers" :size="22" /></span>
            <span><strong>{{ locale.t('Mirror') }}</strong><small>{{ locale.t('Mirror in place or create a mirrored copy') }}</small></span>
          </button>
          <button v-if="selectedAreCubes && selectionCount >= 2" type="button" :disabled="!selectionTransformable" @click="objectActionsOpen = false; arrangeOpen = true">
            <span><AppIcon name="move-3d" :size="22" /></span>
            <span><strong>{{ locale.t('Align & Distribute') }}</strong><small>{{ locale.t('Arrange selected cube bounds on X, Y, or Z') }}</small></span>
          </button>
          <button type="button" @click="toggleNodeLock()">
            <span><AppIcon :name="selectionDirectlyLocked ? 'unlock' : 'lock'" :size="22" /></span>
            <span><strong>{{ locale.t(selectionDirectlyLocked ? 'Unlock Selection' : 'Lock Selection') }}</strong><small>{{ locale.t('Locked objects remain visible and accessible here') }}</small></span>
          </button>
          <button type="button" @click="setSelectionVisibility(!selectionVisible)">
            <span><AppIcon :name="selectionVisible ? 'eye-off' : 'eye'" :size="22" /></span>
            <span><strong>{{ locale.t(selectionVisible ? 'Hide Selection' : 'Show Selection') }}</strong><small>{{ locale.t('Changes intended model visibility') }}</small></span>
          </button>
          <button type="button" @click="isolationActive ? exitIsolation() : isolateSelection()">
            <span><AppIcon name="eye" :size="22" /></span>
            <span><strong>{{ locale.t(isolationActive ? 'Exit Isolation / Show All' : 'Isolate Selection') }}</strong><small>{{ locale.t('Temporary editor-only visibility') }}</small></span>
          </button>
          <button type="button" class="menu-action--danger" :disabled="selectionHasLockedNode" @click="confirmDeleteSelection">
            <span><AppIcon name="trash" :size="22" /></span>
            <span><strong>{{ locale.t('Delete Selection') }}</strong><small>{{ locale.t(selectionHasLockedNode ? 'Unlock objects or their parent group before deleting' : 'Undo is available during this session') }}</small></span>
          </button>
        </div>
      </BottomSheet>

      <BottomSheet
        :open="moveToGroupOpen && selectedAreCubes"
        :title="locale.t(selectionCount > 1 ? 'Move Cubes' : 'Move Cube')"
        :description="locale.t('Groups are one level deep in this Alpha')"
        @close="moveToGroupOpen = false"
      >
        <div class="move-list">
          <button type="button" :class="{ active: selectedCubes.every((cube) => !cube.parentId) }" @click="moveCubeToGroup()">
            <AppIcon name="list-tree" :size="20" /><span><strong>{{ locale.t('Model Root') }}</strong><small>{{ locale.t('Outside every group') }}</small></span>
          </button>
          <button
            v-for="group in model.groups"
            :key="group.id"
            type="button"
            :class="{ active: selectedCubes.every((cube) => cube.parentId === group.id) }"
            @click="moveCubeToGroup(group.id)"
          >
            <AppIcon name="folder" :size="20" /><span><strong>{{ group.name }}</strong><small>{{ locale.t('Move into group') }}</small></span>
          </button>
        </div>
      </BottomSheet>

      <BottomSheet
        :open="moveToFolderOpen"
        :title="locale.t('Move to Folder')"
        :description="locale.t('Model folders organize the Outliner only; they never transform geometry')"
        @close="moveToFolderOpen = false"
      >
        <div class="move-list">
          <button type="button" @click="moveSelectionToFolder()">
            <AppIcon name="list-tree" :size="20" /><span><strong>{{ locale.t('Model Root') }}</strong><small>{{ locale.t('Outside every model folder') }}</small></span>
          </button>
          <button
            v-for="folder in model.folders"
            :key="folder.id"
            type="button"
            @click="moveSelectionToFolder(folder.id)"
          >
            <AppIcon name="folder-open" :size="20" /><span><strong>{{ folder.parentId ? `↳ ${folder.name}` : folder.name }}</strong><small>{{ locale.t('Organizational folder') }}</small></span>
          </button>
        </div>
      </BottomSheet>

      <BottomSheet
        :open="mirrorOpen"
        :title="locale.t('Mirror Selection')"
        :description="locale.t('Mirror around the shared selection center on one axis')"
        @close="mirrorOpen = false"
      >
        <div class="mirror-sheet">
          <section v-for="axis in (['x', 'y', 'z'] as const)" :key="axis">
            <h3>{{ axis.toUpperCase() }} {{ locale.t('Axis') }}</h3>
            <div class="mirror-actions">
              <button type="button" @click="mirrorSelection(axis, false)">
                <strong>{{ locale.t('Mirror in Place') }}</strong>
                <small>{{ locale.t('Flip the current selection') }}</small>
              </button>
              <button type="button" @click="mirrorSelection(axis, true)">
                <strong>{{ locale.t('Duplicate + Mirror') }}</strong>
                <small>{{ locale.t('Keep the original and create a mirrored copy') }}</small>
              </button>
            </div>
          </section>
        </div>
      </BottomSheet>

      <BottomSheet
        :open="arrangeOpen"
        :title="locale.t('Align & Distribute')"
        :description="`${selectionCount} ${locale.t('cubes selected · operations use their visible bounds')}`"
        @close="arrangeOpen = false"
      >
        <div class="arrange-sheet">
          <section v-for="axis in (['x', 'y', 'z'] as const)" :key="axis">
            <h3>{{ axis.toUpperCase() }} {{ locale.t('Axis') }}</h3>
            <div class="arrange-actions">
              <button v-for="alignment in (['min', 'center', 'max'] as const)" :key="alignment" type="button" @click="alignSelection(axis, alignment)">
                {{ locale.t(alignment === 'min' ? 'Min' : alignment === 'max' ? 'Max' : 'Center') }}
              </button>
              <button type="button" :disabled="selectedCubes.length < 3" @click="distributeSelection(axis)">
                {{ locale.t('Distribute') }}
              </button>
            </div>
          </section>
        </div>
      </BottomSheet>

      <BottomSheet
        :open="moreOpen"
        :title="locale.t('Model Studio')"
        :description="model.identifier"
        @close="moreOpen = false"
      >
        <div class="studio-menu">
          <button type="button" @click="showOutliner">
            <span><AppIcon name="list-tree" :size="22" /></span>
            <span><strong>{{ locale.t('Outliner') }}</strong><small>{{ locale.t('Select, organize, lock, isolate, and edit objects') }}</small></span>
          </button>
          <button type="button" @click="moreOpen = false; guideWorkflowOpen = true">
            <span><AppIcon name="palette" :size="22" /></span>
            <span><strong>{{ locale.t('Background / Guide') }}</strong><small>{{ locale.t('Environment, custom image, or viewport-aligned modeling guide') }}</small></span>
          </button>
          <button type="button" @click="moreOpen = false; viewsOpen = true">
            <span><AppIcon name="camera" :size="22" /></span>
            <span><strong>{{ locale.t('Viewport Layout') }}</strong><small>{{ locale.t('Use one or two synchronized mobile viewports') }}</small></span>
          </button>
          <button type="button" @click="moreOpen = false; settingsOpen = true">
            <span><AppIcon name="settings" :size="22" /></span>
            <span><strong>{{ locale.t('Model Studio Settings') }}</strong><small>{{ locale.t('Controls, precision, camera, appearance, and experiments') }}</small></span>
          </button>
          <button type="button" @click="openExportModel">
            <span><AppIcon name="upload" :size="22" /></span>
            <span><strong>{{ locale.t('Export Model') }}</strong><small>{{ locale.t('Validated portable Addons Studio .model.json') }}</small></span>
          </button>
          <button type="button" @click="saveNow">
            <span><AppIcon name="save" :size="22" /></span>
            <span><strong>{{ locale.t('Save Now') }}</strong><small>{{ locale.t('Autosave is already active') }}</small></span>
          </button>
          <button type="button" disabled>
            <span><AppIcon name="palette" :size="22" /></span>
            <span><strong>{{ locale.t('Materials') }}</strong><small>{{ locale.t('Coming soon') }}</small></span>
          </button>
        </div>
      </BottomSheet>

      <BottomSheet
        :open="guideWorkflowOpen"
        :title="locale.t('Background / Guide')"
        :description="locale.t('References guide geometry; backgrounds change only the editor atmosphere')"
        @close="guideWorkflowOpen = false"
      >
        <div class="studio-menu">
          <button type="button" @click="guideWorkflowOpen = false; referencesOpen = true">
            <span><AppIcon name="image-plus" :size="22" /></span>
            <span><strong>{{ locale.t('References') }}</strong><small>{{ locale.t('Viewport-aligned guides that never become geometry or block selection') }}</small></span>
          </button>
          <button type="button" @click="guideWorkflowOpen = false; backgroundOpen = true">
            <span><AppIcon name="palette" :size="22" /></span>
            <span><strong>{{ locale.t('Editor Background') }}</strong><small>{{ locale.t('Dark Studio, Sky, Night, Sunset, Snow, or a custom image') }}</small></span>
          </button>
        </div>
      </BottomSheet>

      <AppDialog :open="renameOpen" :title="`${locale.t('Rename')} ${locale.t(renameTargetType === 'group' ? 'Group' : 'Cube')}`" @close="renameOpen = false">
        <label class="field-label" for="rename-model-element">{{ locale.t('Object Name') }}</label>
        <input
          id="rename-model-element"
          v-model="renameValue"
          class="text-input"
          maxlength="60"
          autocomplete="off"
          @keydown.enter.prevent="renameNode"
        />
        <template #actions>
          <AppButton variant="ghost" @click="renameOpen = false">{{ locale.t('Cancel') }}</AppButton>
          <AppButton :disabled="!renameValue.trim()" @click="renameNode">{{ locale.t('Rename') }}</AppButton>
        </template>
      </AppDialog>

      <AppDialog
        :open="folderDialogOpen"
        :title="folderRenameTarget ? `${locale.t('Rename')} “${folderRenameTarget.name}”` : folderParentId ? locale.t('Create Nested Folder') : locale.t('New Model Folder')"
        :description="locale.t(folderParentId ? 'Snapshot 3 supports one child folder per root folder.' : 'Folders organize the Outliner and never transform geometry.')"
        @close="folderDialogOpen = false"
      >
        <label class="field-label" for="model-folder-name">{{ locale.t('Folder Name') }}</label>
        <input
          id="model-folder-name"
          v-model="folderName"
          class="text-input"
          maxlength="80"
          autocomplete="off"
          @keydown.enter.prevent="saveModelFolder"
        />
        <template #actions>
          <AppButton variant="ghost" @click="folderDialogOpen = false">{{ locale.t('Cancel') }}</AppButton>
          <AppButton :disabled="!folderName.trim()" @click="saveModelFolder">{{ folderRenameTarget ? locale.t('Rename') : locale.t('Create') }}</AppButton>
        </template>
      </AppDialog>

      <AppDialog
        :open="folderDeleteOpen"
        :title="`${locale.t('Delete')} “${folderDeleteTarget?.name ?? locale.t('folder')}”?`"
        :description="locale.t('Its cubes, groups, and child folder will move safely to the containing folder or model root. Geometry is not deleted.')"
        @close="folderDeleteOpen = false"
      >
        <template #actions>
          <AppButton variant="ghost" @click="folderDeleteOpen = false">{{ locale.t('Cancel') }}</AppButton>
          <AppButton variant="danger" @click="deleteModelFolder">{{ locale.t('Move Contents & Delete') }}</AppButton>
        </template>
      </AppDialog>

      <AppDialog
        :open="exportModelOpen"
        :title="locale.t('Export Model')"
        :description="locale.t('Review the portable model identity before Addons Studio validates and downloads the JSON.')"
        @close="exportModelOpen = false"
      >
        <div class="dialog-fields">
          <label class="field-label" for="export-model-name">{{ locale.t('Model name') }}</label>
          <input id="export-model-name" v-model="exportName" class="text-input" maxlength="80" autocomplete="off" />
          <label class="field-label" for="export-model-identifier">{{ locale.t('Identifier') }}</label>
          <input id="export-model-identifier" v-model="exportIdentifier" class="text-input" autocomplete="off" autocapitalize="none" spellcheck="false" />
          <label class="dialog-check"><input v-model="exportApplyIdentity" type="checkbox" />{{ locale.t("Also update this model's stored name and identifier") }}</label>
          <p v-if="exportError" class="dialog-error" role="alert">{{ exportError }}</p>
          <p class="dialog-note">{{ locale.t('Editor images stay in IndexedDB and are intentionally excluded from the primary JSON format.') }}</p>
        </div>
        <template #actions>
          <AppButton variant="ghost" @click="exportModelOpen = false">{{ locale.t('Cancel') }}</AppButton>
          <AppButton :loading="exportBusy" @click="exportModelJson">{{ locale.t('Export') }}</AppButton>
        </template>
      </AppDialog>

      <AppDialog
        :open="resetSettingsOpen"
        :title="`${locale.t('Reset Model Studio Settings')}?`"
        :description="locale.t('Controls, precision, camera, background preference, and Model Studio UI preferences return to defaults. Projects, geometry, and editor assets stay intact.')"
        @close="resetSettingsOpen = false"
      >
        <template #actions>
          <AppButton variant="ghost" @click="resetSettingsOpen = false">{{ locale.t('Cancel') }}</AppButton>
          <AppButton variant="danger" @click="resetModelStudioSettings">{{ locale.t('Reset') }}</AppButton>
        </template>
      </AppDialog>

      <AppDialog
        :open="deleteSelectionOpen"
        :title="`${locale.t('Delete')} ${selectionCount === 1 ? locale.t('selected object') : `${selectionCount} ${locale.t('selected objects')}`}?`"
        :description="locale.t('Groups are removed safely: any unselected children stay in the model and move to the model root. Undo remains available during this editing session.')"
        @close="deleteSelectionOpen = false"
      >
        <template #actions>
          <AppButton variant="ghost" @click="deleteSelectionOpen = false">{{ locale.t('Cancel') }}</AppButton>
          <AppButton variant="danger" @click="deleteSelectedNodes">{{ locale.t('Delete Selection') }}</AppButton>
        </template>
      </AppDialog>

      <AppDialog
        :open="deleteReferenceOpen"
        :title="`${locale.t('Delete')} “${deleteReferenceTarget?.name ?? locale.t('reference')}”?`"
        :description="locale.t('This removes only the modeling reference. It does not delete a project texture.')"
        @close="deleteReferenceOpen = false"
      >
        <template #actions>
          <AppButton variant="ghost" @click="deleteReferenceOpen = false">{{ locale.t('Cancel') }}</AppButton>
          <AppButton variant="danger" @click="deleteReference">{{ locale.t('Delete Reference') }}</AppButton>
        </template>
      </AppDialog>
    </template>
  </main>
</template>

<style scoped>
.model-studio {
  height: 100dvh;
  min-height: 20rem;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  overflow: hidden;
  background: #080b0d;
  color: #f4f7f5;
  --color-text: #f4f7f5;
  --color-text-muted: #bdc7c1;
  --color-text-subtle: #89978f;
  --color-surface: #111619;
  --color-surface-raised: #171d20;
  --color-surface-strong: #111619;
  --color-input-bg: #0c1012;
  --color-border: #27302c;
  --color-border-strong: #3b4740;
  --color-backdrop: rgb(0 0 0 / 0.68);
}

.studio-topbar {
  z-index: var(--z-header);
  min-height: calc(3.55rem + env(safe-area-inset-top));
  display: grid;
  grid-template-columns: var(--touch-target) minmax(0, 1fr) repeat(3, var(--touch-target));
  align-items: end;
  gap: 0.12rem;
  padding: env(safe-area-inset-top) max(0.35rem, env(safe-area-inset-right)) 0.28rem max(0.35rem, env(safe-area-inset-left));
  border-bottom: 1px solid #252e29;
  background: #0c1012;
}

.studio-topbar__title {
  min-width: 0;
  align-self: center;
  display: grid;
  padding: 0 0.35rem;
}

.studio-topbar__title strong,
.studio-topbar__title small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.studio-topbar__title strong { font-size: 0.82rem; }
.studio-topbar__title small { margin-top: 0.1rem; font-size: 0.58rem; }
.save-status--saved { color: #70d991; }
.save-status--saving { color: #f0c85a; }
.save-status--error { color: #ff7e87; }

.studio-viewports {
  min-width: 0;
  min-height: 0;
  display: grid;
  overflow: hidden;
}

.studio-viewports--2 { grid-template-rows: repeat(2, minmax(0, 1fr)); }
.studio-viewports--maximized { grid-template: minmax(0, 1fr) / minmax(0, 1fr); }
.studio-viewport { min-height: 0; }

.studio-toolbar {
  z-index: var(--z-navigation);
  min-width: 0;
  padding: 0.38rem max(0.35rem, env(safe-area-inset-right)) calc(0.38rem + env(safe-area-inset-bottom)) max(0.35rem, env(safe-area-inset-left));
  border-top: 1px solid #27302c;
  background: #0c1012;
}

.studio-toolbar__scroll {
  display: flex;
  gap: 0.3rem;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.studio-toolbar__scroll::-webkit-scrollbar { display: none; }

.studio-toolbar button {
  min-width: 3.55rem;
  min-height: 3.35rem;
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  border: 1px solid transparent;
  border-radius: 0.72rem;
  padding: 0.25rem 0.4rem;
  background: transparent;
  color: #aab6af;
}

.studio-toolbar button span { font-size: 0.58rem; font-weight: 720; }
.studio-toolbar button:disabled { opacity: 0.32; }
.studio-toolbar .tool-button--active {
  border-color: #3ca967;
  background: #123421;
  color: #72df98;
}

.studio-toolbar .tool-button--create {
  border-color: #34784d;
  background: #183c27;
  color: #80e5a1;
}

.studio-loading,
.studio-error {
  grid-row: 2 / 4;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: #080b0d;
}

.studio-loading__message {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  color: #abb8b0;
  font-size: 0.78rem;
}

.spinner {
  width: 1.35rem;
  height: 1.35rem;
  border: 2px solid #3b4740;
  border-right-color: #55cf7d;
  border-radius: 50%;
  animation: studio-spin 0.8s linear infinite;
}

@keyframes studio-spin { to { transform: rotate(360deg); } }

.studio-error {
  flex-direction: column;
  text-align: center;
}

.studio-error > span {
  width: 4rem;
  height: 4rem;
  display: grid;
  place-items: center;
  border-radius: var(--radius-xl);
  background: #332b13;
  color: #f3cb5c;
}

.studio-error h1 { margin: 1rem 0 0; font-size: 1.2rem; }
.studio-error p { max-width: 24rem; margin: 0.4rem 0 1.1rem; color: #aeb9b2; font-size: 0.78rem; line-height: 1.5; }

.studio-menu {
  display: grid;
  gap: 0.4rem;
}

.studio-menu button {
  min-height: 4rem;
  display: grid;
  grid-template-columns: 2.75rem minmax(0, 1fr);
  align-items: center;
  gap: 0.75rem;
  border: 0;
  border-radius: var(--radius-lg);
  padding: 0.55rem 0.65rem;
  background: transparent;
  color: var(--color-text);
  text-align: left;
}

.studio-menu button:active:not(:disabled) { background: var(--color-surface-raised); }
.studio-menu button:disabled { opacity: 0.52; }
.studio-menu button > span:first-child {
  width: 2.75rem;
  height: 2.75rem;
  display: grid;
  place-items: center;
  border-radius: var(--radius-md);
  background: var(--color-surface-raised);
  color: #6bd78e;
}
.studio-menu button > span:last-child { min-width: 0; display: grid; gap: 0.15rem; }
.studio-menu strong { font-size: 0.86rem; }
.studio-menu small { color: var(--color-text-subtle); font-size: 0.7rem; }
.studio-menu .menu-action--danger { color: #ff959c; }

.view-sheet,
.snap-sheet,
.mirror-sheet,
.arrange-sheet {
  display: grid;
  gap: var(--space-5);
  padding-bottom: var(--space-2);
}

.view-sheet section,
.snap-sheet section,
.mirror-sheet section,
.arrange-sheet section { display: grid; gap: var(--space-3); }
.view-sheet h3,
.snap-sheet h3,
.mirror-sheet h3,
.arrange-sheet h3 { margin: 0; color: var(--color-text-muted); font-size: 0.76rem; }
.view-sheet p { margin: 0; color: var(--color-text-subtle); font-size: 0.68rem; line-height: 1.45; }

.choice-grid,
.snap-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.42rem;
}

.choice-grid--two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.choice-grid button,
.snap-options button {
  min-height: var(--touch-target);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  background: var(--color-input-bg);
  color: var(--color-text-muted);
  font-size: 0.72rem;
  font-weight: 740;
}
.choice-grid button.active,
.snap-options button.active { border-color: var(--color-accent); background: #123421; color: #80e5a1; }
.snap-options--rotation { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.snap-sheet label {
  min-height: var(--touch-target);
  display: grid;
  grid-template-columns: 5rem minmax(0, 1fr);
  align-items: center;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  padding-left: var(--space-3);
  color: var(--color-text-muted);
  font-size: 0.72rem;
  font-weight: 740;
}
.snap-sheet input {
  min-height: var(--touch-target);
  border: 0;
  background: transparent;
  color: var(--color-text);
  font-family: var(--font-mono);
  font-size: 1rem;
}

.mirror-actions,
.arrange-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.42rem;
}

.mirror-actions button,
.arrange-actions button {
  min-height: var(--touch-target);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  padding: 0.55rem;
  background: var(--color-input-bg);
  color: var(--color-text-muted);
  font-size: 0.76rem;
  font-weight: 740;
}

.mirror-actions button {
  min-height: 4.25rem;
  display: grid;
  align-content: center;
  gap: 0.18rem;
  text-align: left;
}

.mirror-actions button:first-child,
.arrange-actions button:not(:last-child) { border-color: #34784d; }
.mirror-actions small { color: var(--color-text-subtle); font-size: 0.66rem; font-weight: 550; line-height: 1.35; }
.arrange-actions { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.arrange-actions button:disabled { opacity: 0.42; }

.model-studio :deep(input:not([type='range'])),
.model-studio :deep(select),
.model-studio :deep(textarea) {
  font-size: max(1rem, 16px);
}

.move-list { display: grid; gap: 0.42rem; padding-bottom: var(--space-2); }
.move-list button {
  min-height: 3.6rem;
  display: grid;
  grid-template-columns: 2.4rem minmax(0, 1fr);
  align-items: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 0.45rem 0.65rem;
  background: var(--color-surface-raised);
  color: var(--color-text);
  text-align: left;
}
.move-list button.active { border-color: var(--color-accent); box-shadow: inset 3px 0 var(--color-accent); }
.move-list button span { min-width: 0; display: grid; gap: 0.12rem; }
.move-list strong { font-size: 0.8rem; }
.move-list small { color: var(--color-text-subtle); font-size: 0.66rem; }

@media (orientation: landscape) {
  .studio-viewports--2:not(.studio-viewports--maximized) { grid-template: minmax(0, 1fr) / repeat(2, minmax(0, 1fr)); }
}

@media (orientation: landscape) and (max-height: 540px) {
  .studio-topbar { min-height: calc(3.15rem + env(safe-area-inset-top)); }
  .studio-toolbar button { min-height: 2.85rem; }
  .studio-toolbar { padding-top: 0.22rem; padding-bottom: calc(0.22rem + env(safe-area-inset-bottom)); }
}

@media (max-width: 370px) {
  .arrange-actions { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
