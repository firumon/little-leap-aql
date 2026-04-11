<template>
  <q-card flat bordered class="page-card">
    <q-card-section>
      <div class="page-title">
        <q-icon name="edit" size="24px" color="primary" class="q-mr-sm" />
        Edit {{ config?.ui?.menus?.[0]?.pageTitle || config?.name }} — {{ code }}
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
defineProps({
  config: { type: Object, default: null },
  code: { type: String, default: '' }
})
</script>

<style scoped>
.page-card {
  border-radius: 16px;
  border-color: var(--master-border);
  background: rgba(255, 255, 255, 0.95);
  animation: rise-in 280ms ease-out both;
}
.page-title { font-size: 18px; font-weight: 700; color: var(--master-ink); display: flex; align-items: center; }
@keyframes rise-in {
  0% { transform: translateY(10px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
</style>
