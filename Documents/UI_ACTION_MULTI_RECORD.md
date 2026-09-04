# Action Subsystem — Multi-Record Action Config & Grammar

> Part of **[﻿# AQL Action System Guide](UI_ACTION_SYSTEM.md)**. The `AdditionalActions.targets[]` composable API, request pipeline, config shape and expression grammar.

---

### 7.0 Composable API

```javascript
const {
  additionalActions,   // raw config array for the resource
  actionsFor,          // (record, { only, exclude }) -> gated action configs
  entriesFor,          // (record, { only, exclude }) -> [{ key, name, actionName, action, props, run }]
  runAction,           // (action, record) -> navigate routes | mutate opens the dialog
  openAction           // (action, record) -> force the dialog, skipping the kind check
} = useAdditionalActions(resourceName?)   // omit the name to follow the active route
```

| Consumer | Uses | Why |
|---|---|---|
| `AdditionalActionsButtons` | `actionsFor` + `runAction` | renders its own buttons from the raw configs |
| `ResourceActions` | `entriesFor` | needs resolver names + presentation props to fold into its cluster |
| A custom list row | either | e.g. `ListToday.vue` uses `actionsFor({ only })` and sorts locally |

#### 7.0.1a `kind: 'navigate'` — targets and params

A `navigate` action collects nothing: `runAction` maps its `navigate` block straight onto
`useResourceNav().goTo()` and returns. `navigate.target` uses the **route-name vocabulary**
(the route names in `router/routes.js` are the nav targets are the `meta.page` values):

| `navigate.target` | Resolves to | Params sent |
|---|---|---|
| `index` | `/{scope}/{resourceSlug}` | — |
| `add` | `/{scope}/{resourceSlug}/_add` | — |
| `view` | `/{scope}/{resourceSlug}/{code}/_view` | `code` |
| `edit` | `/{scope}/{resourceSlug}/{code}/_edit` | `code` |
| `action` | `/{scope}/{resourceSlug}/{code}/_action/{action}` | `code`, `action` |
| `resource` | `/{scope}/{resourceSlug}/{pageSlug}` | `pageSlug` |
| `record` (default) | `/{scope}/{resourceSlug}/{code}/{pageSlug}` | `code`, `pageSlug` |

* `code` defaults to the clicked record's `Code`; `scope` / `resourceSlug` default to the
  active resource, and are set only for cross-resource navigation.
* `target: 'action'` takes its `:action` segment from `navigate.action`, falling back to
  `navigate.pageSlug` — the authoring UI writes a single slug field, and forwarding it as
  `pageSlug` alone would push an empty `:action` param.
* The target list above is **exhaustive**. There are no aliases: a `navigate.target` that is
  not a route name is rejected by `useResourceNav.goTo()` with a console error, and the action
  does not navigate. Config predating the `resource-page` / `record-page` rename must be
  re-saved through the **Manage Actions** dialog.

Ordering is the one thing a consumer may legitimately decide locally — it is presentation,
not eligibility. `ListToday.vue` sorts its three actions into escalation order while still
taking the gate from `actionsFor`.

The dialog half is `useAdditionalActionsDialog()`, consumed **only** by the single
`AdditionalActionsDialog` instance in `MainLayout.vue`.

### 7.0.1 The request pipeline (`additionalActionsPipeline.js`)

One workflow action, taken apart into single-responsibility steps. Every step resolves
the resource config, the sheet headers, the select-option records, the signed-in user and
the transport **internally**, so a caller supplies only an action name and its data:

```javascript
const {
  resolveAction,          // (nameOrConfig, { resource }) -> { resource, action }
  actionTitle,            // (nameOrConfig, record)       -> dialog heading
  actionSubtitle,         // (nameOrConfig, record)       -> dialog subheading
  actionFieldGroups,      // (nameOrConfig, { record, outcome }) -> render-ready groups + seeds
  createActionForm,       // (nameOrConfig, { record, values })  -> reactive flat form, seeded
  validateActionForm,     // (nameOrConfig, { record, form })    -> '' | first error message
  extractActionPayload,   // (nameOrConfig, { form })            -> { fields, targetFields }
  buildActionRequest,     // (nameOrConfig, { record, code, data }) -> executeAction envelope
  dispatchActionRequests, // (envelope | envelope[])   -> { success, error, response }
  executeAdditionalAction // build + dispatch in one call
} = useAdditionalActionsPipeline(resourceName?)   // omit to follow the active route
```

Alongside it, four pure named exports for callers that already hold groups:
`actionLabelOf`, `pickSuppliedValue`, `seedActionValues`, `extractActionPayload`,
`actionFailureMessage`.

**Every step takes an action *name* or an already-normalized *config***. Passing a config
through untouched is what lets the dialog — which already holds the entry the user
clicked — reuse each step without a second config lookup. A name is resolved through
`normalizeAdditionalActions` (exported from `useResourceConfig.js`, module-scope so an
arbitrary resource can be resolved, not just the active one).

**Value addressing (`data`).** `buildActionRequest` accepts user values under whichever
address a developer naturally reaches for, resolved in this order per field:

| Field family | Accepted |
|---|---|
| Source (`fields[]`) | the flat address / derived header (`ProgressPostponedComment`), or the **short authored name** (`Comment`) |
| Target (`targets[].fields[]`) | the flat address (`'newVisit.Date'`), or a nested bag (`{ newVisit: { Date } }`) |

A target field deliberately does **not** answer to a bare column name — two targets may
both carry a `Date`. Anything omitted falls back to the field's own `from`/`value` seed,
then `''`.

> [!NOTE]
> **Source fields are seeded too.** `buildSourceFieldGroup` now resolves `from`/`value`
> through `prefillExpression` exactly as the target groups do, so a source field carrying
> `from` + `type` renders as an editable prefill (§7.2) rather than blank. Absent
> `from`/`value` still seeds `''`, so every existing config renders unchanged.

**Codes and `$ref`.** `buildActionRequest`'s `code` passes through `textOrRef`: a concrete
string is trimmed, and a `batchRef('OutletVisits.latest.code')` `$ref` object survives
untouched. That is what lets an action address a record created **earlier in the same
batch** (§7.0.2). Omit `code` and it falls back to `record.Code`.

A `navigate`-kind action has no envelope — `buildActionRequest` returns `null` and warns,
because a navigate action writes nothing.

### 7.0.2 Two dispatch paths, deliberately

| | Popup path | Batched path |
|---|---|---|
| Entry point | `useAdditionalActions().runAction()` → `AdditionalActionsDialog` | `pageState.includeAdditionalAction(name, data)` |
| When | the record already exists and the user fills the inputs | the action must travel **with** the page's own submission |
| `usePageState` | its OWN instance, `usePageState({}, { persist: false })`, held by `useAdditionalActionsDialog` — never the host page's | the host page's own instance |
| Target record | `record.Code` | a concrete code, or a `$ref` to a record this batch creates |
| Dispatch | `pageState.run({ notify: false })` — with no nodes, `build()` emits just the action | appended to `defaultBuild()`, sent by `submit()` |
| Stored as | a **pure domain model** in the dialog's own `pageState.actions` | a **pure domain model** in the page's `pageState.actions` |

A queued action is then readable and writable by name and dot path, so a page can render
its own inputs instead of the dialog:

```js
pageState.includeAdditionalAction('Complete', {}, { resource: 'OutletVisits' })

const comment  = pageState.useActions('Complete', 'fields.Comment')
const nextDate = pageState.useActions('Complete', 'targets.nextVisit.Date')

pageState.getActions('Complete')                    // whole data object
pageState.setActions('Complete', null)              // unqueue
```

`fields.<Header>` and `targets.<targetKey>.<Column>` are the same two wire buckets §7.0.1
describes — the path IS the address the envelope uses. Full contract in
[UI_PAGE_STATE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_PAGE_STATE.md) §15.1.

The batched path never stores a wire request. `includeAdditionalAction` runs the pipeline
to resolve the config and the field schema, then keeps
`{ key, resource, code, actionConfig, data: { fields, targets } }`. `build()` turns each
entry into its `executeAction` envelope via
`executeActionRequest(resource, code, actionConfig, data)` — see
[UI_PAGE_STATE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_PAGE_STATE.md) §15.2.

Both paths now submit through `pageState`. What the popup must NOT do is share the HOST
page's instance: `pageState.run()` gates on `validationErrors`, which validates that page's
nodes — a dialog action would be blocked by a form error that has nothing to do with it —
and the dialog is a single global singleton, while an index page has no `pageState` at all.
So `useAdditionalActionsDialog` builds its own. It creates no nodes on it (`initResource` is
never called), which is what keeps `validationErrors` empty and `build()` down to the one
`executeAction` envelope. Field values are read and written through `getActions` /
`setActions` at `fields.<Header>` and `targets.<targetKey>.<Column>`; the required-field
check still runs through `pipeline.validateActionForm` before `run()`, because `run()`
validates nodes, not action fields.

The batched path exists for the case the popup cannot express: *create a record **and**
run a workflow action on it, atomically, in one batch*. Full contract in
[UI_PAGE_STATE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_PAGE_STATE.md) §6.4 / §7.

```javascript
// A page that creates a visit and immediately stamps it Postponed.
pageState.initResource('OutletVisits', { fields: { OutletCode, Date } })
pageState.includeAdditionalAction('Postpone', { Comment: 'Rescheduled by planner' })
await pageState.submit()
// -> [ create OutletVisits, executeAction Postpone { code: { $ref: 'OutletVisits.latest.code' } } ]
```

### 7.1 Config shape

```json
{
  "action": "Postpone", "label": "Postpone", "icon": "event_repeat",
  "color": "warning", "kind": "mutate",
  "column": "Progress", "columnValue": "Postponed",
  "visibleWhen": { "column": "Progress", "op": "eq", "value": "PLANNED" },

  "fields": [
    { "name": "Comment", "label": "Reason", "type": "textarea", "required": true }
  ],

  "targets": [{
    "resource": "OutletVisits",
    "mode": "create",
    "key": "newVisit",
    "label": "New Visit",
    "fields": [
      { "name": "OutletCode",             "from": "$record.OutletCode" },
      { "name": "Progress",               "value": "PLANNED" },
      { "name": "Date",                   "label": "New Date", "type": "date", "required": true },
      { "name": "ProgressPlannedComment", "label": "Planned Comment", "type": "textarea",
        "from": "$record.ProgressPlannedComment" }
    ]
  }]
}
```

### 7.1.-1 `resourceLevel`

`"resourceLevel": true` marks an action that belongs to the RESOURCE, not to a row — a
Quick Visit raised from the Index page, where no record is in context.

Such an action **creates the row it then stamps**. `handleExecuteAction` accepts a request
with no `code` only when the config says `resourceLevel`, builds the source row from the
action's own `fields[]` through the normal create path (Code, `DefaultValues`,
`AccessRegion`, audit, required/unique checks), and carries on from there. So the outcome
stamp, `RespondDate` and every target run exactly as they do for a row-level action, and
`$record.*` in a target resolves against the row just created.

`actionsFor` splits the two sets and never mixes them: with no record it returns only the
resource-level actions, with a record only the row-level ones. So `ResourceActions` offers
a resource-level item in the Index FAB cluster, and a row's own action menu never grows one.
On top of `can<Action>`, a resource-level action also needs `canWrite`, because it writes a
new row. `visibleWhen` has no record to test and is skipped.

### 7.1.-0.5 `fields[]` — `type` decides visibility

The source group follows the SAME rule as a target's fields (`GAS/actionTargets.gs`):

| Field shape | Behaviour |
|---|---|
| `from` / `value` only, no `type` | resolved server-side from the trusted config, never rendered, never user-editable |
| `type` + `from` / `value` | pre-filled for the user, whatever they submit wins |
| `type`, no seed | an empty input |

A hidden field is resolved by `buildActionSourceFields` and **overrides** whatever the
client sent for the same header — that is what makes a hidden stamp trustworthy. Use it for
`$dateTime` / `$userName` stamps and fixed values. `$record.*` is not useful here: it reads
the row as it was BEFORE the action, and on a `resourceLevel` create there is no such row.

A typed field the client did not send is left untouched rather than blanked, so an older
caller cannot clear a column it never knew about.

### 7.1.0 `visibleWhen`

An object or an array of objects, ANDed. Absent or empty ⇒ always visible. Evaluated
**client-side only**, by `isActionVisible` (`useResourceConfig.js`) through
[`src/utils/tokenEvaluator.js`](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/utils/tokenEvaluator.js)
— it decides what is OFFERED, never what is permitted. Permission is `can<Action>`, enforced
server-side.

| | |
|---|---|
| Shape | `{ "column": "Progress", "op": "eq", "value": "PLANNED" }` |
| Ops | `eq`, `neq`, `in`, `not_in`, `gt`, `gte`, `lt`, `lte`, `contains`, `empty`, `notEmpty` |
| Legacy ops | `ne` → `neq` and `nin` → `not_in` are aliased on load, so every config already in a sheet keeps working. The **Manage Actions** dialog rewrites them canonically on the next save. |
| `value` | A literal, an array (for `in`/`not_in`), or a **dynamic token** — the same registry list views use (§5.2 of `UI_LIST_SWITCHER.md`). `{ "column": "Date", "op": "lte", "value": "$startOfDay:0" }` hides an action on future-dated records; `$userCode` / `$userRoles` gate one on the signed-in user. |
| Comparison | Case-insensitive for literals. A date column that cannot be parsed never matches. A column absent from the record reads as blank. |
| Malformed row | Dropped, exactly as a malformed target `when` is — a dropped condition does not constrain. |

### 7.1.1 Dialog headings (`title` / `subtitle`)

Both are optional **template strings** resolved against the record:

```json
"title":    "Postpone {$outlet.Name}",
"subtitle": "{Code} • {Date}"
```

| | Behaviour |
|---|---|
| Placeholder syntax | `{Column}` — a dot path on the record, so `{$outlet.Name}` reads the relation getter |
| Context | The **record only**. No `$userName` / `$today` tokens — `$outlet` (a record property) and `$userName` (a token) would collide in one namespace, and a heading describes the record. |
| Unresolved placeholder | Renders empty, then stranded separators (`•`, `-`, `|`, `,`) are collapsed and trimmed, so `"{$outlet.Name} • {Code}"` on an un-enriched record gives `"OV26000018"`, not `" • OV26000018"` |
| `title` absent/blank | Falls back to `label`, then `action` |
| `subtitle` absent | Falls back to the record `Code` |
| `subtitle: ""` | Deliberate **no subtitle** — an explicit empty string does not fall back |

> [!NOTE]
> These are **presentational and client-side only** — GAS never renders the dialog, so
> `actionTargets.gs` is not involved. The confirm BUTTON always reads as the action
> (`label` / `action`), never the title: a custom heading must not change what the user
> is agreeing to.

Deliberately NOT the `from`/`value` expression grammar (§7.4): a heading is usually
several fields plus literal text, which a single-value expression cannot express, and
`$outlet.Name` would parse there as an unknown token and throw.

### 7.2 The one field rule

`type` decides **visibility**; `from` / `value` decide **seeding**. There is no separate
`editable` flag.

| Field carries | Behaviour |
|---|---|
| `type` only | Renders blank, user fills it |
| `from` only | Copied silently server-side, never shown |
| `value` only | Constant or token, silent |
| `from` + `type` | Copied as a **prefill**, rendered, user may edit |
| `value` + `type` | Token prefill, editable |

### 7.3 Two field families, deliberately asymmetric

| | Keyed by | Derivation |
|---|---|---|
| `fields[]` (source record) | Derived header | `{column}{PascalCase(columnValue)}{name}` — `Comment` → `ProgressPostponedComment` |
| `targets[].fields[]` | **Literal** column name | None. A target's columns have no relationship to the source's outcome. |

> [!WARNING]
> The suffix helper is `actionHeaderSuffix` in `additionalActionsSchema.js`, **not**
> `appHelpers.toPascalCase`. `toPascalCase` splits on `[- ]` only, so `REVISION_REQUIRED`
> becomes `Revision_required` there but `RevisionRequired` in GAS's `toActionHeaderSuffix`.
> The derived header must match the column the backend writes. `toPascalCase` is
> load-bearing for the section/column resolvers and is deliberately left alone.

### 7.4 Expression grammar (server-authoritative)

| Expression | Resolves to |
|---|---|
| `$record.<Column>` | Source record, **as it was before** this action mutated it |
| `$field.<Name>` | A value typed into the action's own `fields[]` (short name or derived header) |
| `$target.<key>.<Column>` | A column on an **earlier** target in the same run |
| `$userName` `$userCode` `$userEmail` `$userRole` `$userDesignation` `$userRegion` | Identity tokens. `$userName` is `user.Name || user.UserID` |
| `$now` | Epoch milliseconds (`Date.now()`) |
| `$dateTime` | `YYYY-MM-DD HH:mm:ss`, 24-hour, script timezone — the shape the `...At` stamps and `RespondDate` use. Takes **no** `:N` offset despite sitting next to `$date:N`; `$dateTime:7` silently ignores the `7` |
| `$today` `$date:N` | `YYYY-MM-DD`, today ± N days |
| `$$anything` | Escape — yields the literal `$anything` |
| anything else | Literal |

An unrecognised `$token` **throws**, so a config typo fails the action instead of writing
the string `$usrName` into a cell. The frontend's `prefillExpression` resolves only
`$record.*` and the tokens, for display of prefilled values; the server always re-resolves.

### 7.4.1 Conditional targets (`when`)

A target may carry a `when` gate. When it evaluates false the target is **skipped
entirely** — no expression resolution, no sheet read, no validation, no write. This is what
lets one action express an **optional** follow-up record instead of splitting into two
near-duplicate config entries:

```json
{
  "resource": "OutletVisits", "mode": "create", "key": "replacementVisit",
  "label": "Replacement Visit (optional)",
  "when": { "field": "Date", "op": "notEmpty" },
  "fields": [
    { "name": "OutletCode", "from": "$record.OutletCode" },
    { "name": "Progress",   "value": "PLANNED" },
    { "name": "Status",     "value": "Active" },
    { "name": "Date",       "label": "Replacement Date", "type": "date" }
  ]
}
```

`when` accepts a **single object or an array**; an array is ANDed.

**Grammar.** Exactly one left-operand key per condition, in this precedence:

| Key | Resolves to |
|---|---|
| `field` | a value the user typed into **this target's own** inputs — a **literal column name** (`"Date"`), read from `targetFields[<key>][<field>]` |
| `column` | a column on the **source record**, as it was before this action mutated it |
| `expression` | any `from`/`value` expression — `$record.X`, `$field.X`, `$target.k.C`, `$today`, … (§7.4) |

Ops are `eq`, `ne`, `in`, `nin`, `empty`, `notEmpty`. This is deliberately NARROWER than
`visibleWhen`'s set: a target's gate is decided **server-side** by
`evaluateActionTargetCondition` (GAS), which understands only these six and no dynamic
tokens. `visibleWhen` is purely client-side and therefore free to offer the ordered
operators and the `$token` vocabulary; do not copy them here without adding the server half.

**Forgiving, in one direction only.** A condition carrying none of the three operand keys,
or an op outside the set, is **dropped** — not an error, exactly as `normalizeVisibleWhen`
discards a malformed `visibleWhen` row. A dropped condition does not constrain, so a
malformed `when` **runs** the target rather than silently suppressing it. An unrecognised
`$token` inside an `expression` still throws, like any other expression typo.

**Backward compatibility.** Absent or empty `when` ⇒ the target always runs. Every config
authored before this feature keeps its exact behaviour, and `cleanTarget` in
`actionManager.html` omits the key entirely when nothing was authored, so an untouched
action re-serializes byte-identically.

**Required fields inside a conditional target.** `useAdditionalActions.validate()` skips
`required` checks for fields belonging to an **inactive** target. That is the whole point of
the gate: `{ "field": "Date", "op": "notEmpty" }` plus a `required` sibling means *"if you
start filling this block, finish it"* — not *"you must fill this block"*. Marking the gating
field `required` instead would force the branch to always happen, which is the workaround
this feature replaces.

**A skipped target is not addressable.** `$target.<key>.<Column>` pointing at a target that
was skipped **fails the whole action** with an explicit message naming the skip — nothing is
written. A conditional target can therefore never be a dependency; make the dependent
expression conditional too, or drop the `when`.

```
Action expression "$target.replacementVisit.Code" refers to target "replacementVisit",
which was SKIPPED by its "when" condition on this run, so it produced no record. …
```

This is deliberately distinct from the "refers to a target that has not run yet" message: the
first is an *ordering* mistake (move the target earlier), the second a *design* mistake.

**Where it is decided.** The server is authoritative — `isActionTargetActive` /
`evaluateActionTargetCondition` in `GAS/actionTargets.gs`, checked in `executeActionTargets`
pass 1 **before** `prepareActionTarget`, so a skipped target never opens a sheet context.
Skipped targets are not registered in `ctx.targets`, and
`summarizeActionTargetResults` reports them as `{ key, mode, resource, skipped: true }` (no
`code`) so a caller can tell "not created" from "created".

The client mirror is `isTargetActive` in `additionalActionsSchema.js`. It is
**presentation and validation only** and exists solely so the dialog does not demand a
`required` field inside a block the user chose not to fill. `buildTargetFieldGroups` still
renders **every** target's inputs — a `field`-keyed condition is satisfied by typing into
that very group, so hiding it would make the condition unsatisfiable — and tags the group
`hasCondition` so the dialog can label it optional. `buildPayloadFields()` keeps sending all
typed target values; the server ignores those belonging to a skipped target.

> [!WARNING]
> `evaluateActionTargetCondition` (GAS) and `evaluateConditionOp`
> (`useResourceConfig.js`, consumed by `isTargetActive`) are a
> **matched pair**. Change one, change the other. Note `visibleWhen` no longer routes
> through `evaluateConditionOp` — it evaluates via `src/utils/tokenEvaluator.js`. The client can only ever be *more*
> lenient — `prefillExpression` cannot resolve `$field.*` / `$target.*`, so a gate on either
> validates loosely in the browser and is decided for real on the server.


---

⬑ Back to **[﻿# AQL Action System Guide](UI_ACTION_SYSTEM.md)**.
