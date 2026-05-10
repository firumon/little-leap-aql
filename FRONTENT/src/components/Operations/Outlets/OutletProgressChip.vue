<template><q-chip dense class="q-pa-sm" :color="meta.color" text-color="white">{{ meta.label }}</q-chip></template>
<script setup>
import { computed } from 'vue'
import { progressMeta } from '../../../composables/operations/outlets/outletOperationsMeta.js'
defineOptions({ name: 'OutletProgressChip' })
const props = defineProps({ progress: { type: String, default: '' } })
const meta = computed(() => progressMeta(props.progress))
</script>
