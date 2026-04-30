<template><q-card><q-card-section><div class="row items-start q-col-gutter-md"><div class="col"><div class="text-h6">{{ title }}</div><div class="text-caption text-grey-7">{{ subtitle }}</div></div><div v-for="item in stats" :key="item.label" class="col-auto text-right"><div class="text-caption text-grey-7">{{ item.label }}</div><div class="text-weight-bold">{{ item.value }}</div></div><slot name="side" /></div></q-card-section></q-card></template>
<script setup>
defineOptions({ name: 'OutletHeaderPanel' })
defineProps({ title: { type: String, default: '' }, subtitle: { type: String, default: '' }, stats: { type: Array, default: () => [] } })
</script>
