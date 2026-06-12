# Google Sheets Views

In the AQL system, **Views** are specialized sheets designed to consolidate, flatten, and denormalize data from multiple source sheets or external spreadsheets into a single unified table. This makes the data easily consumable by other processes, scripts, and front-end displays without requiring complex logic on their end.

For example, SKU details in the raw database are normalized across three separate sheets: `Products`, `SKUs`, and `UOMs`. The **SKU View** runs a query-driven aggregation to bring all of these related attributes together into a single flat list.

---

## The `Config` Sheet

Each View Google Sheet contains a reference sheet named **`Config`**. 
- **Purpose**: It stores key metadata, configuration key-value pairs, and spreadsheet IDs cloned from the main App configuration.
- **Role**: Views reference the `Config` sheet using `VLOOKUP` (e.g., retrieving `MasterFileID`, `OperationFileID`, or `OutletFileID`) to locate source spreadsheets dynamically and run `IMPORTRANGE` commands.
- **Example Usage**: `VLOOKUP("MasterFileID", Config!A1:B, 2, 0)`

---

## Directory of Views

The following is a list of all view sheets defined in this directory. Click the links to see their detailed formulas, dependencies, and schema layouts:

| View Sheet | Link to Formula / Details | Short Description |
| :--- | :--- | :--- |
| **SKU** | [SKU.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Views/SKU.md) | Consolidates normalized product, variant, SKU, and Unit of Measure (UOM) records from the Master sheet into a single flattened schema. Generates JSON representations of variants. |
| **PriceListInline** | [PriceListInline.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Views/PriceListInline.md) | Flattens price lists that store SKU-to-price mappings as JSON objects. Extracts and expands them into a tabular list mapping each SKU and price to its own row with SKU details. |
| **Outlet** | [Outlet.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Views/Outlet.md) | Merges basic outlet profiles and contacts with their corresponding operating rules (e.g. stock limits, credit limits, visit frequency, price lists). |
| **WarehouseStock** | [WarehouseStock.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Views/WarehouseStock.md) | Calculates current inventory levels across warehouses and storage locations by summing transaction movements, filtering out zero/negative balances, and looking up SKU data. |
| **OutletStock** | [OutletStock.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Views/OutletStock.md) | Aggregates outlet inventory levels by summing outlet stock movements, filtering out zero/negative balances, and joining outlet metadata and SKU details. |

---

## Maintenance & Dependency Rules

> [!IMPORTANT]
> **Schema Change Warning**: View formulas perform index-based VLOOKUPs, filters, and queries against external source sheets (e.g. `Products`, `SKUs`, `UOMs`, `Outlets`, etc.). Reordering, inserting, or removing columns in those source sheets will cause formula breakdowns.

### Document Maintenance Rules
1. **Synchronized Updates**: Whenever a formula, configuration reference, or column dependency changes in a View sheet, the corresponding `.md` file and this [INDEX.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Views/INDEX.md) must be updated immediately to maintain alignment.
2. **Column Indexes**: When editing raw master schemas, review view sheets to update VLOOKUP column offsets.

