# Dashboard Widgets — List & Grid Bases

> Canonical guide for list and grid base widgets: RankedListBase, TimelineBase, AgeingBase, ProportionBase, and HeatGridBase.

All widgets adhere to the core principles defined in the main [WIDGETS.md](WIDGETS.md) hub.

---

<a id="rankedlistbase"></a>
## RankedListBase

### 1. What it draws and when to pick it
It draws a neat HTML list of top items. Each row has a rank number badge, item name, subtitle caption, value number, and a soft tinted background bar.

**When to pick it over BarBase**:

| Feature | RankedList | BarBase horizontal |
|---|---|---|
| Rank badge | **Yes** | No |
| Caption line under each row | **Yes** | No |
| Order | Always biggest first | Whatever order the data comes in |

RankedListBase is built with pure HTML. Pick it when you have long product names, need subtitle captions, or want to put custom chips and badges into rows. Pick BarBase when you need a strict SVG chart with a numeric axis.

### 2. Full prop table

| Prop | Type | Default | Allowed values | Sheet-safe? | What it does |
| --- | --- | --- | --- | --- | --- |
| `items` | Array | `[]` | Array of `{ label, value, caption, color }` | Yes | List rows data |
| `rowSpacing` | String | `'tight'` | `'tight'`, `'cozy'` | Yes | Row height spacing mode |
| `barStyle` | String | `'fill'` | `'fill'`, `'capsule'` | Yes | Background highlight pill style |
| `captionPlacement` | String | `'below'` | `'below'`, `'inline'` | Yes | Places caption below or inline with label |
| `showRankNumber` | Boolean | `true` | `true`, `false` | Yes | Shows rank 1, 2, 3 badge |
| `color` | String | `'primary'` | Brand color name | Yes | Default highlight bar color |
| `valueFormat` | Function | `null` | `Function(value, item)` | **DBI only** | Formats value text displayed on right |
| `emptyText` | String \| Function \| Object | `'Nothing to show'` | Text, Function, Component | Yes (string) | Empty state message |
| `emptyIcon` | String | `'format_list_numbered'` | Quasar icon name | Yes | Empty state icon |
| `emptyIconColor` | String | `'grey-5'` | Brand or palette color | Yes | Empty icon color |

### 3. Data shape
Expects a list of ranked items:
```json
{
  "items": [
    { "label": "5 Gallon Can", "value": 8420, "caption": "Top refill SKU" },
    { "label": "500ml Bottle x24", "value": 4180, "caption": "Retail carton" },
    { "label": "1.5L Bottle x12", "value": 2100, "caption": "Family pack" }
  ]
}
```

### 4. Density tiers
- `micro`: Shows top 2 or 3 rows with rank badge and value only. Subtitle caption is hidden. Never goes blank.
- `compact`: Rank badge, label, and value number.
- `standard`: Rank badge, label, subtitle caption, and value number.
- `wide`: Comfortable spacious rows with full descriptions.

### 5. Presets & Height hints

| Preset | Fixed props | Height hint type | Hint value | Min height |
| --- | --- | --- | --- | --- |
| `TopProductsList` | `rowSpacing="tight"`, `barStyle="fill"` | `rowHeight` | 32px (`ROW_HEIGHTS.tight`) | 32px |
| `LowStockList` | `rowSpacing="cozy"`, `barStyle="capsule"`, `color="negative"` | `rowHeight` | 44px (`ROW_HEIGHTS.cozy`) | 44px |

These presets declare `rowHeight` matching their row spacing. The tile height is `header + (item count × rowHeight)` with `minHeight` as floor. `ROW_HEIGHTS` is exported from `RankedListBase.vue` (`cozy: 44`, `tight: 32`).

### 6. Slots
- `#rank`: Replace the rank number badge.
- `#label`: Replace the item name.
- `#caption`: Replace the subtitle caption.
- `#value`: Replace the number on the right.
- `#empty`: Custom empty state replacement.

---

<a id="timelinebase"></a>
## TimelineBase

### 1. What it draws and when to pick it
It draws a clean HTML list of chronological events linked by a connector line, with event markers, labels, dates, and captions.

**When to pick it over RankedListBase**:
RankedListBase ranks items by amount with highlight bars. TimelineBase tracks events over time in chronological order, with connecting track lines.

### 2. Full prop table

| Prop | Type | Default | Allowed values | Sheet-safe? | What it does |
| --- | --- | --- | --- | --- | --- |
| `items` | Array | `[]` | Array of `{ label, date, caption, color, marker, icon }` | Yes | Ordered chronological events |
| `direction` | String | `'vertical'` | `'vertical'`, `'horizontal'` | Yes | Timeline layout direction |
| `markerShape` | String | `'dot'` | `'dot'`, `'icon'` | Yes | Round dot or Quasar icon marker |
| `showConnector` | Boolean | `true` | `true`, `false` | Yes | Draws track line connecting markers |
| `color` | String | `'primary'` | Brand color name | Yes | Default marker color |
| `valueFormat` | Function | `null` | `Function(value)` | **DBI only** | Formats value text (if present) |
| `emptyText` | String \| Function \| Object | `'Nothing to show'` | Text, Function, Component | Yes (string) | Empty state message |
| `emptyIcon` | String | `'timeline'` | Quasar icon name | Yes | Empty state icon |
| `emptyIconColor` | String | `'grey-5'` | Brand or palette color | Yes | Empty icon color |

### 3. Data shape
Expects an ordered array of event items:
```json
{
  "items": [
    { "label": "Draft Created", "date": "2026-09-06", "caption": "Requisition PO-8410 created" },
    { "label": "Approved", "date": "2026-09-07", "caption": "Verified stock balance" },
    { "label": "Delivered", "date": "2026-09-09", "caption": "Customer signed invoice" }
  ]
}
```

### 4. Density tiers
- `micro`: Shows top 2 or 3 rows with label and date only. Captions hidden. Never goes blank.
- `compact`: Clean markers, labels, and dates.
- `standard`: Full markers, labels, dates, and subtitle captions.
- `wide`: Comfortable spacious layout with full descriptions.

### 5. Presets & Height hints

| Preset | Fixed props | Height hint type | Hint value | Min height |
| --- | --- | --- | --- | --- |
| `EventTimeline` | `direction="vertical"`, `markerShape="dot"`, `showConnector=true` | `rowHeight` | 48px (`ROW_HEIGHTS.standard`) | 48px |
| `CompactTimeline` | `direction="horizontal"`, `markerShape="dot"`, `showConnector=true` | `aspect` | 3 | 34px |

`ROW_HEIGHTS` is exported from `TimelineBase.vue` (`standard: 48`, `compact: 34`).

### 6. Slots
- `#marker`: Replace the event marker.
- `#label`: Replace the event title text.
- `#date`: Replace the event date text.
- `#caption`: Replace the subtitle description.
- `#empty`: Custom empty state replacement.

---

<a id="ageingbase"></a>
## AgeingBase

### 1. What it draws and when to pick it
It draws a horizontal stacked bar or stepped blocks split into time overdue brackets (like 0-30, 31-60, 61-90, 90+ days), colored from calm green to warning red.

**When to pick it over ProportionBase**:
Pick AgeingBase when showing overdue bills or old inventory by age buckets. AgeingBase uses alert severity colors. Pick ProportionBase for product categories or status shares.

### 2. Full prop table

| Prop | Type | Default | Allowed values | Sheet-safe? | What it does |
| --- | --- | --- | --- | --- | --- |
| `items` | Array | `[]` | Array of `{ label, value, color }` | Yes | Age brackets |
| `bucketStyle` | String | `'blocks'` | `'blocks'`, `'staircase'` | Yes | Continuous blocks or stepped staircase |
| `dangerTint` | String | `'escalating'` | `'last-only'`, `'escalating'` | Yes | Color ramp progression |
| `showBaseline` | Boolean | `true` | `true`, `false` | Yes | Shows bottom baseline rule |
| `color` | String | `'primary'` | Brand color name | Yes | Default base color |
| `valueFormat` | Function | `null` | `Function(value)` | **DBI only** | Formats bucket value labels |
| `emptyText` | String \| Function \| Object | `'Nothing to show'` | Text, Function, Component | Yes (string) | Empty state message |
| `emptyIcon` | String | `'hourglass_empty'` | Quasar icon name | Yes | Empty state icon |
| `emptyIconColor` | String | `'grey-5'` | Brand or palette color | Yes | Empty icon color |

### 3. Data shape
Expects ordered age brackets:
```json
{
  "items": [
    { "label": "0-30 Days", "value": 45000 },
    { "label": "31-60 Days", "value": 18000 },
    { "label": "61-90 Days", "value": 7500 },
    { "label": "90+ Days", "value": 3200 }
  ]
}
```

### 4. Density tiers
- `micro`: Colored bar or blocks only. No text.
- `compact`: Bar with bracket amounts below.
- `standard`: Full bar with age labels, amounts, and percentages.
- `wide`: Spacious layout with clear severity legends.

### 5. Presets & Height hints

| Preset | Fixed props | Height hint type | Hint value | Min height |
| --- | --- | --- | --- | --- |
| `DebtAgeing` | `bucketStyle="blocks"`, `dangerTint="escalating"`, `showBaseline=true` | `aspect` | 1.78 | 100px |
| `OldStockAgeing` | `bucketStyle="staircase"`, `dangerTint="last-only"`, `showBaseline=false` | `aspect` | 1.78 | 100px |

### 6. Slots
- `#empty`: Custom empty state replacement.

---

<a id="proportionbase"></a>
## ProportionBase

### 1. What it draws and when to pick it
It draws a single segmented bar where colored slices sit side by side to show parts of one whole total.

**When to pick it over BarBase**:
Pick ProportionBase when you have only one total to divide (like current warehouse stock split by bottle size). Pick BarBase when you want to compare multiple different bars over time.

### 2. Full prop table

| Prop | Type | Default | Allowed values | Sheet-safe? | What it does |
| --- | --- | --- | --- | --- | --- |
| `items` | Array | `[]` | Array of `{ label, value, color }` | Yes | Parts of the total |
| `orientation` | String | `'horizontal'` | `'horizontal'`, `'vertical'` | Yes | Direction of bar |
| `splitStyle` | String | `'continuous'` | `'continuous'`, `'gap'` | Yes | Gaps between segments |
| `barHeight` | String | `'thin'` | `'thin'`, `'thick'` | Yes | Bar thickness |
| `color` | String | `'primary'` | Brand color name | Yes | Default fallback color |
| `valueFormat` | Function | `null` | `Function(value)` | **DBI only** | Formats segment value labels |
| `emptyText` | String \| Function \| Object | `'Nothing to show'` | Text, Function, Component | Yes (string) | Empty state message |
| `emptyIcon` | String | `'view_week'` | Quasar icon name | Yes | Empty state icon |
| `emptyIconColor` | String | `'grey-5'` | Brand or palette color | Yes | Empty icon color |

### 3. Data shape
Expects an array of items with values:
```json
{
  "items": [
    { "label": "Full Cans", "value": 1420 },
    { "label": "Empty Returns", "value": 430 },
    { "label": "Damaged", "value": 50 }
  ]
}
```

### 4. Density tiers
- `micro`: Segmented bar only. No legend or text.
- `compact`: Bar with compact 2-column legend below.
- `standard`: Bar with percentage labels and full legend rows.
- `wide`: Spacious bar with clear legend layout.

### 5. Presets & Height hints

| Preset | Fixed props | Height hint type | Hint value | Min height |
| --- | --- | --- | --- | --- |
| `ShareStrip` | `orientation="horizontal"`, `splitStyle="continuous"`, `barHeight="thin"` | `aspect` | 6 | 64px |
| `StockStatusStrip` | `orientation="horizontal"`, `splitStyle="gap"`, `barHeight="thick"` | `aspect` | 6 | 64px |
| `VerticalShareStrip` | `orientation="vertical"`, `splitStyle="continuous"`, `barHeight="thick"` | `aspect` | 0.25 | 90px |

### 6. Slots
- `#empty`: Custom empty state replacement.

---

<a id="heatgridbase"></a>
## HeatGridBase

### 1. What it draws and when to pick it
It draws a grid of boxes colored by activity level. Quiet times are light, and busy times are deep color.

**When to pick it over WaffleBase**:
WaffleBase counts finished items (on vs off). HeatGridBase measures heat or intensity (how busy each hour of the day or day of the week is).

### 2. Full prop table

| Prop | Type | Default | Allowed values | Sheet-safe? | What it does |
| --- | --- | --- | --- | --- | --- |
| `series` | Array | `[]` | Array of `{ name, items }` | Yes | Data series for strip or matrix |
| `layout` | String | `'matrix'` | `'strip'`, `'matrix'` | Yes | Single row strip or 2D matrix |
| `cellRound` | String | `'none'` | `'none'`, `'round'` | Yes | Corner rounding of cells |
| `cellGap` | String | `'tight'` | `'tight'`, `'loose'` | Yes | Spacing between cells |
| `color` | String | `'primary'` | Brand color name | Yes | Base theme color |
| `valueFormat` | Function | `null` | `Function(value)` | **DBI only** | Formats cell value numbers |
| `minTier` | String | `'micro'` | `'micro'`, `'compact'`, `'standard'`, `'wide'` | Yes | Minimum tier required to render |
| `emptyText` | String \| Function \| Object | `'Nothing to show'` | Text, Function, Component | Yes (string) | Empty state message |
| `emptyIcon` | String | `'table_chart'` | Quasar icon name | Yes | Empty state icon |
| `emptyIconColor` | String | `'grey-5'` | Brand or palette color | Yes | Empty icon color |

### 3. Data shape
For a strip (like 24 hours):
```json
{
  "series": [
    {
      "name": "Hours",
      "items": [
        { "label": "08:00", "value": 12 },
        { "label": "09:00", "value": 45 },
        { "label": "10:00", "value": 95 }
      ]
    }
  ]
}
```
For a matrix (like 7 days x 4 shifts):
```json
{
  "series": [
    {
      "name": "Mon",
      "items": [{ "label": "Morning", "value": 10 }, { "label": "Afternoon", "value": 45 }]
    },
    {
      "name": "Tue",
      "items": [{ "label": "Morning", "value": 15 }, { "label": "Afternoon", "value": 60 }]
    }
  ]
}
```

### 4. Density tiers
- `micro`: Colored squares only. No text labels.
- `compact`: Squares with minimal edge labels.
- `standard`: Full grid with column hour or shift headers.
- `wide`: Complete labeled matrix with row and column names.

### 5. Presets & Height hints

| Preset | Fixed props | Height hint type | Hint value | Min height |
| --- | --- | --- | --- | --- |
| `HourHeatStrip` | `layout="strip"`, `cellRound="none"`, `cellGap="tight"` | `aspect` | 5 | 40px |
| `WeekRouteMatrix` | `layout="matrix"` | `aspect` | 1.78 | 120px |

### 6. Slots
- `#empty`: Custom empty state replacement.
