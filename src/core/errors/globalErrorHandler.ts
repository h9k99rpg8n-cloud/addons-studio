import type { App } from 'vue'

import { logger } from '@/core/errors/logger'
import { useToastStore } from '@/stores/toasts'

export function installGlobalErrorHandler(app: App): () => void {
  const notify = () => {
    try {
      useToastStore().push({
        type: 'error',
        message: 'Something went wrong. Your local projects were not removed.',
      })
    } catch {
      // The error may happen before Pinia finishes mounting.
    }
  }

  app.config.errorHandler = (error, _instance, info) => {
    logger.error('Unhandled Vue error', {
      area: 'application',
      action: info,
      details: { error },
    })
    notify()
  }

  const onError = (event: ErrorEvent) => {
    logger.error('Unhandled window error', {
      area: 'application',
      details: { message: event.message, filename: event.filename },
    })
    notify()
  }

  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    logger.error('Unhandled promise rejection', {
      area: 'application',
      details: { reason: event.reason },
    })
    notify()
  }

  globalThis.addEventListener('error', onError)
  globalThis.addEventListener('unhandledrejection', onUnhandledRejection)

  return () => {
    globalThis.removeEventListener('error', onError)
    globalThis.removeEventListener('unhandledrejection', onUnhandledRejection)
  }
}
