<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: number
    decorative?: boolean
  }>(),
  {
    size: 40,
    decorative: true,
  },
)
</script>

<template>
  <svg
    class="brand-mark"
    :width="size"
    :height="size"
    viewBox="0 0 48 48"
    :aria-hidden="decorative"
    :aria-label="decorative ? undefined : 'Addons Studio'"
    role="img"
  >
    <path class="brand-mark__body" d="m24 4 17 9.8v20.4L24 44 7 34.2V13.8L24 4Z" />
    <path class="brand-mark__lines" d="m7 14 17 10 17-10M24 24v20" />
    <rect class="brand-mark__core" x="19" y="19" width="10" height="10" rx="2.5" />
  </svg>
</template>

<style scoped>
.brand-mark {
  flex: none;
  overflow: visible;
}

.brand-mark__body {
  fill: var(--color-accent-soft);
  stroke: var(--color-accent);
  stroke-width: 3.5;
  stroke-linejoin: round;
}

.brand-mark__lines {
  fill: none;
  stroke: var(--color-accent);
  stroke-width: 3.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.brand-mark__core {
  fill: var(--color-surface-strong);
  stroke: var(--color-text);
  stroke-width: 2.5;
}
</style>
