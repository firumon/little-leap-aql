# PLAN: Content Component & Sub-sections Dual-Model Enhancement
**Status**: COMPLETED
**Created**: 2026-06-29
**Created By**: Brain Agent (Antigravity)
**Executed By**: Build Agent (Antigravity)

## Objective
Enhance AQL's global content components under `src/components/_common/` and their sub-sections (Index, View, Add, Edit, Action) to support the script-only/template dual model. This enables database resources to define lightweight layout configurations (like column count, layout grids, sections, fields list, etc.) without writing complete custom Vue templates, while still preserving full custom template override capability.

## Context
AQL uses a 12-tier resolution system via `useSectionResolver` to load custom overrides. `Header.vue` and `ViewSwitcher.vue` already support a dual model where a resource-specific Vue file can export a script-only configuration object instead of a template. The page-level `Content` components and their leaves (`Records`, `Details`, `Form`) currently do not support this, requiring developers to write full template boilerplate even for minor layout customizations.

## Pre-Conditions
- [x] Content and pattern research is complete.
- [x] Codebase guidelines, architecture rules, and patterns are understood.

## Steps

### Step 1: Enhance Index Content & Records List (Dual Model)
- Modify `Index/Content.vue` to recursively resolve page-level `Content` with `allowScriptOnly: true`. If a template is found, render it; otherwise, pass resolved script-only config down to `Records.vue`.
- Modify `Content/Records.vue` to support:
  - `allowScriptOnly: true` resolution for `Record` (RecordsRecord) and the `Records` section itself.
  - Configuration properties: `layout` ('list' or 'grid'), `gridCols` (number of columns), `bordered`/`flat` properties, and class overrides.
- Modify `Content/RecordsRecord.vue` to accept `recordConfig` (from script-only override) and dynamically customize the title, subtitle, badges, and icon based on config parameters.
**Files**:
- [Index/Content.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/_common/Index/Content.vue)
- [Content/Records.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/_common/Content/Records.vue)
- [Content/RecordsRecord.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/_common/Content/RecordsRecord.vue)

### Step 2: Enhance View Content & Detail Fallbacks (Dual Model)
- Modify `View/Content.vue` to resolve `Content` override with `allowScriptOnly: true`. Use script-only configuration to dynamically customize section ordering, toggle section visibility, and pass configurations to child sections.
- Correct the default import/definition of `Children` component in `View/Content.vue` to point to `components/_common/View/Children.vue` (the read-only children card list) instead of `components/_common/Content/Children.vue` (the editable child form grid).
- Modify `Content/Details.vue` to accept `detailsConfig` and support custom cards titles, field list overrides, custom labels, and dynamic grid column structures (e.g. 2-column or 3-column detail lists).
- Modify `Content/Parent.vue` to support custom titles and visible headers via script-only config.
**Files**:
- [View/Content.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/_common/View/Content.vue)
- [Content/Details.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/_common/Content/Details.vue)
- [Content/Parent.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/_common/Content/Parent.vue)

### Step 3: Enhance Form Fallbacks for Add, Edit, and Action Pages (Dual Model)
- Modify `Add/Content.vue` and `Edit/Content.vue` to resolve `Form` with `allowScriptOnly: true` and support passing resolved configs to `Form.vue`.
- Modify `Action/Content.vue` to:
  - Change default fallback for `ActionFields` from `EmptyComponent` to `Form` (imported from `components/_common/Content/Form.vue`) so action fields render by default.
  - Resolve `ActionFields` with `allowScriptOnly: true` and pass configuration to `Form.vue`.
- Modify `Content/Form.vue` to:
  - Accept `formConfig` prop.
  - Render form fields in separate card sections or collapsible groups if defined in the config.
  - Support multi-column field grids, field placeholders, specific class additions, and label overrides.
**Files**:
- [Add/Content.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/_common/Add/Content.vue)
- [Edit/Content.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/_common/Edit/Content.vue)
- [Action/Content.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/_common/Action/Content.vue)
- [Content/Form.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/_common/Content/Form.vue)

### Step 4: Update Documentation
- Update the framework common component guide to document the new signatures, resolved props, and dual-model configuration contracts of the Content components.
**Files**:
- [common_component_creation.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/common_component_creation.md)

## Documentation Updates Required
- Update [common_component_creation.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/common_component_creation.md) to define how developers can write script-only config overrides for Content, Records, Details, and Form components.

## Acceptance Criteria
- [x] Resolving Content or leaf sections with script-only configurations dynamically applies layout and field settings without rendering blank blocks.
- [x] Template overrides continue to render exactly as written without interference from configuration fallbacks.
- [x] Action page renders standard action forms and input fields by default.
- [x] No regression on existing page loading and CRUD operations.
- [x] Project compiles successfully with `npm run build` or local test dev builds.

## Execution Self-Check Protocol
- [x] Step 1 completed
- [x] Step 2 completed
- [x] Step 3 completed
- [x] Step 4 completed
- [x] Verification completed
