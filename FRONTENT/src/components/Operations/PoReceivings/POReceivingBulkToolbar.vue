<template>
  <div class="row q-gutter-sm items-center">
    <q-btn dense outline color="primary" icon="done_all" label="Set Received = Expected" @click="$emit('receive-all')" />
    <q-btn dense outline color="grey-7" icon="backspace" label="Clear Quantities" @click="$emit('clear')" />
  </div>
</template>

<script setup>
defineEmits(['receive-all', 'clear'])
</script>
