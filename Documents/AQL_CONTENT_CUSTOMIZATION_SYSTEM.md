# AQL Content Layout & Customization System

This document is the complete reference guide for the AQL Content Customization System. It explains the decentralized custom template and logic modifier architecture, fallback components, page orchestrators, and all available configuration parameters used to customize resource screens (Index, View, Add, Edit, Action) without rewriting full HTML/Vue templates.

---

## 1. System Architecture

AQL pages resolve their inner contents using page orchestrator shells:
- **Index Page**: Resolves [Index/Content.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/_common/Index/Content.vue)
- **View Page**: Resolves [View/Content.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/_common/View/Content.vue)
- **Add Page**: Resolves [Add/Content.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/_common/Add/Content.vue)
- **Edit Page**: Resolves [Edit/Content.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/_common/Edit/Content.vue)
- **Action Page**: Resolves [Action/Content.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/_common/Action/Content.vue)

These orchestrator shells dynamically look for custom folder overrides at `src/components/[Scope]/[ResourceName]/` using [useSectionResolver.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/resources/useSectionResolver.js).

### Custom Templates vs. JS Logic Modifiers
When resolving a section (like `Content`, `Records`, `Details`, `Form`), the resolver checks for:
1. **Vue Template Override (`.vue` file)**: Checked across all Tiers 1-8. It must contain a `<template>` block. If found, it completely takes over layout rendering. Vue components without a template are **strictly forbidden**.
2. **JS Logic Modifier (`.js` file)**: Checked **only** at Tiers 7 & 8 (entity-local). It exports a default function `(props) => modifiedProps` that intercepts and adjusts the properties fed to the fallback template component (`Records.vue`, `Details.vue`, `Parent.vue`, `Form.vue`).

---

## 2. Page Configuration Schemas (via JS Modifiers)

### 2.1 Index Page: Records Listing (`Records.js` / `Records.vue`)
Custom JS logic modifier created at `src/components/[Scope]/[Resource]/Index/Records.js` or `src/components/[Scope]/[Resource]/Records.js`.

#### Config Schema (`Records.vue` Props)
| Parameter | Type | Default | Description |
|---|---|---|---|
| `layout` | `'list' \| 'grid'` | `'list'` | Layout format of the records list. |
| `gridCols` | `number` | `2` | Number of columns when `layout` is `'grid'`. |
| `bordered` | `boolean` | `true` | Show card border wrapper. |
| `flat` | `boolean` | `true` | Render card flat (no shadow). |
| `class` | `string` | `''` | Additional styling classes applied to the list wrapper. |
| `noChildCounts` | `boolean` | `false` | Hide badge showing counts of child items. |
| `emptyMessage` | `string` | `'No records found'` | Message shown when list is empty. |

#### record Card Detail properties (in Props)
* `resolvePrimaryText(row)`: Function returning the main bold label.
* `resolveSecondaryText(row)`: Function returning secondary text details.

#### Example JS Logic Modifier for Listing
```javascript
// src/components/Masters/Products/Index/Records.js
export default function (props) {
  return {
    ...props,
    layout: 'grid',
    flat: false,
    bordered: true,
    class: 'product-grid-shaded',
    emptyMessage: 'No products in catalog.',
    resolvePrimaryText: (row) => row.Name,
    resolveSecondaryText: (row) => `SKU: ${row.SkuCode} | Price: $${row.Price}`
  }
}
```

---

## 2.2 View Page: Details & Parent Cards (`Details.js` & `Parent.js`)
Custom JS logic modifier files created at `src/components/[Scope]/[Resource]/View/Details.js` or `Parent.js`.

#### Details Card Schema (`Details.vue` Props)
| Parameter | Type | Default | Description |
|---|---|---|---|
| `detailsConfig` | `object` | `{}` | Inner configuration for details card: `title`, `columns`, `fields`, `fieldLabels`. |

##### `detailsConfig` Configuration Object:
* `title` (string, default: `'Details'`): Header text.
* `columns` (number, default: `1`): Responsive columns grid (supports `1`, `2`, `3`).
* `fields` (string[]): Explicit list of fields in display order.
* `fieldLabels` (object): Key-value mapping of field headers to custom labels.

#### Example Details Modifier
```javascript
// src/components/Masters/Products/View/Details.js
export default function (props) {
  return {
    ...props,
    detailsConfig: {
      title: 'Product Specifications',
      columns: 2,
      fields: ['Name', 'SkuCode', 'Type', 'Price'],
      fieldLabels: {
        SkuCode: 'Stock Keeping Unit',
        Price: 'MSRP (USD)'
      }
    }
  }
}
```

---

## 2.3 Add, Edit, & Action Forms (`Form.js`)
Custom JS logic modifier file created at `src/components/[Scope]/[Resource]/Add/Form.js`, `Edit/Form.js`, or `Action/Form.js`.

#### Form Configuration Schema (`Form.vue` Props)
| Parameter | Type | Default | Description |
|---|---|---|---|
| `formConfig` | `object` | `{}` | Inner configuration details for inputs: `flat`, `bordered`, `class`, `columns`, `hideFields`, `fieldConfigs`, `sections`. |

##### `formConfig` Configuration Object:
* `columns` (number, default: `1`): Default number of columns for fields.
* `hideFields` (string[]): Fields to hide.
* `sections` (object[]): Fields grouped in Collapsible or static sections.
* `fieldConfigs` (object): Specific field definitions.

#### Example Form Modifier
```javascript
// src/components/Masters/Products/Add/Form.js
export default function (props) {
  return {
    ...props,
    formConfig: {
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
        }
      }
    }
  }
}
```

---

## 3. Order & Visibility Control in View Pages (`Content.js`)

At the page content orchestrator level (`View/Content.js`), a resource custom JS modifier can adjust:
- **`order`**: Array of sections (`'Details'`, `'Parent'`, `'Children'`, `'Audit'`) defining their layout sequence.
- **`hide`**: Array of sections to completely exclude from rendering.

#### Example Content Modifier
```javascript
// src/components/Operations/OutletConsumptions/View/Content.js
export default function (props) {
  return {
    ...props,
    order: ['Children', 'Details', 'Parent'], // Render children grid first
    hide: ['Audit', 'Parent']                 // Exclude audit trail and parent link cards
  }
}
```
