# Dashboard Engine — Data Layer, Items, Empty Rule & Math

> Canonical guide for dashboard data: Domain Data composables (DJS), Item Descriptors (DBI), the empty rule, Controls, and stateless math (useDataContext).

---

## §6 — Domain Data Layer (DJS: `_resource/.../Data/`)

Domain data composables live in `FRONTENT/src/_resource/<Scope>/<Resource>/Data/use<Topic>Data.js`.

### Composable signature

A DJS exports a **default composable function**:

```javascript
export default function use<Topic>Data() {
  const { rows, indexOf, isLoading, remember } = useRecord()
  const { countAt, topN, daysSince } = useDataContext()

  return remember('use<Topic>Data', () => {
    const loading = computed(() => isLoading('<Resource>') && rows('<Resource>').length === 0)
    // facts, counts, series, controls...
    return {
      loading,
      openCount,
      // ...
    }
  })
}
```

- **Topic-specific and atomic**: DJS knows nothing about dashboards or widgets. It prepares data about one domain subject.
- **Singleton cached**: Uses `useRecord().remember('use<Topic>Data', () => { ... })`.
- **Never import a store**. Rows come from `useRecord()`, the user from `useAuth()`, and pure math from `useDataContext()`.
- **Expose control refs and base counts**: Control refs (e.g. `groupBy`, `range`) are exposed directly so DBIs can format titles/captions. Base counts unaffected by controls are exposed alongside filtered items.

---

## §6.1 — Dashboard Item Descriptors (DBI: `_resource/.../Dashboard/`)

A DBI file lives at `FRONTENT/src/_resource/<Scope>/<Resource>/Dashboard/<name>.js`. The file name **is** the tile's name in the sheet.

### DBI signature

```javascript
/**
 * Short description — what this tile is for.
 *
 * Answers: The question it answers on the dashboard?
 *
 * Uses:
 *   - use<Topic>Data: key1, key2, loading
 *
 * Controls: controlName (or none)
 */

import { computed } from 'vue'
import useLeadPipelineData from '../Data/useLeadPipelineData'

export default (props) => {
  const d = useLeadPipelineData()

  return {
    widget: 'HorizontalRankBar',
    size: { xs: [12], sm: [12], md: [6, 8, 12], lg: [4, 6, 8], xl: [4, 6] },
    permission: { Leads: 'Read' },
    title: 'Leads by place',
    controls: d.controls.filter((c) => ['groupBy'].includes(c.name)),
    data: computed(() => ({
      items: d.leadsByPlace.value,
      caption: `Open leads by ${d.groupBy.value}`,
      empty: d.openCount.value === 0,
      loading: d.loading.value
    }))
  }
}
```

### Static keys vs `data`

- **What `props` is**: a copy of the sheet item's `widgetProps`. The DBI runs ONCE per `resource::name` and the result is cached (`dbiCallCache` in `useDashboardResolver.js`). A later sheet change does not re-run it until the page reloads.
- **Static keys**: `widget`, `size`, `permission`, `widgetProps`, `users`, `auth`, `multiplier`, and static `title`/`subtitle`/`caption`. Plain values only.
- **`data`**: A single `computed` returning an object of plain unwrapped values (`.value` inside). A key exists either as a static key or in `data`, never both.
- **No `name`, no `source`**: The file name is the name, and the DBI imports its DJS directly.
- **`controls`**: Array of control objects picked from the DJS's `controls`. Pass the exact objects without cloning.

### The `empty` rule (crucial design invariant)

> **An item's `empty` is decided by its records only — what `useRecord` holds for it.**

A control never changes the records; it only changes how the item looks at them. An item's `empty` computed must **never read a control's ref**.

**Why**: If a tile hides after a user changes a control filter, it takes its own controls with it. The user has no way to change the control back. `empty` answers "does this item have anything to say?", which is a fact about the underlying data, not the user's current view. Keeping a single data-backed source for `empty` ensures there is one clear place to reason about when a tile disappears.

- **Single number tiles** (`MetricPlain`): zero gives `empty: true` (e.g. `value === 0`). It stays a valid answer and still shows by default unless the ARD sets `hideOnEmpty: true`.
- **Number + compare tiles** (`MetricDelta`, `MetricDeltaInverse`): `empty: true` only when BOTH `value` and `compare` are 0 (e.g. `value === 0 && compare === 0`). A tile with 0 now and 5 last month has something to say.
- **Delay tiles** (`respondDelay`): values are delays, not counts. `empty: true` when there are no responses to measure in either month (e.g. `thisMonthResponseCount === 0 && lastMonthResponseCount === 0`).
- **Bucket, bar and line tiles** (`ColumnBar`, `DebtAgeing`, `DailySalesLine`, `StaffVisitsLine`): `empty: true` when every bucket or point is 0 (e.g. `!items.some(b => b.value > 0)` or `!points.some(p => p.y > 0)`), not only when the list has no length.
- **Uncontrolled lists** (`wakeUpDue`, `recentApprovals`, `staleProcessing`): `empty: list.length === 0`.
- **Control-driven tiles** (`leadsByPlace`, `followUpMix`): `empty` checks the base count (e.g. `openCount === 0`, `totalFollowUpsCount === 0`), never the control-filtered items.

- **Never import a store**. Rows come from `useRecord()`, the user from `useAuth()` (`FRONTENT/src/composables/core/useAuth.js`), and pure math from `useDataContext()`.
- **Grouping with `indexOf`**: When grouping a whole table by one column, use `useRecord().indexOf(resource, header)` rather than scanning all rows with `countBy`. It reads a cached `Map` of value → rows built once and shared app-wide.
- **Spread order**: `{ ...props, title }` means the item wins; `{ title, ...props }` means the sheet wins. Item-wins is standard.
- **Controls**: A DJS creates its own `ref` for each control, and exports descriptors using `dataControl(name, { type, options, value })`. The item computes its values reading that `ref`.
- **Why every live value is a computed, not a getter**: a spread copies a computed's wrapper box, which stays reactive. A spread runs a getter and copies a frozen, dead answer.

### The return rule

> **Name a const: good. Return it: only if something reads it.**

`title`, `subtitle` and `caption` inside `data` go to the card. `Tile.vue` takes them out of `data`. Order: `data` wins, then the sheet, then the DBI static value. `Tile.vue` also copies each non-empty one into `widgetProps`, so a widget that reads them gets the same text. A key set in `widgetProps` itself wins over that copy.

Only return keys that the widget reads (e.g. `value`, `items`, `series`, `points`, `max`, `compare`) or frame keys (`title`, `subtitle`, `caption`, `controls`, `options`). Do not leak internal intermediate computeds.

### The JSDoc block is required

Every item factory file must begin with a JSDoc block explaining its purpose:

```javascript
/**
 * Short description — what this item does in one line.
 *
 * Answers: The question it answers on the dashboard?
 *
 * How the calculation works, rules used, and edge cases.
 *
 * Reads    Resource: Field1, Field2
 * Returns  props, title, caption, value
 * Controls none
 * Empty    value is 0
 */
```

Never delete or shorten this block.

---

## §6.5 — Dashboard Controls (`useDataControls`)

Dashboard controls let a user change what a tile shows without re-fetching or reloading the page.

### The rule

- **The item owns the ref.** The item factory creates a `ref(defaultValue)`. It reads that ref in its own `computed()`.
- **Options live on the control.** The control descriptor holds `{ label, value }` options.
- **Descriptor helper**: `dataControl(name, { type, options, value, ...rest })` helper in `FRONTENT/src/composables/data/useDataControls.js`.
  - Normalizes options: strings become `{ label: str, value: str }`.
  - Default `type` is `'menu'`.
  - Holds the ref inside `value`.

### Consuming controls: `useDataControls(controls)`

The frame or wrapper consumes the controls using `useDataControls(controls)`:

1. **`ctl`**: An object whose keys match control names. Each `ctl[name].value` is a writable computed. Reading it opens the ref. Writing to it updates the item's ref.
2. **`Controls`**: A Vue component that renders all controls in a wrapping row with small gaps (`row items-center q-gutter-xs wrap`) so they wrap cleanly on phones.
3. **Type mapping**:
   - `select` → `select` field (rendered compact inside `Controls` by passing extra `config`: `dense: true, optionsDense: true, borderless: true` without altering `_fields/select`)
   - `plain` → `plainselect` field (uses Quasar `q-btn-toggle`, flat dense no-caps)
   - `menu` → `menuselect` field (uses Quasar `q-btn-dropdown`, flat dense no-caps)
   - `chip` → `chipselect` field (uses Quasar `q-chip` with `q-gutter-xs`)
   - Unknown types fall back to `menuselect`.

---

## §7 — useDataContext

`FRONTENT/src/composables/data/useDataContext.js` provides **stateless, pure mathematics helpers**. It has no stores and holds no state.

### Helpers take lists, never resource names

Every helper takes a raw array of records or values:
- `countBy(list, field)`: Counts occurrences of values in `field`.
- `sumBy(list, field, valueField)`: Sums `valueField` grouped by `field`.
- `topN(map, n, labelFn)`: Returns top n items from a map.
- `mean(numbers)`: Average of an array of numbers.
- `countAt(list, range, predicate, dateField = 'Date')`: Counts rows matching range and predicate.
- `daysAgo(n)`: Start of day n days ago in milliseconds.
- `daysSince(value)`: Days between date and now.
- `hoursBetween(from, to)`: Hours between two timestamps.
- `inRange(value, range)`: Boolean test for date tokens (`$today`, `$thisMonth`, `$lastMonth`, `$last7Days`, `$last30Days`, `$last90Days`) or `[from, to]` bounds.
- `resolveRange(range)`: Normalizes a token or pair into `[from, to]` millisecond timestamps.
- `rangeLabel(range)`: Clean human label for a range.
- `progressOptions(list)`: Unique progress options from a list.

**Shared range tokens**: The date range words (`$today`, `$thisMonth`, `$lastMonth`, `$last7Days`, `$last30Days`, `$last90Days`) are shared with `src/utils/tokenEvaluator.js` and must remain byte-identical so a dashboard tile and a list filter never disagree.
