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
    <path class="brand-mark__top" d="M24 3.5 42 13.6 24 23.8 6 13.6Z" />
    <path class="brand-mark__left" d="M6 13.6 24 23.8v20.7L6 34.3Z" />
    <path class="brand-mark__right" d="m42 13.6-18 10.2v20.7l18-10.2Z" />
    <path class="brand-mark__outline" d="M24 3.5 42 13.6v20.7L24 44.5 6 34.3V13.6ZM6 13.6l18 10.2 18-10.2M24 23.8v20.7" />
    <path class="brand-mark__core" d="m24 15.7 6.8 3.8v7.7L24 31l-6.8-3.8v-7.7Z" />
    <path class="brand-mark__core-line" d="m17.2 19.5 6.8 3.8 6.8-3.8M24 23.3V31" />
  </svg>
</template>

<style scoped>
.brand-mark {
  flex: none;
  overflow: visible;
}

.brand-mark__top {
  fill: var(--brand-mark-top, var(--color-brand-primary-soft));
}

.brand-mark__left {
  fill: var(--brand-mark-left, var(--color-brand-primary));
  opacity: 0.94;
}

.brand-mark__right {
  fill: var(--brand-mark-right, var(--color-brand-primary-deep));
  opacity: 0.96;
}

.brand-mark__outline {
  fill: none;
  stroke: var(--brand-mark-outline, var(--color-brand-primary-strong));
  stroke-width: 2.25;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.brand-mark__core {
  fill: var(--brand-mark-core, var(--color-brand-secondary));
  stroke: var(--brand-mark-core-outline, var(--color-brand-secondary-strong));
  stroke-width: 1.9;
  stroke-linejoin: round;
}

.brand-mark__core-line {
  fill: none;
  stroke: var(--brand-mark-core-outline, var(--color-brand-secondary-strong));
  stroke-width: 1.55;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
