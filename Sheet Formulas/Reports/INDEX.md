# Google Sheets Reports

In the AQL system, **Reports** are specialized sheets designed to format data into printable document templates or aggregated reports. Unlike **Views** (which denormalize raw records into clean database-like tables), Reports write formulas into specific cells to construct visual hierarchies, timeline logs, dashboards, and tables. 

These report sheets serve as dynamic layout templates. When a report is triggered, the system clones the template, populates any required parameters (like ID filters), recalculates the formulas to generate the document, and exports it to PDF format.

---

## How Reports Work in AQL

The end-to-end report generation process spans the frontend UI, backend Google Apps Script dispatcher, and spreadsheet templates:
1. **Trigger**: A user clicks a report action button in the Quasar frontend (e.g. at the toolbar or record detail dialog).
2. **User Input / Context**: If the report requires a parameter (such as an Outlet Code or Restock Order ID), a dialog prompts the user, or the system auto-fills the ID from the active record.
3. **Execution**: The backend script clones the corresponding template sheet, injects the user inputs into their designated cells, flushes the spreadsheet calculations, and calls the Google Sheets PDF export API.
4. **Delivery**: The resulting PDF is returned to the frontend as a Base64 string for direct download.

For a detailed code walkthrough and architecture diagrams of this workflow, refer to **[MODULE_WORKFLOWS.md — Section 1: Report Generation (PDF)](file:///f:/LITTLE%20LEAP/AQL/Documents/MODULE_WORKFLOWS.md#L97)**.

---

## The `Config` Sheet

Like Views, each Report spreadsheet contains a **`Config`** sheet cloned from the primary App registry:
- **Role**: Provides the spreadsheet file IDs (e.g., `MasterFileID`, `OutletFileID`, `ViewFileID`, `OperationFileID`) required by the reports' `IMPORTRANGE` functions.
- **Dependency**: If the file IDs or keys in `Config` are changed, the report queries will break.

---

## Directory of Reports

Click the links below to view the detailed cell mapping, column dependencies, and raw formulas for each report sheet:

| Report Sheet | Cell Destination | User Input Cell & Purpose | Main Source Sheets & Column Dependencies | Link to Details |
| :--- | :--- | :--- | :--- | :--- |
| **ProductList** | `C10` | *None* | Master `Products!A:C` (Cols 1-3), `SKUs!A:G` (Cols 1-7) | [ProductList.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Reports/ProductList.md) |
| **WarehouseStockReportProductWise** | `D13` | `AD10` (Warehouse Code) | View `WarehouseStock!A:K` (Cols 1,3,4,6,8,10,11), `SKU!A:J` (Cols 1,3) | [WarehouseStockReportProductWise.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Reports/WarehouseStockReportProductWise.md) |
| **WarehouseStockReportStorageWise** | `D13` | `AD10` (Warehouse Code) | View `WarehouseStock!A:K` (Cols 1,3,4,6,8,10,11), `SKU!A:J` (Cols 1,3) | [WarehouseStockReportStorageWise.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Reports/WarehouseStockReportStorageWise.md) |
| **OutletVisitsToday** | `A10` | *None* (relative to `TODAY()`) | Outlet `OutletVisits!A2:Q` (Cols 1-4,7,17), Master `Outlets!A2:B` (Cols 1,2) | [OutletVisitsToday.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Reports/OutletVisitsToday.md) |
| **OutletVisitsTomorrowAndUpcomig** | `A10` | *None* (relative to `TODAY()`) | Outlet `OutletVisits!A2:Q` (Cols 1-4,7,17), Master `Outlets!A2:B` (Cols 1,2) | [OutletVisitsTomorrowAndUpcomig.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Reports/OutletVisitsTomorrowAndUpcomig.md) |
| **OutletVisitsOverdue** | `A10` | *None* (relative to `TODAY()`) | Outlet `OutletVisits!A2:V` (Cols 1-4,7,17), Master `Outlets!A2:U` (Cols 1,2) | [OutletVisitsOverdue.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Reports/OutletVisitsOverdue.md) |
| **OutletVisitHistory** | `A20` (List), `E12` (Card), `U10`, `U15`, `AD10`, `AD15` (Counts) | `$H$11` (Outlet Code) | Master `Outlets!A2:J` (Cols 1-4,6-9), Outlet `OutletVisits!A2:V` (Cols 2-4,7,10,13,16,17) | [OutletVisitHistory.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Reports/OutletVisitHistory.md) |
| **Restock** | `A10` | `$AB$6` (Restock Order ID) | Outlet `OutletRestocks!A2:T` (Cols 1-3,5-19), `OutletRestockItems!A2:Q` (Cols 2-7,10,13,16,17), View `SKU!A2:G` (Cols 1,2,4,6), Master `Outlets!A2:B` (Cols 1,2), `Warehouses!A2:B` (Cols 1,2) | [Restock.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Reports/Restock.md) |
| **OutletRestockHistory** | `A10` | `$AB$6` (Outlet Code) | Outlet `OutletRestocks!A2:T` (Cols 1-3,5,7,20), `OutletRestockItems!A2:Q` (Cols 2-7,17), View `SKU!A2:G` (Cols 1,2,4,6), Master `Outlets!A2:B` (Cols 1,2), `Warehouses!A2:B` (Cols 1,2) | [OutletRestockHistory.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Reports/OutletRestockHistory.md) |
| **RestockRecords** | `A15` | `$J$11` (User), `$J$12` (Date), `$J$13` (Progress) | Outlet `OutletRestocks!A2:T` (Cols 1-3,5-7,20), `OutletRestockItems!A2:Q` (Cols 2-7,17), View `SKU!A2:G` (Cols 1,2,4,6), Master `Outlets!A2:B` (Cols 1,2), `Warehouses!A2:B` (Cols 1,2) | [RestockRecords.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Reports/RestockRecords.md) |
| **RestockDeliveriesWorklist** | `A10` | `$AB$6` (Warehouse ID) | Outlet `OutletRestocks!A2:T` (Cols 1,3), `OutletRestockItems!A2:Q` (Cols 2-7,17), View `SKU!A2:G` (Cols 1,2,4,6), Master `Outlets!A2:B` (Cols 1,2), `Warehouses!A2:B` (Cols 1,2) | [RestockDeliveriesWorklist.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Reports/RestockDeliveriesWorklist.md) |
| **Delivery** | `A10` | `$AB$6` (Delivery ID) | Outlet `OutletDeliveries!A2:T` (Cols 1-5), `OutletRestockItems!A2:Q` (Cols 1,2,4,6,7,11,12), Master `Outlets!A2:B` (Cols 1,2), View `SKU!A2:G` (Cols 1,2,4,6), Outlet `OutletRestocks!A2:T` (Cols 1,3) | [Delivery.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Reports/Delivery.md) |
| **DeliveryRecords** | `A14` | `$J$11` (User), `$J$12` (Date) | Outlet `OutletDeliveries!A2:T` (Cols 1-5,15), `OutletRestockItems!A2:Q` (Cols 1,2,4,6,7,11), Master `Outlets!A2:B` (Cols 1,2), View `SKU!A2:G` (Cols 1,2,4,6), Outlet `OutletRestocks!A2:T` (Cols 1,3) | [DeliveryRecords.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Reports/DeliveryRecords.md) |
| **Consumption** | `A10` | `$AB$6` (Consumption Code) | Outlet `OutletConsumptions!A2:Q` (Cols 1-6,7,10,13), `OutletConsumptionItems!A2:E` (Cols 2-4), Master `Outlets!A2:B` (Cols 1,2), View `SKU!A2:G` (Cols 1,2,4,6) | [Consumption.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Reports/Consumption.md) |
| **OutletConsumptionHistory** | `A10` | `$AB$6` (Outlet Code) | Outlet `OutletConsumptions!A2:Q` (Cols 2,3,6,16), `OutletConsumptionItems!A2:E` (Cols 2-4), View `SKU!A2:G` (Cols 1,2,4,6), Master `Outlets!A2:B` (Cols 1,2) | [OutletConsumptionHistory.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Reports/OutletConsumptionHistory.md) |
| **ConsumptionRecords** | `A15` | `$J$11` (User), `$J$12` (Date) | Outlet `OutletConsumptions!A2:Q` (Cols 1-4,6,16), `OutletConsumptionItems!A2:E` (Cols 2-4), View `SKU!A2:G` (Cols 1,2,4,6), Master `Outlets!A2:B` (Cols 1,2) | [ConsumptionRecords.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Reports/ConsumptionRecords.md) |
| **Return** | `A10` | `$AB$6` (Outlet Return Code) | Outlet `OutletReturns!A2:AB` (Cols 1-22), Master `Outlets!A2:B` (Cols 1,2), `Warehouses!A2:B` (Cols 1,2), View `SKU!A2:G` (Cols 1,2,4,6) | [Return.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Reports/Return.md) |
| **ReturnRecords** | `A15` | `$J$11` (User), `$J$12` (Date), `$J$13` (Reason) | Outlet `OutletReturns!A2:AB` (Cols 1-16,22,23), Master `Outlets!A2:B` (Cols 1,2), Views `SKU!A2:G` (Cols 1,2,4,6), Master `Warehouses!A2:B` (Cols 1,2) | [ReturnRecords.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Reports/ReturnRecords.md) |
| **OutletReturnHistory** | `A10` | `$AB$6` (Outlet Code) | Outlet `OutletReturns!A2:AB` (Cols 1-23), Master `Outlets!A2:B` (Cols 1,2), `Warehouses!A2:B` (Cols 1,2), View `SKU!A2:G` (Cols 1,2,4,6) | [OutletReturnHistory.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Reports/OutletReturnHistory.md) |
| **ProductReturnHistory** | `A10` | `$AB$6` (Product Code) | Outlet `OutletReturns!A2:AB` (Cols 1-23), Master `Outlets!A2:B` (Cols 1,2), `Warehouses!A2:B` (Cols 1,2), View `SKU!A2:G` (Cols 1,2,3,4,6) | [ProductReturnHistory.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Reports/ProductReturnHistory.md) |

---


## Maintenance & Dependency Rules

> [!IMPORTANT]
> **Schema Change Warning**: Report formulas perform strict index mapping (e.g. `CHOOSECOLS`, `INDEX`, `VLOOKUP`) against their source tables. Adding, deleting, or reordering columns in the source spreadsheets (Master, Operations, Outlets, Views) will break these reports. 

### Document Maintenance Rules
1. **Synchronized Updates**: Whenever a formula, input cell, or column dependency is changed in any report sheet, the corresponding `.md` file and this [INDEX.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Reports/INDEX.md) must be updated immediately.
2. **Column Indexes**: When editing source schemas, always review report files to ensure index VLOOKUPs and column choices match the new indexes.
