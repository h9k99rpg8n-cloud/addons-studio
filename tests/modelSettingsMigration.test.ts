import { describe, expect, it } from 'vitest'

import {
  cloneEditorState,
  createDefaultEditorState,
  resetEditorPreferences,
} from '@/core/model/modelFactory'

describe('Snapshot 3 Model Studio settings migration', () => {
  it('migrates Tactilismos to Touch Gizmo and derives independent Resize precision', () => {
    const legacy = createDefaultEditorState()
    legacy.modeling.controlMode = 'tactilismos'
    legacy.snapping = {
      transform: 0.25,
      customTransform: 0.125,
      rotation: 22.5,
    }
    const migrated = cloneEditorState(legacy)
    expect(migrated.modeling.controlMode).toBe('touch-gizmo')
    expect(migrated.snapping).toMatchObject({
      transform: 0.25,
      resize: 0.25,
      customTransform: 0.125,
      customResize: 0.125,
      rotation: 22.5,
      customRotation: 1,
    })
  })

  it('persists independent precision, camera, language, and experimental settings', () => {
    const source = createDefaultEditorState()
    source.snapping = {
      transform: 0.5,
      customTransform: 0.125,
      resize: 0.25,
      customResize: 0.0625,
      rotation: 45,
      customRotation: 7.5,
    }
    source.camera = {
      orbitSensitivity: 1.2,
      panSensitivity: 0.8,
      zoomSensitivity: 1.4,
      profile: 'two-finger',
    }
    source.modeling.language = 'es'
    source.experimental.touchRotate = true
    expect(cloneEditorState(source)).toMatchObject(source)
  })

  it('resets only preferences and does not discard the stored custom background asset', () => {
    const source = createDefaultEditorState()
    source.modeling.controlMode = 'touch-gizmo'
    source.modeling.transformSpace = 'local'
    source.snapping.transform = 0.25
    source.camera.orbitSensitivity = 2
    source.background = {
      type: 'custom',
      customAssetId: 'asset-id',
      fit: 'fit',
      opacity: 0.5,
      brightness: 0.6,
    }
    const reset = resetEditorPreferences(source, 'es')
    expect(reset).toMatchObject({
      modeling: { controlMode: 'hybrid', transformSpace: 'global', language: 'es' },
      snapping: { transform: 1, resize: 1, rotation: 15 },
      camera: { orbitSensitivity: 1, panSensitivity: 1, zoomSensitivity: 1 },
      background: { type: 'dark-studio', customAssetId: 'asset-id' },
    })
  })
})
