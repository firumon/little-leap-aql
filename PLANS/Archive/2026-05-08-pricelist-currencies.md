# PLAN: PriceList and Currencies — Master Resource Implementation
**Status**: COMPLETED
**Created**: 2026-05-08
**Created By**: Brain Agent (deepseek-v4-pro)
**Executed By**: Build Agent (Kilo Code GPT-5.5)

---

## Objective

Add three new master resources (`Currencies`, `PriceList`, `PriceListItems`) plus a tenant-scoped config key (`PriceListLookup`) and extend `OutletOperatingRules` with a `PriceListCode` column. This enables:
1. A currency registry (manual codes like AED/INR) with conversion factors.
2. A price list resource that stores SKU prices either as an inline JSON column or as child `PriceListItems` rows — controlled by `App.Config.PriceListLookup`.
3. Per-outlet price list assignment via `OutletOperatingRules.PriceListCode`.
4. Resolution chain: `OutletOperatingRules.PriceListCode` → first PriceList with `IsDefault=TRUE` → no pricing.

No GAS server-side logic changes are needed — all pricing resolution and format decisions happen in the frontend. GAS stays a pure persistence pipe.

---

## Context

- Existing master sheets: 9 resources under `CONFIG.MASTER_SHEETS`.
- Existing pattern: UOMs uses manual codes (`CodePrefix: ''`, `CodeSequenceLength: 0`) — Currencies will follow this.
- Existing pattern: `OutletConsumptionInvoices.PriceListCode` already exists and is optional.
- `APP.Config` sheet stores key-value pairs (case-insensitive key lookup via `getAppConfigValue()`).
- `APP_OPTIONS_SEED` in `Constants.gs` seeds dropdown validations for AppOptions sheet.
- The frontend Masters module auto-routes based on resource `Menu` metadata — no custom pages needed for basic CRUD.
- Price is stored as a **number** in code, not as a string.
- `SKUPrices` column stores JSON: `{ "SKU000001": 299.99, "SKU000002": 149.50 }`.
- Hybrid resolution: if `PriceListLookup = ITEMS`, frontend uses composite save with child rows and ignores `SKUPrices` JSON at read time. If `INLINE`, uses the JSON column.
- Config is tenant-scoped (one value for the entire deployment), not per-price-list.

---

## Pre-Conditions

- [ ] Read `Documents/RESOURCE_COLUMNS_GUIDE.md`.
- [ ] Read `Documents/MASTER_CUSTOMIZATION.md`.
- [ ] Read `GAS/Constants.gs` (full file, 108 lines).
- [ ] Read `GAS/setupMasterSheets.gs` (full file, 168 lines).
- [ ] Read `GAS/syncAppResources.gs` lines 9–313 (master resource definitions including UOMs for manual-code reference pattern).
- [ ] Read `GAS/setupAppSheets.gs` lines 306–348 (Config sheet default keys section).
- [ ] Read `GAS/sheetHelpers.gs` lines 147–201 (Config helpers).
- [ ] Verify `clasp` CLI is available (`cd GAS && clasp --version`).
- [ ] No dependent plan blocks this work.

---

## Steps

### Step 1: Add sheet name constants to `Constants.gs`

- [ ] **1.1** Add `CURRENCIES: 'Currencies'` to `CONFIG.MASTER_SHEETS` object (after `CARRIERS` entry, before closing `}`).
- [ ] **1.2** Add `PRICE_LIST: 'PriceList'` to `CONFIG.MASTER_SHEETS`.
- [ ] **1.3** Add `PRICE_LIST_ITEMS: 'PriceListItems'` to `CONFIG.MASTER_SHEETS`.
- [ ] **1.4** Add `Currency: ['AED', 'INR', 'USD', 'EUR', 'GBP']` seed options to `APP_OPTIONS_SEED` (replace the existing single-value `Currency: ['AED']` entry at line 107).

**Files**: `GAS/Constants.gs`
**Pattern**: Match exact formatting — key-value pairs, trailing commas, indentation of 4 spaces within the object.
**Rule**: Sheet name constants must use UPPER_SNAKE_CASE with underscore separators for compound names (`PRICE_LIST`, `PRICE_LIST_ITEMS`).

---

### Step 2: Add resource definitions to `syncAppResources.gs`

Add three new resource entries into `APP_RESOURCES_CODE_CONFIG` array. Insert them **after** the Carriers entry (line 281) and **before** the UOMs entry (line 282). This keeps all master resources together before the operations section.

- [ ] **2.1** Insert `Currencies` resource definition.

```js
    {
        Name: CONFIG.MASTER_SHEETS.CURRENCIES,
        Scope: 'master',
        IsActive: 'TRUE',
        SheetName: CONFIG.MASTER_SHEETS.CURRENCIES,
        CodePrefix: '',
        CodeSequenceLength: 0,
        LastDataUpdatedAt: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'Code,Name,Symbol',
        UniqueHeaders: 'Code',
        UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Active","Decimals":2,"BaseCurrency":"FALSE","ConversionFactor":1}',
        RecordAccessPolicy: 'ALL',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: '',
        Menu: JSON.stringify([{"group":["Product"],"order":4,"label":"Currencies","icon":"attach_money","route":"/masters/currencies","pageTitle":"Currencies","pageDescription":"Manage currency master records","show":true}]),
        UIFields: JSON.stringify([
            { header: 'Code', label: 'Code', type: 'text', required: true, hint: 'e.g. AED, INR, USD' },
            { header: 'Name', label: 'Name', type: 'text', required: true },
            { header: 'Symbol', label: 'Symbol', type: 'text', required: true },
            { header: 'Subunit', label: 'Subunit', type: 'text', hint: 'e.g. Fils, Paise, Cent' },
            { header: 'Decimals', label: 'Decimals', type: 'number' },
            { header: 'BaseCurrency', label: 'Base Currency', type: 'dropdown', options: ['TRUE', 'FALSE'] },
            { header: 'ConversionFactor', label: 'Conversion Factor', type: 'number' },
            { header: 'Status', label: 'Status', type: 'status', required: true }
        ]),
        IncludeInAuthorizationPayload: 'TRUE',
        Functional: 'FALSE',
        PreAction: '',
        PostAction: '',
        Reports: '',
        CustomUIName: '',
        ListViews: ''
    },
```

- [ ] **2.2** Insert `PriceList` resource definition **after** Currencies.

```js
    {
        Name: CONFIG.MASTER_SHEETS.PRICE_LIST,
        Scope: 'master',
        IsActive: 'TRUE',
        SheetName: CONFIG.MASTER_SHEETS.PRICE_LIST,
        CodePrefix: 'PLC',
        CodeSequenceLength: 5,
        LastDataUpdatedAt: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'Name,Currency,Status',
        UniqueHeaders: 'Name',
        UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Active","IsDefault":"FALSE"}',
        RecordAccessPolicy: 'ALL',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: '',
        Menu: JSON.stringify([{"group":["Product"],"order":5,"label":"Price Lists","icon":"sell","route":"/masters/price-lists","pageTitle":"Price Lists","pageDescription":"Manage product price lists","show":true}]),
        UIFields: JSON.stringify([
            { header: 'Name', label: 'Name', type: 'text', required: true },
            { header: 'Description', label: 'Description', type: 'textarea' },
            { header: 'Currency', label: 'Currency', type: 'text', required: true, hint: 'Currency code e.g. AED' },
            { header: 'IsDefault', label: 'Is Default', type: 'dropdown', options: ['TRUE','FALSE'] },
            { header: 'SKUPrices', label: 'SKU Prices (JSON)', type: 'textarea', hint: '{ "SKUCode": price }' },
            { header: 'Status', label: 'Status', type: 'status', required: true }
        ]),
        IncludeInAuthorizationPayload: 'TRUE',
        Functional: 'FALSE',
        PreAction: '',
        PostAction: '',
        Reports: '',
        CustomUIName: '',
        ListViews: ''
    },
```

- [ ] **2.3** Insert `PriceListItems` resource definition **after** PriceList.

```js
    {
        Name: CONFIG.MASTER_SHEETS.PRICE_LIST_ITEMS,
        Scope: 'master',
        ParentResource: CONFIG.MASTER_SHEETS.PRICE_LIST,
        IsActive: 'TRUE',
        SheetName: CONFIG.MASTER_SHEETS.PRICE_LIST_ITEMS,
        CodePrefix: 'PCI',
        CodeSequenceLength: 6,
        LastDataUpdatedAt: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'PriceListCode,SKUCode,Price,Status',
        UniqueHeaders: '',
        UniqueCompositeHeaders: 'PriceListCode,SKUCode',
        DefaultValues: '{"Status":"Active"}',
        RecordAccessPolicy: 'ALL',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: '',
        Menu: JSON.stringify([]),
        UIFields: JSON.stringify([
            { header: 'PriceListCode', label: 'Price List Code', type: 'text', required: true },
            { header: 'SKUCode', label: 'SKU Code', type: 'text', required: true },
            { header: 'Price', label: 'Price', type: 'number', required: true },
            { header: 'Status', label: 'Status', type: 'status', required: true }
        ]),
        IncludeInAuthorizationPayload: 'TRUE',
        Functional: 'FALSE',
        PreAction: '',
        PostAction: '',
        Reports: '',
        CustomUIName: '',
        ListViews: ''
    },
```

- [ ] **2.4** Modify **OutletOperatingRules** resource definition (lines 186–218). Add `PriceListCode` to:
  - [ ] **2.4a** `RequiredHeaders`: append `,PriceListCode` → `'OutletCode,PriceListCode'`
  - [ ] **2.4b** `UIFields`: insert after `OutletCode` field:
    ```js
    { header: 'PriceListCode', label: 'Price List Code', type: 'text', hint: 'Optional. Falls back to IsDefault price list.' },
    ```

**Files**: `GAS/syncAppResources.gs`
**Pattern**: Copy exact syntax from existing master entries. UOMs (lines 283–313) is the reference for manual-code resources (`CodePrefix: ''`, `CodeSequenceLength: 0`, `RequiredHeaders` includes `Code`). For auto-generated code resources, follow Products/Suppliers pattern. The `group` in Menu JSON should use `"Product"` to nest under the existing Product menu group. `order` values: Currencies=4, PriceList=5.
**Rule**: `UniqueCompositeHeaders: 'PriceListCode,SKUCode'` on PriceListItems ensures no duplicate SKU entries within the same price list.

---

### Step 3: Add sheet schemas to `setupMasterSheets.gs`

Add entries to the `schemaByResource` array. Insert **after** Carriers (`resourceName: CONFIG.MASTER_SHEETS.CARRIERS` ends at line 107) and **before** the closing `]` at line 107.

- [ ] **3.1** Insert Currencies sheet schema.

```js
    {
      resourceName: CONFIG.MASTER_SHEETS.CURRENCIES,
      headers: ['Code', 'Name', 'Symbol', 'Subunit', 'Decimals', 'BaseCurrency', 'ConversionFactor', 'AccessRegion', 'Status'].concat(commonAuditColumns),
      statusDefault: 'Active',
      defaults: { Status: 'Active', Decimals: 2, BaseCurrency: 'FALSE', ConversionFactor: 1 },
      columnWidths: {
        Code: 100, Name: 200, Symbol: 80, Subunit: 100, Decimals: 90, BaseCurrency: 120, ConversionFactor: 150, AccessRegion: 130, Status: 100,
        CreatedAt: 170, UpdatedAt: 170, CreatedBy: 140, UpdatedBy: 140
      }
    },
```

- [ ] **3.2** Insert PriceList sheet schema.

```js
    {
      resourceName: CONFIG.MASTER_SHEETS.PRICE_LIST,
      headers: ['Code', 'Name', 'Description', 'Currency', 'IsDefault', 'SKUPrices', 'AccessRegion', 'Status'].concat(commonAuditColumns),
      statusDefault: 'Active',
      defaults: { Status: 'Active', IsDefault: 'FALSE' },
      columnWidths: {
        Code: 130, Name: 260, Description: 300, Currency: 100, IsDefault: 100, SKUPrices: 400, AccessRegion: 130, Status: 100,
        CreatedAt: 170, UpdatedAt: 170, CreatedBy: 140, UpdatedBy: 140
      }
    },
```

- [ ] **3.3** Insert PriceListItems sheet schema.

```js
    {
      resourceName: CONFIG.MASTER_SHEETS.PRICE_LIST_ITEMS,
      headers: ['Code', 'PriceListCode', 'SKUCode', 'Price', 'Status'].concat(commonAuditColumns),
      statusDefault: 'Active',
      defaults: { Status: 'Active' },
      columnWidths: {
        Code: 140, PriceListCode: 140, SKUCode: 140, Price: 100, Status: 100,
        CreatedAt: 170, UpdatedAt: 170, CreatedBy: 140, UpdatedBy: 140
      }
    },
```

- [ ] **3.4** Modify OutletOperatingRules schema (lines 78–86). Add `PriceListCode` to the `headers` array (after `CreditLimit`, before `AccessRegion`):
  - Change: `'CreditLimit', 'AccessRegion', 'Status'`
  - To: `'CreditLimit', 'PriceListCode', 'AccessRegion', 'Status'`
  - [ ] **3.4a** Add `PriceListCode: 140` to `columnWidths` object.
  - [ ] **3.4b** Update `defaults`: add `PriceListCode: ''` → `{ Status: 'Active', MaxStockValueLimit: 0, VisitFrequencyDays: 14, CreditLimit: 0, PriceListCode: '' }`

**Files**: `GAS/setupMasterSheets.gs`
**Pattern**: Match existing object structure exactly — same property order, same `statusDefault` and `defaults` pattern. The `codeSequenceLength > 0` guard at line 115 handles Currencies correctly since its `codeSequenceLength` is `0`.
**Rule**: `SKUPrices` column in PriceList is for storing JSON string. Width 400 provides readability for the JSON text in spreadsheet view.

---

### Step 4: Add `PriceListLookup` config key to `setupAppSheets.gs`

- [ ] **4.1** In the `defaultKeys` array (line 309–323), add a new entry after the existing keys:
  ```js
  ['PriceListLookup', 'INLINE'],
  ```

**Files**: `GAS/setupAppSheets.gs`
**Pattern**: Follow exact array format: `['KeyName', 'defaultValue']`. The existing loop at lines 328–347 auto-appends missing keys so existing deployments get this key added on next setup run.
**Rule**: Default value is `INLINE` (JSON column mode). Valid values are `INLINE` (use SKUPrices JSON) and `ITEMS` (use PriceListItems child rows). Config is tenant-scoped.

---

### Step 5: Push GAS changes

- [ ] **5.1** Run `npm run gas:push` from repo root (or `cd GAS && clasp push`).
- [ ] **5.2** Confirm push succeeds with no errors in output.
- [ ] **5.3** Confirm the pushed GAS project shows updated files in the Apps Script editor (check through `clasp open` or by noting the new version number).

**Files**: `GAS/*.gs` (all modified GAS files)
**Rule**: GAS push sends code only. Sheet structure changes require manual `setupMasterSheets()` execution.

---

### Step 6: Update documentation

- [ ] **6.1** Update `Documents/RESOURCE_COLUMNS_GUIDE.md`:
  - [ ] **6.1a** Add a section under "Notable Column Dependencies" for the new resources:
    ```
    - `PriceList` stores SKU prices via inline JSON in `SKUPrices` (used when `App.Config.PriceListLookup = INLINE`) or via child `PriceListItems` rows (used when `App.Config.PriceListLookup = ITEMS`). `IsDefault` marks the fallback price list used when `OutletOperatingRules.PriceListCode` is blank.
    - `PriceListItems` is keyed by composite `PriceListCode + SKUCode`; `Price` is a number.
    - `Currencies` uses manual codes (e.g. `AED`, `INR`) via `Code` column; `CodePrefix` and `CodeSequenceLength` are empty/0. `ConversionFactor` stores the current conversion rate (not historical).
    - `OutletOperatingRules.PriceListCode` is optional; resolution falls back to `PriceList` where `IsDefault = TRUE`.
    ```
  - [ ] **6.1b** Update the `OutletConsumptionInvoices` bullet to note that pricing resolution is now possible via PriceList.

- [ ] **6.2** Update `Documents/OPERATION_SHEET_STRUCTURE.md`:
  - [ ] **6.2a** Add `PriceListCode` to the `OutletOperatingRules` column list.
  - [ ] **6.2b** Update the `OutletConsumptionInvoices.PriceListCode` note — remove "Until pricing is designed" caveat now that pricing exists.

- [ ] **6.3** Update `Documents/CONTEXT_HANDOFF.md`:
  - [ ] **6.3a** Add a note: PriceList and Currencies resources added. `App.Config.PriceListLookup` controls inline vs items mode. `OutletOperatingRules.PriceListCode` added for per-outlet assignment.

- [ ] **6.4** Run `runSyncAppResources()` and `setupMasterSheets()` **are manual user actions**. Document these clearly in the "Manual Actions Required" output — the Build Agent does NOT execute these.

**Files**: `Documents/RESOURCE_COLUMNS_GUIDE.md`, `Documents/OPERATION_SHEET_STRUCTURE.md`, `Documents/CONTEXT_HANDOFF.md`

---

### Step 7: Update `PLANS/_TEMPLATE.md`

Add the detailed progress self-check system so future plans inherit it.

- [ ] **7.1** Add a new section `## Execution Self-Check Protocol` after the `## Post-Execution Notes` header (around line 44). The new section should read:

```markdown
## Execution Self-Check Protocol

The Build Agent MUST update this checklist after completing each numbered sub-task (e.g., after 1.1, after 2.4b). Mark `[x]` immediately after the task is done. This is the single source of execution progress.

If execution is interrupted, the next agent reads this plan, finds the first unchecked `[ ]`, and resumes from that exact sub-task.

### Format
- `[ ]` = not started
- `[-]` = in progress (ONLY ONE at a time)
- `[x]` = completed
- `[~]` = skipped (explain in Deviations)
```

**Files**: `PLANS/_TEMPLATE.md`
**Rule**: New section must be inserted inside the "Post-Execution Notes" area so both new and existing plans benefit.

---

## Documentation Updates Required

- [ ] Update `Documents/RESOURCE_COLUMNS_GUIDE.md` — new master resources and `PriceListCode` on `OutletOperatingRules`.
- [ ] Update `Documents/OPERATION_SHEET_STRUCTURE.md` — new sheets and column changes.
- [ ] Update `Documents/CONTEXT_HANDOFF.md` — new resources and config key.
- [ ] Update `PLANS/_TEMPLATE.md` — add Execution Self-Check Protocol section.

---

## Acceptance Criteria

- [ ] `GAS/Constants.gs` — `MASTER_SHEETS` has `CURRENCIES`, `PRICE_LIST`, `PRICE_LIST_ITEMS` entries.
- [ ] `GAS/Constants.gs` — `APP_OPTIONS_SEED.Currency` contains at minimum `['AED', 'INR', 'USD', 'EUR', 'GBP']`.
- [ ] `GAS/syncAppResources.gs` — `APP_RESOURCES_CODE_CONFIG` has Currencies, PriceList, PriceListItems entries in correct master section order.
- [ ] `GAS/syncAppResources.gs` — `OutletOperatingRules.RequiredHeaders` includes `PriceListCode`.
- [ ] `GAS/syncAppResources.gs` — `OutletOperatingRules.UIFields` includes `PriceListCode` field.
- [ ] `GAS/setupMasterSheets.gs` — `schemaByResource` has Currencies, PriceList, PriceListItems schemas with correct headers.
- [ ] `GAS/setupMasterSheets.gs` — `OutletOperatingRules` headers include `PriceListCode` after `CreditLimit`.
- [ ] `GAS/setupAppSheets.gs` — `defaultKeys` includes `['PriceListLookup', 'INLINE']`.
- [ ] `npm run gas:push` succeeds.
- [ ] All four documentation files updated as specified.
- [ ] `PLANS/_TEMPLATE.md` has Execution Self-Check Protocol section.
- [ ] No regression — existing 9 master sheets + all operation sheets unchanged except OutletOperatingRules.
- [ ] Currencies uses manual codes (CodePrefix empty, CodeSequenceLength 0) — matching UOMs pattern.
- [ ] PriceListItems uses composite unique `PriceListCode + SKUCode`.
- [ ] Price is stored as number type in `UIFields` for PriceListItems.

---

## Post-Execution Notes (Build Agent fills this)

*(Status Update Discipline: Ensure you change `Status` to `IN_PROGRESS` or `COMPLETED` and update `Executed By` at the top of the file before finishing.)*
*(Identity Discipline: Always replace `| pending` with the concrete agent/runtime identity used in that session.)*

## Execution Self-Check Protocol

The Build Agent MUST update this checklist after completing each numbered sub-task (e.g., after 1.1, after 2.4b). Mark `[x]` immediately after the task is done. This is the single source of execution progress.

If execution is interrupted, the next agent reads this plan, finds the first unchecked `[ ]`, and resumes from that exact sub-task.

### Format
- `[ ]` = not started
- `[-]` = in progress (ONLY ONE at a time)
- `[x]` = completed
- `[~]` = skipped (explain in Deviations)

### Task Checklist

#### Step 1: Constants.gs
- [x] 1.1 Add `CURRENCIES: 'Currencies'` to MASTER_SHEETS
- [x] 1.2 Add `PRICE_LIST: 'PriceList'` to MASTER_SHEETS
- [x] 1.3 Add `PRICE_LIST_ITEMS: 'PriceListItems'` to MASTER_SHEETS
- [x] 1.4 Update `APP_OPTIONS_SEED.Currency` with expanded list

#### Step 2: syncAppResources.gs
- [x] 2.1 Insert Currencies resource definition
- [x] 2.2 Insert PriceList resource definition
- [x] 2.3 Insert PriceListItems resource definition
- [x] 2.4a Update OutletOperatingRules RequiredHeaders to include PriceListCode
- [x] 2.4b Update OutletOperatingRules UIFields to include PriceListCode field

#### Step 3: setupMasterSheets.gs
- [x] 3.1 Insert Currencies sheet schema
- [x] 3.2 Insert PriceList sheet schema
- [x] 3.3 Insert PriceListItems sheet schema
- [x] 3.4a Add PriceListCode to OutletOperatingRules headers array
- [x] 3.4b Add PriceListCode to columnWidths and defaults

#### Step 4: setupAppSheets.gs
- [x] 4.1 Add `['PriceListLookup', 'INLINE']` to defaultKeys

#### Step 5: GAS Push
- [x] 5.1 Run `npm run gas:push`
- [x] 5.2 Confirm push success
- [~] 5.3 Verify files in Apps Script editor (optional, note version)

#### Step 6: Documentation
- [x] 6.1a Add new resource notes to RESOURCE_COLUMNS_GUIDE.md
- [x] 6.1b Update OutletConsumptionInvoices pricing note
- [x] 6.2a Add PriceListCode to OPERATION_SHEET_STRUCTURE.md
- [x] 6.2b Remove "Until pricing is designed" caveat
- [x] 6.3 Update CONTEXT_HANDOFF.md
- [x] 6.4 Confirm manual user actions are noted

#### Step 7: Template Update
- [x] 7.1 Add Execution Self-Check Protocol to _TEMPLATE.md

### Progress Log
- [x] Step 1 completed
- [x] Step 2 completed
- [x] Step 3 completed
- [x] Step 4 completed
- [x] Step 5 completed
- [x] Step 6 completed
- [x] Step 7 completed

### Deviations / Decisions
- [x] `[~]` Step 5.3 skipped: Apps Script editor verification is optional and not available from this execution context.
- [x] `[!]` Previous execution had duplicated `OutletOperatingRules` schema in `GAS/setupMasterSheets.gs`; duplicate was removed and original schema was updated in place.
- [x] `[!]` `Documents/MODULE_WORKFLOWS.md` still contained the old "until pricing is designed" invoice note; updated for consistency even though not explicitly listed in the original documentation file list.

### Files Actually Changed
- `GAS/Constants.gs`
- `GAS/syncAppResources.gs`
- `GAS/setupMasterSheets.gs`
- `GAS/setupAppSheets.gs`
- `Documents/RESOURCE_COLUMNS_GUIDE.md`
- `Documents/OPERATION_SHEET_STRUCTURE.md`
- `Documents/CONTEXT_HANDOFF.md`
- `Documents/MODULE_WORKFLOWS.md`
- `PLANS/_TEMPLATE.md`
- `PLANS/2026-05-08-pricelist-currencies.md`

### Validation Performed
- [x] `clasp --version` confirmed CLI availability (`3.3.0`).
- [x] Targeted `findstr` checks confirmed core metadata/config/doc markers.
- [x] `npm run gas:push` succeeded and pushed 26 GAS files at 3:19:46 pm.
- [x] Acceptance criteria verified.

### Manual Actions Required
- [ ] User must run `runSyncAppResources()` from the Apps Script editor (or AQL menu) to sync new resource definitions to `APP.Resources` sheet.
- [ ] User must run `setupMasterSheets()` from the Apps Script editor to create/update the `Currencies`, `PriceList`, and `PriceListItems` sheets (and update `OutletOperatingRules` headers) in the master spreadsheet.
- [ ] User should run `setupAppSheets()` to append the `PriceListLookup` config key to the `APP.Config` sheet (only needed if the sheet already existed before this plan).
- [ ] User must redeploy the Web App **only if** the API contract changed (adding new resources does not change the contract).
