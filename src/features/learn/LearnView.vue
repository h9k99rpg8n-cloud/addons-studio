<script setup lang="ts">
import AppBadge from '@/components/common/AppBadge.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import AppHeader from '@/components/navigation/AppHeader.vue'
</script>

<template>
  <main class="learn-view page-shell">
    <AppHeader title="Learn" subtitle="Guides for Bedrock creators" />
    <section class="learn-coming-soon">
      <span><AppIcon name="book-open" :size="34" /></span>
      <AppBadge tone="accent">Coming soon</AppBadge>
      <h2>Mobile-friendly creator guides</h2>
      <p>
        Learn is reserved for guided Bedrock lessons. No fake tutorials or unfinished editors are included in 0.0.1.
      </p>
      <ul>
        <li><AppIcon name="blocks" :size="18" />Contextual object workflows</li>
        <li><AppIcon name="circle-dot" :size="18" />Material → Texture → UV → Rendering</li>
        <li><AppIcon name="shield" :size="18" />Validation and safe export practices</li>
      </ul>
    </section>
  </main>
</template>

<style scoped>
.learn-coming-soon {
  min-height: 65dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.learn-coming-soon > span:first-child {
  width: 4.75rem;
  height: 4.75rem;
  display: grid;
  place-items: center;
  margin-bottom: 0.85rem;
  border-radius: var(--radius-xl);
  background: var(--color-accent-soft);
  color: var(--color-accent-strong);
}

.learn-coming-soon h2 {
  margin: 0.9rem 0 0;
  font-size: 1.3rem;
}

.learn-coming-soon > p {
  max-width: 27rem;
  margin: 0.45rem 0 1.2rem;
  color: var(--color-text-muted);
  font-size: 0.82rem;
  line-height: 1.55;
}

.learn-coming-soon ul {
  width: min(100%, 26rem);
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
  text-align: left;
}

.learn-coming-soon li {
  min-height: var(--touch-target);
  display: flex;
  align-items: center;
  gap: 0.65rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 0.6rem 0.75rem;
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: 0.73rem;
}

.learn-coming-soon li svg {
  color: var(--color-accent-strong);
}
</style>
