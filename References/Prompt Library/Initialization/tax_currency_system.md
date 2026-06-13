# AQL Tax & Currency System

> **Scope boundary**: This document covers tax and currency logic only — compound tax calculations, currency helpers, tax-inclusive/exclusive pricing, tax transaction storage. Its pre-reads reference canonical docs and frontend composables — read them by path. Do NOT load frontend_modification.md or backend_gas_implementation.md unless the task explicitly requires modifying that code.

Use this document to initialize an AI agent session when the task involves modifying, extending, or debugging the tax calculation engine, currency formatting, tax master configuration, or tax transaction storage.

---

## 1. System Architecture & Coordination

AQL's tax system is a metadata-driven engine that supports flat taxes, compound taxes (tax-on-tax), and both tax-inclusive and tax-exclusive pricing — all configured through Google Sheets master data without code changes.

### A. Core File Coordinates
* **Tax Design Specification**: [TAX_SYSTEM_DESIGN.md](file:///f:/LITTLE%20LEAP/AQL/Documents/TAX_SYSTEM_DESIGN.md) — canonical reference for all tax logic
* **Frontend Tax Calculator**: [useTaxCalculator.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/useTaxCalculator.js) — composable for line-level tax calculation
* **Frontend Currency Formatter**: [useCurrency.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/useCurrency.js) — polyvalent currency display helper `_C(value, showSymbol, target, source)`
* **Tax Master Schema**: `Taxes` sheet in Master scope — configured in [setupMasterSheets.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/setupMasterSheets.gs)
* **Tax Transaction Storage**: `TaxTransactions` sheet in Accounts scope — configured in [setupAccountSheets.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/setupAccountSheets.gs)
* **Resource Config**: Tax metadata and UIFields in [syncAppResources.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/syncAppResources.gs)

---

## 2. Mandatory Pre-Reads

Before modifying any tax or currency logic:
* Full tax specification: [TAX_SYSTEM_DESIGN.md](file:///f:/LITTLE%20LEAP/AQL/Documents/TAX_SYSTEM_DESIGN.md)
* Frontend tax composable: [useTaxCalculator.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/useTaxCalculator.js)
* Frontend currency helper: [useCurrency.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/useCurrency.js)
* Frontend architecture rules: [ARCHITECTURE RULES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/ARCHITECTURE%20RULES.md)

---

## 3. Tax Calculation Data Flow

### Key Tax Columns (Taxes Sheet)
| Column | Purpose |
|---|---|
| `PercentageTransaction` | Percentage tax on wholesale/selling price |
| `FlatUnit` | Flat tax amount per unit quantity |
| `CalculationOrder` | Sequential evaluation order (1, 2, 3...) |
| `CompoundOn` | `(Blank)` = base only, `PREVIOUS` = base + all preceding taxes, `[TaxCode]` = specific preceding tax |

### Forwards Calculation (`TaxInclusive = FALSE`)
1. Set `itemPrice = PriceListPrice`.
2. If `DiscountTaxPolicy = PRE_TAX`: Set `taxableAmount = (itemPrice × quantity) - discount`.
3. Else (`POST_TAX`): Set `taxableAmount = itemPrice × quantity`.
4. Process `taxComponents` sequentially by `CalculationOrder`.
5. If `POST_TAX`: `grossAmount = (taxableAmount + totalTax) - discount`.
6. Else: `grossAmount = taxableAmount + totalTax`.

### Backwards Calculation (`TaxInclusive = TRUE`)
1. Sum total equivalent percentage rate ($R$) of all non-compounded children.
2. Back-calculate: $\text{itemPrice} = \frac{\text{PriceListPrice}}{1 + R}$
3. Perform discount adjustments and sequential compounding to resolve amounts.

### Product ↔ Tax Mapping
- `SKUs` master has a `TaxCode` column linking to a parent tax row in `Taxes` sheet.
- `PriceList` master controls `TaxInclusive` (boolean) and `DiscountTaxPolicy` (`PRE_TAX`/`POST_TAX`).

---

## 4. Step-by-Step Implementation Checklist

### Modifying Tax Calculation Logic
1. **Read the specification**: Read [TAX_SYSTEM_DESIGN.md](file:///f:/LITTLE%20LEAP/AQL/Documents/TAX_SYSTEM_DESIGN.md) completely.
2. **Read the composable**: Read [useTaxCalculator.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/useTaxCalculator.js) to understand the current implementation.
3. **Modify with care**: Tax calculation affects all pricing across the entire system. Verify both forwards (exclusive) and backwards (inclusive) calculations.
4. **Test edge cases**: Compound taxes (`CompoundOn = PREVIOUS`), flat unit taxes, zero-rate taxes, and mixed groups.

### Modifying Currency Formatting
1. **Read the helper**: Read [useCurrency.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/useCurrency.js).
2. **Never hardcode symbols**: Always use `_C(value, showSymbol, target, source)` for currency display.
3. **Test multi-currency**: Verify formatting works for all configured currencies.

### Modifying Tax Master Schema
1. **Update setup script**: Modify headers in [setupMasterSheets.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/setupMasterSheets.gs) for `Taxes` sheet.
2. **Update sync config**: Modify UIFields in [syncAppResources.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/syncAppResources.gs) for `Taxes` resource.
3. **Update documentation**: Update [TAX_SYSTEM_DESIGN.md](file:///f:/LITTLE%20LEAP/AQL/Documents/TAX_SYSTEM_DESIGN.md).

---

## 5. Explicit Guardrails (DOs and DO NOTs)

- **DO NOT** hardcode currency symbols anywhere. Always use `_C()` from `useCurrency`.
- **DO NOT** duplicate tax calculation logic. Both frontend and backend must use the same algorithm.
- **DO NOT** skip compound tax testing. A change to the calculation order or CompoundOn logic can silently break invoicing.
- **DO** test both `TaxInclusive = TRUE` and `TaxInclusive = FALSE` scenarios.
- **DO** test both `DiscountTaxPolicy = PRE_TAX` and `POST_TAX` scenarios.
- **DO** verify `TaxTransactions` storage records match the calculated breakdown.

---

## 6. Targeted Verification Plan

### A. Frontend Verification
1. Run `npm run dev` in the `FRONTENT` folder.
2. Create or edit a transaction that triggers tax calculation.
3. Verify the line-level tax breakdown matches expected values.

### B. Backend Verification (If GAS Changed)
1. Push changes: `npm run gas:push`
2. Sync resources and regenerate cache if tax metadata was modified.

### C. Mathematical Verification
1. Manually calculate expected tax amounts for test cases using the formulas in [TAX_SYSTEM_DESIGN.md](file:///f:/LITTLE%20LEAP/AQL/Documents/TAX_SYSTEM_DESIGN.md).
2. Compare against the system's output for the same inputs.
