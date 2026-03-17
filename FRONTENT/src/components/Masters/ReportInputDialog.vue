<template>
  <q-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)">
    <q-card class="report-dialog-card">
      <q-card-section class="row items-center q-pb-sm">
        <q-icon name="description" color="primary" size="24px" class="q-mr-sm" />
        <div class="text-subtitle1 text-weight-bold">{{ report?.label || report?.name || 'Generate Report' }}</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-separator />

      <q-card-section class="q-gutter-y-sm">
        <div class="report-dialog-hint">
          Fill in the required fields below, then click Generate.
        </div>

        <template v-for="input in formFields" :key="input.label">
          <!-- Text input -->
          <q-input
            v-if="input.type === 'text'"
            :model-value="formValues[input.label] || ''"
            :label="input.label"
            outlined
            dense
            class="report-input"
            @update:model-value="updateField(input.label, $event)"
          />

          <!-- Number input -->
          <q-input
            v-else-if="input.type === 'number'"
            :model-value="formValues[input.label] || ''"
            :label="input.label"
            type="number"
            outlined
            dense
            class="report-input"
            @update:model-value="updateField(input.label, $event)"
          />

          <!-- Date input -->
          <q-input
            v-else-if="input.type === 'date'"
            :model-value="formValues[input.label] || ''"
            :label="input.label"
            outlined
            dense
            class="report-input"
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
            dense
            class="report-input"
            @update:model-value="updateField(input.label, $event)"
          />
        </template>
      </q-card-section>

      <q-card-actions align="right" class="q-px-md q-pb-md">
        <q-btn flat label="Cancel" @click="$emit('cancel')" />
        <q-btn
          unelevated
          color="primary"
          icon="picture_as_pdf"
          label="Generate"
          :loading="isGenerating"
          :disable="isGenerating"
          @click="$emit('confirm')"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed } from 'vue'

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

const formFields = computed(() => {
  if (!props.report || !props.report.inputs) return [];
  // Any input without a 'field' key and having a 'type' is considered a User Input
  return props.report.inputs.filter(inp => !inp.field && inp.type && inp.label);
});

function updateField(name, value) {
  emit('update:formValues', { ...props.formValues, [name]: value })
}
</script>

<style scoped>
.report-dialog-card {
  min-width: 320px;
  width: 100%;
  max-width: 460px;
  border-radius: 18px;
}

.report-dialog-hint {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 6px;
}

.report-input :deep(.q-field__control) {
  border-radius: 12px;
}
</style>
