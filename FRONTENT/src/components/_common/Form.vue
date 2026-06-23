<template>
  <q-card flat bordered class="form-card q-mt-sm">
    <q-card-section :class="isActionForm ? 'q-gutter-y-md' : 'q-gutter-y-sm'">
      
      <!-- 1. ACTION FORM LAYOUT -->
      <template v-if="isActionForm">
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
      </template>

      <!-- 2. RECORD FORM LAYOUT (ADD/EDIT) -->
      <template v-else>
        <q-input v-if="code" :model-value="code" label="Code" dense outlined disable />
        <template v-for="field in resolvedFields" :key="field.header">
          <q-select
            v-if="field.type === 'status'"
            :model-value="parentForm[field.header]"
            :options="statusOptions"
            :label="field.label"
            dense outlined emit-value map-options
            @update:model-value="$emit('update:field', field.header, $event)"
          />
          <AqlFileUpload
            v-else-if="field.type === 'file'"
            :model-value="parentForm[field.header]"
            :label="field.label"
            :required="field.required"
            :accept="field.accept || '*'"
            :max-size="field.maxSize || 10"
            :resource-name="resourceName"
            :column-name="field.header"
            @update:model-value="$emit('update:field', field.header, $event)"
          />
          <q-input
            v-else
            :model-value="parentForm[field.header]"
            :label="field.label + (field.required ? ' *' : '')"
            :hint="field.hint"
            dense outlined
            @update:model-value="$emit('update:field', field.header, $event)"
          />
        </template>
      </template>

    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed } from 'vue'
import AqlFileUpload from 'components/shared/AqlFileUpload.vue'

const props = defineProps({
  // Action Form props
  isMultiOutcome: { type: Boolean, default: false },
  outcomeOptions: { type: Array, default: () => [] },
  selectedOutcome: { type: String, default: '' },
  resolvedActionFields: { type: Array, default: () => [] },
  actionForm: { type: Object, default: () => ({}) },

  // Record Form props
  code: { type: String, default: '' },
  resolvedFields: { type: Array, default: () => [] },
  parentForm: { type: Object, default: () => ({}) },
  statusOptions: { type: Array, default: () => [] },
  resourceName: { type: String, default: '' }
})

defineEmits(['update:selectedOutcome', 'update:actionField', 'update:field'])

const isActionForm = computed(() => props.isMultiOutcome || (props.resolvedActionFields && props.resolvedActionFields.length > 0))

const outcomeSelectOptions = computed(() => {
  return props.outcomeOptions.map((opt) => ({
    label: opt.replace(/([a-z])([A-Z])/g, '$1 $2'),
    value: opt
  }))
})
</script>

<style scoped>
.form-card {
  border-radius: 16px;
  border-color: var(--aql-border);
  background: rgba(255, 255, 255, 0.95);
  animation: rise-in 280ms ease-out both;
}
.field-label { font-size: 13px; font-weight: 600; color: #475569; }
@keyframes rise-in {
  0% { transform: translateY(10px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
</style>
