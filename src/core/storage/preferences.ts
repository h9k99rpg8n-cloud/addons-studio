const WELCOME_KEY = 'addons-studio:welcome-complete'

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
