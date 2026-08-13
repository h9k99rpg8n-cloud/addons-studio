import type {
  StudioModelNode,
  StudioTransformSpace,
  StudioVector3,
} from '@/types/model'

export type StudioAxis = 'x' | 'y' | 'z'

const DEG_TO_RAD = Math.PI / 180
const RAD_TO_DEG = 180 / Math.PI

interface StudioQuaternion {
  x: number
  y: number
  z: number
  w: number
}

export function axisUnit(axis: StudioAxis): StudioVector3 {
  return {
    x: axis === 'x' ? 1 : 0,
    y: axis === 'y' ? 1 : 0,
    z: axis === 'z' ? 1 : 0,
  }
}

export function addVector(a: StudioVector3, b: StudioVector3): StudioVector3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }
}

export function subtractVector(a: StudioVector3, b: StudioVector3): StudioVector3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

export function multiplyVector(vector: StudioVector3, scalar: number): StudioVector3 {
  return { x: vector.x * scalar, y: vector.y * scalar, z: vector.z * scalar }
}

export function rotateVectorEuler(vector: StudioVector3, rotation: StudioVector3): StudioVector3 {
  let { x, y, z } = vector
  const rx = rotation.x * DEG_TO_RAD
  const ry = rotation.y * DEG_TO_RAD
  const rz = rotation.z * DEG_TO_RAD

  // Match Three.js' default Euler order exactly. With column vectors, XYZ
  // composition applies Z, then Y, then X to the vector.
  if (rz) {
    const nextX = x * Math.cos(rz) - y * Math.sin(rz)
    y = x * Math.sin(rz) + y * Math.cos(rz)
    x = nextX
  }
  if (ry) {
    const nextX = x * Math.cos(ry) + z * Math.sin(ry)
    z = -x * Math.sin(ry) + z * Math.cos(ry)
    x = nextX
  }
  if (rx) {
    const nextY = y * Math.cos(rx) - z * Math.sin(rx)
    z = y * Math.sin(rx) + z * Math.cos(rx)
    y = nextY
  }
  return { x, y, z }
}

export function rotatePointEuler(
  point: StudioVector3,
  pivot: StudioVector3,
  rotation: StudioVector3,
): StudioVector3 {
  return addVector(rotateVectorEuler(subtractVector(point, pivot), rotation), pivot)
}

export function rotatePointAroundAxis(
  point: StudioVector3,
  pivot: StudioVector3,
  axis: StudioVector3,
  degrees: number,
): StudioVector3 {
  const relative = subtractVector(point, pivot)
  const radians = degrees * DEG_TO_RAD
  const cosine = Math.cos(radians)
  const sine = Math.sin(radians)
  const dot = relative.x * axis.x + relative.y * axis.y + relative.z * axis.z
  const cross = {
    x: axis.y * relative.z - axis.z * relative.y,
    y: axis.z * relative.x - axis.x * relative.z,
    z: axis.x * relative.y - axis.y * relative.x,
  }
  return addVector({
    x: relative.x * cosine + cross.x * sine + axis.x * dot * (1 - cosine),
    y: relative.y * cosine + cross.y * sine + axis.y * dot * (1 - cosine),
    z: relative.z * cosine + cross.z * sine + axis.z * dot * (1 - cosine),
  }, pivot)
}

export function axisVectorForSpace(
  node: StudioModelNode,
  parentRotation: StudioVector3,
  space: StudioTransformSpace,
  axis: StudioAxis,
): StudioVector3 {
  const unit = axisUnit(axis)
  if (space === 'local') return rotateVectorEuler(unit, node.rotation)
  if (space === 'parent') return rotateVectorEuler(unit, parentRotation)
  return unit
}

function quaternionFromEuler(rotation: StudioVector3): StudioQuaternion {
  const x = rotation.x * DEG_TO_RAD / 2
  const y = rotation.y * DEG_TO_RAD / 2
  const z = rotation.z * DEG_TO_RAD / 2
  const c1 = Math.cos(x)
  const c2 = Math.cos(y)
  const c3 = Math.cos(z)
  const s1 = Math.sin(x)
  const s2 = Math.sin(y)
  const s3 = Math.sin(z)
  return {
    x: s1 * c2 * c3 + c1 * s2 * s3,
    y: c1 * s2 * c3 - s1 * c2 * s3,
    z: c1 * c2 * s3 + s1 * s2 * c3,
    w: c1 * c2 * c3 - s1 * s2 * s3,
  }
}

function quaternionFromAxis(axis: StudioVector3, degrees: number): StudioQuaternion {
  const half = degrees * DEG_TO_RAD / 2
  const sine = Math.sin(half)
  return { x: axis.x * sine, y: axis.y * sine, z: axis.z * sine, w: Math.cos(half) }
}

function multiplyQuaternion(a: StudioQuaternion, b: StudioQuaternion): StudioQuaternion {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  }
}

function quaternionToEuler(quaternion: StudioQuaternion): StudioVector3 {
  const { x, y, z, w } = quaternion
  const m11 = 1 - 2 * (y * y + z * z)
  const m12 = 2 * (x * y - z * w)
  const m13 = 2 * (x * z + y * w)
  const m23 = 2 * (y * z - x * w)
  const m33 = 1 - 2 * (x * x + y * y)
  const clamp = (value: number) => Math.min(1, Math.max(-1, value))
  const rotation = { x: 0, y: Math.asin(clamp(m13)), z: 0 }

  // Match Three.js' default XYZ Euler order while remaining stable near gimbal lock.
  if (Math.abs(m13) < 0.9999999) {
    rotation.x = Math.atan2(-m23, m33)
    rotation.z = Math.atan2(-m12, m11)
  } else {
    const m32 = 2 * (y * z + x * w)
    const m22 = 1 - 2 * (x * x + z * z)
    rotation.x = Math.atan2(m32, m22)
    rotation.z = 0
  }
  const clean = (value: number) => {
    const rounded = Math.round(value * RAD_TO_DEG * 1e10) / 1e10
    return Math.abs(rounded) < 1e-10 ? 0 : rounded
  }
  return { x: clean(rotation.x), y: clean(rotation.y), z: clean(rotation.z) }
}

export function rotateEulerInSpace(
  rotation: StudioVector3,
  parentRotation: StudioVector3,
  space: StudioTransformSpace,
  axis: StudioAxis,
  degrees: number,
): StudioVector3 {
  const current = quaternionFromEuler(rotation)
  if (space === 'local') {
    return quaternionToEuler(multiplyQuaternion(current, quaternionFromAxis(axisUnit(axis), degrees)))
  }
  const worldAxis = space === 'parent'
    ? rotateVectorEuler(axisUnit(axis), parentRotation)
    : axisUnit(axis)
  return quaternionToEuler(multiplyQuaternion(quaternionFromAxis(worldAxis, degrees), current))
}

/** Applies an axis expressed in model/world coordinates to an existing Euler rotation. */
export function rotateEulerAroundAxis(
  rotation: StudioVector3,
  axis: StudioVector3,
  degrees: number,
): StudioVector3 {
  return quaternionToEuler(
    multiplyQuaternion(quaternionFromAxis(axis, degrees), quaternionFromEuler(rotation)),
  )
}

export function mirrorEuler(rotation: StudioVector3, axis: StudioAxis): StudioVector3 {
  if (axis === 'x') return { x: rotation.x, y: -rotation.y, z: -rotation.z }
  if (axis === 'y') return { x: -rotation.x, y: rotation.y, z: -rotation.z }
  return { x: -rotation.x, y: -rotation.y, z: rotation.z }
}
