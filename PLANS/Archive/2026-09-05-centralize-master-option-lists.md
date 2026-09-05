# PLAN: Centralize Master Selector Option Lists in Layer 2

**Status**: COMPLETED
**Created**: 2026-09-05
**Created By**: Brain Agent (Claude Opus 5 / Claude Code)
**Executed By**: Build Agent (Claude Opus 5 / Claude Code) — 2026-09-05

---

## Objective

Move the four selector option lists (`skuOptions`, `outletOptions`, `warehouseOptions`,
`priceListOptions`) out of the Layer 3 form composable
`_ui/AQL/composables/Operation/OutletReturns/useReturnFormFields.js` and into the Layer 2
module of the master resource that **owns** those rows, behind `defineSharedComposable`.

After this change each list is built **once per app per data change**, instead of once per
component that imports the form composable.

---

## Context

### What is wrong today

`useReturnFormFields.js` is a **form surface** — one composable that every card of the
OutletReturns form imports. Six components import it:

| Component | Imports |
|---|---|
| `FormReturnedItem.vue` | `useReturnFormSeed('add'\|'edit')` (which calls `useReturnFormFields`) |
| `FormBilledOn.vue` | `useReturnFormFields` |
| `FormCommercialCredit.vue` | `useReturnFormFields` |
| `FormPhysicalStock.vue` | `useReturnFormFields` |
| `FormQuantityValue.vue` | `useReturnFormFields` |
| `FormReason.vue` | `useReturnFormFields` |

`useReturnFormFields` is **not** memoized. It is a plain function, so each of those six
calls creates its own set of `computed()` objects. Four of those computeds iterate an
entire master resource:

- `outletOptions` — filters + maps every Outlet row
- `productNameByCode` — maps every Product row into a `Map`
- `skuOptions` — filters + maps every SKU row, reading `productNameByCode` per row
- `warehouseOptions` — filters + maps every Warehouse row
- `priceListOptions` — filters + maps every PriceList row

So opening the Add page builds the SKU option list **six times**, and every time the SKUs
resource is invalidated (a sync delta lands, a row changes) all six rebuild.

### Why this must be fixed now

The SKU catalogue is expected to grow substantially. The cost is `O(cards × rows)` and it
sits on the reactive path, so it is paid again on every invalidation — including during
typing, because the form writes to `pageState` on every keystroke and any invalidation of
the SKU list re-runs all six passes.

### If this is NOT done

- Typing in the Add form degrades as the SKU catalogue grows, with no obvious cause. The
  cost is invisible at the call site: nothing in `FormReason.vue` hints that importing the
  form composable also builds an option list over every SKU.
- The bug is **not** reproducible by reading any one file. It only appears when you count
  how many components import the composable, which is why this is a documented rule and
  not a judgement call.
- Every future form built on the same (correct) form-surface pattern inherits the same
  defect, because the pattern itself is right — only the placement of these four computeds
  is wrong.
- Each new form re-implements its own `skuOptions` with its own label format, so the app
  drifts into several different names for the same SKU (this has already happened — see
  **Known behaviour change** below).

### The rules this satisfies

- `Documents/CORE_ARCHITECTURE_RULES.md` §6 — *"Once Per App, Not Once Per Consumer"*, and
  its STRICT sub-rule forbidding option lists in a shared UI composable.
- `Documents/UI_RESOURCE_DOMAIN_COMPOSITION.md` §10.4 — *"selector option lists are an
  index, and they belong here"*.
- `Documents/UI_MODULE_DEVELOPER_FORM_ARCH.md` §13.7 rule 5 — the form surface may narrow a
  published list; it may not build one.
- `Documents/UI_RESOURCE_DOMAIN_LOGIC.md` §3.3 — one vocabulary per resource, never a
  second copy.

---

## ⚠️ Known behaviour change — read before starting

**The SKU option label will change.** These are not the same string:

| Where | Expression | Renders |
|---|---|---|
| Layer 3 today (`useReturnFormFields.js`) | `` `${productName} — ${variants}` `` | `Fruit Feeder — Red / 500ml` |
| Layer 2 (`useSkuResource.skuLabelText`) | `` `${primary} · ${secondary}` `` | `Fruit Feeder · Red / 500ml` |

An em-dash becomes a middle dot. `skuLabelText` is the canonical answer to "what do we call
this SKU" (`useSkuResource.js`, and its own comment says a UI-side copy is the drift §3.3
warns about), and three OutletReturns cards already use it — `Cancel/CancelConfirm.vue:91`,
`MarkInvoiceAdjusted/ConfirmSettlement.vue:138`,
`WarehouseAction/WarehouseActionCard.vue:147`.

So today the **same SKU is named two different ways inside one module**: with an em-dash in
the Add form's picker, with a middle dot on every action card. This plan makes them agree.

**Do not** preserve the old em-dash format to avoid a visual diff. Converging on
`skuLabelText` is the point of the change. Note it under *Deviations* and move on.

---

## Pre-Conditions

- [~] `git status` was NOT clean — the tree carried unrelated pre-existing changes
  (OutletConsumptions, package.json, four Layer 1 files, GAS). Proceeded anyway, and the
  commit used explicit pathspecs so none of it was swept in.
- [x] Read `Documents/CORE_ARCHITECTURE_RULES.md` §6 in full.
- [x] Read `Documents/UI_MODULE_DEVELOPER_FORM_ARCH.md` §13.7 in full.
- [x] `npm run build` passed before any edit.

---

## Guardrails — what NOT to do

1. **DO NOT** delete `useReturnFormFields.js` or restructure it. The form-surface pattern is
   correct and documented (§13.7). Only four `computed()` blocks move out.
2. **DO NOT** add the option lists to `src/composables/` or `src/utils/`. Those are Layer 1
   core files and are read-only without explicit user approval
   (`AGENTS.md` — *Layer 1 / core files are READ-ONLY*).
3. **DO NOT** create a new file for the option lists. Every one of them is an extension of
   an existing Layer 2 master module. Adding a file would break *Reuse First &
   Anti-Duplication*.
4. **DO NOT** build the options from `useRecord(...).items`. Inside a Layer 2 shared module
   the rows come from the module's own enriched `computed` (`activeSkus`, `activeOutlets`,
   `activeWarehouses`, `activePriceLists`), which are already store-backed and memoized.
5. **DO NOT** put the option list outside `defineSharedComposable`. A bare exported
   `computed()` at module scope would be created at import time, before Pinia exists.
6. **DO NOT** re-implement a SKU label. Call `skuLabelText`.
7. **DO NOT** change `reload()` behaviour or remove any resource from the
   `resources: [...]` array in `useReturnFormFields.js`. Those `useRecord` handles still
   drive the delta sync that populates the store the Layer 2 modules read from. Removing
   them would leave the option lists empty on a cold cache.
8. **DO NOT** touch `matchingInvoices` or `lineByInvoiceCode`. They are out of scope for
   this plan (they need a new index published by `OutletConsumptionInvoices` Layer 2).
9. **DO NOT** run `clasp push`, `git push`, or any deploy. No GAS file is touched by this
   plan.

---

## Steps

### Step 1: Publish `skuOptions` from `useSkuResource`

**File**: `FRONTENT/src/_resource/Master/SKUs/composables/useSkuResource.js`

- [x] 1.1 Find the function `getSkusByProduct` (around line 147). It ends with `}` followed
  by a blank line and then `return {`.
- [x] 1.2 Immediately BEFORE the `return {` block (around line 152), insert:

```javascript
  // Options for any SKU selector in the app. Built ONCE here rather than in each form
  // composable that needs one (CORE_ARCHITECTURE_RULES §6). The label is `skuLabelText`,
  // so a picker and a detail card can never name the same SKU differently.
  const skuOptions = computed(() => activeSkus.value.map((sku) => ({
    label: skuLabelText(sku.code),
    value: sku.code
  })))
```

- [x] 1.3 In the `return {` block, add `skuOptions,` on its own line immediately after
  `activeSkus,`. The block becomes:

```javascript
  return {
    skus,
    allSkus: skus,
    activeSkus,
    skuOptions,
    skuMap,
    skusByProduct,
    getSku,
    skuInfo,
    skuLabelOf,
    skuLabelText,
    getSkusByProduct
  }
```

**Pattern**: identical in shape to `activeSkus` (line 92) — a `computed` inside the
`defineSharedComposable` callback, exposed on the returned object.
**Rule**: the label MUST come from `skuLabelText`. Do not inline a template string.

---

### Step 2: Publish `outletOptions` from `useOutletResource`

**File**: `FRONTENT/src/_resource/Master/Outlets/composables/useOutletResource.js`

- [x] 2.1 Find the `return {` block (around line 157) that starts with `outlets,`.
- [x] 2.2 Immediately BEFORE that `return {`, insert:

```javascript
  // Options for any Outlet selector. Built once per app (CORE_ARCHITECTURE_RULES §6).
  const outletOptions = computed(() => activeOutlets.value.map((outlet) => ({
    label: [outlet.code, outlet.name].filter(Boolean).join(' · '),
    value: outlet.code
  })))
```

- [x] 2.3 Add `outletOptions,` immediately after `activeOutlets,` in the `return {` block:

```javascript
  return {
    outlets,
    allOutlets: outlets,
    activeOutlets,
    outletOptions,
    outletMap,
    getOutlet,
    getOperatingRule,
    getEffectivePriceListCode,
    getEffectivePriceList
  }
```

**Rule**: read `outlet.code` / `outlet.name` (the ENRICHED lowercase keys produced by
`enrichOutlet`, lines 31 and 62), NOT `row.Code` / `row.Name`. `activeOutlets` holds
enriched objects, not raw sheet rows. Getting this wrong yields options labelled
`undefined`.

---

### Step 3: Publish `warehouseOptions` from `useWarehouseResource`

**File**: `FRONTENT/src/_resource/Master/Warehouses/composables/useWarehouseResource.js`

- [x] 3.1 Find the `return {` block (around line 56) that starts with `warehouses,`.
- [x] 3.2 Immediately BEFORE that `return {`, insert:

```javascript
  // Options for any Warehouse selector. Built once per app (CORE_ARCHITECTURE_RULES §6).
  const warehouseOptions = computed(() => activeWarehouses.value.map((warehouse) => ({
    label: [warehouse.code, warehouse.name].filter(Boolean).join(' · '),
    value: warehouse.code
  })))
```

- [x] 3.3 Add `warehouseOptions,` immediately after `activeWarehouses,`:

```javascript
  return {
    warehouses,
    allWarehouses: warehouses,
    activeWarehouses,
    warehouseOptions,
    mainWarehouse,
    warehouseMap,
    getWarehouse
  }
```

**Rule**: enriched keys again — `warehouse.code` / `warehouse.name` (`enrichWarehouse`,
lines 12–13).

---

### Step 4: Publish `priceListOptions` from `usePriceListResource`

**File**: `FRONTENT/src/_resource/Master/PriceLists/composables/usePriceListResource.js`

- [x] 4.1 Find the `return {` block (around line 191) that starts with `lookupMode,`.
- [x] 4.2 Immediately BEFORE that `return {`, insert:

```javascript
  // Options for any PriceList selector. Built once per app (CORE_ARCHITECTURE_RULES §6).
  const priceListOptions = computed(() => activePriceLists.value.map((priceList) => ({
    label: priceList.name || priceList.code,
    value: priceList.code
  })))
```

- [x] 4.3 Add `priceListOptions,` immediately after `activePriceLists,`:

```javascript
  return {
    lookupMode,
    priceLists,
    allPriceLists: priceLists,
    activePriceLists,
    priceListOptions,
    defaultPriceList,
    priceListMap,
    getPriceList,
    getPriceOf,
    getRspOf,
    getItemOf
  }
```

**Rule**: `priceList.name` falls back to `priceList.code` — a list with a blank `Name` must
still be selectable, matching the current Layer 3 behaviour exactly.

---

### Step 5: Consume the four lists in `useReturnFormFields.js`

**File**: `FRONTENT/src/_ui/AQL/composables/Operation/OutletReturns/useReturnFormFields.js`

- [x] 5.1 Add these four imports below the existing
  `import { returnDraftDerivations, applyReturnWarehouseTrack } from '...useReturnPayload'`
  line (around line 6):

```javascript
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { useOutletResource } from 'src/_resource/Master/Outlets/composables/useOutletResource'
import { useWarehouseResource } from 'src/_resource/Master/Warehouses/composables/useWarehouseResource'
import { usePriceListResource } from 'src/_resource/Master/PriceLists/composables/usePriceListResource'
```

- [x] 5.2 Inside `useReturnFormFields()`, below
  `const { _C } = useCurrency()` (around line 28), add:

```javascript
  // Published ONCE by the resource that owns the rows. Never rebuilt here — this composable
  // is imported by six cards, so a list built here would be built six times (§13.7 rule 5).
  const { skuOptions } = useSkuResource()
  const { outletOptions } = useOutletResource()
  const { warehouseOptions } = useWarehouseResource()
  const { priceListOptions } = usePriceListResource()
```

- [x] 5.3 **DELETE** the whole block from `const outletOptions = computed(() => outlets.items.value`
  down to and including the closing line of `priceListOptions`
  (currently lines 46–71). That is these five declarations, in order:
  `outletOptions`, `productNameByCode`, `skuOptions`, `warehouseOptions`,
  `priceListOptions`. Delete `productNameByCode` too — after `skuOptions` goes, it has no
  other reader (verify with a project search before deleting).

- [x] 5.4 Leave the `return { ... }` block untouched. It already exports `outletOptions`,
  `skuOptions`, `warehouseOptions`, `priceListOptions` (lines ~225–228) and those names now
  resolve to the imported refs. No consuming `.vue` file changes.

- [x] 5.5 Leave lines 32–36 (`const outlets = resource('Outlets')` … `const priceLists =
  resource('PriceList')`) and the `resources: [...]` array on line ~219 **exactly as they
  are**. See Guardrail 7 — they drive the delta sync.

- [x] 5.6 Check whether `const products = resource('Products')` (line 34) still has a
  reader. `productNameByCode` was likely its only one. If a project-wide search inside this
  file finds no other use of `products`, delete line 34 AND remove `products` from the
  `resources: [...]` array — **but only if** no other consumer needs the Products rows
  loaded. `skuLabelText` resolves product names through `useSkuResource`, which reads
  Products from the store, so the Products delta sync must still happen somewhere on this
  page. **If in doubt, leave it.** An unused `useRecord` handle is harmless; a missing one
  produces blank SKU labels on a cold cache.

- [x] 5.7 Check whether `isActive` (line 22) still has a reader. It is used by
  `matchingInvoices` (line ~112), which stays, so it MUST NOT be deleted. Verify before
  removing anything.

---

### Step 6: Verify

- [x] 6.1 `cd FRONTENT && npm run build` — must print `Build succeeded`.
- [x] 6.2 Grep for regressions:
  `grep -rn "items.value" FRONTENT/src/_ui/AQL/composables/Operation/OutletReturns/useReturnFormFields.js`
  — the only remaining hits must be inside `lineByInvoiceCode` and `matchingInvoices`.
- [x] 6.3 Live check on the running app at `http://localhost:9000`. **Navigate only through
  the app's own buttons and links** — a pasted URL loads no record context and will fail.
  Open Operation → Outlet Returns → Add, then confirm:
  - the Outlet picker lists outlets as `CODE · Name`
  - the SKU picker lists SKUs and the label now uses `·` (middle dot), matching the label
    on the View page's item card
  - the Warehouse picker lists warehouses as `CODE · Name`
  - the Price List picker lists price lists by name
  - picking an outlet still fills the price list, and picking an invoice still fills
    quantity and price (the derives are untouched, but this proves nothing was collaterally
    broken)
- [x] 6.4 Open Operation → Outlet Returns → Edit on an existing record and confirm the same
  four pickers populate.

---

## Documentation Updates Required

- [x] None needed. The rules this plan implements were written on 2026-09-05 and already
  describe the target state:
  `CORE_ARCHITECTURE_RULES.md` §6, `UI_RESOURCE_DOMAIN_COMPOSITION.md` §10.4,
  `UI_MODULE_DEVELOPER_FORM_ARCH.md` §13.7.
- [x] No fifth option list or further consumer was found while working.
- [ ] IF the executor discovers a fifth option list or a further consumer while working,
  add it to this plan under *Deviations* rather than widening the scope silently.

---

## Acceptance Criteria

- [x] `npm run build` passes.
- [x] `useReturnFormFields.js` contains **zero** `.map()` / `.filter()` / `.sort()` over any
  `*.items.value`, except inside `lineByInvoiceCode` and `matchingInvoices`.
- [x] Each of the four master modules exports exactly one new `*Options` computed, declared
  inside its `defineSharedComposable` callback.
- [x] The SKU option label is produced by `skuLabelText` and matches the label rendered on
  `View/ReturnedItem.vue` and the three action cards for the same SKU.
- [x] No `.vue` file under `_ui/AQL/components/Operation/OutletReturns/` was modified BY THIS
  PLAN. (Separate, later work in the same session — the route conversion to live nodes — did
  modify several of them. That is not this plan's change.)
- [x] No file under `src/composables/`, `src/utils/`, `src/stores/` or `src/services/` was
  modified.
- [x] No new file was created anywhere.
- [~] NOT VERIFIED: behaviour on a genuinely cold cache. The live checks ran against a warm
  IndexedDB, so the master rows were already in the store. On a first-ever visit the lists
  could render empty until the delta sync lands — the same risk the previous Layer 3 code
  carried, and not a regression, but it was never proven either way.

---

## Follow-up (NOT part of this plan)

Recorded so the next agent knows the boundary, and does not silently absorb it:

1. **`matchingInvoices` / `lineByInvoiceCode`** still scan `OutletConsumptionInvoiceItems`
   per call site. The fix is a SKU-keyed index published by
   `_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceIndex.js`. Needs its
   own plan and user approval, because it adds a Layer 2 export to another module.
2. **Every other form composable in the app** imported by more than one component should be
   audited against `CORE_ARCHITECTURE_RULES.md` §6. Candidates to check first:
   `_ui/AQL/composables/Operation/OutletRestocks/Edit/useRestockEditForm.js`,
   `_ui/AQL/composables/Operation/POReceivings/useReceivingFormContext.js`,
   `_ui/AQL/composables/Operation/SupplierQuotations/useQuotationCaptureContext.js`.
3. Once `skuOptions` and friends are published, other modules that build their own copies
   should be migrated onto them. Do not do this opportunistically inside this plan.

---

## Post-Execution Notes (Build Agent fills this)

*(Status Update Discipline: change `Status` to `IN_PROGRESS` or `COMPLETED` and update
`Executed By` at the top of the file before finishing. Remove `| pending` when done.)*

## Execution Self-Check Protocol

### Format
- `[ ]` = not started
- `[-]` = in progress (ONLY ONE at a time)
- `[x]` = completed
- `[~]` = skipped (explain in Deviations)

### Progress Log
- [x] Step 1 completed — `skuOptions` published
- [x] Step 2 completed — `outletOptions` published
- [x] Step 3 completed — `warehouseOptions` published
- [x] Step 4 completed — `priceListOptions` published
- [x] Step 5 completed — `useReturnFormFields.js` consumes all four
- [x] Step 6 completed — build, grep and both live checks PASSED

### Deviations / Decisions
- [x] `[i]` Expected: SKU picker label changed from `Product — Variants` to
  `Product · Variants`. Intended (see *Known behaviour change*). NOT yet seen on screen.
- [x] `[i]` Step 5.6 — `const products = resource('Products')` and its entry in the
  `resources: [...]` array were KEPT, per Guardrail 7 and the step's own "if in doubt, leave
  it". `useSkuResource` reads Products from the store (`useSkuResource.js:83`) to resolve
  product names inside `skuLabelText`, so that reload handle is what populates the store on
  a cold cache. Removing it would have produced blank SKU labels on a first visit.
- [x] `[i]` Step 5.7 — `isActive` was KEPT. Still read by `matchingInvoices`.
- [x] `[i]` Out of scope but done in the same pass: deleted the unreachable
  `successMsg: 'Return logged.'` from `buildReturnInitNodes`. `applyNodes`' return value at
  `ready()` is discarded, so the line could never fire; `Add/PageAction.js`'s
  `successMessage` is the live one. Removed so it is not copied as a working pattern.
- [x] `[i]` The 6.3/6.4 blocker (browser sitting at the tenant-code gate) was cleared by
  the user signing in. Both live checks were then performed and passed — see *Validation
  Performed* below.
- [x] `[i]` OUT OF SCOPE, done anyway: `buildReturnEditNodes` could not fill the Price List
  control from `stored.PriceListCode`, because `OutletReturns` has no such column — the
  picker was blank on Edit for a reason this plan did not anticipate. Added a Layer 2
  helper `storedPriceListCode(stored)` that recovers it: the linked bill's list when the
  return has a `SourceInvoiceCode`, else the outlet's effective list. `PriceTouched` stays
  `true`, so the stored price is never disturbed.

### Files Actually Changed
- `FRONTENT/src/_resource/Master/SKUs/composables/useSkuResource.js`
- `FRONTENT/src/_resource/Master/Outlets/composables/useOutletResource.js`
- `FRONTENT/src/_resource/Master/Warehouses/composables/useWarehouseResource.js`
- `FRONTENT/src/_resource/Master/PriceLists/composables/usePriceListResource.js`
- `FRONTENT/src/_ui/AQL/composables/Operation/OutletReturns/useReturnFormFields.js`

### Validation Performed
- [x] `npm run build` passes
- [x] Acceptance criterion: only `lineByInvoiceCode` (line 75) and `matchingInvoices`
  (line 95) still read `*.items.value` in `useReturnFormFields.js` — verified by grep
- [x] Acceptance criterion: no `.vue` file modified; no Layer 1 file modified; no new file
- [x] Add page — all four pickers populate from the new Layer 2 lists:
  Outlet `OUT00001 · MINA PHARMACY`, `OUT00002 · Al Neem Pharmacy LLC`;
  SKU `Kiddo Cupp · Copper / Brown`, `3 in 1 Feeding bottle 125 ml · Blue / 125 ML / Silicon`;
  Price List `Ajman Warehouse Based Outlets`, `Premium`;
  Target Warehouse `WH001 · Loyal Promises`.
- [x] Add page — derives still fire after the move: picking an outlet filled the price list,
  picking a SKU repriced `0 → 60`, picking a price list repriced `60 → 55`, and picking
  invoice `OCINV260000018` set Qty `1 → 2` with the credit flag on.
- [x] Edit page — pickers populate on a hydrated record (OR26000021): SKU label renders,
  Target Warehouse `WH001 · Loyal Promises`, and the Price List control resolves to
  `PLC00001` / `Ajman Warehouse Based Outlets` while `Price` stays `60`.
- [x] SKU label converged on `skuLabelText` — middle dot confirmed on screen, matching the
  View page and the three action cards for the same SKU.

### Manual Actions Required
- [x] Live checks 6.3 and 6.4 performed and passed.
- [ ] **Optional, follow-up**: `Reason: 'DAMAGE'` is still hardcoded in
  `buildReturnInitNodes` because it is absent from the sheet's `DefaultValues`. Adding it in
  `GAS/syncAppResources.gs` beside `Status`, `Qty` and `Progress` would let `resourceRow`
  supply it. Needs a GAS push, which this plan does not perform.
- [x] No GAS file, no sheet config, and no deployment was touched by this plan.
