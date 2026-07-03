<template>
  <q-card v-if="page !== 'Action'" flat bordered class="aql-premium-gradient-form">
    <q-card-section>
      <div v-if="formFields.length" class="q-gutter-y-sm">
        <div v-for="field in formFields" :key="field.header">
          <AqlFileUpload
            v-if="field.componentName === 'aql-file-upload'"
            :model-value="parentForm[field.header]"
            v-bind="fieldRenderProps(field)"
            @update:model-value="onFieldUpdate(field.header, $event)"
          />
          <AppDate
            v-else-if="field.componentName === 'app-date'"
            :model-value="parentForm[field.header]"
            v-bind="fieldRenderProps(field)"
            @update:model-value="onFieldUpdate(field.header, $event)"
          />
          <AqlStatusToggle
            v-else-if="field.componentName === 'aql-status-toggle'"
            :model-value="parentForm[field.header]"
            v-bind="fieldRenderProps(field)"
            @update:model-value="onFieldUpdate(field.header, $event)"
          />
          <q-toggle
            v-else-if="field.componentName === 'q-toggle'"
            :model-value="parentForm[field.header]"
            v-bind="fieldRenderProps(field)"
            @update:model-value="onFieldUpdate(field.header, $event)"
          />
          <q-select
            v-else-if="field.componentName === 'q-select'"
            :model-value="parentForm[field.header]"
            v-bind="fieldRenderProps(field)"
            @update:model-value="onFieldUpdate(field.header, $event)"
          />
          <q-input
            v-else
            :model-value="parentForm[field.header]"
            v-bind="fieldRenderProps(field)"
            @update:model-value="onFieldUpdate(field.header, $event)"
          />
        </div>
      </div>
      <div v-else class="text-grey-6 text-center q-pa-md">
        No fields configured for this resource.
      </div>
    </q-card-section>

    <template v-if="childGroups.length">
      <q-card-section
        v-for="group in childGroups"
        :key="group.resource.name"
        class="q-pt-xs q-px-md"
      >
        <div class="row items-center justify-between q-mb-sm">
          <div class="text-subtitle2 text-weight-bold">
            {{ group.resource.ui?.menus?.[0]?.pageTitle || group.resource.name }}
          </div>
          <q-btn
            flat dense round icon="add" color="primary"
            @click="$emit('add-child', group.resource.name)"
          />
        </div>

        <div v-if="group.records.length" class="child-records">
          <div
            v-for="(childRow, ci) in group.records"
            :key="childRow._key"
            class="child-record-row"
          >
            <div class="row q-gutter-xs items-center">
              <template v-for="cf in childFormFields(group, childRow)" :key="cf.header">
                <AqlFileUpload
                  v-if="cf.componentName === 'aql-file-upload'"
                  :model-value="childRow.data[cf.header]"
                  v-bind="fieldRenderProps(cf)"
                  @update:model-value="onChildFieldUpdate(group.resource.name, ci, cf.header, $event)"
                  class="col"
                />
                <AppDate
                  v-else-if="cf.componentName === 'app-date'"
                  :model-value="childRow.data[cf.header]"
                  v-bind="fieldRenderProps(cf)"
                  @update:model-value="onChildFieldUpdate(group.resource.name, ci, cf.header, $event)"
                  class="col"
                />
                <q-toggle
                  v-else-if="cf.componentName === 'q-toggle'"
                  :model-value="childRow.data[cf.header]"
                  v-bind="fieldRenderProps(cf)"
                  @update:model-value="onChildFieldUpdate(group.resource.name, ci, cf.header, $event)"
                  class="col"
                />
                <q-select
                  v-else-if="cf.componentName === 'q-select'"
                  :model-value="childRow.data[cf.header]"
                  v-bind="fieldRenderProps(cf)"
                  @update:model-value="onChildFieldUpdate(group.resource.name, ci, cf.header, $event)"
                  class="col"
                />
                <q-input
                  v-else
                  :model-value="childRow.data[cf.header]"
                  v-bind="fieldRenderProps(cf)"
                  @update:model-value="onChildFieldUpdate(group.resource.name, ci, cf.header, $event)"
                  class="col"
                />
              </template>
              <q-btn
                flat dense round icon="delete" color="negative" size="sm"
                @click="$emit('remove-child', group.resource.name, ci)"
              />
            </div>
          </div>
        </div>
        <div v-else class="text-caption text-grey-5 q-pa-xs text-center">
          No {{ group.resource.ui?.menus?.[0]?.pageTitle || group.resource.name }} records added yet.
        </div>
      </q-card-section>
    </template>
  </q-card>
</template>

<script setup>
import { computed } from 'vue'
import AqlFileUpload from 'components/shared/AqlFileUpload.vue'
import AppDate from 'components/shared/AppDate.vue'
import { useFormFields, mapField } from 'src/composables/resources/useFormFields'
import { useDataStore } from 'src/stores/data'
import AqlStatusToggle from "components/shared/AqlStatusToggle.vue";

defineOptions({ name: 'CommonForm' })

const props = defineProps({
  code: { type: String, default: '' },
  parentForm: { type: Object, default: () => ({}) },
  childGroups: { type: Array, default: () => [] },
  resourceName: { type: String, default: '' },
  page: { type: String, default: 'Add' },
})

const emit = defineEmits([
  'update:field',
  'add-child',
  'remove-child',
  'update-child-field',
  'update:selectedOutcome',
  'update:actionField'
])

const dataStore = useDataStore()

const { formFields } = useFormFields(props.resourceName)

function fieldRenderProps(field) {
  const { header, component, componentName, ...rest } = field
  return rest
}

function onFieldUpdate(header, val) {
  emit('update:field', header, val)
}

function childFormFields(group, childRow) {
  const childLinkRefs = dataStore.getRelations(group.resource.name)?.linkRefs || {}
  return (group.resolvedFields || [])
    .filter(f => f && f.header)
    .map(field => mapField(field, {
      resourceName: group.resource.name,
      linkRefs: childLinkRefs,
      crossRefOptions: {}
    }))
}

function onChildFieldUpdate(resourceName, index, header, val) {
  emit('update-child-field', resourceName, index, header, val)
}
</script>
