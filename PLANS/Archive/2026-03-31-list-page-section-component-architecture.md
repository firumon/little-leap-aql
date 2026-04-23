# PLAN: List Page Section-Level Component Architecture
**Status**: COMPLETED
**Created**: 2026-03-31
**Created By**: Brain Agent (Claude Code)
**Executed By**: Build Agent (Codex)

## Objective
Refactor the master/operation/accounts `_common/ListPage.vue` from a monolithic page into a **section-level component architecture** with per-resource custom overrides. Each visual section (Header, Report Bar, Search Toolbar, Record List) becomes an independently replaceable component. If a custom component exists for a specific resource (e.g., `Products/ListHeader.vue`), it is served; otherwise, the default component renders.

This enables resource-specific UI customization (e.g., Products showing Active/Inactive counts in its header) without duplicating the entire ListPage.

## Context

### Current State
- `_common/ListPage.vue` is the single list page for all resources, rendered via `ActionResolverPage.vue`'s two-level auto-discovery (custom entity page → `_common` fallback).
- The page uses three existing components inline: `MasterHeader.vue`, `MasterToolbar.vue`, and an inline card grid (duplicating `MasterList.vue`).
- `MasterHeader.vue` combines two concerns: header info (title, counts, refresh) AND report buttons.
- `MasterList.vue` and `MasterRecordCard.vue` exist in `components/Masters/` but `ListPage.vue` duplicates the card grid inline instead of using `MasterList.vue`.
- No custom entity list pages exist yet (`pages/Masters/` has only `_common/`).

### Target State
- `_common/ListPage.vue` becomes a thin orchestrator that discovers and renders 4 section components.
- Each section can be overridden per-resource via file convention.
- Default components live in `components/Masters/` (reusable).
- Custom components live in `pages/Masters/{EntityName}/` (resource-specific).

### Architecture Diagram
```
_common/ListPage.vue (orchestrator)
  ├── Section 1: Header       → default: MasterListHeader.vue     | custom: Products/ListHeader.vue
  ├── Section 2: ReportBar    → default: MasterListReportBar.vue   | custom: Products/ListReportBar.vue
  ├── Section 3: Toolbar      → default: MasterListToolbar.vue     | custom: Products/ListToolbar.vue
  └── Section 4: Records      → default: MasterListRecords.vue     | custom: Products/ListRecords.vue
```

### Key Design Decisions
1. **Section-level discovery, not page-level** — The existing `ActionResolverPage.vue` page-level discovery remains untouched. This plan adds a second layer: section-level discovery within `ListPage.vue`.
2. **Composable for section resolution** — A new `useListSectionResolver` composable encapsulates the `import.meta.glob` + async resolution logic, keeping `ListPage.vue` clean.
3. **Reports as a separate section** — Report buttons are decoupled from the header because they are an independent concern (config-driven, conditionally rendered) and should be overridable independently.
4. **Props contract per section** — Each section has a defined props interface. Custom components receive the same props as defaults, ensuring drop-in replacement.
5. **Rename default components** — Current `MasterHeader.vue` → `MasterListHeader.vue`, `MasterToolbar.vue` → `MasterListToolbar.vue` to clearly scope them to the List page context. The old names are removed (no backwards-compat shims).

## Pre-Conditions
- [x] `_common/ListPage.vue` reviewed — current template and script understood.
- [x] `MasterHeader.vue`, `MasterToolbar.vue`, `MasterList.vue`, `MasterRecordCard.vue` reviewed.
- [x] `ActionResolverPage.vue` two-level discovery pattern reviewed.
- [x] `useResourceData.js`, `useResourceConfig.js`, `useResourceRelations.js`, `useReports.js` composable APIs reviewed.
- [x] Component and Composable registries reviewed.

## Steps

### Step 1: Create `useListSectionResolver` Composable

Create a new composable that resolves section components for the list page using `import.meta.glob`.

- [ ] Create file `FRONTENT/src/composables/useListSectionResolver.js`.
- [ ] The composable accepts `resourceSlug` (Ref<String>) as argument.
- [ ] Use `import.meta.glob` to discover custom section components from `pages/Masters/*/List*.vue` (excluding `_common/`).
- [ ] Import the 4 default components statically as fallbacks.
- [ ] Export a function `resolveListSections(resourceSlug)` that returns reactive refs for each section component.
- [ ] Resolution logic per section:
  1. Convert `resourceSlug` to PascalCase (reuse the same logic as `ActionResolverPage.vue` — e.g., `products` → `Products`, `warehouse-storages` → `WarehouseStorages`).
  2. Check if custom glob has a match at path `../pages/Masters/{EntityName}/List{Section}.vue` (e.g., `../pages/Masters/Products/ListHeader.vue`).
  3. If match found → async import and return the component.
  4. If no match → return the default component.
- [ ] The composable must watch `resourceSlug` and re-resolve when it changes (user navigates between resources).
- [ ] Return shape:
  ```js
  {
    HeaderComponent,      // shallowRef — resolved component for header section
    ReportBarComponent,   // shallowRef — resolved component for report bar section
    ToolbarComponent,     // shallowRef — resolved component for toolbar section
    RecordsComponent,     // shallowRef — resolved component for records section
    sectionsReady         // computed<Boolean> — true when all 4 sections are resolved
  }
  ```

**Files**: `FRONTENT/src/composables/useListSectionResolver.js` (new)
**Pattern**: Follow the `import.meta.glob` + `markRaw` pattern from `FRONTENT/src/pages/Masters/ActionResolverPage.vue` lines 20-24, 40-79.
**Rule**: Custom globs must only scan `pages/Masters/*/List*.vue` (not `_common/`). Default components are always statically imported — never glob-resolved — to guarantee they exist.

#### Implementation Detail: Glob Paths

The composable file lives at `FRONTENT/src/composables/useListSectionResolver.js`. The glob paths must be **relative to this file's location**:

```js
// Custom section overrides — scans pages/Masters/{Entity}/List{Section}.vue
const customSectionModules = import.meta.glob(
  '../pages/Masters/*/List*.vue',
  { eager: false }  // lazy — only load when needed
)
```

This will match files like:
- `../pages/Masters/Products/ListHeader.vue`
- `../pages/Masters/Products/ListReportBar.vue`
- `../pages/Masters/Suppliers/ListRecords.vue`

But will NOT match:
- `../pages/Masters/_common/ListPage.vue` (starts with `_`, and `ListPage` is the orchestrator not a section)

#### Implementation Detail: Section Name Mapping

The 4 section file suffixes and their mapping:

| Section | Custom File Name | Default Component Import |
|---------|-----------------|-------------------------|
| Header | `ListHeader.vue` | `MasterListHeader.vue` |
| ReportBar | `ListReportBar.vue` | `MasterListReportBar.vue` |
| Toolbar | `ListToolbar.vue` | `MasterListToolbar.vue` |
| Records | `ListRecords.vue` | `MasterListRecords.vue` |

Resolution function (pseudocode):
```js
async function resolveSection(entityName, sectionName, defaultComponent) {
  const customPath = `../pages/Masters/${entityName}/List${sectionName}.vue`
  if (customSectionModules[customPath]) {
    try {
      const mod = await customSectionModules[customPath]()
      return markRaw(mod.default || mod)
    } catch (e) {
      console.warn(`[ListSectionResolver] Failed to load custom ${sectionName} for ${entityName}, using default`, e)
    }
  }
  return markRaw(defaultComponent)
}
```

---

### Step 2: Create `MasterListReportBar.vue` (Extract from MasterHeader)

Extract the report action bar from `MasterHeader.vue` into its own component.

- [ ] Create file `FRONTENT/src/components/Masters/MasterListReportBar.vue`.
- [ ] Move the report bar template from `MasterHeader.vue` (lines 49-72: the `<template v-if="toolbarReports.length">` block including the `<q-separator>` and `<q-card-section class="action-bar">`) into the new component.
- [ ] The new component renders as a standalone `<q-card>` (not a card-section, since it's no longer nested inside MasterHeader's card). Use the same styling approach as other section cards (flat, bordered, rounded, with the `action-bar` background).
- [ ] Props interface:
  ```js
  {
    reports: { type: Array, default: () => [] },
    isGenerating: { type: Boolean, default: false }
  }
  ```
- [ ] Computed `toolbarReports`: filter `reports` where `isRecordLevel !== true` (same logic as current MasterHeader line 112-114).
- [ ] Emit: `generate-report(report)`.
- [ ] The entire component should render nothing (empty template / `v-if="toolbarReports.length"`) when there are no toolbar-level reports. This keeps the section cleanly absent rather than showing an empty card.
- [ ] Move relevant styles (`.action-bar`, `.report-btn`) from `MasterHeader.vue` to this component.

**Files**: `FRONTENT/src/components/Masters/MasterListReportBar.vue` (new)
**Pattern**: Follow the card styling pattern from existing `MasterToolbar.vue` (flat bordered, 16px border-radius, `--master-border` color, `rise-in` animation).

---

### Step 3: Rename and Refactor `MasterHeader.vue` → `MasterListHeader.vue`

Rename the existing header component and remove the report bar section from it.

- [ ] Rename file: `FRONTENT/src/components/Masters/MasterHeader.vue` → `FRONTENT/src/components/Masters/MasterListHeader.vue`.
- [ ] Remove the report bar template block (the `<template v-if="toolbarReports.length">` section, lines 49-72).
- [ ] Remove the `reports` and `isGenerating` props (no longer needed — reports are in their own section).
- [ ] Remove the `generate-report` emit.
- [ ] Remove the `toolbarReports` computed property.
- [ ] The remaining props interface:
  ```js
  {
    config: { type: Object, default: null },
    filteredCount: { type: Number, default: 0 },
    totalCount: { type: Number, default: 0 },
    loading: { type: Boolean, default: false },
    backgroundSyncing: { type: Boolean, default: false }
  }
  ```
- [ ] The remaining emit: `reload`.
- [ ] Keep all existing header styles (`.header-card`, `.header-title`, `.header-subtitle`, `.header-stats`, `.mini-stat`, `.mini-label`, `.mini-value`, `.sync-indicator`, animations).
- [ ] Remove the now-unused `.action-bar` and `.report-btn` styles.

**Files**: `FRONTENT/src/components/Masters/MasterListHeader.vue` (renamed from `MasterHeader.vue`)
**Rule**: Delete the old `MasterHeader.vue` file. Do NOT keep it as a re-export wrapper.

---

### Step 4: Rename `MasterToolbar.vue` → `MasterListToolbar.vue`

- [ ] Rename file: `FRONTENT/src/components/Masters/MasterToolbar.vue` → `FRONTENT/src/components/Masters/MasterListToolbar.vue`.
- [ ] No internal changes needed — the component's props/events/template remain the same.
- [ ] Props interface (unchanged):
  ```js
  {
    searchTerm: { type: String, default: '' }
  }
  ```
- [ ] Emit (unchanged): `update:searchTerm(value)`.

**Files**: `FRONTENT/src/components/Masters/MasterListToolbar.vue` (renamed from `MasterToolbar.vue`)
**Rule**: Delete the old `MasterToolbar.vue` file. Do NOT keep it as a re-export wrapper.

---

### Step 5: Create `MasterListRecords.vue` (Extract from ListPage)

Extract the record list section from `_common/ListPage.vue` into a dedicated default component.

- [ ] Create file `FRONTENT/src/components/Masters/MasterListRecords.vue`.
- [ ] Move the card grid template from `_common/ListPage.vue` (lines 20-63: the `<q-card flat bordered class="records-card">` block) into this new component.
- [ ] This component should use the existing `MasterRecordCard.vue` for individual cards (just like the existing `MasterList.vue` does).
- [ ] Props interface:
  ```js
  {
    items: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    resolvedFields: { type: Array, default: () => [] },
    childCountMap: { type: Object, default: () => ({}) }
  }
  ```
- [ ] The component itself handles `resolvePrimaryText(row)` and `resolveSecondaryText(row)` internally using `resolvedFields` prop (move these functions from `ListPage.vue` into this component). This keeps the text resolution logic co-located with the card rendering.
- [ ] Emit: `navigate-to-view(row)` — emitted when a card is clicked.
- [ ] Include the child count badges (`childCountMap`) rendering per card (lines 41-51 from current `ListPage.vue`). This means `MasterListRecords.vue` renders `MasterRecordCard` plus child badges, or alternatively extends `MasterRecordCard` to accept `childCounts` prop. **Recommended approach**: Pass `childCountMap` as a prop to `MasterListRecords.vue`, and render child badges as part of this component's template (wrapping each `MasterRecordCard` with an additional badge row). Do NOT modify `MasterRecordCard.vue` — keep it simple.
- [ ] Move relevant styles (`.records-card`, `.empty-state`, `.card-list`, `.record-card`, `.record-code`, `.record-name`, `.record-secondary`, `.record-children`, `.status-badge`, media queries, `rise-in` animation) from `ListPage.vue` to this component.

**Files**: `FRONTENT/src/components/Masters/MasterListRecords.vue` (new)
**Pattern**: This replaces the inline card grid in `ListPage.vue`. The existing `MasterList.vue` component does similar work but lacks `childCountMap` support and `resolvedFields`-based text resolution. See decision note below.

#### Decision: What to do with existing `MasterList.vue`

The existing `MasterList.vue` component (`components/Masters/MasterList.vue`) overlaps with the new `MasterListRecords.vue`. Key differences:
- `MasterList.vue` accepts `resolvePrimaryText` and `resolveSecondaryText` as **function props**.
- `MasterListRecords.vue` accepts `resolvedFields` and computes text internally.
- `MasterListRecords.vue` supports `childCountMap`.

**Action**: Delete `MasterList.vue`. It is not used by `ListPage.vue` (which has an inline duplicate), and the new `MasterListRecords.vue` is its replacement. Also delete `MasterRecordCard.vue` only if it's fully absorbed into `MasterListRecords.vue` — but per the design above, `MasterRecordCard.vue` is still used as a child component, so **keep it**.

Check whether `MasterList.vue` is imported anywhere else before deleting:
- [ ] Search for `MasterList` imports across the entire frontend codebase. If used elsewhere, keep it; if only in registry docs, delete it.

---

### Step 6: Refactor `_common/ListPage.vue` to Use Section Resolver

This is the core refactoring step. Transform `ListPage.vue` from rendering sections directly to using the section resolver.

- [ ] Import `useListSectionResolver` composable.
- [ ] Remove direct imports of `MasterHeader`, `MasterToolbar` (these are now resolved dynamically).
- [ ] Keep imports of: `ReportInputDialog` (dialog is not a section — it's a modal overlay), `useResourceConfig`, `useResourceData`, `useResourceRelations`, `useReports`.
- [ ] Call the section resolver:
  ```js
  const { HeaderComponent, ReportBarComponent, ToolbarComponent, RecordsComponent, sectionsReady } = useListSectionResolver(resourceSlug)
  ```
- [ ] Replace the template to use dynamic components:
  ```html
  <template>
    <div class="list-page" v-if="sectionsReady">
      <component
        :is="HeaderComponent"
        :config="config"
        :filtered-count="filteredItems.length"
        :total-count="items.length"
        :loading="loading"
        :background-syncing="backgroundSyncing"
        @reload="reload(true)"
      />

      <component
        :is="ReportBarComponent"
        :reports="config?.reports || []"
        :is-generating="isGenerating"
        @generate-report="(report) => initiateReport(report)"
      />

      <component
        :is="ToolbarComponent"
        :search-term="searchTerm"
        @update:search-term="searchTerm = $event"
      />

      <component
        :is="RecordsComponent"
        :items="filteredItems"
        :loading="loading"
        :resolved-fields="resolvedFields"
        :child-count-map="childCountMap"
        @navigate-to-view="navigateToView"
      />

      <!-- FAB for Add -->
      <q-page-sticky position="bottom-right" :offset="[16, 22]" class="fab-sticky">
        <q-btn
          v-if="permissions.canWrite"
          round
          unelevated
          icon="add"
          color="primary"
          class="fab-btn"
          @click="navigateToAdd"
        >
          <q-tooltip>Add New</q-tooltip>
        </q-btn>
      </q-page-sticky>

      <ReportInputDialog
        v-model="showReportDialog"
        :report="activeReport"
        :form-values="reportInputs"
        :is-generating="isGenerating"
        @update:form-values="reportInputs = $event"
        @confirm="confirmReportDialog"
        @cancel="cancelReportDialog"
      />
    </div>
    <div v-else class="list-page-loading">
      <q-spinner-dots color="primary" size="32px" />
    </div>
  </template>
  ```
- [ ] Remove `resolvePrimaryText` and `resolveSecondaryText` functions from `ListPage.vue` (moved to `MasterListRecords.vue` in Step 5).
- [ ] Remove the inline card grid template and its styles (moved to `MasterListRecords.vue` in Step 5).
- [ ] Keep: `navigateToView`, `navigateToAdd`, `computeChildCounts`, `childCountMap`, FAB button, `ReportInputDialog`, and all composable wiring.
- [ ] Keep the `watch` on `resourceName` that triggers `reload()` and `computeChildCounts()`.
- [ ] Remove styles that were moved to section components (`.records-card`, `.empty-state`, `.card-list`, `.record-card`, etc.). Keep only `ListPage`-level styles (`.list-page`, `.fab-btn`, `.fab-sticky`).

**Files**: `FRONTENT/src/pages/Masters/_common/ListPage.vue` (modify)
**Pattern**: The template now uses Vue's `<component :is="">` pattern, same as `ActionResolverPage.vue`.
**Rule**: `ListPage.vue` remains the single orchestrator. It owns layout, composable wiring, navigation, FAB, and dialog. It does NOT own section rendering logic.

---

### Step 7: Update All Import References

After renaming `MasterHeader.vue` → `MasterListHeader.vue` and `MasterToolbar.vue` → `MasterListToolbar.vue`, update all files that import them.

- [ ] Search the entire `FRONTENT/src/` directory for imports of `MasterHeader` and `MasterToolbar`.
- [ ] Expected locations based on current codebase:
  - `_common/ListPage.vue` — already handled in Step 6 (imports removed, now dynamic).
  - Any other pages that import these directly must be updated.
- [ ] If `MasterHeader` or `MasterToolbar` are imported in `ViewPage.vue`, `AddPage.vue`, or `EditPage.vue`, update those imports to use the new names. However, based on the current architecture, these components are only used in `ListPage.vue`, so this step may be a no-op beyond Step 6.
- [ ] Search for string references to `MasterHeader` and `MasterToolbar` in any JS/Vue files (template refs, component names in devtools, etc.) and update them.
- [ ] Delete the old files if not already done in Steps 3-4:
  - Delete `FRONTENT/src/components/Masters/MasterHeader.vue`
  - Delete `FRONTENT/src/components/Masters/MasterToolbar.vue`
  - Delete `FRONTENT/src/components/Masters/MasterList.vue` (if confirmed unused in Step 5)

**Files**: Multiple files across `FRONTENT/src/`
**Rule**: After this step, zero references to the old component names should exist in the codebase. Run a grep to confirm.

---

### Step 8: Update Component and Composable Registries

Update the registry files to reflect all changes.

- [ ] Update `FRONTENT/src/components/REGISTRY.md`:
  - Remove entry for `MasterHeader`.
  - Remove entry for `MasterToolbar`.
  - Remove entry for `MasterList` (if deleted).
  - Add entry for `MasterListHeader` with updated props (no `reports`, no `isGenerating`), updated events (no `generate-report`).
  - Add entry for `MasterListReportBar` with props (`reports`, `isGenerating`) and events (`generate-report`).
  - Add entry for `MasterListToolbar` (same props/events as old `MasterToolbar`).
  - Add entry for `MasterListRecords` with props (`items`, `loading`, `resolvedFields`, `childCountMap`) and events (`navigate-to-view`).
  - Keep `MasterRecordCard` entry unchanged.

- [ ] Update `FRONTENT/src/composables/REGISTRY.md`:
  - Add entry for `useListSectionResolver`:
    - Description: Resolves section components for the List page using two-level auto-discovery (custom entity override → default fallback).
    - Arguments: `(resourceSlug: Ref<String>)`
    - Returns: `{ HeaderComponent, ReportBarComponent, ToolbarComponent, RecordsComponent, sectionsReady }`
    - Path: `FRONTENT/src/composables/useListSectionResolver.js`

**Files**: `FRONTENT/src/components/REGISTRY.md`, `FRONTENT/src/composables/REGISTRY.md`

---

### Step 9: Update Documentation

- [ ] Update `Documents/CONTEXT_HANDOFF.md` — in the "Frontend master module" section (around line 126-139), update to reflect:
  - Master page architecture is now section-level componentized.
  - List page sections: `MasterListHeader`, `MasterListReportBar`, `MasterListToolbar`, `MasterListRecords`.
  - **Section-level Discovery Pattern**: Custom section components at `pages/Masters/{EntityName}/List{Section}.vue` override defaults automatically.
  - Composable: `useListSectionResolver` handles section resolution.
  - Old component names (`MasterHeader`, `MasterToolbar`, `MasterList`) are removed.

**Files**: `Documents/CONTEXT_HANDOFF.md`

---

### Step 10: Verify No Regressions

This step is for validation after implementation.

- [ ] Run `npm run lint` (or the project's lint command) from `FRONTENT/` to check for import errors and unused references.
- [ ] Run `npm run build` from `FRONTENT/` to verify the production build succeeds (Vite will fail on broken imports).
- [ ] Manually verify (or describe for the reviewer):
  - Navigate to any master resource (e.g., `/masters/products`) — all 4 sections render correctly with default components.
  - Navigate between resources (e.g., products → suppliers) — sections re-resolve without errors.
  - Report bar only appears for resources that have toolbar-level reports configured.
  - Search filtering still works.
  - Card click navigates to view page.
  - FAB add button works.
  - Report generation still works end-to-end.
- [ ] Confirm zero references to old component names (`MasterHeader`, `MasterToolbar`, `MasterList`) exist in the codebase:
  ```bash
  grep -r "MasterHeader\b" FRONTENT/src/ --include="*.vue" --include="*.js"
  grep -r "MasterToolbar\b" FRONTENT/src/ --include="*.vue" --include="*.js"
  grep -r "MasterList\b" FRONTENT/src/ --include="*.vue" --include="*.js"
  ```
  (Should return zero results, except `MasterListHeader`, `MasterListToolbar`, `MasterListRecords` which contain the old names as substrings — use word boundary `\b` to avoid false positives.)

**Files**: N/A (validation step)

---

## Section Props Contract Reference (Quick Reference for Build Agent)

| Section | Component | Props | Events |
|---------|-----------|-------|--------|
| Header | `MasterListHeader` | `config: Object`, `filteredCount: Number`, `totalCount: Number`, `loading: Boolean`, `backgroundSyncing: Boolean` | `reload` |
| ReportBar | `MasterListReportBar` | `reports: Array`, `isGenerating: Boolean` | `generate-report(report)` |
| Toolbar | `MasterListToolbar` | `searchTerm: String` | `update:searchTerm(value)` |
| Records | `MasterListRecords` | `items: Array`, `loading: Boolean`, `resolvedFields: Array`, `childCountMap: Object` | `navigate-to-view(row)` |

## Custom Override File Convention

To override a section for a specific resource, create a `.vue` file at:
```
FRONTENT/src/pages/Masters/{EntityName}/List{Section}.vue
```

Where:
- `{EntityName}` is the PascalCase version of the resource slug (e.g., `products` → `Products`, `warehouse-storages` → `WarehouseStorages`)
- `{Section}` is one of: `Header`, `ReportBar`, `Toolbar`, `Records`

The custom component must accept the same props as its default counterpart (see table above). It may ignore props it doesn't need.

Examples:
- `FRONTENT/src/pages/Masters/Products/ListHeader.vue` — custom header for Products
- `FRONTENT/src/pages/Masters/Suppliers/ListRecords.vue` — custom record list for Suppliers

## Documentation Updates Required
- [x] Update `FRONTENT/src/components/REGISTRY.md` (Step 8).
- [x] Update `FRONTENT/src/composables/REGISTRY.md` (Step 8).
- [x] Update `Documents/CONTEXT_HANDOFF.md` (Step 9).

## Acceptance Criteria
- [x] `_common/ListPage.vue` renders 4 section components via `<component :is="">` instead of direct imports.
- [x] `useListSectionResolver` composable correctly resolves custom -> default fallback per section.
- [x] `MasterListHeader.vue` exists and renders title, counts, refresh (no reports).
- [x] `MasterListReportBar.vue` exists and renders toolbar-level report buttons (or nothing if no reports).
- [x] `MasterListToolbar.vue` exists and renders search input.
- [x] `MasterListRecords.vue` exists and renders the card grid with child count badges.
- [x] Old files (`MasterHeader.vue`, `MasterToolbar.vue`, `MasterList.vue`) are deleted.
- [x] Zero import errors � `npm run build` succeeds.
- [ ] No regressions in list page behavior: search, navigation, reports, FAB all work.
- [x] Component and composable registries are updated.
- [x] `CONTEXT_HANDOFF.md` reflects the new architecture.
- [x] Creating a file at `pages/Masters/Products/ListHeader.vue` would be picked up automatically by the resolver (verified by the glob pattern).

## Post-Execution Notes (Build Agent fills this)
*(Status Update Discipline: Ensure you change `Status` to `IN_PROGRESS` or `COMPLETED` and update `Executed By` at the top of the file before finishing.)*
*(Identity Discipline: Always replace `[AgentName]` with the concrete agent/runtime identity used in that session. Build Agent must remove `| pending` when execution completes.)*

### Progress Log
- [x] Step 1 completed — `useListSectionResolver` composable created
- [x] Step 2 completed — `MasterListReportBar.vue` created
- [x] Step 3 completed — `MasterHeader.vue` renamed to `MasterListHeader.vue`, reports removed
- [x] Step 4 completed — `MasterToolbar.vue` renamed to `MasterListToolbar.vue`
- [x] Step 5 completed — `MasterListRecords.vue` created, `MasterList.vue` deleted
- [x] Step 6 completed — `_common/ListPage.vue` refactored to use section resolver
- [x] Step 7 completed — All import references updated, old files deleted
- [x] Step 8 completed — Registries updated
- [x] Step 9 completed — Documentation updated
- [x] Step 10 completed — Validation executed (build passed; lint script unavailable)

### Deviations / Decisions
- [ ] `[?]` Decision needed:
- [x] `[!]` Issue/blocker: `npm run lint` script is missing in FRONTENT/package.json; lint could not be executed.

### Files Actually Changed
- `FRONTENT/src/composables/useListSectionResolver.js` (new)
- `FRONTENT/src/components/Masters/MasterListReportBar.vue` (new)
- `FRONTENT/src/components/Masters/MasterListHeader.vue` (renamed + modified from MasterHeader.vue)
- `FRONTENT/src/components/Masters/MasterListToolbar.vue` (renamed from MasterToolbar.vue)
- `FRONTENT/src/components/Masters/MasterListRecords.vue` (new)
- `FRONTENT/src/components/Masters/MasterHeader.vue` (deleted)
- `FRONTENT/src/components/Masters/MasterToolbar.vue` (deleted)
- `FRONTENT/src/components/Masters/MasterList.vue` (deleted)
- `FRONTENT/src/pages/Masters/_common/ListPage.vue` (modified)
- `FRONTENT/src/components/REGISTRY.md` (updated)
- `FRONTENT/src/composables/REGISTRY.md` (updated)
- `Documents/CONTEXT_HANDOFF.md` (updated)

### Validation Performed
- [ ] Lint check passed
- [x] Build check passed
- [ ] Manual/functional validation completed
- [ ] Acceptance criteria verified

### Manual Actions Required
- [x] None — this is a frontend-only refactoring with no GAS or sheet changes.


