<template>
  <q-btn
    flat
    color="warning"
    label="Clear"
    icon="backspace"
    @click="$emit('clear')"
  />
</template>

<script setup>
defineOptions({ name: 'ClearButton' })
defineEmits(['clear'])
</script>
