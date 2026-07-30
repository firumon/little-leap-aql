<template>
  <q-dialog
    :model-value="modelValue"
    persistent
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <q-card style="min-width: 350px; max-width: 600px; width: 100%; border-radius: 16px;">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6 text-weight-bold text-primary flex items-center q-gutter-x-sm">
          <q-icon :name="actionConfig?.icon || 'bolt'" />
          <span>{{ actionConfig?.label || actionConfig?.action }}</span>
        </div>
        <q-space />
        <q-btn flat round dense icon="close" v-close-popup />
      </q-card-section>

      <q-card-section class="q-pt-md">
        <!-- Render Form component directly -->
        <Form
          v-if="actionConfig"
          :is-multi-outcome="isMultiOutcome"
          :outcome-options="outcomeOptions"
          :selected-outcome="selectedOutcome"
          :resolved-action-fields="resolvedActionFields"
          :action-form="actionForm"
          :resource-name="resourceName"
          @update:selected-outcome="selectedOutcome = $event"
          @update:action-field="(header, val) => { actionForm[header] = val }"
        />
      </q-card-section>

      <q-card-actions align="right" class="q-px-md q-pb-md">
        <q-btn flat label="Cancel" color="grey-7" v-close-popup />
        <q-btn
          unelevated
          :label="actionConfig?.label || 'Execute'"
          :color="actionConfig?.color || 'primary'"
          :icon="actionConfig?.icon || 'check'"
          :loading="submitting"
          :disable="isMultiOutcome && !selectedOutcome"
          @click="handleSubmit"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, watch, reactive, inject } from 'vue'
import { useQuasar } from 'quasar'
import Form from 'components/_common/sections/Content/Form.vue'
import { useActionFields } from 'src/composables/resources/useActionFields'
import { executeActionRequest } from 'src/composables/resources/usePageState'

defineOptions({ name: 'ActionDialog' })

const props = defineProps({
  modelValue: { type: Boolean, required: true },
  actionConfig: { type: Object, default: null },
  record: { type: Object, default: null }
})

const emit = defineEmits(['update:modelValue'])

const $q = useQuasar()
const { resourceName, resourceHeaders } = inject('resourceConfig')
const { reload } = inject('resourceRecord')
const pageState = inject('pageState', null)

const selectedOutcome = ref('')
const actionForm = reactive({})

const {
  column, isMultiOutcome, outcomeOptions, resolvedFields: resolvedActionFields
} = useActionFields(resourceHeaders, () => props.actionConfig, () => selectedOutcome.value)

watch(() => props.actionConfig, (cfg) => {
  selectedOutcome.value = cfg?.columnValue || ''
}, { immediate: true })

watch(resolvedActionFields, (fields) => {
  Object.keys(actionForm).forEach((k) => delete actionForm[k])
  fields.forEach((f) => { actionForm[f.header] = '' })
}, { immediate: true })

const submitting = computed(() => !!pageState?.meta?.submitting)

async function handleSubmit() {
  for (const field of resolvedActionFields.value) {
    if (field.required && !(actionForm[field.header] || '').toString().trim()) {
      $q.notify({ type: 'negative', message: `${field.label} is required`, position: 'top' })
      return
    }
  }

  // Built directly (not via pageState.executeAction's ensureNode) — this dialog
  // is mounted globally in Page.vue, so there is no guarantee a pageState node
  // for this resource already carries the record's code.
  const actionConfig = { ...props.actionConfig, column: column.value, columnValue: selectedOutcome.value }
  const request = executeActionRequest(resourceName.value, props.record?.Code, actionConfig, { ...actionForm })

  await pageState.run({
    requests: [request],
    successMsg: `${props.actionConfig?.label || props.actionConfig?.action || 'Action'} completed successfully`,
    onSuccess: async () => {
      emit('update:modelValue', false)
      await reload()
    }
  })
}
</script>
