<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import AppBadge from '@/components/common/AppBadge.vue'
import AppButton from '@/components/common/AppButton.vue'
import AppDialog from '@/components/common/AppDialog.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import IconButton from '@/components/common/IconButton.vue'
import AppHeader from '@/components/navigation/AppHeader.vue'
import {
  createLocalTimer,
  createRoutineActivity,
  loadProductivityState,
  localDateKey,
  saveProductivityState,
  usageSummary,
  type ProductivityBetaState,
} from '@/core/productivity/productivityBeta'
import { useLocaleStore } from '@/stores/locale'
import { useToastStore } from '@/stores/toasts'

const router = useRouter()
const locale = useLocaleStore()
const toasts = useToastStore()
const state = ref<ProductivityBetaState>()
const timerMinutes = ref(20)
const timerLabel = ref(locale.t('Modeling break'))
const activityName = ref('')
const resetUsageOpen = ref(false)
const renameActivityOpen = ref(false)
const renameActivityId = ref('')
const renameActivityValue = ref('')
const summary = computed(() => state.value ? usageSummary(state.value) : { todayMs: 0, weekMs: 0 })

function durationLabel(milliseconds: number): string {
  const minutes = Math.round(milliseconds / 60_000)
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return hours ? `${hours}h ${rest}m` : `${rest}m`
}

async function persist(): Promise<void> {
  if (state.value) await saveProductivityState(state.value)
}

async function addTimer(): Promise<void> {
  if (!state.value) return
  try {
    state.value.timers.push(createLocalTimer(timerLabel.value, timerMinutes.value * 60_000))
    await persist()
    toasts.push({ type: 'success', message: locale.t('Local timer started') })
  } catch (error) {
    toasts.push({ type: 'warning', message: error instanceof Error ? error.message : locale.t('Timer could not be created.') })
  }
}

async function addActivity(): Promise<void> {
  if (!state.value) return
  try {
    state.value.routine.push(createRoutineActivity(activityName.value))
    activityName.value = ''
    await persist()
  } catch (error) {
    toasts.push({ type: 'warning', message: error instanceof Error ? error.message : locale.t('Activity could not be created.') })
  }
}

async function toggleActivity(id: string): Promise<void> {
  if (!state.value) return
  const activity = state.value.routine.find((entry) => entry.id === id)
  if (!activity) return
  activity.completedDate = activity.completedDate === localDateKey() ? undefined : localDateKey()
  await persist()
}

async function removeActivity(id: string): Promise<void> {
  if (!state.value) return
  state.value.routine = state.value.routine.filter((entry) => entry.id !== id)
  await persist()
}

function beginRenameActivity(id: string): void {
  const activity = state.value?.routine.find((entry) => entry.id === id)
  if (!activity) return
  renameActivityId.value = id
  renameActivityValue.value = activity.name
  renameActivityOpen.value = true
}

async function renameActivity(): Promise<void> {
  const activity = state.value?.routine.find((entry) => entry.id === renameActivityId.value)
  const name = renameActivityValue.value.trim()
  if (!activity || !name) return
  activity.name = name.slice(0, 100)
  await persist()
  renameActivityOpen.value = false
}

async function requestNotifications(): Promise<void> {
  const NotificationApi = globalThis.Notification
  if (!NotificationApi) {
    toasts.push({ type: 'info', message: locale.t('Browser notifications are unavailable. In-app reminders will still work.') })
    return
  }
  const permission = await NotificationApi.requestPermission()
  toasts.push({ type: 'info', message: locale.t(permission === 'granted' ? 'Browser reminders enabled' : 'In-app reminders will be used') })
}

async function resetUsage(): Promise<void> {
  if (!state.value) return
  state.value.usageSessions = []
  await persist()
  resetUsageOpen.value = false
}

onMounted(async () => { state.value = await loadProductivityState() })
</script>

<template>
  <main class="page-shell beta-view">
    <AppHeader :title="locale.t('Developer Beta')" :subtitle="locale.t('Local-only experimental tools')">
      <template #leading><IconButton icon="arrow-left" :label="locale.t('Back')" @click="router.back()" /></template>
    </AppHeader>
    <section v-if="state" class="beta-intro">
      <div><AppIcon name="terminal" :size="25" /><span><strong>{{ locale.t('Developer Beta') }}</strong><small>{{ locale.t('Features may change or be removed.') }}</small></span></div>
      <label class="switch-row"><input v-model="state.enabled" type="checkbox" @change="persist" /><span>{{ locale.t(state.enabled ? 'Enabled' : 'Disabled') }}</span></label>
    </section>

    <template v-if="state?.enabled">
      <section class="beta-card">
        <header><div><h2>{{ locale.t('Local Timer') }}</h2><p>{{ locale.t('Local reminder; notification permission is optional.') }}</p></div><AppBadge tone="warning">Beta</AppBadge></header>
        <label>{{ locale.t('Label') }}<input v-model="timerLabel" class="text-input" maxlength="80" /></label>
        <div class="preset-row">
          <button v-for="minutes in [5, 20, 60]" :key="minutes" type="button" :class="{ active: timerMinutes === minutes }" @click="timerMinutes = minutes">{{ minutes === 60 ? locale.t('1 hour') : `${minutes} min` }}</button>
        </div>
        <label>{{ locale.t('Custom minutes') }}<input v-model.number="timerMinutes" class="text-input" type="number" min="1" max="10080" inputmode="decimal" /></label>
        <div class="button-row"><AppButton @click="addTimer">{{ locale.t('Start Timer') }}</AppButton><AppButton variant="secondary" @click="requestNotifications">{{ locale.t('Browser notifications') }}</AppButton></div>
        <ul v-if="state.timers.length" class="simple-list"><li v-for="timer in state.timers.slice().reverse().slice(0, 5)" :key="timer.id"><span><strong>{{ timer.label }}</strong><small>{{ timer.completedAt ? locale.t('Complete') : new Date(timer.endsAt).toLocaleTimeString() }}</small></span><AppIcon :name="timer.completedAt ? 'check-circle' : 'activity'" :size="20" /></li></ul>
      </section>

      <section class="beta-card">
        <header><div><h2>{{ locale.t('Daily Routine') }}</h2><p>{{ locale.t('A lightweight local checklist.') }}</p></div><AppBadge tone="warning">Beta</AppBadge></header>
        <div class="inline-input"><input v-model="activityName" class="text-input" maxlength="100" :placeholder="locale.t('Add activity')" @keydown.enter.prevent="addActivity" /><AppButton @click="addActivity">{{ locale.t('Create') }}</AppButton></div>
        <ul class="routine-list"><li v-for="activity in state.routine" :key="activity.id"><button type="button" :aria-pressed="activity.completedDate === localDateKey()" @click="toggleActivity(activity.id)"><span class="check-box"><AppIcon v-if="activity.completedDate === localDateKey()" name="check" :size="16" /></span>{{ activity.name }}</button><span class="routine-actions"><IconButton icon="pencil" :label="locale.t('Rename')" @click="beginRenameActivity(activity.id)" /><IconButton icon="trash" :label="locale.t('Delete')" variant="danger" @click="removeActivity(activity.id)" /></span></li></ul>
      </section>

      <section class="beta-card">
        <header><div><h2>{{ locale.t('Usage Time') }}</h2><p>{{ locale.t('Opt-in, local only, and paused while the app is inactive.') }}</p></div><AppBadge tone="warning">Beta</AppBadge></header>
        <label class="switch-row"><input v-model="state.usageEnabled" type="checkbox" @change="persist" /><span>{{ locale.t('Enable local usage analytics') }}</span></label>
        <dl><div><dt>{{ locale.t('Today') }}</dt><dd>{{ durationLabel(summary.todayMs) }}</dd></div><div><dt>{{ locale.t('This week') }}</dt><dd>{{ durationLabel(summary.weekMs) }}</dd></div></dl>
        <AppButton variant="secondary" @click="resetUsageOpen = true">{{ locale.t('Reset usage data') }}</AppButton>
      </section>
    </template>

    <AppDialog :open="resetUsageOpen" :title="locale.t('Reset usage data?')" :description="locale.t('This removes only local beta usage sessions.')" @close="resetUsageOpen = false">
      <template #actions><AppButton variant="ghost" @click="resetUsageOpen = false">{{ locale.t('Cancel') }}</AppButton><AppButton variant="danger" @click="resetUsage">{{ locale.t('Reset') }}</AppButton></template>
    </AppDialog>
    <AppDialog :open="renameActivityOpen" :title="locale.t('Rename activity')" @close="renameActivityOpen = false">
      <input v-model="renameActivityValue" class="text-input" maxlength="100" autocomplete="off" @keydown.enter.prevent="renameActivity" />
      <template #actions><AppButton variant="ghost" @click="renameActivityOpen = false">{{ locale.t('Cancel') }}</AppButton><AppButton :disabled="!renameActivityValue.trim()" @click="renameActivity">{{ locale.t('Rename') }}</AppButton></template>
    </AppDialog>
  </main>
</template>

<style scoped>
.beta-view { display: grid; gap: var(--space-3); }
.beta-intro, .beta-card { border: 1px solid var(--color-border); border-radius: var(--radius-xl); padding: var(--card-padding); background: var(--color-surface); box-shadow: var(--shadow-card); }
.beta-intro, .beta-intro > div, .switch-row, .beta-card > header, .button-row, .inline-input { display: flex; align-items: center; gap: var(--space-3); }
.beta-intro { justify-content: space-between; }
.beta-intro > div > span { display: grid; gap: 0.12rem; }
.beta-intro small, .beta-card p, label, .simple-list small { color: var(--color-text-subtle); font-size: 0.72rem; }
.switch-row { min-height: var(--touch-target); }
.switch-row input { width: 1.35rem; height: 1.35rem; accent-color: var(--color-accent); }
.beta-card { display: grid; gap: var(--space-3); }
.beta-card > header { justify-content: space-between; }
.beta-card h2, .beta-card p { margin: 0; }
.beta-card h2 { font-size: 1rem; }
.beta-card p { margin-top: 0.18rem; }
.beta-card label { display: grid; gap: 0.35rem; font-weight: 750; }
.preset-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.45rem; }
.preset-row button { min-height: var(--touch-target); border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-input-bg); color: var(--color-text); }
.preset-row button.active { border-color: var(--color-accent); background: var(--color-accent-soft); }
.button-row { flex-wrap: wrap; }
.inline-input { align-items: stretch; }
.inline-input input { min-width: 0; flex: 1; }
.simple-list, .routine-list { display: grid; gap: 0.4rem; margin: 0; padding: 0; list-style: none; }
.simple-list li, .routine-list li { min-height: var(--touch-target); display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 0.4rem 0.55rem; }
.simple-list span { display: grid; gap: 0.1rem; }
.routine-list li > button:first-child { min-width: 0; flex: 1; min-height: var(--touch-target); display: flex; align-items: center; gap: 0.55rem; border: 0; background: transparent; color: var(--color-text); text-align: left; }
.routine-actions { display: flex; flex: 0 0 auto; }
.check-box { width: 1.3rem; height: 1.3rem; display: grid; place-items: center; border: 1px solid var(--color-border-strong); border-radius: 0.3rem; }
dl { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem; margin: 0; }
dl div { border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 0.75rem; }
dt { color: var(--color-text-subtle); font-size: 0.68rem; } dd { margin: 0.2rem 0 0; font-size: 1.05rem; font-weight: 800; }
@media (max-width: 360px) { .button-row, .beta-intro { align-items: stretch; flex-direction: column; } }
</style>
