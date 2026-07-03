# AQL Content Component Guide

## Overview

The **Content component** (`src/components/_common/Content.vue`) is a unified, fully-customizable orchestrator that houses three essential subsections:
- **List** - Display records in a clickable list/grid
- **Form** - Edit/create records with custom fields
- **Detail** - View record details read-only

Each subsection is independently overridable via local custom components or JavaScript logic modifiers.

---

## Architecture

### File Structure
```
src/components/_common/
├── Content.vue                              (Main orchestrator)
└── sections/Content/
    ├── List.vue                             (List subsection)
    ├── Form.vue                             (Form subsection)
    ├── Detail.vue                           (Detail subsection)
    ├── RecordsRecord.vue                    (List item renderer)
    ├── Records.vue                          (Legacy - still supported)
    └── [other sections]
```

### Component Hierarchy

```
Content.vue (Main Orchestrator)
├── Resolves own override via useSectionResolver
├── Statically Imports List, Form, Detail
└── Conditionally Renders:
    ├── List
    │   ├── Resolves own List override
    │   └── Renders AqlList + RecordsRecord
    ├── Form
    │   ├── Uses custom field renderer (formFieldRender prop)
    │   └── Renders dense fields with collapsible sections
    └── Detail
        ├── Uses custom item renderer (detailItemRender prop)
        └── Renders read-only details with enhanced styling
```

---

## Usage

### 1. Import & Basic Usage

```vue
<template>
  <Content
    :active-mode="activeMode"
    :page="'Index'"
    :list-props="listProps"
    :form-props="formProps"
    :detail-props="detailProps"
    @navigate-to-view="handleNavigateToView"
    @update:field="handleUpdateField"
  />
</template>

<script setup>
import Content from 'components/_common/Content.vue'

const activeMode = ref(null) // Auto-detect based on page
const listProps = computed(() => ({
  items: records.value,
  loading: loading.value,
  resolvedFields: fields.value,
  resourceSlug: 'Product',
  customUIName: 'Products',
  childCountMap: {}
}))

const formProps = computed(() => ({
  code: record.value?.Code || '',
  resolvedFields: fields.value,
  parentForm: form.value,
  childGroups: [],
  statusOptions: statusOptions.value,
  resourceName: 'Product'
}))

const detailProps = computed(() => ({
  record: record.value,
  resolvedFields: fields.value,
  resourceName: 'Product'
}))
</script>
```

### 2. Mode Control

**Manual Mode Selection:**
```vue
<Content
  active-mode="list"          <!-- Force show List -->
  :page="'Index'"
  :list-props="listProps"
/>
```

**Auto Mode Selection (default):**
```vue
<Content
  :active-mode="null"         <!-- null = auto-detect -->
  :page="'Add'"               <!-- Page='Add' → shows Form -->
  :form-props="formProps"
/>
```

| Page | Auto Mode |
|------|-----------|
| Index | list |
| View | detail |
| Add | form |
| Edit | form |
| Action | form |

### 3. Custom Field Rendering in Form

```vue
<Content
  :form-props="formProps"
  page="Add"
/>
```

**With Custom Field Renderer:**
```vue
<script setup>
function customFieldRender(field, context) {
  // field: field definition
  // context: { parentForm, actionForm, code, isActionForm }
  
  if (field.header === 'Price') {
    return defineComponent({
      template: `
        <div class="price-field">
          <q-input
            :model-value="modelValue"
            @update:model-value="$emit('update:model-value', $event)"
            prefix="₹"
            dense outlined
          />
        </div>
      `
    })
  }
  
  return null // Use default renderer
}

const formProps = computed(() => ({
  // ... other props
  formFieldRender: customFieldRender
}))
</script>
```

### 4. Custom Detail Item Rendering

```vue
<script setup>
function customDetailItemRender(field, record) {
  if (field.header === 'Status') {
    return defineComponent({
      template: `
        <q-badge
          :color="record.Status === 'Active' ? 'green' : 'grey'"
          :label="record.Status"
        />
      `
    })
  }
  
  return null // Use default renderer
}

const detailProps = computed(() => ({
  // ... other props
  detailItemRender: customDetailItemRender
}))
</script>
```

### 5. List Item Click Navigation

List items are **clickable by default** and emit `navigate-to-view` event:

```vue
<Content
  :list-props="listProps"
  @navigate-to-view="handleNavigateToView"
/>

<script setup>
function handleNavigateToView(item) {
  // item = clicked record
  router.push({
    name: 'ResourceView',
    params: {
      scope: route.params.scope,
      resource: route.params.resource,
      code: item.Code
    }
  })
}
</script>
```

---

## Configuration

### List Configuration

```javascript
const listProps = {
  items: [],
  resolvedFields: [],
  resourceSlug: 'Product',
  customUIName: 'Products',
  childCountMap: {},
  listConfig: {
    layout: 'list',           // 'list' or 'grid'
    gridCols: 2,             // Grid columns if layout='grid'
    bordered: true,
    flat: true,
    emptyMessage: 'No records found',
    noChildCounts: false
  }
}
```

### Form Configuration

```javascript
const formProps = {
  code: '',
  resolvedFields: [],
  parentForm: {},
  childGroups: [],
  statusOptions: [],
  resourceName: 'Product',
  formConfig: {
    columns: 2,              // Column layout
    sections: [              // Group fields into sections
      {
        title: 'Basic Info',
        fields: ['Name', 'Code'],
        collapsible: false,
        columns: 1
      },
      {
        title: 'Advanced',
        fields: ['CustomField1', 'CustomField2'],
        collapsible: true,
        collapsed: true
      }
    ],
    fieldConfigs: {          // Per-field configuration
      'Price': {
        type: 'number',
        label: 'Price (₹)',
        placeholder: '0.00',
        required: true
      }
    },
    hideFields: ['InternalField'],
    disableChildRemove: false
  },
  formFieldRender: customFieldRender  // Function
}
```

### Detail Configuration

```javascript
const detailProps = {
  record: {},
  resolvedFields: [],
  resourceName: 'Product',
  detailsConfig: {
    title: 'Product Details',
    columns: 2,              // Column layout
    fields: ['Code', 'Name', 'Price'],  // Specific fields only
    fieldLabels: {           // Custom labels
      'Code': 'Product Code',
      'Price': 'Selling Price'
    }
  },
  detailItemRender: customDetailItemRender  // Function
}
```

---

## Customization

### Override via Local Component

Create a custom component to override any subsection:

**Override List:**
```vue
<!-- src/pages/resources/Product/Index/List.vue -->
<template>
  <div class="custom-list">
    <q-list>
      <q-item v-for="item in items" :key="item.Code">
        <q-item-section>{{ item.Name }}</q-item-section>
      </q-item>
    </q-list>
  </div>
</template>

<script setup>
defineProps({
  items: Array,
  // ... all props from CommonList
})
</script>
```

**Override Form:**
```vue
<!-- src/pages/resources/Product/Add/Form.vue -->
<template>
  <div class="custom-form">
    <!-- Your custom form layout -->
  </div>
</template>
```

**Override Detail:**
```vue
<!-- src/pages/resources/Product/View/Detail.vue -->
<template>
  <div class="custom-detail">
    <!-- Your custom detail layout -->
  </div>
</template>
```

### Override via JavaScript Logic

Pass custom renderers as functions:

```vue
<script setup>
// Custom field renderer for Form
const formFieldRender = (field, context) => {
  if (field.header === 'Category') {
    return CategoryFieldComponent
  }
  if (field.type === 'file') {
    return CustomFileUploadComponent
  }
  return null // Use default
}

// Custom detail item renderer
const detailItemRender = (field, record) => {
  if (field.header === 'Price') {
    return PriceDisplayComponent
  }
  return null // Use default
}

const formProps = { formFieldRender }
const detailProps = { detailItemRender }
</script>
```

---

## Events & Data Flow

### Form Events

```vue
<Content
  @update:field="handleUpdateField"
  @update:actionField="handleUpdateActionField"
  @update:selectedOutcome="handleUpdateOutcome"
  @add-child="handleAddChild"
  @remove-child="handleRemoveChild"
  @update-child-field="handleUpdateChildField"
/>

<script setup>
function handleUpdateField(header, value) {
  // Update form[header] = value
}

function handleUpdateActionField(header, value) {
  // Update actionForm[header] = value
}

function handleUpdateOutcome(outcome) {
  // Update selectedOutcome = outcome
}

function handleAddChild(groupName) {
  // Add new child record to group
}

function handleRemoveChild(groupName, index) {
  // Remove child at index from group
}

function handleUpdateChildField(groupName, index, header, value) {
  // Update childGroups[groupName][index][header] = value
}
</script>
```

### List Navigation

```vue
<Content
  @navigate-to-view="handleNavigateToView"
/>

<script setup>
function handleNavigateToView(item) {
  // item = clicked record { Code, Name, ... }
  router.push({
    name: 'ResourceView',
    params: {
      scope: currentScope,
      resource: currentResource,
      code: item.Code
    }
  })
}
</script>
```

---

## Styling & Appearance

### Form Styling
- **Border Radius**: 8px (rounded, modern look)
- **Background**: Gradient (white to light blue)
- **Field Gaps**: 4px (dense, compact)
- **Section Spacing**: Minimal padding
- **Shadow**: Subtle box-shadow

### Detail Styling
- **Border Radius**: 8px
- **Background**: Gradient
- **Field Labels**: Uppercase with accent bar
- **Separators**: Dashed lines
- **Column Gap**: 24px

### List Styling
- **Hover Effects**: Light background change on hover
- **Click Feedback**: Cursor pointer, ripple effect
- **Layout**: Flexible grid/list support
- **Border Radius**: 16px

---

## Best Practices

### 1. Keep Props Computed
Always derive `listProps`, `formProps`, `detailProps` from reactive data using `computed()`:

```vue
const listProps = computed(() => ({
  items: records.value,
  loading: loading.value,
  // ...
}))
```

### 2. Use Scoped Event Handlers
Bind events to handler functions, not inline:

```vue
<!-- ✓ Good -->
@update:field="handleUpdateField"
@navigate-to-view="handleNavigateToView"

<!-- ✗ Avoid -->
@update:field="form[arguments[0]] = arguments[1]"
```

### 3. Leverage Function Props
Use `formFieldRender` and `detailItemRender` for per-field customization instead of overriding entire components:

```vue
<!-- ✓ Better -->
:form-field-render="customFieldRender"

<!-- ✗ More invasive -->
<!-- Create full custom Form.vue component -->
```

### 4. Page Prop for Context
Always pass the correct `page` prop so override resolution works:

```vue
<Content
  page="Add"           <!-- Triggers Add-page specific overrides -->
  :form-props="formProps"
/>
```

---

## Migration from Old Components

### From Old Records.vue to List
```vue
<!-- Before -->
<Records
  :items="items"
  :resolved-fields="fields"
/>

<!-- After -->
<Content
  page="Index"
  :list-props="{ items, resolvedFields: fields }"
/>
```

### From Old Form.vue to Form
```vue
<!-- Before -->
<Form
  :resolved-fields="fields"
  :parent-form="form"
/>

<!-- After -->
<Content
  page="Add"
  :form-props="{ resolvedFields: fields, parentForm: form }"
/>
```

### From Old Details.vue to Detail
```vue
<!-- Before -->
<Details
  :details-config="config"
/>

<!-- After -->
<Content
  page="View"
  :detail-props="{ record, detailsConfig: config }"
/>
```

---

## Troubleshooting

### List items not clickable
- Ensure `clickable` is not explicitly set to `false` in `listConfig`
- Check `@navigate-to-view` event handler is bound

### Form fields not showing
- Verify `resolvedFields` is populated
- Check `formConfig.hideFields` doesn't include field
- Ensure field type matches one of: text, number, date, select, textarea, file

### Detail items not rendering
- Verify `record` object has data
- Check `resolvedFields` includes field headers
- Ensure field exists in record object

### Custom renderers not firing
- Ensure function is passed correctly (not string)
- Check function returns valid component or null
- Verify field header/type matches condition

---

## Summary

The **Content component** provides a unified, flexible interface for list, form, and detail views. It supports:
- ✅ Automatic mode detection based on page
- ✅ Full customization via local components or function props
- ✅ Clickable list items with navigation
- ✅ Dense, attractive form styling
- ✅ Enhanced detail view with field labels and accent styling
- ✅ Child record management
- ✅ Multi-column layouts
- ✅ Custom field/item rendering

Use it as a drop-in replacement for old Records, Form, and Details components while enjoying powerful new customization options!
