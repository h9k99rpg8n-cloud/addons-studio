type LogLevel = 'info' | 'warn' | 'error'

interface LogContext {
  area: string
  action?: string
  details?: Record<string, unknown>
}

function write(level: LogLevel, message: string, context: LogContext): void {
  const record = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  }

  if (level === 'error') console.error('[Addons Studio]', record)
  else if (level === 'warn') console.warn('[Addons Studio]', record)
  else if (import.meta.env.DEV) console.info('[Addons Studio]', record)
}

export const logger = {
  info: (message: string, context: LogContext) => write('info', message, context),
  warn: (message: string, context: LogContext) => write('warn', message, context),
  error: (message: string, context: LogContext) => write('error', message, context),
}
