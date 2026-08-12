<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    description?: string
  }>(),
  { description: undefined },
)

const emit = defineEmits<{ close: [] }>()
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

function close(): void {
  emit('close')
}

function onCancel(event: Event): void {
  event.preventDefault()
  close()
}

function onBackdrop(event: MouseEvent): void {
  if (event.target === dialog.value) close()
}

onBeforeUnmount(() => dialog.value?.close())
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="app-dialog"
      :aria-labelledby="`${title.replace(/\s+/g, '-').toLowerCase()}-dialog-title`"
      @cancel="onCancel"
      @click="onBackdrop"
    >
      <section class="app-dialog__panel">
        <header>
          <h2 :id="`${title.replace(/\s+/g, '-').toLowerCase()}-dialog-title`">{{ title }}</h2>
          <p v-if="description">{{ description }}</p>
        </header>
        <div class="app-dialog__body"><slot /></div>
        <footer class="app-dialog__actions"><slot name="actions" /></footer>
      </section>
    </dialog>
  </Teleport>
</template>

<style scoped>
.app-dialog {
  width: 100%;
  max-width: none;
  height: 100%;
  max-height: none;
  margin: 0;
  border: 0;
  padding: var(--page-gutter);
  background: transparent;
  color: var(--color-text);
}

.app-dialog::backdrop {
  background: var(--color-backdrop);
  backdrop-filter: blur(3px);
}

.app-dialog__panel {
  position: absolute;
  inset: 50% auto auto 50%;
  width: min(calc(100% - (2 * var(--page-gutter))), 420px);
  max-height: calc(100dvh - 2rem - env(safe-area-inset-top) - env(safe-area-inset-bottom));
  overflow: auto;
  transform: translate(-50%, -50%);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-xl);
  padding: 1.2rem;
  background: var(--color-surface-strong);
  box-shadow: var(--shadow-sheet);
  animation: dialog-in var(--motion-medium) var(--ease-out);
}

.app-dialog h2 {
  margin: 0;
  font-size: 1.2rem;
}

.app-dialog header p {
  margin: 0.45rem 0 0;
  color: var(--color-text-muted);
  font-size: 0.9rem;
  line-height: 1.5;
}

.app-dialog__body {
  margin-top: 1rem;
}

.app-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.65rem;
  margin-top: 1.2rem;
}

@keyframes dialog-in {
  from {
    opacity: 0;
    transform: translate(-50%, -46%) scale(0.97);
  }
}
</style>
