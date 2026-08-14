/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/vue" />

import 'vue'

declare module 'vue' {
  interface ComponentCustomProperties {
    URL: typeof globalThis.URL
  }
}
