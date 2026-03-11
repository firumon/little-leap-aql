# Dashboard Widgets Architecture

## Concept Overview
The dashboard is no longer a static layout tied exclusively to a single role. Instead, a user can be granted multiple roles (e.g., ProcurementManager, StoreKeeper) simultaneously. To deliver a customized and prioritized experience, the dashboard will dynamically aggregate **role-based widgets**.

## Design Philosophy
1. **Widgets Array**: Every role owns a set of specific dashboard widgets defined in constant files or database.
2. **Weighting Mechanism**: Each widget has an assigned `weight` (priority integer).
3. **Dynamic Rendering**: When a user logs in, the app cross-references their assigned roles and pulls the authorized widgets. These are then rendered in order based on their assigned `weight` on the dashboard.

## Proposed Roles & Respective Widgets

### ProcurementManager
- **Pending purchase requisitions** (Widget ID: `pm_pending_prs`, Weight: 100)
    - Shows Awaiting PRs metrics.
- **Awaiting RFQs** (Widget ID: `pm_awaiting_rfqs`, Weight: 90)
    - Shows how many quotes were sent but pending response.
- **PO Progress** (Widget ID: `pm_pos_in_transit`, Weight: 80)
    - Lists all active IN_TRANSIT procurements.

### StoreKeeper
- **Pending GRNs** (Widget ID: `sk_pending_grn`, Weight: 100)
    - Goods Receipt pending physical count update.
- **Awaiting Shipments** (Widget ID: `sk_arrival_alerts`, Weight: 90)
    - ETA count within next week.
- **Low Stock Alerts** (Widget ID: `sk_low_stock`, Weight: 80)
    - Highlights critical variant shortages.

### Accountant
- **Pending Port Clearance Duty** (Widget ID: `acc_pending_duty`, Weight: 100)
    - Unpaid port clearance records.
- **Recent Expenses** (Widget ID: `acc_recent_expenses`, Weight: 80)
    - Quick glance at recent outflows.

### Implementation Checklist Whenever Adding a New Role
- [ ] Define what primary objective this role achieves.
- [ ] Document 1-3 critical monitoring widgets that help the user achieve that objective.
- [ ] Add the widget IDs, endpoints used to fetch their data, and assign an appropriate comparative `weight` so it correctly layers against components of other roles.
- [ ] Build the Vue UI component for the widget in `frontend/src/components/widgets/`.
