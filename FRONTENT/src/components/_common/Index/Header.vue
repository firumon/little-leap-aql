<template>
  <GenericHeaderPanel
    :label="config?.name || ''"
    :caption="config?.description || ''"
    :icon="config?.ui?.icon || 'list'"
    :reload="true"
    :back="false"
    @click="$emit('reload')"
  />
</template>

<script setup>
import GenericHeaderPanel from 'components/shared/GenericHeaderPanel.vue'

defineOptions({ name: 'IndexHeader' })

defineProps({
  config: Object
})

defineEmits(['reload'])
</script>
