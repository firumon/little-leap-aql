# PROCUREMENT Google Sheet Structure

This document defines the OPERATION file structure for the Procurement workflow.

## The Core Process
The entire international procurement process pivots around a master operation reference: the **PROCUREMENT CODE**. This code links from PR through to PO and Fulfillments.

## 1) Procurements (Parent Header)
Tracks the overarching goal of purchasing something.

Columns:
- `Code` (Prefix: PRC)
- `Progress` (INITIATED, PR_CREATED, PR_APPROVED, RFQ_GENERATED, PO_ISSUED, IN_TRANSIT, ARRIVED_AT_PORT, COMPLETED, CANCELLED)
- `InitiatedDate`
- `CreatedRole`
- `Status`
- Audit Columns

## 2) PurchaseRequisitions
Internal requests for a procurement.
Columns:
- `Code` (Prefix: PR)
- `ProcurementCode` (FK)
- `Progress` (PENDING, VERIFIED, APPROVED, REJECTED)
- `ProgressPENDINGAt`
- `ProgressPENDINGBy`
- `ProgressPENDINGComment`
- `Status`
- Audit Columns

## 3) PurchaseRequisitionItems
- `Code` (Prefix: PRI)
- `PRCode` (FK)
- `SKU` (Expected items)
- `Quantity`
- `ExpectedDate`
- `Notes`

## 4) RFQs and RFQItems
Requests for Quotations generated from the PR.
**RFQs Columns:**
- `Code` (Prefix: RFQ)
- `ProcurementCode`
- `Deadline`
- `Terms`
- `Progress` (DRAFT, PUBLISHED, CLOSED)
**RFQItems:**
- `Code`, `RFQCode`, `SKU`, `Quantity`

## 5) RFQSuppliers
Tracks which suppliers were invited to the RFQ.
- `Code`, `ProcurementCode`, `RFQCode`, `SupplierCode`
- `Progress` (SENT, QUOTATION_RECEIVED, APPROVED, REJECTED)

## 6) SupplierQuotations and Items
The quotes returned by suppliers.
- `Code` (Prefix: SQ), `ProcurementCode`, `SupplierCode`, `RFQCode`, `DocumentUrl`, `TotalAmount`, `Currency`, `ValidUntil`
- **Items:** `QuotationCode`, `SKU`, `SupplierItemCode`, `Quantity`, `UnitPrice`

## 7) PurchaseOrders and Items
The final purchase order sent to the chosen supplier.
- `Code` (Prefix: PO), `ProcurementCode`, `SupplierCode`, `RFQCode`, `QuotationCode`
- `Progress` (DRAFT, APPROVED, SENT_TO_SUPPLIER, SUPPLIER_ACKNOWLEDGED, SUPPLIER_ACCEPTED)
- `TotalAmount`, `Currency`
- **Items:** `POCode`, `SKU`, `SupplierItemCode`, `Quantity`, `UnitPrice`, `TotalPrice`

## 8) POFulfillments
Tracks all documents associated throughout this process (Letter of Credit, Bill of Lading, Invoices).
- `Code`, `ProcurementCode`, `POCode`, `DocumentName`, `Description`, `Purpose`, `DocumentUrl`

## Setup
Ran from `setupAllOperations` action (inside `setupOperationSheets.gs`). Ensures sheets exist and applies data validations to columns.
