<template>
  <div class="row items-center justify-between no-wrap q-mb-md">
    <div class="col">
      <OutletHeaderPanel :title="title" :subtitle="subtitle" />
    </div>
    <div class="q-ml-sm self-center"><ReloadButton /></div>
  </div>
</template>

<script setup>
import OutletHeaderPanel from "components/shared/OutletHeaderPanel.vue";
import ReloadButton from "components/shared/ReloadButton.vue";

defineOptions({ name: 'HeaderPanelWithReload' })

defineProps({
  title: {
    type: String,
    default: ''
  },
  subtitle: {
    type: String,
    default: ''
  },
})
</script>
