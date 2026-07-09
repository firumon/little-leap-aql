# AQL Content Layout & Customization System

This document is the complete reference guide for the AQL Content Customization System. It explains the decentralized custom template and logic modifier architecture, fallback components, page orchestrators, and all available configuration parameters used to customize resource screens (Index, View, Add, Edit, Action) without rewriting full HTML/Vue templates.

---

## 1. System Architecture

AQL pages resolve their inner contents using a single unified page orchestrator shell:
- **Unified Content Orchestrator**: Resolves [Content.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/_common/sections/Content/Content.vue). It dynamically determines the page mode and renders the correct sub-section fallback.

This orchestrator dynamically looks for overrides under `src/_ui/[UiName]/components/` using [useSectionResolver.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/resources/useSectionResolver.js). Common components wrap this with [useCommonSection.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/resources/useCommonSection.js) to automate context injection (record/config), property modifications, and dynamic evaluations.

### Custom Templates vs. JS Logic Modifiers
When resolving a section (like `Content`, `List`, `Details`, `Form`), the resolver checks:
1. **Vue Template Override (`.vue` file)**: Checked across the 10 lookup candidates. It must contain a `<template>` block. If found, it completely takes over layout rendering. Vue components without a template are **strictly forbidden**.
2. **JS Logic Modifier (`.js` file)**: Checked across the 10 lookup candidates. It exports a default function `(props) => modifiedProps` that intercepts and adjusts the properties fed to the base section template.

---

## 2. Page Configuration Schemas (via JS Modifiers)

### 2.1 Index Page: List View (`List.js` / `List.vue`)
Custom JS logic modifier created at `src/_ui/[UiName]/components/[scope]/[ResourceName]/Index/List.js` or `src/_ui/[UiName]/components/[scope]/[ResourceName]/List.js`.

#### Default Props Generation
By default, the List component maps resource columns to [AqlList.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/shared/AqlList.vue) props via [useDefaultListProps.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/resources/useDefaultListProps.js):
- **Code & Name exists**: Layout -> `['caption', 'label']`, content -> `['Code', 'Name']`
- **Code only**: Layout -> `['label']`, content -> `['Code']`
- **Date field exists**: Date appended as caption
- **Progress field exists**: Progress shown as chip in meta section (colored positive/warning/negative based on percentage)
- **Active/Inactive Status**: Status badges are excluded by default (handled by viewSwitcher)
- **Click Actions**: Clicking a row navigates to the View details page using `useResourceNav`.

#### Example JS Logic Modifier for Listing
Any `AqlList` prop (e.g. `layout`, `content`, `metaLayout`, `meta`, `chipColor`) can be overridden.
```javascript
// src/_ui/AQL/components/master/Products/Index/List.js
export default function (props) {
  return {
    ...props,
    clickable: true,
    layout: ['label', 'caption'],
    content: ['Name', 'SkuCode']
  }
}
```

---

## 2.2 View Page: Details Card (`Details.js`)
Custom JS logic modifier file created at `src/_ui/[UiName]/components/[scope]/[ResourceName]/View/Details.js`.

#### Details Card Schema (`Details.vue` Props)
| Parameter | Type | Default | Description |
...
* `detailsConfig` | `object` | `{}` | Inner configuration for details card: `title`, `columns`, `fields`, `fieldLabels`. |

##### `detailsConfig` Configuration Object:
* `title` (string, default: `'Details'`): Header text.
* `columns` (number, default: `1`): Responsive columns grid (supports `1`, `2`, `3`).
* `fields` (string[]): Explicit list of fields in display order.
* `fieldLabels` (object): Key-value mapping of field headers to custom labels.

#### Example Details Modifier
```javascript
// src/_ui/AQL/components/master/Products/View/Details.js
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
Custom JS logic modifier file created at `src/_ui/[UiName]/components/[scope]/[ResourceName]/Add/Form.js`, `Edit/Form.js`, or `Action/Form.js`.

#### Form Configuration Schema (`Form.vue` Props)
| Parameter | Type | Default | Description |
|---|---|---|---|
| `formConfig` | `object` | `{}` | Inner configuration details for inputs: `flat`, `bordered`, `class`, `columns`, `hideFields`, `fieldConfigs`, `sections`. |

##### `formConfig` Configuration Object:
* `columns` (number, default: `1`): Default number of columns for fields.
* `hideFields` (string[]): Fields to hide.
* `sections` (object[]): Fields grouped in Collapsible or static sections.
* `fieldConfigs` (object): Specific field definitions.

##### Date Fields
Form inputs of type `'date'` render using [AppDate.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/shared/AppDate.vue) for masked typing and a custom calendar pop-up.

#### Example Form Modifier
```javascript
// src/_ui/AQL/components/master/Products/Add/Form.js
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
// src/_ui/AQL/components/operation/OutletConsumptions/View/Content.js
export default function (props) {
  return {
    ...props,
    order: ['Children', 'Details', 'Parent'], // Render children grid first
    hide: ['Audit', 'Parent']                 // Exclude audit trail and parent link cards
  }
}
```

