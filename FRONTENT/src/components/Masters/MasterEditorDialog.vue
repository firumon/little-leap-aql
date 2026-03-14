<template>
  <q-dialog :model-value="modelValue" persistent @update:model-value="$emit('update:modelValue', $event)">
    <q-card class="editor-card">
      <q-card-section class="row items-center">
        <div class="text-h6 text-weight-bold">
          {{ isEdit ? `Edit ${config?.ui?.pageTitle || config?.name}` : `Create ${config?.ui?.pageTitle || config?.name}` }}
        </div>
        <q-space />
        <q-btn icon="close" flat round dense @click="$emit('update:modelValue', false)" />
      </q-card-section>

      <q-card-section class="q-pt-none q-gutter-y-sm">
        <q-input
          v-if="isEdit"
          :model-value="form.Code"
          label="Code"
          dense
          outlined
          disable
        />

        <template v-for="field in resolvedFields" :key="field.header">
          <q-select
            v-if="field.type === 'status'"
            :model-value="form[field.header]"
            :options="statusOptions"
            :label="field.label"
            dense
            outlined
            emit-value
            map-options
            @update:model-value="setField(field.header, $event)"
          />
          <q-input
            v-else
            :model-value="form[field.header]"
            :label="field.label"
            dense
            outlined
            @update:model-value="setField(field.header, $event)"
          />
        </template>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Cancel" @click="$emit('update:modelValue', false)" />
        <q-btn color="primary" :loading="saving" :label="isEdit ? 'Update' : 'Create'" @click="$emit('save')" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  isEdit: {
    type: Boolean,
    default: false
  },
  config: {
    type: Object,
    default: null
  },
  form: {
    type: Object,
    default: () => ({})
  },
  resolvedFields: {
    type: Array,
    default: () => []
  },
  statusOptions: {
    type: Array,
    default: () => []
  },
  saving: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'update:form', 'save'])

function setField(key, value) {
  emit('update:form', { ...props.form, [key]: value })
}
</script>

<style scoped>
.editor-card {
  min-width: 300px;
  width: 100%;
  max-width: 560px;
  border-radius: 16px;
}
</style>
