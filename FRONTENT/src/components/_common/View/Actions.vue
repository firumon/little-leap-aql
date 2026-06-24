<template>
  <!-- Standard Actions block for the View page. Typically empty, but available for custom page overrides. -->
  <div class="view-actions" />
</template>

<script setup>
defineOptions({ name: 'ViewActions' })
defineProps({
  config: Object,
  record: Object
})
</script>
