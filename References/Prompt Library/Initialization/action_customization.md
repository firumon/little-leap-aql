# AQL Action Customization & Overriding Guide (Initialization)

Use this document to initialize an AI agent session when the task involves customizing, overriding, or debugging page-level actions, floating action buttons (FABs), sticky form actions, or workflow triggers across any page (Index, Add, Edit, View, Action) in the AQL repository.

> **Scope Boundary**: This document covers both JS logic modifiers and template-based local action customizations, sub-section overrides, dialog-based executes, and permission checks. Refer to [ARCHITECTURE RULES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/ARCHITECTURE%20RULES.md) for general frontend rules.

---

## 1. Architecture & Reference Files

The action system uses a **two-tier decentralized architecture** that separates orchestrators from sub-sections:

1. **Orchestrator Shells (`Actions.vue`)**:
   - Reside under `src/components/_common/[Index|View|Add|Edit|Action]/Actions.vue`.
   - Call [useSectionResolver.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/resources/useSectionResolver.js) or [useCommonSection.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/resources/useCommonSection.js) to look for local overrides.
2. **Action Sub-components**:
   - Reside under `src/components/_common/Action/`.
   - Key layout files: [Downloads.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/_common/Action/Downloads.vue), [CrudActions.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/_common/Action/CrudActions.vue), [FormActions.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/_common/Action/FormActions.vue), [ActionDialog.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/_common/Action/ActionDialog.vue).
    - [Downloads/](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/_common/Action/Downloads/) directory holds 3 sub-sections that can be overridden individually.
    - [CrudActions/](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/_common/Action/CrudActions/) directory holds 8 sub-sections that can be overridden individually.
    - [AdditionalActions/](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/_common/Action/AdditionalActions/) directory holds 4 sub-sections that can be overridden individually.
    - [FormActions/](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/_common/Action/FormActions/) directory holds 3 sub-sections that can be overridden individually.

---

## 2. Reading Codebase and References

Before modifying any action component or creating overrides:
1. Read the canonical guide: [AQL_ACTION_CUSTOMIZATION_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/AQL_ACTION_CUSTOMIZATION_SYSTEM.md)
2. Locate the active page context: e.g. `src/pages/Masters/[Resource]/ViewPage.vue` or the corresponding common wrapper in `src/pages/_common/Page.vue`.
3. Understand resource permissions and config layout from the pinia stores or resource metadata settings.

---

## 3. Strict Permission Enforcement

> [!CRITICAL]
> **Always verify permissions at the orchestrator/common component level (`Actions.vue` / `CrudActions.vue`) and drill down to sub-sections via props.**
> Never bypass permission checks. For example, do not render or enable an Add button unless `permissions.canWrite` is truthy, and do not render or enable an Edit button unless `permissions.canUpdate` is truthy.

---

## 4. Local Customization Patterns

### Pattern 1: JS Logic Modifier (Form Button Customization)
Create a `.js` file to modify properties without altering the visual structure.

#### `src/components/Masters/Products/Index/FormSubmit.js`
```javascript
export default {
  label: (props) => props.saving ? 'Saving...' : 'Add Product',
  color: 'accent',
  unelevated: false,
  icon: 'cloud_upload'
}
```

### Pattern 2: Custom Template Wrapping Sub-sections
Wrap the default component in a `.vue` file to customize slots.

> [!IMPORTANT]
> **To prevent parent orchestrator attributes from overriding your local properties, you MUST use `defineOptions({ inheritAttrs: false })` and bind `$attrs` BEFORE specifying your overrides.**

#### `src/components/Masters/Products/Index/FormCancel.vue`
```html
<template>
  <q-btn
    v-bind="$attrs"
    flat
    color="negative"
    label="Discard"
    icon="delete"
    @click="$emit('cancel')"
  />
</template>

<script setup>
defineOptions({ inheritAttrs: false })
defineEmits(['cancel'])
</script>
```

### Pattern 3: Full Orchestrator Override
If you override a parent orchestrator (e.g. `src/components/Masters/Products/View/Actions.vue`), you must explicitly import and render any required default action components (e.g. `Downloads` or `CrudActions`) alongside your custom markup.

---

## 5. Dynamic Downloads Sub-sections Configuration
In `DownloadsReportItem`, you can pass function callbacks for properties (`color`, `icon`, `label`) that accept the `report` object as an argument:
```javascript
// Example: src/components/Masters/Products/Index/DownloadsReportItem.js
export default {
  color: (report) => report.name === 'Invoice' ? 'indigo' : 'deep-orange-6',
  icon: (report) => report.name === 'Invoice' ? 'receipt' : 'picture_as_pdf',
  label: (report) => report.name === 'Invoice' ? 'Get Invoice' : report.label
}
```

## 6. Dynamic Workflow Sub-sections Configuration
In `AdditionalActionsFabSingleBtn` and `AdditionalActionsFabItem`, you can pass function callbacks for properties (`color`, `icon`, `label`) that accept the `action` object as an argument:
```javascript
// Example: src/components/Masters/Products/View/AdditionalActionsFabItem.js
export default {
  color: (action) => action.action === 'Approve' ? 'positive' : 'secondary',
  icon: (action) => action.action === 'Approve' ? 'check' : 'bolt',
  label: (action) => action.action === 'Approve' ? 'Approve Product' : action.label
}
```

## 7. Dynamic Form Actions Sub-sections Configuration
In `FormActionsFormSubmit` and `FormActionsFormCancel`, you can pass function callbacks for properties (`color`, `icon`, `label`, `flat`, `unelevated`) that accept the `(record, props)` context as arguments:
```javascript
// Example: src/components/Masters/Products/Add/FormSubmit.js
export default {
  label: (record, props) => props.saving ? 'Saving Product...' : 'Create New Product',
  color: (record, props) => record?.status === 'Draft' ? 'amber-8' : 'primary',
  unelevated: true,
  icon: 'save'
}
```
