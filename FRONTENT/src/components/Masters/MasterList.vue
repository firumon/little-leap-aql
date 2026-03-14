<template>
  <q-card flat bordered class="records-card q-mt-sm">
    <q-card-section class="q-pa-sm q-pa-md">
      <div v-if="loading" class="q-py-lg text-center text-grey-7">
        <q-spinner-dots color="primary" size="32px" />
      </div>
      <div v-else-if="!items.length" class="empty-state">
        <q-icon name="inventory_2" size="30px" />
        <div>No records found</div>
      </div>
      <div v-else class="card-list q-gutter-sm">
        <MasterRecordCard
          v-for="row in items"
          :key="row.Code"
          :row="row"
          :resolve-primary-text="resolvePrimaryText"
          :resolve-secondary-text="resolveSecondaryText"
          @open-detail="$emit('open-detail', $event)"
        />
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import MasterRecordCard from './MasterRecordCard.vue'

defineProps({
  loading: {
    type: Boolean,
    default: false
  },
  items: {
    type: Array,
    default: () => []
  },
  resolvePrimaryText: {
    type: Function,
    required: true
  },
  resolveSecondaryText: {
    type: Function,
    required: true
  }
})

defineEmits(['open-detail'])
</script>

<style scoped>
.records-card {
  border-radius: 16px;
  border-color: var(--master-border);
  background: rgba(255, 255, 255, 0.92);
  animation: rise-in 280ms ease-out both;
}

.empty-state {
  text-align: center;
  color: #667085;
  display: grid;
  gap: 8px;
  justify-items: center;
  padding: 20px 10px;
}

.card-list {
  display: grid;
  grid-template-columns: 1fr;
}

@media (min-width: 600px) {
  .card-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@keyframes rise-in {
  0% {
    transform: translateY(10px);
    opacity: 0;
  }
  100% {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>
