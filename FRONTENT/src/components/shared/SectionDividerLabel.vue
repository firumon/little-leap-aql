<template>
  <div class="row items-center q-mb-sm">
    <q-separator class="col" />
    <span class="text-overline text-weight-bold text-grey-6 q-px-md">{{ label }}</span>
    <q-separator class="col" />
  </div>
</template>

<script setup>
defineOptions({ name: 'SectionDividerLabel' })

defineProps({
  label: {
    type: String,
    required: true
  }
})
</script>
