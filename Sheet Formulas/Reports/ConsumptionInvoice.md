# ConsumptionInvoice Report

The **ConsumptionInvoice Report** generates a comprehensive Consumption Invoice Document for a specific stock consumption invoice transaction. It formats the metadata details of the invoice (date, consumption code, outlet, username, progress), the itemized invoiced items list, any return items credited against the invoice, tax breakdown details, and a financial summary (subtotal, discount, return deduction, payable amount, and settled/paid information) into a printable 39-column layout.

---

## Cell Destination & Input Details

- **Output Destination Cell**: `A10`
- **User Input Dependency**: Cell **`$AB$6`** (Consumption Invoice Code).
- **Purpose**: Retrieves details for the consumption invoice matching this code. If `$AB$6` is blank or invalid, it outputs a warning: `"Please enter a valid Consumption Invoice Code in cell AB6."`

---

## Google Sheet Formula

```excel
=LET(
  MasterFileID, IFERROR(VLOOKUP("MasterFileID", Config!A:B, 2, 0), VLOOKUP("masterFileID", Config!A:B, 2, 0)),
  OutletFileID, IFERROR(VLOOKUP("OutletFileID", Config!A:B, 2, 0), VLOOKUP("OperationFileID", Config!A:B, 2, 0)),
  SKUFileID, IFERROR(VLOOKUP("ViewFileID", Config!A:B, 2, 0), MasterFileID),

  RawInvoices, IMPORTRANGE(OutletFileID, "OutletConsumptionInvoices!A1:AD"),
  RawItems, IMPORTRANGE(OutletFileID, "OutletConsumptionInvoiceItems!A2:K"),
  RawReturns, IMPORTRANGE(OutletFileID, "OutletReturns!A1:AD"),
  RawOutlets, IMPORTRANGE(MasterFileID, "Outlets!A1:V"),
  RawSKUs, IMPORTRANGE(SKUFileID, "SKU!A2:I"),

  RowFn, LAMBDA(idx_val_pairs, MAP(SEQUENCE(1, 39), LAMBDA(col_idx, IFERROR(VLOOKUP(col_idx, idx_val_pairs, 2, FALSE), "")))),
  FormatEpochDateOnly, LAMBDA(val, LET(num, IFERROR(VALUE(val), 0), IF(TRIM(val) = "", "", IF(num > 100000000000, TEXT(25569 + num / 86400000, "yyyy-mm-dd"), IFERROR(TEXT(INT(val), "yyyy-mm-dd"), IFERROR(TEXT(DATEVALUE(LEFT(val, 10)), "yyyy-mm-dd"), val)))))),
  ToTextAmt, LAMBDA(val, LET(num, IFERROR(VALUE(val), 0), TEXT(num, "0.00"))),
  ParseTaxObj, LAMBDA(obj, LET(code, IFERROR(REGEXEXTRACT(obj, """TaxCode"":\s*""([^""]+)"""), ""), taxable, IFERROR(VALUE(REGEXEXTRACT(obj, """TaxableAmount"":\s*""?([0-9.-]+)""?")), 0), tax_val, IFERROR(VALUE(REGEXEXTRACT(obj, """TaxAmount"":\s*""?([0-9.-]+)""?")), 0), HSTACK(code, taxable, tax_val))),

  InvHeaders, CHOOSEROWS(RawInvoices, 1),
  Col_InvCode, IFERROR(MATCH("Code", InvHeaders, 0), 1),
  Col_OutletCode, IFERROR(MATCH("OutletCode", InvHeaders, 0), 5),
  Col_Username, IFERROR(MATCH("Username", InvHeaders, 0), IFERROR(MATCH("UserName", InvHeaders, 0), 6)),
  Col_Date, IFERROR(MATCH("Date", InvHeaders, 0), 3),
  Col_Progress, IFERROR(MATCH("Progress", InvHeaders, 0), 17),
  Col_Subtotal, IFERROR(MATCH("Subtotal", InvHeaders, 0), 8),
  Col_Discount, IFERROR(MATCH("Discount", InvHeaders, 0), 9),
  Col_TaxAmount, IFERROR(MATCH("TotalTaxAmount", InvHeaders, 0), 11),
  Col_TaxDetails, IFERROR(MATCH("TaxDetails", InvHeaders, 0), 12),
  Col_ReturnCodes, IFERROR(MATCH("OutletReturnCodes", InvHeaders, 0), 13),
  Col_ReturnDeduction, IFERROR(MATCH("ReturnDeductionTotal", InvHeaders, 0), 14),
  Col_SettlementMismatch, IFERROR(MATCH("SettlementMismatchAmount", InvHeaders, 0), 15),
  Col_SettlementReason, IFERROR(MATCH("SettlementReason", InvHeaders, 0), 16),

  CleanInput, TRIM($AB$6),
  InvoiceCodes, TOCOL(CHOOSECOLS(RawInvoices, Col_InvCode)),
  MatchIdx, IF(CleanInput <> "", IFERROR(MATCH(CleanInput, InvoiceCodes, 0), 0), 0),
  HasOrder, MatchIdx > 1,

  OrderRow, IF(HasOrder, CHOOSEROWS(RawInvoices, MatchIdx), MAKEARRAY(1, COLUMNS(RawInvoices), LAMBDA(r, c, ""))),

  InvoiceDate, INDEX(OrderRow, 1, Col_Date),
  Raw_OutletCode, INDEX(OrderRow, 1, Col_OutletCode),
  Raw_Username, INDEX(OrderRow, 1, Col_Username),
  OutletCode, IF(LEFT(TRIM(Raw_OutletCode), 3) = "OUT", TRIM(Raw_OutletCode), IF(LEFT(TRIM(Raw_Username), 3) = "OUT", TRIM(Raw_Username), TRIM(Raw_OutletCode))),
  Username, IF(TRIM(OutletCode) = TRIM(Raw_Username), TRIM(Raw_OutletCode), TRIM(Raw_Username)),
  OrderProgress, INDEX(OrderRow, 1, Col_Progress),
  Subtotal, INDEX(OrderRow, 1, Col_Subtotal),
  Discount, INDEX(OrderRow, 1, Col_Discount),
  TotalTaxVal, IFERROR(VALUE(INDEX(OrderRow, 1, Col_TaxAmount)), 0),
  TaxDetails, INDEX(OrderRow, 1, Col_TaxDetails),
  OutletReturnCodes, TRIM(INDEX(OrderRow, 1, Col_ReturnCodes)),
  ReturnDeductionVal, IFERROR(VALUE(INDEX(OrderRow, 1, Col_ReturnDeduction)), 0),
  SettlementMismatchVal, IFERROR(VALUE(INDEX(OrderRow, 1, Col_SettlementMismatch)), 0),
  SettlementReason, INDEX(OrderRow, 1, Col_SettlementReason),
  ReasonLabel, IF(TRIM(SettlementReason) <> "", SettlementReason, "Bad Debt / Write-Off"),

  SubtotalVal, IFERROR(VALUE(Subtotal), 0),
  DiscountVal, IFERROR(VALUE(Discount), 0),

  OutletHeaders, CHOOSEROWS(RawOutlets, 1),
  Col_Out_Code, IFERROR(MATCH("Code", OutletHeaders, 0), 1),
  Col_Out_Name, IFERROR(MATCH("Name", OutletHeaders, 0), 2),
  Col_Out_Contact, IFERROR(MATCH("ContactPerson", OutletHeaders, 0), 4),
  Col_Out_Phone, IFERROR(MATCH("Phone", OutletHeaders, 0), 5),
  Col_Out_Email, IFERROR(MATCH("Email", OutletHeaders, 0), 6),
  Col_Out_Country, IFERROR(MATCH("Country", OutletHeaders, 0), 7),
  Col_Out_Province, IFERROR(MATCH("Province", OutletHeaders, 0), 8),
  Col_Out_City, IFERROR(MATCH("City", OutletHeaders, 0), 9),
  Col_Out_Area, IFERROR(MATCH("Area", OutletHeaders, 0), 10),
  Col_Out_Address, IFERROR(MATCH("CommunicationAddress", OutletHeaders, 0), 11),
  Col_Out_TaxNo, IFERROR(MATCH("TaxRegistrationNumber", OutletHeaders, 0), 19),
  Col_Out_TaxName, IFERROR(MATCH("TaxRegistrationName", OutletHeaders, 0), 20),

  OutletCodes, TOCOL(CHOOSECOLS(RawOutlets, Col_Out_Code)),
  OutletMatchIdx, IF(AND(HasOrder, OutletCode <> ""), IFERROR(MATCH(OutletCode, OutletCodes, 0), 0), 0),
  HasOutlet, OutletMatchIdx > 1,
  OutletRow, IF(HasOutlet, CHOOSEROWS(RawOutlets, OutletMatchIdx), MAKEARRAY(1, COLUMNS(RawOutlets), LAMBDA(r, c, ""))),

  OutletName, INDEX(OutletRow, 1, Col_Out_Name),
  ContactPerson, INDEX(OutletRow, 1, Col_Out_Contact),
  Phone, INDEX(OutletRow, 1, Col_Out_Phone),
  Email, INDEX(OutletRow, 1, Col_Out_Email),
  Country, INDEX(OutletRow, 1, Col_Out_Country),
  Province, INDEX(OutletRow, 1, Col_Out_Province),
  City, INDEX(OutletRow, 1, Col_Out_City),
  Area, INDEX(OutletRow, 1, Col_Out_Area),
  CommAddress, INDEX(OutletRow, 1, Col_Out_Address),
  TaxRegistrationNumber, INDEX(OutletRow, 1, Col_Out_TaxNo),
  TaxRegistrationName, INDEX(OutletRow, 1, Col_Out_TaxName),

  AddressString, IF(TRIM(CommAddress) <> "", CommAddress, TEXTJOIN(", ", TRUE, Area, City, Province, Country)),
  ContactString, IF(TRIM(ContactPerson) <> "", "Contact Person: " & ContactPerson, ""),
  PhoneString, IF(TRIM(Phone) <> "", "Phone: " & Phone, ""),
  EmailString, IF(TRIM(Email) <> "", "Email: " & Email, ""),
  TaxString, IF(AND(TRIM(TaxRegistrationName) <> "", TRIM(TaxRegistrationNumber) <> ""), TaxRegistrationName & ": " & TaxRegistrationNumber, IF(TRIM(TaxRegistrationNumber) <> "", "TRN: " & TaxRegistrationNumber, "")),

  OutletInfoString, IF(HasOutlet, TEXTJOIN(CHAR(10), TRUE, OutletName, AddressString, ContactString, PhoneString, EmailString, TaxString), IF(OutletCode <> "", "Outlet: " & OutletCode, "")),

  SKU_Codes, TOCOL(CHOOSECOLS(RawSKUs, 1)),

  FilteredItems, IFERROR(
    FILTER(RawItems, (TOCOL(CHOOSECOLS(RawItems, 2)) = CleanInput) * (UPPER(TRIM(TOCOL(CHOOSECOLS(RawItems, 11)))) = "ACTIVE")),
    IFERROR(
      FILTER(RawItems, TOCOL(CHOOSECOLS(RawItems, 2)) = CleanInput),
      MAKEARRAY(1, 11, LAMBDA(r, c, ""))
    )
  ),

  HasItems, AND(HasOrder, INDEX(FilteredItems, 1, 1) <> "", INDEX(FilteredItems, 1, 1) <> "#N/A"),

  CleanItemRows, IF(
    HasItems,
    REDUCE(
      "",
      SEQUENCE(ROWS(FilteredItems)),
      LAMBDA(acc, k, LET(
        item_row, CHOOSEROWS(FilteredItems, k),
        ItemSku, INDEX(item_row, 1, 3),
        ItemQty, INDEX(item_row, 1, 4),
        ItemPrice, INDEX(item_row, 1, 5),
        ItemTotal, INDEX(item_row, 1, 6),
        ItemDiscount, INDEX(item_row, 1, 7),
        ItemTaxAmount, INDEX(item_row, 1, 9),

        SKUMatchIdx, IFERROR(MATCH(ItemSku, SKU_Codes, 0), 0),
        SKU_Row, IF(SKUMatchIdx > 0, CHOOSEROWS(RawSKUs, SKUMatchIdx), MAKEARRAY(1, COLUMNS(RawSKUs), LAMBDA(r, c, ""))),
        ProdName, INDEX(SKU_Row, 1, 4),
        VarValues, INDEX(SKU_Row, 1, 6),
        UOMName, INDEX(SKU_Row, 1, 9),
        VarDisplay, IF(VarValues <> "", " / " & VarValues, ""),

        Line1, RowFn({5, k & "."; 6, ProdName; 20, "Rate: " & ToTextAmt(ItemPrice); 27, ItemQty & " " & UOMName; 34, ToTextAmt(ItemTotal)}),
        Line2, RowFn({6, ItemSku & VarDisplay; 20, "Discount: " & ToTextAmt(ItemDiscount); 27, "Tax: " & ToTextAmt(ItemTaxAmount)}),
        Block, VSTACK(Line1, Line2, RowFn({0, ""})),
        IF(k = 1, Block, VSTACK(acc, Block))
      ))
    ),
    RowFn({6, "No items found in this consumption invoice."})
  ),

  ReturnHeaders, CHOOSEROWS(RawReturns, 1),
  Col_Ret_Code, IFERROR(MATCH("Code", ReturnHeaders, 0), 1),
  Col_Ret_SKU, IFERROR(MATCH("SKU", ReturnHeaders, 0), 5),
  Col_Ret_Qty, IFERROR(MATCH("Qty", ReturnHeaders, 0), 6),
  Col_Ret_Price, IFERROR(MATCH("Price", ReturnHeaders, 0), 7),
  Col_Ret_CInv, IFERROR(MATCH("ConsumptionInvoiceCode", ReturnHeaders, 0), 12),
  Col_Ret_SInv, IFERROR(MATCH("SourceInvoiceCode", ReturnHeaders, 0), 13),

  ReturnAllCodes, TOCOL(CHOOSECOLS(RawReturns, Col_Ret_Code)),

  HasReturnCodes, AND(OutletReturnCodes <> "", OutletReturnCodes <> "-"),
  ReturnCodesList, IF(HasReturnCodes, TOCOL(SPLIT(OutletReturnCodes, ",")), ""),
  FallbackReturnCodes, IFERROR(FILTER(ReturnAllCodes, (TOCOL(CHOOSECOLS(RawReturns, Col_Ret_CInv)) = CleanInput) * (ReturnAllCodes <> "Code")), ""),
  EffectiveReturnCodes, IF(HasReturnCodes, ReturnCodesList, FallbackReturnCodes),
  HasReturns, AND(HasOrder, INDEX(EffectiveReturnCodes, 1, 1) <> "", INDEX(EffectiveReturnCodes, 1, 1) <> "#N/A"),

  CleanReturnRows, IF(
    HasReturns,
    REDUCE(
      "",
      SEQUENCE(ROWS(EffectiveReturnCodes)),
      LAMBDA(acc, k, LET(
        ret_code, TRIM(INDEX(EffectiveReturnCodes, k)),
        RetMatchIdx, IFERROR(MATCH(ret_code, ReturnAllCodes, 0), 0),
        ret_row, IF(RetMatchIdx > 0, CHOOSEROWS(RawReturns, RetMatchIdx), MAKEARRAY(1, COLUMNS(RawReturns), LAMBDA(r, c, ""))),
        RetSku, INDEX(ret_row, 1, Col_Ret_SKU),
        RetQty, INDEX(ret_row, 1, Col_Ret_Qty),
        RetPrice, INDEX(ret_row, 1, Col_Ret_Price),
        RetTotal, IFERROR(VALUE(RetQty) * VALUE(RetPrice), 0),
        RetCInv, INDEX(ret_row, 1, Col_Ret_CInv),
        RetSInv, INDEX(ret_row, 1, Col_Ret_SInv),
        RetInvDisplay, IF(TRIM(RetCInv) <> "", TRIM(RetCInv), IF(TRIM(RetSInv) <> "", TRIM(RetSInv), ret_code)),

        SKUMatchIdx, IFERROR(MATCH(RetSku, SKU_Codes, 0), 0),
        SKU_Row, IF(SKUMatchIdx > 0, CHOOSEROWS(RawSKUs, SKUMatchIdx), MAKEARRAY(1, COLUMNS(RawSKUs), LAMBDA(r, c, ""))),
        RetProdName, INDEX(SKU_Row, 1, 4),
        RetUOMName, INDEX(SKU_Row, 1, 9),

        RetDisplayName, IF(RetProdName <> "", RetProdName & " (" & RetSku & ")", RetSku),

        Line1, RowFn({5, k & "."; 6, RetDisplayName; 20, "Rate: " & ToTextAmt(RetPrice); 27, RetQty & " " & RetUOMName; 34, ToTextAmt(RetTotal)}),
        Line2, RowFn({6, RetInvDisplay; 20, "Discount: 0.00"; 27, "Tax: 0.00"}),
        Block, VSTACK(Line1, Line2, RowFn({0, ""})),
        IF(k = 1, Block, VSTACK(acc, Block))
      ))
    ),
    RowFn({6, "No return items found."})
  ),

  EffectiveReturnDeduction, ReturnDeductionVal,

  HasTax, AND(TaxDetails <> "", TaxDetails <> "[]"),

  TaxLines, IF(
    HasTax,
    LET(
      TaxItems, TOCOL(SPLIT(REGEXREPLACE(TaxDetails, "^\[|\]$", ""), "}")),
      REDUCE(
        "",
        SEQUENCE(ROWS(TaxItems)),
        LAMBDA(acc, i, LET(
          item, INDEX(TaxItems, i),
          Cleaned, REGEXREPLACE(item, "^,?[{\s]*|[}\s]*$", ""),
          Parsed, ParseTaxObj(Cleaned),
          TaxCodeVal, INDEX(Parsed, 1, 1),
          TaxableVal, INDEX(Parsed, 1, 2),
          TaxVal, INDEX(Parsed, 1, 3),
          TaxLineRow, RowFn({6, TaxCodeVal; 16, "Taxable Amount: " & ToTextAmt(TaxableVal); 27, "Tax: " & ToTextAmt(TaxVal)}),
          IF(i = 1, TaxLineRow, VSTACK(acc, TaxLineRow))
        ))
      )
    ),
    RowFn({6, "No tax details found."})
  ),

  FormattedInvoiceDate, FormatEpochDateOnly(InvoiceDate),

  PayableVal, MAX(0, SubtotalVal - DiscountVal + TotalTaxVal - EffectiveReturnDeduction),
  IsPaid, UPPER(TRIM(OrderProgress)) = "PAID",
  HasSettlementMismatch, AND(IsPaid, SettlementMismatchVal <> 0),
  PaidVal, MAX(0, PayableVal - SettlementMismatchVal),

  ReportData, IF(
    HasOrder,
    LET(
      BaseHeader, VSTACK(
        RowFn({4, OutletInfoString; 27, "Date: " & FormattedInvoiceDate}),
        RowFn({27, "User: " & Username}),
        RowFn({27, "Progress: " & OrderProgress}),
        RowFn({0, ""}),
        RowFn({0, ""}),
        RowFn({0, ""}),
        RowFn({4, "INVOICED ITEMS"}),
        RowFn({0, ""}),
        CleanItemRows,
        RowFn({0, ""})
      ),

      SectionWithReturns, IF(
        HasReturns,
        VSTACK(
          BaseHeader,
          RowFn({4, "RETURN ITEMS"}),
          RowFn({0, ""}),
          CleanReturnRows,
          RowFn({0, ""})
        ),
        BaseHeader
      ),

      TaxSection, VSTACK(
        RowFn({4, "TAX INFORMATIONS"}),
        RowFn({0, ""}),
        TaxLines,
        RowFn({0, ""})
      ),

      SummaryBase, VSTACK(
        RowFn({16, "SubTotal"; 27, ToTextAmt(Subtotal)}),
        RowFn({16, "Invoice Discount"; 27, ToTextAmt(Discount)})
      ),
      SummaryWithReturns, IF(
        HasReturns,
        VSTACK(SummaryBase, RowFn({16, "Return Items Amount"; 27, ToTextAmt(EffectiveReturnDeduction)})),
        SummaryBase
      ),
      SummaryWithPayable, VSTACK(
        SummaryWithReturns,
        RowFn({16, "Payable Amount"; 27, ToTextAmt(PayableVal)})
      ),

      PaidBlockBase, VSTACK(
        RowFn({0, ""}),
        RowFn({16, "Paid Amount"; 27, ToTextAmt(PaidVal)})
      ),
      PaidBlockWithMismatch, IF(
        HasSettlementMismatch,
        VSTACK(
          PaidBlockBase,
          RowFn({16, ReasonLabel; 27, ToTextAmt(SettlementMismatchVal)})
        ),
        PaidBlockBase
      ),

      SummaryAll, IF(
        IsPaid,
        VSTACK(SummaryWithPayable, PaidBlockWithMismatch),
        SummaryWithPayable
      ),

      SummarySection, VSTACK(
        RowFn({4, "INVOICE SUMMARY"}),
        RowFn({0, ""}),
        SummaryAll
      ),

      VSTACK(
        SectionWithReturns,
        TaxSection,
        SummarySection
      )
    ),
    VSTACK(
      RowFn({4, "CONSUMPTION INVOICE DOCUMENT"}),
      RowFn({0, ""}),
      RowFn({4, "Please enter a valid Consumption Invoice Code in cell AB6."})
    )
  ),

  ReportData
)
```

---

## Source Sheets & Column Dependencies

The formula imports data from three spreadsheets (resolving `MasterFileID`, `OutletFileID`, and `ViewFileID` from `Config!A:B`):

1. **`OutletConsumptionInvoices`** (`OutletConsumptionInvoices!A1:AD` in Outlet Spreadsheet):
   - Dynamically reads column headers: `Code`, `OutletCode`, `Username`, `Date`, `Progress`, `Subtotal`, `Discount`, `TotalTaxAmount`, `TaxDetails`, `OutletReturnCodes`, `ReturnDeductionTotal`, `SettlementMismatchAmount`, `SettlementReason`.
   - Resolves `Progress` directly from Column 17 (`PENDING_PAYMENT`, `PARTIALLY_PAID`, `PAID`, `CANCELLED`).
2. **`OutletConsumptionInvoiceItems`** (`OutletConsumptionInvoiceItems!A2:K` in Outlet Spreadsheet):
   - Column 2 (`B`): Outlet Consumption Invoice Code (matches `$AB$6`)
   - Column 3 (`C`): SKU Code
   - Column 4 (`D`): Quantity
   - Column 5 (`E`): Price
   - Column 6 (`F`): Total
   - Column 7 (`G`): Discount
   - Column 9 (`I`): Tax Amount
   - Column 11 (`K`): Record Status (`"Active"`)
3. **`OutletReturns`** (`OutletReturns!A1:AD` in Outlet Spreadsheet):
   - Reads return rows credited to this invoice: `Code`, `SKU`, `Qty`, `Price`, `ConsumptionInvoiceCode`, `SourceInvoiceCode`.
4. **`Outlets`** (`Outlets!A1:V` in Master Spreadsheet):
   - Dynamically reads outlet headers: `Code`, `Name`, `ContactPerson`, `Phone`, `Email`, `Country`, `Province`, `City`, `Area`, `CommunicationAddress`, `TaxRegistrationNumber`, `TaxRegistrationName`.
5. **`SKU`** (`SKU!A2:I` in Views Spreadsheet, falling back to Master):
   - Column 1 (`A`): SKU Code
   - Column 4 (`D`): Product Name
   - Column 6 (`F`): Variant Values
   - Column 9 (`I`): UOM Name

---

## Detailed Logic Breakdown

1. **Order Search & Header Mapping**: Matches `$AB$6` against the `Code` column in `OutletConsumptionInvoices`. Looks up all column positions dynamically using `MATCH` over the header row to prevent schema shift issues.
2. **Defensive Outlet Code & Username Detection**: Checks if `OutletCode` starts with `"OUT"`. If columns were swapped in the data row, it automatically swaps them back so `OutletCode` always gets the outlet code and `Username` always gets the username.
3. **Full Outlet Information Formatting**: Resolves outlet name, contact person, phone, email, addresses, and TRN tax details dynamically using header indices from `Outlets!A1:V`. Combines non-blank fields with `CHAR(10)` line breaks.
4. **Invoiced Items Card List**: Filters items for this invoice with `Active` status, looks up product name, variant values, and UOM name from `SKU!A2:I`, and stacks multi-row blocks (Line 1: Item #, Product, Rate, Qty & UOM, Total; Line 2: SKU & Variants, Discount, Tax).
5. **Conditional Return Items Section**: If `OutletReturnCodes` (or matching returns in `OutletReturns`) exist, outputs a dedicated `"RETURN ITEMS"` section. Each return item shows:
   - Line 1: Sequence number, `Product Name (SKU)`, Rate, Qty & UOM, Total.
   - Line 2: `<ConsumptionInvoiceCode>`, Discount: 0.00, Tax: 0.00.
   - If no returns exist, this entire section is omitted.
6. **Tax Informations**: Parses `TaxDetails` JSON and outputs tax code, taxable amount, and tax amount per breakdown item.
7. **Invoice Summary**:
   - `SubTotal` and `Invoice Discount`.
   - `Return Items Amount` (only shown if return items exist).
   - `Payable Amount` (`Subtotal - Discount + Tax - Return Items Amount`).
   - If `Progress = "PAID"`, leaves a blank separator row and outputs:
     - `Paid Amount` (`Payable Amount - SettlementMismatchAmount`).
     - `<SettlementReason>` and `<SettlementMismatchAmount>` (e.g. `Bad Debt / Write-Off` and `0.05`), only if `SettlementMismatchAmount` is non-zero.
