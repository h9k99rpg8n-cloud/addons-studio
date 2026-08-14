import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

const viewportSource = source('src/features/model-studio/components/ModelViewport.vue')
const studioSource = source('src/features/model-studio/ModelStudioView.vue')
const sceneRuntime = source('src/features/model-studio/runtime/threeSceneRuntime.ts')
const cameraRuntime = source('src/features/model-studio/runtime/cameraRuntime.ts')
const gizmoRuntime = source('src/features/model-studio/runtime/classicGizmoRuntime.ts')
const touchRuntime = source('src/features/model-studio/runtime/touchGizmoRuntime.ts')
const inflateRuntime = source('src/features/model-studio/runtime/inflateRuntime.ts')
const meshRuntime = source('src/features/model-studio/runtime/modelMeshRuntime.ts')
const mathRuntime = source('src/features/model-studio/runtime/viewportMath.ts')
const resourcesRuntime = source('src/features/model-studio/runtime/viewportResources.ts')
const backgroundGuideSource = source('src/features/model-studio/runtime/BackgroundGuideLayer.vue')
const referencesSource = source('src/features/model-studio/components/ViewportReferences.vue')
const backgroundSource = source('src/features/model-studio/components/EditorBackgroundLayer.vue')
const settingsSource = source('src/features/model-studio/components/ModelSettingsSheet.vue')

describe('0.0.3.6.3 modular mobile Model Studio architecture', () => {
  it('keeps the Vue viewport as an orchestrator over focused runtime modules', () => {
    for (const moduleName of [
      'threeSceneRuntime',
      'cameraRuntime',
      'classicGizmoRuntime',
      'touchGizmoRuntime',
      'inflateRuntime',
      'modelMeshRuntime',
      'viewportSelection',
    ]) {
      expect(viewportSource).toContain(moduleName)
    }
    expect(sceneRuntime).not.toContain("from 'vue'")
    expect(cameraRuntime).not.toContain("from 'vue'")
    expect(gizmoRuntime).not.toContain("from 'vue'")
    expect(touchRuntime).not.toContain("from 'vue'")
    expect(inflateRuntime).not.toContain("from 'vue'")
    expect(meshRuntime).not.toContain("from 'vue'")
  })

  it('keeps custom classic gizmos with large invisible touch pickers', () => {
    expect(gizmoRuntime).toContain('rebuildClassicGizmo')
    expect(gizmoRuntime).toContain('opacity: 0')
    expect(gizmoRuntime).toContain('CylinderGeometry(0.15, 0.15, 1.05')
    expect(gizmoRuntime).not.toContain('TransformControls')
  })

  it('makes Touch Gizmo Move, Resize, and Rotate official without experimental gating', () => {
    expect(touchRuntime).toContain("state.mode === 'move'")
    expect(touchRuntime).toContain("state.mode === 'scale'")
    expect(touchRuntime).toContain("'rotate'")
    expect(viewportSource).not.toContain("!props.touchRotateEnabled")
    expect(settingsSource).toContain('Move, resize, and rotate the selected object directly with touch.')
    expect(settingsSource).not.toContain('Direct Rotate is experimental.')
    expect(settingsSource).not.toContain("page === 'experimental'")
  })

  it('formalizes one CSS-pixel deadzone for touch intent', () => {
    expect(mathRuntime).toContain('TOUCH_DEADZONE_PX = 8')
    expect(mathRuntime).toContain('movedBeyondDeadzone')
    expect(viewportSource).toContain('TOUCH_DEADZONE_PX')
  })

  it('keeps Three.js runtime objects outside deep Vue reactivity', () => {
    expect(sceneRuntime).toContain('StudioThreeSceneRuntime')
    expect(sceneRuntime).not.toContain('reactive(')
    expect(sceneRuntime).not.toContain('ref(')
    expect(sceneRuntime).not.toContain('shallowRef(')
    expect(viewportSource).toContain('let runtime: StudioThreeSceneRuntime | undefined')
  })

  it('keeps guides outside Three.js while consolidating Background / Guide rendering', () => {
    expect(viewportSource).toContain('BackgroundGuideLayer')
    expect(backgroundGuideSource).toContain('EditorBackgroundLayer')
    expect(backgroundGuideSource).toContain('ViewportReferences')
    expect(referencesSource).toContain('pointer-events: none')
    expect(referencesSource).toContain('reference.view === props.view')
    expect(sceneRuntime).not.toContain('TextureLoader')
    expect(sceneRuntime).not.toContain('PlaneGeometry')
  })

  it('preserves all standard views through the camera runtime', () => {
    const viewMath = source('src/features/model-studio/runtime/viewportMath.ts')
    for (const view of ['perspective', 'isometric', 'front', 'back', 'left', 'right', 'top', 'bottom']) {
      expect(viewMath).toContain(`${view}:`)
    }
    expect(studioSource).toContain('setViewportLayout(1)')
    expect(studioSource).toContain('setViewportLayout(2)')
  })

  it('keeps gesture spike safeguards in both classic and direct-touch paths', () => {
    const classicDrag = source('src/features/model-studio/runtime/classicDragRuntime.ts')
    expect(classicDrag).toContain('sanitizeGestureDelta')
    expect(touchRuntime).toContain('sanitizeGestureDelta')
    expect(viewportSource).toContain('isPointerStepContinuous')
  })

  it('uses an original pixel-inspired preview material with crisp sampling', () => {
    expect(resourcesRuntime).toContain('DataTexture')
    expect(resourcesRuntime).toContain('NearestFilter')
    expect(resourcesRuntime).toContain('generateMipmaps = false')
    expect(resourcesRuntime).toContain('createStudioPreviewMaterials')
    expect(meshRuntime).toContain('stablePreviewMaterialIndex')
  })

  it('disposes runtime resources on teardown', () => {
    expect(sceneRuntime).toContain('disposeStudioThreeSceneRuntime')
    expect(sceneRuntime).toContain('runtime.controls.dispose()')
    expect(sceneRuntime).toContain('runtime.renderer.dispose()')
    expect(resourcesRuntime).toContain('set.texture.dispose()')
    expect(viewportSource).toContain("removeEventListener('pointerdown'")
  })

  it('renders procedural and custom editor backgrounds behind transparent WebGL', () => {
    expect(sceneRuntime).toContain('setClearColor(0x000000, 0)')
    for (const type of ['sky', 'night', 'sunset', 'snow', 'custom']) {
      expect(backgroundSource).toContain(`editor-background--${type}`)
    }
  })

  it('keeps Safari imports alive and editable controls iOS-safe', () => {
    expect(studioSource).toContain("input:not([type='range'])")
    expect(studioSource).toContain('font-size: max(1rem, 16px)')
    expect(settingsSource).toContain('font-size: 16px')
  })
})
