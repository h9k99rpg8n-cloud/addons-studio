<script setup lang="ts">
import { onMounted, ref } from 'vue'

import AppBadge from '@/components/common/AppBadge.vue'
import AppButton from '@/components/common/AppButton.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import BrandMark from '@/components/common/BrandMark.vue'
import AppHeader from '@/components/navigation/AppHeader.vue'
import { APP_RELEASE_LABEL, APP_RELEASE_NAME, APP_VERSION } from '@/core/app/release'
import { toAppError } from '@/core/errors/AppError'
import { projectRepository } from '@/core/project/projectRepository'
import { useThemeStore } from '@/stores/theme'
import { useToastStore } from '@/stores/toasts'
import type { ThemePreference } from '@/types/app'
import type { StorageSummary } from '@/types/project'
import { formatBytes } from '@/utils/format'

const theme = useThemeStore()
const toasts = useToastStore()
const storage = ref<StorageSummary>({ projectCount: 0 })
const storageLoading = ref(true)
const clearingCache = ref(false)

const themes: readonly { value: ThemePreference; label: string; icon: string }[] = [
  { value: 'system', label: 'System', icon: 'monitor' },
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
]

async function refreshStorage(): Promise<void> {
  storageLoading.value = true
  try {
    storage.value = await projectRepository.getStorageSummary()
  } catch (error) {
    toasts.push({
      type: 'warning',
      message: toAppError(error, 'Storage details are unavailable right now.').userMessage,
    })
  } finally {
    storageLoading.value = false
  }
}

async function clearTemporaryCache(): Promise<void> {
  clearingCache.value = true
  try {
    const count = await projectRepository.clearTemporaryCache()
    toasts.push({
      type: 'success',
      message:
        count > 0
          ? 'Temporary app cache cleared. Projects were not touched.'
          : 'No temporary app cache needed clearing.',
    })
    await refreshStorage()
  } catch (error) {
    toasts.push({
      type: 'error',
      message: toAppError(error, 'Addons Studio could not clear the temporary cache.').userMessage,
    })
  } finally {
    clearingCache.value = false
  }
}

onMounted(refreshStorage)
</script>

<template>
  <main class="settings-view page-shell">
    <AppHeader title="Settings" subtitle="Local preferences and storage" />

    <section class="settings-section" aria-labelledby="appearance-heading">
      <header>
        <span><AppIcon name="palette" :size="21" /></span>
        <div><h2 id="appearance-heading">Appearance</h2><p>Choose how the studio looks on this device.</p></div>
      </header>
      <fieldset class="theme-options">
        <legend class="visually-hidden">Theme</legend>
        <label v-for="option in themes" :key="option.value">
          <input
            :checked="theme.preference === option.value"
            type="radio"
            name="theme"
            :value="option.value"
            @change="theme.setPreference(option.value)"
          />
          <span><AppIcon :name="option.icon" :size="20" />{{ option.label }}</span>
        </label>
      </fieldset>
    </section>

    <section class="settings-section" aria-labelledby="storage-heading">
      <header>
        <span><AppIcon name="database" :size="21" /></span>
        <div><h2 id="storage-heading">Storage</h2><p>Projects stay in this browser using IndexedDB.</p></div>
      </header>
      <dl class="storage-stats">
        <div>
          <dt>Local projects</dt>
          <dd>{{ storageLoading ? '…' : storage.projectCount }}</dd>
        </div>
        <div>
          <dt>Approximate browser use</dt>
          <dd>{{ storageLoading ? '…' : formatBytes(storage.usageBytes) }}</dd>
        </div>
        <div v-if="storage.quotaBytes">
          <dt>Storage available</dt>
          <dd>{{ formatBytes(storage.quotaBytes) }}</dd>
        </div>
      </dl>
      <AppButton variant="secondary" :loading="clearingCache" block @click="clearTemporaryCache">
        Clear temporary cache
      </AppButton>
      <p class="storage-note">
        This removes only Addons Studio’s reloadable app-shell cache. It does not delete projects or recovery snapshots.
      </p>
    </section>

    <section class="settings-section about-card" aria-labelledby="about-heading">
      <header>
        <BrandMark :size="44" />
        <div>
          <div class="about-card__title">
            <h2 id="about-heading">Addons Studio</h2>
            <AppBadge tone="accent">{{ APP_RELEASE_LABEL }}</AppBadge>
          </div>
          <p>Version {{ APP_VERSION }} · {{ APP_RELEASE_NAME }}</p>
        </div>
      </header>
      <ul class="about-list">
        <li><AppIcon name="check-circle" :size="18" />Free and Open Source</li>
        <li><AppIcon name="shield" :size="18" />MIT License</li>
        <li><AppIcon name="monitor" :size="18" />Mobile First</li>
      </ul>
      <div class="about-actions">
        <a
          class="link-button"
          href="https://github.com/h9k99rpg8n-cloud/addons-studio"
          target="_blank"
          rel="noreferrer"
        >
          <AppIcon name="github" :size="19" />View Source<AppIcon name="external-link" :size="16" />
        </a>
        <a
          class="text-link"
          href="https://github.com/h9k99rpg8n-cloud/addons-studio/blob/main/THIRD_PARTY_NOTICES.md"
          target="_blank"
          rel="noreferrer"
        >Third-party acknowledgments</a>
      </div>
      <p class="disclaimer">
        Independent community project. Not affiliated with Mojang Studios or Microsoft.
      </p>
    </section>
  </main>
</template>

<style scoped>
.settings-view {
  display: grid;
  gap: 0.8rem;
}

.settings-section {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: var(--card-padding);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.settings-section > header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0.7rem;
  margin-bottom: 1rem;
}

.settings-section > header > span {
  width: 2.6rem;
  height: 2.6rem;
  display: grid;
  place-items: center;
  border-radius: var(--radius-md);
  background: var(--color-accent-soft);
  color: var(--color-accent-strong);
}

.settings-section h2 {
  margin: 0;
  font-size: 0.98rem;
}

.settings-section header p {
  margin: 0.2rem 0 0;
  color: var(--color-text-subtle);
  font-size: 0.7rem;
  line-height: 1.4;
}

.theme-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.45rem;
  margin: 0;
  border: 0;
  padding: 0;
}

.theme-options label {
  position: relative;
  min-width: 0;
}

.theme-options input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.theme-options span {
  min-height: 4rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface-raised);
  color: var(--color-text-muted);
  font-size: 0.7rem;
  font-weight: 720;
}

.theme-options input:checked + span {
  border-color: var(--color-accent);
  background: var(--color-accent-soft);
  color: var(--color-accent-strong);
}

.theme-options input:focus-visible + span {
  box-shadow: var(--focus-ring);
}

.storage-stats {
  display: grid;
  gap: 0.1rem;
  margin: 0 0 0.85rem;
}

.storage-stats > div {
  min-height: 2.8rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid var(--color-border);
}

.storage-stats dt {
  color: var(--color-text-muted);
  font-size: 0.76rem;
}

.storage-stats dd {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  font-weight: 760;
}

.storage-note {
  margin: 0.65rem 0 0;
  color: var(--color-text-subtle);
  font-size: 0.66rem;
  line-height: 1.45;
}

.about-card__title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.about-card {
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(circle at 100% 0, var(--color-brand-glow), transparent 35%),
    var(--color-surface);
}

.about-list {
  display: grid;
  gap: 0.55rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.about-list li {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  color: var(--color-text-muted);
  font-size: 0.76rem;
}

.about-list svg {
  color: var(--color-accent-strong);
}

.about-actions {
  display: grid;
  justify-items: start;
  gap: 0.75rem;
  margin-top: 1rem;
}

.link-button {
  min-height: var(--touch-target);
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  padding: 0.55rem 0.8rem;
  background: var(--color-surface-raised);
  color: var(--color-text);
  font-size: 0.78rem;
  font-weight: 740;
  text-decoration: none;
}

.text-link {
  min-height: var(--touch-target);
  display: inline-flex;
  align-items: center;
  color: var(--color-accent-strong);
  font-size: 0.74rem;
}

.disclaimer {
  margin: 1rem 0 0;
  border-top: 1px solid var(--color-border);
  padding-top: 0.8rem;
  color: var(--color-text-subtle);
  font-size: 0.64rem;
  line-height: 1.5;
}
</style>
