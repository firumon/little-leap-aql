# Tax System Design Specification

This document defines the architecture and mathematical logic of AQL's universal, metadata-driven taxation engine.

---

## 1. Overview
AQL uses a relational, parent-child spreadsheet hierarchy to represent taxes. This allows business administrators to define simple flat taxes and complex, multi-layered compounding taxes entirely in Google Sheets without modifying system code.

---

## 2. Master Schema: `Taxes` Sheet
The `Taxes` sheet is a master-scope resource containing the following columns:

| Column Name | Data Type | Default | Purpose / Meaning | Example Values |
| :--- | :--- | :--- | :--- | :--- |
| **`Code`** | Text (Key) | *Required* | Unique tax identifier. Both parent categories and child sub-taxes must have a code. | `GST18`, `CGST9`, `EXCISE_PETROL`, `VAT5` |
| **`Name`** | Text | *Required* | Human-readable name displayed on invoices. | `GST 18% Group`, `CGST 9%`, `VAT 5%` |
| **`ParentCode`** | Text | `(Blank)` | Links a child sub-tax to its parent tax group. If blank, this is a parent category. | Parent is `GST18` for `CGST9` and `SGST9` |
| **`PercentageTransaction`** | Number | `0` | Percentage tax calculated on the wholesale/selling invoice price. | `9` (for CGST9), `5` (for VAT5) |
| **`FlatUnit`** | Number | `0` | Flat tax amount per quantity unit (applied directly to quantity). | `19.90` (Fuel Excise), `2.05` (Cigarette Excise) |
| **`CalculationOrder`** | Number | `1` | Evaluation sequence (1, 2, 3...) for children under the same parent. | `1` for Excise, `2` for compound VAT |
| **`CompoundOn`** | Text | `(Blank)` | **Controls Tax-on-Tax compounding:**<br>• `(Blank)`: Applies only to transaction base price.<br>• `PREVIOUS`: Applies to `(Base Price + all preceding tax amounts)`.<br>• `[TaxCode]`: Applies its percentage *only* on a specific preceding tax's calculated amount. | `PREVIOUS` (for Fuel VAT), `EXCISE` (for Cess on Excise) |
| **`SupplyScope`** | Text | `(Blank)` | **Controls place-of-supply branching:**<br>• `(Blank)`: always applies, whatever the destination.<br>• `INTRA`: applies only to a sale within the seller's state.<br>• `INTER`: applies only to a sale across state lines.<br>Exists because some taxes charge a *different set* of components each way and the alternatives sit as siblings under one parent. | `INTRA` (for CGST9/SGST9), `INTER` (for IGST18) |
| **`Description`** | Text | `(Blank)` | Internal notes or explanations. | `Central GST portion for intra-state sales` |
| **`Status`** | Text | `Active` | Normal active/inactive validation state. | `Active`, `Inactive` |
| **`AccessRegion`** | Text | `(Blank)` | Scoped access region validation for AQL. | `Dubai`, `MH` |
| **`CreatedAt`** | Number | *Auto* | Creation timestamp. | *Managed by system* |
| **`UpdatedAt`** | Number | *Auto* | Last update timestamp. | *Managed by system* |
| **`CreatedBy`** | Text | *Auto* | Creator User ID. | *Managed by system* |
| **`UpdatedBy`** | Text | *Auto* | Last updater User ID. | *Managed by system* |

---

## 3. Product Mapping
To apply taxes to products, the **`SKUs`** master sheet contains the following column:
*   **`TaxCode`** (or `TaxCategoryCode`): Links the SKU directly to a parent tax row in the `Taxes` sheet (e.g., `GST18` or `FuelPetrol`).
*   If this column is empty or references an inactive tax code, no taxes are calculated for the item.

---

## 4. Price List Configuration
Pricing behavior and discount-tax policies are configured at the price list level in the **`PriceList`** master sheet:
*   **`TaxInclusive`** (Boolean `TRUE`/`FALSE`):
    *   `FALSE` (Exclusive): Prices in the price list are net values. Tax is calculated and added on top.
    *   `TRUE` (Inclusive): Prices in the price list are gross values. The engine back-calculates the net unit price before tax.
*   **`DiscountTaxPolicy`** (Dropdown `PRE_TAX`/`POST_TAX`):
    *   `PRE_TAX`: Discounts are subtracted from the base price before tax is calculated.
    *   `POST_TAX`: Taxes are calculated on the full base price first, and discounts are subtracted from the gross total at the end.

---

## 5. Transactional Storage Schema: `TaxTransactions` Sheet
Calculated tax amounts are summarized and stored in the **`TaxTransactions`** sheet (under the `accounts` scope) at the **Invoice + Tax Category/Code** level to optimize row volume.

> [!NOTE]
> **Written by** `src/_resource/Accounts/TaxTransactions/composables/useTaxTransactionPayload.js`,
> chained off invoice generation from both paths that raise one — the invoices module's own
> wizard (`useInvoicePayload.buildInvoiceGenerationRequests`) and a consumption submit
> (`useConsumptionPayload.buildInvoiceRequests`) — so a bill lands in the ledger identically
> either way. The rows carry no arithmetic of their own; every figure is lifted from the
> grouped breakdown the one engine already produced.
>
> **On edit**, the rows are REPLACED: the old set is marked `Inactive` and a new set written in
> the same batch, because an edit can change the *set* of tax codes and not just the amounts.
> Nothing is ever hard-deleted — a return already filed against those figures has to stay
> reconstructable.
>
> **A zero-rated component still writes a row** (§7, Example 7); a blank `TaxCode` writes none.

> [!WARNING]
> **Cancellation does not yet reverse the ledger.** `buildCancellationRequests` accepts the
> rows and retires them, but the live `Cancel` button is a generic `AdditionalActions`
> `executeAction` that never reaches that builder — so a cancelled invoice currently leaves its
> tax rows `Active`. Routing Cancel through the domain builder is the outstanding piece.

| Column Name | Data Type | Purpose / Description | Example |
| :--- | :--- | :--- | :--- |
| **`Code`** | Text (Key) | Unique tax transaction record code (prefix `TXD` + sequence). | `TXD2600001` |
| **`Date`** | Text (Date) | The transaction date (YYYY-MM-DD). | `2026-06-11` |
| **`Resource`** | Text | The AQL resource name triggering the tax. | `OutletConsumptionInvoices`, `PurchaseOrders` |
| **`ResourceCode`** | Text | Code of the parent transaction record. | `OCINV2600001` |
| **`CounterPartyType`** | Text | Type of counterparty entity. | `Outlet`, `Supplier`, `Warehouse` |
| **`CounterPartyCode`** | Text | Code of the counterparty entity. | `OUT00005` |
| **`TaxCode`** | Text | Applied child tax component code. | `CGST9`, `EXCISE_PETROL`, `VAT5` |
| **`TaxableAmount`** | Number | Valuation amount on which tax was calculated. | `1000` |
| **`TaxAmount`** | Number | Calculated tax amount. | `90` |
| **`Status`** | Text | Normal active/inactive validation. | `Active` |
| **`AccessRegion`** | Text | Regional permission mapping. | `MH` |
| **`CreatedAt`** | Number | *Auto* | Creation timestamp. | *Managed by system* |
| **`UpdatedAt`** | Number | *Auto* | Last update timestamp. | *Managed by system* |
| **`CreatedBy`** | Text | *Auto* | Creator User ID. | *Managed by system* |
| **`UpdatedBy`** | Text | *Auto* | Last updater User ID. | *Managed by system* |

---

## 6. Developer Guide: Dual-Direction Calculation Engine

To simplify development and prevent logic duplication across the codebase, a single tax engine utility (implemented as a backend GAS helper and a frontend Pinia composable) handles both **forwards** (exclusive) and **backwards** (inclusive) tax calculations.

### A. Frontend Interface (`useTaxResource`) — Layer 2, Master/Taxes

Every tax figure in the frontend comes from ONE function, in the Master/Taxes domain module:
`src/_resource/Master/Taxes/composables/useTaxResource.js`. There is no second calculator.
A `src/composables/useTaxCalculator.js` used to exist alongside it and has been **deleted**:
`src/composables/` is for core app concerns only, never for a resource's own rules.

> [!IMPORTANT]
> **It takes a `price`, never a `skuCode`.** The deleted calculator accepted a SKU and
> resolved the price from the price list itself, which meant that on any screen where the
> user can override a unit price, the line was **taxed at the list price while it was billed
> at the typed one** — `Subtotal` moved and `TotalTaxAmount` did not, on screen and in the
> row that got written. A calculator that cannot see the price cannot be handed one. The
> caller resolves the price (through a price RESOLVER, so an override flows into tax,
> discount apportionment and the payable together) and passes it in.

```javascript
import { useTaxResource } from 'src/_resource/Master/Taxes/composables/useTaxResource'

const { calculateLineTax } = useTaxResource()

const lineTaxResult = calculateLineTax({
  price: 100.00,              // REQUIRED — the price actually being billed
  quantity: 10,
  discount: 15.00,            // optional line-level discount (defaults to 0)
  taxCode: 'GST18',           // from the SKU master
  taxInclusive: false,        // from the price list
  discountTaxPolicy: 'PRE_TAX'// from the price list
})
```

#### Output Structure (`lineTaxResult`):
```javascript
{
  subtotal: 1000.00,       // itemPrice * quantity (the NET base when TaxInclusive is TRUE)
  itemPrice: 100.00,       // net unit price (back-calculated if TaxInclusive is TRUE)
  taxableAmount: 985.00,   // base value tax is computed on (adjusted for pre-tax discounts)
  totalTax: 49.25,         // total accumulated tax for the line
  discount: 15.00,         // applied line discount
  grossAmount: 1034.25,    // final total payable for this line
  breakdown: [             // one entry per tax COMPONENT
    { code: 'CGST9', name: 'CGST 9%', base: 985.00, rate: 9, flatUnit: 0, amount: 24.625 },
    { code: 'SGST9', name: 'SGST 9%', base: 985.00, rate: 9, flatUnit: 0, amount: 24.625 }
  ]
}
```

#### Invoice callers use the shared resolver, not this function directly

An invoice line is priced by `calculateConsumptionInvoice`
(`src/_resource/Operation/OutletConsumptions/composables/useConsumptionInvoice.js`), which
takes the tax calculator as an argument. `makeLineTaxResolver`, in that same file, is the one
adapter that binds a price resolver and the price list's policy flags to `calculateLineTax`
and renames its output to the engine's field names. It performs no arithmetic. Billing screens
pass `makeLineTaxResolver({ priceListCode, resolvePrice })` and never build their own.

Omitting it bills every line **untaxed** — the engine treats a missing calculator as "no tax"
by design, so a caller that forgets it produces `Tax Amount 0.00` silently.

---

### B. Core Execution Flow

#### 1. Forwards Calculation (`TaxInclusive = FALSE`):
Taxes are calculated directly on the price list value:
1.  Set `itemPrice = PriceListPrice`.
2.  If `DiscountTaxPolicy = PRE_TAX`:
    *   Set `taxableAmount = (itemPrice * quantity) - discount`.
3.  Else (`DiscountTaxPolicy = POST_TAX`):
    *   Set `taxableAmount = itemPrice * quantity`.
4.  Process `taxComponents` sequentially by `CalculationOrder` using the calculated `taxableAmount`.
5.  If `DiscountTaxPolicy = POST_TAX`:
    *   Set `grossAmount = (taxableAmount + sum(calculated taxes)) - discount`.
6.  Else:
    *   Set `grossAmount = taxableAmount + sum(calculated taxes)`.

#### 2. Backwards Calculation (`TaxInclusive = TRUE`):
The price list value is treated as the final gross price. The engine resolves the base net price in reverse:
1.  Sum the total equivalent percentage tax rate ($R$) of all standard non-compounded children.
2.  Back-calculate the net unit price:
    $$\text{itemPrice} = \frac{\text{PriceListPrice}}{1 + R}$$
3.  Perform the pre-tax or post-tax discount adjustments and evaluate the sequential compounding calculation steps to resolve `taxableAmount`, `taxAmount`, and `grossAmount`.

> [!WARNING]
> **This back-calculation is only exact for plain, non-compounded percentage taxes.** Step 1
> sums percentage rates of non-compounded children only, which means:
> * a **`FlatUnit`** levy is never backed out of the gross price, and
> * a **compounded** component's rate is missing from the divisor (for GST 5% then PST 9.975%
>   on `PREVIOUS`, the true divisor is `1.05 × 1.09975`, not `1 + 0.05`).
>
> Round-tripping a gross price back through the engine therefore returns the original total for
> Examples 4, 9 and 10, and **overstates** it for Examples 1, 2, 5, 6 and 8. This only bites a
> price list with `TaxInclusive = TRUE` whose tax group compounds or carries a flat unit;
> exclusive price lists are unaffected. Fixing it means changing the formula above, which
> changes money, so it is left stated rather than silently altered.

---

## 7. Calculation Examples

### Example 1: Standard Fuel Compounding (`CompoundOn = PREVIOUS`)
Suppose we sell **100 Liters of Petrol** at a base price of **₹80 / Liter**.
*   **Selling Price (Subtotal):** $100 \times 80 = \text{₹8,000}$
*   **Tax Group Children Configuration:**
    1.  `EXCISE`: `FlatUnit = 19.90`, `CalculationOrder = 1`, `CompoundOn = (Blank)`
    2.  `STATE_VAT`: `PercentageTransaction = 25`, `CalculationOrder = 2`, `CompoundOn = PREVIOUS`

**Engine Execution Steps:**
1.  **Row 1 (`EXCISE`):**
    *   Since it is a flat unit tax: $\text{Amount} = 100 \text{ Liters} \times \text{₹19.90} = \text{₹1,990}$.
    *   Preceding tax accumulator is now: $\text{₹1,990}$.
2.  **Row 2 (`STATE_VAT`):**
    *   Since `CompoundOn = PREVIOUS`, the base for this calculation compounds:
        $$\text{VAT Base} = \text{Selling Price} + \text{Preceding Accumulator} = \text{₹8,000} + \text{₹1,990} = \text{₹9,990}$$
    *   $$\text{VAT Amount} = \text{₹9,990} \times 25\% = \text{₹2,497.50}$$
3.  **Result:** Subtotal ₹8,000 | Excise ₹1,990 | VAT ₹2,497.50 | **Total Invoice: ₹12,487.50**

---

### Example 2: Custom Tax-on-Tax (`CompoundOn = EXCISE`)
Suppose we sell a machinery item at a base price of **₹10,000**.
*   **Tax Group Children Configuration:**
    1.  `EXCISE`: `PercentageTransaction = 12.5`, `CalculationOrder = 1`, `CompoundOn = (Blank)`
    2.  `EDU_CESS`: `PercentageTransaction = 3`, `CalculationOrder = 2`, `CompoundOn = EXCISE`

**Engine Execution Steps:**
1.  **Row 1 (`EXCISE`):**
    *   $$\text{Amount} = \text{₹10,000} \times 12.5\% = \text{₹1,250}$$
2.  **Row 2 (`EDU_CESS`):**
    *   Since `CompoundOn = EXCISE`, the calculation base is the calculated amount of the `EXCISE` row:
        $$\text{Cess Base} = \text{₹1,250}$$
    *   $$\text{Cess Amount} = \text{₹1,250} \times 3\% = \text{₹37.50}$$
3.  **Result:** Subtotal ₹10,000 | Excise ₹1,250 | Cess ₹37.50 | **Total Invoice: ₹11,287.50**

---

### Example 3: Mixed Compounding and Component Targeting
Suppose we have a selling price of **₹100**, and 4 child tax rows configured under a single parent group:
1.  `TAX1`: `PercentageTransaction = 10`, `CalculationOrder = 1`, `CompoundOn = (Blank)`
2.  `TAX2`: `PercentageTransaction = 10`, `CalculationOrder = 2`, `CompoundOn = PREVIOUS`
3.  `TAX3`: `PercentageTransaction = 10`, `CalculationOrder = 3`, `CompoundOn = PREVIOUS`
4.  `GT`: `PercentageTransaction = 5`, `CalculationOrder = 4`, `CompoundOn = TAX1`

**Engine Execution Steps:**
1.  **Row 1 (`TAX1`):**
    *   Base is Selling Price (₹100).
    *   $$\text{TAX1 Amount} = \text{₹100} \times 10\% = \text{₹10}$$
2.  **Row 2 (`TAX2`):**
    *   Base is `PREVIOUS` (Selling Price + preceding taxes): $\text{₹100} + \text{₹10} = \text{₹110}$.
    *   $$\text{TAX2 Amount} = \text{₹110} \times 10\% = \text{₹11}$$
3.  **Row 3 (`TAX3`):**
    *   Base is `PREVIOUS` (Selling Price + preceding taxes): $\text{₹100} + \text{₹10} + \text{₹11} = \text{₹121}$.
    *   $$\text{TAX3 Amount} = \text{₹121} \times 10\% = \text{₹12.10}$$
4.  **Row 4 (`GT`):**
    *   Base is targeted specifically at `TAX1`'s calculated amount (₹10).
    *   $$\text{GT Amount} = \text{₹10} \times 5\% = \text{₹0.50}$$

**Final Result:**
*   Subtotal: ₹100.00
*   `TAX1`: ₹10.00
*   `TAX2`: ₹11.00
*   `TAX3`: ₹12.10
*   `GT`: ₹0.50
*   **Total Invoice Amount:** ₹133.60

---

### Example 4: US Sales Tax (State, County, and City Flat Percentage Accumulation)
In the United States, sales tax is composed of multiple independent levels (State, County, City) calculated on the raw selling price. Suppose we sell an item for **$1,000**.
*   **Tax Group Children Configuration:**
    1.  `STATE`: `PercentageTransaction = 6`, `CalculationOrder = 1`, `CompoundOn = (Blank)`
    2.  `COUNTY`: `PercentageTransaction = 1`, `CalculationOrder = 1`, `CompoundOn = (Blank)`
    3.  `CITY`: `PercentageTransaction = 1.5`, `CalculationOrder = 1`, `CompoundOn = (Blank)`

**Engine Execution Steps:**
1.  **Row 1 (`STATE`):** Calculates 6% on $1,000 $\rightarrow$ **$60.00**
2.  **Row 2 (`COUNTY`):** Calculates 1% on $1,000 $\rightarrow$ **$10.00**
3.  **Row 3 (`CITY`):** Calculates 1.5% on $1,000 $\rightarrow$ **$15.00**
4.  **Result:** Subtotal $1,000.00 | State Tax $60.00 | County Tax $10.00 | City Tax $15.00 | **Total Invoice: $1,085.00**

---

### Example 5: Canadian GST + PST (Compounding Provincial Tax)
In some Canadian provinces, Provincial Sales Tax (PST) compounds on top of the federal Goods and Services Tax (GST). Suppose we sell a service for **$500**.
*   **Tax Group Children Configuration:**
    1.  `GST`: `PercentageTransaction = 5`, `CalculationOrder = 1`, `CompoundOn = (Blank)`
    2.  `PST_COMP`: `PercentageTransaction = 9.975`, `CalculationOrder = 2`, `CompoundOn = PREVIOUS`

**Engine Execution Steps:**
1.  **Row 1 (`GST`):** Calculates 5% on $500 $\rightarrow$ **$25.00**
2.  **Row 2 (`PST_COMP`):** Calculates 9.975% on $(500 + 25) = \$525 \rightarrow$ **$52.37**
3.  **Result:** Subtotal $500.00 | GST $25.00 | PST $52.37 | **Total Invoice: $577.37**

---

### Example 6: Environmental Carbon Cess (Combined Flat and Value-Based Rates)
An environmental regulation on specific chemical imports requires a flat fee of **$50 per metric ton** plus a **2% pollution cess** on the value of the import. Suppose we import **10 metric tons** with a transaction value of **$10,000**.
*   **Tax Group Children Configuration:**
    1.  `TON_LEVY`: `FlatUnit = 50.00`, `CalculationOrder = 1`, `CompoundOn = (Blank)`
    2.  `POLLUTION`: `PercentageTransaction = 2`, `CalculationOrder = 1`, `CompoundOn = (Blank)`

**Engine Execution Steps:**
1.  **Row 1 (`TON_LEVY`):** Calculates flat fee: $10 \text{ tons} \times \$50 = \textbf{\$500.00}$
2.  **Row 2 (`POLLUTION`):** Calculates 2% on value base ($10,000) $\rightarrow$ **$200.00**
3.  **Result:** Subtotal $10,000.00 | Import Levy $500.00 | Pollution Tax $200.00 | **Total Invoice: $10,700.00**

---

### Example 7: EU/UK VAT (Exempt vs. Zero-Rated Items)
In the UK/EU VAT system, products are classified to ensure proper compliance:
1.  **Zero-Rated (0% VAT):** Calculated at 0% to allow businesses to claim input tax credits.
    *   *Configuration:* `VAT_ZERO`: `PercentageTransaction = 0`, `CalculationOrder = 1`, `CompoundOn = (Blank)`.
    *   *Result:* Calculates a tax row of **$0.00** for transaction audits.
2.  **Exempt (No VAT):** Out of scope for VAT.
    *   *Configuration:* The SKU has a blank `TaxCode` in the `SKUs` sheet.
    *   *Result:* The engine completely bypasses tax calculations for this item.

---

### Example 8: Luxury Motor Vehicle Tax (Flat + Percentage Accumulation)
A luxury vehicle import attracts standard 28% GST, a 22% luxury value cess, and a flat infrastructure levy of ₹10,000. Suppose the vehicle value is **₹2,000,000**.
*   **Tax Group Children Configuration:**
    1.  `GST28`: `PercentageTransaction = 28`, `CalculationOrder = 1`, `CompoundOn = (Blank)`
    2.  `LUX_CESS`: `PercentageTransaction = 22`, `CalculationOrder = 1`, `CompoundOn = (Blank)`
    3.  `INFRA`: `FlatUnit = 10000.00`, `CalculationOrder = 1`, `CompoundOn = (Blank)`

**Engine Execution Steps:**
1.  **Row 1 (`GST28`):** Calculates 28% on ₹2,000,000 $\rightarrow$ **₹560,000**
2.  **Row 2 (`LUX_CESS`):** Calculates 22% on ₹2,000,000 $\rightarrow$ **₹440,000**
3.  **Row 3 (`INFRA`):** Flat fee of ₹10,000 per unit $\rightarrow$ **₹10,000**
4.  **Result:** Subtotal ₹2,000,000 | GST ₹560,000 | Luxury Cess ₹440,000 | Infra Levy ₹10,000 | **Total Invoice: ₹3,010,000**

---

### Example 9: UAE VAT 5% (Standard Flat Rate)
Suppose we sell standard baby products in the UAE. The transaction contains **5 packs of diapers** at a price of **AED 100 / pack**.
*   **Selling Price (Subtotal):** $5 \times 100 = \text{AED 500}$
*   **Tax Group Configuration (`VAT5`):**
    1.  `VAT5`: `PercentageTransaction = 5`, `CalculationOrder = 1`, `CompoundOn = (Blank)`

**Engine Execution Steps:**
1.  **Row 1 (`VAT5`):** Calculates 5% on the subtotal (AED 500).
    *   $$\text{VAT Amount} = \text{AED 500} \times 5\% = \text{AED 25.00}$$
2.  **Result:** Subtotal AED 500.00 | VAT AED 25.00 | **Total Invoice: AED 525.00**

---

### Example 10: Indian GST 18% (Intra-State Split)
Suppose we sell goods worth **₹1,000** within Maharashtra (Intra-State transaction).
*   **Selling Price (Subtotal):** ₹1,000
*   **Tax Group Configuration (`GST18`):**
    1.  `CGST9`: `ParentCode = GST18`, `PercentageTransaction = 9`, `CalculationOrder = 1`, `CompoundOn = (Blank)`, **`SupplyScope = INTRA`**
    2.  `SGST9`: `ParentCode = GST18`, `PercentageTransaction = 9`, `CalculationOrder = 1`, `CompoundOn = (Blank)`, **`SupplyScope = INTRA`**
    3.  `IGST18`: `ParentCode = GST18`, `PercentageTransaction = 18`, `CalculationOrder = 1`, `CompoundOn = (Blank)`, **`SupplyScope = INTER`**

**Engine Execution Steps (intra-state — `interState = false`, the default):**
1.  **Row 1 (`CGST9`):** Calculates 9% on the subtotal (₹1,000) $\rightarrow$ **₹90.00**
2.  **Row 2 (`SGST9`):** Calculates 9% on the subtotal (₹1,000) $\rightarrow$ **₹90.00**
3.  `IGST18` is skipped — its scope is `INTER`.
4.  **Result:** Subtotal ₹1,000.00 | CGST ₹90.00 | SGST ₹90.00 | **Total Invoice: ₹1,180.00**

**Engine Execution Steps (inter-state — `interState = true`):**
1.  `CGST9` and `SGST9` are skipped — their scope is `INTRA`.
2.  **Row 3 (`IGST18`):** Calculates 18% on the subtotal (₹1,000) $\rightarrow$ **₹180.00**
3.  **Result:** Subtotal ₹1,000.00 | IGST ₹180.00 | **Total Invoice: ₹1,180.00**

> [!IMPORTANT]
> **Leaving `SupplyScope` blank on all three charges all three** — 9 + 9 + 18 = 36%. Blank
> means "always applies", which is correct for every tax that does *not* branch (VAT, US sales
> tax, excise) and is the only safe default for them. A GST group therefore MUST have the
> column filled in on its children. `interState` is supplied by the caller, because only the
> transaction knows where the buyer is; it defaults to `false`.

---

## 8. Frontend Integration

| Need | Import |
| :--- | :--- |
| Tax rows, groups, components, and **the** line calculation | `_resource/Master/Taxes/composables/useTaxResource.js` |
| The calculator bound to a price resolver + price-list policy, ready for the invoice engine | `makeLineTaxResolver` in `_resource/Operation/OutletConsumptions/composables/useConsumptionInvoice.js` |
| A whole invoice (lines, discount apportionment, grouped `TaxDetails`, net payable) | `calculateConsumptionInvoice`, same file |
| Writing the tax ledger | `_resource/Accounts/TaxTransactions/composables/useTaxTransactionPayload.js` |

Rules that hold across all of them:

1.  **One calculator.** `useTaxResource().calculateLineTax` is the only place tax arithmetic
    happens. Nothing under `src/composables/` may hold resource logic — the former
    `useTaxCalculator.js` was deleted for exactly that reason.
2.  **Pass a price, not a SKU.** See §6.A.
3.  **Never omit the tax calculator** when calling `calculateConsumptionInvoice` — a missing
    one bills every line untaxed, silently.
4.  **`interState` travels with the transaction**, not with the tax. Bind it once per document
    via `makeLineTaxResolver` so every line of one invoice is priced on the same branch.
