import type {
  StudioGroup,
  StudioModel,
  StudioModelElement,
  StudioReferenceImage,
} from '@/types/model'

import { cloneStudioCube, cloneStudioGroup, cloneStudioReference } from './modelFactory'
import type { StudioHierarchyState } from './modelHierarchy'

export interface ModelCommand {
  readonly label: string
  redo(model: StudioModel): void
  undo(model: StudioModel): void
}

function cloneElement(element: StudioModelElement): StudioModelElement {
  return cloneStudioCube(element)
}

function replaceElement(model: StudioModel, element: StudioModelElement): void {
  const index = model.elements.findIndex((entry) => entry.id === element.id)
  if (index >= 0) model.elements.splice(index, 1, cloneElement(element))
}

function replaceGroup(model: StudioModel, group: StudioGroup): void {
  const index = model.groups.findIndex((entry) => entry.id === group.id)
  if (index >= 0) model.groups.splice(index, 1, cloneStudioGroup(group))
}

function applyHierarchyState(model: StudioModel, state: StudioHierarchyState): void {
  state.elements.forEach((element) => replaceElement(model, element))
  state.groups.forEach((group) => replaceGroup(model, group))
}

export class ModelCommandHistory {
  private undoStack: ModelCommand[] = []
  private redoStack: ModelCommand[] = []

  get canUndo(): boolean {
    return this.undoStack.length > 0
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0
  }

  execute(command: ModelCommand, model: StudioModel): void {
    command.redo(model)
    this.undoStack.push(command)
    this.redoStack = []
  }

  /** Records a gesture whose live preview was already applied to the model. */
  recordApplied(command: ModelCommand): void {
    this.undoStack.push(command)
    this.redoStack = []
  }

  undo(model: StudioModel): ModelCommand | undefined {
    const command = this.undoStack.pop()
    if (!command) return undefined
    command.undo(model)
    this.redoStack.push(command)
    return command
  }

  redo(model: StudioModel): ModelCommand | undefined {
    const command = this.redoStack.pop()
    if (!command) return undefined
    command.redo(model)
    this.undoStack.push(command)
    return command
  }

  clear(): void {
    this.undoStack = []
    this.redoStack = []
  }
}

export function createElementCommand(element: StudioModelElement, index: number): ModelCommand {
  const snapshot = cloneElement(element)
  return {
    label: `Create ${snapshot.name}`,
    redo(model) {
      if (!model.elements.some((entry) => entry.id === snapshot.id)) {
        model.elements.splice(Math.min(index, model.elements.length), 0, cloneElement(snapshot))
      }
    },
    undo(model) {
      model.elements = model.elements.filter((entry) => entry.id !== snapshot.id)
    },
  }
}

export function deleteElementCommand(element: StudioModelElement, index: number): ModelCommand {
  const snapshot = cloneElement(element)
  return {
    label: `Delete ${snapshot.name}`,
    redo(model) {
      model.elements = model.elements.filter((entry) => entry.id !== snapshot.id)
    },
    undo(model) {
      if (!model.elements.some((entry) => entry.id === snapshot.id)) {
        model.elements.splice(Math.min(index, model.elements.length), 0, cloneElement(snapshot))
      }
    },
  }
}

export function updateElementCommand(
  before: StudioModelElement,
  after: StudioModelElement,
  label: string,
): ModelCommand {
  const beforeSnapshot = cloneElement(before)
  const afterSnapshot = cloneElement(after)
  return {
    label,
    redo: (model) => replaceElement(model, afterSnapshot),
    undo: (model) => replaceElement(model, beforeSnapshot),
  }
}

export function createGroupCommand(group: StudioGroup, index: number): ModelCommand {
  const snapshot = cloneStudioGroup(group)
  return {
    label: `Create ${snapshot.name}`,
    redo(model) {
      if (!model.groups.some((entry) => entry.id === snapshot.id)) {
        model.groups.splice(Math.min(index, model.groups.length), 0, cloneStudioGroup(snapshot))
      }
    },
    undo(model) {
      model.groups = model.groups.filter((entry) => entry.id !== snapshot.id)
    },
  }
}

export function createHierarchyCommand(
  group: StudioGroup,
  elements: StudioModelElement[],
  label = `Duplicate ${group.name}`,
): ModelCommand {
  const groupSnapshot = cloneStudioGroup(group)
  const elementSnapshots = elements.map(cloneStudioCube)
  return {
    label,
    redo(model) {
      if (!model.groups.some((entry) => entry.id === groupSnapshot.id)) {
        model.groups.push(cloneStudioGroup(groupSnapshot))
      }
      for (const element of elementSnapshots) {
        if (!model.elements.some((entry) => entry.id === element.id)) {
          model.elements.push(cloneStudioCube(element))
        }
      }
    },
    undo(model) {
      const elementIds = new Set(elementSnapshots.map((element) => element.id))
      model.elements = model.elements.filter((element) => !elementIds.has(element.id))
      model.groups = model.groups.filter((entry) => entry.id !== groupSnapshot.id)
    },
  }
}

export function deleteGroupCommand(
  group: StudioGroup,
  index: number,
  children: StudioModelElement[],
): ModelCommand {
  const groupSnapshot = cloneStudioGroup(group)
  const beforeChildren = children.map(cloneStudioCube)
  const rootChildren = beforeChildren.map((element) => ({
    ...cloneStudioCube(element),
    parentId: undefined,
  }))
  return {
    label: `Delete ${groupSnapshot.name}`,
    redo(model) {
      model.groups = model.groups.filter((entry) => entry.id !== groupSnapshot.id)
      rootChildren.forEach((element) => replaceElement(model, element))
    },
    undo(model) {
      if (!model.groups.some((entry) => entry.id === groupSnapshot.id)) {
        model.groups.splice(Math.min(index, model.groups.length), 0, cloneStudioGroup(groupSnapshot))
      }
      beforeChildren.forEach((element) => replaceElement(model, element))
    },
  }
}

export function updateGroupCommand(
  before: StudioGroup,
  after: StudioGroup,
  label: string,
): ModelCommand {
  const beforeSnapshot = cloneStudioGroup(before)
  const afterSnapshot = cloneStudioGroup(after)
  return {
    label,
    redo: (model) => replaceGroup(model, afterSnapshot),
    undo: (model) => replaceGroup(model, beforeSnapshot),
  }
}

export function updateHierarchyCommand(
  before: StudioHierarchyState,
  after: StudioHierarchyState,
  label: string,
): ModelCommand {
  const beforeSnapshot: StudioHierarchyState = {
    elements: before.elements.map(cloneStudioCube),
    groups: before.groups.map(cloneStudioGroup),
  }
  const afterSnapshot: StudioHierarchyState = {
    elements: after.elements.map(cloneStudioCube),
    groups: after.groups.map(cloneStudioGroup),
  }
  return {
    label,
    redo: (model) => applyHierarchyState(model, afterSnapshot),
    undo: (model) => applyHierarchyState(model, beforeSnapshot),
  }
}

export function updateReferenceCommand(
  before: StudioReferenceImage,
  after: StudioReferenceImage,
  label: string,
): ModelCommand {
  const beforeSnapshot = cloneStudioReference(before)
  const afterSnapshot = cloneStudioReference(after)
  const replace = (model: StudioModel, reference: StudioReferenceImage) => {
    const index = model.references.findIndex((entry) => entry.id === reference.id)
    if (index >= 0) model.references.splice(index, 1, cloneStudioReference(reference))
  }
  return {
    label,
    redo: (model) => replace(model, afterSnapshot),
    undo: (model) => replace(model, beforeSnapshot),
  }
}
