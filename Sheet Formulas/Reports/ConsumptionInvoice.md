# ConsumptionInvoice Report

The **ConsumptionInvoice Report** generates a comprehensive Consumption Invoice Document for a specific stock consumption invoice transaction. It formats the metadata details of the invoice (date, consumption code, outlet, username) and the itemized invoiced items list, along with a complete financial summary (subtotal, discount, return deduction, taxable amount, tax amount, and net payable) into a printable 39-column layout.

---

## Cell Destination & Input Details

- **Output Destination Cell**: `A10`
- **User Input Dependency**: Cell **`$AB$6`** (Consumption Invoice Code).
- **Purpose**: Retrieves details for the consumption invoice matching this code. If `$AB$6` is blank or invalid, it outputs a warning: `"Please enter a valid Consumption Invoice Code in cell AB6."`

---

## Google Sheet Formula

```excel
=LET(
  OutletFileID, VLOOKUP("OutletFileID", Config!A:B, 2, 0),
  MasterFileID, VLOOKUP("masterFileID", Config!A:B, 2, 0),
  SKUFileID, VLOOKUP("ViewFileID", Config!A:B, 2, 0),

  RawInvoices, IMPORTRANGE(OutletFileID, "OutletConsumptionInvoices!A2:AA"),
  RawItems, IMPORTRANGE(OutletFileID, "OutletConsumptionInvoiceItems!A2:K"),
  RawOutlets, IMPORTRANGE(MasterFileID, "Outlets!A2:Q"),
  RawSKUs, IMPORTRANGE(SKUFileID, "SKU!A2:I"),

  RowFn, LAMBDA(idx_val_pairs, MAP(SEQUENCE(1, 39), LAMBDA(col_idx, IFERROR(VLOOKUP(col_idx, idx_val_pairs, 2, FALSE), "")))),
  FormatEpochDateOnly, LAMBDA(val, LET(num, IFERROR(VALUE(val), 0), IF(num > 100000000000, TEXT(25569 + num / 86400000, "yyyy-mm-dd"), val))),
  ToTextAmt, LAMBDA(val, LET(num, IFERROR(VALUE(val), 0), TEXT(num, "0.00"))),
  ParseTaxObj, LAMBDA(obj, LET(code, IFERROR(REGEXEXTRACT(obj, """TaxCode"":\s*""([^""]+)"""), ""), taxable, IFERROR(VALUE(REGEXEXTRACT(obj, """TaxableAmount"":\s*""?([0-9.-]+)""?")), 0), tax_val, IFERROR(VALUE(REGEXEXTRACT(obj, """TaxAmount"":\s*""?([0-9.-]+)""?")), 0), HSTACK(code, taxable, tax_val))),

  InvoiceCodes, TOCOL(CHOOSECOLS(RawInvoices, 1)),
  OutletCodes, TOCOL(CHOOSECOLS(RawOutlets, 1)),
  SKU_Codes, TOCOL(CHOOSECOLS(RawSKUs, 1)),

  MatchIdx, IFERROR(MATCH($AB$6, InvoiceCodes, 0), 0),
  HasOrder, MatchIdx > 0,

  OrderRow, IF(HasOrder, CHOOSEROWS(RawInvoices, MatchIdx), MAKEARRAY(1, 27, LAMBDA(r, c, ""))),

  InvoiceDate, CHOOSEROWS(CHOOSECOLS(OrderRow, 3), 1),
  OutletCode, CHOOSEROWS(CHOOSECOLS(OrderRow, 4), 1),
  Username, CHOOSEROWS(CHOOSECOLS(OrderRow, 5), 1),
  ConsumptionCode, CHOOSEROWS(CHOOSECOLS(OrderRow, 2), 1),
  OrderProgress, CHOOSEROWS(CHOOSECOLS(OrderRow, 14), 1),
  Subtotal, CHOOSEROWS(CHOOSECOLS(OrderRow, 7), 1),
  Discount, CHOOSEROWS(CHOOSECOLS(OrderRow, 8), 1),
  TaxDetails, CHOOSEROWS(CHOOSECOLS(OrderRow, 11), 1),
  SubtotalVal, IFERROR(VALUE(Subtotal), 0),
  DiscountVal, IFERROR(VALUE(Discount), 0),

  OutletRow, IF(HasOrder, XLOOKUP(OutletCode, OutletCodes, RawOutlets, MAKEARRAY(1, 17, LAMBDA(r, c, ""))), MAKEARRAY(1, 17, LAMBDA(r, c, ""))),
  OutletName, CHOOSEROWS(CHOOSECOLS(OutletRow, 2), 1),
  ContactPerson, CHOOSEROWS(CHOOSECOLS(OutletRow, 3), 1),
  Phone, CHOOSEROWS(CHOOSECOLS(OutletRow, 4), 1),
  Email, CHOOSEROWS(CHOOSECOLS(OutletRow, 5), 1),
  Country, CHOOSEROWS(CHOOSECOLS(OutletRow, 6), 1),
  Province, CHOOSEROWS(CHOOSECOLS(OutletRow, 7), 1),
  City, CHOOSEROWS(CHOOSECOLS(OutletRow, 8), 1),
  Area, CHOOSEROWS(CHOOSECOLS(OutletRow, 9), 1),
  TaxRegistrationNumber, CHOOSEROWS(CHOOSECOLS(OutletRow, 16), 1),
  TaxRegistrationName, CHOOSEROWS(CHOOSECOLS(OutletRow, 17), 1),

  AddressString, TEXTJOIN(", ", TRUE, Area, City, Province, Country),
  ContactString, IF(ContactPerson <> "", "Contact Person: " & ContactPerson, ""),
  PhoneString, IF(Phone <> "", "Phone: " & Phone, ""),
  EmailString, IF(Email <> "", "Email: " & Email, ""),
  TaxString, IF(AND(TaxRegistrationName <> "", TaxRegistrationNumber <> ""), TaxRegistrationName & ": " & TaxRegistrationNumber, ""),

  OutletInfoString, TEXTJOIN(CHAR(10), TRUE, OutletName, AddressString, ContactString, PhoneString, EmailString, TaxString),

  DummyRow, RowFn({0, "DUMMY"}),

  FilteredItems, IFERROR(
    FILTER(RawItems, (TOCOL(CHOOSECOLS(RawItems, 2)) = $AB$6) * (TOCOL(CHOOSECOLS(RawItems, 11)) = "Active")),
    MAKEARRAY(1, 11, LAMBDA(r, c, ""))
  ),

  HasItems, AND(HasOrder, CHOOSEROWS(CHOOSECOLS(FilteredItems, 1), 1) <> ""),

  ItemRows, REDUCE(DummyRow, SEQUENCE(ROWS(FilteredItems)), LAMBDA(acc, k, LET(
    item_row, CHOOSEROWS(FilteredItems, k),
    ItemSku, CHOOSEROWS(CHOOSECOLS(item_row, 3), 1),
    ItemQty, CHOOSEROWS(CHOOSECOLS(item_row, 4), 1),
    ItemPrice, CHOOSEROWS(CHOOSECOLS(item_row, 5), 1),
    ItemTotal, CHOOSEROWS(CHOOSECOLS(item_row, 6), 1),
    ItemDiscount, CHOOSEROWS(CHOOSECOLS(item_row, 7), 1),
    ItemTaxAmount, CHOOSEROWS(CHOOSECOLS(item_row, 9), 1),

    SKU_Row, XLOOKUP(ItemSku, SKU_Codes, RawSKUs, MAKEARRAY(1, 9, LAMBDA(r, c, ""))),
    ProdName, CHOOSEROWS(CHOOSECOLS(SKU_Row, 4), 1),
    VarValues, CHOOSEROWS(CHOOSECOLS(SKU_Row, 6), 1),
    UOMName, CHOOSEROWS(CHOOSECOLS(SKU_Row, 9), 1),

    Line1, RowFn({5, k & "."; 6, ProdName; 20, "Rate: " & ToTextAmt(ItemPrice); 27, ItemQty & " " & UOMName; 34, ToTextAmt(ItemTotal)}),
    Line2, RowFn({6, ItemSku & IF(VarValues <> "", " / " & VarValues, ""); 20, "Discount: " & ToTextAmt(ItemDiscount); 27, "Tax: " & ToTextAmt(ItemTaxAmount)}),

    VSTACK(
      acc,
      Line1,
      Line2,
      RowFn({0, ""})
    )
  ))),

  CleanItemRows, IF(
    HasItems,
    CHOOSEROWS(ItemRows, SEQUENCE(ROWS(ItemRows) - 1, 1, 2)),
    RowFn({6, "No items found in this consumption invoice."})
  ),

  HasTax, AND(TaxDetails <> "", TaxDetails <> "[]"),

  TaxLines, IF(
    HasTax,
    LET(
      TaxItems, TOCOL(SPLIT(REGEXREPLACE(TaxDetails, "^\[|\]$", ""), "}")),
      DummyTaxRow, RowFn({0, "DUMMY"}),
      StackedTax, REDUCE(DummyTaxRow, SEQUENCE(ROWS(TaxItems)), LAMBDA(acc, i, LET(
        item, INDEX(TaxItems, i),
        Cleaned, REGEXREPLACE(item, "^,?[{\s]*|[}\s]*$", ""),
        Parsed, ParseTaxObj(Cleaned),
        TaxCodeVal, INDEX(Parsed, 1, 1),
        TaxableVal, INDEX(Parsed, 1, 2),
        TaxVal, INDEX(Parsed, 1, 3),
        
        TaxLineRow, RowFn({6, TaxCodeVal; 16, "Taxable Amount: " & ToTextAmt(TaxableVal); 27, "Tax: " & ToTextAmt(TaxVal)}),
        VSTACK(acc, TaxLineRow)
      ))),
      CHOOSEROWS(StackedTax, SEQUENCE(ROWS(StackedTax) - 1, 1, 2))
    ),
    RowFn({6, "No tax details found."})
  ),

  FormattedInvoiceDate, FormatEpochDateOnly(InvoiceDate),

  ReportData, IF(
    HasOrder,
    VSTACK(
      RowFn({4, OutletInfoString; 27, "Date: " & FormattedInvoiceDate}),
      RowFn({27, "User: " & Username}),
      RowFn({27, "Progress: " & OrderProgress}),
      RowFn({0, ""}),
      RowFn({0, ""}),
      RowFn({0, ""}),
      RowFn({4, "INVOICED ITEMS"}),
      RowFn({0, ""}),
      CleanItemRows,
      RowFn({0, ""}),
      RowFn({4, "TAX INFORMATIONS"}),
      RowFn({0, ""}),
      TaxLines,
      RowFn({0, ""}),
      RowFn({4, "INVOICE SUMMARY"}),
      RowFn({0, ""}),
      RowFn({16, "SubTotal"; 27, ToTextAmt(Subtotal)}),
      RowFn({16, "Invoice Discount"; 27, ToTextAmt(Discount)}),
      RowFn({16, "Payable Amount"; 27, ToTextAmt(SubtotalVal - DiscountVal)})
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

The formula imports data from three files (using `masterFileID`, `OutletFileID`, and `ViewFileID` from Config):
1. **`OutletConsumptionInvoices`** (`OutletConsumptionInvoices!A2:AA` in Outlet Spreadsheet):
   - Column 1 (`A`): Invoice Code (matches `$AB$6`)
   - Column 2 (`B`): Outlet Consumption Code
   - Column 3 (`C`): Invoice Date
   - Column 4 (`D`): Outlet Code
   - Column 5 (`E`): Username
   - Column 7 (`G`): Subtotal
   - Column 8 (`H`): Discount
   - Column 11 (`K`): Tax Details
   - Column 14 (`N`): Progress status (`"PENDING_PAYMENT"`, `"PARTIALLY_PAID"`, `"PAID"`, `"CANCELLED"`)
   - Column 27 (`AA`): Status (`"Active"`)
2. **`OutletConsumptionInvoiceItems`** (`OutletConsumptionInvoiceItems!A2:K` in Outlet Spreadsheet):
   - Column 2 (`B`): Outlet Consumption Invoice Code (matches `$AB$6`)
   - Column 3 (`C`): SKU Code
   - Column 4 (`D`): Quantity
   - Column 5 (`E`): Price
   - Column 6 (`F`): Total
   - Column 7 (`G`): Discount
   - Column 9 (`I`): Tax Amount
   - Column 11 (`K`): Record Status (`"Active"`)
3. **`Outlets`** (`Outlets!A2:Q` in Master Spreadsheet):
   - Column 1 (`A`): Outlet Code
   - Column 2 (`B`): Outlet Name
   - Column 3 (`C`): Contact Person
   - Column 4 (`D`): Phone
   - Column 5 (`E`): Email
   - Column 6 (`F`): Country
   - Column 7 (`G`): Province
   - Column 8 (`H`): City
   - Column 9 (`I`): Area
   - Column 16 (`P`): Tax Registration Number
   - Column 17 (`Q`): Tax Registration Name
4. **`SKU`** (`SKU!A2:I` in Views Spreadsheet):
   - Column 1 (`A`): SKU Code
   - Column 2 (`B`): SKUCode
   - Column 4 (`D`): Product Name
   - Column 6 (`F`): Variant Values
   - Column 9 (`I`): UOM Name

---

## Detailed Logic Breakdown

1. **Order Search**: Matches the Consumption Invoice Code in `$AB$6` with `OutletConsumptionInvoices`.
2. **Outlet Details Resolution**: Resolves and maps full outlet details (including addresses, contact person, phone, email, and tax details) dynamically from `Outlets!A2:Q`.
3. **Address TEXTJOIN Composition**:
   - `AddressString`: Joins non-empty `Area`, `City`, `Province`, and `Country` fields with a comma separator.
   - `OutletInfoString`: Combines the resolved `OutletName`, `AddressString`, contact person, phone number, email address, and tax identification metadata using `CHAR(10)` as the delimiter. Setting ignore-empty to `TRUE` ensures that any blank parameters are silently ignored and do not generate trailing commas or empty lines in the cell.
4. **Item Filtering & Detail Join**:
   - Filters `OutletConsumptionInvoiceItems` where invoice code = `$AB$6` and status = `"Active"`.
   - Loops through items:
     - Looks up SKU product description, variant values, and UOM name from the `SKU` view.
     - Renders a multi-row card block for each item:
       - Line 1: SeqNo with dot at E (index 5), ProductName at F (index 6), Rate at T (index 20), Qty UOM at AA (index 27), Total at AH (index 34).
       - Line 2: SKUCode / CSV Variants at F (index 6), Discount at T (index 20), Tax Amount at AA (index 27).
5. **Tax Details Listing**: Parses the `TaxDetails` JSON array string via regular expression extracts, stacking each sub-tax entry vertically before the invoice summary: Tax Code at F (index 6), Taxable Amount at P (index 16), and Tax Amount at AA (index 27).
6. **Invoice Summary**: Displays subtotal, discount, and Payable Amount at P (index 16) and AA (index 27). All numeric values are explicitly cast to string representations (using a `ToTextAmt` Lambda) to prevent value clipping inside cells.
