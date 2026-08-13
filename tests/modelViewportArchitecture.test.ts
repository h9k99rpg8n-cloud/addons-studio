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

describe('mobile Model Studio viewport architecture', () => {
  it('keeps custom touch gizmos and does not import default TransformControls', () => {
    expect(viewportSource).toContain('gizmoPickers')
    expect(viewportSource).toContain('pickerMaterial')
    expect(viewportSource).toContain('opacity: 0')
    expect(viewportSource).not.toContain('TransformControls')
  })

  it('integrates orbit, pinch, and pan without a dedicated orbit modeling tool', () => {
    expect(viewportSource).toContain('controls.enabled = true')
    expect(viewportSource).toContain('three.TOUCH.DOLLY_PAN')
    expect(studioSource).not.toContain("id: 'orbit'")
  })

  it('keeps locked references out of picking and removes only the visible origin sphere', () => {
    expect(viewportSource).toContain('mesh.userData.locked !== true')
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
})
