<template>
  <q-card flat bordered class="page-card q-mt-sm">
    <q-card-section class="q-gutter-y-md">
      <!-- Multi-outcome selector -->
      <div v-if="isMultiOutcome">
        <div class="field-label q-mb-sm">Select Outcome</div>
        <q-option-group
          v-if="outcomeSelectOptions.length <= 4"
          :model-value="selectedOutcome"
          :options="outcomeSelectOptions"
          type="radio"
          color="primary"
          @update:model-value="$emit('update:selectedOutcome', $event)"
        />
        <q-select
          v-else
          :model-value="selectedOutcome"
          :options="outcomeSelectOptions"
          label="Outcome"
          dense outlined emit-value map-options
          @update:model-value="$emit('update:selectedOutcome', $event)"
        />
      </div>

      <!-- Dynamic fields -->
      <template v-for="field in resolvedActionFields" :key="field.header">
        <q-input
          v-if="field.type === 'textarea'"
          :model-value="actionForm[field.header]"
          :label="field.label + (field.required ? ' *' : '')"
          dense outlined type="textarea" autogrow
          @update:model-value="$emit('update:actionField', field.header, $event)"
        />
        <q-input
          v-else-if="field.type === 'date'"
          :model-value="actionForm[field.header]"
          :label="field.label + (field.required ? ' *' : '')"
          dense outlined type="date"
          @update:model-value="$emit('update:actionField', field.header, $event)"
        />
        <q-input
          v-else-if="field.type === 'number'"
          :model-value="actionForm[field.header]"
          :label="field.label + (field.required ? ' *' : '')"
          dense outlined type="number"
          @update:model-value="$emit('update:actionField', field.header, $event)"
        />
        <q-input
          v-else
          :model-value="actionForm[field.header]"
          :label="field.label + (field.required ? ' *' : '')"
          dense outlined
          @update:model-value="$emit('update:actionField', field.header, $event)"
        />
      </template>

      <!-- No fields message -->
      <div v-if="!resolvedActionFields.length && selectedOutcome" class="text-grey-6 q-py-sm">
        No additional input required. Click submit to proceed.
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  isMultiOutcome: { type: Boolean, default: false },
  outcomeOptions: { type: Array, default: () => [] },
  selectedOutcome: { type: String, default: '' },
  resolvedActionFields: { type: Array, default: () => [] },
  actionForm: { type: Object, default: () => ({}) }
})

defineEmits(['update:selectedOutcome', 'update:actionField'])

const outcomeSelectOptions = computed(() => {
  return props.outcomeOptions.map((opt) => ({
    label: opt.replace(/([a-z])([A-Z])/g, '$1 $2'),
    value: opt
  }))
})
</script>

<style scoped>
.page-card {
  border-radius: 16px;
  border-color: var(--operation-border, #e2e8f0);
  background: rgba(255, 255, 255, 0.95);
  animation: rise-in 280ms ease-out both;
}
.field-label { font-size: 13px; font-weight: 600; color: #475569; }
@keyframes rise-in {
  0% { transform: translateY(10px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
</style>
