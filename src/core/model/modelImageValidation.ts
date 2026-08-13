import { AppError } from '@/core/errors/AppError'

export type EditorImagePurpose = 'reference' | 'background'

export interface InspectedEditorImage {
  mimeType: 'image/png' | 'image/jpeg'
  width: number
  height: number
}

const LIMITS: Record<EditorImagePurpose, { bytes: number; dimension: number; pixels: number }> = {
  reference: { bytes: 12 * 1024 * 1024, dimension: 8192, pixels: 32_000_000 },
  background: { bytes: 12 * 1024 * 1024, dimension: 4096, pixels: 20_000_000 },
}

function imageError(purpose: EditorImagePurpose, message: string, cause?: unknown): AppError {
  return new AppError(
    purpose === 'reference' ? 'REFERENCE_IMAGE_FAILED' : 'EDITOR_IMAGE_FAILED',
    message,
    cause instanceof Error ? { cause } : undefined,
  )
}

export function normalizeEditorImageMime(file: File): InspectedEditorImage['mimeType'] | undefined {
  const type = file.type.toLowerCase()
  if (type === 'image/png') return 'image/png'
  if (type === 'image/jpeg' || type === 'image/jpg') return 'image/jpeg'
  if (!type) {
    if (/\.png$/i.test(file.name)) return 'image/png'
    if (/\.jpe?g$/i.test(file.name)) return 'image/jpeg'
  }
  return undefined
}

async function decodeDimensions(file: File, purpose: EditorImagePurpose): Promise<{ width: number; height: number }> {
  if (typeof Image === 'undefined' || typeof URL.createObjectURL !== 'function') {
    // Unit-test/non-DOM runtimes inject an inspector at the repository boundary.
    throw imageError(purpose, 'This image could not be decoded on this device or browser.')
  }

  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.decoding = 'async'
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Image decode failed'))
      image.src = url
    })
    const width = image.naturalWidth
    const height = image.naturalHeight
    if (!width || !height) throw new Error('Image dimensions are unavailable')
    return { width, height }
  } catch (error) {
    throw imageError(
      purpose,
      purpose === 'reference'
        ? 'This reference image could not be opened.'
        : 'This custom background image could not be opened.',
      error,
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function inspectEditorImage(
  file: File,
  purpose: EditorImagePurpose,
): Promise<InspectedEditorImage> {
  const mimeType = normalizeEditorImageMime(file)
  if (!mimeType) {
    throw imageError(purpose, 'Choose a PNG or JPG/JPEG image.')
  }
  const limits = LIMITS[purpose]
  if (!file.size) throw imageError(purpose, 'This image file is empty or corrupted.')
  if (file.size > limits.bytes) {
    throw imageError(purpose, 'Images must be 12 MB or smaller for mobile stability.')
  }

  const dimensions = await decodeDimensions(file, purpose)
  if (
    dimensions.width > limits.dimension
    || dimensions.height > limits.dimension
    || dimensions.width * dimensions.height > limits.pixels
  ) {
    throw imageError(
      purpose,
      purpose === 'background'
        ? 'Custom backgrounds must be no larger than 4096 pixels per side and 20 megapixels.'
        : 'Reference images must be no larger than 8192 pixels per side and 32 megapixels.',
    )
  }
  return { mimeType, ...dimensions }
}

export type EditorImageInspector = typeof inspectEditorImage
