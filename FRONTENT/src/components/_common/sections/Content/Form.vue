<template>
  <q-card
    :flat="activeConfig.flat !== false"
    :bordered="activeConfig.bordered !== false"
    :class="['form-card q-mt-sm', activeConfig.class]"
  >
    <!-- 0. Multi-outcome selector (for Action forms) -->
    <q-card-section v-if="isActionForm && isMultiOutcome" class="q-pb-none">
      <div class="field-label q-mb-sm">Select Outcome</div>
      <q-option-group
        v-if="outcomeSelectOptions.length <= 4"
        :model-value="selectedOutcome"
        :options="outcomeSelectOptions"
        type="radio"
        color="primary"
        @update:model-value="$emit('update:selectedOutcome', $event)"
      />
      <q-select
        v-else
        :model-value="selectedOutcome"
        :options="outcomeSelectOptions"
        label="Outcome"
        dense outlined emit-value map-options
        @update:model-value="$emit('update:selectedOutcome', $event)"
      />
    </q-card-section>

    <!-- 1. Form Sections/Groups (handles both Parent and Action fields) -->
    <template v-for="(sec, sIdx) in formSections" :key="sIdx">
      <!-- Section Title & Collapsible Header -->
      <q-card-section v-if="sec.title" class="q-pb-none">
        <div
          :class="['row items-center justify-between', { 'cursor-pointer': sec.collapsible }]"
          @click="sec.collapsible ? toggleSection(sIdx) : null"
        >
          <div class="text-subtitle2 text-weight-bold">{{ sec.title }}</div>
          <q-icon v-if="sec.collapsible" :name="collapsedState[sIdx] ? 'expand_more' : 'expand_less'" />
        </div>
      </q-card-section>

      <!-- Section Fields Container (collapsible or static) -->
      <q-slide-transition v-if="sec.collapsible">
        <div v-show="!collapsedState[sIdx]">
          <q-card-section class="q-pt-sm">
            <div :style="getGridStyle(sec.columns)">
              <div v-for="field in sec.fields" :key="field.header" :class="['field-item', field.class]">
                <component
                  v-if="field.header === 'Code'"
                  :is="'q-input'"
                  :model-value="code"
                  label="Code"
                  dense outlined disable
                />
                <q-select
                  v-else-if="field.type === 'status'"
                  :model-value="parentForm[field.header]"
                  :options="statusOptions"
                  :label="field.label"
                  :hint="field.hint"
                  dense outlined emit-value map-options
                  @update:model-value="$emit('update:field', field.header, $event)"
                />
                <AqlFileUpload
                  v-else-if="field.type === 'file'"
                  :model-value="parentForm[field.header]"
                  :label="field.label"
                  :required="field.required"
                  :accept="field.accept || '*'"
                  :max-size="field.maxSize || 10"
                  :resource-name="resourceName"
                  :column-name="field.header"
                  @update:model-value="$emit('update:field', field.header, $event)"
                />
                <q-select
                  v-else-if="field.type === 'select'"
                  :model-value="isActionForm ? actionForm[field.header] : parentForm[field.header]"
                  :options="field.options || []"
                  :label="field.label + (field.required ? ' *' : '')"
                  :hint="field.hint"
                  :readonly="field.readonly"
                  dense outlined emit-value map-options
                  @update:model-value="updateFieldValue(field.header, $event)"
                />
                <q-input
                  v-else-if="field.type === 'textarea'"
                  :model-value="isActionForm ? actionForm[field.header] : parentForm[field.header]"
                  :label="field.label + (field.required ? ' *' : '')"
                  :hint="field.hint"
                  :readonly="field.readonly"
                  :placeholder="field.placeholder"
                  dense outlined type="textarea" autogrow
                  @update:model-value="updateFieldValue(field.header, $event)"
                />
                <q-input
                  v-else-if="field.type === 'date'"
                  :model-value="isActionForm ? actionForm[field.header] : parentForm[field.header]"
                  :label="field.label + (field.required ? ' *' : '')"
                  :hint="field.hint"
                  :readonly="field.readonly"
                  dense outlined type="date"
                  @update:model-value="updateFieldValue(field.header, $event)"
                />
                <q-input
                  v-else-if="field.type === 'number'"
                  :model-value="isActionForm ? actionForm[field.header] : parentForm[field.header]"
                  :label="field.label + (field.required ? ' *' : '')"
                  :hint="field.hint"
                  :readonly="field.readonly"
                  :placeholder="field.placeholder"
                  dense outlined type="number"
                  @update:model-value="updateFieldValue(field.header, $event)"
                />
                <q-input
                  v-else
                  :model-value="isActionForm ? actionForm[field.header] : parentForm[field.header]"
                  :label="field.label + (field.required ? ' *' : '')"
                  :hint="field.hint"
                  :readonly="field.readonly"
                  :placeholder="field.placeholder"
                  dense outlined
                  @update:model-value="updateFieldValue(field.header, $event)"
                />
              </div>
            </div>
          </q-card-section>
        </div>
      </q-slide-transition>

      <q-card-section v-else class="q-pt-sm">
        <div :style="getGridStyle(sec.columns)">
          <div v-for="field in sec.fields" :key="field.header" :class="['field-item', field.class]">
            <component
              v-if="field.header === 'Code'"
              :is="'q-input'"
              :model-value="code"
              label="Code"
              dense outlined disable
            />
            <q-select
              v-else-if="field.type === 'status'"
              :model-value="parentForm[field.header]"
              :options="statusOptions"
              :label="field.label"
              :hint="field.hint"
              dense outlined emit-value map-options
              @update:model-value="$emit('update:field', field.header, $event)"
            />
            <AqlFileUpload
              v-else-if="field.type === 'file'"
              :model-value="parentForm[field.header]"
              :label="field.label"
              :required="field.required"
              :accept="field.accept || '*'"
              :max-size="field.maxSize || 10"
              :resource-name="resourceName"
              :column-name="field.header"
              @update:model-value="$emit('update:field', field.header, $event)"
            />
            <q-select
              v-else-if="field.type === 'select'"
              :model-value="isActionForm ? actionForm[field.header] : parentForm[field.header]"
              :options="field.options || []"
              :label="field.label + (field.required ? ' *' : '')"
              :hint="field.hint"
              :readonly="field.readonly"
              dense outlined emit-value map-options
              @update:model-value="updateFieldValue(field.header, $event)"
            />
            <q-input
              v-else-if="field.type === 'textarea'"
              :model-value="isActionForm ? actionForm[field.header] : parentForm[field.header]"
              :label="field.label + (field.required ? ' *' : '')"
              :hint="field.hint"
              :readonly="field.readonly"
              :placeholder="field.placeholder"
              dense outlined type="textarea" autogrow
              @update:model-value="updateFieldValue(field.header, $event)"
            />
            <q-input
              v-else-if="field.type === 'date'"
              :model-value="isActionForm ? actionForm[field.header] : parentForm[field.header]"
              :label="field.label + (field.required ? ' *' : '')"
              :hint="field.hint"
              :readonly="field.readonly"
              dense outlined type="date"
              @update:model-value="updateFieldValue(field.header, $event)"
            />
            <q-input
              v-else-if="field.type === 'number'"
              :model-value="isActionForm ? actionForm[field.header] : parentForm[field.header]"
              :label="field.label + (field.required ? ' *' : '')"
              :hint="field.hint"
              :readonly="field.readonly"
              :placeholder="field.placeholder"
              dense outlined type="number"
              @update:model-value="updateFieldValue(field.header, $event)"
            />
            <q-input
              v-else
              :model-value="isActionForm ? actionForm[field.header] : parentForm[field.header]"
              :label="field.label + (field.required ? ' *' : '')"
              :hint="field.hint"
              :readonly="field.readonly"
              :placeholder="field.placeholder"
              dense outlined
              @update:model-value="updateFieldValue(field.header, $event)"
            />
          </div>
        </div>
      </q-card-section>
    </template>

    <!-- No action fields warning/message -->
    <q-card-section v-if="isActionForm && !processedFields.length && selectedOutcome" class="text-grey-6 q-pt-none">
      No additional input required. Click submit to proceed.
    </q-card-section>

    <!-- 2. Child Groups (Only for non-Action Forms) -->
    <template v-if="!isActionForm">
      <q-card-section v-for="group in childGroups" :key="group.name" class="q-pt-none">
        <div class="row items-center justify-between q-mb-sm">
          <div class="text-subtitle2 text-weight-bold">{{ group.label || group.name }}</div>
          <q-btn flat dense round icon="add" color="primary" @click="$emit('add-child', group.name)" />
        </div>

        <q-list separator bordered class="rounded-borders">
          <q-item v-for="(childRow, ci) in group.records" :key="ci" class="q-pa-sm">
            <q-item-section>
              <div class="row q-gutter-sm">
                <template v-for="cf in group.fields" :key="cf.header">
                  <q-select
                    v-if="cf.type === 'select'" dense outlined
                    :label="cf.label" :options="cf.options || []"
                    :model-value="childRow[cf.header]"
                    @update:model-value="$emit('update-child-field', group.name, ci, cf.header, $event)"
                    emit-value map-options class="col"
                  />
                  <q-input
                    v-else dense outlined
                    :label="cf.label" :type="cf.inputType || 'text'"
                    :model-value="childRow[cf.header]"
                    :readonly="cf.readonly"
                    @update:model-value="$emit('update-child-field', group.name, ci, cf.header, $event)"
                    class="col"
                  />
                </template>
              </div>
            </q-item-section>
            <q-item-section side v-if="!activeConfig.disableChildRemove">
              <q-btn flat dense round icon="delete" color="negative" @click="$emit('remove-child', group.name, ci)" />
            </q-item-section>
          </q-item>
        </q-list>

        <div v-if="group.records.length === 0" class="text-caption text-grey-5 q-pa-sm text-center">
          No {{ group.label || group.name }} records added yet.
        </div>
      </q-card-section>
    </template>
  </q-card>
</template>

<script setup>
import { computed, reactive, watch } from 'vue'
import AqlFileUpload from 'components/shared/AqlFileUpload.vue'

const props = defineProps({
  // Action Form props
  isMultiOutcome: { type: Boolean, default: false },
  outcomeOptions: { type: Array, default: () => [] },
  selectedOutcome: { type: String, default: '' },
  resolvedActionFields: { type: Array, default: () => [] },
  actionForm: { type: Object, default: () => ({}) },

  // Record Form props
  code: { type: String, default: '' },
  resolvedFields: { type: Array, default: () => [] },
  parentForm: { type: Object, default: () => ({}) },
  childGroups: { type: Array, default: () => [] },
  statusOptions: { type: Array, default: () => [] },
  resourceName: { type: String, default: '' },

  // Configuration
  formConfig: { type: Object, default: () => ({}) }
})

const emit = defineEmits([
  'update:selectedOutcome',
  'update:actionField',
  'update:field',
  'add-child',
  'remove-child',
  'update-child-field'
])

const isActionForm = computed(() => {
  return props.isMultiOutcome || (props.resolvedActionFields && props.resolvedActionFields.length > 0)
})

const outcomeSelectOptions = computed(() => {
  return props.outcomeOptions.map((opt) => ({
    label: opt.replace(/([a-z])([A-Z])/g, '$1 $2'),
    value: opt
  }))
})

// Configuration Settings
const activeConfig = computed(() => {
  return {
    bordered: true,
    flat: true,
    class: '',
    columns: 1,
    sections: null,
    fieldConfigs: {},
    hideFields: [],
    disableChildRemove: false,
    ...(props.formConfig || {})
  }
})

// Fields resolution depending on form context
const baseFieldsList = computed(() => {
  if (isActionForm.value) {
    return props.resolvedActionFields || []
  }
  return props.resolvedFields || []
})

// Filter and map fields configurations
const processedFields = computed(() => {
  return baseFieldsList.value
    .filter((f) => !activeConfig.value.hideFields.includes(f.header))
    .map((f) => {
      const custom = activeConfig.value.fieldConfigs[f.header] || {}
      return {
        ...f,
        label: custom.label !== undefined ? custom.label : f.label,
        placeholder: custom.placeholder || f.placeholder || '',
        type: custom.type || f.type || 'text',
        readonly: custom.readonly !== undefined ? custom.readonly : f.readonly,
        hint: custom.hint || f.hint || '',
        class: custom.class || '',
        required: custom.required !== undefined ? custom.required : f.required,
        options: custom.options || f.options || []
      }
    })
})

// Section definition mapping
const formSections = computed(() => {
  const sectionsDef = activeConfig.value.sections
  const fields = processedFields.value

  if (!sectionsDef) {
    return [{
      title: '',
      fields: fields,
      columns: activeConfig.value.columns || 1
    }]
  }

  const resolved = []
  const usedHeaders = new Set()

  sectionsDef.forEach((sec) => {
    const secFields = fields.filter((f) => sec.fields.includes(f.header))
    secFields.forEach((f) => usedHeaders.add(f.header))
    resolved.push({
      title: sec.title || '',
      collapsible: !!sec.collapsible,
      collapsed: !!sec.collapsed,
      columns: sec.columns || activeConfig.value.columns || 1,
      fields: secFields
    })
  })

  const leftoverFields = fields.filter((f) => !usedHeaders.has(f.header))
  if (leftoverFields.length > 0) {
    resolved.push({
      title: 'General Information',
      columns: activeConfig.value.columns || 1,
      fields: leftoverFields
    })
  }

  return resolved
})

// Collapsible collapsible state management
const collapsedState = reactive({})

watch(
  formSections,
  (secs) => {
    secs.forEach((sec, idx) => {
      if (sec.collapsible && collapsedState[idx] === undefined) {
        collapsedState[idx] = !!sec.collapsed
      }
    })
  },
  { immediate: true }
)

function toggleSection(idx) {
  collapsedState[idx] = !collapsedState[idx]
}

function updateFieldValue(header, val) {
  if (isActionForm.value) {
    emit('update:actionField', header, val)
  } else {
    emit('update:field', header, val)
  }
}

function getGridStyle(cols) {
  if (cols > 1) {
    return {
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
      gap: '0px 16px'
    }
  }
  return {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  }
}
</script>

<style scoped>
.form-card {
  border-radius: 16px;
  border-color: var(--aql-border);
  background: rgba(255, 255, 255, 0.95);
  animation: rise-in 280ms ease-out both;
}
.field-label { font-size: 13px; font-weight: 600; color: #475569; }
.field-item { min-width: 0; }
@keyframes rise-in {
  0% { transform: translateY(10px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
</style>
