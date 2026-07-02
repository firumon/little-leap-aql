<template>
  <PageSticky :page="page">
    <FabSingleBtn
      :page="page"
      :action="action"
      @click="$emit('action-clicked', action)"
    />
  </PageSticky>
</template>

<script setup>
import PageSticky from 'components/_common/sections/Action/AdditionalActions/PageSticky.vue'
import FabSingleBtn from 'components/_common/sections/Action/AdditionalActions/FabSingleBtn.vue'

defineOptions({ name: 'AdditionalActionSingle' })

defineProps({
  action: { type: Object, required: true },
  page: { type: String, default: 'View' }
})

defineEmits(['action-clicked'])
</script>
