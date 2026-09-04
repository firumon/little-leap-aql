# 3-Layer UI — Form Architecture

> Part of **[3-Layer UI — Resource UI Module Developer Guide](UI_MODULE_DEVELOPER_GUIDE.md)**. Choosing a form shape, what the form-fields composable derives, shared Add/Edit cards, record vs control fields, and wizard navigation.

---

## 13. Form Architecture

### 13.0 Which form shape does this resource need?

Two shapes, one test. Ask what the form's **primary input** is.

| | Generated form | Workflow form |
|---|---|---|
| Primary input | the resource's **own columns** | a **derived tree** the schema cannot express — line items with per-bin quantities, allocations, a selection across child rows |
| Contents | `['Create']` / `['Update']` | bespoke content cards, one per decision |
| Field set | generated from `_fields`, narrowed via `fields`/`showFields`/`hideFields`/`fieldProps` | each single header mounts its own `_fields` control (§2.4) |
| Default | **yes — start here** | only when the test above says so |

A workflow form is not a licence to hand-assemble a resource's columns. Even inside one:

- **every input is still a `_fields` control**, resolved through `resolveFieldComponent`
  (§2.4) — no raw `q-input`/`q-select`;
- **every real header still writes through `pageState.setRecord`** and rides the normal
  payload — §13.5;
- **a header collected on more than one page uses the same header, the same control and the
  same wording on each.** A draft submitted from Edit and one submitted from the Add wizard
  must ask the requester for the same thing.

Sections 13.1–13.3 govern the generated form. 13.4–13.6 apply to both.

**A second workflow branch may live inside Add, or belong on its own action route.** Some
resources offer a mode that skips the normal path — a direct entry that self-approves and
writes its consequences immediately. Two tests decide where it is built:

| Build it **inside Add** when… | Build it as an **action route** when… |
|---|---|
| the branch is chosen **before** any data is entered, as part of the same first decision | it acts on a record that already exists |
| it produces the **same record shape**, differing only in the states and side-effects the submit handler writes | it collects a different set of inputs |
| the user could plausibly flip between the two mid-form without losing work | entering it is itself a workflow transition |

A skip-approval mode chosen on step 1 alongside the outlet passes all three: it is one
wizard whose final handler writes a different `Progress` and appends the movements, gated by
whatever makes the mode available (a region, a permission). Forcing it onto a separate route
would ask the user to decide *which page to open* before they know what they are entering.
Keep the mode in a control field (§13.5) so the handler reads it back, and render its
control only when it can actually be honoured — an unavailable mode is not shown disabled,
it is not shown.

### 13.1 What the form-fields composable derives from `_fields`

> [!IMPORTANT]
> **A generated form's field set comes from its `_fields` metadata
> (`APP.Resources.UIFields`, see `SCHEMA_RESOURCE_COLUMNS.md`), never hand-assembled.** A
> `_ui/` override narrows or reorders the generated set; it does not replace generation with
> a manually written field list.

Reads `config.ui.fields` (`UIFields`) merged with any sheet header not already declared,
drops audit columns (`AccessRegion`, `CreatedAt`, `CreatedBy`, `UpdatedAt`, `UpdatedBy`),
and maps each survivor to a control **by schema signal, in this priority**:

1. `type: 'file'` → file upload control.
2. `type: 'datetime'` → the datetime `_fields` control.
3. `type: 'date'`, or a header ending in `Date` → the date control — naming convention alone
   is enough, no explicit `type` required.
4. Header is exactly `Code` → readonly text.
5. Toggle-shaped (`type: 'toggle'`/`'boolean'`, or a 2-option Yes/No-style `options` array)
   → a toggle switch.
6. Header `status` or `type: 'status'` → the status control (chip-styled select).
7. `type: 'select'`/`'dropdown'` → a select populated from `field.options`.
8. Otherwise, a declared cross-reference (`APP.Resources.Relations`) → a relation picker.
9. Otherwise → a generic text-family input, typed further by type normalization.

Every one of these resolves through `resolveFieldComponent(type, mode)` into
`src/_fields/<type>/` — the priority list decides **which type**, never which raw
Quasar control. For what each resolved type renders, which aliases map to it, and how to
mount one by hand, see
[`_fields/REGISTRY.md`](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/_fields/REGISTRY.md).

### 13.2 Cross-reference option labels

`APP.Resources.Relations` (keyed by source column) supplies `resource`, `targetHeader`
(default `Code`) and `labelHeader` — a column name, a `$parent.Field` path, or a label
template. A relation picker's options always render through that one expression, so
`Name (Code)` (or whatever `Relations` specifies) is never re-derived by hand. Narrow the
option **set** with `fieldProps: { OutletCode: { options: filtered } }`.

### 13.3 What a `_ui/` override may change — and must not

| May do | Must not do |
|---|---|
| Fix the field **set and order** via `fields: [...]` | Invent a field the schema doesn't declare |
| Re-admit a hidden field via `showFields` | Hand-roll a raw `q-input`/`q-select` bypassing `_fields` |
| Narrow a picker's `options` via `fieldProps` | Re-derive a cross-ref label instead of using the resolved option set |
| Relabel/require a field via `fieldProps` | Reformat a value outside its `_fields` control |
| Replace one column's control via `FormField<Header>` | Replace a generated form with a static template |

Field visibility precedence: **`showFields` > `hideFields` > `workflowFields`**; `fields`
fixes both set and order.

> [!IMPORTANT]
> **A workflow stamp column (`Progress`, `...At`, `...By` audit trios) is never a form
> field, in any state.** It is set once, programmatically, inside the `PageAction` submit
> handler that causes the transition (§13.6) — never exposed via `fieldProps`, never
> re-admitted with `showFields`. Letting a user edit a stamp column directly breaks the
> guarantee that "who did this, and when" reflects what actually happened rather than what a
> form field said. This is exactly what `workflowFields`'s default-hide behavior exists to
> enforce — do not defeat it for a stamp column.

### 13.4 Add and Edit share their cards

When Add and Edit collect overlapping data, **resolve the same components at the resource
tier and list them in both contracts** (§3.1) rather than building a parallel set. Two
independently authored forms for the same data drift the moment one gets a field the other
doesn't; sharing makes drift structurally impossible.

A shared card is told what page it is on, never asks:

- the Add contract pins it to a step (`PropsAdjustItems: { step: 2 }`); the single-view Edit
  contract declares nothing and the card renders unconditionally (§13.6);
- the parts that genuinely differ get their own page-tier components — the Edit page's
  read-only identity card, or the wizard's mode selector.

**Edit states its fixed fields rather than offering them.** An identity field that cannot
change for the life of a record (which outlet a request is for, the date it was raised) is
rendered as a read-only detail row, not a disabled input — re-pointing it would silently
rewrite what an approver already read.

**Edit explains a locked record in-page.** The Edit URL is directly reachable, so a record
that has moved on since the link was opened must say why nothing here will save, in a banner
above the form, rather than failing at the sticky bar after the user has typed.

**State-adaptive submission controls matrix in Edit:**

| Entry State (`Progress`) | Intent toggle | Resubmission commentary | Button label |
|---|---|---|---|
| `DRAFT` | "Save as Draft" (**defaults ON**) | Hidden when draft ON; shown when draft OFF | "Save Draft" / "Submit" |
| `REVISION_REQUIRED` | Omitted entirely | Unconditional textarea | "Resubmit Request" |

### 13.5 `pageState` — record fields vs control fields

A form collects two different kinds of value, and they are stored differently:

| | Written with | Reaches the backend | Examples |
|---|---|---|---|
| **Record field** | `setRecord` / `setRecord` | yes, in the payload | a real resource header — `OutletCode`, `ProgressSubmittedComment` |
| **Control field** | `setControls` | **no** | page-only intent and working state — `isDraft`, `RestockMode`, `EditHydratedFor`, an allocation plan |

**Control fields as working surface.** The user's whole decision — which bins, how much from
each, which lines arrived — accumulates in control fields, which is what lets the sticky bar's
handler read the finished decision back and build the batch payload (§8.2).

**Multi-caller node hydration keying (`EditHydratedFor`).** When multiple components on an
Edit page invoke the same form composable (`useRestockEditForm`), track hydration using a
node-level control field rather than a local closure variable:
```javascript
const hydratedFor = () => text(pageState.getControl?.('EditHydratedFor', null, PARENT_NODE))
if (hydratedFor() !== text(parent.Code)) {
  pageState.setControls('EditHydratedFor', text(parent.Code), PARENT_NODE)
  // hydrate child lines...
}
```
This prevents duplicate child-line seeding or wiping out in-progress edits across sibling cards.

**Child-line deduplication during hydration.** Normalize incoming lines by business key
(e.g. `SkuCode`) and prioritize active records over deactivated rows before writing to
`pageState`, eliminating duplicate lines in form steppers.

**Submission intent and comment precedence.** Place the non-advancing intent toggle ("Save as
draft") *before* the comment box, and hide the comment box when draft is toggled on (since
a private draft has no reviewer or reader yet).

**Stamps are written by the handler, under the hood.** `Progress`, `...At`, `...By` are set
in the submit handler that causes the transition, never exposed as fields (§13.3) — so a
submission cannot be back-dated or attributed to someone else. A save that is *not* a
submission (a draft) gets **no** stamp: leaving them empty is what lets a later real submit
record when it actually happened.

**The first content is the hydration point** on any page with no `Create`/`Update` to seed
the node (§5.5). It calls the page composable, which loads the record and its children and
writes them onto `pageState`. Preload every related resource the *later* steps need at that
same point, so step 2 doesn't issue a fetch per card as the user arrives.

### 13.6 Multi-step wizard navigation

> [!IMPORTANT]
> **Split into steps only for one of two reasons — not to make a form feel shorter.**
>
> 1. **Sequencing dependency**: a later step needs data collected in an earlier one before it
>    can render meaningfully (item entry can't happen until the outlet and mode are picked; a
>    review step can't summarize items that don't exist yet).
> 2. **Unrelated decisions**: two groups of fields ask the user to think about genuinely
>    different things (which outlet vs. which items vs. draft-or-submit), and combining them
>    onto one screen forces context-switching mid-form.
>
> If neither reason applies, it is one step, not several.

**The sticky bar drives the whole wizard.** Content cards stay pure inputs with no
navigation of their own — a card that navigated or submitted would double-fire against the
dispatcher and make a handler's veto unable to stop it. The bar is a `PageAction.js` with a
**`get actions()` getter**, re-evaluated live off `pageState.meta.currentStep`, mounting
framework back/next buttons — never a bespoke footer:

```javascript
// _ui/{Ui}/components/{Scope}/{Resource}/Add/PageAction.js
export default {
  get actions () {
    if (step() === 2) return ['back', 'next']
    if (step() === 3) return ['back', 'submit']
    return ['cancel', 'next']
  }
}
```

Document the flow as a table in the file's docblock — `step 1 outlet + mode → [Cancel]
[Continue]` — so the shape is readable without tracing the getter.

**A step is a screen, not a file.** Two or more contents may share one `step` — split the
step's blocks by job and list each in the contract (UI_CONTENT_SYSTEM §6). Step 4 of the
consumption wizard is `RestockOptions` (how the restock is routed) plus `RestockItems`
(what is in it), both at `step: 4`.

**Steps are declared by the contract, not the card.** Each card takes a `step` prop and
gates on it; the contract assigns it (§5.5). `step: null` means "no wizard, always render",
which is what lets one card serve a wizard Add and a single-view Edit:

```javascript
const visible = computed(() =>
  props.step == null || Number(props.step) === (pageState?.meta.currentStep || 1))
```

Gating on `currentStep === 2` directly hides the card forever on a single-view page, where
`meta.currentStep` stays at its initial `1` and no bar moves it.

**Single source of truth**: a wizard field reads and writes through `pageState` directly
(§13.5) — never a parallel local `ref` or mirrored map.

**A review step is read-only.** It re-renders the same projection an earlier step collected,
reusing the composable's aggregate rather than recomputing, so the numbers cannot drift from
what the handler will submit. A decision stays editable only beside the evidence it is made
against — restating it as a control on the review step lets the user change it without
seeing what they are changing it against.

**A review step may collapse a section only when it is a derived consequence, never the
decision itself.** The list the user is signing off on is always open — it is what they came
to confirm. A projection *downstream* of that decision (what the destination will hold
afterwards, including untouched lines) is a confirmation aid, not a second thing to approve,
and is collapsed by default behind an expansion item with a one-line summary. The scopes
differ accordingly: the decision list shows only what is changing; the consequence shows the
whole resulting picture.

> [!IMPORTANT]
> **Veto a step transition or a submission for one of three reasons.**
>
> 1. **Invalidity** — nothing selected where a selection is required, zero items, no
>    allocation made, a required identity field left blank. The form is incomplete.
> 2. **Staleness re-check** — the *same* permission or eligibility condition that gated the
>    FAB/route entry point (§8.1's `show` predicate), re-checked at submit because time has
>    passed and the session, the record's state, or the user's permissions could have changed
>    underneath them. This is not duplication — the FAB gate stops most users from ever
>    opening the flow; the submit-time re-check protects the minority for whom something
>    changed mid-flow.
> 3. **Irreversibility** — the action would contradict a consequence **already committed
>    elsewhere**. A rejection that reverses a record's lines cannot proceed once some of
>    those lines have been delivered: the stock has physically moved, and no reversal the
>    handler can write undoes it. This is not invalidity (the form is complete and correct)
>    and not staleness (no gate ever tested it) — it is a check that only a reversal or
>    cancellation handler needs, and only against downstream state.
>
> ```javascript
> if (active.some((row) => text(row.Progress) === 'DELIVERED')) {
>   return { valid: false, message: 'This request has delivered items and can no longer be rejected.' }
> }
> ```
>
> **Any handler that reverses, cancels or writes off** must ask what has already been
> consumed downstream before it runs — that is the whole content of reason 3.
>
> What a veto must **never** do is re-derive a check the entry gate exists to make and that
> has no plausible staleness window — vetoing on something permanently and irreversibly true
> when the page opened (a static config flag) adds nothing.

**Latch a value that describes how the record was entered, when the same action would change
the field the value is derived from.** A submit button's label ("Submit" vs. "Resubmit") is
captured **once**, in a closure variable set on first read — not recomputed live off
`pageState` — because `submit()` rewrites the same field the label reads, and a live read
flips the label mid-submission while the request is still in flight:

```javascript
// ✓ Captured once, from the state the page was entered in
let entryProgress = null
const enteredAsDraft = () => {
  if (entryProgress === null) {
    const current = String(record.value.Progress ?? '').trim()
    if (!current) return false   // still hydrating — not an answer, don't record it
    entryProgress = current
  }
  return entryProgress === 'DRAFT'
}
```

This is the one deliberate exception to §3.3's "never compute a modifier value eagerly"
rule — that rule is about values that should track the *live* record; this is for values
that must describe the record as it *was*, precisely because the wizard's own action is
about to change it.

**Label the primary button with the transition it performs, never "Save".** Sending the
record on is the point of the page. Which verb depends on the state the page was entered in
— a record that has never been submitted reads `Submit`, one that came back for changes
reads `Resubmit`, and calling a first submission "Resubmit" tells the user they have done
this before. A page with exactly one possible outcome uses a static label; one whose label
follows the record's state uses a getter (§11 rule 4).

---


---

⬑ Back to **[3-Layer UI — Resource UI Module Developer Guide](UI_MODULE_DEVELOPER_GUIDE.md)**.

---

⬑ Back to **[3-Layer UI — Resource UI Module Developer Guide](UI_MODULE_DEVELOPER_GUIDE.md)**.
