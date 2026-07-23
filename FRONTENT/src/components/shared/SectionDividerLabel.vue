<template>
  <div v-if="label && label.trim()" class="row items-center q-mt-md q-mb-sm">
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
