# Content Component - Usage Examples

## Example 1: Basic List Page (Index)

```vue
<template>
  <div class="page-container">
    <CommonContent
      page="Index"
      :list-props="listProps"
      @navigate-to-view="handleNavigateToView"
    />
  </div>
</template>

<script setup>
import { computed, ref, inject } from 'vue'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import CommonContent from 'components/_common/Content.vue'

const nav = useResourceNav()
const { resourceSlug, resolvedFields } = inject('resourceConfig')
const { filteredItems } = inject('resourceRecord')

const listProps = computed(() => ({
  items: filteredItems.value,
  loading: false,
  resolvedFields: resolvedFields.value,
  childCountMap: {},
  resourceSlug: resourceSlug.value,
  customUIName: resourceSlug.value,
  listConfig: {
    layout: 'list',
    emptyMessage: 'No records found'
  }
}))

function handleNavigateToView(item) {
  nav.goTo('view', { code: item.Code })
}
</script>
```

---

## Example 2: Form Page with Custom Field Renderer (Add)

```vue
<template>
  <div class="page-container">
    <CommonContent
      page="Add"
      :form-props="formProps"
      @update:field="handleUpdateField"
      @add-child="handleAddChild"
      @remove-child="handleRemoveChild"
      @update-child-field="handleUpdateChildField"
    />
  </div>
</template>

<script setup>
import { computed, ref, inject } from 'vue'
import CommonContent from 'components/_common/Content.vue'

const { resourceSlug, resolvedFields } = inject('resourceConfig')
const form = ref({})
const childGroups = ref([])

// Custom field renderer
function customFieldRender(field, context) {
  // Render Price with currency symbol
  if (field.header === 'Price') {
    return defineComponent({
      template: `
        <div class="currency-field">
          <q-input
            :model-value="modelValue"
            @update:model-value="$emit('update:model-value', $event)"
            prefix="₹"
            type="number"
            step="0.01"
            dense outlined
            placeholder="0.00"
          />
        </div>
      `
    })
  }

  // Render Category with custom options
  if (field.header === 'Category') {
    return defineComponent({
      template: `
        <q-select
          :model-value="modelValue"
          @update:model-value="$emit('update:model-value', $event)"
          :options="['Electronics', 'Furniture', 'Books', 'Other']"
          label="Category"
          dense outlined emit-value
        />
      `
    })
  }

  return null // Use default
}

const formProps = computed(() => ({
  code: '',
  resolvedFields: resolvedFields.value,
  parentForm: form.value,
  childGroups: childGroups.value,
  statusOptions: ['Active', 'Inactive'],
  resourceName: resourceSlug.value,
  formConfig: {
    columns: 2,
    sections: [
      {
        title: 'Basic Information',
        fields: ['Name', 'Code', 'Price'],
        collapsible: false,
        columns: 2
      },
      {
        title: 'Advanced Settings',
        fields: ['Category', 'Description'],
        collapsible: true,
        collapsed: true,
        columns: 1
      }
    ]
  },
  formFieldRender: customFieldRender
}))

function handleUpdateField(header, value) {
  form.value[header] = value
}

function handleAddChild(groupName) {
  if (!childGroups.value.find(g => g.name === groupName)) {
    childGroups.value.push({
      name: groupName,
      label: groupName,
      records: [],
      fields: []
    })
  }
  childGroups.value
    .find(g => g.name === groupName)
    .records.push({})
}

function handleRemoveChild(groupName, index) {
  const group = childGroups.value.find(g => g.name === groupName)
  if (group) group.records.splice(index, 1)
}

function handleUpdateChildField(groupName, index, header, value) {
  const group = childGroups.value.find(g => g.name === groupName)
  if (group && group.records[index]) {
    group.records[index][header] = value
  }
}
</script>
```

---

## Example 3: View Page with Custom Detail Renderer (View)

```vue
<template>
  <div class="page-container">
    <CommonContent
      page="View"
      :detail-props="detailProps"
    />
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import CommonContent from 'components/_common/Content.vue'

const { resourceSlug, resolvedFields } = inject('resourceConfig')
const { record } = inject('resourceRecord')

// Custom detail item renderer
function customDetailItemRender(field, recordData) {
  // Render Status as colored badge
  if (field.header === 'Status') {
    return defineComponent({
      props: ['field', 'record'],
      template: `
        <q-badge
          :color="record.Status === 'Active' ? 'positive' : 'grey'"
          :label="record.Status"
          text-color="white"
        />
      `
    })
  }

  // Render Price with currency formatting
  if (field.header === 'Price') {
    return defineComponent({
      props: ['field', 'record'],
      template: `
        <span class="text-weight-bold text-primary">
          ₹{{ formatCurrency(record.Price) }}
        </span>
      `,
      setup() {
        const formatCurrency = (val) => {
          if (!val) return '0.00'
          return parseFloat(val).toFixed(2)
        }
        return { formatCurrency }
      }
    })
  }

  // Render date fields as formatted dates
  if (field.type === 'date' && recordData[field.header]) {
    return defineComponent({
      props: ['field', 'record'],
      template: `
        <span>{{ formatDate(record[field.header]) }}</span>
      `,
      setup() {
        const formatDate = (dateStr) => {
          return new Date(dateStr).toLocaleDateString('en-IN')
        }
        return { formatDate }
      }
    })
  }

  return null // Use default
}

const detailProps = computed(() => ({
  record: record.value,
  resolvedFields: resolvedFields.value,
  resourceName: resourceSlug.value,
  detailsConfig: {
    title: 'Product Details',
    columns: 2,
    fields: ['Code', 'Name', 'Price', 'Status', 'CreatedDate'],
    fieldLabels: {
      'Code': 'Product Code',
      'Price': 'Selling Price',
      'CreatedDate': 'Created On'
    }
  },
  detailItemRender: customDetailItemRender
}))
</script>
```

---

## Example 4: Edit Page with Validation

```vue
<template>
  <div class="page-container">
    <CommonContent
      page="Edit"
      :form-props="formProps"
      @update:field="handleUpdateField"
    />
  </div>
</template>

<script setup>
import { computed, ref, inject } from 'vue'
import CommonContent from 'components/_common/Content.vue'

const { resourceSlug, resolvedFields, scope } = inject('resourceConfig')
const { record } = inject('resourceRecord')

const form = ref({})

// Watch record and initialize form
watch(
  () => record.value,
  (newRecord) => {
    if (newRecord) {
      form.value = { ...newRecord }
    }
  },
  { immediate: true }
)

const formProps = computed(() => ({
  code: record.value?.Code || '',
  resolvedFields: resolvedFields.value,
  parentForm: form.value,
  childGroups: [],
  statusOptions: ['Active', 'Inactive'],
  resourceName: resourceSlug.value,
  formConfig: {
    columns: 1,
    fieldConfigs: {
      'Name': {
        required: true,
        hint: 'Product name is required'
      },
      'Price': {
        type: 'number',
        required: true,
        placeholder: '0.00'
      },
      'Code': {
        readonly: true,
        hint: 'Code cannot be changed'
      }
    }
  }
}))

function handleUpdateField(header, value) {
  form.value[header] = value
  // Optional: validate field
  validateField(header, value)
}

function validateField(header, value) {
  if (header === 'Price' && (value < 0 || !value)) {
    console.warn('Price must be greater than 0')
  }
  if (header === 'Name' && !value) {
    console.warn('Name is required')
  }
}

import { watch } from 'vue'
</script>
```

---

## Example 5: Action Page with Multiple Outcomes

```vue
<template>
  <div class="page-container">
    <CommonContent
      page="Action"
      :form-props="formProps"
      @update:selected-outcome="handleUpdateOutcome"
      @update:action-field="handleUpdateActionField"
    />
  </div>
</template>

<script setup>
import { computed, ref, inject } from 'vue'
import CommonContent from 'components/_common/Content.vue'

const { resourceSlug, resolvedFields } = inject('resourceConfig')
const { record } = inject('resourceRecord')

const selectedOutcome = ref('')
const actionForm = ref({})

// Action with multiple outcomes
const outcomeOptions = ref(['Approve', 'Reject', 'SendForReview'])

const actionFields = {
  'Approve': [
    { header: 'ApprovalNotes', label: 'Approval Notes', type: 'textarea' },
    { header: 'ApprovedBy', label: 'Approved By', type: 'text', readonly: true }
  ],
  'Reject': [
    { header: 'RejectionReason', label: 'Rejection Reason', type: 'textarea', required: true },
    { header: 'RejectedBy', label: 'Rejected By', type: 'text', readonly: true }
  ],
  'SendForReview': [
    { header: 'Reviewer', label: 'Reviewer', type: 'select', options: ['User1', 'User2'] },
    { header: 'ReviewNotes', label: 'Review Notes', type: 'textarea' }
  ]
}

const formProps = computed(() => ({
  isMultiOutcome: true,
  outcomeOptions: outcomeOptions.value,
  selectedOutcome: selectedOutcome.value,
  resolvedActionFields: actionFields[selectedOutcome.value] || [],
  actionForm: actionForm.value,
  resourceName: resourceSlug.value,
  formConfig: {
    columns: 1
  }
}))

function handleUpdateOutcome(outcome) {
  selectedOutcome.value = outcome
  actionForm.value = {} // Reset form
}

function handleUpdateActionField(header, value) {
  actionForm.value[header] = value
}
</script>
```

---

## Example 6: Grid Layout for List

```vue
<template>
  <div class="page-container">
    <CommonContent
      page="Index"
      :list-props="listProps"
      @navigate-to-view="handleNavigateToView"
    />
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import CommonContent from 'components/_common/Content.vue'

const { resourceSlug, resolvedFields } = inject('resourceConfig')
const { filteredItems } = inject('resourceRecord')

const listProps = computed(() => ({
  items: filteredItems.value,
  loading: false,
  resolvedFields: resolvedFields.value,
  childCountMap: {},
  resourceSlug: resourceSlug.value,
  customUIName: resourceSlug.value,
  listConfig: {
    layout: 'grid',      // ← Grid layout
    gridCols: 3,         // ← 3 columns
    emptyMessage: 'No records found'
  }
}))

function handleNavigateToView(item) {
  // Navigate to view
}
</script>
```

---

## Example 7: Resource-Specific Custom Components

Create a custom List component that overrides the default:

```vue
<!-- src/pages/resources/Product/Index/List.vue -->
<template>
  <q-list bordered separator>
    <q-item
      v-for="item in items"
      :key="item.Code"
      clickable
      @click="$emit('click', item)"
    >
      <q-item-section avatar>
        <q-avatar :icon="'shopping_cart'" color="primary" text-color="white" />
      </q-item-section>
      <q-item-section>
        <q-item-label>{{ item.Name }}</q-item-label>
        <q-item-label caption>SKU: {{ item.Code }}</q-item-label>
      </q-item-section>
      <q-item-section side>
        <q-badge color="green">{{ item.Price }}</q-badge>
      </q-item-section>
    </q-item>
  </q-list>
</template>

<script setup>
defineProps({
  items: Array,
  loading: Boolean,
  // ... all props from CommonList
})

defineEmits(['navigate-to-view'])
</script>
```

This custom List will be automatically used instead of the default when rendering Product/Index page.

---

## Key Takeaways

1. **Unified Interface**: Use Content component for all list/form/detail views
2. **Auto Mode**: Page prop automatically determines which subsection to show
3. **Custom Renderers**: Use function props for per-field customization
4. **Full Overrides**: Create resource-specific components for complete customization
5. **Event Handling**: Bind all events to handler functions
6. **Computed Props**: Always derive props from reactive data
7. **Navigation**: List items automatically navigate on click
8. **Styling**: All subsections have attractive, modern styling by default

