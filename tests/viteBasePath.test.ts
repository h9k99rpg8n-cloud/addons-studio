import { describe, expect, it } from 'vitest'

import { resolveBasePath } from '../vite.config'

describe('GitHub Pages base path', () => {
  it('uses the repository subpath in GitHub Actions', () => {
    expect(
      resolveBasePath({
        GITHUB_ACTIONS: 'true',
        GITHUB_REPOSITORY: 'h9k99rpg8n-cloud/addons-studio',
      }),
    ).toBe('/addons-studio/')
  })

  it('uses root during local development', () => {
    expect(resolveBasePath({})).toBe('/')
  })
})
