# AQL Dashboard Implementation

> **Scope boundary**: This document covers dashboard widget implementation only — widget config contracts, declarative pipelines, SVG widget creation, dashboard registries. Its pre-reads reference FRONTENT files and canonical docs — read them by path. Do NOT load frontend_modification.md unless the task explicitly requires modifying non-dashboard frontend code.

Use this document to initialize an AI agent session when the task involves creating, modifying, extending, or debugging dashboard widgets, layouts, or the dashboard composable.

---

## 1. System Architecture & Coordination

The AQL Dashboard is a fully declarative, metadata-driven widget system. Widgets are defined as standalone `.js` configuration files — no Vue component creation is needed for standard widget types.

### A. Core File Coordinates
* **Widget Config Files**: `FRONTENT/src/dashboard/<scope>/<resource>/<widget>.js` (Vite eager-loaded)
* **Central Composable**: [useDashboard.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/_dashboard/useDashboard.js) — orchestrates widget discovery, permission filtering, and data resolution
* **Gateway Page**: [DashboardIndex.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/pages/Dashboard/DashboardIndex.vue) — assembles and renders the widget grid
* **Visual Widget Components**: `FRONTENT/src/dashboard/_widgets/` — Pure Vue SVG components (MetricWidget, BarChartWidget, DonutChartWidget, StackedBarChartWidget, TimelineWidget)
* **Widget Registry**: [REGISTRY.md](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/dashboard/REGISTRY.md) — canonical catalog of all widget types and their config contracts

---

## 2. Mandatory Pre-Reads

Before writing any dashboard code:
* Full development guide: [FEATURE_DASHBOARD_GUIDE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/FEATURE_DASHBOARD_GUIDE.md)
* Widget registry and config contracts: [dashboard/REGISTRY.md](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/dashboard/REGISTRY.md)
* Frontend architecture rules: [CORE_ARCHITECTURE_RULES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/CORE_ARCHITECTURE_RULES.md)

---

## 3. Widget Configuration Contract

Every widget exports a default object with this structure:
```javascript
export default {
  metadata: {
    id: 'unique_widget_id',
    scope: 'operations',              // 'operation' | 'accounts' | 'master'
    resource: 'purchaseRequisitions', // Primary resource for permission gating
    permission: { purchaseRequisitions: 'read' },
    config: {
      type: 'MetricWidget',           // Maps to registered widget component
      title: 'Awaiting Approvals',
      icon: 'pending_actions',
      color: 'orange',
      weight: 100,                    // Higher = floats to top
      layout: { xs: 12, sm: 6, md: 4, lg: 3 }
    },
    dataSource: {
      resource: 'purchaseRequisitions',
      pipeline: {
        filters: [{ field: 'Status', op: 'eq', value: 'Pending Approval' }],
        aggregate: { type: 'count' }
      }
    }
  }
}
```

### Header-to-Widget Decision Matrix

| Data Pattern | Widget Type | DataSource Config |
|---|---|---|
| Status column with discrete values | **MetricWidget** | `pipeline: { filters: [...], aggregate: 'count' }` |
| Numeric fields needing totals | **MetricWidget** | `pipeline: { aggregate: { type: 'sum', field: 'Amount' } }` |
| Groupable categories | **BarChartWidget** | `evaluate` function grouping rows |
| Proportion segments | **DonutChartWidget** | `evaluate` function calculating percentages |
| Sequential records with dates | **TimelineWidget** | `evaluate` function filtering and sorting by date |

---

## 4. Step-by-Step Implementation Checklist

### Adding a New Widget Config (Standard)
1. **Identify Target**: Determine the scope, resource, and data pattern.
2. **Choose Widget Type**: Use the Decision Matrix above or consult the [Dashboard Widget Registry](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/dashboard/REGISTRY.md).
3. **Create Config File**: Place under `FRONTENT/src/dashboard/<scope>/<resource>/<widgetname>.js`.
4. **Set Permission Gate**: Configure `permission: { ResourceName: 'read' }` to match user access.
5. **Configure DataSource**: Use `pipeline` for declarative filter-aggregate or `evaluate` for custom logic.
6. **Test**: Open the AQL Dashboard and verify widget loads, data displays correctly, and layout is responsive.

### Creating a New Widget Type (Custom Visual)
1. **Build Component**: Create under `FRONTENT/src/dashboard/_widgets/` using pure SVG rendering — no chart libraries.
2. **Register**: Import in [DashboardIndex.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/pages/Dashboard/DashboardIndex.vue) `getWidgetComponent()` mapping.
3. **Document**: Add to [dashboard/REGISTRY.md](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/dashboard/REGISTRY.md).

---

## 5. Explicit Guardrails (DOs and DO NOTs)

- **DO NOT** hardcode resource names, status keys, legends, or colors inside widget Vue components. Parameterize everything in the `.js` config.
- **DO NOT** use external charting libraries. All charts must use pure SVG with reactive Vue bindings.
- **DO NOT** place business logic in the DashboardIndex.vue page. Logic belongs in `useDashboard.js`.
- **DO NOT** exceed the strict **400 lines limit** per file. Split components and composables if they grow beyond this boundary.
- **DO** use the `allowed()` permission helper for widget visibility gating.
- **DO** use `_C(value)` from `useCurrency` for money formatting in `evaluate` functions.
- **DO** follow the responsive grid layout system (`xs`, `sm`, `md`, `lg` columns out of 12).

---

## 6. Targeted Verification Plan

1. **Visual Check**: Open the Dashboard page and verify the widget renders in the correct grid position.
2. **Data Accuracy**: Cross-reference the widget's displayed value against the raw sheet data.
3. **Permission Gate**: Log in with a restricted role and verify the widget is hidden.
4. **Reactivity**: Modify underlying sheet data and confirm the widget updates without page reload.
5. **Registry Update**: If a new widget type was created, verify it's documented in [REGISTRY.md](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/dashboard/REGISTRY.md).
