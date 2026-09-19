# Dashboard Engine — Pipeline, Scoring, Layout & Motion

> Canonical guide for the dashboard engine flow: resolver, scoring, size cascade, row packing, and motion.

---

## §1 — The shape in one picture

The dashboard pipeline flows through four distinct steps:

```
1. Sheet ARD item  ──>  2. useDashboardResolver  ──>  3. useDashboardLayout  ──>  4. Dashboard.vue
   (look + gates)          (filters, scores, sorts)      (tile state & grid pack)    (page view)
```

Here is what each step does:

- **1. ARD**: The sheet cell declares items, visual look, permissions, multiplier, and allowed width array per breakpoint.
- **2. useDashboardResolver**: Reads all resource ARD lists. Drops inactive, unpermitted, multiplier-0, or zero-span items. Scores survivors using the bag-and-share formula and sorts them descending by score.
- **3. useDashboardLayout**: Packs items into 12-column rows using allowed-width preferences and handles width 0 on empty.
- **4. Dashboard.vue**: Renders the responsive dashboard grid as a Quasar `row` (`items-stretch`). Widths come from `col` / `columns` so every tile in a row is the same height, and the grid uses `gap`, `gridClass` and `pageClass` from `dashboard.js`. There is no masonry: masonry would break the DBC's packed rows and score order.

### Why resolver and engine are separate

The resolver changes when the sheet or the user changes (sheet edits, login permissions, cutoff). The engine changes whenever a tile flips its `empty` flag. Keeping them separate means a tile flipping `empty` only re-runs the fast row packing, never the filter, score, and sort steps.

---

## §2 — ARD, the Dashboard column & Resolver Row Shape

### Where it lives and how it travels

1. It lives in the Google Sheet named `App.Resources`. Each resource has one row. The column is named `Dashboard`.
2. The column is created in [setupAppSheets.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/setupAppSheets.gs).
3. The server reads the cell and turns it into JSON in [resourceRegistry.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/resourceRegistry.gs).
4. It arrives in the app inside metadata as `cfg.ui.dashboard`.

For the complete key ownership table and detailed ARD JSON keys, see [FEATURE_DASHBOARD_ENGINE_CUSTOMIZATION.md](FEATURE_DASHBOARD_ENGINE_CUSTOMIZATION.md).

### The resolver row shape

`useDashboardResolver` builds one row per surviving item:
```javascript
row = {
  key, resource, scope, custom, hideOnEmpty,
  props: { name, widget, size, multiplier, title, subtitle, caption, widgetProps, source? },
  data, controls,
  resourceLoading,
  score: { raw, bag, position, share, mult, auth, users, n, value },
  span
}
```
- `props`: all static keys merged (sheet over DBI).
- `props.widgetProps`: DBI `widgetProps` and sheet `widgetProps` shallow-merged with sheet winning.
- `resourceLoading`: a live `computed` ref, true while that resource has no rows yet (`isLoading(resource) && rows(resource).length === 0`), cached once per resource.
- `score`: full score breakdown; final score is `score.value` used for cutoff and sorting.

### Custom tiles (sheet row without matching DBI)

If a sheet item has no matching DBI file in `_resource/<Scope>/<Resource>/Dashboard/`:
- Treated as a custom tile (`custom: true`).
- `data: null`, `controls: []`.
- `permission` is not checked — everyone sees it.
- Never hides on empty (`empty: false`).
- Multiplier is capped at `3` (instead of `2`).
- Raw score equals scope weight only (no verb weight, no auth/users bonus).
- In scoring: `bag = raw`, `share = 1`, while `position` counts all survivors (normal + custom) of the resource.

### Array order in the sheet cell

The order of items inside a resource's `Dashboard` array is that resource's **internal ranking**:
- Item 0 is the most important item for that resource and gets the top position weight (1.9).
- The last item gets the bottom position weight (0.1).
- Adding a new item to a resource increases n, shrinking the share for all items in that resource.
- **Order the cell on purpose**: put what needs action now first, how things stand next, and history/trends last.

---

## §3 — Scoring, bag, position, share, and sort

Every surviving tile gets an absolute score computed by `useDashboardResolver.js` using `useDashboardScore.js`.

### The formula

```
score = bag(resource) × position(i, n) × share(n) × multiplier(item)
```

### 1. raw(item)

The item's baseline intrinsic value based on permissions and scope:

```
raw = permission weight × scope weight + user bonus
```

- **Scope weights**: `master` = 1.0, `operation` = 2.0, `accounts` = 2.5.
- **Verb weights**: `true` = 1.0, `Read` = 1.5, `Delete` = 1.5, `Update` = 2.0, `Create` = 3.0, `Write` = 3.0, any other action = 2.5. A prefix of `can` is stripped first. The maximum verb weight is used when multiple verbs are specified.
- **Child tables**: A child table (with `parentResource`) that is NOT the item's owner skips the scope/verb table and contributes a flat **0.75**. When the child table IS the owner (the item lives in its own `Dashboard/` folder), it is scored by its scope and verb like any other table.
- **User bonuses**: `auth: true` adds **+3.0**. `users: true` adds **+5.0**.
- Note: `multiplier` is NOT part of `raw`.

Inside one resource, nothing about an individual item lifts it past its neighbours: its `raw` value only feeds the shared resource bag.

### 2. bag(resource)

Each resource gets one bag of points, which is the **mean of raw scores** across all surviving items of that resource:

```
bag = (sum of raw scores of surviving items in resource) / n
```

Where n is the count of surviving items for that resource.

**Why bag is the mean, not the highest**: using the highest would let one strong item (like a tile with `users: true`) lift all its neighbours and unfairly shove the entire resource up the page.

### 3. position(i, n)

The item's position inside its resource's surviving items:

```
position(i, n) = 1.9 - 1.8 × (i / (n - 1))
```

If n = 1, `position` is flat **1.9**.
- i = 0 (first item) receives weight **1.9**.
- i = n - 1 (last item) receives weight **0.1**.
- Intermediate items scale linearly between 1.9 and 0.1.

### 4. share(n)

Fair share scaling across resources:

```
share(n) = 1 / √n
```

**Why share is 1/√n, not 1/n**: using 1/n buries any resource with many items, no matter how important it is. 1/√n gives fatter slices to resources with few items while still letting larger resources compete fairly.

### 5. multiplier(item)

A fine-tuning knob defined on the sheet item:
- Clamped between `0` and `2` (up to `3` for custom tiles).
- `multiplier: 0` drops the item before bag calculation.

### Count first, cut last

The execution sequence is fixed:
1. Filter on everything that needs no score (name/source, widget, active, activeExcept, multiplier !== 0, permission, span !== 0).
2. Per resource: count surviving items n and calculate bag.
3. Score every survivor using the formula.
4. **Then** drop any tile whose score falls below `auth.dashboardScoreCutoff` (if cutoff > 0).
5. **Then** sort tiles descending by score.

**The cutoff never changes anyone's share**: counting survivors before cutting ensures a cutoff removes cards without altering the score or rank of remaining tiles.

### Worked example

Assume a resource has 4 surviving items (n = 4), with raw values `[3.0, 3.0, 3.75, 3.0]`, all with default `multiplier: 1`:
- bag = (3.0 + 3.0 + 3.75 + 3.0) / 4 = 12.75 / 4 = 3.1875 ≈ 3.19.
- share = 1 / √4 = 0.5.
- Item 0 (i = 0): position = 1.90. Score = 3.1875 × 1.90 × 0.5 × 1 ≈ 3.03.
- Item 1 (i = 1): position = 1.30. Score = 3.1875 × 1.30 × 0.5 × 1 ≈ 2.07.
- Item 2 (i = 2): position = 0.70. Score = 3.1875 × 0.70 × 0.5 × 1 ≈ 1.12.
- Item 3 (i = 3): position = 0.10. Score = 3.1875 × 0.10 × 0.5 × 1 ≈ 0.16.

The `3.75` item lists its parent and one child: `{ OutletRestocks: 'Read', OutletRestockItems: true }` = 1.5 × 2 + 0.75.

The same child scores differently when it owns the item:

| Item lives in | `permission` | raw |
|---|---|---|
| `OutletRestocks/Dashboard/` | `{ OutletRestockItems: true }` | 0.75 (child, only listed) |
| `OutletRestockItems/Dashboard/` | `{ OutletRestockItems: true }` | 1 × 2 = 2 (child is the owner, `operation` scope) |
| `OutletRestockItems/Dashboard/` | `{ OutletRestockItems: 'Read', SKUs: true }` | 1.5 × 2 + 0.75 = 3.75 (`SKUs` is a child of `Products`, only listed) |

The scores interleave naturally with items from other resources.

---

## §4 — Allowed widths and size cascade

The `size` property on a sheet item defines width preferences per screen breakpoint (`xs`, `sm`, `md`, `lg`, `xl`).

### Cascade and preference order

- The **first** value in a `size` list is the tile's **default** width.
- The next ones are what the tile may also be, in order of preference; the last is the last resort. For example, `[6, 3, 4]` means "try 6 first, then 3, then 4". It is never sorted.
- Single number: `size: { xs: 12, md: 6 }` is coerced to `[12]` on `xs` and `[6]` on `md`.
- Invalid values and duplicates are dropped (keeping the first copy). Allowed values are integers between 1 and `columns` (defined in `pages/Dashboard/dashboard.js`, defaulting to 12). Missing defaults to `[columns]`.
- The largest named key at or below the screen breakpoint wins and cascades upward.

---

## §5 — Tile state and packing grid (`useDashboardLayout`)

Tile packing and state management live in `FRONTENT/src/composables/dashboard/useDashboardLayout.js`.
The layout composable takes `(items, columns = 12)` where `columns` comes from `dashboardProps.columns` in `dashboard.js`.
It returns two computed structures: `col` (width per tile key) **and** `order` (array of tile keys in packed visual order).

### Tile state, controls min span, and empty detection

Every tile's state is read directly from its live `data` computed ref:
1. **`loading`**: `row.data?.value?.loading === true`. True while the tile's data is loading. Loading never hides a tile.
2. **`empty`**: `row.data?.value?.empty === true` (when not loading).
3. If `row.hideOnEmpty` is true and `empty` is true, the layout assigns width 0 to the tile. If `loading` is true, it is never hidden. Custom tiles never hide.
4. **`controlsMinSpan`**: Configured in `dashboard.js` (default `6`). When a tile has `controls.length > 0`, the layout drops every allowed width below `controlsMinSpan`. If that leaves no allowed width, it uses `controlsMinSpan` itself (capped at `columns`). This guarantees tiles with controls have enough room on phones and tablets.

### The two-pass packing algorithm (`packDashboardRows`)

Visible tiles are walked in score order (descending). A row must never exceed `columns` (default 12).

#### Pass 1 — Place tiles

Try every open row from the top. For a given row, check in this exact order:
1. **Tile at default fits**: The tile at its default width (first in list) fits remaining space → place it.
2. **Tile at alternate fits**: Any of the tile's other allowed sizes (in list order) fits remaining space → place it.
3. **Resize one existing tile**: Take the first tile in the row and test its other allowed sizes (in list order). After each change, check if the new tile fits at its default or any of its sizes. If yes, keep that change and place the new tile. If no, test the next size, then move to the second tile in the row, and so on. Only one existing tile is resized at a time.
4. **Row rollback**: If nothing fits, roll the row back to its exact state before the attempt, and try the next open row.

If no open row can take the tile, open a new row with the tile at its default width.
A later tile with lower score may fit into an earlier row above a higher-scored tile.

#### Pass 2 — Fill gaps

For each row whose total width is under `columns`:
1. **Reset to default**: Try putting each tile back to its default width, one tile at a time from first to last. If the row becomes exactly `columns`, keep the change and stop. Otherwise revert and try the next tile.
2. **Keep gains backwards (best fit)**: Walk the tiles from the last to the first. For each tile, look at its other sizes and pick the one that brings the row total closest to full without going over. Take it only if it makes the row bigger than it is now, and keep it. Then move on to the tile before it, working from the new total. Stop as soon as the row is full (`columns`). If the row is still under `columns` after the first tile, keep what was gained. A smaller gap beats a bigger one. (For example, a lone tile `[6, 8, 12]` jumps straight to 12 rather than stopping at 8).
3. **Leave gap**: If nothing can enlarge any tile without exceeding `columns`, leave the row as it is. A row must never go over `columns`.

#### Output: `col` and `order`

- **`col`**: `{ [key]: width }` map.
- **`order`**: Array of tile keys in row-packed order: row 1 left-to-right, then row 2, and so on.
- **Empty tiles sit at the end**: Tiles with `empty: true` (width 0) sit at the end of `order`, in score order. They stay mounted in the DOM, hidden. When data arrives and empty flips false, the next pack places them back into their active row.
- **Why reordering never unmounts a tile**: `Dashboard.vue` draws boxes in `order`. Because Vue moves keyed elements inside the same parent without destroying them, reordering never unmounts or resets tile state.

#### Worked packing examples

1. **Pass 1 placement**:
   Row 1 has tile A (width 4, allowed `[4, 6]`) and tile B (width 4, allowed `[4, 6]`), totaling 8 (remaining = 4).
   When tile C arrives (allowed `[4, 6]`), step 1 places tile C at its default 4. Row 1 becomes A(4) + B(4) + C(4) = 12.

2. **Pass 2 grow on desktop**:
   Row 6 has tile X (width 4, allowed `[4, 6]`) and tile Y (width 6, allowed `[6, 8, 12]`), totaling 10.
   - Step 1 (reset to default): tile X is already at default 4; tile Y is already at default 6. Total remains 10.
   - Step 2 (walk backwards): try alternate sizes of the last tile (Y): size 8 makes total 4 + 8 = 12! Kept, and pass 2 stops.

3. **Pass 2 phone grow (4 + 4 → 6 + 6 = 12)**:
   A phone row has tile A (width 4, allowed `[4, 6]`) and tile B (width 4, allowed `[4, 6]`), totaling 8:
   - Walk from last tile (B): size 6 increases total from 8 to 10 (≤ 12). Kept! Row is now 4 + 6 = 10.
   - Move to tile before it (A): size 6 increases total from 10 to 12 (≤ 12). Kept! Row reaches exactly 12 and stops. Both tiles end at 6.

#### Grid display

The grid in `Dashboard.vue` sets inline style flex basis: `flex: 0 0 calc(width / 12 * 100%)`. Hidden boxes (`width === 0`) collapse (`flex: 0 0 0%`, `padding: 0`, `overflow: hidden`).

---

## §6.7 — Dashboard Motion (`Dashboard.vue`)

The dashboard page uses slow, stepped tile motion configured by the page contract in `dashboard.js`:
- `motionMs` (default `800`): how long each animation takes.
- `staggerMs` (default `100`): delay step between tiles.
- `staggerCap` (default `12`): delay is capped at `min(index in order, staggerCap) * staggerMs` (0ms to 1200ms).

### The four motions
1. **Grow / shrink**: cell width slides smoothly over `motionMs` as `col` changes.
2. **Out**: when a tile gets width 0 (`empty` + `hideOnEmpty`), it zooms out (scales down to 0 and fades opacity) while its cell width and padding collapse.
3. **In**: when a tile goes from width 0 back to a visible size, it zooms in with a bounce (`cubic-bezier(0.34, 1.56, 0.64, 1)`) as its cell width and padding open.
4. **Move**: when tiles reorder in `order`, `<TransitionGroup tag="div" name="dashboard-cell-move">` slides them smoothly with `transform` transitions.

### Invariants
- **Hidden tiles are never removed from the DOM**: they remain mounted with width 0 and padding 0 so their internal state and controls stay alive. Zoom in/out is handled via CSS transform/opacity on the inner wrapper, not Vue DOM insertion/removal (`v-if` or sudden `v-show`).
- **Loading spinner**: `q-inner-loading` stays outside the `<TransitionGroup>`.
- **Accessibility**: `@media (prefers-reduced-motion: reduce)` disables all transitions and transforms so tiles appear instantaneously without delay.
