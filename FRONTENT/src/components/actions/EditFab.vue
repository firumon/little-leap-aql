<template>
  <q-fab-action
    v-if="asFabAction"
    :color="color"
    :icon="icon"
    :label="tooltip"
    label-position="left"
    external-label
    @click="$emit('click')"
  />
  <q-btn
    v-else
    glossy
    push
    round
    fab
    :color="color"
    :icon="icon"
    class="aql-crud-action-fab"
    @click="$emit('click')"
  >
    <q-tooltip anchor="top middle" self="bottom middle" :offset="[0, 8]">
      {{ tooltip }}
    </q-tooltip>
  </q-btn>
</template>

<script setup>
defineOptions({ name: 'ActionsEditFab' })

defineProps({
  color:       { type: String, default: 'primary' },
  icon:        { type: String, default: 'edit' },
  tooltip:     { type: String, default: 'Edit' },
  // Set when rendered inside CrudActionsFab's expandable menu, so this becomes a
  // real q-fab-action (participates in Quasar's stagger/auto-collapse behavior)
  // instead of a standalone floating q-btn.
  asFabAction: { type: Boolean, default: false }
})

defineEmits(['click'])
</script>
