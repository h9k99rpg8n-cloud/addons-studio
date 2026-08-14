const WELCOME_KEY = 'addons-studio:welcome-complete'
const RELEASE_KEY = 'addons-studio:last-acknowledged-release'

function getStorage(): Storage | undefined {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

export function hasCompletedWelcome(): boolean {
  return getStorage()?.getItem(WELCOME_KEY) === 'true'
}

export function completeWelcome(): void {
  getStorage()?.setItem(WELCOME_KEY, 'true')
}

export function hasAcknowledgedRelease(release: string): boolean {
  return getStorage()?.getItem(RELEASE_KEY) === release
}

export function acknowledgeRelease(release: string): void {
  getStorage()?.setItem(RELEASE_KEY, release)
}
