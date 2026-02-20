# Ground-Level Operations Workflow (Outlet Distribution + Inbound Support)

This document captures the real operational flow that AQL must support on the ground.

## Current Starting Point (as of 2026-02-20)
- Available product master data: 21 products with `SKU` and `Item Name`.
- Primary implementation focus: outlet distribution cycle, periodic sales capture, strict-cycle collections, approved refill, and timely purchase ordering.

## Real-World Commercial Heartbeat to Support (Primary)
1. Products are distributed to outlets (pharmacies/retail points).
2. Outlet sales are tracked on periodic intervals.
3. Payment collection is performed on strict scheduled intervals.
4. Refill requests are reviewed and approved by authorized roles before stock movement.
5. Refill dispatch updates outlet stock and central inventory.
6. Low-stock/reorder threshold triggers supplier purchase order creation.
7. Purchase order is tracked until supply is replenished.

## Real-World Inbound Flow to Support (Enabler)
1. Product list and quantities are finalized for manufacturing/import from China.
2. Shipment is booked (container/carrier details recorded).
3. Shipment arrives in UAE port.
4. Port clearance process is completed (documents, duties, handling costs).
5. Goods are transported from port to Ajman warehouse:
- by owner directly, or
- by container carrier.
6. At warehouse, cartons are unboxed.
7. Physical verification is done against expected shipment quantities.
8. Short/excess/damaged quantities are recorded.
9. Accepted quantities are placed into shelf/bin locations.
10. System stock is updated per SKU and location.

## AQL Features That Can Be Implemented Immediately (with current 21 SKU list)
- Product Master: maintain SKU + Item Name (later add pack size, unit cost, sale price).
- Outlet Distribution Plan: allocation by outlet and period.
- Outlet Sales Capture: periodic sold quantity, balance stock, and variance.
- Collection Scheduler: due-cycle list and collection status per outlet.
- Refill Approval Flow: request, approve/reject, and dispatch status.
- Reorder Alerts + Purchase Orders: trigger PO to supplier on low-stock risk.
- Shipment Header: shipment no, supplier, ETD/ETA, status, container/carrier, port dates.
- Shipment Lines: SKU-wise expected quantity.
- Clearance Tracking: customs status, clearance date, related costs.
- Transport to Warehouse: transport mode, carrier/driver, vehicle/container reference.
- Goods Receipt Note (GRN): actual received quantity by SKU.
- Variance Capture: expected vs received vs damaged vs accepted.
- Putaway/Shelf Assignment: map accepted stock to shelf/bin/location in Ajman warehouse.
- Stock Ledger Movement: create auditable inventory movements for every inbound action.

## Recommended Implementation Sequence (Next)
1. Finalize `Products` sheet for 21 SKUs.
2. Build `OutletStockAllocations` + periodic sales capture.
3. Build collection cycles and payment tracking per outlet.
4. Build refill request + approval + dispatch flow.
5. Build low-stock reorder alerts + supplier purchase order flow.
6. Build/continue inbound enablers: `Shipments`, `PortClearance`, `GRN`, `Putaway`.
7. Add operational reports:
- Outlet sales by period
- Collection due vs collected
- Refill approval aging
- Reorder risk and open POs
- Current stock by SKU and location

## Data Entities for Next Sprint
- `Products`
- `Outlets`
- `OutletStockAllocations`
- `OutletSales`
- `CollectionCycles`
- `OutletPayments`
- `RefillRequests`
- `RefillApprovals`
- `PurchaseOrders`
- `PurchaseOrderItems`
- `Shipments`
- `ShipmentItems`
- `PortClearance`
- `GoodsReceipts`
- `GoodsReceiptItems`
- `WarehouseLocations`
- `StockMovements`

## Operational Rules to Enforce
- Outlet sales and collection tracking must follow configured periodic cycle.
- Payment follow-up must be strict against cycle due dates.
- Refill dispatch requires approval by authorized roles.
- Purchase orders must be raised before reorder threshold breach.
- Shipment cannot be marked `Received` until GRN is completed.
- Inventory updates happen only from accepted GRN quantities.
- Variance and damage records are mandatory if mismatch exists.
- Every update must carry `UpdatedBy` and `UpdatedAt`.

## Notes for Future Contributors
This workflow is based on real field operations and is the source of truth for commercial distribution-first system design, with inbound operations as a supporting enabler.
