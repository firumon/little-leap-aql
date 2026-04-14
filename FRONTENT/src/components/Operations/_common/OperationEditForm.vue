<template>
  <q-card flat bordered class="page-card q-mt-sm">
    <q-card-section class="q-gutter-y-sm">
      <q-input :model-value="code" label="Code" dense outlined disable />
      <template v-for="field in resolvedFields" :key="field.header">
        <q-select
          v-if="field.type === 'status'"
          :model-value="parentForm[field.header]"
          :options="statusOptions"
          :label="field.label"
          dense outlined emit-value map-options
          @update:model-value="$emit('update:field', field.header, $event)"
        />
        <q-input
          v-else
          :model-value="parentForm[field.header]"
          :label="field.label + (field.required ? ' *' : '')"
          :hint="field.hint"
          dense outlined
          @update:model-value="$emit('update:field', field.header, $event)"
        />
      </template>
    </q-card-section>
  </q-card>
</template>

<script setup>
defineProps({
  code: { type: String, default: '' },
  resolvedFields: { type: Array, default: () => [] },
  parentForm: { type: Object, default: () => ({}) },
  statusOptions: { type: Array, default: () => [] }
})

defineEmits(['update:field'])
</script>

<style scoped>
.page-card {
  border-radius: 16px;
  border-color: var(--operation-border, #e2e8f0);
  background: rgba(255, 255, 255, 0.95);
  animation: rise-in 280ms ease-out both;
}
@keyframes rise-in {
  0% { transform: translateY(10px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
</style>
