# Action Subsystem — Execution, Security & Embedding

> Part of **[﻿# AQL Action System Guide](UI_ACTION_SYSTEM.md)**. The execution and security model, response reactivity, and embedding a trigger.

---

### 7.5 Execution & security model

The target list is read from the **trusted `APP.Resources` config**, never from the client.
The client sends only `fields` (values the user typed on the source record) and
`targetFields` (values typed into target inputs) — everything copied or defaulted is
resolved server-side. A client therefore cannot inject a target, nor write a column the
config does not declare.

That is what authorizes a target write under the action's **own** permission on the
**source** resource, rather than `canWrite`/`canUpdate` on the target resource.
`executeActionTargets` deliberately does not call `enforceMasterPermission` per target.

Execution is two-pass:

0. **Gate.** Each target's `when` (§7.4.1) is evaluated first; a false gate skips the target
   before pass 1 touches it at all.
1. **Resolve + validate every target.** Expressions resolved, `required` enforced,
   `validateRequiredFields` and `validateMasterUniqueness` run. Nothing is written.
2. **Write.** Updates row-by-row, creates batched into one `setValues` per resource.

Ordering: targets land **before** the source record's column is stamped, so a failure
leaves the record in its original state rather than flipped to an outcome whose follow-up
records never materialized.

Two creates against the same resource in one action are safe: each prepared row is pushed
onto the in-memory `values` snapshot, so the next generated code and the next uniqueness
check both see it.

> [!NOTE]
> **Known residual risk.** Sheets has no transactions. If write 2 of 3 fails (lock
> contention, quota), write 1 has already landed and a retry would duplicate it. The
> validate-first pass makes this rare but not impossible. If it ever bites, the fix is an
> idempotency key on the action run.

### 7.6 Response & reactivity

GAS returns direct-write payloads for **every** resource the action touched, merged into
the response. `resourceIoStore.runBatchRequests` hydrates them via `hydrateResourcePayload`,
so the dialog closes on success and the page updates through normal reactivity — **no
refetch**. A target writing back to the source resource merges into one payload rather than
clobbering it.

### 7.7 Embedding a trigger

```html
<AdditionalActionsButtons resource="OutletVisits" :record="visit" mode="inline" />
<AdditionalActionsButtons resource="OutletVisits" :record="visit" mode="menu" :only="['Postpone']" />
```

Or supply your own buttons while keeping the gating:

```html
<AdditionalActionsButtons resource="OutletVisits" :record="visit">
  <template #default="{ actions, open }">
    <q-btn v-for="a in actions" :key="a.action" :label="a.label" @click="open(a)" />
  </template>
</AdditionalActionsButtons>
```

---


---

⬑ Back to **[﻿# AQL Action System Guide](UI_ACTION_SYSTEM.md)**.

---

⬑ Back to **[﻿# AQL Action System Guide](UI_ACTION_SYSTEM.md)**.
