# Return Report

The **Return Report** generates a comprehensive Outlet Return Document for a specific sales return transaction. It formats the metadata details of the return, the itemized SKU info, the commercial invoice adjustment status, and the warehouse processing/disposition logs into a printable 39-column layout.

---

## Cell Destination & Input Details

- **Output Destination Cell**: `A10`
- **User Input Dependency**: Cell **`$AB$6`** (Outlet Return Code).
- **Purpose**: Retrieves details for the outlet return record matching this code. If `$AB$6` is blank or invalid, it outputs a warning: `"Please enter a valid Outlet Return Code in cell AB6."`

---

## Google Sheet Formula

```excel
=LET(
  OutletFileID, VLOOKUP("OutletFileID", Config!A:B, 2, 0),
  MasterFileID, VLOOKUP("masterFileID", Config!A:B, 2, 0),
  SKUFileID, VLOOKUP("ViewFileID", Config!A:B, 2, 0),

  RawReturns, IMPORTRANGE(OutletFileID, "OutletReturns!A2:AB"),
  RawOutlets, IMPORTRANGE(MasterFileID, "Outlets!A2:B"),
  RawSKUs, IMPORTRANGE(SKUFileID, "SKU!A2:G"),
  RawWarehouses, IMPORTRANGE(MasterFileID, "Warehouses!A2:B"),

  RowFn, LAMBDA(idx_val_pairs, MAP(SEQUENCE(1, 39), LAMBDA(col_idx, IFERROR(VLOOKUP(col_idx, idx_val_pairs, 2, FALSE), "")))),
  ToYesNo, LAMBDA(val, IF(UPPER(val) = "TRUE", "Yes", "No")),
  FormatEpochDateTime, LAMBDA(val, LET(num, IFERROR(VALUE(val), 0), IF(num > 100000000000, TEXT(25569 + num / 86400000, "yyyy-mm-dd hh:mm"), val))),
  FormatEpochDateOnly, LAMBDA(val, LET(num, IFERROR(VALUE(val), 0), IF(num > 100000000000, TEXT(25569 + num / 86400000, "yyyy-mm-dd"), val))),

  ReturnCodes, TOCOL(CHOOSECOLS(RawReturns, 1)),
  OutletCodes, TOCOL(CHOOSECOLS(RawOutlets, 1)),
  OutletNames, TOCOL(CHOOSECOLS(RawOutlets, 2)),
  SKU_Codes, TOCOL(CHOOSECOLS(RawSKUs, 1)),
  WarehouseCodes, TOCOL(CHOOSECOLS(RawWarehouses, 1)),
  WarehouseNames, TOCOL(CHOOSECOLS(RawWarehouses, 2)),

  MatchIdx, IFERROR(MATCH($AB$6, ReturnCodes, 0), 0),
  HasOrder, MatchIdx > 0,

  OrderRow, IF(HasOrder, CHOOSEROWS(RawReturns, MatchIdx), MAKEARRAY(1, 28, LAMBDA(r, c, ""))),

  ReturnDate, CHOOSEROWS(CHOOSECOLS(OrderRow, 3), 1),
  OutletCode, CHOOSEROWS(CHOOSECOLS(OrderRow, 2), 1),
  Username, CHOOSEROWS(CHOOSECOLS(OrderRow, 4), 1),
  SKUCode, CHOOSEROWS(CHOOSECOLS(OrderRow, 5), 1),
  Qty, CHOOSEROWS(CHOOSECOLS(OrderRow, 6), 1),
  Price, CHOOSEROWS(CHOOSECOLS(OrderRow, 7), 1),
  Reason, CHOOSEROWS(CHOOSECOLS(OrderRow, 8), 1),
  ReasonComment, CHOOSEROWS(CHOOSECOLS(OrderRow, 9), 1),
  InvoiceAdjRequired, CHOOSEROWS(CHOOSECOLS(OrderRow, 10), 1),
  InvoiceAdjDone, CHOOSEROWS(CHOOSECOLS(OrderRow, 11), 1),
  ConsumptionInvoice, CHOOSEROWS(CHOOSECOLS(OrderRow, 12), 1),
  WhActionRequired, CHOOSEROWS(CHOOSECOLS(OrderRow, 13), 1),
  WhActionCompleted, CHOOSEROWS(CHOOSECOLS(OrderRow, 14), 1),
  WhCode, CHOOSEROWS(CHOOSECOLS(OrderRow, 15), 1),
  WhAction, CHOOSEROWS(CHOOSECOLS(OrderRow, 16), 1),
  WhDisposedReason, CHOOSEROWS(CHOOSECOLS(OrderRow, 17), 1),
  WhDisposedAt, CHOOSEROWS(CHOOSECOLS(OrderRow, 18), 1),
  WhDisposedBy, CHOOSEROWS(CHOOSECOLS(OrderRow, 19), 1),
  WhStockedAt, CHOOSEROWS(CHOOSECOLS(OrderRow, 20), 1),
  WhStockedBy, CHOOSEROWS(CHOOSECOLS(OrderRow, 21), 1),
  OrderProgress, CHOOSEROWS(CHOOSECOLS(OrderRow, 22), 1),

  OutletName, IF(HasOrder, IFERROR(XLOOKUP(OutletCode, OutletCodes, OutletNames, "Unknown Outlet"), "Unknown Outlet"), ""),

  SKU_Row, XLOOKUP(SKUCode, SKU_Codes, RawSKUs, MAKEARRAY(1, 7, LAMBDA(r, c, ""))),
  ProdName, CHOOSEROWS(CHOOSECOLS(SKU_Row, 4), 1),
  SKU_Code_Val, CHOOSEROWS(CHOOSECOLS(SKU_Row, 2), 1),
  VarValues, CHOOSEROWS(CHOOSECOLS(SKU_Row, 6), 1),
  ItemNameSuffix, IF(VarValues <> "", VarValues, SKU_Code_Val),
  ItemDisplayName, ProdName & IF(AND(ItemNameSuffix <> "", ItemNameSuffix <> SKUCode), " - " & ItemNameSuffix, "") & " (" & SKUCode & ")",

  WarehouseName, IF(WhCode <> "", IFERROR(XLOOKUP(WhCode, WarehouseCodes, WarehouseNames, WhCode), WhCode), ""),

  TotalValue, Qty * Price,

  FormattedDate, FormatEpochDateOnly(ReturnDate),
  FormattedDisposedDate, FormatEpochDateTime(WhDisposedAt),
  FormattedStockedDate, FormatEpochDateTime(WhStockedAt),

  ReportData, IF(
    HasOrder,
    VSTACK(
      RowFn({4, "Date: " & FormattedDate; 20, "Outlet: " & OutletName}),
      RowFn({4, "Return Code: " & $AB$6; 20, "Username: " & Username}),
      RowFn({4, "Progress: " & OrderProgress}),
      RowFn({0, ""}),
      RowFn({4, "RETURNED ITEM"}),
      RowFn({0, ""}),
      RowFn({6, "Product: " & ItemDisplayName}),
      RowFn({6, "Quantity: " & Qty; 20, "Price: " & Price & " (Total: " & TotalValue & ")"}),
      RowFn({6, "Reason: " & Reason; 20, "Comment: " & IF(ReasonComment <> "", ReasonComment, "N/A")}),
      RowFn({0, ""}),
      RowFn({4, "FINANCIAL ADJUSTMENT"}),
      RowFn({0, ""}),
      RowFn({6, "Adjustment Required: " & ToYesNo(InvoiceAdjRequired); 20, "Adjustment Done: " & ToYesNo(InvoiceAdjDone)}),
      RowFn({6, "Consumption Invoice: " & IF(ConsumptionInvoice <> "", ConsumptionInvoice, "N/A")}),
      RowFn({0, ""}),
      RowFn({4, "WAREHOUSE PROCESSING"}),
      RowFn({0, ""}),
      RowFn({6, "Warehouse Action Required: " & ToYesNo(WhActionRequired); 20, "Action Completed: " & ToYesNo(WhActionCompleted)}),
      IF(UPPER(WhActionRequired) = "TRUE",
        VSTACK(
          RowFn({6, "Warehouse: " & WarehouseName; 20, "Action Type: " & IF(WhAction <> "", WhAction, "Pending")}),
          IF(WhAction = "Disposed",
            RowFn({6, "Disposed At: " & FormattedDisposedDate; 20, "Disposed By: " & WhDisposedBy & " (Reason: " & WhDisposedReason & ")"}),
            IF(WhAction = "Stocked",
              RowFn({6, "Stocked At: " & FormattedStockedDate; 20, "Stocked By: " & WhStockedBy}),
              RowFn({6, "Warehouse action pending receipt."})
            )
          )
        ),
        RowFn({6, "No warehouse processing required."})
      )
    ),
    VSTACK(
      RowFn({4, "OUTLET RETURN DOCUMENT"}),
      RowFn({0, ""}),
      RowFn({4, "Please enter a valid Outlet Return Code in cell AB6."})
    )
  ),

  ReportData
)
```

---

## Source Sheets & Column Dependencies

The formula queries data from four spreadsheet files (`OutletFileID`, `ViewFileID`, `masterFileID`):
1. **`OutletReturns`** (`OutletReturns!A2:AB` in Outlet Spreadsheet):
   - Column 1 (`A`): Code (matches `$AB$6`)
   - Column 2 (`B`): Outlet Code
   - Column 3 (`C`): Date
   - Column 4 (`D`): Username
   - Column 5 (`E`): SKU
   - Column 6 (`F`): Qty
   - Column 7 (`G`): Price
   - Column 8 (`H`): Reason
   - Column 9 (`I`): Reason Comment
   - Column 10 (`J`): Invoice Adjustment Required
   - Column 11 (`K`): Invoice Adjustment Done
   - Column 12 (`L`): Consumption Invoice Code
   - Column 13 (`M`): Warehouse Action Required
   - Column 14 (`N`): Warehouse Action Completed
   - Column 15 (`O`): Warehouse Code
   - Column 16 (`P`): Warehouse Action (`"Stocked"`, `"Disposed"`)
   - Column 17 (`Q`): Warehouse Action Disposed Reason
   - Column 18 (`R`): Warehouse Action Disposed At
   - Column 19 (`S`): Warehouse Action Disposed By
   - Column 20 (`T`): Warehouse Action Stocked At
   - Column 21 (`U`): Warehouse Action Stocked By
   - Column 22 (`V`): Progress status (`"SUBMITTED"`, `"COMPLETED"`, `"CANCELLED"`)
2. **`Outlets`** (`Outlets!A2:B` in Master Spreadsheet):
   - Column 1 (`A`): Outlet Code
   - Column 2 (`B`): Outlet Name
3. **`SKU`** (`SKU!A2:G` in Views Spreadsheet):
   - Column 1 (`A`): SKU Code
   - Column 2 (`B`): SKUCode
   - Column 4 (`D`): Product Name
   - Column 6 (`F`): Variant Values
4. **`Warehouses`** (`Warehouses!A2:B` in Master Spreadsheet):
   - Column 1 (`A`): Warehouse Code
   - Column 2 (`B`): Warehouse Name

---

## Detailed Logic Breakdown

1. **Order Search**: Matches `$AB$6` against the return codes to locate the transaction row.
2. **Data Lookup & Resolution**:
   - Outlet Name is resolved via `XLOOKUP` from `Outlets!A2:B` based on `OutletCode`.
   - SKU details (Product Name, SKU Code, Variant Values) are resolved from the `SKU` view.
   - Warehouse name is looked up from `Warehouses!A2:B`.
3. **Epoch Date/Time Conversion**:
   - Action timestamps (stored as Unix epoch milliseconds, e.g. `1779906630063`) are converted to Google Sheets datetime serial numbers using `25569 + val / 86400000` and formatted using `TEXT(...)`.
   - Conversions use `VALUE(val)` inside `IFERROR` to handle timestamps stored as text strings as well. Epoch values below `10^11` (like standard dates or short serial numbers) are ignored to prevent date corruption.
4. **Report Stacking**:
   - Layout is built as a stacked array where every row is generated by `RowFn` mapping to columns 4 (D) and 20 (T) for main header lines, and columns 6 (F) / 20 (T) for details, ensuring a clean 39-column grid layout starting exactly at column D.
   - If warehouse processing is required, details are conditionally stacked depending on the type of warehouse action completed (`Stocked` vs. `Disposed`).
