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
    <rect class="brand-mark__tile" x="1" y="1" width="46" height="46" rx="11" />
    <path class="brand-mark__tool" d="M12 9.5 38.5 36M36.5 8.5l-5 1.4-1.7 5.2 4 4 5.2-1.7 1.4-5-3.9-3.9Z" />
    <path class="brand-mark__tool" d="m36.5 10-26 26M8.5 31.5l8 8M32.2 7.8l8 8" />
    <path class="brand-mark__top" d="m24 16.2 10.2 5.7L24 27.7l-10.2-5.8Z" />
    <path class="brand-mark__left" d="m13.8 21.9 10.2 5.8v11.4l-10.2-5.7Z" />
    <path class="brand-mark__right" d="m34.2 21.9-10.2 5.8v11.4l10.2-5.7Z" />
  </svg>
</template>

<style scoped>
.brand-mark {
  flex: none;
  overflow: visible;
}

.brand-mark__tile { fill: #f5c518; }

.brand-mark__tool {
  fill: none;
  stroke: #111318;
  stroke-width: 4.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.brand-mark__top { fill: #fff3bd; }

.brand-mark__left {
  fill: #f0bd0e;
}

.brand-mark__right {
  fill: #cf9800;
}

.brand-mark__top,
.brand-mark__left,
.brand-mark__right {
  stroke: #111318;
  stroke-width: 2.2;
  stroke-linejoin: round;
}
</style>
