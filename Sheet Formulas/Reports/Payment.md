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
  MasterFileID, IFERROR(VLOOKUP("MasterFileID", Config!A:B, 2, 0), VLOOKUP("masterFileID", Config!A:B, 2, 0)),
  OutletFileID, IFERROR(VLOOKUP("OutletFileID", Config!A:B, 2, 0), VLOOKUP("OperationFileID", Config!A:B, 2, 0)),

  RawPayments, IMPORTRANGE(OutletFileID, "OutletPayments!A1:U"),
  RawInvoices, IMPORTRANGE(OutletFileID, "OutletConsumptionInvoices!A1:AD"),
  RawOutlets, IMPORTRANGE(MasterFileID, "Outlets!A1:V"),

  RowFn, LAMBDA(idx_val_pairs, MAP(SEQUENCE(1, 39), LAMBDA(col_idx, IFERROR(VLOOKUP(col_idx, idx_val_pairs, 2, FALSE), "")))),
  FormatEpochDateOnly, LAMBDA(val, LET(num, IFERROR(VALUE(val), 0), IF(TRIM(val) = "", "", IF(num > 100000000000, TEXT(25569 + num / 86400000, "yyyy-mm-dd"), IFERROR(TEXT(INT(val), "yyyy-mm-dd"), IFERROR(TEXT(DATEVALUE(LEFT(val, 10)), "yyyy-mm-dd"), val)))))),
  ToTextAmt, LAMBDA(val, LET(num, IFERROR(VALUE(val), 0), TEXT(num, "0.00"))),

  PayHeaders, CHOOSEROWS(RawPayments, 1),
  Col_Pay_Code, IFERROR(MATCH("Code", PayHeaders, 0), 1),
  Col_Pay_Date, IFERROR(MATCH("Date", PayHeaders, 0), 2),
  Col_Pay_Outlet, IFERROR(MATCH("OutletCode", PayHeaders, 0), 3),
  Col_Pay_Invoice, IFERROR(MATCH("OutletConsumptionInvoiceCode", PayHeaders, 0), 4),
  Col_Pay_Amount, IFERROR(MATCH("Amount", PayHeaders, 0), 6),
  Col_Pay_Mode, IFERROR(MATCH("Mode", PayHeaders, 0), 7),
  Col_Pay_Ref, IFERROR(MATCH("Reference", PayHeaders, 0), 8),
  Col_Pay_User, IFERROR(MATCH("Username", PayHeaders, 0), 9),
  Col_Pay_Progress, IFERROR(MATCH("Progress", PayHeaders, 0), 10),
  Col_Pay_Status, IFERROR(MATCH("Status", PayHeaders, 0), 20),

  InvHeaders, CHOOSEROWS(RawInvoices, 1),
  Col_Inv_Code, IFERROR(MATCH("Code", InvHeaders, 0), 1),
  Col_Inv_Date, IFERROR(MATCH("Date", InvHeaders, 0), 3),
  Col_Inv_Subtotal, IFERROR(MATCH("Subtotal", InvHeaders, 0), 8),
  Col_Inv_Discount, IFERROR(MATCH("Discount", InvHeaders, 0), 9),
  Col_Inv_TaxAmount, IFERROR(MATCH("TotalTaxAmount", InvHeaders, 0), 11),
  Col_Inv_ReturnDeduction, IFERROR(MATCH("ReturnDeductionTotal", InvHeaders, 0), 14),
  Col_Inv_Progress, IFERROR(MATCH("Progress", InvHeaders, 0), 17),
  Col_Inv_Status, IFERROR(MATCH("Status", InvHeaders, 0), 30),

  OutHeaders, CHOOSEROWS(RawOutlets, 1),
  Col_Out_Code, IFERROR(MATCH("Code", OutHeaders, 0), 1),
  Col_Out_Name, IFERROR(MATCH("Name", OutHeaders, 0), 2),
  Col_Out_Contact, IFERROR(MATCH("ContactPerson", OutHeaders, 0), 4),
  Col_Out_Phone, IFERROR(MATCH("Phone", OutHeaders, 0), 5),
  Col_Out_Email, IFERROR(MATCH("Email", OutHeaders, 0), 6),
  Col_Out_Country, IFERROR(MATCH("Country", OutHeaders, 0), 7),
  Col_Out_Province, IFERROR(MATCH("Province", OutHeaders, 0), 8),
  Col_Out_City, IFERROR(MATCH("City", OutHeaders, 0), 9),
  Col_Out_Area, IFERROR(MATCH("Area", OutHeaders, 0), 10),
  Col_Out_Address, IFERROR(MATCH("CommunicationAddress", OutHeaders, 0), 11),
  Col_Out_TRN, IFERROR(MATCH("TaxRegistrationNumber", OutHeaders, 0), 19),
  Col_Out_TRName, IFERROR(MATCH("TaxRegistrationName", OutHeaders, 0), 20),

  CleanInput, TRIM($AB$6),
  PaymentCodes, TOCOL(CHOOSECOLS(RawPayments, Col_Pay_Code)),
  MatchIdx, IF(CleanInput <> "", IFERROR(MATCH(CleanInput, PaymentCodes, 0), 0), 0),
  HasPayment, MatchIdx > 1,

  PaymentRow, IF(HasPayment, CHOOSEROWS(RawPayments, MatchIdx), MAKEARRAY(1, COLUMNS(RawPayments), LAMBDA(r, c, ""))),

  PaymentDate, INDEX(PaymentRow, 1, Col_Pay_Date),
  OutletCode, INDEX(PaymentRow, 1, Col_Pay_Outlet),
  InvoiceCode, INDEX(PaymentRow, 1, Col_Pay_Invoice),
  PaymentAmt, INDEX(PaymentRow, 1, Col_Pay_Amount),
  PaymentMode, INDEX(PaymentRow, 1, Col_Pay_Mode),
  PaymentRef, INDEX(PaymentRow, 1, Col_Pay_Ref),
  CollectedBy, INDEX(PaymentRow, 1, Col_Pay_User),
  PaymentProgress, INDEX(PaymentRow, 1, Col_Pay_Progress),

  OutletCodes, TOCOL(CHOOSECOLS(RawOutlets, Col_Out_Code)),
  OutletMatchIdx, IF(AND(HasPayment, OutletCode <> ""), IFERROR(MATCH(OutletCode, OutletCodes, 0), 0), 0),
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
  Address, INDEX(OutletRow, 1, Col_Out_Address),
  TaxRegistrationNumber, INDEX(OutletRow, 1, Col_Out_TRN),
  TaxRegistrationName, INDEX(OutletRow, 1, Col_Out_TRName),

  AddressString, IF(Address <> "", Address, TEXTJOIN(", ", TRUE, Area, City, Province, Country)),
  ContactString, IF(ContactPerson <> "", "Contact Person: " & ContactPerson, ""),
  PhoneString, IF(Phone <> "", "Phone: " & Phone, ""),
  EmailString, IF(Email <> "", "Email: " & Email, ""),
  TaxString, IF(AND(TaxRegistrationName <> "", TaxRegistrationNumber <> ""), TaxRegistrationName & ": " & TaxRegistrationNumber, IF(TaxRegistrationNumber <> "", "TRN: " & TaxRegistrationNumber, "")),
  OutletInfoString, TEXTJOIN(CHAR(10), TRUE, OutletName, AddressString, ContactString, PhoneString, EmailString, TaxString),

  InvoiceCodes, TOCOL(CHOOSECOLS(RawInvoices, Col_Inv_Code)),
  InvoiceMatchIdx, IF(AND(HasPayment, InvoiceCode <> ""), IFERROR(MATCH(InvoiceCode, InvoiceCodes, 0), 0), 0),
  HasInvoice, InvoiceMatchIdx > 1,
  InvoiceRow, IF(HasInvoice, CHOOSEROWS(RawInvoices, InvoiceMatchIdx), MAKEARRAY(1, COLUMNS(RawInvoices), LAMBDA(r, c, ""))),

  InvoiceDate, INDEX(InvoiceRow, 1, Col_Inv_Date),
  InvoiceSubtotal, INDEX(InvoiceRow, 1, Col_Inv_Subtotal),
  InvoiceDiscount, INDEX(InvoiceRow, 1, Col_Inv_Discount),
  InvoiceTaxAmt, INDEX(InvoiceRow, 1, Col_Inv_TaxAmount),
  InvoiceReturnDeduction, INDEX(InvoiceRow, 1, Col_Inv_ReturnDeduction),
  InvoiceProgress, INDEX(InvoiceRow, 1, Col_Inv_Progress),

  InvoiceSubtotalVal, IFERROR(VALUE(InvoiceSubtotal), 0),
  InvoiceDiscountVal, IFERROR(VALUE(InvoiceDiscount), 0),
  InvoiceTaxVal, IFERROR(VALUE(InvoiceTaxAmt), 0),
  InvoiceReturnVal, IFERROR(VALUE(InvoiceReturnDeduction), 0),
  InvoicePayableVal, MAX(0, InvoiceSubtotalVal - InvoiceDiscountVal + InvoiceTaxVal - InvoiceReturnVal),

  RawPaymentsInvoiceCode, TOCOL(CHOOSECOLS(RawPayments, Col_Pay_Invoice)),
  RawPaymentsCode, TOCOL(CHOOSECOLS(RawPayments, Col_Pay_Code)),
  RawPaymentsStatus, TOCOL(CHOOSECOLS(RawPayments, Col_Pay_Status)),

  OtherPayments, IF(
    AND(HasInvoice, InvoiceCode <> ""),
    IFERROR(
      FILTER(
        RawPayments,
        (RawPaymentsInvoiceCode = InvoiceCode) *
        (RawPaymentsCode <> CleanInput) *
        (RawPaymentsCode <> "Code") *
        ((RawPaymentsStatus = "Active") + (RawPaymentsStatus = ""))
      ),
      ""
    ),
    ""
  ),
  HasOtherPayments, AND(INDEX(OtherPayments, 1, 1) <> "", INDEX(OtherPayments, 1, 1) <> "#N/A"),

  CleanOtherPayments, IF(
    HasOtherPayments,
    REDUCE("", SEQUENCE(ROWS(OtherPayments)), LAMBDA(acc, k, LET(
      row_val, CHOOSEROWS(OtherPayments, k),
      o_code, INDEX(row_val, 1, Col_Pay_Code),
      o_date, INDEX(row_val, 1, Col_Pay_Date),
      o_amt, INDEX(row_val, 1, Col_Pay_Amount),
      o_mode, INDEX(row_val, 1, Col_Pay_Mode),
      o_user, INDEX(row_val, 1, Col_Pay_User),
      o_progress, INDEX(row_val, 1, Col_Pay_Progress),

      FormattedODate, FormatEpochDateOnly(o_date),

      Line_A, RowFn({4, o_code; 15, o_user; 27, ToTextAmt(o_amt)}),
      Line_B, RowFn({4, FormattedODate; 15, o_mode & IF(o_progress = "CANCELLED", " (CANCELLED)", "")}),

      OtherBlock, VSTACK(Line_A, Line_B, RowFn({0, ""})),

      IF(k = 1, OtherBlock, VSTACK(acc, OtherBlock))
    ))),
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

The formula imports data from three spreadsheets (using `MasterFileID` / `masterFileID` and `OutletFileID` / `OperationFileID` keys from Config):
1. **`OutletPayments`** (`OutletPayments!A1:U` in Outlet Spreadsheet):
   - `Code` (matches `$AB$6`)
   - `Date` (Payment Date)
   - `OutletCode` (Outlet Code)
   - `OutletConsumptionInvoiceCode` (Linked Invoice Code)
   - `Amount` (Payment Amount)
   - `Mode` (Payment Mode: Cash, Bank, Cheque, etc.)
   - `Reference` (Payment Reference ID)
   - `Username` (Collected By User)
   - `Progress` (Payment Progress status)
   - `Status` (Record status: `"Active"`)
2. **`OutletConsumptionInvoices`** (`OutletConsumptionInvoices!A1:AD` in Outlet Spreadsheet):
   - `Code` (Invoice Code)
   - `Date` (Invoice Date)
   - `Subtotal` (Invoice Subtotal)
   - `Discount` (Invoice Discount)
   - `TotalTaxAmount` (Total Tax Amount)
   - `ReturnDeductionTotal` (Return Deduction Total)
   - `Progress` (Invoice Progress status)
   - `Status` (Record status: `"Active"`)
3. **`Outlets`** (`Outlets!A1:V` in Master Spreadsheet):
   - `Code` (Outlet Code)
   - `Name` (Outlet Name)
   - `ContactPerson` (Contact Person)
   - `Phone` (Phone Number)
   - `Email` (Email Address)
   - `Country`, `Province`, `City`, `Area`, `CommunicationAddress` (Address Details)
   - `TaxRegistrationNumber`, `TaxRegistrationName` (Tax Details)

---

## Detailed Logic Breakdown

1. **Header-Name Resolution**: Uses `MATCH` on row 1 headers of all source sheets. This ensures resilient mapping regardless of column re-ordering.
2. **Payment Search**: Matches the Payment Code in cell `$AB$6` with `OutletPayments` codes.
3. **Outlet Details Resolution**: Resolves full outlet address and tax details from `Outlets` based on the payment's `OutletCode`.
4. **Invoice Matching**: Looks up the invoice row matching the payment's `OutletConsumptionInvoiceCode` in `OutletConsumptionInvoices` to display original subtotal, discount, progress, and net payable amount.
5. **Other Payments Retrieval**: Filters `OutletPayments` for all other active payment rows matching the same invoice code (excluding the current payment code `$AB$6`).
6. **Other Payments Loop (`REDUCE`)**: Stacks detailed logs for each other payment without dummy placeholder rows:
   - Line A: Code at Col D (index 4), Username at Col O (index 15), Amount at Col AA (index 27).
   - Line B: Date at Col D (index 4), Mode & Progress at Col O (index 15).
   - Blank row between payment blocks.
7. **Final Array Stacking**: Combines all sections into a unified 39-column layout.
