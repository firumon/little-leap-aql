# Create & Update — Component Anatomy & Props

> Part of **[﻿# AQL Create & Update Content Systems](UI_CREATE_AND_UPDATE_SYSTEM.md)**. Full prop tables for `Create.vue`, `Update.vue`, `FormRecord.vue` and `FormChild.vue`.

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

Emits **`update:field(header, value, { custom })`** on every control's `update:model-value` (and for seeded defaults) — `custom` is `true` when the header isn't part of the resource's resolved schema. `Create.vue`/`FormChild.vue` route `custom: true` updates to `pageState.setControls` and everything else to `pageState.setRecord`/child bucket mutations.

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

All mutations flow through `pageState.addChild(childResource.name, row, parentResource)`, `updateChild(...)`, and `removeChild(...)` — the same primitives `usePageState.js` already exposed. The one exception is the soft-delete path, which sets `_action` directly on the bucket record because `updateChild` merges only `data` (§14); `FormChild` adds no new state surface beyond that.

**Added-record list rendering**: the inline/popup modes' added-record list is rendered via `AppList` (not a raw `q-list`), passing `items` (the pageState child bucket's `records` array), a function `itemKey` (stable per-row identity via a component-local `WeakMap`), function `label`/`caption` resolvers (derived from the child resource's resolved fields), and a `#btn` slot rendering Edit + Delete buttons per row. `AppList` forwards straight to `abstract/List.vue`, so FLIP entrance/reorder/removal transitions (`aql-list-item-*`, see `UI_CONTENT_SYSTEM.md` §2) and responsive layout (mobile-first `q-item` stacking) are inherited for free — no bespoke list markup or CSS.

---


---

⬑ Back to **[﻿# AQL Create & Update Content Systems](UI_CREATE_AND_UPDATE_SYSTEM.md)**.
