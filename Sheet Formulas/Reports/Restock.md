# Restock Report

The **Restock Report** generates a comprehensive Restock Order Document including order header details, workflow authorization timeline, and an itemized list of stock items being restocked (with descriptions, quantities, and storage locations).

---

## Cell Destination & Input Details

- **Output Destination Cell**: `A10`
- **User Input Dependency**: Cell **`$AB$6`** (Restock Order Code). The formula verifies if a valid code is entered. If `$AB$6` is blank or matches no order, it outputs a warning message: `"Please enter a valid Restock Code in cell AB6."`

---

## Google Sheet Formula

```excel
=LET(
  OutletFileID, VLOOKUP("OutletFileID", Config!A:B, 2, 0),
  MasterFileID, VLOOKUP("masterFileID", Config!A:B, 2, 0),
  SKUFileID, VLOOKUP("ViewFileID", Config!A:B, 2, 0),

  RawRestocks, IMPORTRANGE(OutletFileID, "OutletRestocks!A2:T"),
  RawItems, IMPORTRANGE(OutletFileID, "OutletRestockItems!A2:Q"),
  RawOutlets, IMPORTRANGE(MasterFileID, "Outlets!A2:B"),
  RawSKUs, IMPORTRANGE(SKUFileID, "SKU!A2:G"),
  RawWarehouses, IMPORTRANGE(MasterFileID, "Warehouses!A2:B"),

  RowFn, LAMBDA(idx_val_pairs, MAP(SEQUENCE(1, 39), LAMBDA(col_idx, IFERROR(VLOOKUP(col_idx, idx_val_pairs, 2, FALSE), "")))),

  RestockCodes, TOCOL(CHOOSECOLS(RawRestocks, 1)),
  OutletCodes, TOCOL(CHOOSECOLS(RawOutlets, 1)),
  OutletNames, TOCOL(CHOOSECOLS(RawOutlets, 2)),
  SKU_Codes, TOCOL(CHOOSECOLS(RawSKUs, 1)),
  WhCodes, TOCOL(CHOOSECOLS(RawWarehouses, 1)),
  WhNames, TOCOL(CHOOSECOLS(RawWarehouses, 2)),

  MatchIdx, IFERROR(MATCH($AB$6, RestockCodes, 0), 0),
  HasOrder, MatchIdx > 0,

  OrderRow, IF(HasOrder, CHOOSEROWS(RawRestocks, MatchIdx), MAKEARRAY(1, 20, LAMBDA(r, c, ""))),

  OrderDate, CHOOSEROWS(CHOOSECOLS(OrderRow, 2), 1),
  OutletCode, CHOOSEROWS(CHOOSECOLS(OrderRow, 3), 1),
  ReqUser, CHOOSEROWS(CHOOSECOLS(OrderRow, 5), 1),
  AppUser, CHOOSEROWS(CHOOSECOLS(OrderRow, 6), 1),
  OrderProgress, CHOOSEROWS(CHOOSECOLS(OrderRow, 7), 1),

  SubmittedAt, CHOOSEROWS(CHOOSECOLS(OrderRow, 8), 1),
  SubmittedBy, CHOOSEROWS(CHOOSECOLS(OrderRow, 9), 1),
  SubmittedComment, CHOOSEROWS(CHOOSECOLS(OrderRow, 10), 1),

  RevisionAt, CHOOSEROWS(CHOOSECOLS(OrderRow, 11), 1),
  RevisionBy, CHOOSEROWS(CHOOSECOLS(OrderRow, 12), 1),
  RevisionComment, CHOOSEROWS(CHOOSECOLS(OrderRow, 13), 1),

  ApprovedAt, CHOOSEROWS(CHOOSECOLS(OrderRow, 14), 1),
  ApprovedBy, CHOOSEROWS(CHOOSECOLS(OrderRow, 15), 1),
  ApprovedComment, CHOOSEROWS(CHOOSECOLS(OrderRow, 16), 1),

  RejectedAt, CHOOSEROWS(CHOOSECOLS(OrderRow, 17), 1),
  RejectedBy, CHOOSEROWS(CHOOSECOLS(OrderRow, 18), 1),
  RejectedComment, CHOOSEROWS(CHOOSECOLS(OrderRow, 19), 1),

  OutletName, IF(HasOrder, IFERROR(XLOOKUP(OutletCode, OutletCodes, OutletNames, "Unknown Outlet"), "Unknown Outlet"), ""),

  DummyRow, RowFn({0, "DUMMY"}),

  T_Data, VSTACK(
    IF(SubmittedAt <> "", HSTACK(SubmittedAt, "SUBMITTED", SubmittedBy, SubmittedComment), MAKEARRAY(1, 4, LAMBDA(r, c, ""))),
    IF(RevisionAt <> "", HSTACK(RevisionAt, "REVISION REQUIRED", RevisionBy, RevisionComment), MAKEARRAY(1, 4, LAMBDA(r, c, ""))),
    IF(ApprovedAt <> "", HSTACK(ApprovedAt, "APPROVED", ApprovedBy, ApprovedComment), MAKEARRAY(1, 4, LAMBDA(r, c, ""))),
    IF(RejectedAt <> "", HSTACK(RejectedAt, "REJECTED", RejectedBy, RejectedComment), MAKEARRAY(1, 4, LAMBDA(r, c, "")))
  ),
  T_Filtered, IFERROR(FILTER(T_Data, TOCOL(CHOOSECOLS(T_Data, 1)) <> ""), MAKEARRAY(1, 4, LAMBDA(r, c, ""))),
  HasTimeline, CHOOSEROWS(CHOOSECOLS(T_Filtered, 1), 1) <> "",
  T_Sorted, IF(HasTimeline, SORT(T_Filtered, 1, TRUE), T_Filtered),

  TimelineRows, REDUCE(DummyRow, SEQUENCE(IF(HasTimeline, ROWS(T_Sorted), 1)), LAMBDA(acc, k, LET(
    t_row, CHOOSEROWS(T_Sorted, k),
    t_time, CHOOSEROWS(CHOOSECOLS(t_row, 1), 1),
    t_status, CHOOSEROWS(CHOOSECOLS(t_row, 2), 1),
    t_actor, CHOOSEROWS(CHOOSECOLS(t_row, 3), 1),
    t_comment, CHOOSEROWS(CHOOSECOLS(t_row, 4), 1),
    VSTACK(
      acc,
      RowFn({6, t_status & " By: " & t_actor & " On: " & TEXT(t_time, "yyyy-mm-dd hh:mm"); 14, t_comment})
    )
  ))),
  CleanTimelineRows, IF(
    HasTimeline,
    CHOOSEROWS(TimelineRows, SEQUENCE(ROWS(TimelineRows) - 1, 1, 2)),
    RowFn({6, "No progress stages recorded."})
  ),

  FilteredItems, IFERROR(
    FILTER(RawItems, (TOCOL(CHOOSECOLS(RawItems, 2)) = $AB$6) * (TOCOL(CHOOSECOLS(RawItems, 17)) = "Active")),
    MAKEARRAY(1, 17, LAMBDA(r, c, ""))
  ),

  HasItems, AND(HasOrder, CHOOSEROWS(CHOOSECOLS(FilteredItems, 1), 1) <> ""),

  ItemRows, REDUCE(DummyRow, SEQUENCE(ROWS(FilteredItems)), LAMBDA(acc, k, LET(
    item_row, CHOOSEROWS(FilteredItems, k),
    ItemSku, CHOOSEROWS(CHOOSECOLS(item_row, 4), 1),
    ItemQty, CHOOSEROWS(CHOOSECOLS(item_row, 6), 1),
    ItemWh, CHOOSEROWS(CHOOSECOLS(item_row, 3), 1),
    ItemStorage, CHOOSEROWS(CHOOSECOLS(item_row, 5), 1),
    ItemProgress, CHOOSEROWS(CHOOSECOLS(item_row, 7), 1),
    
    ItemComment, LET(
      p, UPPER(ItemProgress),
      IF(p = "ALLOCATED", CHOOSEROWS(CHOOSECOLS(item_row, 10), 1),
      IF(p = "DELIVERED", CHOOSEROWS(CHOOSECOLS(item_row, 13), 1),
      IF(p = "CANCELLED", CHOOSEROWS(CHOOSECOLS(item_row, 16), 1),
      "")))
    ),

    SKU_Row, XLOOKUP(ItemSku, SKU_Codes, RawSKUs, MAKEARRAY(1, 7, LAMBDA(r, c, ""))),
    ProdName, CHOOSEROWS(CHOOSECOLS(SKU_Row, 4), 1),
    SKU_Code, CHOOSEROWS(CHOOSECOLS(SKU_Row, 2), 1),
    VarValues, CHOOSEROWS(CHOOSECOLS(SKU_Row, 6), 1),
    ItemNameSuffix, IF(VarValues <> "", VarValues, SKU_Code),
    ItemDisplayName, ProdName & IF(ItemNameSuffix <> "", " - " & ItemNameSuffix, "") & " (" & ItemSku & ")",

    WhName, IFERROR(XLOOKUP(ItemWh, WhCodes, WhNames, ItemWh), ItemWh),
    
    CommentRow, IF(ItemComment <> "", RowFn({10, "Comment: " & ItemComment}), DummyRow),
    
    VSTACK(
      acc,
      RowFn({6, k & " .  " & ItemDisplayName}),
      RowFn({6, "Quantity: " & ItemQty; 10, ItemStorage & " (" &  WhName & ") - " & ItemProgress}),
      RowFn({0, ""})
    )
  ))),

  CleanItemRows, IF(
    HasItems,
    CHOOSEROWS(ItemRows, SEQUENCE(ROWS(ItemRows) - 1, 1, 2)),
    RowFn({6, "No items found in this restock."})
  ),

  ReportData, IF(
    HasOrder,
    VSTACK(
      RowFn({4, "ORDER DETAILS"}),
      RowFn({0, ""}),
      RowFn({6, "Date: " & OrderDate; 20, "Outlet: " & OutletName}),
      RowFn({6, "Requested By: " & ReqUser; 20, "Approved By: " & AppUser}),
      RowFn({6, "Progress: " & OrderProgress}),
      RowFn({0, ""}),
      RowFn({4, "ORDER TIMELINE"}),
      RowFn({0, ""}),
      CleanTimelineRows,
      RowFn({0, ""}),
      RowFn({4, "RESTOCK ITEMS"}),
      RowFn({0, ""}),
      CleanItemRows
    ),
    VSTACK(
      RowFn({4, "RESTOCK ORDER DOCUMENT"}),
      RowFn({0, ""}),
      RowFn({4, "Please enter a valid Restock Code in cell AB6."})
    )
  ),

  ReportData
)
```

---

## Source Sheets & Column Dependencies

The formula imports data from three files (using `masterFileID`, `OutletFileID`, and `ViewFileID` from Config):
1. **`OutletRestocks`** (`OutletRestocks!A2:T` in Outlet Spreadsheet):
   - Column 1 (`A`): Restock Code
   - Column 2 (`B`): Restock Date
   - Column 3 (`C`): Outlet Code
   - Column 5 (`E`): Requested By User
   - Column 6 (`F`): Approved By User
   - Column 7 (`G`): Order Progress status
   - Columns 8–10 (`H:J`): Submitted Timestamp, User, Comment
   - Columns 11–13 (`K:M`): Revision Timestamp, User, Comment
   - Columns 14–16 (`N:P`): Approved Timestamp, User, Comment
   - Columns 17–19 (`Q:S`): Rejected Timestamp, User, Comment
2. **`OutletRestockItems`** (`OutletRestockItems!A2:Q` in Outlet Spreadsheet):
   - Column 2 (`B`): Restock Code (matches `$AB$6`)
   - Column 3 (`C`): Source Warehouse Code
   - Column 4 (`D`): SKU Code
   - Column 5 (`E`): Source Storage Name
   - Column 6 (`F`): Quantity
   - Column 7 (`G`): Item Progress Status (`"ALLOCATED"`, `"DELIVERED"`, `"CANCELLED"`)
   - Columns 10, 13, 16 (`J`, `M`, `P`): Status comments
   - Column 17 (`Q`): Record Status (`"Active"`)
3. **`Outlets`** (`Outlets!A2:B` in Master Spreadsheet):
   - Column 1 (`A`): Outlet Code
   - Column 2 (`B`): Outlet Name
4. **`SKU`** (`SKU!A2:G` in Views Spreadsheet):
   - Column 1 (`A`): SKU Code
   - Column 2 (`B`): SKUCode
   - Column 4 (`D`): Product Name
   - Column 6 (`F`): Variant Values
5. **`Warehouses`** (`Warehouses!A2:B` in Master Spreadsheet):
   - Column 1 (`A`): Warehouse Code
   - Column 2 (`B`): Warehouse Name

---

## Detailed Logic Breakdown

1. **Order Search**: Matches the Restock Code in `$AB$6` with `OutletRestocks`.
2. **Workflow Timeline Compilation**:
   - Compiles timestamp rows for `SUBMITTED`, `REVISION REQUIRED`, `APPROVED`, and `REJECTED` states.
   - Filters out blank states, sorts chronologically, and text-joins them into a description log.
3. **Item Filtering & Detail Join**:
   - Filters `OutletRestockItems` where restock code = `$AB$6` and status = `"Active"`.
   - Loops through items:
     - Looks up SKU product description and variant values from the `SKU` view.
     - Looks up source Warehouse Name from the `Warehouses` registry.
     - Selects item status comment matching progress (e.g. `ALLOCATED` -> reads Col 10).
     - Renders a multi-row card block for each item (display name, quantity, storage/warehouse detail, and comment).
4. **Output Stacking**: Arranges order headers, workflow timelines, and item cards into a 39-column wide printable layout sheet.
