<template>
  <div class="flex flex-center q-pa-xl bg-grey-2 rounded-borders empty-state">
    <div class="text-grey-6 text-center">
      <q-icon name="table_view" size="84px" class="q-mb-md" />
      <div class="text-h5 text-weight-light">No Data Plotted</div>
      <div class="q-mt-sm">Select a resource and provide data to see the preview table</div>
    </div>
  </div>
</template>

<style scoped>
.empty-state {
  min-height: 400px;
  border-radius: 8px;
}
</style>
