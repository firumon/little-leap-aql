# APP.Config Keys Reference

## 1. Overview
The `APP.Config` sheet holds application-wide settings in two simple columns: `Key` and `Value` ([setupAppSheets.gs#L19-L26](file:///f:/LITTLE%20LEAP/AQL/GAS/setupAppSheets.gs#L19-L26)).
Both backend Google Apps Script and frontend Vue read from this sheet.

---

## 2. How Config Works
- **Storage**: Two columns in the `Config` tab: `Key` (column 1) and `Value` (column 2).
- **Backend Cache**: Stored in Google `CacheService` for 6 hours (`CACHE_TTL_SEC = 21600`) ([Constants.gs#L8](file:///f:/LITTLE%20LEAP/AQL/GAS/Constants.gs#L8), [sheetHelpers.gs#L460-L494](file:///f:/LITTLE%20LEAP/AQL/GAS/sheetHelpers.gs#L460-L494)).
- **Frontend Delivery**: Sent to frontend during login inside `data.result.appConfig` ([auth.gs#L248](file:///f:/LITTLE%20LEAP/AQL/GAS/auth.gs#L248)). Stored in `localStorage.appConfig` and Pinia `authStore.appConfigMap` ([auth.js#L42-L71](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/stores/auth.js#L42-L71)).
- **Cache Clearing**: When writing new config values, calling `clearConfigCache()` deletes the cached copy so the next read fetches fresh data ([sheetHelpers.gs#L500-L504](file:///f:/LITTLE%20LEAP/AQL/GAS/sheetHelpers.gs#L500-L504)).

---

## 3. Complete Catalogue of Config Keys

### 3.1 Company & Branding Keys

#### `CompanyName`
- **What it is**: The official brand name of the business or client.
- **Purpose**: Displays the business name in app headers, navigation bars, and PDF reports.
- **Allowed Values**: Plain text string. Example: `"Little Leap Tech"`, `"Acme Trading"`.
- **Default**: `""` (empty string).
- **Defined in**: [setupAppSheets.gs#L261](file:///f:/LITTLE%20LEAP/AQL/GAS/setupAppSheets.gs#L261).

#### `CompanyLogo`
- **What it is**: Image web link to the company brand logo.
- **Purpose**: Displays company logo on the login page, header bar, and report prints.
- **Allowed Values**: Full web link (`https://...`), Drive URL, or relative asset path.
- **Default**: `""` (empty string).
- **Defined in**: [setupAppSheets.gs#L262](file:///f:/LITTLE%20LEAP/AQL/GAS/setupAppSheets.gs#L262).

#### `ContactEmail`
- **What it is**: Support or business contact email.
- **Purpose**: Shows in document footers, help dialogs, and error messages.
- **Allowed Values**: Valid email address string. Example: `"support@littleleap.com"`.
- **Default**: `""` (empty string).
- **Defined in**: [setupAppSheets.gs#L263](file:///f:/LITTLE%20LEAP/AQL/GAS/setupAppSheets.gs#L263).

#### `ContactPhone`
- **What it is**: Support or business telephone number.
- **Purpose**: Shows on invoice headers, receipts, and contact sections.
- **Allowed Values**: Phone number text string. Example: `"+971 4 123 4567"`.
- **Default**: `""` (empty string).
- **Defined in**: [setupAppSheets.gs#L264](file:///f:/LITTLE%20LEAP/AQL/GAS/setupAppSheets.gs#L264).

#### `ColorPrimary`
- **What it is**: Main brand theme color.
- **Purpose**: Colors table headers, navigation bars, and primary buttons.
- **Allowed Values**: 6-digit hex color code. Example: `"#4a86c8"`, `"#1976D2"`.
- **Default**: `""` (falls back to `#4a86c8` in [Constants.gs#L20](file:///f:/LITTLE%20LEAP/AQL/GAS/Constants.gs#L20)).
- **Defined in**: [setupAppSheets.gs#L265](file:///f:/LITTLE%20LEAP/AQL/GAS/setupAppSheets.gs#L265).

#### `ColorSecondary`
- **What it is**: Secondary accent theme color.
- **Purpose**: Colors badges, highlights, and secondary chips.
- **Allowed Values**: 6-digit hex color code. Example: `"#26A69A"`, `"#d4a843"`.
- **Default**: `""`.
- **Defined in**: [setupAppSheets.gs#L266](file:///f:/LITTLE%20LEAP/AQL/GAS/setupAppSheets.gs#L266).

---

### 3.2 Drive File IDs (Multi-Spreadsheet Storage)

AQL splits large data domains across multiple Google Drive spreadsheets to prevent single-file row and cell limits ([sheetHelpers.gs#L528-L548](file:///f:/LITTLE%20LEAP/AQL/GAS/sheetHelpers.gs#L528-L548)).

#### `MasterFileID`
- **What it is**: Google Drive spreadsheet ID for Master resources (Products, SKUs, Outlets, Warehouses, Taxes, etc.).
- **Purpose**: Routes master data operations to the dedicated Master spreadsheet.
- **Allowed Values**: Google Drive file ID string (44 characters). Example: `"1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1uV2wX3yZ4"`.
- **Fallback**: Active APP spreadsheet ID if left empty ([sheetHelpers.gs#L547](file:///f:/LITTLE%20LEAP/AQL/GAS/sheetHelpers.gs#L547)).
- **Defined in**: [setupAppSheets.gs#L267](file:///f:/LITTLE%20LEAP/AQL/GAS/setupAppSheets.gs#L267).

#### `OperationFileID`
- **What it is**: Google Drive spreadsheet ID for Operation resources (PurchaseOrders, Restocks, OutletConsumptions, StockMovements).
- **Purpose**: Routes high-volume daily transactional sheets to the Operation spreadsheet.
- **Allowed Values**: Google Drive file ID string.
- **Fallback**: Checks legacy key `OperationsFileID`, then active APP spreadsheet ID ([sheetHelpers.gs#L541-L547](file:///f:/LITTLE%20LEAP/AQL/GAS/sheetHelpers.gs#L541-L547)).
- **Defined in**: [setupAppSheets.gs#L268](file:///f:/LITTLE%20LEAP/AQL/GAS/setupAppSheets.gs#L268).

#### `AccountsFileID`
- **What it is**: Google Drive spreadsheet ID for financial and accounting resources (Invoices, Payments, Ledgers).
- **Purpose**: Routes accounting records to the Accounts spreadsheet.
- **Allowed Values**: Google Drive file ID string.
- **Fallback**: Active APP spreadsheet ID.
- **Defined in**: [setupAppSheets.gs#L270](file:///f:/LITTLE%20LEAP/AQL/GAS/setupAppSheets.gs#L270).

#### `ReportFileID` (and alias `ReportsFileID`)
- **What it is**: Google Drive spreadsheet ID for Report templates and outputs.
- **Purpose**: Stores custom report layouts and generated reports.
- **Allowed Values**: Google Drive file ID string.
- **Fallback**: Active APP spreadsheet ID.
- **Defined in**: [setupAppSheets.gs#L269](file:///f:/LITTLE%20LEAP/AQL/GAS/setupAppSheets.gs#L269).

#### `ViewsFileID`
- **What it is**: Google Drive spreadsheet ID for read-only analytical views and queries.
- **Purpose**: Isolates query-heavy calculation sheets from transactional data sheets.
- **Allowed Values**: Google Drive file ID string.
- **Fallback**: Active APP spreadsheet ID.
- **Defined in**: [setupAppSheets.gs#L271](file:///f:/LITTLE%20LEAP/AQL/GAS/setupAppSheets.gs#L271).

---

### 3.3 Scope & System Operation Keys

#### `Scopes`
- **What it is**: Comma-separated list of recognized resource scopes.
- **Purpose**: Validates resource definitions in `APP.Resources` and controls file resolution.
- **Allowed Values**: Comma-separated scope names in lowercase. Example: `"master,operation,accounts,report,view"`.
- **Default**: `"master,operation,accounts,report,view"` ([sheetHelpers.gs#L520](file:///f:/LITTLE%20LEAP/AQL/GAS/sheetHelpers.gs#L520)).
- **Used by**: `getConfiguredScopes()` ([sheetHelpers.gs#L518](file:///f:/LITTLE%20LEAP/AQL/GAS/sheetHelpers.gs#L518)).

#### `Currency`
- **What it is**: Default base currency code for the tenant.
- **Purpose**: Formats monetary values, invoice totals, and prices.
- **Allowed Values**: 3-letter ISO currency code. Example: `"AED"`, `"USD"`, `"INR"`, `"EUR"`, `"SAR"`.
- **Default**: `"AED"` ([setupAppSheets.gs#L277](file:///f:/LITTLE%20LEAP/AQL/GAS/setupAppSheets.gs#L277)).

#### `PriceListLookup`
- **What it is**: Strategy used to look up product prices from price lists.
- **Purpose**: Decides whether prices come from inline JSON in `PriceList` or child rows in `PriceListItems`.
- **Allowed Values**:
  - `"INLINE"`: Prices are read directly from inline JSON in the `SKUPrices` column. Fast single-row read.
  - `"ITEMS"`: Prices are looked up from child rows in the `PriceListItems` table.
- **Default**: `"INLINE"` ([setupAppSheets.gs#L276](file:///f:/LITTLE%20LEAP/AQL/GAS/setupAppSheets.gs#L276), [SCHEMA_RESOURCE_COLUMNS.md#L52](file:///f:/LITTLE%20LEAP/AQL/Documents/SCHEMA_RESOURCE_COLUMNS.md#L52)).

#### `File`
- **What it is**: Configuration for cloud file storage and attachment uploads.
- **Purpose**: Connects file uploads in forms to cloud object storage.
- **Allowed Values**: Stringified JSON object with provider settings:
  ```json
  {"provider":"php","url":"","bucketName":"","region":"","token":"","apiKey":"","params":{}}
  ```
- **Default**: Empty template JSON ([setupAppSheets.gs#L278](file:///f:/LITTLE%20LEAP/AQL/GAS/setupAppSheets.gs#L278)).
- **Used by**: `FRONTENT/src/services/StorageService.js` ([StorageService.js#L34](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/services/StorageService.js#L34)).

---

### 3.4 Sync & Polling Keys

#### `MasterSyncTTL`
- **What it is**: Cache time-to-live in seconds for Master-scope resources.
- **Purpose**: Controls how often the frontend checks for updates on Master tables (rarely changing data).
- **Allowed Values**: Positive integer in seconds as text. Example: `"900"` (15 minutes), `"1800"` (30 minutes).
- **Default**: `"900"` ([setupAppSheets.gs#L273](file:///f:/LITTLE%20LEAP/AQL/GAS/setupAppSheets.gs#L273), [ResourceIoService.js#L85](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/services/ResourceIoService.js#L85)).

#### `OperationsSyncTTL`
- **What it is**: Cache time-to-live in seconds for Operation-scope resources.
- **Purpose**: Controls how often the frontend re-syncs active daily transactions.
- **Allowed Values**: Positive integer in seconds as text. Example: `"300"` (5 minutes), `"600"` (10 minutes).
- **Default**: `"300"` ([setupAppSheets.gs#L275](file:///f:/LITTLE%20LEAP/AQL/GAS/setupAppSheets.gs#L275), [ResourceIoService.js#L85](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/services/ResourceIoService.js#L85)).

#### `AccountsSyncTTL`
- **What it is**: Cache time-to-live in seconds for Accounts-scope resources.
- **Purpose**: Controls re-sync intervals for invoices, payments, and financial rows.
- **Allowed Values**: Positive integer in seconds as text. Example: `"60"` (1 minute), `"120"` (2 minutes).
- **Default**: `"60"` ([setupAppSheets.gs#L274](file:///f:/LITTLE%20LEAP/AQL/GAS/setupAppSheets.gs#L274), [ResourceIoService.js#L85](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/services/ResourceIoService.js#L85)).

---

### 3.5 Archive System Keys

#### `archiveBatchLimit`
- **What it is**: Maximum number of records archived in one run.
- **Purpose**: Limits execution batch size to keep GAS processing within script time limits and avoid sheet slowdowns.
- **Allowed Values**: Positive integer. Example: `10`, `30`, `50`, `100`.
- **Default**: `30` ([archive.js#L37](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/stores/archive.js#L37), [FEATURE_ARCHIVE_SYSTEM.md#L82](file:///f:/LITTLE%20LEAP/AQL/Documents/FEATURE_ARCHIVE_SYSTEM.md#L82)).
- **Used by**: `FRONTENT/src/stores/archive.js` and `GAS/archiveEngine.gs` when a resource's archive policy does not set its own custom limit.

---

## 4. Summary Table

| Key | Example / Default | Category | Purpose |
|---|---|---|---|
| `CompanyName` | `"Little Leap Tech"` | Branding | Business name on app and reports |
| `CompanyLogo` | `"https://..."` | Branding | Company logo image web link |
| `ContactEmail` | `"info@example.com"` | Branding | Support and contact email |
| `ContactPhone` | `"+971 4 123 4567"` | Branding | Support phone number |
| `ColorPrimary` | `"#4a86c8"` | Branding | Primary theme color for headers and buttons |
| `ColorSecondary` | `"#26A69A"` | Branding | Accent color for badges and highlights |
| `MasterFileID` | Google Drive File ID | File ID | Spreadsheet ID for Master data |
| `OperationFileID`| Google Drive File ID | File ID | Spreadsheet ID for Operation data |
| `AccountsFileID` | Google Drive File ID | File ID | Spreadsheet ID for Accounts data |
| `ReportFileID` | Google Drive File ID | File ID | Spreadsheet ID for Report data |
| `ViewsFileID` | Google Drive File ID | File ID | Spreadsheet ID for Views data |
| `Scopes` | `"master,operation,accounts,report,view"` | System | List of recognized data scopes |
| `Currency` | `"AED"` | Finance | Default base currency code |
| `PriceListLookup`| `"INLINE"` | Pricing | Price list mode (`"INLINE"` or `"ITEMS"`) |
| `File` | `{"provider":"php",...}` | Storage | Cloud storage provider and API keys |
| `MasterSyncTTL` | `"900"` | Sync | Master data cache seconds |
| `OperationsSyncTTL`| `"300"` | Sync | Operation data cache seconds |
| `AccountsSyncTTL`| `"60"` | Sync | Accounts data cache seconds |
| `archiveBatchLimit` | `30` | Archive | Max records moved per archive run |
