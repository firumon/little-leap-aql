# Business Logic & Workflows

This document outlines the core business logic, entities, and end-to-end workflows for the Little Leap AQL system.

## Core Entities

The system revolves around the following key entities, managed as "Resources" in the Google Sheet configuration.

| Entity | Description | Key Attributes |
| :--- | :--- | :--- |
| **Product** | Items distributed by the company. | SKU, Name, Description, Unit Price, Tax Rate, Category. |
| **Warehouse** | Physical storage locations for stock. | Name, Location, Manager, Capacity. |
| **Outlet** | Pharmacies or retail points where products are sold. | Name, Location, Contact Person, Credit Limit. |
| **Salesman** | Staff members responsible for sales and distribution. | Name, Route/Territory, Commission Rate. |
| **Shipment** | Imports of goods from suppliers (e.g., China). | Shipment ID, Supplier, Date, Status (Ordered/Shipped/Arrived). |
| **Invoice** | Records of sales to outlets. | Invoice No, Date, Outlet, Salesman, Line Items, Total Amount. |
| **Payment** | Collections from outlets against invoices. | Payment ID, Invoice Reference, Amount, Method, Date. |

## End-to-End Workflow

The business process follows a linear flow from product import to final sale and collection.

### 1. Procurement & Logistics
* **Import Process:**
  * **Shipment Booking:** A new shipment is created when goods are ordered from a supplier.
  * **Port Clearance:** Upon arrival, goods go through clearance. Costs associated with clearance are tracked.
  * **Warehouse Intake:** Goods are received into a specific Warehouse. This increases the global stock level for the respective Products.

### 2. Inventory Management
* **Stock Tracking:** Inventory is tracked per Warehouse.
* **Transfers:** Stock can be moved between Warehouses or from a Warehouse to a Salesman's vehicle (treated as a mobile location).
* **Adjustments:** Manual corrections for damaged or lost goods.

### 3. Sales & Distribution
* **Route Planning:** Salesmen visit Outlets based on assigned territories.
* **Direct Sales / Van Sales:**
  * Salesman creates an **Invoice** on the spot via the PWA.
  * Stock is deducted immediately from the Salesman's "vehicle" inventory.
  * Invoice is generated (PDF) and shared with the Outlet.
* **Order Taking:**
  * Salesman takes an **Order** for later delivery.
  * Refill orders are processed by the Warehouse for next-day delivery.

### 4. Financials
* **Invoicing:** Generates a debt record for the Outlet.
* **Payments:**
  * Payments are collected (Cash/Cheque) and recorded against specific Invoices.
  * Partial payments are allowed.
  * **Outstanding Balance:** The system tracks the current due amount for each Outlet.
* **Reporting:** Monthly sales reports, outstanding collections, and commission calculations.

## Ground-Level Inbound Reality (Captured on 2026-02-18)

Current field process to align app development:
1. Items are manufactured in China.
2. Shipment is imported to UAE port.
3. Port clearance is completed by owner/team.
4. Goods are moved to Ajman warehouse (self transport or container carrier).
5. Cartons are unboxed and physically verified against requested quantities.
6. Variance/damage is identified.
7. Accepted items are placed on shelves.
8. System stock is updated by SKU and warehouse location.

Current available master data:
- 21 products with SKU + item name.

Reference document:
- `Documents/GROUND_OPERATIONS_WORKFLOW.md`

## Audit & Compliance

* **Audit Trails:** Every record creation and modification is timestamped (`CreatedAt`, `UpdatedAt`) and tagged with the user performing the action (`CreatedBy`, `UpdatedBy`).
* **Archiving:** To maintain performance in Google Sheets, historical transaction data (Sales, Payments) is periodically moved to Archive sheets (e.g., yearly).
* **Role-Based Access:** Users can only perform actions permitted by their role (e.g., Salesmen cannot delete confirmed Invoices).
