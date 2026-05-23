# Dashboard Widget Registry

Purpose: Quick discovery, configuration templates, and extension protocols for reusable dashboard widgets under `FRONTENT/src/dashboard/_widgets/`.

Rule: Update this file whenever a new visual widget component is added under `FRONTENT/src/dashboard/_widgets/` or an existing widget's configuration contract is modified.

---

## Zero Resource-Specific Hardcoding (STRICT)
All widgets under `FRONTENT/src/dashboard/_widgets/` MUST remain completely generic, reusable, and side-effect free. 
* **NEVER** hardcode specific resource names, database columns, status keys, empty state text, colors, or legend labels inside a widget component.
* **ALWAYS** parameterize all visual text, labels, threshold warnings, color palettes, and empty-state messaging inside the declarative JS widget `.js` configuration file (in `metadata.config`), and render them reactively using Vue props.

---

## Common Widgets Catalog

| Widget Type | Purpose | Expected Value Format | Required Config Parameters | Path |
|---|---|---|---|---|
| `MetricWidget` | Presents a single focal numerical count or currency value queue. | `Number` or `String` | `{ title: String, icon: String, color: String }` | `src/dashboard/_widgets/MetricWidget.vue` |
| `BarChartWidget` | Compares scalar values across unique categories in a glowing gradient chart. | `Array<{ label: String, value: Number }>` | `{ title: String, icon: String, color: String }` | `src/dashboard/_widgets/BarChartWidget.vue` |
| `DonutChartWidget` | Displays composition shares or proportional distribution percentages. | `Array<{ label: String, value: Number, color?: String }>` | `{ title: String, icon: String, color: String }` | `src/dashboard/_widgets/DonutChartWidget.vue` |
| `TimelineWidget` | Lists recent chronological log items, notifications, or status changes. | `Array<{ title: String, subtitle: String, timestamp: String, status: String }>` | `{ title: String, icon: String, color: String }` | `src/dashboard/_widgets/TimelineWidget.vue` |
| `StackedBarChartWidget` | Displays segmented, stacked comparative bars grouped chronologically (e.g. daily, monthly). | `Array<{ label: String, [key: String]: Number }>` | `{ title: String, icon: String, color: String, chart: { series: Array<{ key: String, label: String, gradientStart: String, gradientEnd: String, shadowColor?: String }>, emptyMessage: String } }` | `src/dashboard/_widgets/StackedBarChartWidget.vue` |

---

## Detailed Widget Specifications & Usage

### 1. MetricWidget
* **Description**: Displays a large visual value card with dynamic HSL-tailored colored background gradients, glowing visual highlights, and an avatar.
* **Visual Colors**: Gated by `hsl` gradients for `primary`, `orange`, `blue`, `purple`, `teal`, `green`.
* **Config Contract**:
  ```javascript
  config: {
    type: 'MetricWidget',
    title: 'Pending Approvals',
    icon: 'pending_actions',
    color: 'orange',
    weight: 100,
    layout: { xs: 12, sm: 6, md: 4 }
  }
  ```

### 2. BarChartWidget
* **Description**: Custom responsive SVG bar chart rendering computed `<rect>` components with glowing linear gradients, vertical expanding transitions, axis marks, responsive margins, and tooltip hover targets.
* **Config Contract**:
  ```javascript
  config: {
    type: 'BarChartWidget',
    title: 'Purchase Orders by Vendor',
    icon: 'storefront',
    color: 'purple',
    weight: 80,
    layout: { xs: 12, sm: 12, md: 8 }
  }
  ```

### 3. DonutChartWidget
* **Description**: Pure responsive SVG concentric circle segment layout calculating percentages reactively using circumference dasharray math. Hovering segments scales sector thickness, reveals popover details, and stamps total values in the donut center.
* **Config Contract**:
  ```javascript
  config: {
    type: 'DonutChartWidget',
    title: 'Quotation Outcome Split',
    icon: 'pie_chart',
    color: 'primary',
    weight: 90,
    layout: { xs: 12, sm: 12, md: 4 }
  }
  ```

### 4. TimelineWidget
* **Description**: Sleek vertical stepper timeline list displaying progress cards with status badges and relative date tags.
- **Config Contract**:
  ```javascript
  config: {
    type: 'TimelineWidget',
    title: 'Recent Pending Goods Receipts',
    icon: 'receipt',
    color: 'teal',
    weight: 70,
    layout: { xs: 12, sm: 12, md: 4 }
  }
  ```

### 5. StackedBarChartWidget
* **Description**: Premium Pure SVG stacked bar graph plotting multi-variable category stacks. Features customizable multi-series legends, dynamic grid tick lines, interactive compound tooltips, and instance-scoped dropshadow gradients.
- **Config Contract**:
  ```javascript
  config: {
    type: 'StackedBarChartWidget',
    title: 'Outlet Visit Progress',
    icon: 'event_available',
    color: 'primary',
    weight: 60,
    layout: { xs: 12, sm: 12, md: 8 },
    chart: {
      series: [
        {
          key: 'completed',
          label: 'Completed Visits',
          gradientStart: 'hsl(142, 70%, 45%)',
          gradientEnd: 'hsl(142, 60%, 35%)',
          shadowColor: 'hsl(142, 70%, 45%)'
        },
        {
          key: 'postponed',
          label: 'Postponed Visits',
          gradientStart: 'hsl(215, 16%, 65%)',
          gradientEnd: 'hsl(215, 12%, 50%)',
          shadowColor: 'hsl(215, 16%, 65%)'
        },
        {
          key: 'cancelled',
          label: 'Cancelled Visits',
          gradientStart: 'hsl(0, 75%, 55%)',
          gradientEnd: 'hsl(0, 65%, 45%)',
          shadowColor: 'hsl(0, 75%, 55%)'
        }
      ],
      emptyMessage: 'No visit history recorded'
    }
  }
  ```
