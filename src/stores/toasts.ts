import { defineStore } from 'pinia'

import type { ToastMessage, ToastType } from '@/types/app'
import { createId } from '@/utils/createId'

const timers = new Map<string, ReturnType<typeof setTimeout>>()

interface ToastInput {
  type: ToastType
  message: string
  duration?: number
}

export const useToastStore = defineStore('toasts', {
  state: () => ({
    messages: [] as ToastMessage[],
  }),
  actions: {
    push(input: ToastInput): string {
      const id = createId()
      const duration = input.duration ?? (input.type === 'error' ? 6500 : 3800)
      this.messages.push({ ...input, id, duration })

      if (duration > 0) {
        timers.set(
          id,
          setTimeout(() => this.remove(id), duration),
        )
      }

      return id
    },
    remove(id: string): void {
      const timer = timers.get(id)
      if (timer) clearTimeout(timer)
      timers.delete(id)
      this.messages = this.messages.filter((message) => message.id !== id)
    },
    clear(): void {
      for (const timer of timers.values()) clearTimeout(timer)
      timers.clear()
      this.messages = []
    },
  },
})
