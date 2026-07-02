# PLAN: Common Action Component Enhancement (Floating FABs & Dialog-based Mutate Actions)
**Status**: COMPLETED
**Created**: 2026-07-01
**Created By**: Brain Agent (Antigravity)
**Executed By**: Build Agent (Antigravity)

## Objective
Enhance the layout and behavior of common page-level action components (`Actions.vue`) across Index, View, Add, and Edit pages in the AQL frontend:
1. **Index Page**: Render the `CrudActions` button on the bottom-right (Add FAB) and the `Downloads` FAB on the bottom-left (only if reports exist).
2. **View Page**: 
   - Render a `CrudActions` FAB on the bottom-right. If the user has both update and write permissions, show an expandable FAB with "Edit" and "Add New". If they have only one permission, show a single button.
   - Render an `AdditionalActionSingle` or `AdditionalActionMultiple` FAB on the bottom-right (offset to the left). If there is more than 1 action, show an expandable FAB. If exactly 1, show a single button.
   - Execute Mutate actions in-place using an inline modal dialog (`ActionDialog.vue`) instead of navigating to the separate Action page.
   - Render a `Downloads` FAB on the bottom-left (only if record reports exist).
3. **Add & Edit Pages**: Keep form submission buttons in the `Actions.vue` component, but display them as a sticky/glassmorphic bottom action bar using `FormActions.vue`.
4. **Main Layout**: Remove the Report Download button from the main layout toolbar since it is now natively supported as a FAB in the `Action` page component.

## Context
* [AGENTS.md](file:///f:/LITTLE%20LEAP/AQL/AGENTS.md) & [ARCHITECTURE RULES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/ARCHITECTURE%20RULES.md)
* Existing Action orchestrators: `src/components/_common/Index/Actions.vue`, `src/components/_common/View/Actions.vue`, `src/components/_common/Add/Actions.vue`, `src/components/_common/Edit/Actions.vue`.
* Reports component: `src/components/Reports/ResourceReports.vue`.
* Form component: `src/components/_common/Content/Form.vue`.

## Pre-Conditions
- [x] Context and architectural boundaries were reviewed.

## Steps

### Step 1: Remove Reports Download from Toolbar
- Remove `<ResourceReports mode="toolbar" />` and its import from [MainLayout.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/layouts/MainLayout/MainLayout.vue).
**Files**: `FRONTENT/src/layouts/MainLayout/MainLayout.vue`

### Step 2: Update ResourceReports Wrapper
- Update `components/_common/Action/ResourceReports.vue` to accept and pass through `mode` and `record` props.
**Files**: `FRONTENT/src/components/_common/Action/ResourceReports.vue`

### Step 3: Add FAB mode to ResourceReports
- Add `mode="fab"` support to `ResourceReports.vue`.
- In `fab` mode, if `displayedReports.length > 0`, render a `q-fab` with `color="deep-orange-7"`, `icon="picture_as_pdf"`, `direction="up"`, and label-position/class aligned beautifully.
**Files**: `FRONTENT/src/components/Reports/ResourceReports.vue`

### Step 4: Create Action Sub-Components under Action/
- **`Downloads.vue`**: Bottom-left report FAB wrapper.
- **`CrudActions.vue`**: Bottom-right FAB (Add/Edit options or single buttons).
- **`AdditionalActionSingle.vue`**: Bottom-right offset button for a single workflow action.
- **`AdditionalActionMultiple.vue`**: Bottom-right offset FAB for multiple workflow actions.
- **`FormActions.vue`**: Sticky bottom bar layout for form submission (Submit/Cancel/Proceed).
**Files**:
- [NEW] `FRONTENT/src/components/_common/Action/Downloads.vue`
- [NEW] `FRONTENT/src/components/_common/Action/CrudActions.vue`
- [NEW] `FRONTENT/src/components/_common/Action/AdditionalActionSingle.vue`
- [NEW] `FRONTENT/src/components/_common/Action/AdditionalActionMultiple.vue`
- [NEW] `FRONTENT/src/components/_common/Action/FormActions.vue`

### Step 5: Support disabled attribute in FormSubmit
- Update `FormSubmit.vue` to accept `disabled` prop and bind it to the `<q-btn>` element.
**Files**: `FRONTENT/src/components/_common/Action/FormSubmit.vue`

### Step 6: Create ActionDialog component
- Build `ActionDialog.vue` to render dynamic mutate actions inside a modal.
- Reuse `Form.vue` dynamically by passing outcome options and resolved fields.
- Integrate action submission store triggers (`submitAction` from Master/Operation actions store) and call `reload()` upon success.
**Files**: [NEW] `FRONTENT/src/components/_common/Action/ActionDialog.vue`

### Step 7: Update Index Actions
- Render `<Downloads :page="page" />` and `<CrudActions :page="page" />` inside the fallback path of `Index/Actions.vue`.
**Files**: `FRONTENT/src/components/_common/Index/Actions.vue`

### Step 8: Update View Actions
- Render:
  - `<Downloads :page="page" :record="record" />`
  - `<CrudActions :page="page" @edit="navigateToEdit" @add="navigateToAdd" />`
  - `<AdditionalActionSingle>` / `<AdditionalActionMultiple>` based on the count of `visibleActions`.
  - `<ActionDialog>` to handle mutate action executions.
**Files**: `FRONTENT/src/components/_common/View/Actions.vue`

### Step 9: Update Add, Edit & Action page Actions (FormActions Integration)
- Update `Add/Actions.vue`, `Edit/Actions.vue`, and `Action/Actions.vue` to render the new `FormActions.vue` component in their fallback paths.
**Files**:
- `FRONTENT/src/components/_common/Add/Actions.vue`
- `FRONTENT/src/components/_common/Edit/Actions.vue`
- `FRONTENT/src/components/_common/Action/Actions.vue`

## Documentation Updates Required
- [x] Update `FRONTENT/src/components/REGISTRY.md` to reflect the new component layouts.

## Acceptance Criteria
- [x] Index page displays `Downloads` FAB bottom-left (if reports exist) and `CrudActions` (Add FAB) bottom-right (if canWrite).
- [x] View page displays `Downloads` FAB bottom-left, `CrudActions` FAB bottom-right, and `AdditionalAction` FAB bottom-right (shifted left).
- [x] Mutate actions on View page execute via modal dialog with input fields in-place and reload the record dynamically upon success.
- [x] Add, Edit, and Action execution pages have form submit/cancel buttons fixed as a sticky bottom bar using `FormActions`.

## Execution Self-Check Protocol
### Progress Log
- [x] Step 1 completed
- [x] Step 2 completed
- [x] Step 3 completed
- [x] Step 4 completed
- [x] Step 5 completed
- [x] Step 6 completed
- [x] Step 7 completed
- [x] Step 8 completed
- [x] Step 9 completed
