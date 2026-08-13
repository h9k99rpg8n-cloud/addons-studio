import { afterEach, describe, expect, it, vi } from 'vitest'

import { ModelEditorAssetRuntime } from '@/core/model/modelEditorAssetRuntime'
import type { ModelEditorAsset } from '@/types/model'

function asset(id: string): ModelEditorAsset {
  return {
    id,
    modelId: 'model',
    projectId: 'project',
    kind: 'reference',
    name: `${id}.png`,
    mimeType: 'image/png',
    blob: new Blob([id], { type: 'image/png' }),
    width: 32,
    height: 32,
    createdAt: 1,
  }
}

describe('ModelEditorAssetRuntime', () => {
  afterEach(() => vi.restoreAllMocks())

  it('shares one runtime URL across viewports and revokes it only after removal', () => {
    const create = vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => `blob:${(blob as Blob).size}`)
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const runtime = new ModelEditorAssetRuntime()
    const stored = asset('front')

    const first = runtime.sync([stored])
    const second = runtime.sync([stored])
    expect(first.urls.front).toBe(second.urls.front)
    expect(create).toHaveBeenCalledTimes(1)
    expect(revoke).not.toHaveBeenCalled()

    runtime.sync([])
    expect(revoke).toHaveBeenCalledTimes(1)
    runtime.dispose()
  })
})
