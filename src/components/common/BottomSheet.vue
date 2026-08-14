<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

import IconButton from '@/components/common/IconButton.vue'
import { useLocaleStore } from '@/stores/locale'

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    description?: string
  }>(),
  { description: undefined },
)

const emit = defineEmits<{
  close: []
}>()

const locale = useLocaleStore()
const dialog = ref<HTMLDialogElement>()

watch(
  () => props.open,
  async (open) => {
    await nextTick()
    if (open && !dialog.value?.open) dialog.value?.showModal()
    if (!open && dialog.value?.open) dialog.value.close()
  },
  { immediate: true },
)

function requestClose(): void {
  emit('close')
}

function onCancel(event: Event): void {
  event.preventDefault()
  requestClose()
}

function onBackdrop(event: MouseEvent): void {
  if (event.target === dialog.value) requestClose()
}

onBeforeUnmount(() => dialog.value?.close())
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="bottom-sheet"
      :aria-labelledby="`${title.replace(/\s+/g, '-').toLowerCase()}-title`"
      @cancel="onCancel"
      @click="onBackdrop"
    >
      <section class="bottom-sheet__panel">
        <div class="bottom-sheet__handle" aria-hidden="true" />
        <header class="bottom-sheet__header">
          <div>
            <h2 :id="`${title.replace(/\s+/g, '-').toLowerCase()}-title`">{{ title }}</h2>
            <p v-if="description">{{ description }}</p>
          </div>
          <IconButton icon="x" :label="locale.t('Close')" @click="requestClose" />
        </header>
        <div class="bottom-sheet__content">
          <slot />
        </div>
      </section>
    </dialog>
  </Teleport>
</template>

<style scoped>
.bottom-sheet {
  width: 100%;
  max-width: none;
  height: 100%;
  max-height: none;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-text);
  overflow: hidden;
}

.bottom-sheet::backdrop {
  background: var(--color-backdrop);
  backdrop-filter: blur(2px);
}

.bottom-sheet__panel {
  position: absolute;
  inset: auto 0 0;
  max-height: min(82dvh, 760px);
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border-strong);
  border-bottom: 0;
  border-radius: var(--radius-2xl) var(--radius-2xl) 0 0;
  padding: 0 var(--sheet-padding) calc(var(--space-4) + env(safe-area-inset-bottom));
  background: var(--color-surface-strong);
  box-shadow: var(--shadow-sheet);
  animation: sheet-in var(--motion-medium) var(--ease-out);
}

.bottom-sheet__handle {
  width: 2.5rem;
  height: 0.28rem;
  margin: 0.65rem auto 0.25rem;
  border-radius: 999px;
  background: var(--color-border-strong);
}

.bottom-sheet__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: var(--space-2) 0 var(--space-4);
}

.bottom-sheet__header h2 {
  margin: 0;
  font-size: 1.25rem;
}

.bottom-sheet__header p {
  margin: 0.28rem 0 0;
  color: var(--color-text-muted);
  font-size: 0.88rem;
}

.bottom-sheet__content {
  overflow: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  scrollbar-color: var(--color-border-strong) transparent;
}

@keyframes sheet-in {
  from {
    transform: translateY(100%);
  }
}
</style>
