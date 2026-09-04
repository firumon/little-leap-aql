# List Switcher — Sheet Integration

> Part of **[﻿# AQL Frontend List Switcher Architecture](UI_LIST_SWITCHER.md)**. `App.Resources.ListViews`: schema, filters and tokens.

---

## 5. Sheet Integration (`App.Resources.ListViews`)

The list view items and filtering are derived dynamically from the Google Sheets database configurations.

### 5.1. Sheet Config Relationship
* **Spreadsheet Setup**: Managed under the `ListViews` column of the `APP.Resources` sheet. See the [AQL Menu Admin Guide](file:///f:/LITTLE%20LEAP/AQL/Documents/SHEET_TOOLBAR_MENU_GUIDE.md#L201-L212).
* **JSON Array Structure**: The cell contains a JSON array of item objects:
  ```json
  [
    {
      "name": "Inactive",
      "default": true,
      "color": "positive",
      "icon": "check_circle",
      "filter": {
        "type": "group",
        "logic": "AND",
        "items": [
          { "type": "condition", "column": "Status", "operator": "eq", "value": "Inactive" }
        ]
      }
    }
  ]
  ```
* **Admin Dialog**: The `AQL 🚀 → Manage List Views` dialog ([`GAS/listViewsManager.html`](file:///f:/LITTLE%20LEAP/AQL/GAS/listViewsManager.html)) writes this JSON. Its **Chip Color** field is a free-text input backed by a `colorSuggestions` datalist — pick a brand/palette suggestion or type any Quasar palette name or Hex code. A live swatch previews brand names and raw CSS colors; palette names (`red-10`) show a neutral swatch because they can only be resolved by the frontend at runtime. See [Section 4.4](#44-dynamic-color-resolution) for accepted formats.

### 5.1.1. Filter JSON Schema Reference
The `filter` property does not support a raw array at its root. It must be either a **Group Object** or a **Condition Object**:

#### A. Group Object (`type: "group"`)
Used to join multiple conditions with logical operators:
- `type`: Must be `"group"`.
- `logic`: Either `"AND"` or `"OR"` (defaults to `"AND"`).
- `items`: An array of filter objects (can recursively contain other groups or conditions).

#### B. Condition Object (`type: "condition"`)
Represents a single query comparison:
- `type`: Must be `"condition"`.
- `column`: String matching the exact Google Sheet header column name.
- `operator`: String operator mapping to comparison logic.
- `value`: The target comparison value. Can be a string, number, array (for `in`/`not_in`), or a **dynamic token** such as `"$startOfMonth"`, `"$daysIn:7"` or `"$userRoles"` — see [Section 5.2](#52-dynamic-tokens-date-time--current-user).

#### C. Supported Comparison Operators
The frontend evaluator supports the following operator keys:
- `eq`: Equal to (case-insensitive string comparison or numeric comparison).
- `neq`: Not equal to.
- `in`: Checks if the column value is inside a list of values (e.g. `"value": ["Active", "Draft"]`).
- `not_in`: Checks if the column value is NOT inside a list of values.
- `gt`: Greater than (coerces column and value to numbers).
- `gte`: Greater than or equal to.
- `lt`: Less than.
- `lte`: Less than or equal to.
- `contains`: Checks if the column value contains the search string (substring match).

For source code implementation, see `evaluateFilter` in [useListViews.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/useListViews.js).

---

### 5.2. Dynamic Tokens (Date/Time & Current User)

A condition `value` may be a **token string** instead of a literal. Tokens resolve at evaluation
time against the clock and the logged-in user, so one sheet-authored view stays correct as the
date rolls over or a different user signs in.

Registry: [`src/utils/tokenEvaluator.js`](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/utils/tokenEvaluator.js).
Token names are **case-insensitive** (`$startofmonth` works). In the **Manage Lists** admin
dialog they appear in the grouped `Token...` dropdown next to each condition's value input.

The same registry backs an action's `visibleWhen` (**Manage Actions** → *Visible When*), which is
evaluated by the same module — so `Date` / `lte` / `$startOfDay:0` hides an action on
future-dated records and `OwnerCode` / `eq` / `$userCode` shows one only to its owner.

#### 5.2.1. Two-Sided Coercion

A token can only be compared against a sheet column when both sides sit in the same space. AQL
sheets store dates in two shapes — audit columns (`CreatedAt`/`UpdatedAt`) hold **epoch
milliseconds**, business date columns (`Date`, `DueDate`, `VisitDate`) hold **ISO strings**,
sometimes with a time component.

Each token therefore declares two pipelines of named primitives from `COERCES`:

| Field | Applies to | Default |
| :--- | :--- | :--- |
| `coerce` | the **column** value | — (required) |
| `coerceToken` | the **resolved token** value | falls back to `coerce` |

Most tokens are symmetric, so `coerce` alone covers both sides. The relative-day tokens are
deliberately asymmetric: the column is converted to *signed days from today* while the token
stays a plain number.

Because both pipelines run, **the same token works against either storage format** —
`gte $startOfMonth` behaves identically on `CreatedAt` (epoch ms) and `VisitDate` (ISO string).
A column value that cannot be parsed into the comparison space (blank, malformed) never matches,
including under `neq` / `not_in`.

> [!NOTE]
> **Calendar dates are read literally.** A trailing `Z` on a column value does not shift the day —
> `2026-08-02T20:00:00.000Z` buckets as 2 Aug regardless of the viewer's timezone. This matches
> the long-standing `.slice(0, 10)` behaviour in `useOutletVisits` and keeps day buckets stable
> across regions. Date arithmetic itself is delegated to `date-fns`; only the parse/dispatch step
> in [`dateHelpers.js`](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/utils/dateHelpers.js) is AQL-specific.

#### 5.2.2. Date & Time Tokens

| Token | Resolves to | Column is compared as |
| :--- | :--- | :--- |
| `$now` | Current timestamp (13-digit ms) | epoch ms |
| `$dateTime` | Current instant as `YYYY-MM-DD HH:mm:ss` (24-hour) — the shape GAS stamps into `...At` / `RespondDate`. Takes **no** `:N` offset | `YYYY-MM-DD HH:mm:ss` |
| `$date[:N]` | Today as `YYYY-MM-DD` (or N-day offset: `$date:0` = today, `$date:1` = tomorrow, `$date:-1` = yesterday) | `YYYY-MM-DD` |
| `$day` | Day of year, `1`-`366` | day of year |
| `$month[:N]` | Current month as `"01"`-`"12"` (or N-month offset: `$month:0` = current, `$month:1` = next month, `$month:-1` = previous month) | zero-padded month |
| `$year` | Current year, `YYYY` | year |
| `$week` | Current ISO week, `1`-`53` | ISO week |
| `$startOfDay[:N]` | Day 00:00:00.000 ms with N-day offset (default N=0 for today) | epoch ms |
| `$endOfDay[:N]` | Day 23:59:59.999 ms with N-day offset (default N=0 for today) | epoch ms |
| `$startOfMonth[:N]` | 1st of month 00:00:00.000 ms with N-month offset (default N=0 for this month) | epoch ms |
| `$endOfMonth[:N]` | Last of month 23:59:59.999 ms with N-month offset (default N=0 for this month) | epoch ms |

> ISO weeks run 1-53, not 1-52 — week 53 exists in years whose first Thursday falls late
> (e.g. 2026-12-31 is week 53).

> [!NOTE]
> **`$dateTime` is a full instant, so `eq` against it effectively never matches** — the
> seconds have already moved on. The useful comparisons are the ordered ones, which work
> because the format sorts lexicographically: `lt $dateTime` means "already in the past".
> For day-granularity buckets use `$date:N` or `$daysIn:N` instead. Its real job is the
> **action expression** grammar — seeding a `...At` column from an `AdditionalActions`
> target (§7.4 of `UI_ACTION_SYSTEM.md`), where `$now`'s epoch ms would land an
> unreadable number in a cell a human reads.
>
> Its coercion pipeline is **string-valued**, so it follows the `$date` family rather than
> the epoch family on a blank or unparseable column: the NaN guard does not fire, the
> column reads as `''`, and `lt`/`neq` therefore still match those rows. This is
> deliberate consistency with `$date` / `$month`, not an oversight — see invariant 4 in
> [list_view_tokens.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/list_view_tokens.md).
> Pair it with a `notEmpty` condition when blanks must be excluded.

#### 5.2.3. Relative-Day Tokens (Parameterised)

| Token | Resolves to |
| :--- | :--- |
| `$daysAgo:N` | `-N` (past) |
| `$daysIn:N` | `+N` (future) |

The column is converted to **signed whole days from today** — future positive, past negative,
today `0`. Both are floored to local midnight, so a time component on the column is ignored.

> [!WARNING]
> **Rolling windows need both edges.** A single `lte $daysIn:7` also matches every overdue
> record, because an invoice due 90 days ago has an offset of `-90` and `-90 <= 7`. Always pair
> the bounds:
> ```json
> { "type": "group", "logic": "AND", "items": [
>   { "type": "condition", "column": "DueDate", "operator": "gte", "value": "$daysIn:0" },
>   { "type": "condition", "column": "DueDate", "operator": "lte", "value": "$daysIn:7" }
> ]}
> ```

Common single-sided patterns that are correct as-is:

| Intent | Condition |
| :--- | :--- |
| Overdue | `DueDate` `lt` `$daysIn:0` |
| Due today | `DueDate` `eq` `$daysIn:0` |
| Aged 30+ days | `DueDate` `lt` `$daysAgo:30` |

#### 5.2.3a. Relative-Hour Tokens (Parameterised)

| Token | Resolves to |
| :--- | :--- |
| `$hoursAgo:N` | `-N` (past) |
| `$hoursIn:N` | `+N` (future) |

The column is converted to **signed whole hours from now** — future positive, past negative,
truncated toward zero (90 minutes ago reads as `-1`). Unlike the day family the column is **not**
floored to local midnight, so its time component is what makes the comparison. Use these only for
sub-day windows; anything measured in days belongs to `$daysAgo` / `$daysIn`, which are stable
across a clock that keeps moving.

Because the column keeps its time part, these are the right tokens for the datetime stamps GAS
writes — `RespondDate`, `ProgressCompletedAt` and the rest of the `...At` family — and they work
equally on an epoch-ms audit column.

> [!WARNING]
> **Rolling windows need both edges here too.** `gte $hoursAgo:48` alone also matches anything
> dated in the future, whose offset is positive. Pair the bounds:
> ```json
> { "type": "group", "logic": "AND", "items": [
>   { "type": "condition", "column": "RespondDate", "operator": "gte", "value": "$hoursAgo:48" },
>   { "type": "condition", "column": "RespondDate", "operator": "lte", "value": "$hoursIn:0" }
> ]}
> ```

> [!NOTE]
> Like every date token, these resolve when the view recomputes rather than on a timer — a
> session left open for hours keeps the window it was built with until reload.

#### 5.2.4. Current-User Tokens

| Token | Resolves to |
| :--- | :--- |
| `$userCode` | `user.code ?? user.id` (GAS maps `UserID` → `id`) |
| `$userEmail` | `user.email` |
| `$userName` | `user.name` |
| `$userDesignation` | `user.designation.name` |
| `$userRole` | `user.role` (primary role) |
| `$userRoles` | **Array** of all role names |
| `$userRegion` | `user.accessRegion.code` |
| `$userRegions` | **Array** of `user.accessRegion.accessibleCodes` |

All are compared case-insensitively and trimmed. Array-valued tokens are intended for the
`in` / `not_in` operators, where each element is matched individually:

```json
{ "type": "condition", "column": "Role", "operator": "in", "value": "$userRoles" }
```

A literal list may mix tokens and plain values — `["Viewer", "$userRoles"]` flattens to
`["viewer", "auditor", "approver"]`.

#### 5.2.5. Worked Example — "My Open Visits This Week"

```json
{
  "name": "My Week",
  "color": "primary",
  "filter": {
    "type": "group",
    "logic": "AND",
    "items": [
      { "type": "condition", "column": "AssignedTo", "operator": "eq",  "value": "$userCode" },
      { "type": "condition", "column": "Progress",   "operator": "in",  "value": ["PLANNED", "IN_PROGRESS"] },
      { "type": "condition", "column": "VisitDate",  "operator": "gte", "value": "$daysIn:0" },
      { "type": "condition", "column": "VisitDate",  "operator": "lte", "value": "$daysIn:7" }
    ]
  }
}
```

#### 5.2.6. Adding a Token

1. Add the entry to `TOKENS` in [`tokenEvaluator.js`](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/utils/tokenEvaluator.js), with `value(params, ctx)` as a plain extractor plus its `coerce` / `coerceToken` pipelines. Add a new primitive to `COERCES` only if no composition of the existing ones fits.
2. Mirror it in the `TOKENS` array in [`GAS/listViewsManager.html`](file:///f:/LITTLE%20LEAP/AQL/GAS/listViewsManager.html) so admins can pick it from the dropdown. Parameterised tokens set `param` to the seeded default.
3. Document it in the tables above.

Pipeline names are validated at module load — an unknown `COERCES` key throws immediately
rather than silently producing an empty tab.

#### 5.2.7. Runtime Notes

- **Filters are compiled once per pass.** `prepareFilter(filter, ctx)` walks the tree once and resolves every token (`spec.value` + the `coerceToken` pipeline) plus the normalised forms of literal values into a prepared node; `evaluatePreparedFilter(prepared, row)` then runs per row and does no token parsing at all. `viewCounts` / `viewFilteredItems` use this pair, so token cost is O(conditions) rather than O(conditions × rows). `evaluateFilter(filter, row, ctx)` remains as the single-row entry point and simply prepares-then-evaluates.
- **Date tokens resolve when the view recomputes**, not on a timer. `viewCounts` / `viewFilteredItems` re-run when the records or the view set change, which covers normal navigation and refresh. A session left open across local midnight keeps the previous day's buckets until the next reload or data refresh. All rows in one pass therefore see the *same* token values — a pass can no longer straddle a midnight rollover.
- **Filtering is client-side.** Tokens evaluate against the rows already loaded, so counts reflect the fetched set, not the whole sheet.
- **Non-token conditions are unchanged** — literals still use the original numeric-then-string coercion.

---

### 5.3. Conditional Overriding Criteria
The views switcher respects sheet-driven constraints explicitly inside the base views switcher. Whether custom JS modifiers (`ListSwitcher.js` / `ViewSwitcher.js`) or Vue overrides (`ListSwitcher.vue` / `ViewSwitcher.vue`) are applied depends on the exact value of the `ListViews` cell:

1. **Empty String (Blank Cell)**: 
   - **Behavior**: Custom UI JS modifiers and Vue overrides are **ALLOWED**. 
   - **Details**: The resource defaults to the standard Active/Inactive fallback tab views, and the section resolver is permitted to merge JS modifier props and resolve custom templates.
2. **`[]` (Explicit Switch-Off Array)**: 
   - **Behavior**: Custom UI JS modifiers and Vue overrides are **DISABLED / IGNORED**. 
   - **Details**: The resource has explicitly turned off list views. The views switcher is completely hidden/ignored.
3. **JSON Array with Values (Custom Views, e.g. `[{"name": "Paid"}, ...])`**: 
   - **Behavior**: Custom UI JS modifiers and Vue overrides are **DISABLED / IGNORED**. 
   - **Details**: The list views are fully configured via sheet filters. Custom UI templates and JS modifiers are bypassed to enforce standard sheet-driven tabs.

This conditional bypass logic is implemented inside [ViewSwitcher.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/sections/ViewSwitcher.vue) by evaluating the `isOverrideAllowed` computed property.


---

⬑ Back to **[﻿# AQL Frontend List Switcher Architecture](UI_LIST_SWITCHER.md)**.
