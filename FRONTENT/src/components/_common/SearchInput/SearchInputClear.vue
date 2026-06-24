<template>
  <q-icon
    name="cancel"
    color="grey-5"
    class="cursor-pointer"
    @click="$emit('clear')"
  />
</template>

<script setup>
defineOptions({ name: 'SearchInputClear' })
defineEmits(['clear'])
</script>
