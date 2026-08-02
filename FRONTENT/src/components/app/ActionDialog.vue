<template>
  <AqlDialog
    :model-value="modelValue"
    :title="actionConfig?.label || actionConfig?.action || 'Action'"
    :subtitle="record?.Code || ''"
    :icon="actionConfig?.icon || 'bolt'"
    persistent
    max-width="600px"
    :confirm-label="actionConfig?.label || 'Execute'"
    :confirm-icon="actionConfig?.icon || 'check'"
    :confirm-color="actionConfig?.color || 'primary'"
    :loading="submitting"
    :disable-confirm="isMultiOutcome && !selectedOutcome"
    @update:model-value="$emit('update:modelValue', $event)"
    @confirm="handleSubmit"
    @cancel="$emit('update:modelValue', false)"
  >
    <!-- Outcome picker — only for multi-outcome actions (columnValueOptions). -->
    <q-select
      v-if="isMultiOutcome"
      :model-value="selectedOutcome"
      :options="outcomeOptions"
      label="Outcome"
      outlined
      emit-value
      map-options
      @update:model-value="selectedOutcome = $event"
    />

    <!-- Dynamic per-outcome fields from the AdditionalActions config. -->
    <template v-for="field in resolvedActionFields" :key="field.header">
      <AppDate
        v-if="field.type === 'date'"
        :model-value="actionForm[field.header]"
        :label="fieldLabel(field)"
        outlined
        @update:model-value="actionForm[field.header] = $event"
      />

      <!-- Option-backed field. Options come from a literal `options[]` or are
           resolved out of the data store via `source: { resource, field }`.
           Past `OPTION_FILTER_THRESHOLD` entries the control switches to a
           type-to-filter combobox — scrolling a flat list stops being usable
           at that size. -->
      <q-select
        v-else-if="field.type === 'select'"
        :model-value="actionForm[field.header]"
        :label="fieldLabel(field)"
        :options="optionsFor(field)"
        outlined
        clearable
        emit-value
        map-options
        :use-input="isFilterable(field)"
        :hide-selected="isFilterable(field)"
        :fill-input="isFilterable(field)"
        input-debounce="0"
        @filter="(needle, update) => filterOptions(field, needle, update)"
        @update:model-value="actionForm[field.header] = $event ?? ''"
      >
        <template #no-option>
          <q-item>
            <q-item-section class="text-grey">No results</q-item-section>
          </q-item>
        </template>
      </q-select>

      <!-- Comment / reason / remark / note. Deliberately no `autogrow`, `dense` or
           `rows`: each collapses the control toward a single-line height, so it stops
           reading as a textarea. Plain type="textarea" keeps its natural box. -->
      <q-input
        v-else-if="field.type === 'textarea'"
        type="textarea"
        outlined
        :model-value="actionForm[field.header]"
        :label="fieldLabel(field)"
        @update:model-value="actionForm[field.header] = $event"
      />

      <q-input
        v-else
        :type="field.type === 'number' ? 'number' : 'text'"
        outlined
        :model-value="actionForm[field.header]"
        :label="fieldLabel(field)"
        @update:model-value="actionForm[field.header] = $event"
      />
    </template>
  </AqlDialog>
</template>

<script setup>
/**
 * Workflow-action input dialog for `mutate`-kind AdditionalActions.
 *
 * Mounted once in `Page.vue` (outside any overridable action, so a custom
 * PageAction override can never swallow it) and driven through
 * `pageState.meta.actionDialog`, which `ResourceActions` sets when a workflow
 * FAB item is clicked. Composes the shared `AqlDialog` shell; outcome/field
 * resolution comes from `useActionFields`, dispatch goes through
 * `pageState.run()` with an `executeAction` request.
 *
 * Relocated from the deprecated `components/_common/sections/Action/` tree into
 * `components/app/` — it composes shared components and app composables, which
 * is exactly what the `app/` layer is for (ARCHITECTURE RULES §8).
 */
import { ref, computed, watch, reactive, inject } from 'vue'
import { useQuasar } from 'quasar'
import AqlDialog from 'components/shared/AqlDialog.vue'
import AppDate from 'components/app/Date.vue'
import { useDataStore } from 'src/stores/data'
import { useActionFields } from 'src/composables/resources/useActionFields'
import { executeActionRequest } from 'src/composables/resources/usePageState'

defineOptions({ name: 'AppActionDialog' })

const props = defineProps({
  modelValue:   { type: Boolean, required: true },
  actionConfig: { type: Object, default: null },
  record:       { type: Object, default: null }
})

const emit = defineEmits(['update:modelValue'])

// Above this many options a plain dropdown becomes unscrollable in practice,
// so the select turns into a type-to-filter combobox instead.
const OPTION_FILTER_THRESHOLD = 15

const $q = useQuasar()
const dataStore = useDataStore()
const { resourceName, resourceHeaders } = inject('resourceConfig')
const { reload } = inject('resourceRecord')
const pageState = inject('pageState', null)

const selectedOutcome = ref('')
const actionForm = reactive({})
// Per-field narrowed option lists, keyed by header; populated by `filterOptions`
// and reset whenever the field set changes.
const filteredOptions = reactive({})

const {
  column, isMultiOutcome, outcomeOptions, resolvedFields: resolvedActionFields
} = useActionFields(resourceHeaders, () => props.actionConfig, () => selectedOutcome.value)

watch(() => props.actionConfig, (cfg) => {
  selectedOutcome.value = cfg?.columnValue || ''
}, { immediate: true })

watch(resolvedActionFields, (fields) => {
  Object.keys(actionForm).forEach((k) => delete actionForm[k])
  Object.keys(filteredOptions).forEach((k) => delete filteredOptions[k])
  fields.forEach((f) => { actionForm[f.header] = '' })
}, { immediate: true })

const submitting = computed(() => !!pageState?.meta?.submitting)

/**
 * Full option list per select field, keyed by header. A `source` is resolved
 * against the data store into `{ label, value }` pairs — the value is always
 * `record[source.field]`, the label is the human-readable descriptor picked by
 * `resolveLabelField`. A literal `options[]` wins over it and is used as-is.
 */
const allOptions = computed(() => {
  const map = {}
  for (const field of resolvedActionFields.value) {
    if (field.type !== 'select') continue
    map[field.header] = resolveOptions(field)
  }
  return map
})

function resolveOptions(field) {
  if (Array.isArray(field.options) && field.options.length) return field.options
  const { resource, field: valueField } = field.source || {}
  if (!resource || !valueField) return []

  const records = dataStore.getRecords(resource) || []
  const labelField = resolveLabelField(field.source, resource, records)

  const seen = new Set()
  const options = []
  for (const rec of records) {
    const value = rec?.[valueField]
    if (value === undefined || value === null || value === '') continue
    if (seen.has(value)) continue
    seen.add(value)
    options.push({ label: buildOptionLabel(rec, valueField, labelField), value })
  }
  return options.sort((a, b) => a.label.localeCompare(b.label))
}

/**
 * Picks the record property that carries the human-readable descriptor, in
 * precedence order: an explicit `source.label`, a `Name` column, then the
 * resource's second sheet column (index 0 is always `Code`, so index 1 is the
 * conventional descriptor). Returns null when none applies, which leaves the
 * raw value as the label.
 */
function resolveLabelField(source, resource, records) {
  if (source?.label) return source.label

  const headers = dataStore.headers?.[resource]?.length
    ? dataStore.headers[resource]
    : Object.keys(records[0] || {})

  if (headers.includes('Name')) return 'Name'
  return headers[1] || null
}

// `Warehouses` + label `Name` → "Main Warehouse (WH001)". The value is appended
// in parentheses so the code stays visible and searchable; a label field that
// IS the value field, or an empty label cell, degrades to the bare value.
function buildOptionLabel(record, valueField, labelField) {
  const value = String(record[valueField])
  if (!labelField || labelField === valueField) return value
  const text = record[labelField]
  if (text === undefined || text === null || String(text).trim() === '') return value
  return `${text} (${value})`
}

function isFilterable(field) {
  return (allOptions.value[field.header] || []).length > OPTION_FILTER_THRESHOLD
}

function optionsFor(field) {
  return filteredOptions[field.header] || allOptions.value[field.header] || []
}

// q-select's `@filter` contract: narrow the list inside the `update` callback.
function filterOptions(field, needle, update) {
  update(() => {
    const all = allOptions.value[field.header] || []
    const query = (needle || '').trim().toLowerCase()
    filteredOptions[field.header] = query
      ? all.filter((opt) => optionText(opt).toLowerCase().includes(query))
      : all
  })
}

function optionText(option) {
  return String(option?.label ?? option?.value ?? option ?? '')
}

// Required fields are marked with a trailing asterisk; handleSubmit enforces them.
function fieldLabel (field) {
  return `${field.label}${field.required ? ' *' : ''}`
}

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
