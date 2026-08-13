import type { ModelEditorAsset } from '@/types/model'

interface RuntimeRecord {
  blob: Blob
  url: string
}

/**
 * Owns one Object URL per persisted editor asset for a Model Studio session.
 * Both viewports receive the same URL, avoiding duplicate Blob URLs and decodes.
 */
export class ModelEditorAssetRuntime {
  private readonly records = new Map<string, RuntimeRecord>()

  sync(assets: readonly ModelEditorAsset[]): { urls: Record<string, string>; failedIds: string[] } {
    const activeIds = new Set(assets.map((asset) => asset.id))
    for (const [id, record] of this.records) {
      if (activeIds.has(id)) continue
      URL.revokeObjectURL(record.url)
      this.records.delete(id)
    }

    const failedIds: string[] = []
    for (const asset of assets) {
      const current = this.records.get(asset.id)
      if (current?.blob === asset.blob) continue
      if (current) URL.revokeObjectURL(current.url)
      try {
        this.records.set(asset.id, {
          blob: asset.blob,
          url: URL.createObjectURL(asset.blob),
        })
      } catch {
        this.records.delete(asset.id)
        failedIds.push(asset.id)
      }
    }

    return {
      urls: Object.fromEntries([...this.records].map(([id, record]) => [id, record.url])),
      failedIds,
    }
  }

  dispose(): void {
    for (const record of this.records.values()) URL.revokeObjectURL(record.url)
    this.records.clear()
  }
}
