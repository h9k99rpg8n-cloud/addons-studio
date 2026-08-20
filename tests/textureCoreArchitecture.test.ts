import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

const orchestrator = source('src/features/texture-core/TextureCoreView.vue')
const uvWorkspace = source('src/features/texture-core/TextureUvWorkspace.vue')
const paintCanvas = source('src/features/texture-core/TexturePaintCanvas.vue')
const preview = source('src/features/texture-core/TextureModelPreview.vue')

describe('Texture Core stability architecture', () => {
  it('keeps UV, Paint, and preview responsibilities outside the view orchestrator', () => {
    expect(orchestrator).toContain("import TextureUvWorkspace from './TextureUvWorkspace.vue'")
    expect(orchestrator).toContain("import TexturePaintCanvas from './TexturePaintCanvas.vue'")
    expect(orchestrator).toContain("import TextureModelPreview from './TextureModelPreview.vue'")
    expect(orchestrator).not.toContain('getImageData(')
    expect(orchestrator).not.toContain('new THREE.')
  })

  it('uses one UV commit channel and coalesces persistence by binding', () => {
    expect(orchestrator).toContain('@commit-binding="persistBinding"')
    expect(orchestrator).not.toContain('@commit="persistBinding"')
    expect(orchestrator).toContain('pendingUvSaves')
    expect(orchestrator).toContain('runningUvSaves')
    expect(orchestrator).toContain('persistedUvs')
    expect(orchestrator).toContain('saveFaceBindings')
  })

  it('hardens UV gestures for Safari and keeps islands inside the atlas', () => {
    expect(uvWorkspace).toContain('normalizeUvRect')
    expect(uvWorkspace).toContain('setPointerCapture')
    expect(uvWorkspace).toContain('releasePointerCapture')
    expect(uvWorkspace).toContain('@pointercancel="finishGesture"')
    expect(uvWorkspace).toContain('@lostpointercapture="finishGesture"')
    expect(uvWorkspace).toContain('touch-action: none')
    expect(uvWorkspace).toContain('-webkit-touch-callout: none')
  })

  it('keeps Paint pixel-perfect and separates drawing from pinch gestures', () => {
    expect(paintCanvas).toContain("from '@/core/texture/texturePaintService'")
    expect(paintCanvas).toContain('const TOUCH_DEADZONE = 6')
    expect(paintCanvas).toContain('getCoalescedEvents')
    expect(paintCanvas).toContain('beginPinch')
    expect(paintCanvas).toContain('@pointercancel="pointerCancel"')
    expect(paintCanvas).toContain('@lostpointercapture="pointerCancel"')
    expect(paintCanvas).toContain('image-rendering: pixelated')
    expect(paintCanvas).toContain('font-size: 16px')
    expect(paintCanvas).toContain('URL.revokeObjectURL')
  })

  it('owns and disposes the lightweight Three.js preview runtime', () => {
    expect(preview).toContain("powerPreference: 'low-power'")
    expect(preview).toContain('Math.min(globalThis.devicePixelRatio || 1, 1.5)')
    expect(preview).toContain('textureLoadGeneration')
    expect(preview).toContain('URL.revokeObjectURL')
    expect(preview).toContain('observer?.disconnect()')
    expect(preview).toContain('controls?.dispose()')
    expect(preview).toContain('renderer?.forceContextLoss()')
    expect(preview).not.toMatch(/const\s+(scene|camera|renderer)\s*=\s*ref/)
  })
})
