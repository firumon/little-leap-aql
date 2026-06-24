<template>
  <!-- Standard Toolbar block for the Edit page. Typically empty, but available for stepper controls or page tabs. -->
  <div class="edit-toolbar" />
</template>

<script setup>
defineOptions({ name: 'EditToolbar' })
defineProps({
  config: Object
})
</script>
