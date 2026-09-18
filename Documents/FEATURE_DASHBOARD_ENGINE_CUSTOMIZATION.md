# Dashboard Engine — Customization Guide

> Canonical guide to every dashboard option and knob, organized by where it is configured.

---

## Where options live

| Configuration Location | What is configured there |
|---|---|
| **1. ARD (`App.Resources` Google Sheet)** | Which tiles show, order, permissions override, width preferences, score multiplier, titles, subtitles, captions, sheet-side widget props, custom tiles. |
| **2. DBI (Code: `_resource/.../Dashboard/<name>.js`)** | Widget preset, default width preferences, data bindings, permissions gate, auth bonuses, interactive controls, live computed properties, `empty` condition. |
| **3. `widgetProps` (DBI + Sheet merge)** | Component-level visual properties: color roles, variants, thresholds, density tiers, formatters (`valueFormat`). |
| **4. Page Contract (`pages/Dashboard/dashboard.js`)** | Grid column count, row height unit, gap size, animation timing (`motionMs`, `staggerMs`, `staggerCap`), minimum controls width (`controlsMinSpan`), layout classes, tenant UI name (`uiName`). |
| **5. Custom UI (`src/_ui/`)** | Custom widget components replacing the Frame (`.vue`), tiered prop modifiers (`.js`). |
| **6. Controls (`useDataControls`)** | Interactive filter controls, control types (`plain`, `menu`, `chip`, `select`), shared control state across tiles. |

---

## 1. ARD (`App.Resources` Google Sheet `Dashboard` cell)

Each resource in `App.Resources` has a `Dashboard` cell containing a JSON array of tile objects.

### The standard ARD is minimal

The standard ARD is minimal: only `name` and the order of items matter. The DBI carries everything else (widgets, sizes, permissions, data, titles, controls).
```json
[{"name":"openLeads"},{"name":"newLeads"}]
```
The first tile in the array gets top position priority (weight 1.9), and the last gets bottom priority (0.1).

Every other key listed below is an **optional override**, used only when a tenant explicitly needs to customize a tile from the sheet. When provided, the sheet value wins over the DBI value.

### Key ownership table

| Where | Keys |
|---|---|
| **Sheet only** | `name`, `active`, `activeExcept`, `hideOnEmpty`, order of items in cell |
| **DBI only** | `permission`, `auth`, `users` |
| **Both — sheet wins** | `widget`, `size`, `multiplier`, `widgetProps`, `title`, `subtitle`, `caption` |
| **Sheet (custom tiles)** | `source` — passed through untouched |

### All keys in detail

| Key | Type | Default | Description |
|---|---|---|---|
| `name` | String | (Required) | Unique tile identifier within the resource. Matches the DBI filename in `_resource/<Scope>/<Resource>/Dashboard/<name>.js`. A sheet item without `name` is dropped. |
| `active` | Boolean | `true` | When `false`, the tile is completely disabled and dropped before scoring. |
| `activeExcept` | Array of Strings | `[]` | List of user role IDs that invert `active`. If `active: true` and user has a role in `activeExcept`, the tile is hidden. If `active: false` and user has a role in `activeExcept`, the tile is shown. |
| `hideOnEmpty` | Boolean | `false` | When `true`, the tile receives width 0 when its computed `empty` flag is `true`. Never hides while `loading` is `true`. |
| `multiplier` | Number | `1` | Multiplies the tile score. Clamped between `0` and `2` for normal tiles, and `0` and `3` for custom tiles. Set to `0` to turn the tile off. |
| `size` | Object | From DBI or `{ xs: [12] }` | Responsive allowed widths per breakpoint (`xs`, `sm`, `md`, `lg`, `xl`). Array of widths in preference order (e.g. `[6, 8, 12]`). Single numbers coerce to a single-element array (e.g. `6` → `[6]`). |
| `widget` | String | From DBI | Name of the widget preset to render (e.g. `'HorizontalRankBar'`, `'MetricPlain'`). Overrides the DBI preset. |
| `title` | String | From DBI | Title text on the card header. Overrides DBI title. |
| `subtitle` | String | From DBI | Subtitle text below the title. Overrides DBI subtitle. |
| `caption` | String | From DBI | Caption footer text. Overrides DBI caption. |
| `widgetProps` | Object | `{}` | Visual properties passed to the widget. Shallow-merges over DBI `widgetProps`. |
| `source` | String | `undefined` | Custom tile pass-through key for external or custom-rendered data. Untouched by the engine. |

> [!NOTE]
> There is **no `empty` key** and **no hex color key** in the sheet cell. `empty` is computed strictly from data in code. Color is specified as a theme role name (e.g. `'primary'`, `'secondary'`, `'accent'`).

### Custom tiles in the sheet
When a sheet item has no matching DBI file in `_resource/<Scope>/<Resource>/Dashboard/`:
- It is marked as `custom: true`.
- `data: null` and `controls: []`.
- `permission` is bypassed (all users see it).
- Never hides on empty (`empty: false`).
- `multiplier` is capped at `3` instead of `2`.
- It renders a custom widget if defined under `_ui/<uiName>/components/widgets/<widget>.vue`. If no custom widget is defined, `Tile.vue` displays a visible "Tile Not Defined" fallback card.

### Single-line JSON examples for sheet cells

**Minimal standard cell (order defines priority):**
```json
[{"name":"openLeads"},{"name":"newLeads"},{"name":"leadsByPlace"}]
```

**Single metric tile with breakpoint preferences override:**
```json
[{"name":"openLeads","size":{"xs":[12],"sm":[6],"md":[4,6]},"title":"All Open Leads"}]
```

**Ranked bar chart with custom title and hide on empty:**
```json
[{"name":"leadsByPlace","hideOnEmpty":true,"widgetProps":{"color":"secondary"},"size":{"xs":[12],"md":[6,8,12]}}]
```

**Custom tile example (no DBI; requires a custom widget under `_ui/<uiName>/components/widgets/`):**
```json
[{"name":"revenueOverview","widget":"RevenueCard","active":false,"activeExcept":["admin","manager"]}]
```

**Multiple tiles in internal priority order with optional overrides:**
```json
[{"name":"overdueFollowUps","multiplier":1.5},{"name":"leadsByPlace","size":{"xs":[12],"md":[6]}},{"name":"processingAgeing","hideOnEmpty":true}]
```

---

## 2. DBI (Code: `_resource/.../Dashboard/<name>.js`)

A DBI file defines a single dashboard item descriptor. It pairs domain data from a DJS with widget display settings.

### Function shape

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

- **Static keys**: `widget`, `size`, `permission`, `widgetProps`, `users`, `auth`, `multiplier`, and static `title`/`subtitle`/`caption`. These are plain javascript values.
- **`data`**: A single `computed` returning an object of plain unwrapped values (`.value` inside). Any property that updates dynamically (counts, lists, reactive titles) must live inside `data`.
- A property must live either in static keys or inside `data`, never both.

### DBI properties in detail

| Property | Type | Default | Description |
|---|---|---|---|
| `widget` | String | (Required) | Default widget preset name (e.g. `'MetricPlain'`, `'DonutProportion'`). |
| `size` | Object | `{ xs: [12] }` | Default allowed widths per breakpoint. |
| `permission` | Object, String, Boolean | `true` | Permission check tested against current user permissions (e.g. `{ Leads: 'Read' }` or `'canCreateLeads'`). |
| `auth` | Boolean | `false` | When `true`, awards a `+3.0` user bonus to the tile's raw score. |
| `users` | Boolean | `false` | When `true`, awards a `+5.0` user bonus to the tile's raw score. |
| `controls` | Array | `[]` | Array of control descriptors passed directly from the DJS `controls` array. |
| `title` | String | `undefined` | Default card title. |
| `subtitle` | String | `undefined` | Default card subtitle. |
| `caption` | String | `undefined` | Default card caption. |
| `widgetProps` | Object | `{}` | Default visual props for the widget. Can include javascript functions like `valueFormat`. |
| `data` | ComputedRef<Object> | (Required) | Reactive data payload. Must contain `loading` and `empty`, plus all data keys required by the widget. |

### The `empty` rule (in depth)

> [!IMPORTANT]
> **An item's `empty` condition is decided strictly by its records — what `useRecord` holds for it.**
> An item's `empty` computed must **never read a control ref**, directly or indirectly.

**Why**: If a tile hides because a user picked a filter that returned zero rows, the tile disappears and takes its controls with it. The user has no way to change the filter back. `empty` represents whether the underlying data set has any records at all.

- **Single number tiles** (`MetricPlain`): `empty: d.count.value === 0`.
- **Number + comparison tiles** (`MetricDelta`): `empty: d.current.value === 0 && d.previous.value === 0`. Both must be zero.
- **Delay / duration tiles**: `empty: d.thisMonthCount.value === 0 && d.lastMonthCount.value === 0`.
- **Bucket / bar / line tiles** (`ColumnBar`, `LineBase`): `empty: !items.some(i => i.value > 0)`. Empty when every bucket is zero, not only when the list is empty.
- **Uncontrolled lists**: `empty: list.length === 0`.
- **Control-driven tiles**: `empty` checks the total unfiltered record count (e.g. `d.openCount.value === 0`), never the filtered list count.

---

## 3. `widgetProps`

`widgetProps` passes visual configuration to the widget.

### Merge precedence

```
Final widgetProps = shallowMerge(DBI.widgetProps, Sheet.widgetProps)
```
The sheet shallow-merges over the DBI. If the DBI provides `{ color: 'primary', dense: true }` and the sheet specifies `{"color": "accent"}`, the result is `{ color: 'accent', dense: true }`.

### JSON vs Functions (`valueFormat`)

- **Sheet `widgetProps`**: Must be valid JSON. It can configure static values: `color`, `variant`, `max`, `target`, `dense`, `signed`.
- **DBI `widgetProps`**: Written in JavaScript. It can configure functions, such as custom formatting with `valueFormat`:
  ```javascript
  widgetProps: {
    color: 'positive',
    valueFormat: (val) => `$${Number(val).toLocaleString()}`
  }
  ```
  Functions cannot be written in the sheet cell.
- For complete prop lists supported by each widget base, see [WIDGETS.md](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/widgets/WIDGETS.md).

---

## 4. Page Contract (`pages/Dashboard/dashboard.js`)

The page contract defines global layout, responsive grid parameters, and motion behavior:

| Parameter | Type | Default | Description |
|---|---|---|---|
| `columns` | Number | `12` | Total grid column count for row packing. |
| `rowUnit` | Number | `48` | Height step in pixels for grid calculations. |
| `gap` | String | `'16px'` | CSS gap between grid cells. |
| `motionMs` | Number | `800` | Duration of width and transition animations in milliseconds. |
| `staggerMs` | Number | `100` | Stagger delay increment between tiles in milliseconds. |
| `staggerCap` | Number | `12` | Maximum tile index for staggering (`min(index, staggerCap) * staggerMs`). |
| `controlsMinSpan` | Number | `6` | Minimum column span allocated to any tile with active controls. |
| `pageClass` | String | `'q-pa-md'` | CSS classes applied to the root `q-page`. |
| `gridClass` | String | `'row items-stretch'` | CSS classes applied to the grid container. |
| `uiName` | String | Computed | Resolved custom UI name from authorized resources (`cfg.ui.customUIName`), falling back to `'AQL'`. |

---

## 5. Custom UI (`src/_ui/`)

Tenants can override tile appearance using Vue components or JS prop modifiers under `src/_ui/<uiName>/`.

### 1. Custom Widget Replacement (`.vue`)

- **File location**: `_ui/<uiName>/components/widgets/<widget>.vue`, matching the `widget` preset name.
- **Replaces the Frame**: A custom widget replaces the entire `Frame.vue`. It is responsible for rendering the card, header, controls, and body.
- **Props received**:
  `{ title, subtitle, caption, controls, error, loading, widget, widgetProps, data }`
- **Using `<Controls />`**:
  ```vue
  <template>
    <q-card class="my-custom-card">
      <div class="row items-center justify-between">
        <div class="text-h6">{{ title }}</div>
        <Controls />
      </div>
      <div class="my-custom-body">
        <Widget :name="widget" v-bind="{ ...widgetProps, ...data }" />
      </div>
    </q-card>
  </template>

  <script setup>
  import { useDataControls } from 'src/composables/data/useDataControls'
  import Widget from 'src/components/widgets/Widget.vue'

  const props = defineProps({
    title: String,
    subtitle: String,
    caption: String,
    controls: Array,
    error: [String, Object],
    loading: Object,
    widget: String,
    widgetProps: Object,
    data: Object
  })

  const { Controls } = useDataControls(() => props.controls)
  </script>
  ```

### 2. JS Prop Modifiers (`.js`)

When using the standard Frame (or a custom widget), props can be adjusted by a `.js` modifier file.

`useWidgetResolver` searches these paths in order (first match wins):
1. `_ui/<uiName>/components/<scope>/<resource>/dashboard/<name>.js`
2. `_ui/<uiName>/components/<scope>/<resource>/<name>.js`
3. `_ui/<uiName>/components/<scope>/dashboard/<name>.js`

The modifier receives a flat object of props:
```javascript
{ title, subtitle, caption, widget, widgetProps, controls, data, error, name, resource, scope }
```
where `data` is the plain unwrapped value (`data.value`).

The default export can be an object or a function:

**Object modifier (static overrides):**
```javascript
export default {
  title: 'My Custom Regional Title',
  widgetProps: {
    color: 'accent'
  }
}
```

**Function modifier (dynamic overrides):**
```javascript
export default (flatProps) => {
  return {
    title: `${flatProps.title} (Live)`,
    widgetProps: {
      ...flatProps.widgetProps,
      color: flatProps.data?.total > 100 ? 'negative' : 'primary'
    }
  }
}
```

**Merging and rules**:
- `finalProps = { ...flat, ...theirs }` evaluated inside a reactive computed.
- `loading` is strictly managed by `Tile.vue` and cannot be altered by a modifier.

---

## 6. Controls (`useDataControls`)

Controls allow users to interactively filter or group tile data without page reloads.

### Control definition

Created in a DJS using `dataControl(name, { type, options, value })`:
```javascript
import { ref } from 'vue'
import { dataControl } from 'src/composables/data/useDataControls'

const groupBy = ref('City')
const controls = [
  dataControl('groupBy', {
    type: 'plain',
    value: groupBy,
    options: ['City', 'Source', 'Status']
  })
]
```

### Control types

| Type | Rendered Field | UI Element | Best for |
|---|---|---|---|
| `'plain'` | `plainselect` | Quasar `q-btn-toggle` (flat, dense, no-caps) | 2–4 short choices. |
| `'menu'` | `menuselect` | Quasar `q-btn-dropdown` (flat, dense, no-caps) | Many options or tight spaces. |
| `'chip'` | `chipselect` | Quasar `q-chip` group | Tag-like selections. |
| `'select'` | `select` | Quasar `q-select` (dense, borderless) | Standard dropdown select. |
| *(unknown)* | Falls back to `menuselect` | Quasar `q-btn-dropdown` | Safe fallback. |

### Shared DJS = Shared Controls
When multiple DBIs import the same DJS singleton, they share the same control `ref`s. Changing a control on one tile automatically updates all other tiles connected to that DJS.

---

## 7. Small Logic: Inline vs Helper Rule

- **Inline logic**: Simple arithmetic, standard formatting, or single-line filtering should be written directly inside the DJS or DBI.
- **Pure mathematical helpers**: Reusable date ranges, grouping math, or stat helpers belong in `FRONTENT/src/composables/dashboard/useDataContext.js` as pure functions taking raw arrays.
