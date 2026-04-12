# Ground Operations Workflow

## Purpose
This is the canonical business and field-workflow reference for AQL. It describes the real operating flow the system is meant to support.

## Commercial Heartbeat
The primary operating loop is:
1. distribute products to outlets
2. track outlet sales on periodic cycles
3. collect payments on strict intervals
4. approve and execute refills
5. raise supplier purchase orders before stock-out risk

Inbound and warehouse operations support this loop.

## Core Entities
- `Products`
- `SKUs`
- `Suppliers`
- `Warehouses`
- `WarehouseStorages`
- `Shipments`
- `GoodsReceipts`
- `StockMovements`
- future outlet/commercial entities such as `Outlets`, `Invoices`, and `Payments`

## Procurement and Inbound Flow
1. purchasing need is identified
2. purchase requisition is created and approved
3. RFQ/quotation comparison happens when needed
4. purchase order is issued to supplier
5. shipment is booked and tracked
6. port arrival and clearance are completed
7. goods are received and verified at warehouse
8. accepted stock is put away and recorded in system

## Field Reality at Warehouse
1. goods arrive in UAE
2. port clearance is completed
3. cartons reach the warehouse
4. physical quantities are checked
5. variance or damage is noted
6. accepted stock is assigned to storage locations
7. inventory becomes available for downstream operations

## Operational Rules
- payment and collection tracking must follow configured cycles
- refill movement should follow approval rules where applicable
- purchase planning should happen before reorder risk becomes critical
- inventory should reflect accepted and recorded stock movement, not unverified assumptions
- audit fields and operator traceability matter for all important operational records

## Canonical Detail Owners
- System/runtime view: [OVERVIEW.md](F:/LITTLE%20LEAP/AQL/Documents/OVERVIEW.md)
- Module-specific implementation flow: [MODULE_WORKFLOWS.md](F:/LITTLE%20LEAP/AQL/Documents/MODULE_WORKFLOWS.md)
- Data structure references: sheet structure docs in `Documents/`

## Maintenance Rule
Update this file when:
- the real business heartbeat changes
- the inbound/procurement field flow changes materially
- key business entities or operational rules change
