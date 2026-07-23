<template>
  <div>
    <ViewRecord v-bind="{ ...$props, ...$attrs }" />
    <ViewAudit v-bind="$attrs" />
  </div>
</template>

<script setup>
import ViewRecord from 'components/contents/ViewRecord.vue'
import ViewAudit from 'components/contents/ViewAudit.vue'

defineOptions({ name: 'ContentsViewRecordWithAudit', inheritAttrs: false })

defineProps({
  record: { type: Object, required: true },
  resolvedFields: { type: Array, default: null },
  resourceName: { type: String, default: '' },
  resourceSlug: { type: String, default: '' },
  scope: { type: String, default: '' },
  uiName: { type: String, default: '' },
  detailsConfig: { type: Object, default: () => ({}) },
  showCodeLink: { type: Boolean, default: true }
})
</script>
