<script setup lang="ts">
import { useRouter } from 'vue-router'

import AppButton from '@/components/common/AppButton.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import BrandMark from '@/components/common/BrandMark.vue'
import StudioIcon from '@/components/common/StudioIcon.vue'
import { APP_RELEASE_LABEL } from '@/core/app/release'
import { completeWelcome } from '@/core/storage/preferences'
import { useLocaleStore } from '@/stores/locale'

const router = useRouter()
const locale = useLocaleStore()

function continueTo(routeName: 'create-project' | 'projects'): void {
  completeWelcome()
  void router.push({ name: routeName })
}
</script>

<template>
  <main class="welcome-view">
    <section class="welcome-view__hero">
      <div class="welcome-view__mark"><BrandMark :size="78" /></div>
      <p class="eyebrow">{{ locale.t('The professional Bedrock workspace') }}</p>
      <h1>Addons Studio</h1>
      <span class="welcome-view__release">{{ APP_RELEASE_LABEL }}</span>
      <p class="welcome-view__subtitle">{{ locale.t('Build addons. Keep your workflow.') }}</p>
      <p class="welcome-view__description">
        {{ locale.t('Organize resources, generate Bedrock files, and connect the right creative tools from any device.') }}
      </p>

      <div class="welcome-view__actions">
        <AppButton size="large" block @click="continueTo('create-project')">
          <template #icon><AppIcon name="plus" :size="21" /></template>
          {{ locale.t('Create Project') }}
        </AppButton>
        <AppButton variant="secondary" size="large" block @click="continueTo('projects')">
          <template #icon><StudioIcon name="project" :size="22" /></template>
          {{ locale.t('Open Projects') }}
        </AppButton>
      </div>

      <ul class="welcome-view__proof" aria-label="Product principles">
        <li><AppIcon name="check" :size="15" />{{ locale.t('Free') }}</li>
        <li><AppIcon name="github" :size="15" />{{ locale.t('Open Source') }}</li>
        <li><AppIcon name="monitor" :size="15" />{{ locale.t('Mobile First') }}</li>
      </ul>
    </section>
  </main>
</template>

<style scoped>
.welcome-view {
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: calc(1.5rem + env(safe-area-inset-top))
    max(var(--page-gutter), env(safe-area-inset-right))
    calc(1.5rem + env(safe-area-inset-bottom))
    max(var(--page-gutter), env(safe-area-inset-left));
  overflow: hidden;
}

.welcome-view::before {
  position: fixed;
  inset: -15% -30% auto;
  height: 48%;
  background: radial-gradient(circle, var(--color-accent-glow), transparent 66%);
  content: '';
  pointer-events: none;
}

.welcome-view__hero {
  position: relative;
  width: min(100%, 31rem);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.welcome-view__mark {
  width: 6rem;
  height: 6rem;
  display: grid;
  place-items: center;
  margin-bottom: 1.35rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-2xl);
  background: var(--color-surface);
  box-shadow: var(--shadow-float);
}

.welcome-view__release {
  margin-top: 0.65rem;
  border: 1px solid var(--color-accent-border);
  border-radius: var(--radius-pill);
  padding: 0.24rem 0.55rem;
  background: var(--color-accent-soft);
  color: var(--color-accent-strong);
  font-size: 0.64rem;
  font-weight: 790;
  letter-spacing: 0.04em;
}

.welcome-view h1 {
  margin: 0.35rem 0 0;
  font-size: clamp(2.1rem, 12vw, 3.5rem);
  letter-spacing: -0.055em;
  line-height: 1;
}

.welcome-view__subtitle {
  margin: 0.75rem 0 0;
  color: var(--color-accent-strong);
  font-size: 1.08rem;
  font-weight: 760;
}

.welcome-view__description {
  max-width: 25rem;
  margin: 0.65rem 0 0;
  color: var(--color-text-muted);
  font-size: 0.95rem;
  line-height: 1.55;
}

.welcome-view__actions {
  width: 100%;
  display: grid;
  gap: 0.75rem;
  margin-top: clamp(2rem, 8vh, 3.5rem);
}

.welcome-view__proof {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
  margin: 1.35rem 0 0;
  padding: 0;
  list-style: none;
}

.welcome-view__proof li {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  padding: 0.4rem 0.6rem;
  color: var(--color-text-subtle);
  font-size: 0.7rem;
  font-weight: 730;
}

@media (orientation: landscape) and (max-height: 540px) {
  .welcome-view__hero {
    display: grid;
    grid-template-columns: 7rem minmax(0, 1fr);
    column-gap: 1.25rem;
    text-align: left;
  }

  .welcome-view__mark {
    grid-row: 1 / 6;
    margin: 0;
  }

  .welcome-view__actions,
  .welcome-view__proof {
    grid-column: 1 / -1;
  }

  .welcome-view__actions {
    grid-template-columns: 1fr 1fr;
    margin-top: 1.25rem;
  }

  .welcome-view__proof {
    margin-top: 0.8rem;
  }
}
</style>
