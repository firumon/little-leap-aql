<template>
  <PageSticky :page="page">
    <FabBtn
      :page="page"
      :actions="actions"
    >
      <FabItem
        v-for="act in actions"
        :key="act.action"
        :page="page"
        :action="act"
        @click="$emit('action-clicked', act)"
      />
    </FabBtn>
  </PageSticky>
</template>

<script setup>
import PageSticky from 'components/_common/sections/Action/AdditionalActions/PageSticky.vue'
import FabBtn from 'components/_common/sections/Action/AdditionalActions/FabBtn.vue'
import FabItem from 'components/_common/sections/Action/AdditionalActions/FabItem.vue'

defineOptions({ name: 'AdditionalActionMultiple' })

defineProps({
  actions: { type: Array, required: true },
  page: { type: String, default: 'View' }
})

defineEmits(['action-clicked'])
</script>
