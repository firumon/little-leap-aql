<template>
  <div>
    <FormRecord
      v-bind="primaryFormProps"
      :title="title"
      @update:field="onPrimaryField"
    />
  </div>
</template>

<script setup>
import { computed, inject, watch, useAttrs } from 'vue'
import FormRecord from 'components/contents/FormRecord.vue'

/**
 * `Update` content (page contract `contents: ['Update']`) — renders the input
 * form for the primary resource's existing record, hydrated from the
 * already-loaded `resourceRecord` into pageState (`pageState.load`). Mirrors
 * `Create.vue`'s primary-record half; submit is owned by the PageAction
 * sections, never here. Child-record editing is not included in this minimal
 * pass — child resources remain view-only via the existing View content.
 *
 * ZERO-HARDCODING CONTRACT: every default behaviour, title, and class below is
 * exposed as a prop; unhandled `$attrs` flow down to the primary FormRecord.
 */
defineOptions({ name: 'ContentsUpdate', inheritAttrs: false })

const props = defineProps({
  hideFields: { type: Array, default: () => [] },
  showFields: { type: Array, default: () => [] },
  showCode: { type: Boolean, default: false },
  workflowFields: { type: [String, Boolean], default: 'hide' },
  showStatus: { type: [Boolean, String], default: false },
  statusDefault: { type: String, default: 'Active' },
  fields: { type: Array, default: null },
  defaultValues: { type: [Object, Function], default: () => ({}) },
  fieldProps: { type: [Object, Function], default: () => ({}) },
  columns: { type: Number, default: 1 },
  title: { type: String, default: '' },
  formRecordProps: { type: Object, default: () => ({}) }
})

const attrs = useAttrs()

const resourceConfig = inject('resourceConfig', null)
const resourceRecord = inject('resourceRecord', null)
const pageState = inject('pageState', null)

const resourceName = computed(() => resourceConfig?.resourceName?.value || '')
const scope = computed(() => resourceConfig?.scope?.value || '')
const resourceSlug = computed(() => resourceConfig?.resourceSlug?.value || '')
const uiName = computed(() => resourceConfig?.customUIName?.value || '')

// Hydrate the primary pageState node from the already-loaded record. Flushes
// any stale node left over from a previously-visited resource page (same
// reset contract as Create.vue), then loads once the record is available —
// usePageOrchestrator's edit watcher (see usePageOrchestrator.js) resolves
// `resourceRecord.record` before this Content mounts (contentWrapperProps
// gates the edit page on `recordExists`), but is re-run defensively on any
// record change (e.g. a reload after a failed save).
watch(
  [resourceName, () => resourceRecord?.record?.value],
  ([name, record], [prevName]) => {
    if (!name || !pageState || !record) return
    if (name !== prevName || !pageState.state.nodes.has(name)) {
      pageState.initResource(name, { isPrimaryKey: true, reset: true, code: record.Code })
    }
    pageState.load(name, record)
  },
  { immediate: true }
)

const primaryRecord = computed(
  () => pageState?.state?.nodes?.get(resourceName.value)?.record || {}
)

function onPrimaryField (header, value, meta) {
  if (!pageState || !resourceName.value) return
  if (meta?.custom) pageState.setControlField(resourceName.value, header, value)
  else pageState.setField(resourceName.value, header, value)
}

const primaryFormProps = computed(() => ({
  ...attrs,
  resource: resourceName.value,
  record: primaryRecord.value,
  hideFields: props.hideFields,
  showFields: props.showFields,
  showCode: props.showCode,
  fields: props.fields,
  defaultValues: props.defaultValues,
  fieldProps: props.fieldProps,
  workflowFields: props.workflowFields,
  showStatus: props.showStatus,
  statusDefault: props.statusDefault,
  columns: props.columns,
  scope: scope.value,
  resourceSlug: resourceSlug.value,
  uiName: uiName.value,
  ...props.formRecordProps
}))
</script>
