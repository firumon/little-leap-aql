<template>
  <q-page class="q-pa-md bg-grey-1">
    <div class="row q-col-gutter-md">
      <div
        v-for="widget in activeWidgets"
        :key="widget.id"
        class="col-12 col-md-6 col-lg-4"
      >
        <component :is="widget.component" />
      </div>

      <div v-if="activeWidgets.length === 0" class="col-12 text-center q-pa-xl text-grey-6">
        <q-icon name="dashboard_customize" size="4rem" class="q-mb-md" />
        <div class="text-h6">No widgets assigned</div>
        <div>Your current role does not have any active dashboard widgets configured.</div>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { useDashboardWidgets } from 'src/composables/useDashboardWidgets'

const { activeWidgets } = useDashboardWidgets()
</script>
