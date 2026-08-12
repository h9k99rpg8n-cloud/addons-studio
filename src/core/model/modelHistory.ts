import type { StudioModel, StudioModelElement } from '@/types/model'

import { cloneStudioCube } from './modelFactory'

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
