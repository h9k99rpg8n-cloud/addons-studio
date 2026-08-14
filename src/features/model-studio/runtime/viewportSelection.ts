import {
  elementCenter,
  getStudioNode,
  type StudioAxis,
} from '@/core/model/modelHierarchy'
import {
  selectionBounds,
  selectionModelingCenter,
  selectionPivot,
} from '@/core/model/modelProductivity'
import type {
  ModelTransformTool,
  StudioModel,
  StudioModelNode,
  StudioVector3,
} from '@/types/model'

export function viewportSelectedIds(
  selectedNodeId?: string,
  selectedNodeIds?: string[],
): string[] {
  if (selectedNodeIds?.length) return selectedNodeIds
  return selectedNodeId ? [selectedNodeId] : []
}

export function viewportSelectedNode(
  model: StudioModel,
  ids: string[],
): StudioModelNode | undefined {
  return getStudioNode(model, ids.at(-1))
}

export function viewportSelectionBounds(model: StudioModel, ids: string[]) {
  const node = ids.length === 1 ? getStudioNode(model, ids[0]) : undefined
  if (node?.type === 'cube') {
    return {
      minimum: { ...node.position },
      maximum: {
        x: node.position.x + node.size.x,
        y: node.position.y + node.size.y,
        z: node.position.z + node.size.z,
      },
      center: elementCenter(node),
      size: { ...node.size },
    }
  }
  return selectionBounds(model, ids)
}

export function viewportGizmoOrigin(
  model: StudioModel,
  ids: string[],
  tool: ModelTransformTool,
): StudioVector3 {
  return tool === 'pivot'
    ? selectionPivot(model, ids)
    : selectionModelingCenter(model, ids)
}

export function viewportTransformLabel(
  node: StudioModelNode,
  tool: ModelTransformTool,
  axis: StudioAxis,
): string {
  if (tool === 'rotate') return `${axis.toUpperCase()} ${node.rotation[axis].toFixed(1)}°`
  if (tool === 'scale') {
    if (node.type === 'group') return `Scale ${axis.toUpperCase()} ${node.scale[axis].toFixed(2)}`
    const dimension = axis === 'x' ? 'Width' : axis === 'y' ? 'Height' : 'Depth'
    return `${dimension} ${node.size[axis].toFixed(2)}`
  }
  if (tool === 'pivot') return `Pivot ${axis.toUpperCase()} ${node.pivot[axis].toFixed(2)}`
  return `${axis.toUpperCase()} ${node.position[axis].toFixed(2)}`
}
