# AQL Content Layout & Customization System

This document is the complete reference guide for the AQL Content Customization System. It explains the dual-model configuration architecture, fallback components, page orchestrators, and all available configuration parameters used to customize resource screens (Index, View, Add, Edit, Action) without writing full HTML/Vue templates.

---

## 1. System Architecture

AQL pages resolve their inner contents using page orchestrator shells:
- **Index Page**: Resolves `src/components/_common/Index/Content.vue`
- **View Page**: Resolves `src/components/_common/View/Content.vue`
- **Add Page**: Resolves `src/components/_common/Add/Content.vue`
- **Edit Page**: Resolves `src/components/_common/Edit/Content.vue`
- **Action Page**: Resolves `src/components/_common/Action/Content.vue`

These orchestrator shells dynamically look for custom folder overrides at `src/components/[Scope]/[ResourceName]/` using AQL's 12-tier resolution logic.

### The Dual-Model Resolution Pattern
When resolving a section (like `Content`, `Records`, `Details`, `Form`), the resolver checks if the resolved component is a **Template Override** or a **Script-Only Configuration**:
1. **Template Override**: If the resolved file contains a `<template>` block (yielding compilation render functions), it is rendered directly as a Vue SFC, completely taking over the DOM.
2. **Script-Only Configuration**: If the resolved file only contains a `<script>` or `<script setup>` block with configuration objects and no `<template>`, the orchestrator intercepts the file, extracts the exported `config` object, and merges it into the parameters of the fallback leaf components (`Records.vue`, `Details.vue`, `Parent.vue`, `Form.vue`).

---

## 2. Page Configuration Schemas

### 2.1 Index Page: Records Listing (`Records.vue` & `RecordsRecord.vue`)
Custom script-only file created at `src/components/[Scope]/[Resource]/Index/Content.vue` or `Records.vue`.

#### Config Schema (`Records.vue` Wrapper)
| Parameter | Type | Default | Description |
|---|---|---|---|
| `layout` | `'list' \| 'grid'` | `'list'` | Layout format of the records list. |
| `gridCols` | `number` | `2` | Number of columns when `layout` is `'grid'`. |
| `bordered` | `boolean` | `true` | Show card border wrapper. |
| `flat` | `boolean` | `true` | Render card flat (no shadow). |
| `class` | `string` | `''` | Additional styling classes applied to the list wrapper. |
| `noChildCounts` | `boolean` | `false` | Hide badge showing counts of child items. |
| `record` | `object` | `{}` | Inner configuration for individual items. |

#### Config Schema (`record` Card Detail)
| Parameter | Type | Default | Description |
|---|---|---|---|
| `primary` | `string \| function(row)` | `'Name'` | Field header or evaluator function returning the main bold label. |
| `secondary` | `string \| function(row)` | `'Code'` | Field header or evaluator function returning secondary text details. |
| `codeVisible` | `boolean` | `true` | Show or hide the Code pill next to the name. |
| `chip` | `string \| function(row)` | `null` | Field header or evaluator function returning the status badge text. |
| `chipColor` | `string \| function(val, row)` | `'primary'` | Quasar color name (e.g. `'positive'`, `'grey'`) for status badge background. |
| `chipTextColor` | `string \| function(val, row)` | `'white'` | Color name for chip text. |
| `icon` | `string \| function(row)` | `null` | Material design icon name (e.g., `'inventory'`, `'cloud'`) to render in the left avatar. |

#### Example Listing Configuration
```vue
<!-- src/components/Masters/Products/Index/Records.vue -->
<script>
export const config = {
  layout: 'grid',
  gridCols: 3,
  bordered: false,
  class: 'product-grid-shaded',
  record: {
    primary: 'Name',
    secondary: (row) => `SKU: ${row.SkuCode} | Price: $${row.Price}`,
    codeVisible: false,
    chip: 'Status',
    chipColor: (val) => val === 'Active' ? 'positive' : 'grey',
    icon: (row) => row.Type === 'Physical' ? 'inventory_2' : 'cloud_done'
  }
}
</script>
```

---

### 2.2 View Page: Details & Parent Cards (`Details.vue` & `Parent.vue`)
Custom script-only files created at `src/components/[Scope]/[Resource]/View/Details.vue` or `Parent.vue`.

#### Details Card Schema (`Details.vue`)
| Parameter | Type | Default | Description |
|---|---|---|---|
| `title` | `string` | `'Details'` | Header text displayed on the details card. |
| `columns` | `number` | `1` | Number of columns in the responsive grid (supports `1`, `2`, `3`). |
| `fields` | `string[]` | *All visible fields* | Explicit array of field headers to display, in order. |
| `fieldLabels` | `object` | `{}` | Key-value mapping of field headers to custom text labels. |

#### Parent Card Schema (`Parent.vue`)
| Parameter | Type | Default | Description |
|---|---|---|---|
| `title` | `string` | `'Parent'` | Custom header title for the parent resource card. |
| `fields` | `string[]` | *None* | Explicit fields list to show in a key-value detail list (Case B). If omitted, displays default name link (Case A). |
| `actionLabel` | `string` | `'View [Name]'` | Custom label text for the view parent navigation button. |

#### Example Details & Parent Configuration
```vue
<!-- src/components/Masters/Products/View/Details.vue -->
<script>
export const config = {
  title: 'Product Specifications',
  columns: 2,
  fields: ['Name', 'SkuCode', 'Type', 'Price'],
  fieldLabels: {
    SkuCode: 'Stock Keeping Unit',
    Price: 'MSRP (USD)'
  }
}
</script>
```

```vue
<!-- src/components/Operations/OutletConsumptions/View/Parent.vue -->
<script>
export const config = {
  title: 'Source Restock Order',
  fields: ['Code', 'OrderDate', 'CreatedBy'],
  actionLabel: 'Check Restock Details'
}
</script>
```

---

### 2.3 Add, Edit, & Action Forms (`Form.vue`)
Custom script-only file created at `src/components/[Scope]/[Resource]/Add/Form.vue`, `Edit/Form.vue`, or `Action/Form.vue` (resolving as action fields).

#### Form Configuration Schema (`Form.vue`)
| Parameter | Type | Default | Description |
|---|---|---|---|
| `flat` | `boolean` | `true` | Render form card flat. |
| `bordered` | `boolean` | `true` | Show form card borders. |
| `class` | `string` | `''` | CSS class string added to form card wrapper. |
| `columns` | `number` | `1` | Default number of columns for fields in the grid layout. |
| `disableChildRemove` | `boolean` | `false` | Hide delete buttons on editable children lists. |
| `hideFields` | `string[]` | `[]` | List of field headers to completely hide from inputs. |
| `fieldConfigs` | `object` | `{}` | Key-value map of field configurations. |
| `sections` | `object[]` | *Flat list* | Layout fields in collapsible or static groupings. |

#### Config Schema (`fieldConfigs` Item)
| Parameter | Type | Default | Description |
|---|---|---|---|
| `label` | `string` | *Humanized header* | Input field label. |
| `placeholder` | `string` | `''` | Input placeholder text. |
| `type` | `'text' \| 'textarea' \| 'number' \| 'date' \| 'select' \| 'file'` | `'text'` | HTML/Quasar input control type. |
| `readonly` | `boolean` | `false` | Disable input adjustments. |
| `required` | `boolean` | `false` | Marks field with red asterisk. |
| `hint` | `string` | `''` | Help/description hint text below input. |
| `class` | `string` | `''` | CSS grid span classes (e.g. `'col-span-2'`). |
| `options` | `Array<{label, value}>` | `[]` | Dropdown option list for `'select'` controls. |

#### Config Schema (`sections` Item)
| Parameter | Type | Default | Description |
|---|---|---|---|
| `title` | `string` | `''` | Heading title for this group of fields. |
| `fields` | `string[]` | `[]` | Fields list to contain in this section. |
| `columns` | `number` | `1` | Override columns count for fields in this group. |
| `collapsible` | `boolean` | `false` | Enable collapse toggle on header click. |
| `collapsed` | `boolean` | `false` | Start section collapsed. |

*Note: Any fields in the metadata that are not mapped in `sections` are grouped into a "General Information" section at the bottom of the card.*

#### Example Form Configuration
```vue
<!-- src/components/Masters/Products/Add/Form.vue -->
<script>
export const config = {
  columns: 2,
  hideFields: ['CreatedBy', 'ModifiedBy'],
  sections: [
    {
      title: 'General Info',
      fields: ['Name', 'SkuCode', 'Price'],
      columns: 2
    },
    {
      title: 'System Settings',
      fields: ['Status', 'TaxRate'],
      collapsible: true,
      collapsed: true
    }
  ],
  fieldConfigs: {
    Price: {
      label: 'Unit price (USD) *',
      placeholder: '0.00',
      type: 'number'
    },
    Notes: {
      type: 'textarea',
      hint: 'Internal notes for products'
    }
  }
}
</script>
```

---

## 3. Order & Visibility Control in View Pages

At the page content orchestrator level (`View/Content.vue`), resource custom script configurations can manage sections sequence:
- **`order`**: Array of sections (`'Details'`, `'Parent'`, `'Children'`, `'Audit'`) defining their DOM ordering.
- **`hide`**: Array of sections to completely exclude from rendering.

#### Example:
```vue
<!-- src/components/Operations/OutletConsumptions/View/Content.vue -->
<script>
export const config = {
  order: ['Children', 'Details', 'Parent'], // Move children grid to top
  hide: ['Audit', 'Parent']                 // Hide audit logs and parent fields card
}
</script>
```
