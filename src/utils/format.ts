export function formatBytes(value?: number): string {
  if (value === undefined || !Number.isFinite(value)) return 'Unavailable'
  if (value < 1024) return `${value} B`

  const units = ['KB', 'MB', 'GB', 'TB']
  let amount = value / 1024
  let unitIndex = 0

  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024
    unitIndex += 1
  }

  return `${amount.toFixed(amount >= 10 ? 1 : 2)} ${units[unitIndex]}`
}

export function formatRelativeDate(timestamp: number, now = Date.now(), locale?: string): string {
  const elapsed = Math.max(0, now - timestamp)
  const minutes = Math.floor(elapsed / 60_000)
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' })

  if (minutes < 1) return relative.format(0, 'second')
  if (minutes < 60) return relative.format(-minutes, 'minute')

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return relative.format(-hours, 'hour')

  const days = Math.floor(hours / 24)
  if (days < 7) return relative.format(-days, 'day')

  return new Intl.DateTimeFormat(locale, {
    year: timestamp < new Date(now).setFullYear(new Date(now).getFullYear() - 1) ? 'numeric' : undefined,
    month: 'short',
    day: 'numeric',
  }).format(timestamp)
}
