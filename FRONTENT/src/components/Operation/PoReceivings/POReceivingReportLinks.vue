<template>
  <q-list bordered separator class="rounded-borders">
    <q-item v-for="report in reports" :key="report.key" disable>
      <q-item-section avatar><q-icon :name="report.icon" color="grey" /></q-item-section>
      <q-item-section>
        <q-item-label>{{ report.label }}</q-item-label>
        <q-item-label caption>{{ report.caption }}</q-item-label>
      </q-item-section>
      <q-item-section side><q-badge color="grey" label="Future" /></q-item-section>
    </q-item>
  </q-list>
</template>

<script setup>
defineProps({ reports: { type: Array, default: () => [] } })
</script>
