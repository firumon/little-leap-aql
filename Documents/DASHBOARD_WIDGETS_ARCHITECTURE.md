# Dashboard Widgets Architecture

## Purpose
This document captures the planned dashboard-widgets architecture for upcoming work. It is intentionally future-facing.

## Concept Overview
The dashboard should support multiple roles per user and assemble a prioritized widget set from those roles instead of relying on one fixed layout.

## Design Philosophy
1. each role can own a set of widgets
2. widgets can be prioritized with weights
3. the dashboard can aggregate and order widgets across the user's active roles

## Example Role Areas

### ProcurementManager
- pending purchase requisitions
- awaiting RFQs
- purchase-order progress

### StoreKeeper
- pending GRNs
- shipment arrival alerts
- low-stock alerts

### Accountant
- pending duty/clearance costs
- recent expense visibility

## Implementation Checklist
- define each role's primary objectives
- define the most useful widgets for those objectives
- define how widget authorization and ordering should work
- define the data sources/endpoints required for each widget

## Maintenance Rule
Update this file when:
- dashboard widget strategy becomes active implementation work
- role-to-widget mapping changes
- the planned widget architecture or prioritization model changes
