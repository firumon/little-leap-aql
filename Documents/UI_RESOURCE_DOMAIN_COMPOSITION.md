# Resource Domain — The Composition Cascade

> Part of **[3-Layer UI — Resource Domain Logic System](UI_RESOURCE_DOMAIN_LOGIC.md)**. How resource domain composables compose into a cascade.

---

## 10. The Resource Domain Composition Cascade

Sections 2–9 govern one resource's domain module. This section governs how two of them meet.

### 10.1 The linear cascade (X -> Y -> Z)

> [!IMPORTANT]
> **Every resource gets its own Layer 2 module — including child relations, ledgers and
> configuration entities.** `OutletOperatingRules` and `OutletStorages` are resources, not
> columns of `Outlets`. A resource whose only job is to configure another one still owns
> its own `src/_resource/{Scope}/{Resource}/composables/` module, because that is where its
> defaults, its index and its vocabulary belong.

**Ledgers are resources, not side effects.** `StockMovements` and `OutletMovements` own
their sign rule, their `ReferenceType` vocabulary and their default storage. Five modules
used to restate them — three separate definitions of the string `'OutletRestock'` alone.
Every writer now calls `stockMovementRow` / `outletMovementRow`, so a row that would
credit a warehouse for a deduction cannot be written by getting a sign wrong at a call
site. The direction is a NAME (`OUT_OF_WAREHOUSE`, `ONTO_THE_SHELF`), never a bare `-1`.

**A child relation earns its own module when something OUTSIDE its parent needs it.**
`OutletConsumptionInvoiceItems` does: its row projection was defined in
`OutletConsumptions`, which does not own it. `PurchaseOrderItems` does not — its rows are
built only inside its parent's own `compositeSave`, and a module there would be an empty
folder adding an import hop.

> [!WARNING]
> **Do not split a child's PROGRESS vocabulary out of its parent.** `OutletRestockItems`
> extends `OutletRestocks`' `PROGRESS_META` rather than restating it, because a View card
> renders both on one screen and `DELIVERED` must look identical in each. Moving the item
> states to their own module either breaks that fusion or forces a circular import — the
> exact two-files-kept-in-sync problem §3.3 forbids. `OutletDeliveries` already reads them
> through the parent, which is correct delegation.

Downstream resources consume upstream domain modules **in series**, never by reaching past
one to the raw store:

```
OutletOperatingRules ─┐
                      ├─▶ Outlets ─▶ OutletVisits / OutletConsumptions / OutletRestocks
PriceLists ───────────┘             / OutletConsumptionInvoices ─▶ every _ui/ page
OutletStorages ─────────────────────▶ restock, consumption and delivery wizards
```

A **bypass link** is any of these, and all three are violations:

- A composable reading a parent's raw rows out of the data store when the parent's domain
  module already answers the question (`useVisitCadence` scanning `OutletOperatingRules`
  rows itself, instead of asking the rules domain).
- A hardcoded fallback constant standing in for a configured default (`|| 30`, `|| 14`).
- A UI composable re-deriving a value the cascade already computed, because the enriched
  entity did not carry it.

The tell is always the same as §3.3's: two files that must be kept in step by a promise
rather than by an import.

### 10.2 Defaults come from `DefaultValues`, never from a literal

> [!IMPORTANT]
> A resource default is CONFIGURATION. It is read through
> `useResourceConfig(RESOURCE_NAME).defaultValues` — i.e. from
> `APP.Resources.DefaultValues[RESOURCE_NAME]` — and never written as a number in a
> frontend file. Retuning a cadence, a due window or a credit ceiling is a sheet change.

The resource that OWNS the field owns the default. `OutletOperatingRules` resolves
`VisitFrequencyDays` and `InvoiceDueDays`; `Outlets` and `OutletConsumptionInvoices` read
the resolved value from it and state no fallback of their own.

An unconfigured term resolves to `0` / `''`, meaning **"unknown"** — every consumer
declines to act on it (does not band, does not schedule, does not price) rather than
inventing a value. A resolved default never lies about provenance either: `hasRules`
reports whether a ROW exists, so an outlet running on the configured default is still shown
as unconfigured while displaying the effective number.

```javascript
// ✗ a literal fallback compiled into a consumer
visitFrequencyDays: Number(rule?.VisitFrequencyDays) || 30

// ✓ the owning resource resolves it from its own configured DefaultValues
const { defaultValues } = useResourceConfig('OutletOperatingRules')
```

### 10.3 Non-destructive entity travel

> [!IMPORTANT]
> An enricher **decorates**, it never narrows. Spread the source row FIRST, then add derived
> keys beside it. A Layer 2 composable must never return a cherry-picked subset of an entity
> it was handed — Layer 3 decides what to render; Layer 2 decides what is true.

```javascript
// ✗ destructive — every column not listed here is lost to every downstream consumer
return { code: row.Code, name: row.Name }

// ✓ non-destructive — the raw row survives, derived keys ride alongside it
return { ...row, code: row.Code, name: row.Name || '', effectiveTerm, _raw: row }
```

Narrowing does not save memory (the source rows are already in the store, and the
projection holds a reference to them either way). What it does is force the next consumer
that needs an omitted attribute to re-derive it from the store — a parallel, slightly
different copy of the same entity, which is the split-brain UI this rule exists to prevent.

Corollaries:

- An enriched entity carries its joined relations as enriched objects
  (`outlet.operatingRule`, `outlet.priceList`), not just the two or three fields the first
  consumer happened to need.
- Reactivity travels with the object. An enricher returns a plain projection of reactive
  sources inside a `computed()`; it must not snapshot values into a `ref` that then stops
  tracking.
- `_raw` / `_rule` back-references stay on the entity, so a consumer can always reach the
  untouched source row.

### 10.4 Pre-indexing standards — O(1) at 100k rows

> [!IMPORTANT]
> No `.find()` or `.filter()` over a record set **inside a loop, a render pass, or a
> per-row getter**. Build the index once, outside the loop, in the domain module that owns
> the data; every lookup after that is a `Map` read.

A nested scan is O(N x M) and — worse in a reactive app — reruns on every invalidation. At
140 outlets x 3,500 storage rows x a full SKU catalogue, a per-keystroke recompute of a
wizard's quantity column is measured in scans of the whole sheet.

The owning resource publishes the indexes; consumers read them:

| Index | Shape | Answers |
|---|---|---|
| Single key | `Map<Code, entity>` | "the record for this code" |
| Grouping | `Map<ParentCode, row[]>` | "this parent's rows" |
| Composite / multi-dimensional | `Map<OutletCode, Map<SkuCode, qty>>` | "this outlet's stock of this SKU" |
| Reverse composite | `Map<SkuCode, Map<OutletCode, qty>>` | "who holds this SKU" |
| Rollup | `Map<Code, total>` | "this outlet's total units" |

Rules:

- **One pass builds every index.** `indexOutletStock(rows)` returns all five lookups from a
  single `forEach`, not five passes.
- **Sum into an index, never assign.** A SKU can occupy several named storages at one
  outlet; assignment lets the last row silently win.
- **The index belongs to the resource that owns the rows.** `OutletStorages` publishes the
  stock index; `Outlets`, the restock wizard and the consumption wizard consume it. Two
  modules indexing the same sheet is the same drift §3.3 forbids, paid for twice.
- **Offer the shape the call site needs.** A `Map` for lookups, a plain
  `{ [key]: value }` object where render loops already use bracket access — both projected
  from the ONE index, never rebuilt.
- **Pure builder + shared reactive wrapper.** The builder takes plain rows so a
  `PageAction.js` outside setup can index a payload; `defineSharedComposable` memoizes the
  reactive index so the pass runs once per app per data change (CORE_ARCHITECTURE_RULES §6).

### 10.6 Proactive domain elevation & future feature discovery

Most missing domain logic is not discovered while building the domain layer. It is
discovered in Layer 3, mid-page, when a card needs a number nobody has computed yet — an
SKU details page wanting outlet-wise stock distribution, a product page wanting "which
warehouses hold this", a dashboard wanting a rollup no aggregate publishes.

> [!IMPORTANT]
> **A missing Layer 2 capability is never solved by writing the math in Layer 3.** Not
> "temporarily", not "just this once for this card", not inside a `computed()` in a UI
> composable. The moment a page needs a domain helper, aggregation, or cross-resource
> projection that Layer 2 does not have, that helper is a Layer 2 gap — and it gets filled
> in Layer 2.

**The protocol, in order:**

1. **Detect.** Classify the piece of logic as §8.1 requires. If the answer is "what is true
   about this record / these records" rather than "how is it arranged on screen", it is
   domain — even when only one card will ever read it today.
2. **Locate the owner.** The capability belongs to the resource that OWNS the rows it reads,
   not to the resource whose page discovered the need. "Which outlets hold this SKU" is an
   `OutletStorages` question asked by an SKU page; it lives in `OutletStorages`.
3. **Notify and confirm.** Tell the user what is missing, which resource module it belongs
   to, and what shape it will take. **Wait for confirmation before implementing it.** A new
   Layer 2 export is a shared contract every future UI inherits — it is not a private detail
   of the page that prompted it, and it is not the page author's call alone.
4. **Implement in Layer 2, to the full invariant set.** Pure builders taking plain rows, a
   `defineSharedComposable` reactive wrapper, O(1) pre-indexed lookups (§10.4),
   non-destructive enrichment (§10.3), configured defaults (§10.2), one vocabulary (§3.3).
   A helper elevated in a hurry that skips the indexing rule is a second bottleneck wearing
   the right folder name.
5. **Consume it from Layer 3.** The page that discovered the gap now reads the shared
   capability, exactly as every later page will.

**Worked example — the SKU details page's outlet stock distribution.** The page wants, for
one SKU: which outlets hold it, how much each holds, and the estate total. Written in the
page, that is a `.filter()` over `OutletStorages` per outlet row — the exact
`O(N x M)` scan §10.4 forbids, and a second implementation of a sum `OutletStorages`
already owns. Elevated, it is `stockBySkuAndOutlet` and `totalStockBySku` on
`useOutletStorageResource` — already built by the same single pass that serves the restock
wizard, read here as one `Map` lookup, and available to the next page that asks without
anybody writing anything.

**What this is NOT.** It is not permission to move presentation into Layer 2. A sort order
for one list view, a label format, a card's column choice — those stay in `_ui/` (§4). The
test is unchanged: if a second UI would need the same answer to be correct, it is domain;
if a second UI would reasonably want a different answer, it is presentation.

### 10.5 Cascade self-check

- [ ] Every resource touched — including child relations and config entities — has its own
      `src/_resource/{Scope}/{Resource}/composables/` module.
- [ ] No numeric or string fallback constant stands in for a `DefaultValues` entry.
- [ ] No composable reads a parent resource's raw rows when that parent's domain module
      answers the question.
- [ ] Every enricher spreads its source row before adding derived keys, and returns
      `_raw`.
- [ ] No `.find()` / `.filter()` over a record set runs inside a loop or a per-row getter.
- [ ] Every index is built in one pass, by the resource that owns the rows.
- [ ] No domain helper discovered during Layer 3 work was inlined there — it was raised
      with the user and implemented in the owning resource's Layer 2 module (§10.6).

---


---

⬑ Back to **[3-Layer UI — Resource Domain Logic System](UI_RESOURCE_DOMAIN_LOGIC.md)**.
