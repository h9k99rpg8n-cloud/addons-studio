import { afterEach, describe, expect, it, vi } from 'vitest'

import { inspectEditorImage, normalizeEditorImageMime } from '@/core/model/modelImageValidation'

describe('Model Studio image validation', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('accepts only PNG and JPEG MIME types with safe extension fallback', () => {
    expect(normalizeEditorImageMime(new File(['x'], 'guide.png', { type: 'image/png' }))).toBe('image/png')
    expect(normalizeEditorImageMime(new File(['x'], 'guide.jpeg', { type: '' }))).toBe('image/jpeg')
    expect(normalizeEditorImageMime(new File(['x'], 'guide.webp', { type: 'image/webp' }))).toBeUndefined()
  })

  it('rejects unsupported and oversized files before attempting a browser decode', async () => {
    await expect(inspectEditorImage(
      new File(['x'], 'guide.webp', { type: 'image/webp' }),
      'reference',
    )).rejects.toMatchObject({ userMessage: 'Choose a PNG or JPG/JPEG image.' })

    await expect(inspectEditorImage(
      new File([new Uint8Array(12 * 1024 * 1024 + 1)], 'huge.png', { type: 'image/png' }),
      'background',
    )).rejects.toMatchObject({ userMessage: 'Images must be 12 MB or smaller for mobile stability.' })
  })

  it('reports failed Safari decoding with a user-facing reference error', async () => {
    class BrokenImage {
      decoding = ''
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(_value: string) { queueMicrotask(() => this.onerror?.()) }
    }
    vi.stubGlobal('Image', BrokenImage)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:broken')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)

    await expect(inspectEditorImage(
      new File(['broken'], 'guide.jpg', { type: 'image/jpeg' }),
      'reference',
    )).rejects.toMatchObject({ userMessage: 'This reference image could not be opened.' })
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:broken')
  })

  it('rejects decoded custom backgrounds above the mobile dimension budget', async () => {
    class WideImage {
      decoding = ''
      naturalWidth = 5_000
      naturalHeight = 1_000
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(_value: string) { queueMicrotask(() => this.onload?.()) }
    }
    vi.stubGlobal('Image', WideImage)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:wide')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)

    await expect(inspectEditorImage(
      new File(['wide'], 'background.png', { type: 'image/png' }),
      'background',
    )).rejects.toMatchObject({
      userMessage: 'Custom backgrounds must be no larger than 4096 pixels per side and 20 megapixels.',
    })
  })
})
