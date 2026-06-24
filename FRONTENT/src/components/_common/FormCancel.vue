<template>
  <q-btn
    flat
    color="grey-7"
    label="Cancel"
    icon="close"
    @click="$emit('cancel')"
  />
</template>

<script setup>
defineOptions({ name: 'FormCancel' })
defineEmits(['cancel'])
</script>
