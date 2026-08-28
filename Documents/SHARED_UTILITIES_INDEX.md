# Shared Utilities Index (Canonical)

## Purpose
This is the canonical catalogue of every reusable helper, utility, and core composable in the AQL frontend. It exists to stop developers and AI agents from re-implementing string helpers, date formatters, color resolvers, or payload builders that already exist.

**Before you add any new utility, helper, core method, or file** — across Layer 1 (Core Infrastructure), Layer 2 (`src/_resource/`), or Layer 3 (`src/_ui/`) — read this index and the source files it points to. The strict rule lives in `AGENTS.md` under **Reuse First & Anti-Duplication Policy (STRICT)**.

### How to use this index
- Each section below names a file and lists its exported functions with a one-line purpose, purity note, and **When to reuse / When to extend** guidance.
- **Purity**: a "pure" function returns the same output for the same input and has no side effects. Prefer pure functions for new logic.
- **Extend, don't duplicate**: if your new capability is a sibling of an existing function, add it to the same file. Do not open a new file unless the capability genuinely belongs to a new domain.
- **Mandatory Exhaustion Quote**: when you do create or extend a helper, cite your search findings in your output exactly as `AGENTS.md` requires.

---

## 1. String & Object Transformations
**File**: `FRONTENT/src/utils/appHelpers.js`

Generic, resource-agnostic string/object shaping. Imported widely by `_ui/` page contracts and JS modifiers. Pure unless noted.

| Function | Purpose |
|----------|---------|
| `humanizeString(str)` | Turn `camelCase`/`PascalCase`/snake into a spaced, capitalised label (`purchaseRequisition` → `Purchase Requisition`). Pure. |
| `toPascalCase(str)` | Slug/string → `PascalCase`, treating `-`, `_`, space as separators. Kept byte-compatible with `toActionHeaderSuffix` in `GAS/resourceApi.gs`. Pure. |
| `humanizeSlug(slug)` | Hyphen slug → Title Case (`purchase-requisition-items` → `Purchase Requisition Items`). Pure. |
| `pluralize(word)` | English plural with irregular/exception tables. Preserves leading-case. Pure. |
| `singularize(word)` | Best-effort reverse of `pluralize` (English pluralisation is lossy). Pure. |
| `AUDIT_HEADERS` | `Set` of always-hidden audit columns (`CreatedAt`, `UpdatedAt`, `CreatedBy`, `UpdatedBy`). Constant. |
| `deriveActionStampHeaders(additionalActions)` | From a resource's additionalActions config, build the `Set` of `By`/`At` stamp headers to hide. Pure. |
| `resolveDisplayValue(value, emptyText)` | Default render of a raw cell — flattens relation objects (`{Name, Code}`) and falls back to `emptyText`. Pure. |
| `filterDetailFields(resolvedFields, actionStampHeaders)` | Drop `Code`, audit headers, and action stamps from a detail field list. Pure. |
| `filterParentFields(record, actionStampHeaders)` | Same filtering applied to a raw record object for a parent data card. Pure. |
| `isDisplayableHeader(header, parentResourceName)` | True when a column is meaningful for display (excludes `Code`, parent ref, `*Code`, audit, `By`/`At` stamps). Pure. |
| `filterDisplayableHeaders(headers, parentResourceName)` | Keep only displayable headers. Pure. |
| `filterDisplayableFields(fields, parentResourceName)` | Keep only displayable resolved field objects. Pure. |
| `resolveChildFields(childResourceConfig)` | Resolve a child's display fields (`ui.fields` first, else displayable headers). Pure. |
| `resolveChildEntryFields(childResourceConfig)` | Entry-form counterpart — keeps relation `Code` columns, drops only key/audit/parent. Pure. |
| `resolveChildTitle(childResourceConfig)` | Child display title from `ui.menus[0].pageTitle` else humanized name. Pure. |
| `findParentCodeField(childResource, parentResource)` | Locate the parent reference column (`ParentCode` or `<Parent>Code`). Pure. |
| `getHeaderIndexMap(headers)` | `header → index` map for row arrays. Pure. |
| `mapObjectsToRows(records, headers)` | Records → 2-D array of cell values by header order. Pure. |
| `mapRowsToObjects(rows, headers)` | 2-D array (or objects) → array of header-keyed objects. Pure. |
| `normalizeCursorValue(value)` | Coerce a sync cursor to epoch ms or `null`. Pure. |
| `resolveSyncRows(responseData, headers)` | Normalize a sync response (`rows`/`records`/`data`) to a row array. Pure. |
| `batchRef(path)` | Build a `$ref` object pointing at a value produced earlier in a batched GAS request. **Never stringified client-side.** Pure. |
| `isBatchRef(value)` | True when `value` is a `$ref` object. Pure. |
| `batchRefList(path, codes, separator)` | `$ref` joined to literal codes for a separated-list column; join done server-side. Pure. |
| `textOrRef(value)` | Pass `$ref` through untouched, else trim to string. Pure. |
| `normalizeCodeOrRef(value)` | Alias of `textOrRef`. Pure. |
| `defineSharedComposable(factory)` | Wrap a composable factory so its `computed()` graph is built once and shared (detached `effectScope`). **Not pure — runtime mechanism.** Use for ANY `use*` factory whose derived graph must not be duplicated per call site. |
| `binColumnClass(count)` | Quasar grid class for `count` side-by-side inputs (`col-12`/`col-6`/`col-4`). Pure. |

**When to reuse**: any string shaping, plural/singular, header filtering, row↔object mapping, or batch `$ref` building.
**When to extend**: add a new string/object transform or a new displayable-header rule here. Do not create a sibling `stringHelpers.js`.

---

## 2. Date & Time Operations
**File**: `FRONTENT/src/utils/dateHelpers.js`

All date math delegates to `date-fns`; only `parseAnyDate` is hand-rolled because AQL sheets store dates in two shapes (epoch ms in audit columns, ISO strings in business columns). Every helper accepts either shape. Pure.

| Function | Purpose |
|----------|---------|
| `parseAnyDate(value)` | Accept `Date`, epoch ms (number or string), `YYYY-MM-DD`, `YYYY-MM-DDTHH:mm[:ss]`, `YYYY-MM-DD HH:mm[:ss]` → local `Date` (literal calendar date, never UTC-shifted). `null` if unparseable. |
| `startOfDay(value)` | Local midnight of the value's day. |
| `endOfDay(value)` | Local `23:59:59.999` of the value's day. |
| `startOfMonth(value)` | Local midnight of first day of month. |
| `endOfMonth(value)` | Local `23:59:59.999` of last day of month. |
| `toDateOnly(value)` | `YYYY-MM-DD` (or `''`). |
| `toDateTime24(value)` | `YYYY-MM-DD HH:mm:ss` (24-hour) — byte-compatible with GAS `formatDateTime24`. Use for any client-resolved stamp. |
| `addDays(value, amount)` | New `Date` + N whole days. |
| `addMonths(value, amount)` | New `Date` + N whole months. |
| `dayOfYear(value)` | 1–366 (or `NaN`). |
| `isoWeek(value)` | ISO week 1–53 (or `NaN`). |
| `daysFromToday(value)` | Signed whole days from today (future positive, past negative). |

**When to reuse**: every date parse, format, or arithmetic need in the frontend.
**When to extend**: add new `date-fns`-backed helpers here. Never hand-roll another date parser — extend `parseAnyDate` if a new storage shape appears.

---

## 3. Colors & Visual Helpers
**File**: `FRONTENT/src/utils/colorHelpers.js`

Resolves loosely-typed color keywords to CSS values. Pure (with a palette cache; safe in browser only).

| Export | Purpose |
|--------|---------|
| `BRAND_COLORS` | `Set` of Quasar brand names (`primary`, `secondary`, … `dark`). |
| `resolveCssColor(color, fallback)` | Brand name → `var(--q-primary)` (themable); palette name (`red-10`) → resolved hex via Quasar; raw (`#…`, `rgb(…)`, `var(…)`) → as-is; unknown → `fallback`. |

**When to reuse**: any place that paints a color from config/metadata.
**When to extend**: add a new color family or alias here. Do not inline `colors.getPaletteColor` calls elsewhere.

---

## 4. Sorting & Token Evaluation

### 4a. Sorting
**File**: `FRONTENT/src/utils/sortHelpers.js`

| Function | Purpose |
|----------|---------|
| `sortByDate(items, column, direction)` | Sort rows by a date-ish column **without copying row objects** (preserves non-enumerable relation getters). `column` may be a key string or a reader function. Unparseable dates sink to the end. Pure. |

**When to reuse**: any list ordering by a date column.
**When to extend**: add resource-agnostic sorters here. Feature-specific sort logic that needs resource knowledge belongs in the resource's `_resource/` layer, not here.

### 4b. Dynamic Token Evaluation
**File**: `FRONTENT/src/utils/tokenEvaluator.js`

Generic token registry + condition evaluator. Shared by `APP.Resources.ListViews` filter trees and `AdditionalActions[].visibleWhen`. Two-sided coercion contract: every token declares `coerce` (column side) and `coerceToken` (token side). Pipelines are arrays of `COERCES` names so they stay serialisable.

| Export | Purpose |
|--------|---------|
| `COERCES` | Named coercion primitives (`text`, `trim`, `lowercase`, `slug`, `number`, `epoch`, `dateTime24`, `dateOnly`, `dayOfYear`, `month2`, `year`, `week`, `dayNum`). Composable left-to-right. |
| `TOKENS` | Token registry: date/time (`$now`, `$dateTime`, `$date:N`, `$day`, `$month:N`, `$year`, `$week`, `$startOfDay:N`, `$endOfDay:N`, `$startOfMonth:N`, `$endOfMonth:N`), relative days (`$daysAgo:N`, `$daysIn:N`), and current-user (`$userCode`, `$userEmail`, `$userName`, `$userDesignation`, `$userRole`, `$userRoles`, `$userRegion`, `$userRegions`). |
| `OPERATOR_ALIASES` | Legacy `ne`/`nin`/`notin`/`not_empty` folded onto canonical set. |
| `OPERATORS` | Canonical operator set (`eq`, `neq`, `in`, `not_in`, `gt`, `gte`, `lt`, `lte`, `contains`, `empty`, `notEmpty`). |
| `normalizeOperator(op)` | Canonicalise/alias an operator. Pure. |
| `applyCoerces(value, pipeline)` | Run a `COERCES` pipeline. Pure. |
| `parseToken(value)` | `$name` / `$name:p1:p2` → `{ spec, params }`, or `null`. Pure. |
| `isToken(value)` | True when `value` is a registered token. Pure. |
| `prepareCondition(condition, ctx, options)` | Compile one condition (token parse + coercion) once. `options.strictColumn` flips column-missing behaviour (list views strict, `visibleWhen` lenient). |
| `prepareFilter(filter, ctx, options)` | Compile a whole condition/group tree once. |
| `evaluatePreparedFilter(prepared, row)` | Evaluate a compiled tree against a row (no token parsing). |
| `evaluateFilter(filter, row, ctx, options)` | Convenience: prepare + evaluate for a single row. |
| `resolveTokenContext()` | Build `{ user }` from the auth store (safe when store absent). |
| `useTokenEvaluator()` | Composable: same API with the logged-in user pre-bound. |

**When to reuse**: any filter/token evaluation. The client half MUST stay in sync with `GAS/listViewsManager.html` and `GAS/actionTargets.gs` (see `list_view_tokens.md`).
**When to extend**: add a new token to `TOKENS` or a new coercion to `COERCES` here, and re-run the esbuild verification harness from `list_view_tokens.md`.
**Strict sync rule**: editing `TOKENS`/`COERCES` requires the matching GAS change and a verification pass.

---

## 5. Workflow & Audit Stamps
**File**: `FRONTENT/src/utils/workflowStamp.js`

| Function | Purpose |
|----------|---------|
| `stampFields(prefix, actorName, comment)` | The ONLY writer of a workflow stamp triple — returns `{ <prefix>At, <prefix>By, <prefix>Comment }` using `toDateTime24` (never ISO). Keeps GAS and client stamps identical. Pure. |

**When to reuse**: every workflow/action that records who/when/why.
**When to extend**: extend the stamp shape only here; do not write stamp columns by hand elsewhere.

---

## 6. Node & Payload Builders
**File**: `FRONTENT/src/composables/resources/nodePayloads.js`

Builds the request payloads the GAS dispatcher consumes. This is the single home for node-shape construction and header sanitization. Pure (returns plain payload objects).

| Function | Purpose |
|----------|---------|
| `resourceRow(resource, ...sources)` | Merge sources into one row-shaped object for `resource`. |
| `createNode(resource, record, reload, payload)` | Payload for a single create. |
| `updateNode(resource, code, record, reload, role)` | Payload for a single update by code. |
| `bulkNode(resource, records, reload)` | Payload for a bulk create/update. |
| `compositeNode({ resource, role, code, record, children, reload })` | Payload wrapping a parent + child operations in one request. |
| `derive(on, handler, options)` | Declare a derivation hook applied to a node. |
| `deriveNode(resource, entries, role)` | Payload for derived/computed child generation. |
| `reloadNode(resources)` | Payload requesting a reload of named resources after a batch. |
| `actionNode(resource, code, actionConfig, fields, { key, reload })` | Payload for an action/button-triggered write. |
| `isBodylessNode(payload)` | True when a node carries no body (e.g. pure reload). |
| `mergeNodePayloads(payloads)` | Combine several node payloads into one batched request. |

**When to reuse**: any code that constructs a create/update/bulk/composite/action request.
**When to extend**: add a new node variant here. Do not build raw payloads inline in components or `_ui/` composables — that bypasses header sanitization.

---

## 7. Notifications, PWA & Misc Helpers

### 7a. Push Notifications
**File**: `FRONTENT/src/utils/notifications.js`

| Function | Purpose |
|----------|---------|
| `requestNotificationPermission()` | Ask the browser for push permission; resolves boolean. Async, side-effecting. |
| `subscribeToPush(publicVapidKey)` | Subscribe the SW to push (idempotent — returns existing subscription). Async, side-effecting. |

**When to reuse**: any push-subscription flow.
**When to extend**: keep push logic here; do not duplicate VAPID handling.

### 7b. Placeholder Props
**File**: `FRONTENT/src/utils/placeholderProps.js`

| Function | Purpose |
|----------|---------|
| `resolvePlaceholderProps(props, identity, kind)` | Carve a targeted `Props*` block out of the flat `pageProps` bag (case-insensitive, function blocks evaluated live). Returns the merged block or `null`. Pure. |

**When to reuse**: any Section/Content/Action resolver splitting `pageProps` into per-placeholder props.
**When to extend**: extend only if a new placeholder family beyond Section/Content/Action is introduced.

### 7c. IndexedDB Compat
**File**: `FRONTENT/src/utils/idbCompat.js`

| Function | Purpose |
|----------|---------|
| `installIdbCompat(target)` | Shim legacy `IDBTransaction`→`IDBOperation` / `transaction()`→`operation()` naming. Idempotent. Runs once at module load. |

**When to reuse**: only when wrapping a legacy IDB layer that uses the old names.
**When to extend**: rarely. Add a compat shim here rather than patching call sites.

### 7d. PWA Utilities
**File**: `FRONTENT/src/utils/pwa-utils.js`

| Function | Purpose |
|----------|---------|
| `isStandalone()` | Detect installed/PWA standalone mode. |
| `setDeferredPrompt(e)` / `getDeferredPrompt()` / `clearDeferredPrompt()` | Hold the beforeinstallprompt event. |
| `presentInstallPrompt()` | Trigger the install prompt; resolves `'accepted'` / `'dismissed'` / `'not-available'`. |

**When to reuse**: any PWA install/standalone detection.
**When to extend**: add PWA helpers here.

---

## Extension Cheat-Sheet (where a new helper belongs)

| New capability | File to extend |
|----------------|---------------|
| String/object shaping, plural/singular, header filtering, row↔object map, `$ref` | `src/utils/appHelpers.js` |
| Date parse/format/arithmetic | `src/utils/dateHelpers.js` |
| Color resolution | `src/utils/colorHelpers.js` |
| Resource-agnostic sorting | `src/utils/sortHelpers.js` |
| List-view / action token or operator | `src/utils/tokenEvaluator.js` |
| Workflow/audit stamp column | `src/utils/workflowStamp.js` |
| Create/update/bulk/composite/action payload | `src/composables/resources/nodePayloads.js` |
| Push / PWA / placeholder props / IDB compat | the matching file in §7 |

If a capability spans a genuinely new domain with no home above, create a new file ONLY after confirming none of these cover it, and record the new file in this index and in `CORE_DOC_ROUTING.md`.
