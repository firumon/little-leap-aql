<template>
  <q-card flat bordered class="empty-card q-mt-sm">
    <q-card-section class="text-center q-py-xl">
      <q-icon name="search_off" size="48px" color="grey-5" />
      <div class="text-subtitle1 text-grey-7 q-mt-md">No records found</div>
    </q-card-section>
  </q-card>
</template>

<script setup>
// Stateless list empty component
</script>

<style scoped>
.empty-card {
  border-radius: 16px;
  border-color: var(--aql-border);
  background: rgba(255, 255, 255, 0.95);
  animation: rise-in 280ms ease-out both;
}

@keyframes rise-in {
  0% { transform: translateY(10px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
</style>
