# Master Resource Customization

## Overview

The Masters module's frontend architecture is designed for deep customization, allowing tenant-specific or entity-specific overrides for various UI components. This is achieved through a multi-tiered component resolution system powered by `useSectionResolver.js`.

- **3-Tier Resolution**: Standard page sections (like `ListRecords`, `ViewHeader`) are resolved using a 3-tier system.
- **6-Tier Resolution**: Key sub-components within sections (like `ViewChild`) use an extended 6-tier system for more granular control.

The key to this system is the `customUIName` property, which can be set in a resource's configuration. This acts as a tenant or group identifier, forming the base path for custom component lookups.

## Directory Structure

Custom components for Masters resources must be placed in specific subdirectories to be discovered by the resolver.

- **Scope**: `components/Masters/`
- **Custom Root**: `components/Masters/_custom/`

The resolution order is as follows:

1.  **Tenant + Entity Specific**:
    - Path: `components/Masters/_custom/{CustomUIName}/{Entity}/{ComponentName}.vue`
    - Example: `_custom/A123/Products/MasterViewChild.vue`
    - Use case: A component override that applies *only* to `Products` for tenant `A123`.

2.  **Tenant-Wide (Cross-Entity)**:
    - Path: `components/Masters/_custom/{CustomUIName}/{ComponentName}.vue`
    - Example: `_custom/A123/MasterListRecordsRecord.vue`
    - Use case: A standardized record card style for *all* Masters resources belonging to tenant `A123`.

3.  **Entity-Specific (All Tenants)**:
    - Path: `components/Masters/{Entity}/{ComponentName}.vue`
    - Example: `Products/MasterViewDetails.vue`
    - Use case: A custom details view for `Products` that applies to *all* tenants.

4.  **Default Fallback**:
    - Path: `components/Masters/_common/{ComponentName}.vue`
    - This is the base component provided by the system.

## Naming Conventions

- **Component Files**: Must be `PascalCase`. E.g., `MasterViewChild.vue`.
- **Entity Folders**: Must be `PascalCase` derived from the resource slug. E.g., `products` -> `Products`.
- **Custom Name Folders**: The `customUIName` from the resource config.

## Component Reference Table

This table lists all customizable components in the Masters module.

| Component | Purpose | Props | Emits | Default file | Custom name pattern |
|---|---|---|---|---|---|
| `MasterListRecordsLoading` | Loading spinner in list | none | none | `_common/MasterListRecordsLoading.vue` | `{Entity}/MasterListRecordsLoading.vue` |
| `MasterListRecordsEmpty` | Empty state in list | none | none | `_common/MasterListRecordsEmpty.vue` | `{Entity}/MasterListRecordsEmpty.vue` |
| `MasterListRecordsRecord` | Single record card in list | `row, resolvePrimaryText, resolveSecondaryText` | `open-detail` | `_common/MasterListRecordsRecord.vue` | `{Entity}/MasterListRecordsRecord.vue` |
| `MasterViewLoading` | Loading spinner on view page | none | none | `_common/MasterViewLoading.vue` | `{Entity}/MasterViewLoading.vue` |
| `MasterViewEmpty` | Not-found state on view page | none | `back` | `_common/MasterViewEmpty.vue` | `{Entity}/MasterViewEmpty.vue` |
| `MasterViewChild` | Single child resource section | `childResource, childRecords, additionalActions` | `view-child` | `_common/MasterViewChild.vue` | `{Entity}/MasterViewChild{PascalChildName}.vue` or `{Entity}/MasterViewChild.vue` |

## Available Helper Functions

When creating custom components, you can import and reuse these helpers from `src/utils/appHelpers.js`.

- `humanizeString(str)`: Converts "camelCase" to "Camel Case".
- `toPascalCase(str)`: Converts "any-string" to "AnyString".
- `AUDIT_HEADERS`: A `Set` of audit field names to exclude (`CreatedAt`, `CreatedBy`, etc.).
- `deriveActionStampHeaders(additionalActions)`: Creates a `Set` of action-related headers to hide (e.g., `ApprovedBy`, `ApprovedAt`).
- `filterDetailFields(resolvedFields, actionStampHeaders)`: Filters fields for a standard detail view.
- `resolveChildFields(childResourceConfig)`: Gets the display fields for a child resource.
- `resolveChildTitle(childResourceConfig)`: Gets the display title for a child resource.

## Step-by-Step Customization Example

**Goal**: Customize the record card for "Products" for a specific tenant, `C456`.

1.  **Set `customUIName`**: In the resource configuration for `products`, ensure `ui.customUIName` is set to `"C456"`.

2.  **Create the file**:
    - The resource slug is `products`, so the `{Entity}` folder name is `Products`.
    - The component to override is `MasterListRecordsRecord`.
    - Create the following file path:
      `src/components/Masters/_custom/C456/Products/MasterListRecordsRecord.vue`

3.  **Implement the component**:
    - Copy the content of the default component from `src/components/Masters/_common/MasterListRecordsRecord.vue` as a starting point.
    - Modify the template as needed. Ensure you respect the props contract (`row`, `resolvePrimaryText`, `resolveSecondaryText`) and emit `open-detail` on click.

    ```vue
    <!-- src/components/Masters/_custom/C456/Products/MasterListRecordsRecord.vue -->
    <template>
      <q-card flat class="custom-pr-card" @click="$emit('open-detail', row)">
        <q-card-section>
          <div class="text-overline">{{ row.Code }}</div>
          <div class="text-h6">{{ row.Name }}</div>
          <div class="text-caption text-grey">Category: {{ row.Category }}</div>
        </q-card-section>
      </q-card>
    </template>

    <script setup>
    defineProps({
      row: Object,
      resolvePrimaryText: Function, // Still received, but unused in this custom version
      resolveSecondaryText: Function, // Still received, but unused
    })
    defineEmits(['open-detail'])
    </script>

    <style scoped>
    .custom-pr-card {
      background-color: #e0f2f1; /* Teal background for this tenant */
      border-left: 5px solid #00796b;
    }
    </style>
    ```

4.  **Restart the dev server**: The new file needs to be discovered by Vite's glob import. Restart your `npm run dev` process. The application will now automatically pick up your custom component for Products where the tenant is `C456`.

## Action Page Customization (5-Tier)

Action pages (Approve, Reject, SendBack, etc.) are resolved separately by
`useActionResolver.js`. Section filenames are prefixed with `Action`, and each
section can be overridden either entity-wide or per-specific-action.

### Tier Order

Given `scope = 'masters'`, `{Entity}` = PascalCase of the resource slug,
`{Section}` ∈ { `Loading`, `Empty`, `Header`, `Form`, `Actions` }, and
`{Action}` = `toPascalCase(actionKey)`:

1. `components/Masters/_custom/{ui}/{Entity}/Action{Section}{Action}.vue` — tenant + entity + per-action
2. `components/Masters/_custom/{ui}/{Entity}/Action{Section}.vue` — tenant + entity
3. `components/Masters/{Entity}/Action{Section}{Action}.vue` — entity + per-action
4. `components/Masters/{Entity}/Action{Section}.vue` — entity-wide
5. `components/Masters/_common/MasterAction{Section}.vue` — default

Tiers 1–2 are skipped when `customUIName` is null. First existing file wins.

### Action Section Reference

| Section | Default | Props | Emits |
|---|---|---|---|
| `ActionLoading` | `_common/MasterActionLoading.vue` | none | none |
| `ActionEmpty` | `_common/MasterActionEmpty.vue` | `icon, message, backLabel` | `back` |
| `ActionHeader` | `_common/MasterActionHeader.vue` | `actionConfig, actionName, record` | none |
| `ActionForm` | `_common/MasterActionForm.vue` | `isMultiOutcome, outcomeOptions, selectedOutcome, resolvedActionFields, actionForm` | `update:selected-outcome, update:action-field` |
| `ActionActions` | `_common/MasterActionActions.vue` | `actionLabel, actionIcon, actionColor, submitting, submitDisabled` | `cancel, submit` |

### Casing Gotcha

`toPascalCase` lowercases the rest of each word. Action key `"SendBack"` becomes
`"Sendback"` — so the override filename is `ActionFormSendback.vue`, **not**
`ActionFormSendBack.vue`. Use a hyphen separator in the action key
(`"send-back"`) if you want `SendBack` casing.

### Action `kind` Discriminator

`AdditionalActions` entries are normalized by `useResourceConfig.additionalActions`
into one of two shapes:

- `kind: 'mutate'` — the standard form-and-submit flow. Renders via `ActionPage`.
- `kind: 'navigate'` — routes straight to a resource-page / record-page via
  `useResourceNav.goTo(target, { pageSlug, resourceSlug?, scope? })`.
  Never hits `ActionPage`.

Legacy entries (no `kind` field) are treated as `mutate`. The GAS
`AdditionalActions` JSON does not need to be migrated for existing flows to keep
working.

### Prop Shapes

Complex props received by Action sections:

```
actionConfig: {
  action: string,              // action key, e.g. 'Approve'
  label: string,
  icon: string,
  color: string,
  confirm: boolean,
  kind: 'mutate' | 'navigate',
  // mutate-kind only:
  column?: string,             // e.g. 'Progress'
  columnValue?: string,        // e.g. 'Approved'
  columnValueOptions?: string[],
  fields?: Array<{ name, type, label?, required? }>
}

record: Object                 // the full record row keyed by header, e.g. { Code, Name, Status, ... }

resolvedActionFields: Array<{
  header: string,              // derived sheet column name, e.g. 'ProgressApprovedComment'
  name: string,                // short logical name, e.g. 'Comment'
  label: string,
  type: 'text' | 'textarea' | 'date' | 'number',
  required: boolean
}>

actionForm: { [header: string]: any }   // reactive object keyed by resolvedActionFields[].header

outcomeOptions: string[]       // raw values from columnValueOptions when multi-outcome
```

How fields are derived: `useActionFields` scans the resource headers for any
column matching `{column}{columnValue}{fieldName}` (e.g.
`ProgressApprovedComment`). Only fields whose derived header exists in the sheet
show up in `resolvedActionFields`. If no explicit `fields` are configured, it
auto-detects headers matching `{column}{columnValue}*` excluding `*At` / `*By`.

### Emit Contract (who validates, who submits)

Overrides only emit. The parent `ActionPage.vue` owns validation and submission.

- `ActionForm` emits `update:selectedOutcome(value)` and `update:actionField(header, value)`.
  Do **not** POST from inside the override.
- `ActionActions` emits `cancel` and `submit`; `ActionPage` handles required-field
  checks and calls the GAS `executeAction` endpoint.
- `ActionHeader` emits nothing — it is pure presentation.
- `ActionEmpty` emits `back` (handled by the page as "return to view").

### Worked Example: Custom Approve Form for Products (Tenant C456)

**Goal**: Tenant `C456` wants the Approve form on Products to show a
tenant-branded banner above the comment field. Only the Approve action needs
overriding; other actions should keep the default form.

1. Ensure `ui.customUIName = "C456"` on the `Products` resource.
2. Action key in the sheet is `"Approve"` → `toPascalCase('Approve')` → `Approve`.
3. Create the file at tier 1 (tenant + entity + per-action):

   `src/components/Masters/_custom/C456/Products/ActionFormApprove.vue`

4. Honor the `ActionForm` props/emits contract:

```vue
<template>
  <q-card flat bordered class="approve-card">
    <q-card-section>
      <div class="banner q-mb-md">C456 · Approval</div>
      <q-input
        v-for="field in resolvedActionFields"
        :key="field.header"
        :model-value="actionForm[field.header]"
        :label="field.label + (field.required ? ' *' : '')"
        :type="field.type === 'textarea' ? 'textarea' : 'text'"
        :autogrow="field.type === 'textarea'"
        dense outlined
        @update:model-value="$emit('update:actionField', field.header, $event)"
      />
    </q-card-section>
  </q-card>
</template>

<script setup>
defineProps({
  isMultiOutcome: Boolean,
  outcomeOptions: Array,
  selectedOutcome: String,
  resolvedActionFields: Array,
  actionForm: Object
})
defineEmits(['update:selectedOutcome', 'update:actionField'])
</script>

<style scoped>
.approve-card { border-radius: 16px; border-color: #00796b; }
.banner { background: #00796b; color: #fff; padding: 6px 12px; border-radius: 6px; font-weight: 600; }
</style>
```

5. Restart the Vite dev server (globs are discovered at startup).
6. Verify: navigating to a Product's Approve action for tenant C456 now renders
   this form; other actions still render the default.

### AdditionalActions JSON Sample

One `mutate` and one `navigate` entry, as they would appear in the
`AdditionalActions` JSON stored on the resource row in GAS:

```json
[
  {
    "action": "Approve",
    "label": "Approve",
    "icon": "check_circle",
    "color": "primary",
    "confirm": false,
    "kind": "mutate",
    "column": "Progress",
    "columnValue": "Approved",
    "columnValueOptions": [],
    "fields": [
      { "name": "Comment", "type": "textarea", "label": "Comment", "required": false }
    ],
    "visibleWhen": { "column": "Progress", "op": "in", "value": ["Review", "Pending"] }
  },
  {
    "action": "Review",
    "label": "Review",
    "icon": "rate_review",
    "color": "info",
    "confirm": false,
    "kind": "navigate",
    "navigate": {
      "target": "record-page",
      "pageSlug": "record-review-product",
      "resourceSlug": null,
      "scope": null
    },
    "visibleWhen": { "column": "Status", "op": "eq", "value": "Active" }
  }
]
```

`kind: 'mutate'` routes through `/masters/{resource}/{code}/_action/{action}`
and renders `ActionPage`. `kind: 'navigate'` skips `ActionPage` entirely and
calls `nav.goTo(target, { pageSlug, resourceSlug?, scope? })` directly — useful
when the "action" is really a multi-step flow on a dedicated record-page.

Legacy entries without `kind` are normalized to `kind: 'mutate'` at read time,
so existing sheets keep working.

### `visibleWhen` — Conditional Action Visibility

Every action entry accepts an optional `visibleWhen` clause that hides the
action unless the current record satisfies it. Evaluated in both the ViewPage
action bar and in `ActionPage` (direct URL hits show a "not available" empty
state if conditions fail).

Shape — single object **or** an array of objects (AND-ed):

```json
"visibleWhen": { "column": "Progress", "op": "in", "value": ["Review","Pending"] }
```

```json
"visibleWhen": [
  { "column": "Progress", "op": "in", "value": ["Review","Pending"] },
  { "column": "Type",     "op": "ne", "value": "Asset" }
]
```

Operators: `eq`, `ne`, `in`, `nin`, `empty`, `notEmpty`.

Rules:
- Absent / `null` / empty array → always visible (backward compatible).
- All conditions must pass (AND); no OR / nesting support.
- `""`, `null`, `undefined` are treated as equivalent for `empty` / `notEmpty`
  and for `eq` / `ne` comparisons (string-coerced).
- Unknown `op` is ignored (treated as absent).

Managed via `GAS/actionManager.html` → per-action **Visible When** block with
column, operator, value rows (comma-separated values for `in` / `nin`).

## Rules and Gotchas

- **Dev Server Restart**: You **must** restart the Vite dev server after adding a new custom component file. The file paths are discovered at startup.
- **PascalCase is Strict**: All component filenames and entity folder names must be `PascalCase`.
- **Props/Emits Contract**: Custom components must honor the props and emits of the default component they are overriding to ensure compatibility with the parent page.
- **Thin Layout Shells**: For best results, custom components should be thin wrappers focused on layout and presentation. Complex logic should remain in the parent pages and be passed down through props.
