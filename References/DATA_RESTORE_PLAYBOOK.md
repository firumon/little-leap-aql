# Data Restore — Headless Batch Ingestion Playbook

How an agent ingests historical records into a tenant by driving the live
`pageState` from the browser console — no UI interaction, one record per batch.

**Part A** is the method, and is resource-agnostic. **Part B** holds one *Restore
Profile* per resource — the only place resource-specific facts belong. Adding a
new resource means writing a new profile, never editing Part A.

> [!WARNING]
> This writes to a real Google Sheet through the real GAS API. There is no dry-run
> mode on the server and no transaction rollback. A batch that lands cannot be
> un-landed except by writing compensating rows. Complete §3 before §6.

---

# PART A — The method

## 1. Why the console, not the UI

Driving `pageState` directly gives the real validate → build → `runBatchRequests`
→ GAS path with none of the clicking, **and** it bypasses the page's
`PageAction.js` action modifier.

That bypass is the point, not a side effect. A wizard is built to raise a *new*
record and normally caps at an early workflow state — OutletRestocks' Add wizard
cannot produce `DELIVERED`, because the UI reaches delivery through a separate
later action. A historical restore needs the terminal state directly, so the
agent sets the whole header itself and calls `pageState.run({ requests })`.

**Consequence:** every guard the wizard applies is also bypassed. Whatever the
wizard would have computed — stamps, ledger legs, derived progress — the agent is
now responsible for stating correctly. That is what Part B's profile records.

### The dev handle — ADD IT FIRST, REVERT IT LAST

> [!IMPORTANT]
> **`window.__pageState` does not exist in the repo.** It is added for a restore
> and reverted when the restore is done, so the codebase never carries a console
> back-door into page state. **Step one of every restore session is re-adding it;
> the last step is reverting it** (§10).

Add this as the final line of the `<script setup>` block in
`src/pages/Page.vue`, immediately after the existing `provide('pageState', …)`:

```js
// Dev-only console handle: lets a developer drive the live page state
// (setRecord / submit) from the browser console without the UI. Re-assigned on
// every Page mount, so it always points at the currently rendered page.
if (process.env.DEV) window.__pageState = pageState
```

Dev-only, re-assigned on every `Page.vue` mount, so it always points at the
currently rendered page. It does not exist on `/dashboard` or any non-resource
route — navigate to the resource's `_add` route first and confirm:

```js
(() => { const ps = window.__pageState
  return JSON.stringify({ url: location.href, ps: typeof ps, snap: ps?.snapshot() }) })()
```

The snapshot also shows the defaults the page's own Create component seeded, which
is the cheapest way to learn what you do *not* need to set.

> [!NOTE]
> Wrap every console snippet in an IIFE. The evaluator reuses one scope, so a
> bare `const ps = …` twice throws `Identifier 'ps' has already been declared`.
> Never `JSON.stringify` a raw ref or computed — Vue's `ComputedRefImpl` is
> circular. Read `.value` first, or go through `snapshot()`.

> [!IMPORTANT]
> The handle is `process.env.DEV`-gated, so it does **not exist in a production
> build**. Restoring into a tenant means running a dev build pointed at that
> tenant's GAS URL. Confirm this before promising a production run.

---

## 2. The Restore Profile

Every restore is the same six decisions. Part B records them per resource; if the
resource has no profile yet, derive one **with the user** before writing anything.

| # | Decision | Source of truth |
|---|---|---|
| 1 | Parent + child resource names, and the `_add` route | `GAS/Constants.gs`, `src/router/routes.js` |
| 2 | Column list for both | `GAS/setup*Sheets.gs` |
| 3 | Terminal `Progress` + which stamp triples it implies | `APP_OPTIONS_SEED.<Resource>Progress` |
| 4 | Constant fields not present in the data | **ask the user** (§3) |
| 5 | Ledger legs: resource, sign, `ReferenceType`, cursor | the resource's own `use*Payload.js` |
| 6 | Master references to validate | the column list |

Decision 5 is the one to derive from code rather than reason about. The resource's
`use*Payload.js` already encodes the sign conventions as business rules — read
them, don't reinvent them.

### Column-name discipline

Column names are **not** transferable between resources. Real examples:

| Concept | OutletRestocks | OutletConsumptions |
|---|---|---|
| child quantity | `Quantity` | `Qty` |
| actor on parent | `RequestedUser` / `ApprovedUser` | `Username` |
| child workflow state | `Progress` + stamps | *(none — child has no Progress)* |

Never carry a column name from one profile to another. Read the schema each time.

---

## 3. Pre-flight — ASK BEFORE THE LOOP RUNS

**Do not start the loop with any of these unresolved.** Supplied data is
routinely missing operational columns that have no sensible default, and guessing
writes silent corruption into a ledger. Ask in one batched round, not one
question at a time.

### 3.1 Derive the questions, don't just read the list

Read the resource's column list from `GAS/setup*Sheets.gs` and its `CodePrefix` /
`RequiredHeaders` / `DefaultValues` from `GAS/syncAppResources.gs`. Diff that
against the columns the user's data supplies.

**Every column in the schema and absent from the data is a question**, unless it
is auto-generated (`Code`, audit columns, `AccessRegion`) or explicitly defaulted.
This is what makes the playbook cover a resource it has never seen.

### 3.2 The standing questions

| # | Ask | Why it cannot be guessed |
|---|---|---|
| 1 | **Terminal `Progress`** for parent and child | Decides which stamp triples are written and whether ledgers move at all |
| 2 | **Location columns** — warehouse, storage/bin, price list | No default exists; a wrong one silently misstates a balance |
| 3 | **Actor** for every `…By` / user column | Defaults to session user — confirm that is intended, or get a named actor |
| 4 | **What `$datetime` resolves to** | See §3.3 — answered wrong by default |
| 5 | **Comment text** per stamp triple | Free text, shown verbatim on the workflow timeline |
| 6 | **Link columns** — blank or `$ref`? | A `$ref` to a record the batch never creates fails resolution server-side |
| 7 | **Do ledgers move, and which?** (§5.3) | The highest-consequence question. Never assume |
| 8 | ~~Unresolvable master values~~ | **Settled — see §4.3.** Master is the authority; skip. Report impact, do not re-ask |
| 9 | **Downstream records** the UI would have chained | e.g. a consumption normally begets an invoice. Restoring the parent alone may leave a workflow mid-air |

### 3.3 The `$datetime` trap

`stampFields()` in the app's own payload builders uses `toDateTime24(new Date())`
— **now**. For a historical restore that is almost always wrong: it stamps 2025
records with today's date and the timeline reads as if the whole history happened
this morning.

Confirm the intended rule explicitly. The verified answer on the OutletRestocks
run was *record's own date + current wall-clock time*:

```js
const pad = n => String(n).padStart(2, '0')
const stampFor = dateISO => { const n = new Date()
  return `${dateISO} ${pad(n.getHours())}:${pad(n.getMinutes())}:${pad(n.getSeconds())}` }
// '2025-03-04' → '2025-03-04 00:46:07'
```

Format **must** be `yyyy-MM-dd HH:mm:ss` — what `toDateTime24` produces, and what
GAS writes when an `executeAction` stamps a column. Two formats in one column sort
and read inconsistently forever after.

Compute the stamp **once per record** and reuse it across every triple, so the
record's timeline is internally consistent.

### 3.4 Prove the session BEFORE building anything

> [!CAUTION]
> A tenant whose GAS deployment lags the frontend rejects **every** request with
> `Unauthorized / Invalid session proof` — reads included. Logging out and back in
> does **not** fix it, and neither does any change to the payload.

Worse, retrying makes it strictly worse. `createSessionKey()`
(`src/services/SessionKeyService.js`) calls `nextGeneration()` on **every** request,
success or failure, while `verifySessionProof()` (`GAS/sessionProof.gs`) only advances
its stored generation on a **successful** verify. Failures ratchet the client away from
a frozen server counter, and `SESSION_GEN_WINDOW` is 2.

**So the first call of every session is a read-only `get`, never a write:**

```js
(async () => { const res = await window.pageState.run({
    requests: [{ action: 'get', resource: ['Warehouses'], payload: {} }], notify: false })
  return JSON.stringify({ success: res?.success, error: res?.response?.error || '' }) })()
```

`success: true` → proceed. Anything else → **stop**. It is a deployment problem, not a
data problem: push and redeploy `sessionProof.gs` to that tenant. Building a payload
first wastes the work and burns generations for nothing.

### 3.5 Codes are auto-generated — leave them alone

`generateNextYearScopedCode` (`GAS/resourceApi.gs`) derives the year segment from
`new Date().getFullYear()` **server-side**, so historical rows get a current-year
code (`ORS26…` for 2025 data). This is expected and correct — do not try to force
a code, and do not promise a user a specific code in advance.

Never assume the sequence starts at 1: a run expecting `ORS26000001` returned
`ORS26000048`, because the sheet already held 47 rows.

> [!CAUTION]
> If a user asks to rename codes after the fact, say what it breaks. The parent
> code is stored as a **literal string** in every child and ledger row that
> references it. A rename confined to the parent sheet orphans all of them.

---

## 4. Data contract

### 4.1 Input

TSV, one row per parent record, with child lines as an embedded JSON array:

```
Invoice Number	Date	Outlet Code	Outlet Name	Items
LP/LL25-0001	2025-03-04	OUT00050	AL KHALABIYA	[{"SkuCode":"CK1P-08","Quantity":4}, …]
```

Columns present for human reference only (`Outlet Name`, legacy line codes) are
ignored — **confirm which those are** rather than inferring. Ask, too, where a
column with no schema home should go: an "Invoice Number" that matches no column
may belong in a stamp comment, or nowhere.

### 4.2 Validate master references BEFORE the loop

GAS validates only `RequiredHeaders` presence. It does **not** check that a `SKU`,
`OutletCode`, `WarehouseCode`, or `PriceListCode` exists. An unknown value is
written verbatim and becomes a dangling reference — and any movement built from it
silently misstates a balance.

Read the master codes out of IndexedDB and diff:

```js
(async () => {
  const db = await new Promise(r => { const q = indexedDB.open('aql-db'); q.onsuccess = () => r(q.result) })
  const keys = (await new Promise(r => {
    const q = db.transaction('resource-records').objectStore('resource-records').getAllKeys()
    q.onsuccess = () => r(q.result) })).map(String)
  const codesOf = p => keys.filter(k => k.startsWith(p + '::')).map(k => k.split('::')[1])
  return JSON.stringify({ skus: codesOf('SKUs'), warehouses: codesOf('Warehouses') })
})()
```

Records are keyed `Resource::Code`, so codes come from the **key**, not the value.

> [!CAUTION]
> **An empty cache is indistinguishable from an empty master.** A resource absent
> from IndexedDB has merely not been loaded — it is not evidence the sheet is
> empty. Combined with the skip rule (§4.3) this fails catastrophically *and
> silently*: every line is judged unresolvable, every record is skipped, and the
> run reports success having written nothing.
>
> **Guard: assert a non-trivial master count before validating anything.**
>
> ```js
> // Refuse to proceed if a master looks unloaded rather than genuinely empty.
> const need = { SKUs: 1, Outlets: 1, Warehouses: 1 }
> const bad = Object.entries(need).filter(([r, min]) => codesOf(r).length < min)
> if (bad.length) throw new Error('Masters not loaded: ' + bad.map(b => b[0]).join(', '))
> ```
>
> This matters most right after a **tenant switch**, which calls
> `localStorage.clear()` and deletes the IndexedDB (`IndexedDbService.js`). Visit
> the relevant list pages first so the masters populate, then re-run the guard.

> [!CAUTION]
> **A dev rehearsal does not validate live data.** Masters differ per tenant. A run
> rehearsed on `AQL` skipped 4 SKUs (28 of 180 units) that `LPAJAEGCC` holds perfectly
> well. Rehearsing proves the *payload and the auth path*; it says nothing about which
> lines survive on the target. Re-run §4.2 against the real tenant, always, and never
> carry a skip list across.

### 4.3 The standing skip rule

> [!IMPORTANT]
> **The master data is the authority.** The restore source may reference SKUs,
> outlets, or warehouses that this tenant's masters do not contain. Any line
> whose SKU is absent from the master is **skipped**; any record whose outlet is
> absent is **skipped whole**. Nothing is invented to make a row fit.

Two consequences that are part of the rule, not exceptions to it:

1. **Ledger legs are built from the KEPT lines only**, never the source lines, so
   children, movements, and storage balances always agree. Keeping these aligned
   is the point of the whole exercise — a restore that leaves them disagreeing is
   worse than no restore.
2. **A record with zero surviving lines is not written at all.** An empty parent
   is permanent pollution: `useConsumptionPayload.js` says a consumption written
   with no lines "sits in `PENDING_INVOICE_GENERATION` forever, polluting the
   invoiceable queue with a bill that has nothing to put on it." Report it as
   skipped, with the reason, and move on.

Still **report every skipped value with its quantity impact** — the rule decides
the action, but the user must see the cost. A real case dropped **56 of 151
units, 37% of the invoice**. Never let a settled rule hide a number that large.

> [!CAUTION]
> A value missing from the master is not proof it is bogus. In the verified run,
> all 6 unresolvable SKUs (`CK1PB-01`, `CK1S-07`, …) already carried **real
> balances in `OutletStorages`** — the master was the stale party, not the data.
> The skip rule still applies, but say so explicitly in the report: it tells the
> user their master needs attention, and that the restore is short as a result.

---

### 4.4 Are those numbers quantities? PROVE IT

A ledger stores **units**. A source extract very often stores **money** — and the two
are indistinguishable by looking at a grid of integers.

The tell is a `RATE` column. If one exists, test whether every non-zero cell divides
evenly by its row's rate:

```js
const q = value / rate
const clean = Math.abs(q - Math.round(q)) < 1e-9
```

Across a real matrix of 180 non-zero cells, **every one** divided evenly — 21 SKUs at
rates from 8 to 58. That is not coincidence; it proves the cells were `rate × qty`.
Writing them as quantities would have posted **482 units as 3,806**.

Divisibility is evidence, not proof: at rate 1 the two are identical, and a rate of 10
makes many quantities look plausible either way. **Confirm the reading with the user
before building**, and say which interpretation you used in the report.

---

## 5. Batch shape

One batch per parent record. Order matters — GAS resolves `$ref` against records
already written earlier in the same batch.

```
1. compositeSave  <Parent> + <Child>            ← pageState.build()
2..n. bulk        <each ledger leg from the profile>
last. get         [<derived balance resources>]
```

### 5.1 Building the parent

```js
ps.initResource('<Parent>', { reset: true })   // reset:true — fresh node per record
ps.setRecord(null, { /* header */ }, '<Parent>')
kept.forEach(i => ps.addChild('<Child>', { /* line */ }, '<Parent>'))
const base = ps.build()                        // → [compositeSave]
```

`initResource(..., { reset: true })` detaches every stale node. Without it, record
N+1 inherits record N's children and writes a compounding batch.

### 5.2 Referencing the not-yet-created parent

```js
const REF = { $ref: '<Parent>.latest.code' }   // === batchRef('<Parent>.latest.code')
```

GAS resolves this to the code the composite just minted. **Never** concatenate or
stringify a `$ref` client-side — that means guessing a code the batch has not
produced yet (CORE_ARCHITECTURE_RULES §3). To join a `$ref` to codes you already
hold, use `batchRefList`, which defers the join to GAS.

### 5.3 Ledger legs

A composite save writes the parent and its children **and nothing else**. Marking
rows with a terminal state but writing no ledger rows produces records that claim
stock moved when none did.

Which legs exist, and their signs, are **per resource** — see the profile. The
invariant is only this:

- Always `Math.abs(qty)` first, then apply the sign. A source row carrying a
  negative quantity must never flip a movement's direction.
- Each leg carries the cursor resource whose balance it changes, so GAS's
  recalculation hooks fire.
- The trailing `get` pulls recalculated balances back in the same round trip.

### 5.4 Dispatch

```js
const res = await ps.run({ requests, notify: false })
// → { success, code, response }   `code` is the parent code GAS generated
```

`notify: false` suppresses toast spam across a long loop. `run` still applies
validation and the submitting lifecycle.

---

## 6. Execution loop

1. **Preview record 1 without dispatching.** Build the requests, print the
   composite payload, and check every column — stamps, blanks, child count —
   against the agreed profile. Confirm `ps.validationErrors.value` is `[]`.
2. **Send one record. Verify it (§7). Report the code.**
3. Only then continue. **Stop on the first failure** and report it — do not plow
   through, or a systematic error repeats across every remaining row.
4. Accumulate `{ ref, code, success, linesWritten, linesSkipped, qty }` per record
   and hand back the full mapping at the end.

### 6.1 A timeout is not a failure — NEVER retry blind

> [!CAUTION]
> The browser console tool times out at **30 seconds**. A batch with many lines
> routinely takes longer. The timeout kills *the tool call*, not the request —
> the batch is still in flight and will land normally.
>
> Retrying on a timeout writes a **duplicate parent, duplicate children, and
> duplicate ledger rows** — double-deducting the warehouse. There is no unique
> constraint to stop it, and nothing in the response will later reveal it.

On any timeout, **establish what happened before touching anything**:

```js
JSON.stringify({ log: (window.__restore?.log || []).map(l => [l.ref, l.code, l.success]),
                 submitting: window.__pageState?.meta?.submitting })
```

| Observed | Meaning | Action |
|---|---|---|
| Record present in `log`, `success: true` | Landed. Timeout was cosmetic | Verify (§7), continue |
| Absent, `submitting: true` | Still in flight | Wait and re-check. **Do not resend** |
| Absent, `submitting: false` | Genuinely failed before dispatch | Safe to retry |

If the log is inconclusive, verify against IndexedDB (§7) and — for a resource
whose parent carries a natural key — check whether a row with that date, outlet,
and line count already exists before resending.

This is why §6 step 4 keeps a log at all: it is the only durable record that
survives a dropped tool call.

### 6.2 Fire-then-poll, for batches that will exceed 30s

Avoid the ambiguity rather than recovering from it. Dispatch without awaiting,
stash the result on `window`, then poll:

```js
// call 1 — returns immediately
window.__restore.one(row).then(r => { window.__last = r })
                         .catch(e => { window.__last = 'ERR ' + e.message })
'dispatched'

// call 2 — polls up to 25s, returns as soon as it resolves
(async () => { for (let i = 0; i < 25; i++) {
    if (window.__last) break; await new Promise(r => setTimeout(r, 1000)) }
  return JSON.stringify({ last: window.__last || 'still pending',
                          submitting: window.__pageState?.meta?.submitting }) })()
```

Clear `window.__last` before each dispatch, or the poll returns the previous
record's result and reports a success that has not happened yet.

---

## 7. Verification — read it back, don't trust the response

> [!IMPORTANT]
> A follow-up `get` returns **only rows changed since the last cursor**, and the
> batch's own trailing `get` already advanced it. Re-getting to verify returns
> **zero rows** — which looks exactly like a failed write and is not one.

Verify from IndexedDB instead. Records are stored as a positional **`row` array**
matching the sheet's header order, not as an object — `rec.data.SKU` is
`undefined`. Match by scanning the array:

```js
(async () => {
  const db = await new Promise(r => { const q = indexedDB.open('aql-db'); q.onsuccess = () => r(q.result) })
  const all = await new Promise(r => {
    const q = db.transaction('resource-records').objectStore('resource-records').getAll()
    q.onsuccess = () => r(q.result) })
  const hit = (r, code) => Array.isArray(r.row) && r.row.some(c => String(c) === code)
  const g = (n, c) => all.filter(r => r.resource === n && hit(r, c))
  const code = '<parent code>'
  return JSON.stringify({
    parent: g('<Parent>', code)[0]?.row,
    child:  g('<Child>', code).length,
    legs:   ['<Ledger1>', '<Ledger2>'].map(n => [n, g(n, code).length]) })
})()
```

**Pass criteria:** child count and every ledger-leg count equal the kept-line
count, and the parent row shows the terminal Progress with the intended historical
stamps in the intended columns — **including the triples that must stay blank**. A
restore that never went through revision, rejection, or cancellation must leave
those empty.

---

## 8. Reporting

Per record, and again as a summary table:

```
Ref            Created Code   Outlet     Lines  Qty  Child  Leg1      Leg2
LP/LL25-0001   ORS26000048    OUT00050   14     95   14     14 (−95)  14 (+95)
```

State skipped lines and their quantity impact **in the summary**, not only at
decision time. Someone reading the report later needs to see the shortfall
without re-deriving it.

---

## 9. Teardown — revert what the restore needed

The restore leaves no permanent trace in the codebase. When the run is finished:

```bash
git checkout -- FRONTENT/src/pages/Page.vue
```

Then confirm nothing survives:

```bash
grep -c "__pageState" FRONTENT/src/pages/Page.vue   # expect 0
git status --short                                   # expect no restore-related files
```

Also delete any data file staged for the browser to `fetch` (§5.5) — it lives
under `FRONTENT/public/` and would otherwise ship with a build.

> [!WARNING]
> Other files in the working tree are almost certainly **someone's in-progress
> development**. Revert *only* `Page.vue` and files this restore created. Never
> `git checkout .` or `git stash` the whole tree.

---

## 10. Checklist

- [ ] **Dev handle re-added** to `Page.vue` (§1) — it is not in the repo
- [ ] **Correct tenant confirmed** — `aql_tenant_code` matches the intended tenant
- [ ] **Read-only `get` returned `success: true`** (§3.4) — prove the session before building
- [ ] **Masters loaded and guard passed** (§4.2) — never validate against a cold cache
- [ ] Runner re-installed after any tenant switch or reload (`window.*` does not survive)
- [ ] Profile for this resource exists in Part B, or was derived with the user
- [ ] Schema read from `setup*Sheets.gs`; every unsupplied column asked about
- [ ] §3.2 questions answered — Progress, location, actor, comments, links, chains
- [ ] `$datetime` rule confirmed explicitly (§3.3)
- [ ] Ledger legs confirmed against the resource's own `use*Payload.js` (§5.3)
- [ ] Master references validated; unresolvable values quantified and ruled on
- [ ] Source numbers confirmed as **quantities, not values** (§4.4)
- [ ] `window.__pageState` confirmed live on the `_add` route (dev build only)
- [ ] Record 1 previewed un-dispatched; `validationErrors` empty
- [ ] Each record verified from IndexedDB before the next is sent
- [ ] Long batches dispatched fire-then-poll (§6.2); timeouts resolved via §6.1, never retried blind
- [ ] Loop halts on first failure
- [ ] Final mapping table delivered, skipped lines and quantity impact stated
- [ ] **Teardown done (§9)** — `Page.vue` reverted, staged data file deleted, no other files touched

---

# PART B — Resource Profiles

## B.1 OutletRestocks — VERIFIED

Run of 2026-08-28 against **live `LPAJAEGCC`**; **7 records**
(`ORS26000027`–`ORS26000033`), 39 lines, 180 units, **zero skips**. Every leg confirmed:
39 children, 39 `StockMovements` (−180), 39 `OutletMovements` (+180), and all nine
must-stay-blank stamp columns empty on all 7.

Earlier run of 2026-08-19 against dummy data; 5 records (`ORS26000048`–`ORS26000052`).
One 30s tool timeout encountered and resolved per §6.1 — the batch had landed.

**Two failures worth remembering from the 2026-08-28 run:**

1. The tenant rejected every request with `Invalid session proof` until its GAS was
   redeployed. Cost several dispatches before diagnosis — now prevented by §3.4.
2. A batch appeared to hang for ~4 minutes with `submitting: true`. `performance
   .getEntriesByType('resource')` showed the request had **completed in 17.3s**; the
   client's post-processing was stuck. Resolved without resending: the code sequence
   was contiguous (`…67` with no `…68`), proving nothing had landed. **Sequence
   contiguity is a reliable no-duplicate check** — cheaper than any other evidence.

| | |
|---|---|
| Route | `/operation/outlet-restocks/_add` |
| Parent / Child | `OutletRestocks` / `OutletRestockItems` |
| Code prefixes | `ORS` (seq 6), `ORSI` (seq 7) — both year-scoped |
| Domain builders | `src/_resource/Operation/OutletRestocks/composables/useRestockCreation.js` |
| Wizard ceiling | `APPROVED` — `DELIVERED` is unreachable via the UI's create path |

**Parent columns**

```
Code · Date · OutletCode · OutletConsumptionCode · RequestedUser · ApprovedUser
Progress · Progress{Submitted,RevisionRequired,Approved,Rejected,Delivered}{At,By,Comment}
Status · AccessRegion
```

**Child columns**

```
Code · OutletRestockCode · WarehouseCode · SKU · StorageName · Quantity
Progress · Progress{Allocated,Delivered,Cancelled}{At,By,Comment} · Status · AccessRegion
```

**Ledger legs** (both required when restoring to `DELIVERED`)

| Leg | Sign | Resource | ReferenceType | Cursor |
|---|---|---|---|---|
| Warehouse out | `-abs(qty)` | `StockMovements` | `OutletRestock` | `WarehouseStorages` |
| Outlet in | `+abs(qty)` | `OutletMovements` | `RestockDelivery` | `OutletStorages` |

Trailing `get`: `['WarehouseStorages', 'OutletStorages']`

**Constants** — re-confirm per tenant:
`WarehouseCode: WH001`, `StorageName: _default`, `OutletConsumptionCode: ''`
(blank — a restored restock stands alone and has no consumption to point at).

**Stamps for a `DELIVERED` restore.** Parent writes `Submitted` + `Approved` +
`Delivered`; child writes `Allocated` + `Delivered`. Parent `RevisionRequired`,
`Rejected`, `Cancelled` and child `Cancelled` **stay blank** — that is a pass
criterion, not an omission. One timestamp per record, reused across every triple.

> [!NOTE]
> `src/pages/Page.vue` may already carry a `window.pageState` handle as an uncommitted
> working-tree change. If so, **use it and edit nothing** — §9 then has nothing to
> revert. Check before adding `window.__pageState`.

**Masters to validate:** `SKUs`, `Outlets`, `Warehouses`.

---

## B.2 OutletConsumptions — VERIFIED

Run of 2026-08-28 against **live `LPAJAEGCC`**; **17 records**
(`OC26000048`–`OC26000064`), 180 lines, 482 units, zero skips. Verified: 180 children,
180 `OutletMovements` (−482), every parent `PENDING_INVOICE_GENERATION` with the
`InvoiceGenerated` and `Cancelled` triples blank.

Earlier run of 2026-08-19 against dummy data; 2 records offered, 1 written
(`OC26000024`), 1 correctly skipped per §4.3.

| | |
|---|---|
| Route | `/operation/outlet-consumptions/_add` |
| Parent / Child | `OutletConsumptions` / `OutletConsumptionItems` |
| Code prefixes | `OC` (seq 6), `OCI` (seq 7) — both year-scoped |
| Domain builders | `src/_resource/Operation/OutletConsumptions/composables/useConsumptionPayload.js` |
| Required headers | parent `OutletCode,Date,Username,Progress,Status`; child `OutletConsumptionCode,SKU,Qty` |
| Unique composite | child `OutletConsumptionCode+SKU` — **one row per SKU**; merge duplicate source lines before writing |

> [!CAUTION]
> **The `_add` page seeds a companion `OutletRestocks` node.** As of 2026-08-28 the
> snapshot carries *two* nodes: `OutletConsumptions` and an `OutletRestocks` prefilled
> `DELIVERED` with `WarehouseCode: WH002` and `direct`/`deliver` controls — the
> restock-alongside-consumption flow. Left attached, every `build()` would also write a
> **phantom restock crediting warehouse stock that never moved**.
>
> `initResource('OutletConsumptions', { reset: true })` detaches it — but **verify, do
> not assume**: the preview must show exactly `compositeSave:OutletConsumptions`,
> `bulk:OutletMovements`, `get:OutletStorages`, with no `OutletRestocks` and no `WH002`.
>
> (An earlier run recorded `snapshot()` as `{}` here. The page changed; re-read the
> snapshot every time rather than trusting a profile's account of it.)

**Parent columns**

```
Code · OutletCode · Date · Username · OutletVisitCode
Progress · Progress{PendingInvoiceGeneration,InvoiceGenerated,Cancelled}{At,By,Comment}
Status · AccessRegion
```

**Child columns** — note how little this shares with B.1:

```
Code · OutletConsumptionCode · SKU · Qty · Status
```

No `Progress`, no stamps, no warehouse, and the quantity column is **`Qty`, not
`Quantity`**. Default `Qty: 0`, parent default `Progress: PENDING_INVOICE_GENERATION`.

**Ledger leg** — the sign is *opposite* to a restock's outlet leg:

| Leg | Sign | Resource | ReferenceType | Cursor |
|---|---|---|---|---|
| Outlet out | `-abs(qty)` | `OutletMovements` | `Consumption` | `OutletStorages` |

A consumption **depletes** outlet stock. Reusing B.1's `+` would credit stock the
outlet actually sold. There is **no warehouse leg** — a consumption never touches
`StockMovements`.

Trailing `get`: `['OutletStorages']`

**Settled decisions — do not re-ask:**

| Field | Value |
|---|---|
| `Progress` | `PENDING_INVOICE_GENERATION` — always, for every record |
| `OutletVisitCode` | blank |
| `Username` | session user |
| `StorageName` (movement) | `_default` |
| `$datetime` | record's own `Date` + current wall-clock time (§3.3) |
| `ProgressPendingInvoiceGenerationComment` | `Tenant Initial Data Restore - Doc number: <source doc no.>` |
| Source line codes | ignored entirely |

**Invoices are OUT OF SCOPE.** Do not write `OutletConsumptionInvoices`,
`OutletConsumptionInvoiceItems`, or the `MarkInvoiceGenerated` action. This is
also why `PENDING_INVOICE_GENERATION` is correct rather than a compromise: the
composite lands there by design, and `INVOICE_GENERATED` is only reachable
through an action that presupposes an invoice row.

**Masters to validate:** `SKUs`, `Outlets`.

Source documents may reuse a doc number already seen on another resource
(`LP/LL25-0001` exists as both a restock and a consumption). Separate series —
not a collision, and not a reason to pause.

> [!NOTE]
> **`ProgressInvoiceGenerated*` stamps do not belong on a restore.** Writing them while
> `Progress` stays `PENDING_INVOICE_GENERATION` makes the record claim an invoice exists
> while sitting in the invoiceable queue. Setting `Progress: INVOICE_GENERATED` instead
> is self-consistent but points at invoice rows the restore never created. Leave both
> blank and let the real `MarkInvoiceGenerated` action stamp them.

**Still open** (not encountered in the verified run):

- **Returns.** `useConsumptionPayload.js` writes a second `OutletReturn` movement
  leg when a count carries returns. The verified source data had none — if a
  future batch does, derive that leg before running.

---

## B.3 Adding a profile

Fill the same headings: route, parent/child, code prefixes, domain builder path,
both column lists, the ledger-leg table, agreed constants, masters to validate,
and open questions. Mark it **DRAFT** until a run has been verified per §7, then
mark it **VERIFIED** with the date and record count.
