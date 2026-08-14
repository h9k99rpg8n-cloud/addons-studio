import { AppError } from '@/core/errors/AppError'

export interface InspectedTextureImage {
  mimeType: 'image/png' | 'image/jpeg'
  width: number
  height: number
}

const MAX_BYTES = 16 * 1024 * 1024
const MAX_DIMENSION = 4096
const MAX_PIXELS = 16_000_000

function textureError(message: string, cause?: unknown): AppError {
  return new AppError('TEXTURE_FAILED', message, cause instanceof Error ? { cause } : undefined)
}

export function normalizeTextureMime(file: File): InspectedTextureImage['mimeType'] | undefined {
  const type = file.type.toLowerCase()
  if (type === 'image/png') return 'image/png'
  if (type === 'image/jpeg' || type === 'image/jpg') return 'image/jpeg'
  if (!type && /\.png$/i.test(file.name)) return 'image/png'
  if (!type && /\.jpe?g$/i.test(file.name)) return 'image/jpeg'
  return undefined
}

async function decodeDimensions(file: File): Promise<{ width: number; height: number }> {
  if (typeof Image === 'undefined' || typeof URL.createObjectURL !== 'function') {
    throw textureError('This texture could not be decoded on this device or browser.')
  }
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.decoding = 'async'
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Texture decode failed'))
      image.src = url
    })
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('Texture dimensions are unavailable')
    return { width: image.naturalWidth, height: image.naturalHeight }
  } catch (error) {
    throw textureError('This texture image could not be opened.', error)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function inspectTextureImage(file: File): Promise<InspectedTextureImage> {
  const mimeType = normalizeTextureMime(file)
  if (!mimeType) throw textureError('Choose a PNG or JPG/JPEG texture.')
  if (!file.size) throw textureError('This texture file is empty or corrupted.')
  if (file.size > MAX_BYTES) throw textureError('Textures must be 16 MB or smaller for mobile stability.')
  const dimensions = await decodeDimensions(file)
  if (
    dimensions.width > MAX_DIMENSION
    || dimensions.height > MAX_DIMENSION
    || dimensions.width * dimensions.height > MAX_PIXELS
  ) {
    throw textureError('Textures must be no larger than 4096 pixels per side and 16 megapixels.')
  }
  return { mimeType, ...dimensions }
}

export type TextureImageInspector = typeof inspectTextureImage
