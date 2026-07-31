<template>
  <q-fab
    glossy
    push
    class="aql-crud-action-fab"
    color="primary"
    icon="more_vert"
    active-icon="close"
    direction="up"
  >
    <slot name="AddFab" v-if="$slots.AddFab" />
    <slot name="EditFab" v-if="$slots.EditFab" />
    <slot name="RecordFab" v-if="$slots.RecordFab" />
    <slot name="ResourceFab" v-if="$slots.ResourceFab" />
    <slot name="ViewFab" v-if="$slots.ViewFab" />
  </q-fab>
</template>

<script setup>
defineOptions({ name: 'ActionsCrudActionsFab' })
</script>
