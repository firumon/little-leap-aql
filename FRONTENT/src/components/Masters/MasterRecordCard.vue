<template>
  <q-card flat class="record-card" @click="$emit('open-detail', row)">
    <q-card-section class="q-pa-sm">
      <div class="row items-center justify-between q-col-gutter-sm">
        <div class="col">
          <div class="record-code">{{ row.Code }}</div>
          <div class="record-name">{{ resolvePrimaryText(row) }}</div>
          <div class="record-secondary">{{ resolveSecondaryText(row) }}</div>
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
defineProps({
  row: {
    type: Object,
    required: true
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
.record-card {
  cursor: pointer;
  border-radius: 14px;
  border: 1px solid #d9e4f0;
  background: linear-gradient(175deg, #ffffff 0%, #f8fafc 100%);
  box-shadow: 0 6px 16px rgba(23, 37, 61, 0.08);
  transition: transform 0.14s ease, box-shadow 0.14s ease;
}

.record-card:active {
  transform: scale(0.995);
}

.record-card:hover {
  box-shadow: 0 10px 24px rgba(23, 37, 61, 0.12);
}

.record-code {
  font-size: 12px;
  color: var(--master-soft-ink);
  letter-spacing: 0.03em;
}

.record-name {
  margin-top: 2px;
  font-size: 16px;
  font-weight: 700;
  color: var(--master-ink);
}

.record-secondary {
  margin-top: 3px;
  font-size: 12px;
  color: #64748b;
}
</style>
