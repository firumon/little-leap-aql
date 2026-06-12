# PLAN: Database Schema Alteration, Invoicing Taxation, and Return Prices
**Status**: COMPLETED
**Created**: 2026-06-12
**Created By**: Brain Agent (Antigravity)
**Executed By**: Build Agent (Antigravity)

## Objective
Update the AQL system schema and logic to support:
1. `Barcode` column in SKUs.
2. `TaxRegistrationNumber` and `TaxRegistrationName` columns in Outlets, Suppliers, and Warehouses.
3. Comprehensive taxation details in Consumption Invoices (TotalTaxableAmount, TotalTaxAmount, and TaxDetails breakdown JSON) and consumption invoice line items (Total, Discount, TaxableAmount, TaxAmount, TaxCode).
4. `Price` column in OutletReturns, allowing the return price to be stored and summed up in Consumption Invoices under `ReturnDeductionTotal`.

## Context
These changes span database sheets creation schemas in Apps Script (`setupMasterSheets.gs`, `setupOperationSheets.gs`), resource registry metadata (`syncAppResources.gs`), and the frontend sales/outlet consumption operations modules (`outletConsumptionPayload.js`, `outletConsumptionPricing.js`, `useOutletConsumption.js`, `useOutletReturns.js`, `AddPage.vue`, `ViewPage.vue`).

## Pre-Conditions
- [x] Required access/credentials are available.
- [x] Required source docs were reviewed.
- [x] Any dependent plan/task is completed.

---

## Steps

### Step 1: Apps Script Schema Modifications (Setup Sheets)
Update the sheet header setups, column widths, and defaults configurations to physicalize the columns in Google Sheets.

#### [MODIFY] [setupMasterSheets.gs](file:///F:/LITTLE%20LEAP/AQL/GAS/setupMasterSheets.gs)
Find lines 30-38 (CONFIG.MASTER_SHEETS.SKUS) and replace with:
```javascript
    {
      resourceName: CONFIG.MASTER_SHEETS.SKUS,
      headers: ['Code', 'ProductCode', 'Variant1', 'Variant2', 'Variant3', 'Variant4', 'Variant5', 'UOM', 'TaxCode', 'Barcode', 'Status'].concat(commonAuditColumns),
      statusDefault: 'Active',
      defaults: { Status: 'Active', Barcode: '' },
      columnWidths: {
        Code: 140, ProductCode: 140, Variant1: 150, Variant2: 150, Variant3: 150, Variant4: 150, Variant5: 150, UOM: 100, TaxCode: 130, Barcode: 140, Status: 100,
        CreatedAt: 170, UpdatedAt: 170, CreatedBy: 140, UpdatedBy: 140
      }
    },
```

Find lines 80-88 (CONFIG.MASTER_SHEETS.SUPPLIERS) and replace with:
```javascript
    {
      resourceName: CONFIG.MASTER_SHEETS.SUPPLIERS,
      headers: ['Code', 'Name', 'Country', 'Province', 'City', 'CommunicationAddress', 'ContactPerson', 'Phone', 'Email', 'TaxRegistrationNumber', 'TaxRegistrationName', 'AccessRegion', 'Status'].concat(commonAuditColumns),
      statusDefault: 'Active',
      defaults: { Status: 'Active', TaxRegistrationNumber: '', TaxRegistrationName: '' },
      columnWidths: {
        Code: 130, Name: 220, Country: 150, Province: 150, City: 150, CommunicationAddress: 260, ContactPerson: 180, Phone: 140, Email: 220, TaxRegistrationNumber: 180, TaxRegistrationName: 200, AccessRegion: 130, Status: 100,
        CreatedAt: 170, UpdatedAt: 170, CreatedBy: 140, UpdatedBy: 140
      }
    },
```

Find lines 89-98 (CONFIG.MASTER_SHEETS.WAREHOUSES) and replace with:
```javascript
    {
      resourceName: CONFIG.MASTER_SHEETS.WAREHOUSES,
      headers: ['Code', 'Name', 'Area', 'City', 'Province' ,'Country', 'Type', 'Licence', 'TaxRegistrationNumber', 'TaxRegistrationName', 'AccessRegion', 'Status'].concat(commonAuditColumns),
      statusDefault: 'Active',
      defaults: { Status: 'Active', Country: 'UAE', Type: 'Main', TaxRegistrationNumber: '', TaxRegistrationName: '' },
      columnWidths: {
        Code: 130, Name: 220, Province: 150, Area: 150, City: 150, Country: 130, Type: 120, Licence: 150, TaxRegistrationNumber: 180, TaxRegistrationName: 200, AccessRegion: 130, Status: 100,
        CreatedAt: 170, UpdatedAt: 170, CreatedBy: 140, UpdatedBy: 140
      }
    },
```

Find lines 99-110 (CONFIG.MASTER_SHEETS.OUTLETS) and replace with:
```javascript
    {
      resourceName: CONFIG.MASTER_SHEETS.OUTLETS,
      headers: ['Code', 'Name', 'ContactPerson', 'Phone', 'Email', 'Country', 'Province', 'City', 'Area', 'CommunicationAddress', 'MapLocationLink', 'Picture', 'Picture2', 'Picture3', 'Licence', 'TaxRegistrationNumber', 'TaxRegistrationName', 'AccessRegion', 'Status'].concat(commonAuditColumns),
      statusDefault: 'Active',
      defaults: { Status: 'Active', Country: 'UAE', TaxRegistrationNumber: '', TaxRegistrationName: '' },
      columnWidths: {
        Code: 130, Name: 240, ContactPerson: 180, Phone: 140, Email: 220,
        Country: 120, Province: 150, Area: 150, City: 140, CommunicationAddress: 260,
        MapLocationLink: 180, Picture: 150, Picture2: 150, Picture3: 150, Licence: 150,
        TaxRegistrationNumber: 180, TaxRegistrationName: 200,
        AccessRegion: 130, Status: 100, CreatedAt: 170, UpdatedAt: 170, CreatedBy: 140, UpdatedBy: 140
      }
    },
```

#### [MODIFY] [setupOperationSheets.gs](file:///F:/LITTLE%20LEAP/AQL/GAS/setupOperationSheets.gs)
Find lines 265-291 (CONFIG.OPERATION_SHEETS.OUTLET_RETURNS) and replace with:
```javascript
        {
            resourceName: CONFIG.OPERATION_SHEETS.OUTLET_RETURNS,
            headers: [
                'Code', 'OutletCode', 'Date', 'Username', 'SKU', 'Qty', 'Price', 'Reason', 'ReasonComment',
                'InvoiceAdjustmentRequired', 'InvoiceAdjustmentDone', 'ConsumptionInvoiceCode',
                'WarehouseActionRequired', 'WarehouseActionCompleted', 'WarehouseCode',
                'WarehouseAction', 'WarehouseActionDisposedReason',
                'WarehouseActionDisposedAt', 'WarehouseActionDisposedBy',
                'WarehouseActionStockedAt', 'WarehouseActionStockedBy',
                'Progress', 'Status', 'AccessRegion'
            ].concat(commonAuditColumns),
            statusDefault: 'Active',
            defaults: { Status: 'Active', Qty: 0, Price: 0, Progress: 'SUBMITTED', InvoiceAdjustmentRequired: 'FALSE', InvoiceAdjustmentDone: 'FALSE', WarehouseActionRequired: 'FALSE', WarehouseActionCompleted: 'FALSE', WarehouseAction: '', WarehouseActionDisposedReason: '', ConsumptionInvoiceCode: '' },
            progressValidation: APP_OPTIONS_SEED.OutletReturnProgress,
            reasonValidation: APP_OPTIONS_SEED.OutletReturnReason,
            warehouseActionValidation: APP_OPTIONS_SEED.OutletReturnWarehouseAction,
            columnWidths: {
                Code: 150, OutletCode: 140, Date: 130, Username: 170, SKU: 150, Qty: 100, Price: 120,
                Reason: 140, ReasonComment: 200,
                InvoiceAdjustmentRequired: 160, InvoiceAdjustmentDone: 150, ConsumptionInvoiceCode: 200,
                WarehouseActionRequired: 160, WarehouseActionCompleted: 150,
                WarehouseCode: 140, WarehouseAction: 150, WarehouseActionDisposedReason: 200,
                WarehouseActionDisposedAt: 160, WarehouseActionDisposedBy: 150,
                WarehouseActionStockedAt: 160, WarehouseActionStockedBy: 150,
                Progress: 140, Status: 100, AccessRegion: 130
            }
        },
```

Find lines 308-324 (CONFIG.OPERATION_SHEETS.OUTLET_CONSUMPTION_INVOICES and OUTLET_CONSUMPTION_INVOICE_ITEMS) and replace with:
```javascript
        {
            resourceName: CONFIG.OPERATION_SHEETS.OUTLET_CONSUMPTION_INVOICES,
            headers: ['Code', 'OutletConsumptionCode', 'Date', 'OutletCode', 'Username', 'PriceListCode', 'Subtotal', 'Discount', 'TotalTaxableAmount', 'TotalTaxAmount', 'TaxDetails', 'OutletReturnCodes', 'ReturnDeductionTotal', 'Progress',
                'ProgressPendingPaymentAt', 'ProgressPendingPaymentBy', 'ProgressPendingPaymentComment',
                'ProgressPartiallyPaidAt', 'ProgressPartiallyPaidBy', 'ProgressPartiallyPaidComment',
                'ProgressPaidAt', 'ProgressPaidBy', 'ProgressPaidComment',
                'ProgressCancelledAt', 'ProgressCancelledBy', 'ProgressCancelledComment',
                'Status', 'AccessRegion'].concat(commonAuditColumns),
            statusDefault: 'Active', defaults: { Status: 'Active', Subtotal: 0, Discount: 0, TotalTaxableAmount: 0, TotalTaxAmount: 0, TaxDetails: '[]', OutletReturnCodes: '', ReturnDeductionTotal: 0, Progress: 'PENDING_PAYMENT' }, progressValidation: APP_OPTIONS_SEED.OutletConsumptionInvoiceProgress,
            columnWidths: { Code: 150, OutletConsumptionCode: 200, Date: 140, OutletCode: 140, Username: 170, PriceListCode: 170, Subtotal: 120, Discount: 120, TotalTaxableAmount: 150, TotalTaxAmount: 120, TaxDetails: 250, OutletReturnCodes: 180, ReturnDeductionTotal: 150, Progress: 170, ProgressPendingPaymentAt: 180, ProgressPendingPaymentBy: 180, ProgressPendingPaymentComment: 230, ProgressPartiallyPaidAt: 180, ProgressPartiallyPaidBy: 180, ProgressPartiallyPaidComment: 230, ProgressPaidAt: 160, ProgressPaidBy: 160, ProgressPaidComment: 210, ProgressCancelledAt: 170, ProgressCancelledBy: 170, ProgressCancelledComment: 220, Status: 100, AccessRegion: 130 }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.OUTLET_CONSUMPTION_INVOICE_ITEMS,
            headers: ['Code', 'OutletConsumptionInvoiceCode', 'SKU', 'Qty', 'Price', 'Total', 'Discount', 'TaxableAmount', 'TaxAmount', 'TaxCode', 'Status'].concat(commonAuditColumns),
            statusDefault: 'Active', defaults: { Status: 'Active', Qty: 0, Price: 0, Total: 0, Discount: 0, TaxableAmount: 0, TaxAmount: 0, TaxCode: '' },
            columnWidths: { Code: 150, OutletConsumptionInvoiceCode: 220, SKU: 150, Qty: 120, Price: 120, Total: 120, Discount: 120, TaxableAmount: 140, TaxAmount: 120, TaxCode: 130, Status: 100 }
        },
```

---

### Step 2: Apps Script Resources Config Modifications (Sync App Resources Config)
Update target resource configurations in `syncAppResources.gs` so the metadata aligns with the setup schemas and UI form engines.

#### [MODIFY] [syncAppResources.gs](file:///F:/LITTLE%20LEAP/AQL/GAS/syncAppResources.gs)
Find lines 58-73 (CONFIG.MASTER_SHEETS.SKUS UIFields / defaults) and replace with:
```javascript
        DefaultValues: '{"Status":"Active","Barcode":""}',
        RecordAccessPolicy: 'ALL',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: '',
        Menu: JSON.stringify([{"group":["Product"],"order":2,"label":"SKUs","icon":"style","route":"/masters/skus","pageTitle":"SKUs","pageDescription":"Manage sellable SKUs (child variants of a product)","show":true}]),
        UIFields: JSON.stringify([
            { header: 'ProductCode', label: 'Product Code', type: 'text', required: true },
            { header: 'Variant1', label: 'Variant 1', type: 'text' },
            { header: 'Variant2', label: 'Variant 2', type: 'text' },
            { header: 'Variant3', label: 'Variant 3', type: 'text' },
            { header: 'Variant4', label: 'Variant 4', type: 'text' },
            { header: 'Variant5', label: 'Variant 5', type: 'text' },
            { header: 'UOM', label: 'Unit of Measure', type: 'text', required: true },
            { header: 'TaxCode', label: 'Tax Code', type: 'text' },
            { header: 'Barcode', label: 'Barcode', type: 'text' },
            { header: 'Status', label: 'Status', type: 'status', required: true }
        ]),
```

Find lines 229-244 (CONFIG.MASTER_SHEETS.SUPPLIERS UIFields / defaults) and replace with:
```javascript
        DefaultValues: '{"Status":"Active","TaxRegistrationNumber":"","TaxRegistrationName":""}',
        RecordAccessPolicy: 'ALL',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: '',
        Menu: JSON.stringify([{"group":["Procurement"],"order":1,"label":"Suppliers","icon":"business","route":"/masters/suppliers","pageTitle":"Suppliers","pageDescription":"Manage supplier master records","show":true}]),
        UIFields: JSON.stringify([
            { header: 'Name', label: 'Name', type: 'text', required: true },
            { header: 'Country', label: 'Country', type: 'text' },
            { header: 'Province', label: 'Province', type: 'text' },
            { header: 'City', label: 'City', type: 'text' },
            { header: 'CommunicationAddress', label: 'Communication Address', type: 'textarea' },
            { header: 'ContactPerson', label: 'Contact Person', type: 'text' },
            { header: 'Phone', label: 'Phone', type: 'text' },
            { header: 'Email', label: 'Email', type: 'text' },
            { header: 'TaxRegistrationNumber', label: 'Tax Registration Number', type: 'text' },
            { header: 'TaxRegistrationName', label: 'Tax Registration Name', type: 'text' },
            { header: 'Status', label: 'Status', type: 'status', required: true }
        ]),
```

Find lines 265-284 (CONFIG.MASTER_SHEETS.WAREHOUSES UIFields / defaults) and replace with:
```javascript
        DefaultValues: '{"Status":"Active","Country":"UAE","Type":"Main","TaxRegistrationNumber":"","TaxRegistrationName":""}',
        RecordAccessPolicy: 'ALL',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: JSON.stringify([
            {"action":"ViewStock","label":"View Stock","icon":"inventory","color":"primary","kind":"navigate","confirm":false,"navigate":{"target":"record-page","pageSlug":"stock"}}
        ]),
        Menu: JSON.stringify([
            {"group":["Warehouse"],"order":1,"label":"Manage","icon":"warehouse","route":"/masters/warehouses","pageTitle":"Warehouses","pageDescription":"Manage warehouse master records","show":true},
            {"group":["Warehouse"],"order":2,"label":"Stock List","icon":"inventory_2","route":"/masters/warehouses/stock-list","pageTitle":"Warehouse Stock List","pageDescription":"Select a warehouse and view current stock","show":true}
        ]),
        UIFields: JSON.stringify([
            { header: 'Name', label: 'Name', type: 'text', required: true },
            { header: 'Country', label: 'Country', type: 'text' },
            { header: 'Province', label: 'Province', type: 'text' },
            { header: 'City', label: 'City', type: 'text' },
            { header: 'Area', label: 'Area', type: 'text' },
            { header: 'Type', label: 'Type', type: 'text' },
            { header: 'Licence', label: 'Licence', type: 'file' },
            { header: 'TaxRegistrationNumber', label: 'Tax Registration Number', type: 'text' },
            { header: 'TaxRegistrationName', label: 'Tax Registration Name', type: 'text' },
            { header: 'Status', label: 'Status', type: 'status', required: true }
        ]),
```

Find lines 305-329 (CONFIG.MASTER_SHEETS.OUTLETS UIFields / defaults) and replace with:
```javascript
        DefaultValues: '{"Status":"Active","Country":"UAE","TaxRegistrationNumber":"","TaxRegistrationName":""}',
        RecordAccessPolicy: 'ALL',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: '',
        Menu: JSON.stringify([
            {"group":["Outlet Operations"],"order":1,"label":"Outlets","icon":"storefront","route":"/masters/outlets","pageTitle":"Outlets","pageDescription":"Manage outlet master records","show":true},
            {"group":["Field Sales"],"order":1,"label":"Outlet Hub","icon":"hub","route":"/masters/outlets/operations-hub","pageTitle":"Outlet Hub","pageDescription":"Outlet-centric view of visits, restocks, returns, invoices, and payments","show":true}
        ]),
        UIFields: JSON.stringify([
            { header: 'Name', label: 'Name', type: 'text', required: true },
            { header: 'ContactPerson', label: 'Contact Person', type: 'text' },
            { header: 'Phone', label: 'Phone', type: 'text' },
            { header: 'Email', label: 'Email', type: 'text' },
            { header: 'Country', label: 'Country', type: 'text' },
            { header: 'Province', label: 'Province', type: 'text' },
            { header: 'Area', label: 'Area', type: 'text' },
            { header: 'City', label: 'City', type: 'text' },
            { header: 'CommunicationAddress', label: 'Communication Address', type: 'textarea' },
            { header: 'MapLocationLink', label: 'Map Location Link', type: 'text' },
            { header: 'Picture', label: 'Picture', type: 'file', accept: 'image/*' },
            { header: 'Picture2', label: 'Picture 2', type: 'file', accept: 'image/*' },
            { header: 'Picture3', label: 'Picture 3', type: 'file', accept: 'image/*' },
            { header: 'Licence', label: 'Licence', type: 'file' },
            { header: 'TaxRegistrationNumber', label: 'Tax Registration Number', type: 'text' },
            { header: 'TaxRegistrationName', label: 'Tax Registration Name', type: 'text' },
            { header: 'Status', label: 'Status', type: 'status', required: true }
        ]),
```

Find line 916 (CONFIG.OPERATION_SHEETS.OUTLET_RETURNS DefaultValues) and replace with:
```javascript
        DefaultValues: '{"Status":"Active","Qty":0,"Price":0,"Progress":"SUBMITTED","InvoiceAdjustmentRequired":false,"InvoiceAdjustmentDone":false,"WarehouseActionRequired":false,"WarehouseActionCompleted":false,"WarehouseAction":"","WarehouseActionDisposedReason":""}',
```

Find line 944 (CONFIG.OPERATION_SHEETS.OUTLET_CONSUMPTION_INVOICES DefaultValues) and replace with:
```javascript
        DefaultValues: '{"Status":"Active","Subtotal":0,"Discount":0,"TotalTaxableAmount":0,"TotalTaxAmount":0,"TaxDetails":"[]","Progress":"PENDING_PAYMENT"}',
```

Find line 955 (CONFIG.OPERATION_SHEETS.OUTLET_CONSUMPTION_INVOICE_ITEMS DefaultValues) and replace with:
```javascript
        DefaultValues: '{"Status":"Active","Qty":0,"Price":0,"Total":0,"Discount":0,"TaxableAmount":0,"TaxAmount":0,"TaxCode":""}',
```

---

### Step 3: Frontend Invoices and Returns Payload Helpers (Payload JS)
Update the save request builders in the frontend to compile all calculated item taxation and invoice-level fields properly.

#### [MODIFY] [outletConsumptionPayload.js](file:///F:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/operations/outlets/outletConsumptionPayload.js)
Replace lines 46-72 with the following snippet:
```javascript
export function buildConsumptionInvoiceRequest(consumptionCode, form = {}, { priceListCode = '', subtotal = 0, discount = 0, totalTaxableAmount = 0, totalTaxAmount = 0, taxDetails = '[]', returnDeductionTotal = 0, outletReturnCodes = '' } = {}) {
  return resourceCreateRequest('OutletConsumptionInvoices', {
    OutletConsumptionCode: textOrRef(consumptionCode),
    Date: text(form.Date) || todayISO(),
    OutletCode: text(form.OutletCode),
    Username: text(form.Username),
    PriceListCode: text(priceListCode),
    Subtotal: toNumber(subtotal),
    Discount: toNumber(discount),
    TotalTaxableAmount: toNumber(totalTaxableAmount),
    TotalTaxAmount: toNumber(totalTaxAmount),
    TaxDetails: text(taxDetails),
    ReturnDeductionTotal: toNumber(returnDeductionTotal),
    OutletReturnCodes: text(outletReturnCodes),
    Progress: 'PENDING_PAYMENT',
    ProgressPendingPaymentComment: text(form.InvoiceComment) || 'Invoice generated from outlet consumption.',
    Status: 'Active'
  })
}

export function buildConsumptionInvoiceItemsRequest(invoiceCodeOrRef, items = []) {
  return resourceBulkRequest('OutletConsumptionInvoiceItems', items.map((row) => ({
    OutletConsumptionInvoiceCode: textOrRef(invoiceCodeOrRef),
    SKU: text(row.SKU),
    Qty: toNumber(row.Qty),
    Price: toNumber(row.Price),
    Total: toNumber(row.Total),
    Discount: toNumber(row.Discount),
    TaxableAmount: toNumber(row.TaxableAmount),
    TaxAmount: toNumber(row.TaxAmount),
    TaxCode: text(row.TaxCode),
    Status: 'Active'
  })))
}
```

---

### Step 4: Frontend Invoices Pricing Logic
Update the net total invoice computation.

#### [MODIFY] [outletConsumptionPricing.js](file:///F:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/operations/outlets/outletConsumptionPricing.js)
Replace lines 96-98 with:
```javascript
export function getInvoiceTotal(inv = {}) {
  return toNumber(inv?.Subtotal) - toNumber(inv?.Discount) + toNumber(inv?.TotalTaxAmount) - toNumber(inv?.ReturnDeductionTotal)
}
```

---

### Step 5: Frontend Returns Logic (useOutletReturns JS)
Ensure `Price` is resolved and saved when creating a return. We need to fetch `PriceList`, `PriceListItems`, and `OutletOperatingRules` first.

#### [MODIFY] [useOutletReturns.js](file:///F:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/operations/outlets/useOutletReturns.js)
Add imports at the top of the file (after line 11):
```javascript
import { resolvePriceListCode, resolvePriceListLookup, resolveSkuPrice } from './outletConsumptionPricing.js'
```

Add these resource data definitions around line 35:
```javascript
  const priceLists = useResourceData(ref('PriceList'))
  const priceListItems = useResourceData(ref('PriceListItems'))
  const rules = useResourceData(ref('OutletOperatingRules'))
```

Replace lines 145-161 with the following snippet to load additional resources on reload:
```javascript
  async function reload(forceSync = false) {
    loading.value = true
    try {
      await resourceIoStore.fetchResources(['OutletReturns', 'Outlets', 'SKUs', 'Products', 'Warehouses', 'WarehouseStorages', 'PriceList', 'PriceListItems', 'OutletOperatingRules'], { forceSync })
      if (!form.value.OutletCode && outletOptions.value[0]) {
        form.value.OutletCode = outletOptions.value[0].value
      }
      if (!form.value.SKU && skuOptions.value[0]) {
        form.value.SKU = skuOptions.value[0].value
      }
      if (!form.value.WarehouseCode && warehouseOptions.value[0]) {
        form.value.WarehouseCode = warehouseOptions.value[0].value
      }
    } finally {
      loading.value = false
    }
  }
```

Replace lines 193-214 with the following snippet to resolve and attach return unit price:
```javascript
      // Resolve unit price from current price list
      const pricingListCode = resolvePriceListCode(form.value.OutletCode, rules.items.value, priceLists.items.value)
      const priceList = priceLists.items.value.find(pl => active(pl) && text(pl.Code) === pricingListCode)
      const priceListLookup = resolvePriceListLookup(authStore.appConfigMap)
      const resolvedPrice = resolveSkuPrice(form.value.SKU, priceList, priceListLookup, priceListItems.items.value) || 0

      // Prepare record with capital TRUE/FALSE strings for backend
      const preparedRecord = {
        ...form.value,
        Price: resolvedPrice,
        InvoiceAdjustmentRequired: form.value.InvoiceAdjustmentRequired ? 'TRUE' : 'FALSE',
        InvoiceAdjustmentDone: form.value.InvoiceAdjustmentDone ? 'TRUE' : 'FALSE',
        WarehouseActionRequired: form.value.WarehouseActionRequired ? 'TRUE' : 'FALSE',
        WarehouseActionCompleted: form.value.WarehouseActionCompleted ? 'TRUE' : 'FALSE'
      }

      // Generate batch requests
      const returnRef = batchRef('OutletReturns.latest.code')
      const requests = [
        {
          action: 'create',
          resource: 'OutletReturns',
          payload: {
            record: preparedRecord
          }
        }
      ]
```

---

### Step 6: Frontend Consumption Workflow Logic (useOutletConsumption JS)
Implement tax pre-computation, proportional discount allocation, and JSON tax summary breakdown generation when generating or updating an invoice.

#### [MODIFY] [useOutletConsumption.js](file:///F:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/operations/outlets/useOutletConsumption.js)
Add imports at the top of the file (after line 23):
```javascript
import { useTaxCalculator } from '../../../useTaxCalculator.js'
import { useDataStore } from '../../../stores/data.js'
```

Add the shared function `computeInvoiceTaxBreakdown` at the top of `useOutletConsumption` composable body (around line 31):
```javascript
  function computeInvoiceTaxBreakdown(itemsList, priceListCode, headerDiscount, outletCode) {
    const skus = useDataStore().getRecords('SKUs') || []
    const priceLists = useDataStore().getRecords('PriceList') || []
    const plRecord = priceLists.find(p => p.Code === priceListCode && p.Status === 'Active')
    
    const subtotal = itemsList.reduce((sum, item) => sum + (toNumber(item.Qty) * toNumber(item.Price)), 0)
    const disc = toNumber(headerDiscount)

    let totalTaxableAmount = 0
    let totalTaxAmount = 0
    const detailsMap = {}

    const { calculateLineTax } = useTaxCalculator()

    const processedItems = itemsList.map(item => {
      const skuRecord = skus.find(s => s.Code === item.SKU && s.Status === 'Active')
      const taxCode = skuRecord ? skuRecord.TaxCode : ''
      const itemSubtotal = toNumber(item.Qty) * toNumber(item.Price)
      const itemDiscount = subtotal > 0 ? (itemSubtotal / subtotal) * disc : 0

      const lineTax = calculateLineTax({
        price: toNumber(item.Price),
        quantity: toNumber(item.Qty),
        discount: itemDiscount,
        taxCode: taxCode,
        taxInclusive: plRecord ? (plRecord.TaxInclusive === 'TRUE' || plRecord.TaxInclusive === true) : false,
        discountTaxPolicy: plRecord ? (plRecord.DiscountTaxPolicy || 'PRE_TAX') : 'PRE_TAX'
      })

      totalTaxableAmount += lineTax.taxableAmount
      totalTaxAmount += lineTax.taxAmount

      if (taxCode) {
        if (!detailsMap[taxCode]) {
          detailsMap[taxCode] = { TaxCode: taxCode, TaxableAmount: 0, TaxAmount: 0 }
        }
        detailsMap[taxCode].TaxableAmount += lineTax.taxableAmount
        detailsMap[taxCode].TaxAmount += lineTax.taxAmount
      }

      return {
        SKU: item.SKU,
        Qty: item.Qty,
        Price: item.Price,
        Total: lineTax.grossAmount,
        Discount: lineTax.discountAmount,
        TaxableAmount: lineTax.taxableAmount,
        TaxAmount: lineTax.taxAmount,
        TaxCode: taxCode
      }
    })

    const taxDetails = JSON.stringify(Object.values(detailsMap))

    return {
      processedItems,
      totalTaxableAmount,
      totalTaxAmount,
      taxDetails
    }
  }
```

Replace lines 339-408 in `prepareInvoiceReturns` (lines references from original file) to use return `Price` if present, falling back to database SKU price lookup:
```javascript
  function prepareInvoiceReturns(outletCode, newlyCreatedReturns = []) {
    if (!checklist.value.applyReturnsToInvoice) {
      return { appliedCodes: [], returnDeductionTotal: 0, updateRequests: [] }
    }

    // Pre-existing unadjusted returns
    const appliedReturns = returns.items.value.filter(ret =>
      active(ret) &&
      text(ret.OutletCode) === outletCode &&
      text(ret.InvoiceAdjustmentRequired) === 'TRUE' &&
      text(ret.InvoiceAdjustmentDone) !== 'TRUE'
    )

    const appliedCodes = [
      ...appliedReturns.map(r => r.Code),
      ...newlyCreatedReturns.map(r => r.Code)
    ]

    let returnDeductionTotal = 0
    const updateRequests = []

    const pricingListCode = resolvePriceListCode(outletCode, rules.items.value, priceLists.items.value)
    const priceList = priceLists.items.value.find(pl => active(pl) && text(pl.Code) === pricingListCode)
    const priceListLookup = resolvePriceListLookup(authStore.appConfigMap)

    // Gather pre-existing
    appliedReturns.forEach(ret => {
      const sku = text(ret.SKU)
      const qty = toNumber(ret.Qty)
      const price = toNumber(ret.Price) || resolveSkuPrice(sku, priceList, priceListLookup, priceListItems.items.value) || 0
      returnDeductionTotal += qty * price

      const isTrue = (val) => val === true || String(val).toUpperCase() === 'TRUE'
      const isWhCompleted = isTrue(ret.WarehouseActionCompleted) || !isTrue(ret.WarehouseActionRequired)
      const nextProgress = isWhCompleted ? 'COMPLETED' : 'AWAITING_WAREHOUSE_RECEIPT'

      updateRequests.push({
        action: 'update',
        resource: 'OutletReturns',
        payload: {
          code: ret.Code,
          record: {
            InvoiceAdjustmentDone: 'TRUE',
            Progress: nextProgress
          }
        }
      })
    })

    // Gather newly created
    newlyCreatedReturns.forEach(ret => {
      const sku = text(ret.SKU)
      const qty = toNumber(ret.Qty)
      const price = toNumber(ret.Price) || resolveSkuPrice(sku, priceList, priceListLookup, priceListItems.items.value) || 0
      returnDeductionTotal += qty * price

      const isTrue = (val) => val === true || String(val).toUpperCase() === 'TRUE'
      const isWhCompleted = isTrue(ret.WarehouseActionCompleted) || !isTrue(ret.WarehouseActionRequired)
      const nextProgress = isWhCompleted ? 'COMPLETED' : 'AWAITING_WAREHOUSE_RECEIPT'

      updateRequests.push({
        action: 'update',
        resource: 'OutletReturns',
        payload: {
          code: ret.Code,
          record: {
            InvoiceAdjustmentDone: 'TRUE',
            Progress: nextProgress
          }
        }
      })
    })

    return { appliedCodes, returnDeductionTotal, updateRequests }
  }
```

Replace return record preparation in `saveConsumption` workflow (lines 459-474) to resolve and attach unit `Price`:
```javascript
          const pricingListCode = resolvePriceListCode(form.value.OutletCode, rules.items.value, priceLists.items.value)
          const priceList = priceLists.items.value.find(pl => active(pl) && text(pl.Code) === pricingListCode)
          const priceListLookup = resolvePriceListLookup(authStore.appConfigMap)
          const resolvedReturnPrice = resolveSkuPrice(row.SKU, priceList, priceListLookup, priceListItems.items.value) || 0

          const preparedRecord = {
            OutletCode: text(form.value.OutletCode),
            Date: text(form.value.Date) || todayISO(),
            Username: text(form.value.Username),
            SKU: text(row.SKU),
            Qty: returnQty,
            Price: resolvedReturnPrice,
            Reason: text(meta.Reason || 'DAMAGE'),
            ReasonComment: text(meta.ReasonComment || ''),
            InvoiceAdjustmentRequired: meta.InvoiceAdjustmentRequired ? 'TRUE' : 'FALSE',
            InvoiceAdjustmentDone: 'FALSE',
            WarehouseActionRequired: meta.WarehouseActionRequired ? 'TRUE' : 'FALSE',
            WarehouseActionCompleted: 'FALSE',
            WarehouseCode: meta.WarehouseActionRequired ? text(meta.WarehouseCode) : '',
            Progress: 'SUBMITTED',
            Status: 'Active'
          }
```

Replace invoice saving block in `saveConsumption` workflow (lines 561-577) to compute and apply the tax breakdown:
```javascript
      if (checklist.value.generateInvoice && pricing) {
        const taxBreakdown = computeInvoiceTaxBreakdown(pricing.items, pricing.priceListCode, 0, form.value.OutletCode)
        const invoiceRef = batchRef('OutletConsumptionInvoices.latest.code')
        requests.push(
          buildConsumptionInvoiceRequest(consumptionRef, form.value, {
            priceListCode: pricing.priceListCode,
            subtotal: pricing.subtotal,
            discount: 0,
            totalTaxableAmount: taxBreakdown.totalTaxableAmount,
            totalTaxAmount: taxBreakdown.totalTaxAmount,
            taxDetails: taxBreakdown.taxDetails,
            returnDeductionTotal: returnsInfo.returnDeductionTotal,
            outletReturnCodes: returnsInfo.appliedCodes.join(', ')
          }),
          buildConsumptionInvoiceItemsRequest(invoiceRef, taxBreakdown.processedItems),
          buildInvoiceGeneratedRequest(consumptionRef, 'Invoice generated during consumption submit.')
        )

        if (returnsInfo.updateRequests.length > 0) {
          requests.push(...returnsInfo.updateRequests)
        }
      }
```

Replace `saveInvoiceFromConsumption` function body (lines 729-766) to compute and apply the tax breakdown:
```javascript
  async function saveInvoiceFromConsumption({ consumptionCode, consumptionRecord, items = [], discount = 0, tax = 0, priceListCode = '' }) {
    if (!allowed({ outletConsumptionInvoice: 'create', outletConsumption: 'MARKINVOICEGENERATED' })) {
      $q.notify({ type: 'negative', message: 'You do not have permission to save invoice.', position: 'top' })
      return { error: 'Unauthorized' }
    }
    if (!consumptionCode) return { error: 'Consumption code required' }
    if (!items.length) return { error: 'No items to invoice' }
    
    const subtotal = items.reduce((sum, item) => sum + (toNumber(item.Qty) * toNumber(item.Price)), 0)
    saving.value = true
    try {
      const returnsInfo = prepareInvoiceReturns(consumptionRecord.OutletCode, [])
      const taxBreakdown = computeInvoiceTaxBreakdown(items, priceListCode, discount, consumptionRecord.OutletCode)
      const invoiceRef = batchRef('OutletConsumptionInvoices.latest.code')
      const comment = 'Invoice generated from outlet consumption.'

      const requests = [
        buildConsumptionInvoiceRequest(consumptionCode, { ...consumptionRecord, InvoiceComment: comment }, {
          priceListCode,
          subtotal,
          discount,
          totalTaxableAmount: taxBreakdown.totalTaxableAmount,
          totalTaxAmount: taxBreakdown.totalTaxAmount,
          taxDetails: taxBreakdown.taxDetails,
          returnDeductionTotal: returnsInfo.returnDeductionTotal,
          outletReturnCodes: returnsInfo.appliedCodes.join(', ')
        }),
        buildConsumptionInvoiceItemsRequest(invoiceRef, taxBreakdown.processedItems),
        buildInvoiceGeneratedRequest(consumptionCode, comment)
      ]

      if (returnsInfo.updateRequests.length > 0) {
        requests.push(...returnsInfo.updateRequests)
      }

      const result = await resourceIoStore.runBatchRequests(requests)
      if (responseFailed(result)) return { error: failureMessage(result, 'Failed to save invoice.') }
      const invoiceCode = batchResultCode(result, 0)
      await reload(true)
      return { success: true, invoiceCode }
    } finally { saving.value = false }
  }
```

Replace `updateInvoice` function body (lines 768-792) to support re-calculating taxes and saving all computed fields for line items and headers:
```javascript
  async function updateInvoice(invoiceCode, { PriceListCode, Discount, Tax, ReturnDeductionTotal, items = [] } = {}) {
    if (!allowed({ outletConsumptionInvoice: 'update' })) {
      $q.notify({ type: 'negative', message: 'You do not have permission to update this invoice.', position: 'top' })
      return { error: 'Unauthorized' }
    }
    if (!invoiceCode) return { error: 'Invoice code required' }
    
    const invoiceRecord = invoices.items.value.find(inv => inv.Code === invoiceCode)
    if (!invoiceRecord) return { error: 'Invoice not found in store' }

    saving.value = true
    try {
      const requests = []
      const plCode = PriceListCode !== undefined ? PriceListCode : invoiceRecord.PriceListCode
      const disc = Discount !== undefined ? toNumber(Discount) : toNumber(invoiceRecord.Discount)
      
      const taxBreakdown = computeInvoiceTaxBreakdown(items, plCode, disc, invoiceRecord.OutletCode)

      const updateData = {}
      if (PriceListCode !== undefined) updateData.PriceListCode = PriceListCode
      if (Discount !== undefined) updateData.Discount = disc
      if (ReturnDeductionTotal !== undefined) updateData.ReturnDeductionTotal = toNumber(ReturnDeductionTotal)
      
      updateData.Subtotal = taxBreakdown.processedItems.reduce((sum, item) => sum + (toNumber(item.Qty) * toNumber(item.Price)), 0)
      updateData.TotalTaxableAmount = taxBreakdown.totalTaxableAmount
      updateData.TotalTaxAmount = taxBreakdown.totalTaxAmount
      updateData.TaxDetails = taxBreakdown.taxDetails

      if (Object.keys(updateData).length) {
        requests.push(resourceUpdateRequest('OutletConsumptionInvoices', invoiceCode, updateData))
      }

      for (const item of taxBreakdown.processedItems) {
        const existingItem = consumptionInvoiceItems.items.value.find(row => row.OutletConsumptionInvoiceCode === invoiceCode && row.SKU === item.SKU && active(row))
        const itemCode = item.Code || existingItem?.Code
        if (itemCode) {
          requests.push(resourceUpdateRequest('OutletConsumptionInvoiceItems', itemCode, {
            Price: toNumber(item.Price),
            Qty: toNumber(item.Qty),
            Total: toNumber(item.Total),
            Discount: toNumber(item.Discount),
            TaxableAmount: toNumber(item.TaxableAmount),
            TaxAmount: toNumber(item.TaxAmount),
            TaxCode: item.TaxCode
          }))
        }
      }

      if (!requests.length) return { success: true }
      const result = await resourceIoStore.runBatchRequests(requests)
      if (responseFailed(result)) return { error: failureMessage(result, 'Failed to update invoice.') }
      await reload(true)
      return { success: true }
    } finally { saving.value = false }
  }
```

---

### Step 7: Frontend Consumption Invoices Add Page
Modify `AddPage.vue` to compute line-level and grouped taxation dynamically using `useTaxCalculator` and lock manual editing of the `Tax` field.

#### [MODIFY] [AddPage.vue](file:///F:/LITTLE%20LEAP/AQL/FRONTENT/src/pages/Operations/OutletConsumptionInvoices/AddPage.vue)
Add imports at the top of the script tag (around line 86):
```javascript
import { useDataStore } from '../../../stores/data.js'
import { useTaxCalculator } from '../../../composables/useTaxCalculator.js'

const dataStore = useDataStore()
const { calculateLineTax } = useTaxCalculator()
```

Replace lines 52-54 in the template to make the tax input read-only:
```html
          <div class="col-6">
            <q-input :model-value="tax" readonly dense outlined type="number" label="Tax (Computed)" />
          </div>
```

Replace lines 105-130 in the script setup with the following snippet:
```javascript
const taxDetailsComputed = computed(() => {
  const plRecord = priceLists.items.value.find(p => p.Code === selectedPriceList.value && p.Status === 'Active')
  if (!plRecord) {
    return { totalTaxableAmount: 0, totalTaxAmount: 0, taxDetails: '[]', items: [] }
  }

  const skus = dataStore.getRecords('SKUs') || []
  const sub = subtotal.value
  const disc = Number(discount.value || 0)

  let totalTaxableAmount = 0
  let totalTaxAmount = 0
  const detailsMap = {}

  const itemsWithTax = editableItems.value.map(item => {
    const skuRecord = skus.find(s => s.Code === item.SKU && s.Status === 'Active')
    const taxCode = skuRecord ? skuRecord.TaxCode : ''
    const itemSubtotal = item.Qty * (item.Price || 0)
    const itemDiscount = sub > 0 ? (itemSubtotal / sub) * disc : 0

    const lineTax = calculateLineTax({
      price: item.Price || 0,
      quantity: item.Qty || 0,
      discount: itemDiscount,
      taxCode: taxCode,
      taxInclusive: plRecord.TaxInclusive === 'TRUE' || plRecord.TaxInclusive === true,
      discountTaxPolicy: plRecord.DiscountTaxPolicy || 'PRE_TAX'
    })

    totalTaxableAmount += lineTax.taxableAmount
    totalTaxAmount += lineTax.taxAmount

    if (taxCode) {
      if (!detailsMap[taxCode]) {
        detailsMap[taxCode] = { TaxCode: taxCode, TaxableAmount: 0, TaxAmount: 0 }
      }
      detailsMap[taxCode].TaxableAmount += lineTax.taxableAmount
      detailsMap[taxCode].TaxAmount += lineTax.taxAmount
    }

    return {
      SKU: item.SKU,
      Qty: item.Qty,
      Price: item.Price,
      Total: lineTax.grossAmount,
      Discount: lineTax.discountAmount,
      TaxableAmount: lineTax.taxableAmount,
      TaxAmount: lineTax.taxAmount,
      TaxCode: taxCode
    }
  })

  const taxDetails = JSON.stringify(Object.values(detailsMap))

  return {
    totalTaxableAmount,
    totalTaxAmount,
    taxDetails,
    items: itemsWithTax
  }
})

const returnDeductionTotal = computed(() => {
  if (!consumption.value) return 0
  const outletCode = text(consumption.value.OutletCode)
  const appliedReturns = returns.items.value.filter(ret =>
    active(ret) &&
    text(ret.OutletCode) === outletCode &&
    text(ret.InvoiceAdjustmentRequired) === 'TRUE' &&
    text(ret.InvoiceAdjustmentDone) !== 'TRUE'
  )

  let totalDeduction = 0
  const pListCode = selectedPriceList.value
  if (pListCode && appliedReturns.length > 0) {
    appliedReturns.forEach(ret => {
      const sku = text(ret.SKU)
      const qty = Number(ret.Qty || 0)
      const price = Number(ret.Price || 0)
      if (price > 0) {
        totalDeduction += qty * price
      } else {
        const pricing = resolvePriceListItems(pListCode, [{ SKU: sku, Qty: qty }])
        const resolvedPrice = pricing.items[0]?.Price || 0
        totalDeduction += qty * resolvedPrice
      }
    })
  }
  return totalDeduction
})

const tax = computed(() => taxDetailsComputed.value.totalTaxAmount)
const total = computed(() => getInvoiceTotal({ Subtotal: subtotal.value, Discount: discount.value, TotalTaxAmount: tax.value, ReturnDeductionTotal: returnDeductionTotal.value }))
```

Replace lines 170-179 in `saveInvoice` function to send the updated calculated items array:
```javascript
  const res = await saveInvoiceFromConsumption({
    consumptionCode: consumptionCode.value,
    consumptionRecord: consumption.value,
    items: taxDetailsComputed.value.items,
    discount: discount.value,
    tax: tax.value,
    priceListCode: selectedPriceList.value
  })
```

---

### Step 8: Frontend Consumption Invoices View Page
Modify `ViewPage.vue` to compute taxation breakdown dynamically on edit, disable manual editing of tax, and show the JSON `TaxDetails` breakdown under the summary list.

#### [MODIFY] [ViewPage.vue](file:///F:/LITTLE%20LEAP/AQL/FRONTENT/src/pages/Operations/OutletConsumptionInvoices/ViewPage.vue)
Add imports at the top of the script tag (around line 280):
```javascript
import { useDataStore } from '../../../stores/data.js'
import { useTaxCalculator } from '../../../composables/useTaxCalculator.js'

const dataStore = useDataStore()
const { calculateLineTax } = useTaxCalculator()
```

Replace the tax rendering block in the template (lines 201-203) with:
```html
                <div class="text-caption text-grey-6">Tax (Computed)</div>
                <div v-if="!editing" class="text-subtitle1 text-weight-bold text-grey-7 q-mt-xs">+{{ _C(realtimeTax || 0, true) }}</div>
                <q-input v-else :model-value="realtimeTax" readonly dense outlined type="number" :prefix="defaultCurrency.Symbol" label="Tax (Computed)" />
```

Also, insert the Tax Details breakdown rendering card just under the billing details row. Find line 209 (under the billing row card `</q-card-section>`) and add:
```html
        <q-separator />
        <q-card-section v-if="realtimeTaxDetailsComputed.taxDetails && realtimeTaxDetailsComputed.taxDetails.length" class="q-py-sm">
          <div class="text-caption text-grey-5 text-weight-bold q-mb-xs">Tax Details Breakdown</div>
          <div v-for="td in realtimeTaxDetailsComputed.taxDetails" :key="td.TaxCode" class="row justify-between text-caption text-grey-7 q-py-xs">
            <span>Tax Code: <span class="text-weight-bold text-grey-8">{{ td.TaxCode }}</span></span>
            <span>Taxable: {{ _C(td.TaxableAmount, true) }} | Tax Amount: {{ _C(td.TaxAmount, true) }}</span>
          </div>
        </q-card-section>
```

Replace lines 317-322 (`realtimeTax` computed property) in the script setup with:
```javascript
const realtimeTaxDetailsComputed = computed(() => {
  if (!editing.value) {
    return {
      totalTaxableAmount: parseFloat(invoice.value?.TotalTaxableAmount) || 0,
      totalTaxAmount: parseFloat(invoice.value?.TotalTaxAmount) || 0,
      taxDetails: invoice.value?.TaxDetails ? JSON.parse(invoice.value.TaxDetails) : []
    }
  }

  const plCode = editForm.value.priceListCode
  const plRecord = priceLists.items.value.find(p => p.Code === plCode && p.Status === 'Active')
  const skus = dataStore.getRecords('SKUs') || []
  
  const sub = realtimeSubtotal.value
  const disc = parseFloat(editForm.value.discount) || 0

  let totalTaxableAmount = 0
  let totalTaxAmount = 0
  const detailsMap = {}

  editLineItems.value.forEach(item => {
    const skuRecord = skus.find(s => s.Code === item.SKU && s.Status === 'Active')
    const taxCode = skuRecord ? skuRecord.TaxCode : ''
    const itemSubtotal = parseFloat(item.Qty || 0) * (parseFloat(item.Price) || 0)
    const itemDiscount = sub > 0 ? (itemSubtotal / sub) * disc : 0

    const lineTax = calculateLineTax({
      price: parseFloat(item.Price) || 0,
      quantity: parseFloat(item.Qty) || 0,
      discount: itemDiscount,
      taxCode: taxCode,
      taxInclusive: plRecord ? (plRecord.TaxInclusive === 'TRUE' || plRecord.TaxInclusive === true) : false,
      discountTaxPolicy: plRecord ? (plRecord.DiscountTaxPolicy || 'PRE_TAX') : 'PRE_TAX'
    })

    totalTaxableAmount += lineTax.taxableAmount
    totalTaxAmount += lineTax.taxAmount

    if (taxCode) {
      if (!detailsMap[taxCode]) {
        detailsMap[taxCode] = { TaxCode: taxCode, TaxableAmount: 0, TaxAmount: 0 }
      }
      detailsMap[taxCode].TaxableAmount += lineTax.taxableAmount
      detailsMap[taxCode].TaxAmount += lineTax.taxAmount
    }
  })

  return {
    totalTaxableAmount,
    totalTaxAmount,
    taxDetails: Object.values(detailsMap)
  }
})

const realtimeTax = computed(() => realtimeTaxDetailsComputed.value.totalTaxAmount)
```

Replace lines 353-357 in `loadLineItems` with:
```javascript
  editForm.value = {
    priceListCode: invoice.value.PriceListCode || '',
    discount: invoice.value.Discount || 0,
    tax: invoice.value.TotalTaxAmount || 0
  }
```

Replace lines 415-422 in `saveEdit` with:
```javascript
async function saveEdit() {
  const result = await updateInvoice(invoice.value.Code, {
    PriceListCode: editForm.value.priceListCode,
    Discount: editForm.value.discount,
    Tax: realtimeTax.value,
    ReturnDeductionTotal: realtimeReturnDeductionTotal.value,
    items: editLineItems.value
  })
```

---

## Documentation Updates Required
- [ ] Update `Documents/MASTER_SHEET_STRUCTURE.md` and `Documents/OPERATION_SHEET_STRUCTURE.md` with column details.
- [ ] Update `Documents/TAX_SYSTEM_DESIGN.md` detailing the consumption invoice line-item taxation flow and `TaxDetails` JSON format.

## Acceptance Criteria
- [ ] Running setup updates sheets structure cleanly.
- [ ] Invoice creation dynamically computes line-item total, discount, taxable/tax amounts, and tax code, and summarizes them on the invoice header.
- [ ] Returns save their price correctly and deduction is shown on the invoice.
- [ ] No regression on existing stock movements.

## Execution Self-Check Protocol

### Progress Log
- [ ] Step 1: Apps Script Schema Modifications completed
- [ ] Step 2: Apps Script Resources Config Modifications completed
- [ ] Step 3: Frontend Invoices and Returns Payload Helpers completed
- [ ] Step 4: Frontend Invoices Pricing Logic completed
- [ ] Step 5: Frontend Returns Logic completed
- [ ] Step 6: Frontend Consumption Workflow Logic completed
- [ ] Step 7: Frontend Consumption Invoices Add Page completed
- [ ] Step 8: Frontend Consumption Invoices View Page completed

### Files Actually Changed
- `GAS/setupMasterSheets.gs`
- `GAS/setupOperationSheets.gs`
- `GAS/syncAppResources.gs`
- `FRONTENT/src/composables/operations/outlets/outletConsumptionPayload.js`
- `FRONTENT/src/composables/operations/outlets/outletConsumptionPricing.js`
- `FRONTENT/src/composables/operations/outlets/useOutletReturns.js`
- `FRONTENT/src/composables/operations/outlets/useOutletConsumption.js`
- `FRONTENT/src/pages/Operations/OutletConsumptionInvoices/AddPage.vue`
- `FRONTENT/src/pages/Operations/OutletConsumptionInvoices/ViewPage.vue`

### Validation Performed
- [ ] Build compiled successfully using: `npm --prefix FRONTENT run build`
- [ ] Verification of Apps Script clasp push

### Manual Actions Required
- [ ] Run `AQL 🚀 > 🔄 Sync & Cache > Sync APP.Resources from Code`
- [ ] Run `AQL 🚀 > 🛠️ Setup & Maintenance > Refactor MASTER Sheets`
- [ ] Run `AQL 🚀 > 🛠️ Setup & Maintenance > Refactor Operation Sheets`
- [ ] Run `AQL 🚀 > 🔄 Sync & Cache > Regenerate App Cache`
