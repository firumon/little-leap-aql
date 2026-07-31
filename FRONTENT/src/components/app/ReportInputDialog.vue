<template>
  <AqlDialog
    :model-value="modelValue"
    :title="reportTitle"
    subtitle="Report parameters"
    icon="description"
    variant="primary"
    message="Fill in the required fields below, then click Generate."
    message-icon="edit_note"
    confirm-label="Generate"
    confirm-icon="picture_as_pdf"
    :loading="isGenerating"
    @update:model-value="$emit('update:modelValue', $event)"
    @confirm="$emit('confirm')"
    @cancel="$emit('cancel')"
  >
    <template v-for="input in formFields" :key="input.label">
    <!-- Select dropdown -->
    <q-select
      v-if="input.type === 'select'"
      :model-value="formValues[input.label] || input.default || ''"
      :label="input.label"
      :options="getSelectOptions(input)"
      outlined
      emit-value
      map-options
      class="aql-dialog-field"
      @update:model-value="updateField(input.label, $event)"
    />

    <!-- Text input -->
    <q-input
      v-else-if="input.type === 'text'"
      :model-value="formValues[input.label] || ''"
      :label="input.label"
      outlined
      class="aql-dialog-field"
      @update:model-value="updateField(input.label, $event)"
    />

    <!-- Number input -->
    <q-input
      v-else-if="input.type === 'number'"
      :model-value="formValues[input.label] || ''"
      :label="input.label"
      type="number"
      outlined
      class="aql-dialog-field"
      @update:model-value="updateField(input.label, $event)"
    />

    <!-- Date input -->
    <q-input
      v-else-if="input.type === 'date'"
      :model-value="formValues[input.label] || ''"
      :label="input.label"
      outlined
      class="aql-dialog-field"
      @update:model-value="updateField(input.label, $event)"
    >
      <template #append>
        <q-icon name="event" class="cursor-pointer">
          <q-popup-proxy cover transition-show="scale" transition-hide="scale">
            <q-date
              :model-value="formValues[input.label] || ''"
              mask="YYYY-MM-DD"
              @update:model-value="updateField(input.label, $event)"
            >
              <div class="row items-center justify-end">
                <q-btn v-close-popup label="OK" color="primary" flat />
              </div>
            </q-date>
          </q-popup-proxy>
        </q-icon>
      </template>
    </q-input>

    <!-- Boolean toggle -->
    <q-toggle
      v-else-if="input.type === 'boolean'"
      :model-value="!!formValues[input.label]"
      :label="input.label"
      color="primary"
      @update:model-value="updateField(input.label, $event)"
    />

    <!-- Fallback: text -->
    <q-input
      v-else
      :model-value="formValues[input.label] || ''"
      :label="input.label"
      outlined
      class="aql-dialog-field"
      @update:model-value="updateField(input.label, $event)"
    />
    </template>
  </AqlDialog>
</template>

<script setup>
import { computed } from 'vue'
import { useDataStore } from 'src/stores/data'
import AqlDialog from 'components/shared/AqlDialog.vue'

defineOptions({ name: 'ReportInputDialog' })

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  report: {
    type: Object,
    default: null
  },
  formValues: {
    type: Object,
    default: () => ({})
  },
  isGenerating: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'update:formValues', 'confirm', 'cancel'])

const reportTitle = computed(() =>
  props.report?.label || props.report?.name || 'Generate Report'
)

const formFields = computed(() => {
  if (!props.report || !props.report.inputs) return [];
  // Any input without a 'field' key and having a 'type' is considered a User Input
  return props.report.inputs.filter(inp => !inp.field && inp.type && inp.label);
});

const dataStore = useDataStore()

function getSelectOptions(input) {
  if (input.options && Array.isArray(input.options)) {
    return input.options
  }
  if (input.source && input.source.resource && input.source.field) {
    const resourceName = input.source.resource
    const fieldName = input.source.field
    const records = dataStore.getRecords(resourceName) || []
    const uniqueValues = [...new Set(records.map(rec => rec[fieldName]))]
      .filter(val => val !== undefined && val !== null && val !== '')
      .sort()
    if (input.default && !uniqueValues.includes(input.default)) {
      return [input.default, ...uniqueValues]
    }
    return uniqueValues
  }
  return []
}

function updateField(name, value) {
  emit('update:formValues', { ...props.formValues, [name]: value })
}
</script>
