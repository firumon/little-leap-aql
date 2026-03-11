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

## Real-World Procurement & Inbound Flow to Support (Enabler)
1. **Procurement Initiation:** A need is recognized and a parent Procurement Record (Code) is established.
2. **Purchase Requisition (PR):** Staff creates a PR with items needed. This passes through PENDING -> VERIFIED -> APPROVED.
3. **RFQ Generation (Optional):** If pricing is needed, an RFQ is generated for the approved PR and sent to multiple suppliers (SENT -> QUOTATION_RECEIVED).
4. **Quotation Evaluation:** Received supplier quotes (Pricing, Docs) are compared and a winner is chosen.
5. **Purchase Order Issuance:** A Supplier PO is generated containing finalized items and costs, then sent to the supplier. Supplier acknowledges and accepts.
6. **PO Fulfillment & Documentation:** All involved documents (LC, PI, BOL) are attached to the PO.
7. **Shipment Tracking:** Shipment is booked and tied to the PO. The parent Procurement progress changes to `IN_TRANSIT`.
8. **Port Arrival & Clearance:** Shipment arrives in UAE port. Port clearance document checks process and duty payments occur. Parent Procurement progress changes to `ARRIVED_AT_PORT`.
9. **Accounts Ledgering:** Payments for items, duty, and clearance are logged into specific `Chart of Accounts` sheets (Assets, Liabilities, Expenses).
10. **Goods Receipt (GRN):** At the warehouse, cartons are unboxed and physical verification against PO/Shipment expected quantities takes place. Discrepancies (Short/Excess/Damaged) are recorded.
11. **Stocking/Putaway:** Accepted quantities are mapped to shelf/bin locations, registering as `StockMovements`. Parent Procurement progress finally becomes `COMPLETED`.

## AQL Features That Can Be Implemented Immediately (with current 21 SKU list)
- Product Master: maintain SKU + Item Name (later add pack size, unit cost, sale price).
- Outlet Distribution Plan: allocation by outlet and period.
- Outlet Sales Capture: periodic sold quantity, balance stock, and variance.
- Collection Scheduler: due-cycle list and collection status per outlet.
- Refill Approval Flow: request, approve/reject, and dispatch status.
- Procurement Header: tracks end-to-end lifecycle.
- Reorder Alerts + Purchase Orders: trigger PR -> PO to supplier on low-stock risk.
- RFQ Management: compare suppliers and quotes.
- Shipment Header: shipment no, supplier, ETD/ETA, status, container/carrier, port dates.
- Clearance Tracking: customs status, clearance date, related costs.
- Goods Receipt Note (GRN): actual received quantity by SKU.
- Putaway/Shelf Assignment: map accepted stock to shelf/bin.
- Accounting automation: use Entry Templates to seamlessly book expenses into Asset/Liability ledgers.

## Data Entities for Next Sprint
- `Products`, `Outlets`, `OutletStockAllocations`, `OutletSales`, `CollectionCycles`, `OutletPayments`
- **Procurement & Purchasing:** `Procurements`, `PurchaseRequisitions`, `PurchaseRequisitionItems`, `RFQs`, `RFQItems`, `RFQSuppliers`, `SupplierQuotations`, `SupplierQuotationItems`, `PurchaseOrders`, `PurchaseOrderItems`, `POFulfillments`
- **Inbound & Stocking:** `Shipments`, `ShipmentItems`, `PortClearance`, `GoodsReceipts`, `GoodsReceiptItems`, `WarehouseStorages`, `StockMovements`
- **Accounts:** `ChartOfAccounts`, `EntryTemplates`, `Assets`, `Liabilities`, `Equity`, `Revenue`, `Expenses`

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
