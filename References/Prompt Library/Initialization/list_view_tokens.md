# Scope Boundary: AQL List View Filters & Dynamic Tokens

This prompt governs the **filter evaluation layer** behind `APP.Resources.ListViews` — the filter
tree schema, the comparison operators, and the dynamic token system (`$startOfMonth`, `$daysIn:7`,
`$userRoles`, ...) that makes a single sheet-authored view resolve against the current date and the
logged-in user.

**In scope**: adding/modifying tokens, adding coercion primitives, changing operator semantics,
changing how a condition is evaluated, keeping the GAS admin dialog in sync.

**NOT in scope** — route elsewhere:
- Visual layout of the switcher pills/tabs → [list_switcher_customization.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/list_switcher_customization.md)
- How the list body renders rows for an active view → [content_customization.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/content_customization.md)
- Adding the `ListViews` column itself / sheet setup → [database_schema_alteration.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/database_schema_alteration.md)

---

## 1. Domain Map & Key Files

Read these before editing anything:

| File | Role |
| :--- | :--- |
| [`FRONTENT/src/utils/tokenEvaluator.js`](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/utils/tokenEvaluator.js) | **Token registry + `COERCES` primitive library + the whole condition evaluator** (`prepareCondition` / `prepareFilter` / `evaluatePreparedFilter` / `evaluateFilter`) and the `useTokenEvaluator()` composable, which binds `{ user }` from the auth store. The single source of truth for token behaviour. |
| [`FRONTENT/src/utils/dateHelpers.js`](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/utils/dateHelpers.js) | Date parse/normalise helpers. Calculations delegate to `date-fns`; only `parseAnyDate` is hand-rolled. |
| [`FRONTENT/src/composables/useListViews.js`](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/useListViews.js) | Auto-generated views, active-view state, per-view counts. Consumes the evaluator; re-exports `prepareFilter` / `evaluatePreparedFilter` / `evaluateFilter` for existing importers. |
| [`FRONTENT/src/composables/resources/useResourceConfig.js`](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/resources/useResourceConfig.js) | `normalizeVisibleWhen` / `isActionVisible` — the SECOND consumer of the evaluator. An action's `visibleWhen` accepts the same tokens a list-view filter does. |
| [`GAS/listViewsManager.html`](file:///f:/LITTLE%20LEAP/AQL/GAS/listViewsManager.html) | **Admin dialog (list views).** Its `TOKENS` array is a hand-maintained mirror of the frontend registry. |
| [`GAS/actionManager.html`](file:///f:/LITTLE%20LEAP/AQL/GAS/actionManager.html) | **Admin dialog (actions).** Carries a second hand-maintained `TOKENS` mirror for the "Visible When" value picker. |
| [`Documents/AQL_FRONTEND_LIST_SWITCHER.md`](file:///f:/LITTLE%20LEAP/AQL/Documents/AQL_FRONTEND_LIST_SWITCHER.md) | **Canonical spec.** Section 5.2 is the token reference. |

---

## 2. The Sync Contract (Non-Negotiable)

The frontend registry and the two GAS dialogs are **three independent lists that must agree**. There
is no build step or shared import between them — a token added on one side and forgotten on the
others produces either an admin-invisible feature or a dropdown entry that silently matches nothing.

> [!IMPORTANT]
> **Adding, renaming, removing, or re-scoping ANY token requires all five of these edits:**
> 1. `TOKENS` in `FRONTENT/src/utils/tokenEvaluator.js` — behaviour.
> 2. `TOKENS` in `GAS/listViewsManager.html` — admin dropdown entry (`code`, `label`, `group`, and `param` for parameterised tokens).
> 3. `TOKENS` in `GAS/actionManager.html` — the identical mirror used by the "Visible When" value picker.
> 4. The token tables in `Documents/AQL_FRONTEND_LIST_SWITCHER.md` §5.2.2 / §5.2.3 / §5.2.4.
> 5. The verification harness in §6 below — add a case proving the new token resolves and compares.
>
> The `label` and `group` strings should match across (1)–(3) so admins and developers see the
> same vocabulary. Never edit one side alone.

> [!NOTE]
> **A second, narrower grammar shares this vocabulary: action expressions.** An
> `AdditionalActions` `from`/`value` seed is resolved by `resolveActionToken`
> (`GAS/actionTargets.gs`, server-authoritative) and previewed by `prefillExpression`
> (`FRONTENT/src/composables/resources/additionalActionsSchema.js`). Those two are a
> **matched pair** with each other — change one, change the other — and both are
> deliberately a SUBSET of the registry above: they need identity and clock tokens, not
> the filter-comparison vocabulary. Adding a token *there* does not oblige you to add it
> to the five list-view edits, but a token that belongs to both grammars (`$dateTime`)
> must be registered in all five **plus** those two, or it resolves on one side of the
> wire and blanks on the other.

| Grammar | Client | Server | Consumers |
| :--- | :--- | :--- | :--- |
| Filter / `visibleWhen` | `tokenEvaluator.js` (`TOKENS`) | — (client-side only) | list views, action visibility |
| Action expressions | `additionalActionsSchema.js` (`prefillExpression`, preview only) | `GAS/actionTargets.gs` (`resolveActionToken`, authoritative) | `from` / `value` target seeds |

---

## 3. Architecture You Must Understand Before Editing

### 3.1 Two-sided coercion — why it exists

A token can only be compared against a sheet column when **both sides sit in the same space**. AQL
stores dates in two shapes:

- Audit columns (`CreatedAt`/`UpdatedAt`) → **epoch milliseconds** (`applyAuditFields` in `GAS/resourceApi.gs`).
- Business date columns (`Date`, `DueDate`, `VisitDate`) → **ISO strings**, sometimes with a time part.

So each token declares two pipelines of `COERCES` key names:

| Field | Applies to | Default |
| :--- | :--- | :--- |
| `coerce` | the **column** value | required |
| `coerceToken` | the **resolved token** value | falls back to `coerce` |

Pipelines are **arrays of string names, not functions**, deliberately — they stay serialisable so a
future revision can author them in the sheet. Do not "simplify" them into inline functions.

### 3.2 Resolvers are dumb extractors

`value(params, ctx)` returns the **raw** value. The `coerceToken` pipeline converts it. Do not put
type conversion inside a resolver — that splits knowledge of the comparison space across every
token in a family and lets a sibling token get its half wrong independently.

```js
// CORRECT — strategy owns both conversions
$daysIn: { value: (params) => params[0], coerce: ['dayNum'], coerceToken: ['number'] }

// WRONG — conversion hidden in the resolver
$daysIn: { value: (params) => Number(params[0]), coerce: ['dayNum'] }
```

### 3.3 Rejected design — do not re-propose

A single `coerce` pipeline plus an `apply: 'both' | 'column'` flag was considered and **rejected**.
A flag can only express *whether* one shared transform runs on each side; the relative-day tokens
need two *different* transforms (`dayNum` on the column, `number` on the token). Two named pipelines
is the working design. Do not collapse it back into a flag.

### 3.4 Evaluation flow

Evaluation is a **two-phase, compiled** pass:

1. `prepareFilter(filter, ctx)` walks the tree **once** and compiles each condition via
   `prepareCondition`. Everything row-independent is resolved here — `parseToken`, `spec.value`,
   the `coerceToken` pipeline, and the lowercase/numeric forms of literal values. A token condition
   compiles to `{ column, operator, columnPipeline, right }`; a literal one to
   `{ column, operator, literalStr, literalList, literalNum }`.
2. `evaluatePreparedFilter(prepared, row)` runs **per row** and only applies the column-side
   `coerce` pipeline plus `compareCoerced`. **No `parseToken` or `spec.value` call may ever move
   into this phase** — that is the whole point of the split.

`evaluateFilter(filter, row, ctx)` is retained as the backwards-compatible single-row entry point
(it prepares, then evaluates). Collection filtering must use the two-phase pair — `viewCounts` and
`viewFilteredItems` do.

- `ctx` is `{ user }`, built in `useListViews` from `authStore.user`. It is optional (`= {}`) so
  existing call sites keep working.
- Because the whole pass shares one compiled tree, every row sees identical token values.
- **A token anywhere in the value governs coercion for the whole condition.** The GAS dialog
  comma-splits `in`/`not_in` values, so a token routinely arrives wrapped in an array.
- Literal (non-token) conditions must keep using the original path. Do not unify them — that would
  change behaviour for every existing sheet-authored view.

---

## 4. Recipes

### 4.1 Add a fixed token

```js
// tokenEvaluator.js
$startOfWeek: {
  label: 'Start of this week (timestamp)',
  group: 'Date & Time',
  value: () => startOfWeek(new Date())?.getTime(),
  coerce: ['epoch'],
  coerceToken: ['number']
}
```
Then mirror in GAS, document, and test. If the column-side conversion needs a new primitive, add it
to `COERCES` first — but prefer **composing existing ones** (`['trim','lowercase']`) over adding a
near-duplicate.

### 4.2 Add a parameterised token

Params are everything after the first colon, split on `:` into a **string array**. The parse regex
in `parseToken` allows a leading minus and decimals (`$daysIn:-5`).

```js
$monthsAgo: {
  label: 'N months ago',
  group: 'Relative Days',
  param: 'N',
  paramDefault: '3',
  value: (params) => -Math.abs(Number(params[0])),
  coerce: ['monthNum'],       // column → signed months from today
  coerceToken: ['number']
}
```
In GAS, set `param: '3'` so `onTokenSelect` seeds `$monthsAgo:3` and the admin only edits the number.

### 4.3 Add a user token

Read the payload shape from `buildAuthUserPayload` in [`GAS/auth.gs`](file:///f:/LITTLE%20LEAP/AQL/GAS/auth.gs)
— **do not guess field names**. It exposes `id`, `name`, `email`, `avatar`, `accessRegion`,
`designation`, `roles`, `role`. Note `UserID` is mapped to `id`, not `code`.

Use optional chaining throughout; a logged-out or partially-hydrated store must not throw:
```js
$userDesignation: { value: (params, ctx) => ctx.user?.designation?.name, coerce: ['slug'] }
```
Array-returning tokens (`roles`, region codes) set `array: true` and are intended for `in`/`not_in`.

### 4.4 Modify an existing token

Changing a token's `coerce` pipeline changes the meaning of **every sheet-authored view already
using it, across every tenant**. Before editing:
1. Run `gitnexus_impact` on the affected evaluator symbol.
2. State plainly in your response which existing views could change behaviour.
3. Prefer adding a new token over redefining one in use.

---

## 5. Invariants & Traps

These are settled decisions. Preserve them, and mention them when a user's request would violate one.

1. **Rolling windows need both edges.** `lte $daysIn:7` alone also matches everything overdue — an
   invoice due 90 days ago has offset `-90`, and `-90 <= 7`. Always pair `gte $daysIn:0` with
   `lte $daysIn:N`. Single-sided is only correct for `lt $daysIn:0` (overdue), `eq $daysIn:0`
   (today), `lt $daysAgo:N` (aged).
2. **Sign convention is future-positive** (`row − today`). Flipping it silently inverts every
   existing condition with no way to detect the error from the data.
3. **Calendar dates are read literally.** `parseAnyDate` builds the date from Y/M/D components and
   ignores a trailing `Z`, matching the long-standing `.slice(0, 10)` behaviour in
   `useOutletVisits`. Do **not** swap in `date-fns` `parseISO` — it honours the zone and would
   re-bucket existing rows across a day boundary. This is documented in §5.2.1 of the canonical doc.
4. **Unparseable columns never match.** The token branch of `evaluatePreparedCondition` returns
   `false` explicitly on `NaN` rather than riding NaN comparison semantics — otherwise `neq`/`not_in`
   would sweep in every blank row. Do not "fix" this with `|| 0`. Note the guard is **NaN-only**: a
   string-valued pipeline (`dateOnly`, `month2`) yields `''` for a blank column, so `neq $date`
   still matches blanks. Long-standing behaviour; changing it would re-bucket existing views.
5. **Array tokens coerce per element.** `$userRoles` must map the pipeline over each entry;
   coercing the array as a whole yields `"auditor,approver"` and matches nothing.
6. **`contains` always forces strings**, whatever the declared pipeline. Substring matching on a
   coerced number is meaningless.
7. **Token names are matched case-insensitively** so sheet authors can write `$startofmonth`.
   Keep new names unique case-insensitively. This holds on **all three** evaluators:
   `parseToken` (`tokenEvaluator.js`) lowercases through `TOKEN_INDEX`, and both
   `resolveActionToken` (`GAS/actionTargets.gs`) and `prefillExpression`
   (`additionalActionsSchema.js`) lowercase their switch key. A token added to any of them
   must therefore be registered **once, in one casing** — never as two sibling cases.
8. **Pipeline names are validated at module load.** An unknown `COERCES` key throws on import. Keep
   that guard — a typo'd pipeline name otherwise surfaces only as a silently empty tab.
9. **Filtering is client-side.** Counts reflect the rows already loaded, not the whole sheet. Do not
   claim server-side filtering; pushing tokens into the GAS query is a separate, larger change.
10. **Date tokens resolve when the view recomputes**, not on a timer. A session open across local
    midnight keeps the previous day's buckets until reload. This is accepted — a polling tick was
    implemented and deliberately removed. Do not reintroduce it without being asked.

---

## 6. Verification (No Test Runner in This Repo)

`npm test` is a no-op and there is no ESLint config. Verify token work by bundling the **real**
modules with esbuild and asserting against them — never by reimplementing the logic in a scratch
script, which proves nothing.

Write `FRONTENT/tmp_token_check.mjs` importing from `src/...`, then:

```bash
cd FRONTENT && npx esbuild tmp_token_check.mjs --bundle --platform=node --format=cjs --alias:src=./src --define:import.meta.env='{"VITE_GAS_URL":""}' --outfile=tmp_token_check.bundle.cjs && node tmp_token_check.bundle.cjs && rm -f tmp_token_check.mjs tmp_token_check.bundle.cjs
```

`--format=cjs` and the `import.meta.env` define are both required — the auth store pulls in axios
(needs CJS interop) and reads `VITE_GAS_URL` at module scope.

Cover at minimum:
- The new token against **both** storage formats (an ISO-string column and an epoch-ms column).
- A blank/malformed column value → no match.
- For array tokens: `in` match, `in` no-match, and the array-wrapped form `['$userRoles']`.
- For param tokens: a negative param, and the sign of the resolved value.
- That literal (non-token) conditions still behave — `eq`, `in`, numeric `gte`, `contains`.

Delete the temp files when done; they are not part of the repo.

Also syntax-check the GAS dialog after editing it (it is never bundled, so a typo ships silently):

```bash
node -e "const fs=require('fs');const h=fs.readFileSync('GAS/listViewsManager.html','utf8');[...h.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].forEach((b,i)=>{try{new Function(b[1]);console.log('block '+i+': OK')}catch(e){console.log('block '+i+': '+e.message);process.exitCode=1}})"
```

---

## 7. Completion Checklist

- [ ] `TOKENS` updated in `tokenEvaluator.js`, resolver is a plain extractor, pipelines declared.
- [ ] Any new `COERCES` primitive justified (no near-duplicate of an existing composition).
- [ ] `TOKENS` mirrored in `GAS/listViewsManager.html` AND `GAS/actionManager.html` with matching `code`/`label`/`group`, plus `param` if parameterised.
- [ ] Both GAS script blocks syntax-checked.
- [ ] Token tables updated in `AQL_FRONTEND_LIST_SWITCHER.md` §5.2.
- [ ] Harness run against real modules; all assertions pass; temp files deleted.
- [ ] Existing literal-condition behaviour confirmed unchanged.
- [ ] If an existing token's semantics changed: impact stated explicitly to the user.
