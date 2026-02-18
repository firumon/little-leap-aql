# Ground-Level Operations Workflow (China to Ajman)

This document captures the real operational flow that AQL must support on the ground.

## Current Starting Point (as of 2026-02-18)
- Available product master data: 21 products with `SKU` and `Item Name`.
- Next implementation focus: inbound logistics, shipment tracking, clearance, warehouse receiving, shelf placement, and stock updates.

## Real-World Inbound Flow to Support
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
2. Build `Shipments` + `ShipmentItems` masters/transactions.
3. Build `PortClearance` tracking.
4. Build `GRN/Receiving` with variance handling.
5. Build `WarehouseLocations` and `Putaway` transactions.
6. Auto-post accepted quantities to inventory balance.
7. Add basic inbound reports:
- Pending shipments
- Shipment variance
- Current stock by SKU and location

## Data Entities for Next Sprint
- `Products`
- `Shipments`
- `ShipmentItems`
- `PortClearance`
- `GoodsReceipts`
- `GoodsReceiptItems`
- `WarehouseLocations`
- `StockMovements`

## Operational Rules to Enforce
- Shipment cannot be marked `Received` until GRN is completed.
- Inventory updates happen only from accepted GRN quantities.
- Variance and damage records are mandatory if mismatch exists.
- Every update must carry `UpdatedBy` and `UpdatedAt`.

## Notes for Future Contributors
This workflow is based on real field operations (owner-led import/clearance/receiving) and is the source of truth for inbound module design.
