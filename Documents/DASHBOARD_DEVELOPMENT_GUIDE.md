# Dashboard Development & Customization Guide

This document is the canonical reference and customization manual for building, configuring, and extending the AQL Dashboard module. Follow these protocols to keep the dashboard fully modular, performant, and secure.

---

## 1. Directory Structure

All dashboard-related assets and files must strictly adhere to the following directory structure:

```
FRONTENT/
├── src/
│   ├── components/
│   │   └── _dashboard/              # Pure Vue SVG Common Widget components
│   │       ├── MetricWidget.vue
│   │       ├── BarChartWidget.vue
│   │       ├── DonutChartWidget.vue
│   │       └── TimelineWidget.vue
│   │
│   ├── composables/
│   │   └── _dashboard/              # Central reactive dashboard composable
│   │       └── useDashboard.js
│   │
│   ├── dashboard/                   # Dynamic Widget Configurations (Vite eager-loaded)
│   │   ├── <scope>/                 # e.g., operations, accounts, masters
│   │   │   └── <resource>/          # e.g., purchaseRequisitions, rfqs
│   │   │       └── <widget>.js      # Config-driven JS widget files
│   │
│   └── pages/
│       └── Dashboard/
│           └── DashboardIndex.vue   # Gateway Assembler & Packing Grid
```

---

## 2. The Declarative JS Widget Contract

Every widget is defined in a standalone `.js` file exporting a single default configuration object matching the contract schema below:

```javascript
export default {
  metadata: {
    id: 'unique_widget_id', // Must be unique across all widgets
    scope: 'operations',    // 'operations' | 'accounts' | 'masters'
    resource: 'purchaseRequisitions', // Primary resource for permission gating
    permission: { 
      purchaseRequisitions: 'read' // Gated by allowed() helper (fail-safe AND logic)
    },
    config: {
      type: 'MetricWidget', // 'MetricWidget' | 'BarChartWidget' | 'DonutChartWidget' | 'TimelineWidget'
      title: 'Awaiting Approvals',
      icon: 'pending_actions',
      color: 'orange', // Tailored HSL theme name or Quasar utility color
      weight: 100, // Secondary sort rank (higher numbers float to top)
      layout: {
        xs: 12, // Responsive grid columns (out of 12)
        sm: 6,
        md: 4,
        lg: 3
      }
    },
    dataSource: {
      // Single-resource pipeline
      resource: 'purchaseRequisitions', 
      
      // Or Multi-resource Mode:
      // resources: ['purchaseRequisitions', 'purchaseOrders'],

      // Option A: Declarative filter-aggregate pipeline
      pipeline: {
        filters: [
          { field: 'Status', op: 'eq', value: 'Pending Approval' }
        ],
        aggregate: {
          type: 'count' // 'count' | { type: 'sum', field: 'TotalAmount' } | { type: 'avg', field: 'Rating' }
        }
      },

      // Option B: Procedural custom evaluation
      // Receives pre-resolved record object arrays. Context contains Currency Polyvalent formatter (_C)
      evaluate: (data, context) => {
        // e.g. return data.reduce((acc, row) => acc + Number(row.Amount || 0), 0)
        return data.length
      }
    }
  }
}
```

### Supported Pipeline Operators
- `eq`: Exact match equality (e.g. `Status === 'Pending'`)
- `ne`: Inequality check (e.g. `Status !== 'Closed'`)
- `gt`: Greater than comparison for numerical fields
- `lt`: Less than comparison for numerical fields
- `in`: Checks if field value is contained within a supplied array
- `contains`: Substring string match (case-insensitive)

---

## 3. Common Widget Catalog

### 3.1 MetricWidget
- **Purpose**: Displays a single aggregated metric (e.g., total count, financial sum).
- **Presentation**: An HSL-gradient visual card with an integrated scale animation on hover, a large focal number, and a supporting descriptive icon.
- **Loading State**: Swaps text with a pulsing inline `<q-skeleton type="rect" />` card.

### 3.2 BarChartWidget
- **Purpose**: Compares numerical values across categories.
- **Presentation**: Custom, highly-performant SVG bar layout displaying computed `<rect>` components with glowing linear-gradients (`<feDropShadow>`), vertical scaling entry animations, and responsive horizontal labels.
- **Configuration**: Returns an array of `{ label: String, value: Number }`.

### 3.3 DonutChartWidget
- **Purpose**: Illustrates proportional splits or percentage compositions.
- **Presentation**: Custom pure SVG concentric segments with reactive `stroke-dasharray` and `stroke-dashoffset` computations. Supports mouseover highlight triggers and dynamic center text mapping.
- **Configuration**: Returns an array of `{ label: String, value: Number, color?: String }`.

### 3.4 TimelineWidget
- **Purpose**: Renders chronological lists or status-action updates.
- **Presentation**: Elegant vertical stepper tracks featuring status badges, relative timestamp conversions, action hyperlinks, and click actions.
- **Configuration**: Returns an array of `{ title: String, subtitle: String, timestamp: String, status: String }`.

---

## 4. Header-to-Widget Decision Matrix

When analyzing a resource sheet structure, future agents or developers should refer to this matrix to auto-select the visual widget type and datasource pipeline:

| Column / Data Pattern | Visual Goal | Recommended Widget | DataSource Configuration |
|---|---|---|---|
| A status column (e.g., `Status`, `Progress`) with values like `Pending`, `Draft` | Present current workload queue size | **MetricWidget** | `pipeline: { filters: [{ field: 'Status', op: 'eq', value: 'Pending' }], aggregate: 'count' }` |
| Multiple transaction rows with numeric fields (e.g., `TotalAmount`, `Value`) | Present absolute financial volume | **MetricWidget** | `pipeline: { aggregate: { type: 'sum', field: 'TotalAmount' } }` |
| Groupable categories (e.g., `VendorName`, `Department`, `ItemCategory`) | Show top contributors or comparative levels | **BarChartWidget** | `evaluate` function grouping rows by key and aggregating sums, returning sorted top 5 array |
| Proportion segments summing up to a whole (e.g., `Status` split ratio) | Show composition or portfolio distribution | **DonutChartWidget** | `evaluate` function calculating unique counts per status as percentages, mapping to donut layout |
| Sequential records with dates (e.g., `CreatedAt`, `DueDate`) | Trace recent activity or alert lists | **TimelineWidget** | `evaluate` mapping function filtering for active items, sorting by date descending, slicing top 5 |

---

## 5. Extension Protocol: Adding New Widget Types

If the existing catalog does not cover a new requirement, follow these steps to build and register a new widget type:

### Step A: Implement a Pure Vue SVG Component
Create the component under `FRONTENT/src/components/_dashboard/` (e.g., `LineChartWidget.vue`).
- **No libraries**: Render chart elements using `<svg>`, utilizing reactive loops over coordinates.
- **Aesthetics**: Apply dynamic HSL themes, smooth CSS transitions, and SVG filter shadows.
- **State isolation**: Bind skeleton UI overrides to a `loading` Boolean property.

### Step B: Register the Component in the Gateway Page
Modify `FRONTENT/src/pages/Dashboard/DashboardIndex.vue` to import and register the new component inside the `getWidgetComponent(type)` mapping:

```javascript
import LineChartWidget from 'src/components/_dashboard/LineChartWidget.vue'

function getWidgetComponent(type) {
  const components = {
    MetricWidget,
    BarChartWidget,
    DonutChartWidget,
    TimelineWidget,
    LineChartWidget // New registration
  }
  return components[type] || null
}
```

---

## 6. Step-by-Step Checklist to Deploy a New Widget

When creating a new widget config, execute this checklist to deploy:

1. **Verify Permissions**: Identify target resource requirements and format the permission gating contract `permission: { ResourceName: 'read' }`.
2. **Determine Widget Type**: Use the **Decision Matrix** to pick the right presentation model.
3. **Write Configuration File**: Place your config under `FRONTENT/src/dashboard/<scope>/<resource>/<widgetname>.js`. Ensure it is a clean default export.
4. **Test Packing**: Open the AQL Dashboard in a browser and verify the widget loads. Adjust visual `weight` or Quasar layout spans (`sm`, `md`, `lg` values out of 12) to fit perfectly.
5. **Verify Reactivity**: Edit the corresponding Sheet resource values and confirm the metric/chart updates reactively without forcing a page reload.
