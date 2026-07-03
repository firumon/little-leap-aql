# AQL Unified Action Customization & Overriding System

This document outlines the architecture, configuration, and overriding protocol for page-level actions (floating buttons, sticky form bars, workflow executions, dialogs) within the AQL Quasar/Vue 3 frontend.

---

## 1. System Architecture

The action system operates on a **decentralized, two-tier architecture**:
1. **Orchestrator Shells (`Actions.vue`)**:
   - Reside under `src/components/_common/[Index|View|Add|Edit|Action]/Actions.vue`.
   - Act as the entry points for their respective page scopes.
   - Resolve themselves locally using `useSectionResolver` or `useCommonSection` to search for custom local `Actions.vue` or `Actions.js` overrides.
   - If no local override is present, they render the default sub-sections layout.
2. **Sub-components & Sub-sections**:
   - Render specific subsets of actions (e.g., reports download, CRUD buttons, workflow triggers, form buttons).
   - Support fully decentralized, nested overrides (e.g. a local `FormCancel.vue` overrides the common Cancel button).

---

## 2. Directory Layout & Registry

Page-level Action orchestrators reside under `src/components/_common/Action/`, while all reusable action sections reside under `src/components/_common/sections/Action/`:

```
src/components/_common/
├── Action/
│   ├── Actions.vue                    # Action execution page actions bar
│   ├── Content.vue                    # Action execution page form layout
│   └── Toolbar.vue                    # Action execution page header toolbar
└── sections/
    └── Action/
        ├── Downloads.vue                  # Sticky bottom-left reports download trigger
        ├── Downloads/                     # Sub-sections of Downloads (decentralized)
        │   ├── PageSticky.vue             # q-page-sticky positioning wrapper
        │   ├── ReportFab.vue              # Floating reports FAB menu trigger
        │   └── ReportItem.vue             # Individual report action sub-items
        ├── CrudActions.vue                # Index/View/Edit CRUD FAB orchestrator
        ├── CrudActions/                   # Sub-sections of CrudActions (decentralized)
        │   ├── PageSticky.vue             # q-page-sticky positioning wrapper
        │   ├── FabBtn.vue                 # Expandable menu q-fab trigger
        │   ├── FabBtnAdd.vue              # Single Add q-btn
        │   ├── FabBtnEdit.vue             # Single Edit q-btn
        │   ├── FabBtnView.vue             # Single View q-btn
        │   ├── FabItemAdd.vue             # Add q-fab-action inside menu
        │   ├── FabItemEdit.vue            # Edit q-fab-action inside menu
        │   └── FabItemView.vue            # View q-fab-action inside menu
        ├── AdditionalActionSingle.vue      # Floating single workflow action orchestrator
        ├── AdditionalActionMultiple.vue    # Expandable workflow actions FAB orchestrator
        ├── AdditionalActions/             # Sub-sections of AdditionalActions (decentralized)
        │   ├── PageSticky.vue             # q-page-sticky positioning wrapper
        │   ├── FabSingleBtn.vue           # Single action button
        │   ├── FabBtn.vue                 # Expandable actions menu trigger
        │   └── FabItem.vue                # Individual workflow action sub-items
        ├── FormActions.vue                # Sticky bottom panel for form pages (Add/Edit)
        ├── FormActions/                   # Sub-sections of FormActions (decentralized)
        │   ├── StickyBar.vue              # Sticky positioning panel wrapper
        │   ├── FormCancel.vue             # Cancel button
        │   └── FormSubmit.vue             # Submit button
        └── ActionDialog.vue               # Outcome/input form modal for inline workflow executions
```

---

## 3. Orchestration & Sub-section Specifications

### 3.1 `Downloads.vue`
- **Purpose**: Displays a floating action button on the bottom-left of the page if reports/downloads are configured for the resource.
- **Props**:
  - `record` (Object, optional): Current record context (for View page reports).
  - `page` (String, default `'Index'`): The active page context.
- **Internal Composition**:
  - Composited from 3 sub-sections in `Downloads/` directory.
  - Automatically resolves sub-sections using `useCommonSection` to allow local overriding of individual parts of the Reports FAB.

#### `Downloads` Sub-sections:
| Section Name | Default Icon / Wrapper | Purpose |
| :--- | :--- | :--- |
| **`DownloadsPageSticky`** | `<q-page-sticky>` | Positions the FAB container at `'bottom-left'` with offset `[18, 18]`. |
| **`DownloadsReportFab`** | `picture_as_pdf` | Expandable report button menu (color: `'deep-orange-7'`). |
| **`DownloadsReportItem`** | `picture_as_pdf` / custom | Individual report selection inside the menu (color: `'deep-orange-6'`). |

> [!TIP]
> **Dynamic Report Item Properties**: In `DownloadsReportItem`, the `color`, `icon`, and `label` properties accept functions of the form `(report) => value`. This allows local JS logic modifiers to dynamically style and customize each download item based on its specific report metadata (e.g. coloring invoice reports differently from generic sheets reports).

### 3.2 `CrudActions.vue`
- **Purpose**: Handles floating CRUD operation (Add, Edit, View) on the bottom-right.
- **Props**:
  - `page` (String, default `'Index'`): The active page context (`'Index'`, `'View'`, `'Edit'`).
- **Internal Composition**:
  - Composited from 8 sub-sections in `CrudActions/` directory.
  - Automatically resolves sub-sections using `useCommonSection` to allow local overriding of individual parts of the CRUD FAB.

#### `CrudActions` Sub-sections:
| Section Name | Default Icon / Wrapper | Purpose |
| :--- | :--- | :--- |
| **`CrudActionsPageSticky`** | `<q-page-sticky>` | Positions the FAB container with offsets: `Index`/`View` uses `[18, 18]`, `Edit` uses `[18, 80]` (above the sticky bottom bar). |
| **`CrudActionsFabBtn`** | `<q-fab>` | Expandable button menu. |
| **`CrudActionsFabBtnAdd`** | `add` | Single Add button (Index/View pages). |
| **`CrudActionsFabBtnEdit`** | `edit` | Single Edit button (View page). |
| **`CrudActionsFabBtnView`** | `visibility` | Single View button (Edit page). |
| **`CrudActionsFabItemAdd`** | `add` | Add sub-action inside the menu. |
| **`CrudActionsFabItemEdit`** | `edit` | Edit sub-action inside the menu. |
| **`CrudActionsFabItemView`** | `visibility` | View sub-action inside the menu. |

### 3.3 `AdditionalActionSingle` & `AdditionalActionMultiple`
- **Purpose**: Floating triggers for workflow/mutate actions.
- **Props**:
  - `action` (Object) / `actions` (Array): Configured workflow action metadata.
  - `page` (String, default `'View'`): The active page context.
- **Internal Composition**:
  - Composited from 4 sub-sections in `AdditionalActions/` directory.
  - Automatically resolves sub-sections using `useCommonSection` to allow local overriding of individual parts of the workflow buttons.

#### `AdditionalActions` Sub-sections:
| Section Name | Default Icon / Wrapper | Purpose |
| :--- | :--- | :--- |
| **`AdditionalActionsPageSticky`** | `<q-page-sticky>` | Positions the action container at `'bottom-right'` with offset `[80, 18]`. |
| **`AdditionalActionsFabSingleBtn`** | `bolt` | Renders the single action button (q-btn) when only one workflow action exists. |
| **`AdditionalActionsFabBtn`** | `bolt` | Expandable FAB menu trigger for multiple workflow actions. |
| **`AdditionalActionsFabItem`** | `bolt` / custom | Individual workflow action selection inside the menu. |

> [!TIP]
> **Dynamic Workflow Properties**: In `AdditionalActionsFabSingleBtn` and `AdditionalActionsFabItem`, the `color`, `icon`, and `label` properties accept functions of the form `(action) => value`. This allows local JS logic modifiers to dynamically style and label each workflow button based on its state and definition.

### 3.4 `FormActions.vue`
- **Purpose**: Sticky bottom panel container for form sub-actions.
- **Props**:
  - `page` (String, required): `'Add'`, `'Edit'`, or `'Action'`.
  - `submitLabel` (String, default `'Save'` / `'Update'`).
  - `saving` (Boolean, default `false`).
  - `disabled` (Boolean, default `false`).
- **Internal Composition**:
  - Composited from 3 sub-sections in `FormActions/` directory.
  - Automatically resolves sub-sections using `useCommonSection` to allow local overriding of individual form elements.

#### `FormActions` Sub-sections:
| Section Name | Default Icon / Wrapper | Purpose |
| :--- | :--- | :--- |
| **`FormActionsStickyBar`** | `div` / glassmorphism | The sticky bottom bar spacer and layout container. |
| **`FormActionsFormCancel`** | `close` | Cancel button inside the bar. |
| **`FormActionsFormSubmit`** | `save` | Submit button inside the bar. |

> [!TIP]
> **Dynamic Form Action Properties**: In `FormActionsFormCancel` and `FormActionsFormSubmit`, button properties (`color`, `icon`, `label`, `flat`, `unelevated`) accept functions of the form `(record, props) => value`. This allows local JS logic modifiers to dynamically style and label the form buttons based on the current record or form state (e.g. changing the submit label to "Submitting..." during active save operation or altering colors depending on the page mode).

---

## 4. Permission Gating & Prop Drilling

> [!CRITICAL]
> **Strict Permission Enforcement**: Permissions (e.g. `canWrite`, `canUpdate`, `canRead`) must be evaluated at the parent orchestrator level (`Actions.vue` / `CrudActions.vue`) and drilled down to all child/override components via props. Under no circumstances should custom local overrides bypass or ignore these permission gates (e.g. rendering an active Edit/Add button without inspecting `permissions`).

### Prop Drilling Pattern:
When defining overrides, the parent component passes the active `permissions` down. Ensure your custom template expects this prop:

```html
<!-- Inside a parent Action orchestrator -->
<CrudActionsPageSticky :page="page">
  <FabAddBtn
    :page="page"
    :permissions="permissions"
    @add="navigateToAdd"
  />
</CrudActionsPageSticky>
```

---

## 5. Customization & Overriding Guide

You can override actions at the **logic modifier level (JS)** or **template level (Vue)**.

### 5.1 Local JS Logic Modifiers (Properties Customization)
Create a `.js` file to modify properties without altering the visual structure. `useCommonSection` automatically merges and evaluates these.

#### Example: `src/components/master/Products/Index/FormSubmit.js`
```javascript
export default {
  // Override label based on page state
  label: (props) => props.saving ? 'Saving...' : 'Create Product',
  
  // Custom button styling
  color: 'accent',
  unelevated: false,
  icon: 'cloud_upload'
}
```

### 5.2 Local Vue Templates (Slot or Full Structure Customization)
To change slots or visual output, wrap the default component in a `.vue` file.

> [!IMPORTANT]
> **Always use `defineOptions({ inheritAttrs: false })` and bind `$attrs` FIRST to prevent parent attributes from overwriting your local properties.**

#### Example: `src/components/master/Products/Index/FormCancel.vue`
```html
<template>
  <!-- inheritAttrs: false ensures props from FormActions merge safely -->
  <q-btn
    v-bind="$attrs"
    flat
    color="negative"
    label="Discard Changes"
    icon="delete"
    @click="$emit('cancel')"
  />
</template>

<script setup>
defineOptions({ inheritAttrs: false })
defineEmits(['cancel'])
</script>
```

### 5.3 Overriding Parents and Rendering Children
If you write a full override for a parent orchestrator (e.g. `src/components/master/Products/View/Actions.vue`), you are responsible for rendering any children or sub-sections needed.

#### Example: Custom `View/Actions.vue` Rendering Custom + Default Sub-sections:
```html
<template>
  <div class="custom-view-actions">
    <!-- Render default Downloads FAB -->
    <Downloads :record="record" />

    <!-- Custom inline action trigger instead of floating FAB -->
    <q-card flat bordered class="q-pa-sm">
      <q-btn label="Run Custom Action" color="accent" @click="runCustom" />
    </q-card>

    <!-- Render default CRUD FAB -->
    <CrudActions page="View" />
  </div>
</template>

<script setup>
import Downloads from 'components/_common/Action/Downloads.vue'
import CrudActions from 'components/_common/Action/CrudActions.vue'

defineProps({
  record: { type: Object, required: true }
})
</script>
### 5.4 Exposed Props vs Slot Scope in Overrides

When overriding a common action component with a custom `.vue` template, you can access evaluated attributes using either standard properties or Vue's slot scope.

#### Method A: Declaring Props (Recommended)
All computed configuration properties (from `finalProps`) are spread directly onto your resolved component via `v-bind="finalProps"`. Thus, you can simply declare them in your custom component:

```html
<template>
  <q-btn :color="color" :icon="icon" :label="label" />
</template>

<script setup>
defineProps({
  color: String,
  icon: String,
  label: String
})
</script>
```

#### Method B: Utilizing Slot Scope (`v-slot`)
Some parent components explicitly expose their configuration context as scoped slots.
- **`FormSubmit` / `FormCancel`**: Expose `{ label, saving, disabled, color, unelevated, icon, flat }` to the slot scope.
- **`DownloadsReportFab` / `CrudActionsFabBtn` / `AdditionalActionsFabBtn`**: Expose `{ color, icon, activeIcon, direction, verticalActionsAlign, tooltip }` to the slot scope of their custom overrides, allowing you to pass them down to nested templates or slots:

```html
<!-- Example of a custom FAB button override -->
<template v-slot="{ color, icon, tooltip }">
  <q-fab :color="color" :icon="icon">
    <q-tooltip>{{ tooltip }}</q-tooltip>
    <slot />
  </q-fab>
</template>
```


