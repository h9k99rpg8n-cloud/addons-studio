import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const viewportSource = readFileSync(
  resolve(process.cwd(), 'src/features/model-studio/components/ModelViewport.vue'),
  'utf8',
)
const studioSource = readFileSync(
  resolve(process.cwd(), 'src/features/model-studio/ModelStudioView.vue'),
  'utf8',
)
const referencesSource = readFileSync(
  resolve(process.cwd(), 'src/features/model-studio/components/ViewportReferences.vue'),
  'utf8',
)
const backgroundSource = readFileSync(
  resolve(process.cwd(), 'src/features/model-studio/components/EditorBackgroundLayer.vue'),
  'utf8',
)

describe('mobile Model Studio viewport architecture', () => {
  it('keeps custom touch gizmos and does not import default TransformControls', () => {
    expect(viewportSource).toContain('gizmoPickers')
    expect(viewportSource).toContain('pickerMaterial')
    expect(viewportSource).toContain('opacity: 0')
    expect(viewportSource).not.toContain('TransformControls')
  })

  it('implements Tactilismos without stealing empty-space camera gestures', () => {
    expect(viewportSource).toContain("mode: 'move' | 'scale' | 'rotate'")
    expect(viewportSource).toContain('startDirectTouch')
    expect(viewportSource).toContain('buildUniformResizeState')
    expect(viewportSource).toContain('Hold object: Tactilismo')
    expect(viewportSource).toContain('emptyPointer =')
    expect(studioSource).toContain('controlMode')
  })

  it('integrates orbit, pinch, and pan without a dedicated orbit modeling tool', () => {
    expect(viewportSource).toContain('controls.enabled = true')
    expect(viewportSource).toContain('three.TOUCH.DOLLY_PAN')
    expect(studioSource).not.toContain("id: 'orbit'")
  })

  it('keeps References 2.0 outside Three.js picking and removes only the visible origin sphere', () => {
    expect(viewportSource).toContain('ViewportReferences')
    expect(viewportSource).not.toContain('TextureLoader')
    expect(viewportSource).not.toContain('PlaneGeometry')
    expect(referencesSource).toContain('pointer-events: none')
    expect(referencesSource).toContain('reference.view === props.view')
    expect(viewportSource).not.toContain('SphereGeometry')
    expect(viewportSource).toContain('GridHelper')
    expect(viewportSource).toContain('AxesHelper')
  })

  it('exposes complete standard views and real one/two viewport layouts', () => {
    for (const view of ['perspective', 'isometric', 'front', 'back', 'left', 'right', 'top', 'bottom']) {
      expect(viewportSource).toContain(`${view}:`)
    }
    expect(studioSource).toContain('setViewportLayout(1)')
    expect(studioSource).toContain('setViewportLayout(2)')
    expect(studioSource).toContain('Three and four viewports are coming later')
  })

  it('freezes resize projection and applies gesture spike safeguards', () => {
    expect(viewportSource).toContain('projection,')
    expect(viewportSource).toContain('sanitizeGestureDelta')
    expect(viewportSource).toContain('initialExtent')
    expect(viewportSource).toContain('cameraDistance')
    expect(viewportSource).toContain('isPointerStepContinuous')
  })

  it('renders procedural and custom editor backgrounds behind the transparent WebGL canvas', () => {
    expect(viewportSource).toContain('setClearColor(0x000000, 0)')
    for (const type of ['sky', 'night', 'sunset', 'snow', 'custom']) {
      expect(backgroundSource).toContain(`editor-background--${type}`)
    }
    expect(studioSource).toContain('addBackgroundAsset')
    expect(studioSource).toContain('removeBackgroundAsset')
  })

  it('keeps every editable Model Studio control at an iOS-safe effective font size', () => {
    expect(studioSource).toContain("input:not([type='range'])")
    expect(studioSource).toContain('font-size: max(1rem, 16px)')
  })
})
