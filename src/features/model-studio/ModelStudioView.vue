<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import AppButton from '@/components/common/AppButton.vue'
import AppDialog from '@/components/common/AppDialog.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import BottomSheet from '@/components/common/BottomSheet.vue'
import IconButton from '@/components/common/IconButton.vue'
import { toAppError } from '@/core/errors/AppError'
import {
  createElementCommand,
  createGroupCommand,
  createNodesCommand,
  deleteElementCommand,
  deleteGroupCommand,
  deleteSelectionCommand,
  ModelCommandHistory,
  updateElementCommand,
  updateGroupCommand,
  updateHierarchyCommand,
  updateReferenceCommand,
} from '@/core/model/modelHistory'
import {
  cloneStudioCube,
  cloneStudioGroup,
  cloneStudioModel,
  cloneStudioReference,
  createStudioCube,
  createStudioGroup,
} from '@/core/model/modelFactory'
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
import { modelRepository } from '@/core/model/modelRepository'
import { useToastStore } from '@/stores/toasts'
import type {
  ModelReferenceAsset,
  ModelTransformTool,
  StudioCameraView,
  StudioGroup,
  StudioModel,
  StudioModelingSettings,
  StudioModelNode,
  StudioReferenceImage,
  StudioVector3,
} from '@/types/model'
import type { StudioAxis } from '@/core/model/modelHierarchy'

import ModelOutlinerSheet from './components/ModelOutlinerSheet.vue'
import ModelSettingsSheet from './components/ModelSettingsSheet.vue'
import ModelViewport from './components/ModelViewport.vue'
import PivotPropertiesSheet from './components/PivotPropertiesSheet.vue'
import ReferencePropertiesSheet from './components/ReferencePropertiesSheet.vue'
import TransformPropertiesSheet from './components/TransformPropertiesSheet.vue'

const props = defineProps<{ projectId: string; modelId: string }>()
const router = useRouter()
const toasts = useToastStore()
const model = ref<StudioModel>()
const assets = ref<ModelReferenceAsset[]>([])
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
const outlinerOpen = ref(false)
const moreOpen = ref(false)
const viewsOpen = ref(false)
const snappingOpen = ref(false)
const settingsOpen = ref(false)
const mirrorOpen = ref(false)
const arrangeOpen = ref(false)
const objectActionsOpen = ref(false)
const moveToGroupOpen = ref(false)
const deleteSelectionOpen = ref(false)
const multiSelectMode = ref(false)
const isolatedIds = ref<string[]>([])
const renameOpen = ref(false)
const renameValue = ref('')
const renameTargetId = ref<string>()
const renameTargetType = ref<'cube' | 'group'>('cube')
const deleteGroupOpen = ref(false)
const deleteGroupTarget = ref<StudioGroup>()
const deleteReferenceOpen = ref(false)
const deleteReferenceTarget = ref<StudioReferenceImage>()
const referenceInput = ref<HTMLInputElement>()
const importingReference = ref(false)
const saveStatus = ref<'saved' | 'saving' | 'error'>('saved')
const historyVersion = ref(0)
const history = new ModelCommandHistory()
const activeViewport = ref(0)
const maximizedViewport = ref<number>()
let numericSession: StudioNodeTransformSession | undefined
let pivotSession: StudioNodeTransformSession | undefined
let saveSequence = 0
const duplicateMemory = ref<{ ids: string[]; offset?: StudioVector3 }>()

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
const currentRotationSnap = computed(() => model.value?.editor.snapping.rotation ?? null)

const tools: readonly { id: ModelTransformTool; label: string; icon: string }[] = [
  { id: 'select', label: 'Select', icon: 'pointer' },
  { id: 'move', label: 'Move', icon: 'move-3d' },
  { id: 'rotate', label: 'Rotate', icon: 'rotate-3d' },
  { id: 'scale', label: 'Resize', icon: 'scale' },
  { id: 'pivot', label: 'Pivot', icon: 'crosshair' },
]

const cameraViews: readonly { id: StudioCameraView; label: string }[] = [
  { id: 'perspective', label: 'Perspective' },
  { id: 'isometric', label: 'Isometric' },
  { id: 'front', label: 'Front' },
  { id: 'back', label: 'Back' },
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
  { id: 'top', label: 'Top' },
  { id: 'bottom', label: 'Bottom' },
]

onMounted(async () => {
  try {
    const [storedModel, storedAssets] = await Promise.all([
      modelRepository.getModel(props.modelId),
      modelRepository.listReferenceAssets(props.modelId),
    ])
    if (!storedModel || storedModel.projectId !== props.projectId) {
      loadError.value = 'This model is no longer available in the project.'
      return
    }
    model.value = storedModel
    assets.value = storedAssets
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

function deleteElement(id: string): void {
  if (!model.value) return
  const index = model.value.elements.findIndex((element) => element.id === id)
  const element = model.value.elements[index]
  if (!element || index < 0) return
  history.execute(deleteElementCommand(element, index), model.value)
  bumpHistory()
  if (selectedNodeId.value === id) selectedNodeId.value = undefined
  objectActionsOpen.value = false
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

function confirmDeleteGroup(id: string): void {
  const group = model.value?.groups.find((entry) => entry.id === id)
  if (!group) return
  outlinerOpen.value = false
  objectActionsOpen.value = false
  deleteGroupTarget.value = group
  deleteGroupOpen.value = true
}

function deleteGroup(): void {
  if (!model.value || !deleteGroupTarget.value) return
  const index = model.value.groups.findIndex((entry) => entry.id === deleteGroupTarget.value?.id)
  if (index < 0) return
  const children = getGroupChildren(model.value, deleteGroupTarget.value.id)
  history.execute(deleteGroupCommand(deleteGroupTarget.value, index, children), model.value)
  if (selectedNodeId.value === deleteGroupTarget.value.id) selectedNodeId.value = undefined
  deleteGroupOpen.value = false
  bumpHistory()
  scheduleSave()
}

function moveCubeToGroup(groupId?: string): void {
  if (!model.value || !selectedCubes.value.length) return
  const selectedIds = new Set(selectedCubes.value.map((cube) => cube.id))
  const before = selectedCubes.value.map(cloneStudioCube)
  const after = selectedCubes.value.map((cube) => ({ ...cloneStudioCube(cube), parentId: groupId }))
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
  if (selectionCount.value > 1 && !['select', 'move'].includes(nextTool)) return
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
  const after = buildNodeTransformState(numericSession, payload.after, {
    operation: payload.operation,
    axis: payload.axis,
    resizeDirection: model.value.editor.modeling.resizeDirection,
    transformSpace: model.value.editor.modeling.transformSpace,
  })
  commitHierarchy({ before: numericSession.before, after, label: payload.label })
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

function setCameraView(view: StudioCameraView): void {
  if (!model.value) return
  model.value.editor.viewportViews[activeViewport.value] = view
  viewsOpen.value = false
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

function setTransformSnap(value: number | null): void {
  if (!model.value) return
  model.value.editor.snapping.transform = value
  scheduleSave()
}

function setCustomTransformSnap(value: number): void {
  if (!model.value) return
  const normalized = Math.max(0.001, Number(value) || 0.001)
  model.value.editor.snapping.customTransform = normalized
  model.value.editor.snapping.transform = normalized
  scheduleSave()
}

function setRotationSnap(value: number | null): void {
  if (!model.value) return
  model.value.editor.snapping.rotation = value
  scheduleSave()
}

function updateModelingSettings(settings: StudioModelingSettings): void {
  if (!model.value) return
  model.value.editor.modeling = { ...settings }
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

function toggleReferenceLock(id: string): void {
  if (!model.value) return
  const reference = model.value.references.find((entry) => entry.id === id)
  if (!reference) return
  const before = cloneStudioReference(reference)
  const after = cloneStudioReference(reference)
  after.locked = !after.locked
  history.execute(updateReferenceCommand(before, after, after.locked ? 'Lock reference' : 'Unlock reference'), model.value)
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

function decodeImage(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve()
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Image decode failed'))
    }
    image.src = url
  })
}

async function importReference(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !model.value) return
  importingReference.value = true
  try {
    await decodeImage(file)
    await modelPersistenceService.flush(model.value.id)
    const result = await modelRepository.addReferenceAsset(model.value, file)
    model.value = result.model
    assets.value.push(result.asset)
    selectedReferenceId.value = result.reference.id
    selectedNodeId.value = undefined
    referencePropertiesOpen.value = true
    saveStatus.value = 'saved'
    toasts.push({ type: 'success', message: 'Reference image added' })
  } catch (error) {
    toasts.push({
      type: 'error',
      message: toAppError(error, 'The reference image could not be opened.').userMessage,
    })
  } finally {
    importingReference.value = false
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
        label="Back to Models"
        @click="router.push({ name: 'models', params: { projectId } })"
      />
      <div class="studio-topbar__title">
        <strong>{{ model?.name ?? 'Model Studio' }}</strong>
        <small :class="`save-status--${saveStatus}`">
          {{ saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? 'Save failed' : 'Saved' }}
        </small>
      </div>
      <IconButton icon="undo" label="Undo" :disabled="!canUndo" @click="undo" />
      <IconButton icon="redo" label="Redo" :disabled="!canRedo" @click="redo" />
      <IconButton icon="more-vertical" label="Model menu" @click="moreOpen = true" />
    </header>

    <section v-if="loading" class="studio-loading" aria-label="Opening Model Studio">
      <div class="studio-loading__message"><span class="spinner" />Preparing 3D workspace…</div>
    </section>

    <section v-else-if="loadError || !model" class="studio-error">
      <span><AppIcon name="alert-triangle" :size="31" /></span>
      <h1>Model unavailable</h1>
      <p>{{ loadError || 'This model could not be found.' }}</p>
      <AppButton @click="router.replace({ name: 'models', params: { projectId } })">Back to Models</AppButton>
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
          :assets="assets"
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
          :rotation-snap="currentRotationSnap"
          :resize-direction="model.editor.modeling.resizeDirection"
          :control-mode="model.editor.modeling.controlMode"
          :transform-space="model.editor.modeling.transformSpace"
          :multi-select="multiSelectMode"
          :isolated-element-ids="isolatedIds"
          @activate="activeViewport = index"
          @toggle-maximize="toggleMaximize(index)"
          @select-node="selectNode"
          @select-reference="selectReference"
          @preview-hierarchy="previewHierarchy"
          @commit-hierarchy="commitHierarchy"
          @error="(message) => toasts.push({ type: 'error', message })"
        />
      </section>

      <nav class="studio-toolbar" aria-label="Modeling tools">
        <div class="studio-toolbar__scroll">
          <button
            v-for="entry in tools"
            :key="entry.id"
            type="button"
            :class="{ 'tool-button--active': tool === entry.id }"
            :disabled="entry.id !== 'select' && (!selectionTransformable || (selectionCount > 1 && entry.id !== 'move'))"
            @click="chooseTool(entry.id)"
          >
            <AppIcon :name="entry.icon" :size="21" />
            <span>{{ entry.label }}</span>
          </button>
          <button type="button" @click="viewsOpen = true">
            <AppIcon name="camera" :size="21" />
            <span>Views</span>
          </button>
          <button type="button" @click="snappingOpen = true">
            <AppIcon name="magnet" :size="21" />
            <span>Snap</span>
          </button>
          <button type="button" :class="{ 'tool-button--active': multiSelectMode }" @click="setMultiSelect(!multiSelectMode)">
            <AppIcon name="check" :size="21" />
            <span>{{ multiSelectMode ? `Multi ${selectionCount}` : 'Multi' }}</span>
          </button>
          <button type="button" @click="settingsOpen = true">
            <AppIcon name="settings" :size="21" />
            <span>{{ model.editor.modeling.transformSpace }}</span>
          </button>
          <button type="button" class="tool-button--create" @click="addCube">
            <AppIcon name="plus" :size="21" />
            <span>Cube</span>
          </button>
          <button type="button" @click="addGroup">
            <AppIcon name="folder-plus" :size="21" />
            <span>Group</span>
          </button>
          <button
            type="button"
            :disabled="importingReference"
            @click="openReferencePicker"
          >
            <AppIcon name="image-plus" :size="21" />
            <span>Reference</span>
          </button>
          <button
            v-if="selectionCount === 1 && selectedNode && selectionTransformable"
            type="button"
            @click="propertiesOpen = true"
          >
            <AppIcon name="sliders" :size="21" />
            <span>Values</span>
          </button>
          <button v-if="selectionCount" type="button" @click="objectActionsOpen = true">
            <AppIcon name="more-vertical" :size="21" />
            <span>Object</span>
          </button>
          <button
            v-if="selectedReference"
            type="button"
            @click="referencePropertiesOpen = true"
          >
            <AppIcon name="sliders" :size="21" />
            <span>Reference</span>
          </button>
        </div>
      </nav>

      <input
        ref="referenceInput"
        class="visually-hidden"
        type="file"
        accept="image/png,image/jpeg"
        @change="importReference"
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
        @close="settingsOpen = false"
        @update="updateModelingSettings"
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
        @toggle-lock="toggleReferenceLock"
        @delete="confirmDeleteReference"
      />
      <ModelOutlinerSheet
        :open="outlinerOpen"
        :model="model"
        :selected-node-id="selectedNodeId"
        :selected-node-ids="selectedNodeIds"
        :selected-reference-id="selectedReferenceId"
        :multi-select="multiSelectMode"
        :isolation-active="isolationActive"
        @close="outlinerOpen = false"
        @select-node="selectNodeFromOutliner"
        @select-reference="editReference"
        @create-group="addGroup"
        @rename-node="beginRenameNode"
        @duplicate-node="duplicateNode"
        @show-actions="showObjectActions"
        @toggle-element="toggleElement"
        @delete-element="deleteElement"
        @toggle-group="toggleGroup"
        @toggle-node-lock="toggleNodeLock"
        @set-multi-select="setMultiSelect"
        @exit-isolation="exitIsolation"
        @delete-group="confirmDeleteGroup"
        @edit-reference="editReference"
        @toggle-reference="toggleReference"
        @toggle-reference-lock="toggleReferenceLock"
        @delete-reference="confirmDeleteReference"
      />

      <BottomSheet
        :open="viewsOpen"
        title="Views"
        :description="`Viewport ${activeViewport + 1} · choose a camera direction or layout`"
        @close="viewsOpen = false"
      >
        <div class="view-sheet">
          <section>
            <h3>Layout</h3>
            <div class="choice-grid choice-grid--two">
              <button type="button" :class="{ active: viewportCount === 1 }" @click="setViewportLayout(1)">1 Viewport</button>
              <button type="button" :class="{ active: viewportCount === 2 }" @click="setViewportLayout(2)">2 Viewports</button>
            </div>
            <p>Three and four viewports are coming later after mobile performance validation.</p>
          </section>
          <section>
            <h3>Viewport {{ activeViewport + 1 }}</h3>
            <div class="choice-grid">
              <button
                v-for="viewEntry in cameraViews"
                :key="viewEntry.id"
                type="button"
                :class="{ active: model.editor.viewportViews[activeViewport] === viewEntry.id }"
                @click="setCameraView(viewEntry.id)"
              >
                {{ viewEntry.label }}
              </button>
            </div>
          </section>
        </div>
      </BottomSheet>

      <BottomSheet
        :open="snappingOpen"
        title="Snapping"
        description="Gizmos snap while numeric fields remain exact"
        @close="snappingOpen = false"
      >
        <div class="snap-sheet">
          <section>
            <h3>Move and Size</h3>
            <div class="snap-options">
              <button type="button" :class="{ active: currentTransformSnap === null }" @click="setTransformSnap(null)">Off</button>
              <button v-for="step in [1, 0.5, 0.25]" :key="step" type="button" :class="{ active: currentTransformSnap === step }" @click="setTransformSnap(step)">{{ step }}</button>
            </div>
            <label>
              <span>Custom</span>
              <input
                :value="model.editor.snapping.customTransform"
                type="number"
                inputmode="decimal"
                min="0.001"
                step="0.001"
                @change="setCustomTransformSnap(Number(($event.target as HTMLInputElement).value))"
              />
            </label>
          </section>
          <section>
            <h3>Rotation</h3>
            <div class="snap-options snap-options--rotation">
              <button type="button" :class="{ active: currentRotationSnap === null }" @click="setRotationSnap(null)">Off</button>
              <button v-for="step in [1, 5, 15, 22.5, 45, 90]" :key="step" type="button" :class="{ active: currentRotationSnap === step }" @click="setRotationSnap(step)">{{ step }}°</button>
            </div>
          </section>
        </div>
      </BottomSheet>

      <BottomSheet
        :open="objectActionsOpen && selectionCount > 0"
        :title="selectionCount > 1 ? `${selectionCount} Selected Objects` : selectedNode?.name ?? 'Object'"
        :description="selectionCount > 1 ? 'Multi-selection actions' : selectedNode?.type === 'group' ? 'Group actions' : 'Cube actions'"
        @close="objectActionsOpen = false"
      >
        <div class="studio-menu">
          <button type="button" @click="duplicateNode()">
            <span><AppIcon name="copy" :size="22" /></span>
            <span><strong>Duplicate</strong><small>Creates an independent copy with a new ID</small></span>
          </button>
          <button type="button" :disabled="!canDuplicateAgain" @click="duplicateAgain">
            <span><AppIcon name="copy" :size="22" /></span>
            <span><strong>Duplicate Again</strong><small>{{ canDuplicateAgain ? 'Repeats the previous duplicate offset' : 'Move a duplicate first to record its offset' }}</small></span>
          </button>
          <button v-if="selectionCount === 1 && selectedNode" type="button" @click="beginRenameNode(selectedNode.id)">
            <span><AppIcon name="pencil" :size="22" /></span>
            <span><strong>Rename</strong><small>Change the Outliner name</small></span>
          </button>
          <button v-if="selectionCount === 1 && selectedNode" type="button" :disabled="!selectionTransformable" @click="objectActionsOpen = false; pivotPropertiesOpen = true">
            <span><AppIcon name="crosshair" :size="22" /></span>
            <span><strong>Edit Pivot</strong><small>Center, reset, move, or send to origin</small></span>
          </button>
          <button v-if="selectedAreCubes" type="button" :disabled="!selectionTransformable" @click="objectActionsOpen = false; moveToGroupOpen = true">
            <span><AppIcon name="folder-output" :size="22" /></span>
            <span><strong>Move to Group</strong><small>Place the cube in a group or back at root</small></span>
          </button>
          <button type="button" :disabled="!selectionTransformable" @click="objectActionsOpen = false; mirrorOpen = true">
            <span><AppIcon name="layers" :size="22" /></span>
            <span><strong>Mirror</strong><small>Mirror in place or create a mirrored copy</small></span>
          </button>
          <button v-if="selectedAreCubes && selectionCount >= 2" type="button" :disabled="!selectionTransformable" @click="objectActionsOpen = false; arrangeOpen = true">
            <span><AppIcon name="move-3d" :size="22" /></span>
            <span><strong>Align & Distribute</strong><small>Arrange selected cube bounds on X, Y, or Z</small></span>
          </button>
          <button type="button" @click="toggleNodeLock()">
            <span><AppIcon :name="selectionDirectlyLocked ? 'unlock' : 'lock'" :size="22" /></span>
            <span><strong>{{ selectionDirectlyLocked ? 'Unlock Selection' : 'Lock Selection' }}</strong><small>Locked objects remain visible and accessible here</small></span>
          </button>
          <button type="button" @click="setSelectionVisibility(!selectionVisible)">
            <span><AppIcon :name="selectionVisible ? 'eye-off' : 'eye'" :size="22" /></span>
            <span><strong>{{ selectionVisible ? 'Hide Selection' : 'Show Selection' }}</strong><small>Changes intended model visibility</small></span>
          </button>
          <button type="button" @click="isolationActive ? exitIsolation() : isolateSelection()">
            <span><AppIcon name="eye" :size="22" /></span>
            <span><strong>{{ isolationActive ? 'Exit Isolation / Show All' : 'Isolate Selection' }}</strong><small>Temporary editor-only visibility</small></span>
          </button>
          <button type="button" class="menu-action--danger" :disabled="selectionHasLockedNode" @click="confirmDeleteSelection">
            <span><AppIcon name="trash" :size="22" /></span>
            <span><strong>Delete Selection</strong><small>{{ selectionHasLockedNode ? 'Unlock objects or their parent group before deleting' : 'Undo is available during this session' }}</small></span>
          </button>
        </div>
      </BottomSheet>

      <BottomSheet
        :open="moveToGroupOpen && selectedAreCubes"
        :title="selectionCount > 1 ? 'Move Cubes' : 'Move Cube'"
        description="Groups are one level deep in this Alpha"
        @close="moveToGroupOpen = false"
      >
        <div class="move-list">
          <button type="button" :class="{ active: selectedCubes.every((cube) => !cube.parentId) }" @click="moveCubeToGroup()">
            <AppIcon name="list-tree" :size="20" /><span><strong>Model Root</strong><small>Outside every group</small></span>
          </button>
          <button
            v-for="group in model.groups"
            :key="group.id"
            type="button"
            :class="{ active: selectedCubes.every((cube) => cube.parentId === group.id) }"
            @click="moveCubeToGroup(group.id)"
          >
            <AppIcon name="folder" :size="20" /><span><strong>{{ group.name }}</strong><small>Move into group</small></span>
          </button>
        </div>
      </BottomSheet>

      <BottomSheet
        :open="mirrorOpen"
        title="Mirror Selection"
        description="Mirror around the shared selection center on one axis"
        @close="mirrorOpen = false"
      >
        <div class="mirror-sheet">
          <section v-for="axis in (['x', 'y', 'z'] as const)" :key="axis">
            <h3>{{ axis.toUpperCase() }} Axis</h3>
            <div class="mirror-actions">
              <button type="button" @click="mirrorSelection(axis, false)">
                <strong>Mirror in Place</strong>
                <small>Flip the current selection</small>
              </button>
              <button type="button" @click="mirrorSelection(axis, true)">
                <strong>Duplicate + Mirror</strong>
                <small>Keep the original and create a mirrored copy</small>
              </button>
            </div>
          </section>
        </div>
      </BottomSheet>

      <BottomSheet
        :open="arrangeOpen"
        title="Align & Distribute"
        :description="`${selectionCount} cubes selected · operations use their visible bounds`"
        @close="arrangeOpen = false"
      >
        <div class="arrange-sheet">
          <section v-for="axis in (['x', 'y', 'z'] as const)" :key="axis">
            <h3>{{ axis.toUpperCase() }} Axis</h3>
            <div class="arrange-actions">
              <button v-for="alignment in (['min', 'center', 'max'] as const)" :key="alignment" type="button" @click="alignSelection(axis, alignment)">
                {{ alignment === 'min' ? 'Min' : alignment === 'max' ? 'Max' : 'Center' }}
              </button>
              <button type="button" :disabled="selectedCubes.length < 3" @click="distributeSelection(axis)">
                Distribute
              </button>
            </div>
          </section>
        </div>
      </BottomSheet>

      <BottomSheet
        :open="moreOpen"
        title="Model Studio"
        :description="model.identifier"
        @close="moreOpen = false"
      >
        <div class="studio-menu">
          <button type="button" @click="showOutliner">
            <span><AppIcon name="list-tree" :size="22" /></span>
            <span><strong>Outliner</strong><small>Select, organize, lock, isolate, and edit objects</small></span>
          </button>
          <button type="button" @click="moreOpen = false; settingsOpen = true">
            <span><AppIcon name="settings" :size="22" /></span>
            <span><strong>Model Studio Settings</strong><small>Resize direction, controls, and transform space</small></span>
          </button>
          <button type="button" @click="saveNow">
            <span><AppIcon name="save" :size="22" /></span>
            <span><strong>Save Now</strong><small>Autosave is already active</small></span>
          </button>
          <button type="button" disabled>
            <span><AppIcon name="palette" :size="22" /></span>
            <span><strong>Materials</strong><small>Coming soon</small></span>
          </button>
        </div>
      </BottomSheet>

      <AppDialog :open="renameOpen" :title="`Rename ${renameTargetType === 'group' ? 'Group' : 'Cube'}`" @close="renameOpen = false">
        <label class="field-label" for="rename-model-element">Object Name</label>
        <input
          id="rename-model-element"
          v-model="renameValue"
          class="text-input"
          maxlength="60"
          autocomplete="off"
          @keydown.enter.prevent="renameNode"
        />
        <template #actions>
          <AppButton variant="ghost" @click="renameOpen = false">Cancel</AppButton>
          <AppButton :disabled="!renameValue.trim()" @click="renameNode">Rename</AppButton>
        </template>
      </AppDialog>

      <AppDialog
        :open="deleteSelectionOpen"
        :title="`Delete ${selectionCount === 1 ? 'selected object' : `${selectionCount} selected objects`}?`"
        description="Groups are removed safely: any unselected children stay in the model and move to the model root. Undo remains available during this editing session."
        @close="deleteSelectionOpen = false"
      >
        <template #actions>
          <AppButton variant="ghost" @click="deleteSelectionOpen = false">Cancel</AppButton>
          <AppButton variant="danger" @click="deleteSelectedNodes">Delete Selection</AppButton>
        </template>
      </AppDialog>

      <AppDialog
        :open="deleteGroupOpen"
        :title="`Delete “${deleteGroupTarget?.name ?? 'group'}”?`"
        description="The group will be removed, but every cube inside it will be moved safely to the model root."
        @close="deleteGroupOpen = false"
      >
        <template #actions>
          <AppButton variant="ghost" @click="deleteGroupOpen = false">Cancel</AppButton>
          <AppButton variant="danger" @click="deleteGroup">Move Cubes & Delete</AppButton>
        </template>
      </AppDialog>

      <AppDialog
        :open="deleteReferenceOpen"
        :title="`Delete “${deleteReferenceTarget?.name ?? 'reference'}”?`"
        description="This removes only the modeling reference. It does not delete a project texture."
        @close="deleteReferenceOpen = false"
      >
        <template #actions>
          <AppButton variant="ghost" @click="deleteReferenceOpen = false">Cancel</AppButton>
          <AppButton variant="danger" @click="deleteReference">Delete Reference</AppButton>
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
