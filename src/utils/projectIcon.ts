import type { ProjectIcon } from '@/types/project'

const MAX_ICON_FILE_SIZE = 2 * 1024 * 1024
const ICON_SIZE = 256
const SUPPORTED_ICON_TYPES = new Set(['image/png', 'image/jpeg'])

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('The selected image could not be read.'))
    image.src = url
  })
}

export async function createImportedProjectIcon(file: File): Promise<ProjectIcon> {
  if (!SUPPORTED_ICON_TYPES.has(file.type)) {
    throw new Error('Choose a PNG or JPG image.')
  }

  if (file.size > MAX_ICON_FILE_SIZE) {
    throw new Error('Choose an image smaller than 2 MB.')
  }

  const objectUrl = URL.createObjectURL(file)

  try {
    const image = await loadImage(objectUrl)
    const canvas = document.createElement('canvas')
    canvas.width = ICON_SIZE
    canvas.height = ICON_SIZE
    const context = canvas.getContext('2d')

    if (!context) throw new Error('This browser could not prepare the project icon.')

    const sourceSize = Math.min(image.naturalWidth, image.naturalHeight)
    const sourceX = (image.naturalWidth - sourceSize) / 2
    const sourceY = (image.naturalHeight - sourceSize) / 2
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      ICON_SIZE,
      ICON_SIZE,
    )

    return {
      kind: 'image',
      value: canvas.toDataURL('image/webp', 0.84),
    }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
