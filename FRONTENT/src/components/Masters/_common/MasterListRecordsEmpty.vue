<template>
  <q-card flat bordered class="page-card q-mt-sm">
    <q-card-section class="text-center q-py-xl">
      <q-icon name="search_off" size="48px" color="grey-5" />
      <div class="text-subtitle1 text-grey-7 q-mt-md">No records found</div>
    </q-card-section>
  </q-card>
</template>

<script setup>
// Stateless component, no props or logic needed
</script>

<style scoped>
.page-card {
  border-radius: 16px;
  border-color: var(--master-border, #e2e8f0);
  background: rgba(255, 255, 255, 0.95);
}
</style>
