# 3-Layer UI — The 10-Tier Lookup & Layer Boundary

> Part of **[3-Layer UI — Resource UI Module Developer Guide](UI_MODULE_DEVELOPER_GUIDE.md)**. Choosing a tier, two-step resolution, Vue override vs JS modifier, and correct business-logic placement.

---

## 3. The 10-Tier Lookup

Identical in shape for all three resolvers (Section, Content, Action). **First match wins,
most specific first.** `{P}` is the lowercased placeholder name.

| # | Tier | Path under `_ui/{ui}/components/` | Type |
|---|---|---|---|
| 1 | resource + page | `{scope}/{resource}/{page}/{P}.vue` | Vue override |
| 2 | resource + page | `{scope}/{resource}/{page}/{P}.js` | JS modifier |
| 3 | resource | `{scope}/{resource}/{P}.vue` | Vue override |
| 4 | resource | `{scope}/{resource}/{P}.js` | JS modifier |
| 5 | page | `{scope}/{page}/{P}.vue` | Vue override |
| 6 | page | `{scope}/{page}/{P}.js` | JS modifier |
| 7 | scope-wide | `{scope}/{P}.vue` | Vue override |
| 8 | scope-wide | `{scope}/{P}.js` | JS modifier |
| 9 | ui-wide | `{P}.vue` | Vue override |
| 10 | ui-wide | `{P}.js` | JS modifier |

**A `.vue` and a `.js` at the same tier are mutually exclusive** — the `.vue` wins and the
`.js` is never read.

### 3.1 Choosing a tier — share by placement, not by copying

The tier a file sits at *is* the statement of who it serves. Put a placeholder at the
**most general tier every page that needs it can reach**, and both pages resolve the same
file with no imports, no copies and no renames:

| The card is needed by… | Tier | Path |
|---|---|---|
| one page only | 1/2 | `{resource}/{page}/{P}.vue` |
| two or more pages of one resource | 3/4 | `{resource}/{P}.vue` |
| every resource in a scope | 7/8 | `{scope}/{P}.vue` |

This is the mechanism behind the shared-form rule (§13.4) and behind reusing one decision
across two action routes: an approval page and a later reallocation page collect the *same*
decision, so their cards live at tier 3 and both contracts simply name them. Anything
genuinely page-only goes in the page folder, which outranks the resource tier.

Two independently authored components for one decision drift the moment one gets a control
the other doesn't. Sharing by placement makes drift structurally impossible instead of
relying on discipline to prevent it.

**The cards share; the sticky bar does not.** Two routes collecting one decision resolve
one set of content cards and keep **two separate `PageAction.js` files**, because what
actually differs between them is precisely what the bar owns: the verb on the primary
button, the permission set, and the payload builder. A single bar branching on which route
mounted it re-introduces, in one file, the divergence the shared cards just eliminated —
and the branch has to be re-read on every recompute to stay correct. Duplicating a getter
and a `permitted()` is the cheaper half.

### 3.2 Two-step resolution

**Step 1 — find the BASE component:**

1. `_ui/{ui}/components/{sections|contents|actions}/{P}.vue` — UI-wide generic base.
2. `src/components/{sections|contents|actions}/{P}.vue` — framework default base.
3. Otherwise, **the first `.vue` candidate from the 10-tier list is promoted to base.**
4. Otherwise, the caller-supplied `defaultComponent`.
5. Otherwise, the placeholder renders its "… Not Defined" warning card.

> [!IMPORTANT]
> **Step 1.3 is how you invent a brand-new placeholder with no framework base at all.**
> Drop `_ui/{Ui}/components/{Scope}/{Resource}/{Name}.vue`, list `'{Name}'` in the page's
> `sections`/`contents`, and it renders. No registration anywhere.

**Step 2 — scan the 10 tiers** for an override or modifier of that base.

### 3.3 Vue override vs JS modifier

| | Vue override (`.vue`) | JS modifier (`.js`) |
|---|---|---|
| Effect | **Replaces** the base component's template entirely | **Keeps** the base component, changes the props fed to it |
| Receives | `finalProps` unmodified, readable via `$attrs` | `(currentProps, ctx)` and returns a props object |
| Use when | The layout itself is wrong | Only labels / colours / data / visibility are wrong |
| Precedence | Wins over a `.js` at the same tier | Final layer of the props merge (§5) |

A JS modifier exports **either** a plain object **or** a function:

```javascript
// ctx = { pageState, resourceRecord, resourceConfig } — the RAW injected objects.
export default (currentProps, { pageState, resourceRecord, resourceConfig }) => ({
  // A FUNCTION-valued prop is re-evaluated per render by the receiving component
  // through evaluateProp — which is how a modifier stays reactive.
  title: (record) => `Record: ${record?.Name || 'Unnamed'}`,
  chipColor: 'accent'
})
```

> [!IMPORTANT]
> **A modifier function is evaluated ONCE per resolve, not per render.** If a value must
> track the record, return it as a **function-valued prop** — never compute it eagerly
> inside the modifier. This applies to *every* read, including permission reads: an
> `allowed()` call taken at resolve time, before the auth payload lands, latches `false`
> for the life of the page.
>
> ```javascript
> // ✗ Frozen at whatever Progress was on the first resolve
> export default (props, { resourceRecord }) => ({
>   show: resourceRecord?.record?.value?.Progress === 'PLANNED'
> })
>
> // ✓ Re-evaluated per render through evaluateProp
> export default { show: (record) => record?.Progress === 'PLANNED' }
> ```

### 3.4 `evaluateProp` — the closure contract

Customizable props are typed `[Type, Function]`, and the receiving component resolves them
through `evaluateProp(value, resourceRecord, resourceConfig)`, which calls the closure with
**plain unwrapped objects**:

```javascript
title: (record, config) => `${config?.name}: ${record?.Code}`   // ✓
title: (record) => record.value.Code                            // ✗ never call .value
```

> [!NOTE]
> **Per-item list resolvers are NOT `evaluateProp` props.** `label`, `caption`, `chip`,
> `chipColor`, `highlightColor`, `btn` on `List`/`AppList` are `(item) => value` resolvers,
> called once per row. Do not route them through `evaluateProp`.

### 3.5 When a repeated item becomes its own component

**A `v-for` body longer than a few lines becomes its own component.** Two things follow
from the split, and both are the reason for it:

- the parent stays a thin list — the loop, the empty state, and nothing else;
- the item card becomes **independently overridable at any of the 10 tiers**, so a tenant
  can restyle one card without replacing the list that holds it.

The item component is presentational: figures arrive already computed on its one `group` /
`item` prop, every control emits upward, and it performs no arithmetic of its own. That is
what guarantees the number it renders is the number the payload carries.

Whether it is a placeholder or a private sub-component (§2.3) depends only on whether any
page names it.

---

## 4. Correct Business Logic Placement — The 3-Layer UI Boundary

> Full detail — folder structure, every rule, and worked examples — lives in
> [UI_RESOURCE_DOMAIN_LOGIC.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_RESOURCE_DOMAIN_LOGIC.md).
> This section is the summary a module generator needs inline; read the linked doc before
> writing any `src/_resource/` file.

### 4.1 The boundary

```
src/components/, src/composables/, src/pages/        Layer 1 — Core System Infrastructure
src/_resource/{Scope}/{Resource}/                     Layer 2 — Resource Domain & Business Logic
src/components/{sections,contents,actions}/           Layer 3 — UI Presentation
src/_ui/{Ui}/**  (one folder per UI name)
```

Business logic is UI-agnostic and lives outside the UI tree entirely — in `src/_resource/`,
never inside a `_ui/{Ui}/` presentation folder — so every UI, whichever `CustomUIName` it
carries, consumes the exact same workflow logic. Import direction is strictly one-way,
Layer 3 → Layer 2 → Layer 1, with no per-UI override of domain logic (business differences
are data/config, never a second code path).

### 4.2 What belongs in `src/_resource/`

Progress/workflow vocabularies, state-transition predicates, stateful workflow aggregates
that back a wizard/action page, and payload/request builders — everything that answers
"what can this record do right now, and why." Full list:
[UI_RESOURCE_DOMAIN_LOGIC.md §3](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_RESOURCE_DOMAIN_LOGIC.md).

### 4.3 What stays in `_ui/{Ui}/composables/`

Presentation-only helpers that assemble display from a Layer-2 predicate but are not
themselves a business rule — row presets, per-view formatting, and the injection-relay
composable (§6.2). Full list:
[UI_RESOURCE_DOMAIN_LOGIC.md §4](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_RESOURCE_DOMAIN_LOGIC.md).

### 4.4 Shape

Named pure exports + a `use{Feature}()` wrapper — same shape either layer uses. Every
Layer 2 export takes `record`/`records` **only** — never a `config` parameter. Each
`src/_resource/{Scope}/{Resource}/` composable hardcodes its own resource name and calls
`useResourceConfig('{ThatName}')` internally whenever it needs headers, permissions, or
`allowed()` — never route-derived, never passed in by the caller. Multi-resource logic is
composed by importing multiple named domain modules from the UI side, not by parameterizing
one function over different configs. See
[UI_RESOURCE_DOMAIN_LOGIC.md §3.2 and §5](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_RESOURCE_DOMAIN_LOGIC.md)
for the full rule and worked example.

### 4.4b The domain composition cascade

Every resource — including child relations and configuration entities
(`OutletOperatingRules`, `OutletStorages`) — gets its own Layer 2 module, and downstream
resources consume upstream ones **in series** rather than reaching past them to the store.
Three rules govern the chain, and the module you are generating must satisfy all three:

1. **No bypass links, no hardcoded defaults.** A resource default comes from
   `useResourceConfig(RESOURCE_NAME).defaultValues`, never a literal in a consumer.
2. **Non-destructive entity travel.** An enricher spreads the source row first and adds
   derived keys beside it; Layer 3 picks what to render.
3. **Pre-indexed lookups.** The owning resource publishes single, composite and rollup
   `Map` indexes built in one pass; consumers read them in `O(1)`.

Full rule, index schemas and self-check:
[UI_RESOURCE_DOMAIN_LOGIC.md §10](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_RESOURCE_DOMAIN_LOGIC.md).

**Discovering a gap mid-build.** If, while building a page, you find that a domain helper,
aggregation or cross-resource projection is missing from Layer 2, do NOT write it in the
page or its UI composable. Name the gap, say which resource module owns it, ask the user to
confirm, then implement it in that Layer 2 module to the full invariant set and consume it
from the page. Protocol:
[UI_RESOURCE_DOMAIN_LOGIC.md §10.6](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_RESOURCE_DOMAIN_LOGIC.md).

### 4.5 One workflow vocabulary per resource

A resource's states, their order, and their **label, colour and icon** are declared once, in
its domain layer, and every consumer reads them from there — the funnel's legend, a list
row's chip, a View card's badge, an action's gate.

```javascript
export const WORKFLOW_STATES  = [DRAFT, PENDING_APPROVAL, /* … */]
export const IN_FLIGHT_STATES = [/* terminal states deliberately absent */]
export function progressLabel (state) { /* … */ }
export function progressColor (state) { /* … */ }
export function progressIcon  (state) { /* … */ }
```

A component picking its own colour for a state is how a funnel segment and the row beneath
it end up disagreeing about what "Partially Delivered" looks like. The same rule covers
per-item states (allocated / partial / none / cancelled): one icon+colour+label function,
with the **settled case tested first** — a cancelled line reported as merely "not
allocated" hides that the shortfall was already written off.

Three ways this rule gets broken, all of which look reasonable while being written:

- **A per-page copy.** A View page whose cards render *both* the record's states and its
  line items' states needs a map covering both — so it declares its own, and a comment
  saying it must be "kept in step" with the original. Two maps that must be kept in step
  are one map that isn't. **Extend the single vocabulary file with the item-row states**
  and have both pages read it; the parent and child vocabularies sharing a value (both have
  a `DELIVERED`) is the reason they must not be shown differently on one screen.
- **A widget's `items` payload.** The rule governs the colour a widget *emits*, not only
  the chips and badges a template renders. A count card standing for exactly one state
  reads `progressColor(state)`; only a card standing for a **set** of states — a combined
  fulfilment queue — names its own colour, and says in a comment which set it covers.
- **A threshold table.** Ageing bands, urgency cut-offs and any other numeric scale that a
  widget *and* a row chip both read are one exported table in the vocabulary file, not an
  array literal in each. See §9.2.

---


---

⬑ Back to **[3-Layer UI — Resource UI Module Developer Guide](UI_MODULE_DEVELOPER_GUIDE.md)**.

---

⬑ Back to **[3-Layer UI — Resource UI Module Developer Guide](UI_MODULE_DEVELOPER_GUIDE.md)**.
