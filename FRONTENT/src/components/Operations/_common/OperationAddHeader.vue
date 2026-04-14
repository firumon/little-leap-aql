<template>
  <q-card flat bordered class="page-card">
    <q-card-section>
      <div class="page-title">
        <q-icon name="add_circle_outline" size="24px" color="primary" class="q-mr-sm" />
        Create {{ config?.ui?.menus?.[0]?.pageTitle || config?.name || 'Record' }}
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
defineProps({
  config: { type: Object, default: null }
})
</script>

<style scoped>
.page-card {
  border-radius: 16px;
  border-color: var(--operation-border, #e2e8f0);
  background: rgba(255, 255, 255, 0.95);
  animation: rise-in 280ms ease-out both;
}
.page-title { font-size: 18px; font-weight: 700; color: var(--operation-ink, #0f172a); display: flex; align-items: center; }
@keyframes rise-in {
  0% { transform: translateY(10px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
</style>
