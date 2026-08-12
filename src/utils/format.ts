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

export function formatRelativeDate(timestamp: number, now = Date.now()): string {
  const elapsed = Math.max(0, now - timestamp)
  const minutes = Math.floor(elapsed / 60_000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`

  return new Intl.DateTimeFormat(undefined, {
    year: timestamp < new Date(now).setFullYear(new Date(now).getFullYear() - 1) ? 'numeric' : undefined,
    month: 'short',
    day: 'numeric',
  }).format(timestamp)
}
