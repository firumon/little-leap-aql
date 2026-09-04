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

---

## Parts of this document

This document is split so each part stays readable on its own. The parts are canonical — this hub does not restate them.

| Part | Covers |
|---|---|
| [Create & Update — Component Anatomy & Props](UI_CREATE_AND_UPDATE_ANATOMY.md) | Full prop tables for `Create.vue`, `Update.vue`, `FormRecord.vue` and `FormChild.vue`. |
| [Create & Update — Visibility, Defaults & Field Props](UI_CREATE_AND_UPDATE_VISIBILITY.md) | The `showFields` > `hideFields` > `workflowFields` chain, dynamic `defaultValues`, `fieldProps`, and the custom-field storage rule. |
| [The `_fields/` Base Field Subsystem](UI_FIELDS_REGISTRY_GUIDE.md) | Directory pattern, prop contract, type table, resolver API and how to add a field type. |
| [Create & Update — Child Entries & Hydration](UI_CREATE_AND_UPDATE_CHILDREN.md) | Child entry modes, custom component resolution, child suppression and limits, `Update.vue` hydration, and soft-delete with undo. |




### Where each section lives

Section numbers are unchanged, so an existing `§N` reference still resolves — find it here.

| § | Section | File |
|---|---|---|
| §3 | Component Anatomy & Props | [UI_CREATE_AND_UPDATE_ANATOMY.md](UI_CREATE_AND_UPDATE_ANATOMY.md) |
| §8 | Child Entry Modes | [UI_CREATE_AND_UPDATE_CHILDREN.md](UI_CREATE_AND_UPDATE_CHILDREN.md) |
| §9 | Custom Component Resolution Hierarchies | [UI_CREATE_AND_UPDATE_CHILDREN.md](UI_CREATE_AND_UPDATE_CHILDREN.md) |
| §10 | Custom UI Overrides (whole-content level) | [UI_CREATE_AND_UPDATE_CHILDREN.md](UI_CREATE_AND_UPDATE_CHILDREN.md) |
| §11 | `hideChild` / `hideChildren` / dynamic `hide<ResourceName>` — Child Resource Suppression | [UI_CREATE_AND_UPDATE_CHILDREN.md](UI_CREATE_AND_UPDATE_CHILDREN.md) |
| §12 | `maxRecords` — Maximum Added Record Count | [UI_CREATE_AND_UPDATE_CHILDREN.md](UI_CREATE_AND_UPDATE_CHILDREN.md) |
| §13 | `Update.vue` Hydration Lifecycle | [UI_CREATE_AND_UPDATE_CHILDREN.md](UI_CREATE_AND_UPDATE_CHILDREN.md) |
| §14 | Child Soft-Deletion & Undo (`_action: 'deactivate'`) | [UI_CREATE_AND_UPDATE_CHILDREN.md](UI_CREATE_AND_UPDATE_CHILDREN.md) |
| §4 | Field Visibility Precedence — `showFields` > `hideFields` > `workflowFields` | [UI_CREATE_AND_UPDATE_VISIBILITY.md](UI_CREATE_AND_UPDATE_VISIBILITY.md) |
| §5 | Dynamic `defaultValues` (functions at both levels) | [UI_CREATE_AND_UPDATE_VISIBILITY.md](UI_CREATE_AND_UPDATE_VISIBILITY.md) |
| §6 | `fieldProps` — Per-Field Control Prop Overrides | [UI_CREATE_AND_UPDATE_VISIBILITY.md](UI_CREATE_AND_UPDATE_VISIBILITY.md) |
| §7 | Custom (Non-Schema) Fields — Strict Storage Rule | [UI_CREATE_AND_UPDATE_VISIBILITY.md](UI_CREATE_AND_UPDATE_VISIBILITY.md) |
| §15 | Base Field Subsystem (`src/_fields/`) | [UI_FIELDS_REGISTRY_GUIDE.md](UI_FIELDS_REGISTRY_GUIDE.md) |

## 1. Overview & Contracts
- `Create.vue` / `Update.vue` inject `resourceConfig`, `resourceRecord`, and `pageState` (all provided once at `Page.vue`) exactly like `View.vue`.
- **State binding, not fetching**: `Create` never calls services/stores directly (per §1/§3/§5 of `CORE_ARCHITECTURE_RULES.md`) — every keystroke lands in the shared `pageState` reactive tree via `setRecord`/`setControls`/`addChild`/`updateChild`, and `PageAction` sections own `submit()`/`build()`.
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

## 16. Draft Persistence — Add/Edit forms survive a reload

Every Add, Edit, action, and custom sub-route page auto-saves the user's input to
`localStorage` and restores it on the next visit. It is on by default; no page,
content, or `_ui/` override has to ask for it.

**Canonical spec: [UI_PAGE_STATE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_PAGE_STATE.md) §10.** Only the
form-side facts are repeated here.

### 16.1 What this means for `Create.vue` / `Update.vue` / `FormRecord` / `FormChild`

**Nothing.** These components stay agnostic of storage. They keep reading and
writing `pageState` exactly as §3 and §13 describe. The whole mechanism lives in
`usePageState.js` + `usePageStateDraft.js`.

The two ordering facts worth knowing:

- The draft is applied **after** initialization — `defaultValues` (§5),
  `strategy.controls`, and `Update.vue`'s server hydration (§13) all run first,
  and the draft is laid on top. On a record page the restore waits until a node
  actually carries the route's `code`, so it cannot be clobbered by a late
  `pageState.load`.
- Restore writes **in place**: fields go into the existing `node.record` object,
  child rows are spliced into the existing `children` arrays. No node and no
  record object is replaced, so `FormRecord`'s identity-keyed default-seeding
  watch (§5) does not re-fire, `FormChild`'s row indexes stay valid, and
  `Update.vue`'s `identifier`-keyed one-shot hydration (§13) is unaffected.

Child rows come back with their `_action` intact, so a row soft-deleted with
`_action: 'deactivate'` (§14) is still soft-deleted after a reload.

`meta.currentStep` is saved too, so a multi-step wizard reopens on the step the
user left.

### 16.2 Storage keys

| Page | Key |
|---|---|
| Add | `aql_<Resource>_Add` |
| Edit | `aql_<Resource>_Edit_<Code>` |
| Action route | `aql_<Resource>_<Action>` (+ `_<Code>` when the route has one) |
| Custom sub-route | `aql_<Resource>_<PageSlug>` (+ `_<Code>` when the route has one) |

`index` and `view` pages collect no input and get no draft.

### 16.3 Lifecycle

- A **successful** `submit()` clears the draft.
- A **failed** submit keeps it — a network or validation failure must not cost the
  user their work.
- `FormActionReset` and `FormActionCancel` (§ [UI_ACTION_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_ACTION_SYSTEM.md))
  both clear it — Reset and leaving via Cancel both mean "discard my unsaved work".
- Logout keeps it. Drafts are not session data.

### 16.4 Opting a page out

```js
// pages/{scope}/{page}.js, or a _ui/ page override
export default { persist: false }
```

Use it for pages where a stale draft would be actively wrong — a form seeded
entirely from a live server calculation, for instance. Manual control
(`persistDraft()`, `restoreDraft()`, `clearDraft()`, `draftKey`) is on `pageState`;
see UI_PAGE_STATE.md §10.6, including why the manual save is **not** called
`saveDraft()`.