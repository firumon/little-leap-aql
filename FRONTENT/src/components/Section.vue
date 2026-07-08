<template>
  <div>{{ section }}</div>
</template>

<script setup>
defineOptions({
  name: 'AqlSection',
  inheritAttrs: false
})
defineProps({
  section: { type: String, required: true }
})
</script>
