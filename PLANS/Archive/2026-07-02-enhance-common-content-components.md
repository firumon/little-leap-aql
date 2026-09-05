# PLAN: Enhance Common Content Components
**Status**: COMPLETED
**Created**: 2026-07-02
**Created By**: Antigravity
**Executed By**: Antigravity

## Objective
Enhance common components in AQL (`Content.vue` and `List.vue`), move `Content.vue` to `_common/sections/Content/`, simplify `List.vue` to render only `AqlList`, implement a default list props generator composable, and use `AppDate.vue` for form dates.

## Context
- `FRONTENT/src/components/_common/Content.vue`
- `FRONTENT/src/components/_common/sections/Content/List.vue`
- `FRONTENT/src/components/_common/sections/Content/Form.vue`
- `FRONTENT/src/components/shared/AppDate.vue`

## Pre-Conditions
- [x] Context and reference documents were reviewed.

## Steps

### Step 1: Create Default List Props Generator Composable
Create `FRONTENT/src/composables/resources/useDefaultListProps.js` with logic mapping resolved fields/headers to AqlList props.
**Files**: [useDefaultListProps.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/resources/useDefaultListProps.js)

### Step 2: Move and Modernize Content.vue
1. Delete [Content.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/_common/Content.vue).
2. Create [Content.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/_common/sections/Content/Content.vue).
**Files**: [Content.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/_common/sections/Content/Content.vue)

### Step 3: Simplify List.vue to Render Only AqlList
Rewrite [List.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/_common/sections/Content/List.vue).
**Files**: [List.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/_common/sections/Content/List.vue)

### Step 4: Update Form.vue to use AppDate.vue
Modify [Form.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/_common/sections/Content/Form.vue).
**Files**: [Form.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/_common/sections/Content/Form.vue)

## Documentation Updates Required
- Update references in code or docs if needed.

## Acceptance Criteria
- List displays using default AqlList format.
- Click events navigate to View pages.
- Date fields use AppDate calendar widget in forms.

## Execution Self-Check Protocol
### Progress Log
- [x] Step 1 completed
- [x] Step 2 completed
- [x] Step 3 completed
- [x] Step 4 completed

### Files Actually Changed
- `FRONTENT/src/composables/resources/useDefaultListProps.js`
- `FRONTENT/src/components/_common/Content.vue`
- `FRONTENT/src/components/_common/sections/Content/Content.vue`
- `FRONTENT/src/components/_common/sections/Content/List.vue`
- `FRONTENT/src/components/_common/sections/Content/Form.vue`
