import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from '@/app/App.vue'
import { installGlobalErrorHandler } from '@/core/errors/globalErrorHandler'
import { router } from '@/router'
import { useThemeStore } from '@/stores/theme'
import { useLocaleStore } from '@/stores/locale'
import '@/styles/index.css'

const app = createApp(App)
const pinia = createPinia()

app.config.globalProperties.URL = globalThis.URL
app.use(pinia)
app.use(router)

useThemeStore(pinia).initialize()
useLocaleStore(pinia).initialize()
installGlobalErrorHandler(app)

app.mount('#app')
