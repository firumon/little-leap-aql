# Dashboard Development & Customization Guide

This document is the canonical reference and customization manual for building, configuring, and extending the AQL Dashboard module. Follow these protocols to keep the dashboard fully modular, performant, and secure.

For a comprehensive list of all out-of-the-box widgets, their detailed configurations, visual properties, and expected schema formats, please refer directly to the [Dashboard Widget Registry](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/dashboard/REGISTRY.md).

---

## 1. Directory Structure

All dashboard-related assets and files must strictly adhere to the following directory structure:

```
FRONTENT/
├── src/
│   ├── composables/
│   │   └── _dashboard/              # Central reactive dashboard composable
│   │       └── useDashboard.js
│   │
│   ├── dashboard/                   # Core Dashboard Module Root
│   │   ├── REGISTRY.md              # Reusable widget discovery and APIs
│   │   ├── _widgets/                # Pure Vue SVG Common Widget components
│   │   │   ├── MetricWidget.vue
│   │   │   ├── BarChartWidget.vue
│   │   │   ├── DonutChartWidget.vue
│   │   │   ├── StackedBarChartWidget.vue
│   │   │   └── TimelineWidget.vue
│   │   │
│   │   └── <scope>/                 # Dynamic Widget Configurations (Vite eager-loaded)
│   │       └── <resource>/          # e.g., purchaseRequisitions, rfqs
│   │           └── <widget>.js      # Config-driven JS widget files
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
      type: 'MetricWidget', // Maps to registered widget component type
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
- `eq`: Exact match equality (case-insensitive)
- `ne`: Inequality check (case-insensitive)
- `gt`: Greater than comparison for numerical fields
- `lt`: Less than comparison for numerical fields
- `in`: Checks if field value is contained within a supplied array or CSV string
- `contains`: Substring string match (case-insensitive)

---

## 3. Header-to-Widget Decision Matrix

When analyzing a resource sheet structure, refer to this matrix to auto-select the visual widget type and datasource pipeline:

| Column / Data Pattern | Visual Goal | Recommended Widget | DataSource Configuration |
|---|---|---|---|
| A status column (e.g., `Status`, `Progress`) with values like `Pending`, `Draft` | Present current workload queue size | **MetricWidget** | `pipeline: { filters: [{ field: 'Status', op: 'eq', value: 'Pending' }], aggregate: 'count' }` |
| Multiple transaction rows with numeric fields (e.g., `TotalAmount`, `Value`) | Present absolute financial volume | **MetricWidget** | `pipeline: { aggregate: { type: 'sum', field: 'TotalAmount' } }` |
| Groupable categories (e.g., `VendorName`, `Department`, `ItemCategory`) | Show top contributors or comparative levels | **BarChartWidget** | `evaluate` function grouping rows by key and aggregating sums, returning sorted top 5 array |
| Proportion segments summing up to a whole (e.g., `Status` split ratio) | Show composition or portfolio distribution | **DonutChartWidget** | `evaluate` function calculating unique counts per status as percentages, mapping to donut layout |
| Sequential records with dates (e.g., `CreatedAt`, `DueDate`) | Trace recent activity or alert lists | **TimelineWidget** | `evaluate` mapping function filtering for active items, sorting by date descending, slicing top 5 |

---

## 4. Extension Protocol: Adding New Widget Types

If the existing catalog does not cover a new requirement, follow these steps to build and register a new widget type:

### Step A: Implement a Pure Vue SVG Component
Create the component under `FRONTENT/src/dashboard/_widgets/` (e.g., `LineChartWidget.vue`).
- **No libraries**: Render chart elements using `<svg>`, utilizing reactive loops over coordinates.
- **Aesthetics**: Apply dynamic HSL themes, smooth CSS transitions, and SVG filter shadows.
- **State isolation**: Bind skeleton UI overrides to a `loading` Boolean property.
- **Zero Resource-Specific Hardcoding (STRICT)**: Never hardcode resource-specific names, status keys, legends, colors, or empty-state text labels directly in widget components. The component must be fully generic and reusable. Parameterize all labels, series config arrays (e.g., colors, keys, gradients), and empty-state messaging inside the declarative `.js` configuration's `metadata.config` section, allowing the visual layout to be cleanly reused across different modules or columns without code modifications.

### Step B: Register the Component in the Gateway Page
Modify `FRONTENT/src/pages/Dashboard/DashboardIndex.vue` to import and register the new component inside the `getWidgetComponent(type)` mapping:

```javascript
import LineChartWidget from 'src/dashboard/_widgets/LineChartWidget.vue'

function getWidgetComponent(type) {
  const components = {
    MetricWidget,
    BarChartWidget,
    DonutChartWidget,
    TimelineWidget,
    StackedBarChartWidget,
    LineChartWidget // New registration
  }
  return components[type] || null
}
```

### Step C: Update the Dashboard Widget Registry
Add the new widget component to the central [Dashboard Widget Registry](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/dashboard/REGISTRY.md) catalog. Detail the following aspects in the registry table:
- Component name and visual purpose.
- Expected value format (e.g., scalar, grouped array, stacked series).
- Config parameters block (detailing Series, Legend, Colors, Gradients, and Thresholds).
- Bounding paths.

---

## 5. Step-by-Step Checklist to Deploy a New Widget

When creating a new widget config, execute this checklist to deploy:

1. **Verify Permissions**: Identify target resource requirements and format the permission gating contract `permission: { ResourceName: 'read' }`.
2. **Determine Widget Type**: Use the **Decision Matrix** or consult the [Dashboard Widget Registry](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/dashboard/REGISTRY.md) to pick the right presentation model.
3. **Write Configuration File**: Place your config under `FRONTENT/src/dashboard/<scope>/<resource>/<widgetname>.js`. Ensure it is a clean default export.
4. **Test Packing**: Open the AQL Dashboard in a browser and verify the widget loads. Adjust visual `weight` or Quasar layout spans (`sm`, `md`, `lg` values out of 12) to fit perfectly.
5. **Verify Reactivity**: Edit the corresponding Sheet resource values and confirm the metric/chart updates reactively without forcing a page reload.
6. **Register New Visual Widgets**: If your implementation required building a new visual widget type under `src/dashboard/_widgets/`, confirm that it has been registered in the [Dashboard Widget Registry](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/dashboard/REGISTRY.md).
