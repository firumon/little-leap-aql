# Payment Report

The **Payment Report** generates a detailed payment receipt document for a specific payment transaction code. It retrieves the metadata of the payment (date, amount, mode, reference, collected by user, progress) and coordinates it with the associated outlet details, the linked invoice details (including invoice date, subtotal, discount, progress, and payable amount), and lists any other active payments recorded for the same invoice.

---

## Cell Destination & Input Details

- **Output Destination Cell**: `A10`
- **User Input Dependency**: Cell **`$AB$6`** (Payment Code).
- **Purpose**: Retrieves details for the payment transaction matching this code. If `$AB$6` is blank or invalid, it outputs: `"Please enter a valid Payment Code in cell AB6."`

---

## Google Sheet Formula

```excel
=LET(
  OutletFileID, VLOOKUP("OutletFileID", Config!A:B, 2, 0),
  MasterFileID, VLOOKUP("masterFileID", Config!A:B, 2, 0),

  RawPayments, IMPORTRANGE(OutletFileID, "OutletPayments!A2:Q"),
  RawInvoices, IMPORTRANGE(OutletFileID, "OutletConsumptionInvoices!A2:AA"),
  RawOutlets, IMPORTRANGE(MasterFileID, "Outlets!A2:Q"),

  RowFn, LAMBDA(idx_val_pairs, MAP(SEQUENCE(1, 39), LAMBDA(col_idx, IFERROR(VLOOKUP(col_idx, idx_val_pairs, 2, FALSE), "")))),
  FormatEpochDateOnly, LAMBDA(val, LET(num, IFERROR(VALUE(val), 0), IF(num > 100000000000, TEXT(25569 + num / 86400000, "yyyy-mm-dd"), val))),
  ToTextAmt, LAMBDA(val, LET(num, IFERROR(VALUE(val), 0), TEXT(num, "0.00"))),

  PaymentCodes, TOCOL(CHOOSECOLS(RawPayments, 1)),
  OutletCodes, TOCOL(CHOOSECOLS(RawOutlets, 1)),
  InvoiceCodes, TOCOL(CHOOSECOLS(RawInvoices, 1)),

  MatchIdx, IFERROR(MATCH($AB$6, PaymentCodes, 0), 0),
  HasPayment, MatchIdx > 0,

  PaymentRow, IF(HasPayment, CHOOSEROWS(RawPayments, MatchIdx), MAKEARRAY(1, 17, LAMBDA(r, c, ""))),

  PaymentDate, CHOOSEROWS(CHOOSECOLS(PaymentRow, 2), 1),
  OutletCode, CHOOSEROWS(CHOOSECOLS(PaymentRow, 3), 1),
  InvoiceCode, CHOOSEROWS(CHOOSECOLS(PaymentRow, 4), 1),
  PaymentAmt, CHOOSEROWS(CHOOSECOLS(PaymentRow, 5), 1),
  PaymentMode, CHOOSEROWS(CHOOSECOLS(PaymentRow, 6), 1),
  PaymentRef, CHOOSEROWS(CHOOSECOLS(PaymentRow, 7), 1),
  CollectedBy, CHOOSEROWS(CHOOSECOLS(PaymentRow, 8), 1),
  PaymentProgress, CHOOSEROWS(CHOOSECOLS(PaymentRow, 9), 1),

  OutletRow, IF(HasPayment, XLOOKUP(OutletCode, OutletCodes, RawOutlets, MAKEARRAY(1, 17, LAMBDA(r, c, ""))), MAKEARRAY(1, 17, LAMBDA(r, c, ""))),
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

  InvoiceMatchIdx, IFERROR(MATCH(InvoiceCode, InvoiceCodes, 0), 0),
  HasInvoice, InvoiceMatchIdx > 0,
  InvoiceRow, IF(HasInvoice, CHOOSEROWS(RawInvoices, InvoiceMatchIdx), MAKEARRAY(1, 27, LAMBDA(r, c, ""))),

  InvoiceDate, CHOOSEROWS(CHOOSECOLS(InvoiceRow, 3), 1),
  InvoiceSubtotal, CHOOSEROWS(CHOOSECOLS(InvoiceRow, 7), 1),
  InvoiceDiscount, CHOOSEROWS(CHOOSECOLS(InvoiceRow, 8), 1),
  InvoiceProgress, CHOOSEROWS(CHOOSECOLS(InvoiceRow, 14), 1),

  InvoiceSubtotalVal, IFERROR(VALUE(InvoiceSubtotal), 0),
  InvoiceDiscountVal, IFERROR(VALUE(InvoiceDiscount), 0),
  InvoicePayableVal, InvoiceSubtotalVal - InvoiceDiscountVal,

  RawPaymentsStatus, TOCOL(CHOOSECOLS(RawPayments, 16)),
  RawPaymentsInvoiceCode, TOCOL(CHOOSECOLS(RawPayments, 4)),
  RawPaymentsCode, TOCOL(CHOOSECOLS(RawPayments, 1)),
  RawPaymentsProgress, TOCOL(CHOOSECOLS(RawPayments, 9)),

  OtherPayments, IFERROR(
    FILTER(RawPayments, (RawPaymentsInvoiceCode = InvoiceCode) * (RawPaymentsCode <> $AB$6) * (RawPaymentsStatus = "Active")),
    MAKEARRAY(1, 17, LAMBDA(r, c, ""))
  ),

  HasOtherPayments, AND(HasInvoice, CHOOSEROWS(CHOOSECOLS(OtherPayments, 1), 1) <> ""),

  DummyRow, RowFn({0, "DUMMY"}),

  OtherPaymentRows, REDUCE(DummyRow, SEQUENCE(IF(HasOtherPayments, ROWS(OtherPayments), 1)), LAMBDA(acc, k, LET(
    row_val, CHOOSEROWS(OtherPayments, k),
    o_code, CHOOSEROWS(CHOOSECOLS(row_val, 1), 1),
    o_date, CHOOSEROWS(CHOOSECOLS(row_val, 2), 1),
    o_amt, CHOOSEROWS(CHOOSECOLS(row_val, 5), 1),
    o_mode, CHOOSEROWS(CHOOSECOLS(row_val, 6), 1),
    o_user, CHOOSEROWS(CHOOSECOLS(row_val, 8), 1),
    o_progress, CHOOSEROWS(CHOOSECOLS(row_val, 9), 1),

    FormattedODate, FormatEpochDateOnly(o_date),
    
    Line_A, RowFn({4, o_code; 15, o_user; 27, ToTextAmt(o_amt)}),
    Line_B, RowFn({4, FormattedODate; 15, o_mode & IF(o_progress = "CANCELLED", " (CANCELLED)", "")}),
    
    VSTACK(acc, Line_A, Line_B, RowFn({0, ""}))
  ))),

  CleanOtherPayments, IF(
    HasOtherPayments,
    CHOOSEROWS(OtherPaymentRows, SEQUENCE(ROWS(OtherPaymentRows) - 1, 1, 2)),
    RowFn({4, "No other payments found for this invoice."})
  ),

  FormattedPaymentDate, FormatEpochDateOnly(PaymentDate),
  FormattedInvoiceDate, FormatEpochDateOnly(InvoiceDate),

  ReportData, IF(
    HasPayment,
    VSTACK(
      RowFn({4, OutletInfoString; 27, "Date: " & FormattedPaymentDate}),
      RowFn({27, "Mode: " & PaymentMode}),
      RowFn({27, "User: " & CollectedBy}),
      RowFn({27, "Reference: " & IF(PaymentRef <> "", PaymentRef, "-")}),
      RowFn({0, ""}),
      RowFn({0, ""}),
      RowFn({4, ToTextAmt(PaymentAmt)}),
      RowFn({0, ""}),
      RowFn({0, ""}),
      RowFn({4, "INVOICE DETAILS"}),
      RowFn({0, ""}),
      RowFn({4, "Invoice Code & Date"; 15, "Amount"; 27, "Payable & Status"}),
      RowFn({4, InvoiceCode; 15, "SubTotal: " & ToTextAmt(InvoiceSubtotalVal); 27, ToTextAmt(InvoicePayableVal)}),
      RowFn({4, FormattedInvoiceDate; 15, "Discount: " & ToTextAmt(InvoiceDiscountVal); 27, InvoiceProgress}),
      RowFn({0, ""}),
      RowFn({4, "OTHER PAYMENTS FOR THIS INVOICE"}),
      RowFn({0, ""}),
      RowFn({4, "Code & Date"; 15, "Collected By/Mode"; 27, "Amount"}),
      CleanOtherPayments
    ),
    VSTACK(
      RowFn({4, "Please enter a valid Payment Code in cell AB6."})
    )
  ),

  ReportData
)
```

---

## Source Sheets & Column Dependencies

The formula imports data from three spreadsheets (using `masterFileID` and `OutletFileID` keys from Config):
1. **`OutletPayments`** (`OutletPayments!A2:Q` in Outlet Spreadsheet):
   - Column 1 (`A`): Payment Code (matches `$AB$6`)
   - Column 2 (`B`): Payment Date
   - Column 3 (`C`): Outlet Code
   - Column 4 (`D`): Outlet Consumption Invoice Code
   - Column 5 (`E`): Payment Amount
   - Column 6 (`F`): Payment Mode
   - Column 7 (`G`): Payment Reference
   - Column 8 (`H`): Username
   - Column 9 (`I`): Progress (`"SUBMITTED"`, `"CANCELLED"`)
   - Column 16 (`P`): Status (`"Active"`)
2. **`OutletConsumptionInvoices`** (`OutletConsumptionInvoices!A2:AA` in Outlet Spreadsheet):
   - Column 1 (`A`): Invoice Code
   - Column 3 (`C`): Invoice Date
   - Column 7 (`G`): Subtotal
   - Column 8 (`H`): Discount
   - Column 14 (`N`): Progress status (`"PENDING_PAYMENT"`, `"PARTIALLY_PAID"`, `"PAID"`, `"CANCELLED"`)
   - Column 27 (`AA`): Status (`"Active"`)
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

---

## Detailed Logic Breakdown

1. **Payment Search**: Matches the Payment Code in `$AB$6` with `OutletPayments` columns.
2. **Outlet Details Resolution**: Resolves full outlet address and tax details from `Outlets!A2:Q` based on the payment's `OutletCode`.
3. **Invoice Matching**: Looks up the invoice row matching the payment's `OutletConsumptionInvoiceCode` in `OutletConsumptionInvoices` to show original subtotal, discount, progress, and payable amount.
4. **Other Payments Retrieval**: Filters `OutletPayments` for all other active, non-cancelled payment rows matching the same invoice code (excluding the current code `$AB$6`).
5. **Other Payments Loop (`REDUCE`)**: Stacks detailed logs for each other payment:
   - Line A (2nd line): Code at Col D (index 4), Username at Col O (index 15), Amount at Col AA (index 27).
   - Line B (3rd line): Date at Col D (index 4), Mode at Col O (index 15).
   - Blank row between payment blocks.
6. **Final Array Stacking**: Combines all sections into a unified 39-column layout.
