# APP.Resources Columns Guide

## Purpose
This document is the canonical meaning reference for `APP.Resources` columns.

## Key Points
- one row = one resource
- resource names should remain stable once routes/permissions depend on them
- JSON columns must contain valid JSON when populated
- blank values may be meaningful for some metadata fields depending on runtime rules

## Important Column Areas
- identity and placement
  - `Name`, `Scope`, `ParentResource`, `IsActive`, `FileID`, `SheetName`
- code/audit/sync
  - `CodePrefix`, `CodeSequenceLength`, `LastDataUpdatedAt`, `Audit`
- validation/defaults
  - `RequiredHeaders`, `UniqueHeaders`, `UniqueCompositeHeaders`, `DefaultValues`
- access and actions
  - `RecordAccessPolicy`, `OwnerUserField`, `AdditionalActions`
- UI/runtime metadata
  - `Menu`, `UIFields`, `IncludeInAuthorizationPayload`, `Functional`, `PreAction`, `PostAction`, `Reports`, `ListViews`, `CustomUIName`

## Usage Notes
- `FileID` may be blank when scope-level resolution is intended.
- `Menu` and other UI metadata should be treated as runtime configuration, not casual prose.
- Progress/action-tracking columns in target sheets must stay aligned with workflow/action design.

## Notable Column Dependencies
- `SKUs` resource now requires `UOM` column.
- `Procurements` resource now requires `CreatedUser` column.
- `PurchaseRequisitions` workflow now uses `ProgressRevisionRequiredAt`, `ProgressRevisionRequiredBy`, `ProgressRevisionRequiredComment`, `ProgressApprovedAt`, `ProgressApprovedBy`, `ProgressApprovedComment`, `ProgressRejectedAt`, `ProgressRejectedBy`, and `ProgressRejectedComment` columns aligned with the PR status machine.
- `RFQSuppliers` uses `Progress` (starts at `ASSIGNED`, moves to `SENT` and beyond) and `SentDate` (stamped when moving to `SENT` or when responding directly from `ASSIGNED`).
- `SupplierQuotations` captures normalized supplier responses with `ResponseType` values `QUOTED`, `PARTIAL`, and `DECLINED`; `Progress` values `RECEIVED`, `ACCEPTED`, and `REJECTED`; and reject tracking columns `ProgressRejectedComment`, `ProgressRejectedAt`, and `ProgressRejectedBy`. Features `AllowPartialPO` and `SupplierQuotationReference`.
- `RFQs` support `Progress` values `DRAFT`, `SENT`, `CLOSED`, and `CANCELLED`. The configured `Close` AdditionalAction sets `Progress = CLOSED` and uses `ProgressClosedComment`, `ProgressClosedAt`, and `ProgressClosedBy` when those columns are present.
- `SupplierQuotationItems` links to its parent through `SupplierQuotationCode` and to source demand through `PurchaseRequisitionItemCode`; partial/full quote state is calculated at runtime and must not be stored as `IsQuoted` or similar flags.
- `PurchaseOrders` progress mapped to `PurchaseOrderProgress` and child linked via `PurchaseOrderItems.PurchaseOrderCode`.
- `POReceivings` requires direct `ProcurementCode` plus `PurchaseOrderCode`; progress maps to `POReceivingProgress` (`DRAFT`, `CONFIRMED`, `GRN_GENERATED`, `CANCELLED`) and uses action audit columns for Confirm, GenerateGRN, and Cancel. PO Receiving workflow side effects are frontend-batch orchestrated, not `PostAction`-owned.
- `POReceivingItems` stores only inspection entry quantities (`ExpectedQty`, `ReceivedQty`, `DamagedQty`, `RejectedQty`); accepted/short/excess quantities are derived in frontend composables and not persisted.
- `GoodsReceipts.Status = Inactive` means the GRN was invalidated. `GoodsReceiptItems.Qty` stores accepted quantity only. GRN creation/invalidation side effects are frontend-batch orchestrated.
- `StockMovements.ReferenceType = GRN` and `ReferenceCode = GoodsReceipts.Code` marks a GRN as posted to stock. `OutletRestock` marks warehouse stock allocated/reserved at `OutletRestockItems` allocation time. These ledger rows update `WarehouseStorages` through the existing StockMovements post-write hook. Delivery draft cancellation does not create warehouse reversal movements because outlet delivery drafts do not move warehouse stock.
- `ProcurementProgress` includes `GOODS_RECEIVING` and `GRN_GENERATED` to align PO receiving and GRN lifecycle state.
- `Outlets` is a master resource for customer/retail locations. `OutletOperatingRules` is master rule data keyed by `OutletCode`.
- `OutletVisits.Status` uses normal active/inactive record state (`Active`, `Inactive`). `OutletVisits.Progress` uses `PLANNED`, `COMPLETED`, `POSTPONED`, and `CANCELLED`; progress transitions are performed through configured additional actions and stamp `Progress<Progress>At`, `Progress<Progress>By`, and `Progress<Progress>Comment` columns when present. Visit rows do not use sales-user/link fields.
- `OutletRestocks.Progress` uses `DRAFT`, `PENDING_APPROVAL`, `REVISION_REQUIRED`, `APPROVED`, `PARTIALLY_DELIVERED`, `DELIVERED`, and `REJECTED`; these values must be present in `APP.AppOptions` as `OutletRestockProgress`. AdditionalActions must include Submit, Approve, Reject, and SendBack.
- `OutletRestocks` rows are directly editable only before submission (`DRAFT`) or after send-back (`REVISION_REQUIRED`). Submitted/approved/delivered/rejected states are workflow-locked except configured action or delivery side-effect updates. `RequestedUser` and `ApprovedUser` are readable user-name fields, not user-code lookup fields.
- `OutletDeliveryProgress` uses `DRAFT`, `IN_TRANSIT`, `COMPLETED`, and `CANCELLED`. `OutletDeliveries` is a multi-outlet delivery header with `Date`, `UserName`, `OutletRestockItemCodes` (CSV of ORI codes), derived `Progress`, progress stamp/comment columns, cancel audit fields, `Status`, and `AccessRegion`. Item details are read from `OutletRestockItems` matched against the CSV.
- `OutletConsumptions` stores outlet stock-count sessions. `OutletVisitCode` is optional context only. `Progress` uses `PENDING_INVOICE_GENERATION`, `INVOICE_GENERATED`, and `CANCELLED`, with matching `Progress<Status>At/By/Comment` action-stamp columns.
- `OutletConsumptionItems.Qty` stores final sold quantity only (no `ConsumedQty`, opening stock, or counted stock columns are persisted).
- `PriceList` stores SKU prices via inline JSON in `SKUPrices` (used when `App.Config.PriceListLookup = INLINE`) or via child `PriceListItems` rows (used when `App.Config.PriceListLookup = ITEMS`). `IsDefault` marks the fallback price list used when `OutletOperatingRules.PriceListCode` is blank.
- `PriceListItems` is keyed by composite `PriceListCode + SKUCode`; `Price` is a number.
- `Currencies` uses manual codes (e.g. `AED`, `INR`) via `Code` column; `CodePrefix` and `CodeSequenceLength` are empty/0. `ConversionFactor` stores the current conversion rate (not historical).
- `OutletOperatingRules.PriceListCode` is optional; resolution falls back to `PriceList` where `IsDefault = TRUE`.
- `OutletConsumptionInvoices` stores consumption invoice headers with optional `PriceListCode`, `Subtotal`, `Discount`, `Tax`, and `Progress` (`PENDING_PAYMENT`, `PARTIALLY_PAID`, `PAID`, `CANCELLED`). Pricing resolution can use `OutletOperatingRules.PriceListCode` or fallback to the default `PriceList`; paid/balance totals are deferred to the receipt module.
- `OutletConsumptionInvoiceItems` stores invoice line items linked to `OutletConsumptionInvoices` by `OutletConsumptionInvoiceCode`. Each row records the priced `SKU`, `Qty`, and `Price`. Composite uniqueness is `OutletConsumptionInvoiceCode+SKU`. The invoice header `Subtotal` is generated as `sum(Qty * Price)` from active item rows.
- `OutletRestockItems` is the atomic allocated/delivered unit for outlet restocking. Creator rows start as `Progress = PENDING` with `SKU`, `Quantity`, and blank `WarehouseCode` / `StorageName`. Approvers allocate full or partial quantities by setting row-level `WarehouseCode`, `StorageName`, `Quantity`, and `Progress = ALLOCATED`; partial allocation creates an additional PENDING ORSI row for the remainder. Delivery marks the same ORSI row `DELIVERED`.
- `OutletMovements.ReferenceType = RestockDelivery` marks positive outlet stock from delivered ORSI rows, using `ReferenceCode = OutletDeliveries.Code`. `OutletMovements.ReferenceType = Consumption` marks negative stock from outlet consumption.
- `OutletMovements` updates `OutletStorages` through `handleOutletMovementsBulkSave`; `OutletStorages` is keyed by `OutletCode + SKU`, contains only `Code`, `OutletCode`, `SKU`, and `Quantity`, has no audit columns, and is read-only to frontend operation pages.

## File Type Columns (Field Type: "file")

When a resource requires file uploading and download capabilities (e.g., licences, certificates, invoices), the field should be configured as a `"file"` type.

### 1. Database & Schema Configuration
- **Sheet Column**: Add a standard text column in the resource's Google Sheet (e.g., `license`). This column stores only the generated `UUID` string (or remains blank).
- **APP.Resources `UIFields`**: Define the field inside the `UIFields` JSON array with `"type": "file"`. You can also optionally configure validation parameters:
  - `"accept"`: Comma-separated list of allowed extensions/MIME types (e.g. `".pdf,.jpg,.png"`, defaults to `*`).
  - `"maxSize"`: Maximum allowed file size in MB (defaults to `10`).
  ```json
  {
    "name": "license",
    "label": "Warehouse License",
    "type": "file",
    "required": true,
    "accept": ".pdf,.png,.jpg",
    "maxSize": 5
  }
  ```

### 2. Frontend Lifecycle & Components
- **Form Edit/Add**: The form builders automatically render the `AqlFileUpload` component. Selecting a file initiates an immediate background upload to the storage server's `_temp/` directory.
- **Form Save Pipeline**: On form submission, the composite form composable (`useCompositeForm.js`) submits the resource data (with the file's `UUID`) to Google Apps Script. Upon success, the frontend calls the storage service to confirm and move the file folder from `_temp/` to permanent storage (`uploads/`).
- **Details/Views**: View details grids automatically render `AqlFilePreviewCard` for `"file"` fields. This component reads the local IndexedDB cache (`aql_uploaded_files`), fallback fetching the storage server metadata endpoint if needed, and renders an image preview (with lightbox support) or download button with appropriate file-type icons.

## ListViews Column Schema & Usage
The `ListViews` column in the `APP.Resources` sheet defines custom data filter views for the resource.
* **Purpose**: Configures tab/segment views to filter record datasets on the resource index pages.
* **Format**: A JSON array of view configuration objects.
* **Overriding Rule**: If populated with a JSON array (or `[]` to explicitly disable switcher), custom template/modifier overriding for the views switcher is disabled. If blank, overrides are allowed.
* **Detailed JSON Schema & Operators**: For the complete specification of the filter group/condition JSON objects and supported comparison operators, refer to the canonical [AQL Frontend List Switcher Guide](file:///f:/LITTLE%20LEAP/AQL/Documents/AQL_FRONTEND_LIST_SWITCHER.md#L126-L177).

## Scope Characteristics
- `master`: Standard CRUD with auto-generated codes, audit columns, full sync.
- `operation`: Transactional records with auto-generated year-scoped codes (e.g., PR26000001), audit columns, full sync.
- `accounts`: Financial/accounting records, similar to operation scope.
- `report`: Read-only aggregated data, no CRUD operation.
- `view`: Read-only formula-driven sheets, no CRUD operation, no audit, no code generation, returns all non-empty rows without pagination.

## Canonical Detail Owners
- APP control-plane context: [APP_SHEET_STRUCTURE.md](F:/LITTLE%20LEAP/AQL/Documents/APP_SHEET_STRUCTURE.md)
- Registry/runtime behavior: [RESOURCE_REGISTRY_ARCHITECTURE.md](F:/LITTLE%20LEAP/AQL/Documents/RESOURCE_REGISTRY_ARCHITECTURE.md)
- Module workflow behavior: [MODULE_WORKFLOWS.md](F:/LITTLE%20LEAP/AQL/Documents/MODULE_WORKFLOWS.md)

## Maintenance Rule
Update this file when:
- a `Resources` column is added, removed, renamed, or repurposed
- accepted values or semantics of a column change
- runtime expectations for metadata fields change materially

