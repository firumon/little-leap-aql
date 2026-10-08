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
  MasterFileID, IFERROR(VLOOKUP("MasterFileID", Config!A:B, 2, 0), VLOOKUP("masterFileID", Config!A:B, 2, 0)),
  OutletFileID, IFERROR(VLOOKUP("OutletFileID", Config!A:B, 2, 0), VLOOKUP("OperationFileID", Config!A:B, 2, 0)),

  RawReturns, IMPORTRANGE(OutletFileID, "OutletReturns!A2:AD"),
  RawOutlets, IMPORTRANGE(MasterFileID, "Outlets!A2:B"),
  RawSKUs, IMPORTRANGE(MasterFileID, "SKUs!A2:B"),
  RawProducts, IMPORTRANGE(MasterFileID, "Products!A2:B"),
  RawWarehouses, IMPORTRANGE(MasterFileID, "Warehouses!A2:B"),

  RowFn, LAMBDA(idx_val_pairs, MAP(SEQUENCE(1, 39), LAMBDA(col_idx, IFERROR(VLOOKUP(col_idx, idx_val_pairs, 2, FALSE), "")))),
  ToYesNo, LAMBDA(val, IF(OR(UPPER(TRIM(val)) = "TRUE", val = TRUE), "Yes", "No")),
  FormatEpochDateTime, LAMBDA(val, LET(num, IFERROR(VALUE(val), 0), IF(TRIM(val) = "", "", IF(num > 100000000000, TEXT(25569 + num / 86400000, "yyyy-mm-dd hh:mm"), IFERROR(TEXT(val, "yyyy-mm-dd hh:mm"), val))))),
  FormatEpochDateOnly, LAMBDA(val, LET(num, IFERROR(VALUE(val), 0), IF(TRIM(val) = "", "", IF(num > 100000000000, TEXT(25569 + num / 86400000, "yyyy-mm-dd"), IFERROR(TEXT(INT(val), "yyyy-mm-dd"), IFERROR(TEXT(DATEVALUE(LEFT(val, 10)), "yyyy-mm-dd"), val)))))),

  ReturnCodes, TOCOL(CHOOSECOLS(RawReturns, 1)),
  OutletCodes, TOCOL(CHOOSECOLS(RawOutlets, 1)),
  OutletNames, TOCOL(CHOOSECOLS(RawOutlets, 2)),
  SKU_Codes, TOCOL(CHOOSECOLS(RawSKUs, 1)),
  SKU_ProdCodes, TOCOL(CHOOSECOLS(RawSKUs, 2)),
  Product_Codes, TOCOL(CHOOSECOLS(RawProducts, 1)),
  Product_Names, TOCOL(CHOOSECOLS(RawProducts, 2)),
  WarehouseCodes, TOCOL(CHOOSECOLS(RawWarehouses, 1)),
  WarehouseNames, TOCOL(CHOOSECOLS(RawWarehouses, 2)),

  CleanInput, TRIM($AB$6),
  HasInput, AND(CleanInput <> "", CleanInput <> "#N/A"),
  MatchIdx, IF(HasInput, IFERROR(MATCH(CleanInput, ReturnCodes, 0), 0), 0),
  HasOrder, MatchIdx > 0,

  OrderRow, IF(HasOrder, CHOOSEROWS(RawReturns, MatchIdx), MAKEARRAY(1, 30, LAMBDA(r, c, ""))),

  OutletCode, INDEX(OrderRow, 1, 2),
  ReturnDate_raw, INDEX(OrderRow, 1, 3),
  Username, INDEX(OrderRow, 1, 4),
  SKUCode, INDEX(OrderRow, 1, 5),
  Qty, INDEX(OrderRow, 1, 6),
  Price, INDEX(OrderRow, 1, 7),
  Reason, INDEX(OrderRow, 1, 8),
  ReasonComment, INDEX(OrderRow, 1, 9),
  InvoiceAdjRequired, INDEX(OrderRow, 1, 10),
  InvoiceAdjDone, INDEX(OrderRow, 1, 11),
  ConsumptionInvoice, INDEX(OrderRow, 1, 12),
  SourceInvoice, INDEX(OrderRow, 1, 13),
  WhActionRequired, INDEX(OrderRow, 1, 14),
  WhActionCompleted, INDEX(OrderRow, 1, 15),
  WhCode, INDEX(OrderRow, 1, 16),
  WhAction, INDEX(OrderRow, 1, 17),
  WhDisposedReason, INDEX(OrderRow, 1, 18),
  WhDisposedAt, INDEX(OrderRow, 1, 19),
  WhDisposedBy, INDEX(OrderRow, 1, 20),
  WhStockedAt, INDEX(OrderRow, 1, 21),
  WhStockedBy, INDEX(OrderRow, 1, 22),
  OrderProgress, INDEX(OrderRow, 1, 23),

  OutletName, IF(HasOrder, IFERROR(XLOOKUP(OutletCode, OutletCodes, OutletNames, "Unknown Outlet"), "Unknown Outlet"), ""),

  p_code, IFERROR(XLOOKUP(SKUCode, SKU_Codes, SKU_ProdCodes, ""), ""),
  p_name, IFERROR(XLOOKUP(p_code, Product_Codes, Product_Names, ""), ""),
  ItemDisplayName, IF(p_name <> "", p_name & " (" & SKUCode & ")", SKUCode),

  WarehouseName, IF(WhCode <> "", IFERROR(XLOOKUP(WhCode, WarehouseCodes, WarehouseNames, WhCode), WhCode), ""),

  TotalValue, IFERROR(Qty * Price, 0),

  FormattedDate, FormatEpochDateOnly(ReturnDate_raw),
  FormattedDisposedDate, FormatEpochDateTime(WhDisposedAt),
  FormattedStockedDate, FormatEpochDateTime(WhStockedAt),

  ReportData, IF(
    HasOrder,
    VSTACK(
      RowFn({4, "Date: " & FormattedDate; 20, "Outlet: " & OutletName}),
      RowFn({4, "Return Code: " & CleanInput; 20, "Username: " & Username}),
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
      RowFn({6, "Consumption Invoice: " & IF(ConsumptionInvoice <> "", ConsumptionInvoice, "N/A"); 20, "Source Invoice: " & IF(SourceInvoice <> "", SourceInvoice, "N/A")}),
      RowFn({0, ""}),
      RowFn({4, "WAREHOUSE PROCESSING"}),
      RowFn({0, ""}),
      RowFn({6, "Warehouse Action Required: " & ToYesNo(WhActionRequired); 20, "Action Completed: " & ToYesNo(WhActionCompleted)}),
      IF(OR(UPPER(TRIM(WhActionRequired)) = "TRUE", WhActionRequired = TRUE),
        VSTACK(
          RowFn({6, "Warehouse: " & WarehouseName; 20, "Action Type: " & IF(WhAction <> "", WhAction, "Pending")}),
          IF(UPPER(TRIM(WhAction)) = "DISPOSED",
            RowFn({6, "Disposed At: " & FormattedDisposedDate; 20, "Disposed By: " & WhDisposedBy & " (Reason: " & WhDisposedReason & ")"}),
            IF(UPPER(TRIM(WhAction)) = "STOCKED",
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
      RowFn({4, IF(HasInput, "No return record found for code: " & CleanInput, "Please enter a valid Outlet Return Code in cell AB6.")})
    )
  ),

  ReportData
)
```

---

## Source Sheets & Column Dependencies

The formula queries data from two spreadsheet files (`OutletFileID` and `MasterFileID`):
1. **`OutletReturns`** (`OutletReturns!A2:AD` in Outlet Spreadsheet):
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
   - Column 12 (`L`): Consumption Invoice Code (settling invoice)
   - Column 13 (`M`): Source Invoice Code (original billed invoice)
   - Column 14 (`N`): Warehouse Action Required
   - Column 15 (`O`): Warehouse Action Completed
   - Column 16 (`P`): Warehouse Code
   - Column 17 (`Q`): Warehouse Action (`"Stocked"`, `"Disposed"`)
   - Column 18 (`R`): Warehouse Action Disposed Reason
   - Column 19 (`S`): Warehouse Action Disposed At
   - Column 20 (`T`): Warehouse Action Disposed By
   - Column 21 (`U`): Warehouse Action Stocked At
   - Column 22 (`V`): Warehouse Action Stocked By
   - Column 23 (`W`): Progress status (`"SUBMITTED"`, `"COMPLETED"`, `"CANCELLED"`, etc.)
   - Column 24 (`X`): Record status (`"Active"`)
2. **`Outlets`** (`Outlets!A2:B` in Master Spreadsheet):
   - Column 1 (`A`): Outlet Code
   - Column 2 (`B`): Outlet Name
3. **`Warehouses`** (`Warehouses!A2:B` in Master Spreadsheet):
   - Column 1 (`A`): Warehouse Code
   - Column 2 (`B`): Warehouse Name
4. **`SKUs`** (`SKUs!A2:B` in Master Spreadsheet):
   - Column 1 (`A`): SKU Code
   - Column 2 (`B`): Product Code
5. **`Products`** (`Products!A2:B` in Master Spreadsheet):
   - Column 1 (`A`): Product Code
   - Column 2 (`B`): Product Name

---

## Detailed Logic Breakdown

1. **Order Search**: Matches trimmed `$AB$6` against the return codes to locate the transaction row.
2. **Data Lookup & Resolution**:
   - Outlet Name is resolved via `XLOOKUP` from `Outlets!A2:B` based on `OutletCode`.
   - SKU details (Product Name and SKU Code) are resolved directly from `Products!A2:B` and `SKUs!A2:B` in the Master spreadsheet.
   - Warehouse name is looked up from `Warehouses!A2:B`.
3. **Epoch Date/Time Conversion**:
   - Action timestamps (stored as Unix epoch milliseconds, e.g. `1779906630063`) are converted to Google Sheets datetime serial numbers using `25569 + val / 86400000` and formatted using `TEXT(...)`.
   - Conversions use `VALUE(val)` inside `IFERROR` to handle timestamps stored as text strings as well. Standard date values and serial numbers are handled safely.
4. **Report Stacking**:
   - Layout is built as a stacked array where every row is generated by `RowFn` mapping to columns 4 (D) and 20 (T) for main header lines, and columns 6 (F) / 20 (T) for details, ensuring a clean 39-column grid layout starting exactly at column D.
   - If warehouse processing is required, details are conditionally stacked depending on the type of warehouse action completed (`Stocked` vs. `Disposed`).
