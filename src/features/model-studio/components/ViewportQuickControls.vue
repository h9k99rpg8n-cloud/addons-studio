<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import AppIcon from '@/components/common/AppIcon.vue'
import { useLocaleStore } from '@/stores/locale'
import type { StudioCameraView, StudioTransformSpace } from '@/types/model'

defineProps<{
  view: StudioCameraView
  transformSpace: StudioTransformSpace
  canMaximize?: boolean
  maximized?: boolean
}>()

const emit = defineEmits<{
  updateView: [view: StudioCameraView]
  updateTransformSpace: [space: StudioTransformSpace]
  toggleMaximize: []
}>()

const locale = useLocaleStore()
const openMenu = ref<'view' | 'space'>()
const root = ref<HTMLElement>()
const views: readonly StudioCameraView[] = ['perspective', 'isometric', 'front', 'back', 'left', 'right', 'top', 'bottom']
const spaces: readonly StudioTransformSpace[] = ['global', 'local', 'parent']

function label(value: string): string {
  if (value === 'back') return locale.t('Back view')
  return locale.t(value[0]!.toUpperCase() + value.slice(1))
}

function chooseView(view: StudioCameraView): void {
  emit('updateView', view)
  openMenu.value = undefined
}

function chooseSpace(space: StudioTransformSpace): void {
  emit('updateTransformSpace', space)
  openMenu.value = undefined
}

function closeOutside(event: PointerEvent): void {
  if (!root.value?.contains(event.target as Node)) openMenu.value = undefined
}

onMounted(() => document.addEventListener('pointerdown', closeOutside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', closeOutside))
</script>

<template>
  <aside ref="root" class="viewport-quick-controls" :aria-label="locale.t('Viewport controls')" @pointerdown.stop @pointermove.stop @pointerup.stop>
    <div class="quick-control">
      <button type="button" :aria-expanded="openMenu === 'view'" @click="openMenu = openMenu === 'view' ? undefined : 'view'">{{ label(view) }}<span aria-hidden="true">▾</span></button>
      <div v-if="openMenu === 'view'" class="quick-menu" role="menu">
        <button v-for="option in views" :key="option" type="button" role="menuitemradio" :aria-checked="view === option" @click="chooseView(option)"><AppIcon :name="view === option ? 'check' : 'camera'" :size="17" />{{ label(option) }}</button>
      </div>
    </div>
    <div class="quick-control">
      <button type="button" :aria-expanded="openMenu === 'space'" @click="openMenu = openMenu === 'space' ? undefined : 'space'">{{ label(transformSpace) }}<span aria-hidden="true">▾</span></button>
      <div v-if="openMenu === 'space'" class="quick-menu" role="menu">
        <button v-for="option in spaces" :key="option" type="button" role="menuitemradio" :aria-checked="transformSpace === option" @click="chooseSpace(option)"><AppIcon :name="transformSpace === option ? 'check' : 'move-3d'" :size="17" />{{ label(option) }}</button>
      </div>
    </div>
    <button v-if="canMaximize" type="button" class="maximize-button" :aria-label="locale.t(maximized ? 'Restore' : 'Maximize')" @click="emit('toggleMaximize')"><AppIcon :name="maximized ? 'restore' : 'maximize'" :size="19" /></button>
  </aside>
</template>

<style scoped>
.viewport-quick-controls { position: absolute; z-index: 8; top: 0.45rem; right: max(0.45rem, env(safe-area-inset-right)); display: flex; align-items: start; gap: 0.32rem; }
.quick-control { position: relative; }
.quick-control > button, .maximize-button { min-height: var(--touch-target); display: inline-flex; align-items: center; justify-content: center; gap: 0.32rem; border: 1px solid rgb(255 255 255 / 0.14); border-radius: 0.7rem; padding: 0 0.65rem; background: rgb(5 8 7 / 0.76); color: #e7eee9; backdrop-filter: blur(10px); font-size: 0.68rem; font-weight: 760; }
.maximize-button { width: var(--touch-target); padding: 0; }
.quick-menu { position: absolute; top: calc(100% + 0.3rem); right: 0; width: max-content; min-width: 9.5rem; display: grid; overflow: hidden; border: 1px solid rgb(255 255 255 / 0.15); border-radius: 0.8rem; padding: 0.22rem; background: rgb(10 14 12 / 0.96); box-shadow: 0 12px 30px rgb(0 0 0 / 0.35); }
.quick-menu button { min-height: var(--touch-target); display: grid; grid-template-columns: 1.4rem 1fr; align-items: center; gap: 0.45rem; border: 0; border-radius: 0.55rem; padding: 0 0.55rem; background: transparent; color: #e7eee9; text-align: left; font-size: 0.72rem; }
.quick-menu button[aria-checked='true'] { background: rgb(55 192 102 / 0.15); color: #75e49b; }
@media (max-width: 390px) { .quick-control > button { max-width: 7.2rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } }
</style>
