<template>
  <div class="row q-col-gutter-sm">
    <div v-for="card in cards" :key="card.key" class="col-6 col-md-3">
      <q-card flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey-7">{{ card.label }}</div>
          <div class="text-h6 text-weight-bold">{{ card.value }}</div>
        </q-card-section>
      </q-card>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({ summary: { type: Object, default: () => ({}) } })
const cards = computed(() => [
  { key: 'expected', label: 'Expected', value: props.summary.expected || 0 },
  { key: 'received', label: 'Received', value: props.summary.received || 0 },
  { key: 'accepted', label: 'Accepted', value: props.summary.accepted || 0 },
  { key: 'exceptions', label: 'Exceptions', value: (props.summary.damaged || 0) + (props.summary.rejected || 0) + (props.summary.short || 0) + (props.summary.excess || 0) }
])
</script>
