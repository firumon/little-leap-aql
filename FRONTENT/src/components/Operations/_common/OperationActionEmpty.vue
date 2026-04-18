<template>
  <q-card flat bordered class="page-card">
    <q-card-section class="text-center q-py-xl">
      <q-icon :name="icon" size="48px" color="grey-5" />
      <div class="text-subtitle1 text-grey-7 q-mt-md">{{ message }}</div>
      <q-btn flat color="primary" :label="backLabel" icon="arrow_back" class="q-mt-md" @click="$emit('back')" />
    </q-card-section>
  </q-card>
</template>

<script setup>
defineProps({
  icon: { type: String, default: 'search_off' },
  message: { type: String, default: 'Record not found' },
  backLabel: { type: String, default: 'Back' }
})
defineEmits(['back'])
</script>

<style scoped>
.page-card {
  border-radius: 16px;
  border-color: var(--operation-border, #e2e8f0);
  background: rgba(255, 255, 255, 0.95);
  animation: rise-in 280ms ease-out both;
}
@keyframes rise-in {
  0% { transform: translateY(10px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
</style>
