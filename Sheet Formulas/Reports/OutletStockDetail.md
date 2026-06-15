# OutletStockDetail Report

The **OutletStockDetail Report** displays the current stock levels (SKU details, product names, variants, quantities, and units of measure) at a specific outlet. 

---

## Cell Destination & Input Details

- **Output Destination Cell**: `A10`
- **User Input Dependency**: Cell **`$AB$6`** (Outlet Code).
- **Purpose**: Retrieves current stock details for the outlet code entered in `$AB$6`. If the cell is empty, the report outputs nothing. If no stock is found or the outlet is invalid, a message is displayed.

---

## Google Sheet Formula

```excel
=IF(TRIM($AB$6)="",,LET(
  ViewFileID, VLOOKUP("ViewFileID", Config!A:B, 2, 0),
  MasterFileID, VLOOKUP("MasterFileID", Config!A:B, 2, 0),

  RawOutletStock, IMPORTRANGE(ViewFileID, "OutletStock!A2:J"),
  RawOutlets, IMPORTRANGE(MasterFileID, "Outlets!A2:B"),

  RowFn, LAMBDA(idx_val_pairs, MAP(SEQUENCE(1, 39), LAMBDA(col_idx, IFERROR(VLOOKUP(col_idx, idx_val_pairs, 2, FALSE), "")))),

  OutletCodes, TOCOL(CHOOSECOLS(RawOutlets, 1)),
  OutletNames, TOCOL(CHOOSECOLS(RawOutlets, 2)),
  OutletName, IFERROR(XLOOKUP($AB$6, OutletCodes, OutletNames, "Unknown Outlet"), "Unknown Outlet"),

  FilteredStock, IFERROR(
    FILTER(RawOutletStock, TOCOL(CHOOSECOLS(RawOutletStock, 1)) = $AB$6),
    {"", "", "", "", "", "", "", "", "", 0}
  ),

  HasData, INDEX(FilteredStock, 1, 1) <> "",

  FirstLine, RowFn({4, $AB$6; 27, "Report Generated On"}),
  SecondLine, RowFn({4, OutletName; 27, TEXT(NOW(), "yyyy-mm-dd HH:mm:ss")}),
  BlankLine, RowFn({0, ""}),

  ReportRows, IF(
    HasData,
    REDUCE(
      BlankLine,
      SEQUENCE(ROWS(FilteredStock)),
      LAMBDA(acc, idx,
        LET(
          row_val, CHOOSEROWS(FilteredStock, idx),
          p_name, INDEX(row_val, 1, 5),
          uom_name, INDEX(row_val, 1, 9),
          qty, INDEX(row_val, 1, 10),

          VSTACK(
            acc,
            RowFn({5, idx & "."; 6, p_name; 27, qty; 28, uom_name})
          )
        )
      )
    ),
    RowFn({6, "No stock records found for this outlet."})
  ),

  CleanReportRows, IF(
    HasData,
    CHOOSEROWS(ReportRows, SEQUENCE(ROWS(ReportRows) - 1, 1, 2)),
    ReportRows
  ),

  VSTACK(
    FirstLine,
    SecondLine,
    BlankLine,
    CleanReportRows
  )
))
```

---

## Source Sheets & Column Dependencies

The formula imports data from two sources:
1. **`OutletStock`** view (`OutletStock!A2:J` in Views Spreadsheet):
   - Column 1 (`A`): `OutletCode` (compared with `$AB$6`)
   - Column 2 (`B`): `OutletName`
   - Column 5 (`E`): `ProductName`
   - Column 9 (`I`): `UOMName`
   - Column 10 (`J`): `Quantity`
2. **`Outlets`** registry (`Outlets!A2:B` in Master Spreadsheet):
   - Column 1 (`A`): `OutletCode`
   - Column 2 (`B`): `OutletName` (fallback for header when no stock exists)

---

## Detailed Logic Breakdown

1. **Parameter & Dependency Ingestion**: Retrieves the `ViewFileID` and `MasterFileID` from the local `Config` sheet, importing the `OutletStock` view data and `Outlets` list.
2. **Outlet Profile Lookup**: Looks up the outlet name from the master `Outlets` list to display in the header.
3. **Filtering Stock Records**: Filters the `OutletStock` view to match the Outlet Code in `$AB$6`.
4. **Layout Setup**:
   - `FirstLine` (Row 10): Formats the outlet code at Column D (index 4) and `"Report Generated On"` at Column AA (index 27).
   - `SecondLine` (Row 11): Formats the outlet name at Column D (index 4) and the current timestamp at Column AA (index 27).
   - `BlankLine` (Row 12): Inserts a spacer row.
5. **Data Accumulator (`REDUCE`)**:
   - Loops through each matching stock record.
   - Outputs sequence number with a trailing period (e.g. `1.`) at Column E (index 5).
   - Outputs product name directly at Column F (index 6).
   - Outputs quantity directly at Column AA (index 27).
   - Outputs unit of measure name directly at Column AB (index 28).
6. **Unified Stacking**: Stacks the two header lines, blank spacer line, and data rows into a single array containing exactly 39 columns per row.
