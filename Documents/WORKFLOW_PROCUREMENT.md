# 📦 Procurement & Warehouse Inventory Workflow

## Purpose
This document is the canonical business and software workflow specification for supply chain, inbound procurement, product variants, and warehouse inventory management in AQL.

---

## 1. Supply Chain & Inbound Lifecycle

The procurement and inbound inventory cycle governs how stock is ordered from suppliers, imported into the UAE, inspected at the warehouse, and made available for commercial distribution:

```mermaid
graph TD
    PR[1. Purchase Requisition] --> RFQ[2. RFQ Dispatch to Suppliers]
    RFQ --> SQ[3. Supplier Quotation Response]
    SQ --> PO[4. Purchase Order Issuance]
    PO --> REC[5. PO Receiving & Quality Inspection]
    REC --> GRN[6. Goods Receipt Note (GRN)]
    GRN --> STK[7. Warehouse Stock Posting (WarehouseStorages)]
```

---

## 2. Core Entities & Data Architecture

| Entity | Role & Scope | Key State Column & Allowed Values |
|---|---|---|
| `Products` | Master product definitions with variant configuration | `Status` (`Active`, `Inactive`), `VariantTypes` (CSV) |
| `SKUs` | Individual inventory items / variants under a product | `ProductCode`, `Variant1`..`Variant5`, `Status` |
| `Suppliers` | Supplier profiles, currency, and contact info | `Status` (`Active`, `Inactive`) |
| `PurchaseRequisitions` | Internal purchase requests | `Progress` (`Draft`, `Submitted`, `Approved`, `Cancelled`) |
| `RFQs` | Request for Quotation sent to suppliers | `Progress` (`Draft`, `Sent`, `Closed`, `Cancelled`) |
| `SupplierQuotations` | Captured supplier pricing responses | `Progress` (`Received`, `Accepted`, `Rejected`) |
| `PurchaseOrders` | Official purchase order contracts issued to suppliers | `Progress` (`DRAFT`, `PO_ISSUED`, `GOODS_RECEIVING`, `GRN_GENERATED`, `COMPLETED`, `CANCELLED`) |
| `PurchaseOrderItems` | Line items under a Purchase Order | `ItemCode`, `OrderedQty`, `UnitPrice` |
| `POReceivings` | Editable inspection layer before GRN finalization | `Progress` (`DRAFT`, `CONFIRMED`, `GRN_GENERATED`, `CANCELLED`) |
| `POReceivingItems` | Inspection counts (received, damaged, rejected, short) | `ReceivedQty`, `DamagedQty`, `RejectedQty` |
| `GoodsReceipts` | Finalized read-only Goods Receipt Notes (GRN) | `Status` (`Active`, `Inactive`) |
| `GoodsReceiptItems` | Final accepted quantities posted to stock | `AcceptedQty` |
| `StockMovements` | Transactional warehouse stock ledger | `ReferenceType` (`GRN`, `OutletRestock`, `DirectEntry`, `Adjustment`), `QtyChange` |
| `WarehouseStorages` | Live SKU balances per warehouse location | `WarehouseCode`, `StorageName`, `SKU`, `Quantity` |

---

## 3. Detailed Workflow Modules

### 3.1 Product Variant Management (`Products` & `SKUs`)
- **Variant Schema**: `Products.VariantTypes` holds a comma-separated list of variant attribute names (e.g. `Color, Size, Material`).
- **Dynamic SKU Mapping**: Position in CSV maps directly to `SKUs.Variant1` through `SKUs.Variant5`.
- **Composite Add/Edit UX**: Creating or editing a product dynamically generates variant input tables based on `VariantTypes`.

### 3.2 RFQ Supplier Dispatch & Quotations
1. **Requisition**: Purchasing need is identified based on inventory stock-out risk.
2. **RFQ Dispatch**: RFQ is created and dispatched to eligible suppliers for competitive bidding.
3. **Quotation Capture**: Received quotes are entered into `SupplierQuotations` for comparison (unit cost, lead time, payment terms).

### 3.3 Purchase Order Module (`PurchaseOrders`)
1. **PO Generation**: A Purchase Order is generated from the winning quotation (`Progress = DRAFT`).
2. **Issuance (`PO_ISSUED`)**: Upon management approval, the PO is issued to the supplier and shipment tracking begins.
3. **Inbound Tracking**: Monitors port arrival, customs clearance, and container delivery to the central warehouse.

### 3.4 PO Receiving & Quality Inspection (`POReceivings`)
1. **Receiving Initiation**: Users open `/operation/po-receivings/_add` and select an active Purchase Order.
2. **Inspection Entry**: Staff inspect incoming cartons, recording `ReceivedQty`, `DamagedQty`, and `RejectedQty` in `POReceivingItems`.
3. **Draft Resumption**: Active drafts can be saved (`compositeSave`) and resumed across shifts.
4. **Confirmation**: Executing the `Confirm` action validates counts and sets receiving progress to `CONFIRMED`.

### 3.5 Goods Receipt Note Generation (`GoodsReceipts`)
1. **GRN Finalization**: Executing `GenerateGRN` AdditionalAction creates an immutable `GoodsReceipts` record and copies accepted quantities into `GoodsReceiptItems`.
2. **Procurement State Transition**: Linked `PurchaseOrders` progress advances to `GRN_GENERATED` and then `COMPLETED`.
3. **Invalidation Protection**: Inactivating a GRN (`Status = Inactive`) rolls the receiving record back to `CONFIRMED` and returns procurement status to `GOODS_RECEIVING`.

### 3.6 Warehouse Stock Posting (`StockMovements` & `WarehouseStorages`)
1. **GRN Stock Entry**: Eligible finalized GRNs are posted to warehouse stock from `/operation/stock-movements/grn-entry`.
2. **Stock Movements Ledger**: Creates positive `StockMovements.QtyChange` rows with `ReferenceType = GRN` and `ReferenceCode = GoodsReceipts.Code`.
3. **Balance Update**: The backend post-write hook updates `WarehouseStorages` in real time, making stock immediately available for outlet refill allocations.
4. **Direct Stock Entry**: For manual corrections or initial stock intake, the direct stock register allows authenticated stock adjustments with audit logging.

---

## 4. Architectural Boundaries

- **Backend Hook Enforcement**: Stock posting, GRN generation, and status cascades are strictly governed by backend post-write hooks (`GAS/resourceApi.gs`).
- **Frontend Layering**: Adheres to `Documents/CORE_ARCHITECTURE_RULES.md`; multi-record writes execute via atomic batch requests without manual client-side cache duplication.

---

## Maintenance Rule
Update this document whenever procurement approval rules, receiving inspection contracts, or warehouse inventory posting logic change.
