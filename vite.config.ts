import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

export function resolveBasePath(environment: NodeJS.ProcessEnv = process.env): string {
  if (environment.VITE_BASE_URL) {
    const value = environment.VITE_BASE_URL
    return value.endsWith('/') ? value : `${value}/`
  }

  const repositoryName = environment.GITHUB_REPOSITORY?.split('/').at(-1)
  return environment.GITHUB_ACTIONS === 'true' && repositoryName ? `/${repositoryName}/` : '/'
}

export default defineConfig(() => {
  const base = resolveBasePath()

  return {
    base,
    plugins: [
      vue(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: ['icon.svg', 'apple-touch-icon.png'],
        manifest: {
          id: base,
          name: 'Addons Studio',
          short_name: 'Addons Studio',
          description: 'Create Minecraft Bedrock projects directly from your mobile browser.',
          start_url: base,
          scope: base,
          display: 'standalone',
          orientation: 'any',
          background_color: '#0d1117',
          theme_color: '#111821',
          categories: ['developer', 'productivity', 'utilities'],
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          cacheId: 'addons-studio',
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          navigateFallback: 'index.html',
          globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      target: 'es2022',
      cssCodeSplit: true,
      chunkSizeWarningLimit: 500,
    },
    test: {
      environment: 'happy-dom',
      setupFiles: ['./tests/setup.ts'],
      clearMocks: true,
      restoreMocks: true,
      unstubGlobals: true,
    },
  }
})
