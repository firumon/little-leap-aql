# AQL Create & Update Content Systems

This document is the complete canonical reference for the `Create` **and** `Update` content systems — the resource create/edit forms built from [Create.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/contents/Create.vue), [Update.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/contents/Update.vue), [FormRecord.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/contents/FormRecord.vue), and [FormChild.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/contents/FormChild.vue). It is a sibling document to [UI_CONTENT_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_CONTENT_SYSTEM.md), which covers the general `contents:` resolver, `List`, and `View`; `Create`/`Update` share that same resolver mechanics (§1 there) but have enough surface area (zero-hardcoding prop contract, five-step visibility precedence, three independent override hierarchies, custom-field storage rule, hydration lifecycle, child soft-deletion) to warrant their own canonical doc.

`Create.vue` (content name `Create`, component name `ContentsCreate`) and `Update.vue` (content name `Update`, component name `ContentsUpdate`) are the framework's default create/edit contents, resolved exactly like `List`/`View`:

```javascript
// src/pages/Master/create.js
export default {
  sections: ['PageHeader'],
  contents: ['Create'],
}

// src/pages/Master/edit.js
export default {
  sections: ['PageHeader'],
  contents: ['Update'],
}
```

`PageAction` is **not** listed in `sections` — `Page.vue` mounts the Action subsystem (`<Action action="PageAction" />`) and the workflow `ActionDialog` unconditionally for every resource page, gated only by `pageProps.noActions !== true`. Set `noActions: true` in a page contract (or a JS modifier) to suppress both.

**The two are twins, not variants.** `Update.vue` mirrors `Create.vue`'s structure, prop surface, section layout, child resolution, and override paths almost exactly; the differences are confined to (a) hydration of the existing server record and its child rows (§13), (b) its `Code`/`Status` prop defaults (`showCode: true` on the primary form, `childShowCode: false` on child forms, `codeReadonly: true`, `showStatus: true`), and (c) `FormChild`'s soft-deletion behaviour for persisted rows (§14). Everywhere this doc says "`Create`" without qualification, the statement holds for `Update` too.

---

## 1. Overview & Contracts
- `Create.vue` / `Update.vue` inject `resourceConfig`, `resourceRecord`, and `pageState` (all provided once at `Page.vue`) exactly like `View.vue`.
- **State binding, not fetching**: `Create` never calls services/stores directly (per §1/§3/§5 of `CORE_ARCHITECTURE_RULES.md`) — every keystroke lands in the shared `pageState` reactive tree via `setField`/`setControlField`/`addChild`/`updateChild`, and `PageAction` sections own `submit()`/`build()`.
- **Primary node lifecycle**: on mount, and whenever `resourceConfig.resourceName` changes to a *different* resource, `Create.vue` calls `pageState.initResource(name, { isPrimaryKey: true, reset: true })`. This flushes any stale node/child-bucket data left in `pageState` from a previously-visited Create/Update page (the composable instance is provided once per `Page.vue` mount and persists across in-app navigations) and sets `state.primaryKey` to the active resource. If the resource name is unchanged but the node was cleared some other way, it re-initializes without wiping other nodes (`reset` omitted).
- **Parent Relations Constraint**: `Create` never renders a form for a parent relation — only the active resource's own fields and its **children** (resources whose `ParentResource` equals the active resource).
- **Child Relations Rule**: child resources are read from the injected `resourceRecord.childResources`, filtered to `child.parentResource === resourceName` (in `master` scope, only `master`-scoped children are surfaced — mirrors `ViewChildren`), then further filtered by `hideChild`/`hideChildren` (see §10). If `withChildren` is `true` (default) and at least one eligible, non-hidden child exists, `Create` renders the primary `FormRecord` **and** one `FormChild` per child resource; otherwise it renders only the primary `FormRecord`.
- **Field visibility precedence — `showFields` > `hideFields` > `workflowFields`**: `FormRecord` builds an explicit hidden-set in that exact order (see §4). There is no `DEFAULT_CREATE_HIDDEN_FIELDS` constant; workflow hiding is dynamic pattern matching. Audit `Created*/Updated*` columns are stripped earlier by `useFormFields`.
- **`Status` handling**: hidden by default and seeded with `statusDefault` (`'Active'`), so it submits without being editable. Pass `showStatus: true` (or `'show'`) — or list `'Status'` in `showFields` — to render it as a normal control instead, in which case it is **not** auto-seeded. Only applies when the resource actually has a `Status` column.
- **Default value seeding**: any `defaultValues` entry whose header is currently `undefined` on the record is seeded the same way. `defaultValues` may be an object, a function, or an object of functions — see §5. Backend-authored `APP.Resources.DefaultValues` metadata is also folded into the same seeding pass, at the lowest precedence — see §5.1.
- **Control rendering is type-driven, never hardcoded**: `FormRecord` contains no `field.type === '…'` branches and no Quasar control map. `useFormFields.mapField` resolves each field's props **and** its `fieldType`; the control is then mounted by `resolveFieldComponent(field.fieldType, mode)` → `_fields/<type>/<Add|Edit>.vue` — see §15.
- **Date fields**: date controls (field type `date`/`datetime`, or any header ending in `Date`) render through `_fields/date/Add.vue`, which wraps [app/Date.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/app/Date.vue) and defaults an empty value to today (`YYYY-MM-DD`) on mount.
- **AppOptions selects**: when `useFormFields` finds an `AppOptions` group keyed `<ResourceName><Column>` (trying the resource name as-is, singular, and plural — e.g. `ProductsType`/`ProductType`), that column resolves to `fieldType: 'select'` and renders through `_fields/select/Add.vue` (a filterable `QSelect`) populated from the group's values.
- **Child record caps**: `FormChild`'s `maxRecords` prop (default `0` = unlimited) caps how many added record entries a child bucket may hold — see §12.
- **Dynamic child suppression**: alongside `hideChild`/`hideChildren`, `Create` also honors a dynamic `hide<ResourceName>: true` (or `hide<Slug>` / `hide<PascalName>`) prop or `$attrs` flag per eligible child — see §11.
- **`Update` hydration**: `Update.vue` does not init a blank node — it loads the already-fetched `resourceRecord.record` into the primary node via `pageState.load()` and pre-populates each child bucket from `resourceRecord.childRecordsByResource` as `_action: 'update'` rows. Hydration is idempotent and guarded so it never clobbers in-progress edits — see §13.
- **`Update` child removal is a soft delete**: removing a server-persisted child row flips it to `_action: 'deactivate'` (GAS sets `Status = 'Inactive'`) rather than dropping it from the payload — see §14.

---

## 2. Zero-Hardcoding Contract

All three components follow one rule: **any built-in default value, label, icon, colour, CSS class, or behaviour is exposed as a prop.** Nothing in `Create`/`FormRecord`/`FormChild` requires a Vue SFC override just to change a string, a colour, a card style, or a dialog width — reach for a `.vue` override only when the *structure* differs.

They also all declare `inheritAttrs: false` and forward `useAttrs()` explicitly:
- **`Create.vue`** merges `attrs` into `primaryFormProps` (the primary `FormRecord`) and into every `FormChild` section's props.
- **`FormRecord.vue`** merges `attrs` into the resolved whole-form override's props, the card wrapper's props, and **every field control's** props (before field-specific props, so explicit field props always win).
- **`FormChild.vue`** merges `attrs` into `AppList` and into every inner `FormRecord` (draft form, dialog form, and each `multi` row).

Precedence everywhere is: `...attrs` → explicit component props → caller escape hatch (`formRecordProps` / `formChildProps` / `listProps`) → per-child JS modifier result.

---

## 3. Component Anatomy & Props

**`Create.vue`** — orchestrator; resolves eligible children (plus any per-child `FormChild` override), owns the primary pageState node, and lays out one section per record/child group with a staggered entrance (matching `View.vue`'s `aql-view-section`).

| Prop | Type | Default | Description |
|---|---|---|---|
| `withChildren` | `Boolean` | `true` | Master switch — when `false`, only the primary `FormRecord` renders even if child resources exist. |
| `hideChild` / `hideChildren` | `String`\|`Array` | `null` | Suppresses specific eligible child resources from rendering, matched case-insensitively by resource name **or** slug. Accepts a single string or an array; both props are equivalent and merged together. See §11. |
| `childMode` | `String` | `'inline'` | Forwarded to every `FormChild`: `'inline'`, `'popup'`, `'multi'`/`'multiple'`. |
| `listPosition` | `String` | `'top'` | Forwarded to every `FormChild` — added-records list above or below the entry form. |
| `closeOnAdd` | `Boolean` | `true` | Forwarded to `FormChild` (popup mode only) — whether the dialog auto-closes after a successful Add. |
| `hideFields` | `Array` | `[]` | Extra field headers to hide, applied to both the primary form and every child form. |
| `showFields` | `Array` | `[]` | **Highest-precedence** visibility switch — forces these headers visible over `hideFields`/`showCode`/`workflowFields`/`Status`. Forwarded to the primary form and every child form. |
| `showCode` | `Boolean` | `false` | `Code` is server-generated and hidden by default; `true` renders it as a normal, fully editable control. Forwarded to the primary form and every child form. |
| `hideParentLink` | `Boolean` | `true` | Hides `ParentCode` / `<SingularParent>Code` on child forms (filled by `compositeSave`). Set `false` to render them. |
| `childHideFields` | `Array` | `[]` | Extra headers hidden on child forms only (on top of `hideFields`). |
| `workflowFields` | `String`\|`Boolean` | `'hide'` | Forwarded to the primary `FormRecord` + children — `'hide'`/`false` hides workflow action-stamp headers, `'show'`/`true` renders them. |
| `showStatus` | `Boolean`\|`String` | `false` | Forwarded — `true`/`'show'` renders `Status` as an editable control instead of hiding + seeding it. |
| `statusDefault` | `String` | `'Active'` | Forwarded — the value seeded for `Status` while hidden. |
| `fields` | `Array` | `null` | Explicit primary-field ordering, forwarded straight to the primary `FormRecord`. |
| `defaultValues` | `Object`\|`Function` | `{}` | Forwarded to the primary `FormRecord` — see §5. Layered on top of backend `APP.Resources.DefaultValues` (§5.1). |
| `fieldProps` | `Object`\|`Function` | `{}` | Per-field control prop overrides keyed by header — forwarded to the primary form and every child form. See §6. |
| `columns` | `Number` | `1` | Forwarded to every `FormRecord`/`FormChild` — responsive field-grid column count. |
| `title` | `String` | `''` | Section-divider title above the primary form. |
| `recordTitleFallback` | `String` | `'Details'` | Title used for the primary section when `title` is empty **and** children exist (empty otherwise). |
| `sectionTitles` | `Object` | `{}` | Per-child title overrides keyed by child resource name, e.g. `{ ProductVariants: 'Variants' }`. |
| `formRecordProps` | `Object` | `{}` | Escape hatch merged last into the primary `FormRecord`'s props. |
| `formChildProps` | `Object` | `{}` | Escape hatch merged last into every `FormChild`'s props. |
| `sectionClass` | `String`\|`Array`\|`Object` | `'cf-section'` | Wrapper class per section (carries the entrance animation). |
| `sectionStagger` | `Number` | `60` | Per-section entrance delay in ms; `0` disables the stagger. |

**`Update.vue`** — the edit-side twin of `Create.vue` (content name `Update`, component `ContentsUpdate`). Identical section layout, child resolution, per-child override paths, and `$attrs` forwarding; it differs only by hydrating the existing record + child rows (§13) and by a handful of prop defaults. Its prop surface is `Create.vue`'s **plus** `codeReadonly` and `childShowCode`, with these defaults changed:

| Prop | Type | `Create` default | `Update` default | Description |
|---|---|---|---|---|
| `showCode` | `Boolean` | `false` | **`true`** | Governs the **primary** form only. An edit form shows the existing `Code` so the user can see which record they are editing. |
| `childShowCode` | `Boolean` | *(n/a)* | **`false`** | Governs **`FormChild`** sections, decoupled from `showCode`. A child row's `Code` carries no "which record am I editing" context, so it stays hidden even though the primary `Code` is shown. Set `true` to surface it. |
| `codeReadonly` | `Boolean` | *(n/a)* | **`true`** | Applies `readonly` to the `Code` control wherever it *is* visible — the primary form, and any `FormChild` where `childShowCode` (or `showFields: ['Code']`) has surfaced it. Layered **under** any caller-supplied `fieldProps.Code` (object or per-header function), so a page-level override always wins. Set `false` to make `Code` editable everywhere. |
| `showStatus` | `Boolean`\|`String` | `false` | **`true`** | An edit form renders `Status` as a normal control (and therefore does **not** auto-seed it with `statusDefault`). |

Every other prop is declared identically to `Create.vue` with the same default and meaning — `withChildren` (`true`), `hideChild`/`hideChildren` (`null`), `childMode` (`'inline'`), `closeOnAdd` (`true`), `listPosition` (`'top'`), `hideFields` (`[]`), `showFields` (`[]`), `hideParentLink` (`true`), `childHideFields` (`[]`), `workflowFields` (`'hide'`), `statusDefault` (`'Active'`), `fields` (`null`), `defaultValues` (`{}`), `fieldProps` (`{}`), `columns` (`1`), `title` (`''`), `recordTitleFallback` (`'Details'`), `sectionTitles` (`{}`), `formRecordProps` (`{}`), `formChildProps` (`{}`), `sectionClass` (`'cf-section'`), `sectionStagger` (`60`). See the `Create.vue` table above for each one's description.

Three behavioural nuances:

- **`Code` visibility is split primary vs child.** `showCode` (`true`) drives only `primaryFormProps`; `defaultChildProps(child)` forwards `childShowCode` (`false`) as each `FormChild`'s own `showCode`. So an `Update` page shows the primary record's `Code` and hides every child row's `Code` by default. Surfacing a child `Code` is possible five ways, in ascending narrowness:
  1. `childShowCode: true` on `Update` — every child section.
  2. `formChildProps: { showCode: true }` on `Update` — every child section (spread after `showCode` in `defaultChildProps`, so it wins).
  3. `showFields: ['Code']` — highest-precedence visibility switch (§4 step 5); beats `showCode: false` on **both** primary and child forms.
  4. A per-child JS modifier `FormChild<ChildName>.js` returning `{ showCode: true }` — one child only (merged as `{ ...baseProps, ...jsRes }`).
  5. A per-child Vue SFC override `FormChild<ChildName>.vue` — one child, full control.
- **`codeReadonly` still covers child forms, when they show `Code` at all.** `Update.vue` builds one `resolvedFieldProps` map (its `fieldProps` prop with `Code: { readonly: true }` layered underneath) and passes that same map to **both** `primaryFormProps` and `defaultChildProps(child)`. With `childShowCode: false` the readonly layer is simply inert on children; the moment any route above surfaces a child `Code`, it renders read-only rather than editable — which is the safe default, since GAS locates a child row by that Code (§13.2, §14). To make it editable, set `codeReadonly: false`, or supply a `fieldProps.Code` / `formChildProps.fieldProps` override, or a `FormChild<ChildName>.js` modifier — all merged **after** the readonly layer.
- **`defaultValues` cannot force-change a persisted value.** On an edit form it only fills headers the **stored record leaves `undefined`**, since `FormRecord` never overwrites an existing value (§5).

**`FormRecord.vue`** — atomic bottom-layer form renderer, the form counterpart of `ViewRecord.vue`. Reused **unchanged** by both `Create` and `Update`: it is purely presentational, reading from `record` and emitting `update:field`, never touching `pageState` itself. The caller (`Create.vue`/`Update.vue` for the primary record, `FormChild.vue` for child rows) decides where each emitted field lands.

| Prop | Type | Default | Description |
|---|---|---|---|
| `resource` | `String` | required | Resource name — resolves the control schema via `useFormFields`. |
| `record` | `Object` | required | The reactive target object driving every control's `model-value` (a `pageState` node's `.record`, or a child row's `.data`). |
| `mode` | `String` | `'add'` | Render mode handed to the `_fields` resolver — `'add'` → `_fields/<type>/Add.vue`, `'edit'` → `Edit.vue` (§15). `Create.vue` leaves the default; `Update.vue` passes `'edit'`; `FormChild` passes `'edit'` only while re-opening an already-added row. |
| `title` | `String` | `''` | Optional `SectionDividerLabel` above the fields; empty renders no divider. |
| `hideFields` | `Array` | `[]` | Field headers to exclude from rendering (step 4 of the precedence chain). |
| `showFields` | `Array` | `[]` | **Highest precedence** — forces these headers visible regardless of `hideFields`, `workflowFields`, the `Status` default, or the `Code` default (step 5). |
| `workflowFields` | `String`\|`Boolean` | `'hide'` | `'hide'`/`false` excludes headers matching `/(.+?)(By\|At\|Comment)$/`; `'show'`/`true` renders them like any other field (step 1). |
| `showStatus` | `Boolean`\|`String` | `false` | `false`/`'hide'` → `Status` hidden and seeded with `statusDefault`; `true`/`'show'` → rendered as a normal editable control (and not auto-seeded). Step 2. |
| `statusDefault` | `String` | `'Active'` | Value seeded into `Status` while hidden. Set `null` to skip seeding entirely. |
| `showCode` | `Boolean` | `false` | `false` → `Code` hidden (step 3); `true` → rendered as a normal, fully editable control (`useFormFields` no longer marks it `disable: true`). |
| `fields` | `Array` | `null` | Explicit field ordering. A header not present in the resource's resolved schema is treated as a **custom (non-schema) field** — see §7. `null`/omitted falls back to natural schema order. |
| `defaultValues` | `Object`\|`Function` | `{}` | Seed values — see §5. Merged over `APP.Resources.DefaultValues` (backend schema metadata, resolved via `useResourceConfig(resource).defaultValues` — §5.1). |
| `fieldProps` | `Object`\|`Function` | `{}` | Per-field control prop overrides keyed by header — merged over the `useFormFields` base props and under any `FormField<Header>.js` modifier. See §6. |
| `columns` | `Number` | `1` | `1` → `colClass`; `>1` → `colClassMulti` responsive grid. |
| `scope` / `resourceSlug` / `uiName` | `String` | `''` | Content-resolver identity for this specific form's own overrides (§8) — the caller must pass these explicitly (mirrors `ViewRecord`'s props); `FormRecord` does not infer them from injected `resourceConfig`. |
| `card` | `Boolean` | `true` | Wraps fields in a `q-card` when `true`; renders bare (`:card="false"`) when hosted inside a dialog or a `FormChild` `multi` row card that supplies its own chrome. |
| `cardClass` | `String`\|`Array`\|`Object` | `'aql-premium-gradient-form'` | Card class when `card` is on. |
| `cardFlat` / `cardBordered` | `Boolean` | `true` / `true` | Card elevation/border. |
| `gridClass` | `String`\|`Array`\|`Object` | `'row q-col-gutter-x-md'` | Field-grid container class. |
| `fieldClass` | `String`\|`Array`\|`Object` | `'aql-form-field q-py-xs'` | Per-field wrapper class (carries the rise-in animation). |
| `colClass` | `String` | `'col-12'` | Column span class when `columns === 1`. |
| `colClassMulti` | `String` | `'col-12 col-sm-6'` | Column span class when `columns > 1`. |
| `emptyText` | `String` | `'No fields configured for this resource.'` | Shown when no field survives filtering. |
| `emptyClass` | `String`\|`Array`\|`Object` | `'text-grey-6 text-center q-pa-md'` | Empty-state class. |
| `fieldStagger` | `Number` | `40` | Per-field entrance delay in ms; `0` disables the stagger. |

Emits **`update:field(header, value, { custom })`** on every control's `update:model-value` (and for seeded defaults) — `custom` is `true` when the header isn't part of the resource's resolved schema. `Create.vue`/`FormChild.vue` route `custom: true` updates to `pageState.setControlField` and everything else to `pageState.setField`/child bucket mutations.

**`FormChild.vue`** — child-record entry/list container. Every individual record's inputs are always delegated to `FormRecord`, regardless of mode.

| Prop | Type | Default | Description |
|---|---|---|---|
| `childResource` | `Object` | required | The child resource config entry (from `resourceRecord.childResources`). |
| `parentResource` | `String` | required | Active/primary resource name — the pageState node the child bucket lives under. |
| `childMode` | `String` | `'inline'` | `'inline'` \| `'popup'` \| `'multi'`/`'multiple'`. |
| `listPosition` | `String` | `'top'` | `'top'`/`'above'` renders the added-records list before the entry form/Add button (default); `'bottom'`/`'below'` renders it after. Ignored in `multi` mode (no separate list). |
| `closeOnAdd` | `Boolean` | `true` | Popup mode only — auto-close the dialog after a successful Add (edits always close). |
| `maxRecords` | `Number` | `0` | Maximum number of added record entries allowed (`0` = unlimited). Use `1` for 1-to-1 child relations (e.g. `Outlet` → `OutletOperatingRules`). See §12. |
| `hideFields` | `Array` | `[]` | Extra field headers to hide on child rows. |
| `showFields` | `Array` | `[]` | **Highest precedence** — forces these headers visible on child rows (also removes them from `hideFields` for the derived list label/caption and required-field checks). |
| `showCode` | `Boolean` | `false` | `Code` is server-generated and hidden by default on child rows; `true` renders it as a normal, fully editable control. Forwarded to each `FormRecord`. |
| `columns` | `Number` | `1` | Forwarded to each `FormRecord`. |
| `title` | `String` | `''` | Overrides the auto-derived section title (`resolveChildTitle(childResource)`); the divider is omitted when the resolved title is empty. |
| **Forwarded to each `FormRecord`** | | | |
| `fields` | `Array` | `null` | Explicit child-field ordering. |
| `workflowFields` | `String`\|`Boolean` | `'hide'` | Workflow action-stamp hiding for child rows. |
| `showStatus` / `statusDefault` | `Boolean`\|`String` / `String` | `false` / `'Active'` | `Status` visibility + seed value for child rows. |
| `defaultValues` | `Object`\|`Function` | `{}` | Seed values for child rows (same function support as `FormRecord`), merged over the child resource's own `APP.Resources.DefaultValues` — see §5.1. Applied to **every** new row/draft, not just the first — see §5.2. |
| `fieldProps` | `Object`\|`Function` | `{}` | Per-field control prop overrides for child rows. |
| `formRecordProps` | `Object` | `{}` | Escape hatch merged last into every inner `FormRecord`. |
| **List rendering** | | | |
| `listProps` | `Object` | `{}` | Escape hatch merged last into `AppList`'s props. |
| `listDense` / `listSeparator` / `listBordered` | `Boolean` | `true` / `true` / `false` | `AppList` styling. |
| `listClassTop` / `listClassBottom` | `String`\|`Array`\|`Object` | `'q-mb-sm'` / `'q-mt-sm'` | Class applied to the list in each position. |
| `itemLabel` / `itemCaption` | `String`\|`Function` | `null` | Override the derived per-row label/caption resolvers. |
| `captionParts` | `Number` | `3` | Max `field: value` pairs in the derived caption. |
| `captionSeparator` | `String` | `' • '` | Joiner between caption parts. |
| `newItemLabel` | `String` | `''` | Label for a row with no filled fields yet (defaults to `New <Title>`). |
| `emptyText` | `String` | `''` | Empty-state text (defaults to `No <Title> added yet.`). |
| `emptyClass` | `String`\|`Array`\|`Object` | `'text-caption text-grey-6 text-center q-py-xs'` | Empty-state class. |
| **Card styling** | | | |
| `cardClass` | `String`\|`Array`\|`Object` | `'aql-premium-gradient-form'` | Class for the inline entry card and each `multi` row card. |
| `cardFlat` / `cardBordered` | `Boolean` | `true` / `true` | Card elevation/border. |
| `rowTitleClass` | `String`\|`Array`\|`Object` | `'text-caption text-weight-medium text-grey-7'` | Per-row heading class in `multi` mode. |
| `transitionName` | `String` | `'aql-list-item'` | TransitionGroup name for `multi` row cards. |
| **Dialog (popup mode)** | | | |
| `dialogStyle` | `String`\|`Object` | `'max-width: 520px'` | Dialog card sizing. |
| `dialogTitleClass` | `String`\|`Array`\|`Object` | `'text-subtitle1 text-weight-medium'` | Dialog heading class. |
| `dialogAddTitleLabel` / `dialogEditTitleLabel` | `String` | `''` | Full dialog heading overrides (default to `Add <Title>` / `Edit <Title>`). |
| **Labels / icons / colours** | | | |
| `addLabel` / `updateLabel` / `cancelLabel` | `String` | `'Add'` / `'Update'` / `'Cancel'` | Button labels (`addLabel` also builds the `Add <Title>` inline/FAB label). |
| `addIcon` / `updateIcon` / `editIcon` / `deleteIcon` / `closeIcon` | `String` | `'add'` / `'check'` / `'edit'` / `'delete'` / `'close'` | Icons. |
| `submitColor` / `cancelColor` / `editColor` / `deleteColor` | `String` | `'primary'` / `'grey-7'` / `'primary'` / `'negative'` | Button colours. |
| `actionBtnSize` | `String` | `'sm'` | Size of the per-row Edit/Delete buttons. |
| **Soft-delete undo (§14)** | | | |
| `undoRemove` | `Boolean` | `true` | Show a transient `$q.notify` with an Undo action after a persisted row is soft-deleted. `false` disables the notification (the soft delete still happens). |
| `undoLabel` | `String` | `'Undo'` | Undo action button label. |
| `undoMessage` | `String` | `''` | Notification message; defaults to `<Title> removed`. |
| `undoColor` / `undoTextColor` / `undoBtnColor` | `String` | `'grey-9'` / `'white'` / `'amber'` | Notification background, text, and Undo-button colours. |
| `undoTimeout` | `Number` | `5000` | Notification lifetime in ms. |
| `undoPosition` | `String` | `'bottom'` | Quasar notify position. |

All mutations flow through `pageState.addChild(parentResource, childResource.name, row)`, `updateChild(...)`, and `removeChild(...)` — the same primitives `usePageState.js` already exposed. The one exception is the soft-delete path, which sets `_action` directly on the bucket record because `updateChild` merges only `data` (§14); `FormChild` adds no new state surface beyond that.

**Added-record list rendering**: the inline/popup modes' added-record list is rendered via `AppList` (not a raw `q-list`), passing `items` (the pageState child bucket's `records` array), a function `itemKey` (stable per-row identity via a component-local `WeakMap`), function `label`/`caption` resolvers (derived from the child resource's resolved fields), and a `#btn` slot rendering Edit + Delete buttons per row. `AppList` forwards straight to `abstract/List.vue`, so FLIP entrance/reorder/removal transitions (`aql-list-item-*`, see `UI_CONTENT_SYSTEM.md` §2) and responsive layout (mobile-first `q-item` stacking) are inherited for free — no bespoke list markup or CSS.

---

## 4. Field Visibility Precedence — `showFields` > `hideFields` > `workflowFields`

`FormRecord` computes a hidden-set in exactly this order; each later step overrides the earlier ones. `Create` and `FormChild` forward all five props unchanged, so the chain behaves identically on primary and child forms.

**Truth table for `workflowFields`:**

| `workflowFields` value | Effect |
|---|---|
| `'hide'` (default string) | HIDE all workflow action-stamp fields |
| `false` | HIDE all workflow action-stamp fields |
| `'show'` | SHOW all workflow action-stamp fields |
| `true` | SHOW all workflow action-stamp fields |

| Step | Input | Effect |
|---|---|---|
| 1 | `workflowFields` (`'hide'`/`false`, default) | Every header matching `/(.+?)(By\|At\|Comment)$/` (e.g. `ProgressApprovedBy`, `StatusRejectedComment`) is **added** to the hidden set. `'show'`/`true` skips this step entirely. |
| 2 | `showStatus` (`false`, default) | `Status` is **added** to the hidden set unless `showStatus` is `true`/`'show'`. |
| 3 | `showCode` (`false`, default) | `Code` is **added** to the hidden set unless `showCode` is `true`. |
| 4 | `hideFields` (`[]`) | Each listed header is **added** to the hidden set — this applies even when `workflowFields` is `'show'`/`true`. |
| 5 | `showFields` (`[]`) — **highest precedence** | Each listed header is **removed** from the hidden set. A header here renders even if steps 1–4 all hid it (including `Status`, `Code`, and workflow stamps). |

```javascript
// Hide everything workflow-ish, but bring back one approval comment field,
// and additionally suppress a column that would otherwise show.
{
  workflowFields: 'hide',
  hideFields: ['InternalNotes'],
  showFields: ['ProgressApprovedComment']   // wins over step 1
}
```

Listing `'Status'` in `showFields` renders it exactly like `showStatus: true` — and, as with `showStatus`, it is then **not** auto-seeded with `statusDefault`. Listing `'Code'` in `showFields` renders it exactly like `showCode: true`. Whenever rendered, `Code` is a normal, fully editable control — `useFormFields`'s `Code` mapping carries no `disable: true` (unlike the read-only rendering in `ViewRecord`).

---

## 5. Dynamic `defaultValues` (functions at both levels)

`defaultValues` accepts a plain object, a function, or an object whose individual values are functions. Every function receives `(record, ctx)` where `ctx = { pageState, resourceConfig, resourceRecord }`:

```javascript
// 1. Plain object
defaultValues: { Progress: 'DRAFT' }

// 2. Function prop — the whole object is computed
defaultValues: (record, ctx) => ({
  Progress: ctx.resourceConfig.scope.value === 'master' ? 'ACTIVE' : 'DRAFT'
})

// 3. Function values inside the object — computed per key
defaultValues: {
  Progress: 'DRAFT',
  TotalQty: (record) => (record.CartonQty || 0) * (record.UnitsPerCarton || 0)
}
```
Resolution order: if the prop is a function it is called first; each resulting value that is itself a function is then called. A throw in either is logged and that key is skipped. Each resolved header is seeded **only when `record[header] === undefined`**, by emitting the normal `update:field` — `FormRecord` never writes `record` directly, so the caller's `setField`/`setControlField` routing applies unchanged. Seeding re-runs when `resource`, `defaultValues`, `showStatus`, the resource's `Status`-column presence, or the backend `APP.Resources.DefaultValues` map changes.

### 5.1 `APP.Resources.DefaultValues` (backend schema metadata)

Every resource entry synced from the `APP.Resources` sheet carries a `defaultValues` object. `GAS/resourceRegistry.gs`'s `buildAuthorizedResourceEntry()` copies `config.defaultValues` onto the login `resources` payload entry (see `API_LOGIN_RESPONSE.md` §4), and `parseJsonCell` parses the sheet's `DefaultValues` column, e.g. `{"Status": "Active", "Currency": "AED"}`. `FormRecord` resolves this via `useResourceConfig(resource).defaultValues` — **not** by reaching into `authStore` directly (per `CORE_ARCHITECTURE_RULES.md` §5, components must not import Pinia stores) — matched by its own `resource` prop (the resource **name**). This works identically whether `FormRecord` is rendering the primary resource (from `Create.vue`) or a child resource (from `FormChild.vue`), since both pass their own resource's name, with no extra wiring required from either caller.

**Full default-value precedence (lowest → highest):**
1. `APP.Resources.DefaultValues` (backend schema metadata, resolved automatically).
2. `defaultValues` prop (Object or Function — §5 above) — overrides any backend key it also defines.
3. The hardcoded `Status: statusDefault` fallback (`'Active'`) — applied **only** if `Status` is still unset after steps 1–2.

```json
// APP.Resources row for "SupplierQuotations" — DefaultValues column
{"ResponseType": "QUOTED", "Currency": "AED"}
```
```javascript
// A page-level defaultValues prop can still override a backend-seeded key:
defaultValues: { ResponseType: 'PARTIAL' }   // wins over the backend "QUOTED"
```

`FormChild` resolves the same metadata for a **child** resource from `props.childResource.defaultValues` (the child resource config entry already carries this field from the same login `resources` payload) — see §5.2.

### 5.2 Multi-Entry Child Default Seeding (`FormChild.vue`)

`FormChild` exposes an internal `createChildDefaultRecord()` helper that resolves the same three-tier precedence chain as §5.1 (`childResource.defaultValues` < `defaultValues` prop < `Status` fallback) and returns a fresh, pre-filled data object. Unlike relying solely on `FormRecord`'s own mount-time seeding watcher (which only fires once per component instance), `createChildDefaultRecord()` is called explicitly every time a **new** entry point is created, so defaults apply consistently to the 1st, 2nd, 3rd, and every subsequent row:
- **`inline`/`popup` modes**: `resetDraft()` (called after every successful Add, on Cancel, and when a popup dialog opens for a new entry) seeds `draft` with `createChildDefaultRecord()` instead of `{}`.
- **`multi` mode**: `addBlankRow()` seeds the newly-added `pageState` row the same way instead of `addChild(..., {})`.

This means a child resource with `defaultValues: { Currency: 'AED' }` (or a backend `APP.Resources.DefaultValues` entry) has every row pre-filled with `Currency: 'AED'` the moment it's created — the user never has to re-select a value that should always be the same.

---

## 6. `fieldProps` — Per-Field Control Prop Overrides

`fieldProps` supplies extra props to individual controls, keyed by header, without needing a `FormField<Header>` file. Like `defaultValues`, it accepts an object, a function, or an object of per-header functions — each function receives `(record, ctx)` with `ctx = { pageState, resourceConfig, resourceRecord }`:

```javascript
fieldProps: {
  ProgressPlannedComment: { label: 'Planning Comment', type: 'textarea', placeholder: 'Notes…' },
  Quantity: (record) => ({ suffix: record.Unit || 'pcs', min: 0 })
}
// or the whole map as a function:
fieldProps: (record, ctx) => ({ Rate: { prefix: ctx.resourceConfig.currency?.value } })
```

**Control prop merge order (lowest → highest):**
1. `$attrs` forwarded from the parent.
2. Base field props resolved by `useFormFields` (`label`, `type`, `options`, `outlined`, …).
3. `fieldProps[header]` — prop-level per-field overrides.
4. `FormField<Header>.js` modifier output from `_ui/*` — **highest priority**, so a tenant's custom UI always wins over a page-level `fieldProps`.

The merged result is handed to the resolved `_fields/<type>/<Mode>.vue` component as its **`config`** prop, which the component spreads onto its inner Quasar control. Resolution metadata (`fieldType`, `component`, `componentName`, `custom`, `header`) is stripped first, so nothing leaks onto the rendered input.

> **Control-type attributes are owned by the field component.** Each `Add.vue` binds `v-bind="config"` first and then sets its own `type` (`url`, `tel`, `textarea`, `number`, …). Consequently `fieldProps` and JS modifiers cannot change a field's input `type` — change the column's schema type instead, so both the form and the view agree. Everything else merges normally.

(A `FormField<Header>.vue` component override replaces the control outright rather than merging props; it still receives the merged props from steps 1–3 plus `field`, `record`, `config`, and `header`.)

---

## 7. Custom (Non-Schema) Fields — Strict Storage Rule

`node.record` is reserved **exclusively** for canonical resource headers sent to GAS (`defaultBuild` in `usePageState.js` reads only `node.record`/`node.children`/`node.records`/`node.action`). A `fields` entry that isn't part of the resource's resolved schema (e.g. a UI-only wizard field, a computed helper input) is flagged `custom: true` by `FormRecord` and must **never** land in `node.record`. Instead:
- `pageState.setControlField(resource, header, value)` upserts `{ header, value }` into `node.controls` (a dedicated slot `defaultBuild` never reads).
- `pageState.getControlField(resource, header)` reads it back.
- If no `FormField<Header>` override is found for a custom header, `FormRecord` falls back to `_fields/text/<Mode>.vue` (an outlined `QInput`) — custom entries are stamped `fieldType: 'text'`.

`Create.vue` and `FormChild.vue` already implement `custom`-aware routing (`meta.custom ? setControlField : setField`); a hand-rolled `FormRecord` usage inside a full Vue override must replicate that routing itself.

---

## 8. Child Entry Modes

1. **`inline` (default)** — The added-records `AppList` (positioned per `listPosition`, above by default) sits alongside a permanent `FormRecord` (bare, `:card="false"`, wrapped in `FormChild`'s own card). Submitting (guarded by `canSubmit` — at least one filled field, all resource-required fields present) calls `addChild` and resets the draft. Edit repopulates the draft and switches the button to "Update", calling `updateChild` on submit; Delete calls `removeChild`.
2. **`popup`** — Same `AppList`, but with an "Add {Title}" button instead of a permanent form. Clicking it opens a `q-dialog` hosting a bare `FormRecord`; submitting calls `addChild`/`updateChild` and closes the dialog when `closeOnAdd` is `true` (edits always close). Editing an existing row reopens the dialog prefilled via the same draft state.
3. **`multi` / `multiple`** — No shared draft state and no separate list at all (`listPosition` is a no-op here): every added child row renders its own always-editable `FormRecord` (bare, inside its own small `q-card`) bound directly to the row's live `pageState` data (`update:field` calls `updateChild` immediately, no local draft). An "Add Row" button appends a blank child node via `addChild(parentResource, childName, {})`; each row has its own remove button.

Regardless of mode, list/row entrance and removal reuse the exact `aql-list-item-*` transition classes documented in `UI_CONTENT_SYSTEM.md` §2's "Centralized List Transitions" — no new CSS was added for `Create`.

---

## 9. Custom Component Resolution Hierarchies

Three independent, narrowly-scoped override points exist beneath the page-level `Create` content-resolver override (§10). Each is resolved by the component that renders it, exactly like `ViewRecord`/`ViewChildren` resolve their own record/child overrides.

> [!IMPORTANT]
> **Slug normalization.** Every `[resourceSlug]`/`[parentResourceSlug]`/`[childResourceSlug]` path segment below is normalized as `toPascalCase(slug).toLowerCase()` before the glob-registry lookup — **exactly** matching `useContentResolver.js`'s own `toPascalCase(resource || '').toLowerCase()` normalization (line ~71) used for `List`/`View` overrides. A kebab-case slug like `outlet-visits` becomes `outletvisits`, not `outlet-visits` — Vite's glob-registry keys never contain hyphens, since folder names are PascalCase-derived (`OutletVisits/` → key `outletvisits`). `FormRecord.vue` (`normalizeSlug`), `Create.vue` (`resolveChildOverride`), and `FormChild.vue` (`fieldResourceSlug`) all apply this normalization to whatever `resourceSlug`/`childResource.slug` they receive — callers do not need to pre-normalize slugs before passing them as props. This is not a redundant conversion: real resource menu routes (`ui.menus[].route`) ARE kebab-case in production (confirmed against live seed data in `GAS/syncAppResources.gs`, e.g. `/operation/outlet-visits`), so `resourceSlug` genuinely arrives kebab-cased and needs this normalization to reach the PascalCase-derived glob key.

1. **Child form override (resolved by `Create.vue`, one lookup per eligible child)**:
   - `_ui/[uiName]/components/[scope]/[parentResourceSlug]/FormChild[ChildResource].(vue|js)` — e.g. `_ui/AQL/components/operation/outletrestocks/formchildoutletrestockitems.vue`
   - `_ui/[uiName]/components/[childScope]/[childResourceSlug]/FormChild.(vue|js)` — e.g. `_ui/AQL/components/operation/outletrestockitems/formchild.vue`
   - A **Vue override** fully replaces that child's `FormChild` with the resolved component, receiving `{ childResource, parentResource, childMode, closeOnAdd, hideFields, columns }`. A **JS modifier** — `mod(childResource, { pageState, resourceConfig, resourceRecord })` (or a plain object) — merges into the default `FormChild` props for that one child only (e.g. force `childMode: 'multi'` on just one child while others stay `'inline'`).
2. **Main/child resource form override (resolved by `FormRecord.vue` itself, based on its own `scope`/`resourceSlug`/`uiName` props)**:
   - `_ui/[uiName]/components/[scope]/[resource]/FormRecord.(vue|js)` — applies identically whether `FormRecord` is rendering the primary resource (from `Create.vue`) or a child resource (from `FormChild.vue`), since both pass their own scope/slug context down.
   - A **Vue override** replaces the base field grid entirely, receiving the full `FormRecord` prop set (`resource`, `record`, `hideFields`, `showFields`, `fields`, `defaultValues`, `fieldProps`, `columns`, `scope`, `resourceSlug`, `uiName`, `card`). A **JS modifier** — `mod(props, { pageState, resourceConfig, resourceRecord })` — adjusts those props before the base grid renders (e.g. force `columns: 2` or extend `hideFields` for one resource only).
3. **Single-field override (resolved by `FormRecord.vue`, per visible field) — `_ui/*` ONLY**:
   - `_ui/[uiName]/components/[scope]/[resource]/FormField<Header>.(vue|js)` — resource-specific (e.g. `FormFieldEmail.vue`). This is the **only** path checked; there is **no** `components/shared/FormField<Header>` framework fallback. When no `_ui` override exists, `FormRecord` mounts the base type component `_fields/<fieldType>/<Add|Edit>.vue` (§15).
   - A **Vue override** replaces just that field's control, receiving `{ modelValue: record[header], field, record, config, header, ...otherFieldProps }` and expected to emit `update:model-value`. A **JS modifier** — `mod(value, record, field, { pageState, resourceConfig, resourceRecord })` (or a plain object) — merges into the base control's props per §6's merge order (mirrors `ViewRecord`'s per-column modifier contract exactly).
   - Applies to **both** schema fields and custom (non-schema) `fields` entries — for a custom header with no `_ui` override, `FormRecord` falls back to a bare `QInput`.

---

## 10. Custom UI Overrides (whole-content level)

`Create` and `Update` participate in the same two-step content resolver as every other content (`UI_CONTENT_SYSTEM.md` §1) — `useContentResolver` is content-name-agnostic, so the two share one path shape that differs only in the filename (`create` vs `update`):

- **Vue Template Override** — replaces the entire content:
  - `_ui/[uiName]/components/[scope]/[resource]/[page]/create.vue` — and `.../[page]/update.vue` (resource + page specific — most common: targets just the Create/Edit page of one resource)
  - `_ui/[uiName]/components/[scope]/[resource]/create.vue` — and `.../[resource]/update.vue`
  - `_ui/[uiName]/components/[scope]/[page]/create.vue` — and `.../[page]/update.vue`
  - `_ui/[uiName]/components/[scope]/create.vue` — and `.../[scope]/update.vue`
  - `_ui/[uiName]/components/create.vue` — and `.../update.vue`
- **JS Logic Modifier** — keeps `ContentsCreate`/`ContentsUpdate` but adjusts its props before render, at the same path priority with `.js` instead of `.vue`.

Because the two resolve independently, a resource can override just its edit form (`update.js`) and keep the stock Create, or vice versa. When both need the same prop adjustments, either duplicate the small modifier or have both import one shared module.

```javascript
// src/_ui/AQL/components/master/products/create/create.js
// Hides SKU-specific fields from the primary form and forces popup child entry.
export default function (props, { pageState, resourceConfig, resourceRecord }) {
  return {
    ...props,
    childMode: 'popup',
    closeOnAdd: false,
    hideFields: ['InternalNotes'],
    columns: 2
  }
}
```

```vue
<!-- src/_ui/AQL/components/master/products/create/create.vue -->
<!-- Full replacement — only used when the stock layout is fundamentally different
     from FormRecord/FormChild's generic field-grid + child-list/dialog/multi shapes. -->
<template>
  <div class="q-gutter-y-md">
    <FormRecord
      resource="Products"
      :record="pageState.state.nodes.get('Products')?.record || {}"
      :columns="2"
      @update:field="(h, v) => pageState.setField('Products', h, v)"
    />
    <!-- custom child layout, workflow-specific widgets, etc. -->
  </div>
</template>

<script setup>
import { inject } from 'vue'
import FormRecord from 'components/contents/FormRecord.vue'
const pageState = inject('pageState')
</script>
```

A Vue override receives all `pageProps` unmodified via `$attrs`/injection (exactly like `List`/`View` overrides) — read `resourceConfig`/`resourceRecord`/`pageState` via `inject()`, not props, since `Create.vue` itself only forwards its own declared props (`withChildren`, `childMode`, etc.), not the full page context.

---

## 11. `hideChild` / `hideChildren` / dynamic `hide<ResourceName>` — Child Resource Suppression

`Create.vue` accepts `hideChild` and `hideChildren` (equivalent aliases — both are checked and merged into one lookup set) to suppress specific eligible child resources from rendering at all, without disabling `withChildren` globally. Matching is case-insensitive against **both** the child resource's `name` and its `slug`:

```javascript
// Single child
{ hideChild: 'GoodsReceipt' }

// Multiple children
{ hideChildren: ['GoodsReceipt', 'POReceivingItems'] }
```

Filtering happens in `eligibleChildren` — the same computed that already applies the `ParentResource` match and the master-scope restriction — so a hidden child is excluded before any `FormChild<ChildName>` override resolution, per-child JS modifier, or section-list entry is ever built for it. This is the right tool when a child relation exists in the schema but must be created elsewhere (e.g. via a dedicated sub-route or a different workflow step) rather than inline on the primary `Create` page.

**Dynamic `hide<ResourceName>` suppression** — alongside the array/string `hideChild`/`hideChildren` props, `eligibleChildren` also checks, per child, for a dynamic boolean flag on either `props` or `$attrs`: `hide<Name>`, `hide<Slug>`, or `hide<PascalCaseName>` (case-insensitive), e.g. `hideGoodsReceipts: true` or `hidePOReceivingItems: true`. A `true` (or the string `'true'`) value suppresses that child exactly like listing it in `hideChild`. This is useful when a page wants to hide one specific child via a plain attribute without threading it through `hideChild`/`hideChildren`:

```vue
<!-- suppresses the GoodsReceipts child section for this page only -->
<Content content="Create" :hideGoodsReceipts="true" />
```

---

## 12. `maxRecords` — Maximum Added Record Count

`FormChild`'s `maxRecords` prop (`0` = unlimited, the default) caps how many added record entries a single child bucket may hold, independent of `childMode`. The canonical use case is a 1-to-1 child relation — e.g. `Outlet` → `OutletOperatingRules` — where `maxRecords: 1` guarantees at most one child record can ever be added:

```javascript
// src/_ui/AQL/components/operation/outlets/formchildoutletoperatingrules.js
export default function (childResource) {
  return { maxRecords: 1 }
}
```

Once `records.length >= maxRecords` (computed as `maxReached`), every Add affordance across all three modes is disabled (not hidden, so the added record remains visible and editable):
- **`inline`**: the submit button is disabled when adding a *new* row (`editIndex === null`); editing the existing row(s) via the list's Edit button is unaffected.
- **`popup`**: both the outer "Add {Title}" trigger and the in-dialog submit button are disabled for a new entry; editing an existing row still works.
- **`multi`**: the "Add Row" button is disabled.

The underlying mutation functions (`submitDraft` for the add path, `addBlankRow`) also guard on `maxReached` directly, so the cap holds even if a disabled button were somehow bypassed. `maxRecords` is set per child either via `formChildProps` on `Create.vue` (applies uniformly to every child) or, for a single specific child, via a `FormChild<ChildName>.js` JS modifier as shown above (§9).

On an `Update` page the cap counts **visible** rows only, so soft-deleting a row (§14) frees its slot. For a `maxRecords: 1` relation this is what makes "replace the existing record" possible: the payload then carries a `deactivate` for the old row plus a `create` for the new one.

---

## 13. `Update.vue` Hydration Lifecycle

`Create` starts from a blank node; `Update` starts from a record the page has **already fetched**. `defaultHydrate` in `usePageState.js` only fills `node.record` and never touches `node.children`, so `Update.vue` owns child hydration itself. All hydration runs through one `syncFromServer()` entry point (`hydrateParent()` then `hydrateExistingChildren()`), driven by two watchers.

### 13.1 Primary record

```javascript
pageState.initResource(name, { isPrimaryKey: true, reset: true, code: record.Code })  // only if the node is absent
pageState.load(name, record)                                                          // guarded, see below
```

`load()` is keyed on a composite guard `${name}::${node.identifier}::${recordId(record)}`:
- `node.identifier` — changes when the node instance is replaced (see §13.3).
- `recordId(record)` — a `WeakMap`-assigned id per pristine server-record **object**, since the record carries no id of its own and its identity is what marks a genuinely different record having loaded.

If the composite key is unchanged, `load()` is skipped. This is what makes hydration idempotent: an unrelated recompute can re-run the watcher freely without re-applying the pristine record over what the user has typed. Passing `code: record.Code` on init is what later makes `defaultBuild` emit a `compositeSave`/update request rather than a create.

### 13.2 Existing child rows

Each row from `resourceRecord.childRecordsByResource[childName]` is pushed as an `update` entry:

```javascript
pageState.addChild(name, child.name, { ...row }, { action: 'update' })
```

- `defaultBuild` forwards this verbatim into the `compositeSave` child records array as `_action: 'update'`, and GAS's `handleCompositeSave` locates the sheet row by `data.Code` and merges it.
- The spread is deliberate: enriched records expose relation/metadata keys (`_Children`, `$parent`, …) as **non-enumerable**, so `{ ...row }` yields only canonical schema headers and nothing leaks into the request payload.
- Guarded per `${node.identifier}::${childName}` in a `Set`, so each bucket fills exactly once and the user's subsequent adds/edits/removals are never clobbered.
- Child rows may arrive **after** mount (background resource fetch), so `childRecordsByResource` is watched and each bucket hydrates the first time its rows become available.

### 13.3 Node-reset detection (`PageAction.onReset()`)

`PageAction.onReset()` swaps in a **fresh** node, which flushes `node.children`. A plain record/resource watch cannot detect this — `resourceRecord.record` keeps the same object identity across a reset — so `Update.vue` watches `node.identifier` explicitly. When it changes, both guards miss, and the parent record plus every child bucket re-hydrate, restoring the original server rows. This is the mechanism that makes the Reset action work correctly on an edit form with children.

The two watchers are:

| Watch source | Fires on |
|---|---|
| `[resourceName, serverRecord]` (immediate) | Initial mount, record arrival, and resource switch. On a *different* resource it clears both guards and calls `initResource(..., { reset: true })`, flushing stale nodes from a previously-visited page (same reset contract as `Create.vue` — one `pageState` instance is shared across in-app navigations). |
| `[() => primaryNode.identifier, () => childRecordsByResource, eligibleChildren]` | Node replacement (reset) and late-arriving child rows. |

> [!IMPORTANT]
> Both watchers read `eligibleChildren` while collecting dependencies, so they **must** stay declared below `eligibleChildren`/`hiddenChildKeys` in the setup block — registering them any earlier hits those computeds' temporal dead zone and throws at mount. A single-line comment marks this in the source; do not reorder it.

A full `update.vue` Vue override that does **not** render `Update.vue` itself inherits none of this — it must replicate the `load()` call, the child pre-population, and the identifier guard itself, or stale/duplicated child rows will reach the payload.

---

## 14. Child Soft-Deletion & Undo (`_action: 'deactivate'`)

On a `Create` page every child row is new, so removing one just splices it out. On an `Update` page a child row may already exist in the sheet — and splicing that row merely makes it **absent from the payload**, which leaves the sheet row untouched. `FormChild.remove()` therefore branches on the row's `_action`:

| Row state | Behaviour |
|---|---|
| `_action: 'update'` **and** a non-blank `data.Code` (hydrated by §13.2) | `_action` is flipped in place to `'deactivate'`. The row stays in the bucket, reaches the payload, and GAS's `handleCompositeSave` locates it by Code, sets `Status = 'Inactive'`, applies audit fields, and queues the update. |
| `_action: 'create'` (added this session) | Spliced out via `pageState.removeChild(...)` — it was never persisted, so there is nothing to deactivate. |
| `_action: 'update'` with **no** Code | Spliced out. GAS matches on `_originalCode \|\| data.Code`, and `defaultBuild` drops `_originalCode`; without a Code, GAS would fall through to its create branch and **duplicate** the row instead of deactivating it. |

The flip is a direct mutation on the bucket record object (`records.value[i]._action = 'deactivate'`) rather than a `pageState` call, because `updateChild` merges only `data` and cannot set `_action`. This is reactive: the bucket lives inside `usePageState`'s `reactive()` tree, so the record is a reactive proxy and dependent computeds re-evaluate. No `usePageState.js` or GAS change was required for any of this — both already forwarded and handled `_action` verbatim.

### 14.1 `visibleRecords` and the visible↔bucket index split

Deactivated rows must stay in the reactive bucket (for the payload) but disappear from the UI. `FormChild` therefore keeps two views:

- **`records`** — the raw pageState bucket, including deactivated rows. Every `pageState` mutation and `editIndex` is expressed in **bucket** indices.
- **`visibleRecords`** — `records` filtered to exclude `_action === 'deactivate'`. Drives the `AppList` `items` binding, the `multi`-mode `v-for`, and `maxReached`.

Because hiding rows makes the two index spaces diverge, every rendered row is mapped back with `bucketIndexOf(row)` — an identity `indexOf`, valid because `filter` preserves the same reactive objects rather than copying them. `rowTitle(index)` is the one deliberate exception: it uses the **visible** index so `multi`-mode numbering stays gap-free. Keeping `editIndex` in bucket space means `submitDraft`'s `updateChild` needs no translation, and the existing "shift `editIndex` down when an earlier row splices" correction still holds (a soft delete performs no splice, so no shift is needed — only an in-flight edit of that same row is cleared).

### 14.2 Undo

Since the row is hidden, there is nowhere to hang an inline affordance, so the undo lives in a transient `$q.notify` raised by `remove()`:

```javascript
$q.notify({
  message: props.undoMessage || `${resolvedTitle} removed`,
  actions: [{ label: props.undoLabel, handler: () => restore(row) }]
})
```

`restore(row)` flips `_action` back to `'update'`, which returns the row to `visibleRecords` (with its stable `rowKey`, so the list transition plays in reverse) and to a normal merge on submit. Message, label, colours, timeout, and position are all props (see §3's `undoRemove`/`undoLabel`/`undoMessage`/`undoColor`/`undoTextColor`/`undoBtnColor`/`undoTimeout`/`undoPosition`), per the zero-hardcoding contract; `undoRemove: false` suppresses the notification while leaving the soft delete intact.

---

## 15. Base Field Subsystem (`src/components/_fields/`)

The type-driven presentation layer that renders every control in `FormRecord` and every value cell in `ViewRecord`/`ViewChildCompact`. The containers hold **no** type branches — they resolve a component and mount it.

> Component-level reference (full `config` merge order, alias table, "how to add a type"): [`FRONTENT/src/components/_fields/README.md`](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/_fields/README.md). The view-side integration is documented in [UI_VIEW_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_VIEW_SYSTEM.md) §4.

### 15.1 Directory Structure — the "Option A" Pattern

Each field type owns a folder holding **three explicit SFCs**:

```
src/components/_fields/
├── README.md
├── index.js                  # re-exports the resolver API
├── useFieldResolver.js       # central dynamic resolver
├── currency/{Add,Edit,View}.vue
├── date/{Add,Edit,View}.vue
├── file/{Add,Edit,View}.vue
├── link/{Add,Edit,View}.vue
├── number/{Add,Edit,View}.vue
├── select/{Add,Edit,View}.vue
├── status/{Add,Edit,View}.vue
├── tel/{Add,Edit,View}.vue
├── text/{Add,Edit,View}.vue    ← FALLBACK TYPE, must always exist
├── textarea/{Add,Edit,View}.vue
└── toggle/{Add,Edit,View}.vue
```

| File | Mode | Rendered by |
|---|---|---|
| `Add.vue` | `add` | `Create.vue` → `FormRecord` (default `mode`) |
| `Edit.vue` | `edit` | `Update.vue` → `FormRecord` (`mode: 'edit'`), and `FormChild` while re-opening an already-added row |
| `View.vue` | `view` | `ViewRecord`, `ViewChildCompact` |

`Edit.vue` re-exports `Add.vue` whenever edit behaviour is identical — all eleven current types do this. Diverging later means editing that one file; no container changes:

```vue
<!-- _fields/<type>/Edit.vue -->
<template>
  <Add v-model="model" v-bind="$attrs" :record="record" :config="config" :header="header" />
</template>
```

### 15.2 Component Prop Contract

Every `Add.vue` / `Edit.vue` / `View.vue` implements exactly this surface, with `defineOptions({ name: 'Field<Type><Mode>', inheritAttrs: false })`:

| Name | Kind | Description |
|---|---|---|
| `modelValue` | `defineModel()` | The field value. Bi-directional — writing `model.value` emits `update:modelValue`, which `FormRecord` re-emits as `update:field(header, value, { custom })` and the caller routes to `setField`/`setControlField`. |
| `record` | `Object` prop | The full row record, so a field can read sibling columns (dynamic link construction, cross-column formatting). |
| `config` | `Object` prop | The fully merged control props (§6 merge order), minus resolution metadata. |
| `header` | `String` prop | The exact column header name. |

`View.vue` components additionally take `emptyText` (default `'-'`) and `compact` (default `false`, also honoured as `config.compact`).

### 15.3 Type Table

| Type | Add / Edit | View |
|---|---|---|
| `text` (**fallback**) | outlined `q-input` | plain text, null fallback |
| `link` | `q-input type="url"` + link icon/hint | `<a target="_blank" rel="noopener noreferrer">` + `open_in_new` icon |
| `tel` | `q-input type="tel"` + phone icon | `<a href="tel:…">` + phone icon |
| `file` | `AqlFileUpload` | `AqlFilePreviewCard` (dense chip when compact) |
| `textarea` | `q-input type="textarea"` autogrow | multiline text (`white-space: pre-line`) |
| `status` | `AqlStatusToggle`, or `q-select` when `config.options` exists | coloured `QChip`, map overridable via `config.statusColors` |
| `select` | `q-select` with `use-input` local filtering | resolved option label |
| `date` | `components/app/Date.vue` | `toLocaleDateString('en-GB', …)` |
| `number` | `q-input type="number"` | `toLocaleString` |
| `currency` | `q-input type="number"` prefixed with the dynamic symbol from `useCurrency` | `_C(value)` |
| `toggle` | `q-toggle` | outlined `QChip`, positive when the value matches the column's `true-value` |

`status` picks its control from `config.options`: absent ⇒ classic Active/Inactive column ⇒ `AqlStatusToggle`; present ⇒ `q-select`. This reproduces `mapField`'s two pre-existing status branches without a hardcoded header check in the component.

### 15.4 Resolver API (`useFieldResolver.js`)

The registry is built eagerly from `import.meta.glob('./*/*.vue', { eager: true })`, so resolution is synchronous and a control never flashes empty while a chunk loads.

| Function | Signature | Behaviour |
|---|---|---|
| `resolveFieldComponent` | `(type, mode) => Component` | Maps `add\|edit\|view` → `Add\|Edit\|View.vue` under `_fields/<type>/`. Unknown mode → `View`. Unknown type, or a type folder missing that mode's file → `text/<Mode>.vue`. **Never returns null.** |
| `resolveFieldType` | `(field) => string` | Takes a whole field *definition* and returns its presentation type. Explicit `field.type` wins; else header ending in `Date` → `date`, header `Status` → `status`, else `text`. For callers holding only a raw `APP.Resources.UIFields` entry (the view side). |
| `normalizeFieldType` | `(type) => string` | Collapses schema synonyms: `url\|uri\|website\|hyperlink → link`, `phone\|mobile\|telephone → tel`, `money\|price\|amount → currency`, `dropdown\|enum\|reference → select`, `boolean\|bool\|checkbox → toggle`, `longtext\|multiline\|memo\|notes → textarea`, `datetime → date`, `int\|integer\|decimal\|float → number`, `attachment\|upload\|image → file`. Unknown → `text`. |
| `fieldTypes` | `() => string[]` | Type folders that currently exist. |
| `hasFieldType` | `(type) => boolean` | True when `type` resolves to a real folder rather than the fallback. |
| `useFieldResolver` | `() => { … }` | Composable wrapper returning all of the above. |

### 15.5 `fieldType` vs `type`

`useFormFields.mapField` stamps every returned descriptor with a **`fieldType`** — the normalized presentation type. It is deliberately *not* named `type`, because `type` is already a QInput prop inside the same props bag; overloading it would put `type="date"` on `AppDate` and `type="select"` on `QSelect` in any consumer that spreads the descriptor.

`component` / `componentName` are still emitted for the legacy direct-render consumer `_common/sections/Content/Form.vue`; `FormRecord` no longer reads them.

| Container | Type source | Call |
|---|---|---|
| `FormRecord.vue` | `mapField` output | `resolveFieldComponent(field.fieldType, mode)` |
| `ViewRecord.vue` | raw `UIFields` entries | `resolveFieldComponent(resolveFieldType(field), 'view')` |
| `ViewChildCompact.vue` | raw `UIFields` entries | as above, with `config.compact = true` |

### 15.6 Three-Tier Precedence Chain

| Tier | Source | Notes |
|---|---|---|
| **1** | Per-resource custom `_ui` Vue override — `formfield<header>.vue` (form) / `viewcolumn<header>.vue` (view) | Highest priority; replaces the control/cell outright. Paths in §9.3. |
| **2** | Base type component `_fields/<type>/<Add\|Edit\|View>.vue` | Resolved via `resolveFieldComponent`. |
| **3** | Fallback `_fields/text/<Mode>.vue` | Unknown types and custom (non-schema) headers. |

JS modifiers (`FormField<Header>.js`, `ViewColumn<Header>.js`) sit **outside** this chain — they merge into `config` (§6), so they apply to whichever tier-2/3 component renders.

### 15.7 Adding a New Field Type

1. Create `_fields/<type>/` with `Add.vue`, `Edit.vue`, `View.vue` per §15.2.
2. If the schema spells the type differently, add the alias to `TYPE_ALIASES` in `useFieldResolver.js`.
3. If `mapField` must prepare props for it (options, `accept`, `resourceName`, …), add a branch there setting `fieldType: '<type>'`.

No container edits. No registry edits. `_fields` components carry **no `<style>` block** (ARCHITECTURE RULES §7) — shared classes belong in `src/css/custom.scss`.
