<template>
  <ResourceReports :mode="mode" :record="record" />
</template>

<script setup>
import ResourceReports from 'components/Reports/ResourceReports.vue'

defineOptions({ name: 'CommonResourceReportsWrapper' })

defineProps({
  mode: { type: String, default: '' },
  record: { type: Object, default: null }
})
</script>
