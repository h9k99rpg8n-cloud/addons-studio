export interface PaintPoint {
  x: number
  y: number
}

export interface PaintSnapshot {
  width: number
  height: number
  data: Uint8ClampedArray
}

export type Rgba = readonly [number, number, number, number]

function pointKey(point: PaintPoint): string {
  return `${point.x}:${point.y}`
}

export function paintSnapshotsEqual(left: PaintSnapshot, right: PaintSnapshot): boolean {
  if (left.width !== right.width || left.height !== right.height || left.data.length !== right.data.length) {
    return false
  }
  for (let index = 0; index < left.data.length; index += 1) {
    if (left.data[index] !== right.data[index]) return false
  }
  return true
}

export function pushUniquePaintHistory(
  history: PaintSnapshot[],
  snapshot: PaintSnapshot,
  maximum = 64,
): boolean {
  const last = history.at(-1)
  if (last && paintSnapshotsEqual(last, snapshot)) return false
  history.push(snapshot)
  if (history.length > Math.max(1, maximum)) history.splice(0, history.length - maximum)
  return true
}

/**
 * Returns every pixel covered by the brush and its enabled mirrors. Mirroring
 * individual covered pixels keeps even brush sizes symmetric at atlas edges.
 */
export function mirroredBrushPixels(
  point: PaintPoint,
  width: number,
  height: number,
  brushSize: number,
  mirrorX: boolean,
  mirrorY: boolean,
): PaintPoint[] {
  const safeWidth = Math.max(1, Math.floor(width))
  const safeHeight = Math.max(1, Math.floor(height))
  const size = Math.max(1, Math.floor(brushSize))
  const points = new Map<string, PaintPoint>()
  for (let y = point.y; y < point.y + size; y += 1) {
    for (let x = point.x; x < point.x + size; x += 1) {
      if (x < 0 || y < 0 || x >= safeWidth || y >= safeHeight) continue
      const xs = mirrorX ? [x, safeWidth - 1 - x] : [x]
      const ys = mirrorY ? [y, safeHeight - 1 - y] : [y]
      for (const mirroredY of ys) {
        for (const mirroredX of xs) {
          const mirrored = { x: mirroredX, y: mirroredY }
          points.set(pointKey(mirrored), mirrored)
        }
      }
    }
  }
  return [...points.values()]
}

export function linePixels(from: PaintPoint, to: PaintPoint): PaintPoint[] {
  let x0 = Math.round(from.x)
  let y0 = Math.round(from.y)
  const x1 = Math.round(to.x)
  const y1 = Math.round(to.y)
  const points: PaintPoint[] = []
  const dx = Math.abs(x1 - x0)
  const sx = x0 < x1 ? 1 : -1
  const dy = -Math.abs(y1 - y0)
  const sy = y0 < y1 ? 1 : -1
  let error = dx + dy
  while (true) {
    points.push({ x: x0, y: y0 })
    if (x0 === x1 && y0 === y1) break
    const doubled = 2 * error
    if (doubled >= dy) {
      error += dy
      x0 += sx
    }
    if (doubled <= dx) {
      error += dx
      y0 += sy
    }
  }
  return points
}

export function rectanglePixels(from: PaintPoint, to: PaintPoint): PaintPoint[] {
  const left = Math.min(Math.round(from.x), Math.round(to.x))
  const right = Math.max(Math.round(from.x), Math.round(to.x))
  const top = Math.min(Math.round(from.y), Math.round(to.y))
  const bottom = Math.max(Math.round(from.y), Math.round(to.y))
  const points = new Map<string, PaintPoint>()
  for (const point of [
    ...linePixels({ x: left, y: top }, { x: right, y: top }),
    ...linePixels({ x: right, y: top }, { x: right, y: bottom }),
    ...linePixels({ x: right, y: bottom }, { x: left, y: bottom }),
    ...linePixels({ x: left, y: bottom }, { x: left, y: top }),
  ]) points.set(pointKey(point), point)
  return [...points.values()]
}

function colorsEqual(data: Uint8ClampedArray, offset: number, color: Rgba): boolean {
  return data[offset] === color[0]
    && data[offset + 1] === color[1]
    && data[offset + 2] === color[2]
    && data[offset + 3] === color[3]
}

function setColor(data: Uint8ClampedArray, offset: number, color: Rgba): void {
  data[offset] = color[0]
  data[offset + 1] = color[1]
  data[offset + 2] = color[2]
  data[offset + 3] = color[3]
}

export function replaceColorPixels(
  data: Uint8ClampedArray,
  target: Rgba,
  replacement: Rgba,
): number {
  if (target.every((value, index) => value === replacement[index])) return 0
  let changed = 0
  for (let offset = 0; offset < data.length; offset += 4) {
    if (!colorsEqual(data, offset, target)) continue
    setColor(data, offset, replacement)
    changed += 1
  }
  return changed
}

export function floodFillPixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  start: PaintPoint,
  replacement: Rgba,
): number {
  const x = Math.floor(start.x)
  const y = Math.floor(start.y)
  if (x < 0 || y < 0 || x >= width || y >= height) return 0
  const startOffset = (y * width + x) * 4
  const target: Rgba = [
    data[startOffset]!,
    data[startOffset + 1]!,
    data[startOffset + 2]!,
    data[startOffset + 3]!,
  ]
  if (target.every((value, index) => value === replacement[index])) return 0
  const stack: number[] = [y * width + x]
  let changed = 0
  while (stack.length) {
    const pixelIndex = stack.pop()!
    const px = pixelIndex % width
    const py = Math.floor(pixelIndex / width)
    const offset = pixelIndex * 4
    if (!colorsEqual(data, offset, target)) continue
    setColor(data, offset, replacement)
    changed += 1
    if (px > 0) stack.push(pixelIndex - 1)
    if (px + 1 < width) stack.push(pixelIndex + 1)
    if (py > 0) stack.push(pixelIndex - width)
    if (py + 1 < height) stack.push(pixelIndex + width)
  }
  return changed
}
