# PLAN: Register Out-of-the-Box Reports in App Resources
**Status**: DRAFT
**Created**: 2026-06-16
**Created By**: Brain Agent (Antigravity)
**Executed By**: Build Agent (Antigravity | pending)

## Objective
Register all 28 out-of-the-box reports from `Sheet Formulas/Reports/` into the central Apps Script resource configuration file `GAS/syncAppResources.gs`, and implement the select dropdown user dialog input logic in the frontend for list-level logs.

## Context
Reports in AQL are configured in the `APP.Resources` registry (stored under the `Reports` column as a JSON array of report definitions). Currently, only 2 reports are registered in `GAS/syncAppResources.gs` (under Products and Warehouses).
Following design alignment, we will support select dropdown filters for the 6 list-level reports (`RestockRecords`, `DeliveryRecords`, `ReturnRecords`, `ConsumptionRecords`, `InvoiceRecords`, and `PaymentRecords`) to provide a clean user experience and avoid manual typing.
The select options will either be configured as static option lists or dynamically sourced from unique values of a specific column of a registered resource using `useDataStore.getRecords(resourceName)`.
Additionally, the Warehouse stock report template name must be updated from `WarehouseStockReport` to the new storage-wise template: `WarehouseStockReportStorageWise`.

## Pre-Conditions
- [x] Reviewed report files under `Sheet Formulas/Reports/` and identified all input cells and destination cells.
- [x] Reviewed `GAS/syncAppResources.gs` structure.

---

## Technical Definition: User Dialog Inputs & Template Naming

1. **Template Naming Constraint**: 
   - `templateSheet` must match the exact filename of the markdown document under `Sheet Formulas/Reports/` without the `.md` extension.

2. **Select Dropdown Input Config JSON**:
   - `type` is `"select"`.
   - Option A: **Static Option List**:
     ```json
     {
       "label": "Payment Mode",
       "type": "select",
       "options": ["Every Mode", "Cash", "Card", "Bank Transfer"],
       "default": "Every Mode",
       "targetCell": "J13",
       "required": false
     }
     ```
   - Option B: **Dynamic Option List** (sourced from a resource column):
     ```json
     {
       "label": "User",
       "type": "select",
       "source": {
         "resource": "OutletRestocks",
         "field": "RequestedUser"
       },
       "default": "Any User",
       "targetCell": "J11",
       "required": false
     }
     ```

---

## Steps

### Step 1: Update Out-of-the-Box Report Configurations in `GAS/syncAppResources.gs`
Open the file `GAS/syncAppResources.gs` and apply replacement blocks to each target resource configuration definition.

#### 1.1 Products Resource Configuration
- **Line Target**: Line 41 of [syncAppResources.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/syncAppResources.gs#L41)
- **Action**: Replace `Reports: JSON.stringify([...]),` with the stringified array containing `ProductList`, `ProductReturnHistory`, and `ProductStockDetail`.
- **Target Content**:
```javascript
        Reports: JSON.stringify([{"id":"rep_1774663957785","name":"product-list","label":"Product List","templateSheet":"ProductList","isRecordLevel":false,"inputs":[],"pdfOptions":{}}]),
```
- **Replacement Content**:
```javascript
        Reports: JSON.stringify([
            {"id":"rep_1774663957785","name":"product-list","label":"Product List","templateSheet":"ProductList","isRecordLevel":false,"inputs":[],"pdfOptions":{}},
            {"id":"rep_1776000000001","name":"product-return-history","label":"Product Return History","templateSheet":"ProductReturnHistory","isRecordLevel":true,"inputs":[{"targetCell":"AB6","field":"Code"}],"pdfOptions":{}},
            {"id":"rep_1776000000002","name":"product-stock-detail","label":"Product Stock Detail","templateSheet":"ProductStockDetail","isRecordLevel":true,"inputs":[{"targetCell":"AB6","field":"Code"}],"pdfOptions":{}}
        ]),
```

#### 1.2 Warehouses Resource Configuration
- **Line Target**: Line 295 of [syncAppResources.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/syncAppResources.gs#L295)
- **Action**: Replace the old `Reports` registry (old `WarehouseStockReport` sheet) with the updated list of warehouse reports (`WarehouseStockReportStorageWise`, `WarehouseStockReportProductWise`, and `RestockDeliveriesWorklist`).
- **Target Content**:
```javascript
        Reports: JSON.stringify([{"id":"rep_1775978359788","name":"stock-report","label":"Stock Report","templateSheet":"WarehouseStockReport","isRecordLevel":true,"inputs":[{"targetCell":"AD10","field":"Code"}]}]),
```
- **Replacement Content**:
```javascript
        Reports: JSON.stringify([
            {"id":"rep_1775978359788","name":"warehouse-stock-report-storage-wise","label":"Stock Report (Storage Wise)","templateSheet":"WarehouseStockReportStorageWise","isRecordLevel":true,"inputs":[{"targetCell":"AD10","field":"Code"}],"pdfOptions":{}},
            {"id":"rep_1776000000003","name":"warehouse-stock-report-product-wise","label":"Stock Report (Product Wise)","templateSheet":"WarehouseStockReportProductWise","isRecordLevel":true,"inputs":[{"targetCell":"AD10","field":"Code"}],"pdfOptions":{}},
            {"id":"rep_1776000000004","name":"restock-deliveries-worklist","label":"Delivery Worklist","templateSheet":"RestockDeliveriesWorklist","isRecordLevel":true,"inputs":[{"targetCell":"AB6","field":"Code"}],"pdfOptions":{}}
        ]),
```

#### 1.3 Outlets Resource Configuration
- **Line Target**: Line 342 of [syncAppResources.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/syncAppResources.gs#L342)
- **Action**: Update empty `Reports` column with registered reports list: `OutletVisitHistory`, `OutletRestockHistory`, `OutletConsumptionHistory`, `OutletInvoiceHistory`, `OutletPaymentHistory`, `OutletReturnHistory`, `OutletStockDetail`.
- **Target Content**:
```javascript
        Reports: '',
```
- **Replacement Content**:
```javascript
        Reports: JSON.stringify([
            {"id":"rep_1776000000005","name":"outlet-visit-history","label":"Visit History","templateSheet":"OutletVisitHistory","isRecordLevel":true,"inputs":[{"targetCell":"H11","field":"Code"}],"pdfOptions":{}},
            {"id":"rep_1776000000006","name":"outlet-restock-history","label":"Restock History","templateSheet":"OutletRestockHistory","isRecordLevel":true,"inputs":[{"targetCell":"AB6","field":"Code"}],"pdfOptions":{}},
            {"id":"rep_1776000000007","name":"outlet-consumption-history","label":"Consumption History","templateSheet":"OutletConsumptionHistory","isRecordLevel":true,"inputs":[{"targetCell":"AB6","field":"Code"}],"pdfOptions":{}},
            {"id":"rep_1776000000008","name":"outlet-invoice-history","label":"Invoice History","templateSheet":"OutletInvoiceHistory","isRecordLevel":true,"inputs":[{"targetCell":"AB6","field":"Code"}],"pdfOptions":{}},
            {"id":"rep_1776000000009","name":"outlet-payment-history","label":"Payment History","templateSheet":"OutletPaymentHistory","isRecordLevel":true,"inputs":[{"targetCell":"AB6","field":"Code"}],"pdfOptions":{}},
            {"id":"rep_1776000000010","name":"outlet-return-history","label":"Return History","templateSheet":"OutletReturnHistory","isRecordLevel":true,"inputs":[{"targetCell":"AB6","field":"Code"}],"pdfOptions":{}},
            {"id":"rep_1776000000011","name":"outlet-stock-detail","label":"Stock Detail","templateSheet":"OutletStockDetail","isRecordLevel":true,"inputs":[{"targetCell":"AB6","field":"Code"}],"pdfOptions":{}}
        ]),
```

#### 1.4 Outlet Visits Resource Configuration
- **Line Target**: Line 874 of [syncAppResources.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/syncAppResources.gs#L874)
- **Action**: Update empty `Reports` column with list-level reports: `OutletVisitsToday`, `OutletVisitsTomorrowAndUpcomig`, `OutletVisitsOverdue`.
- **Target Content**:
```javascript
        UIFields: JSON.stringify([]), IncludeInAuthorizationPayload: 'TRUE', Functional: 'FALSE', PreAction: '', PostAction: '', Reports: '', CustomUIName: '', ListViews: ''
```
- **Replacement Content**:
```javascript
        UIFields: JSON.stringify([]), IncludeInAuthorizationPayload: 'TRUE', Functional: 'FALSE', PreAction: '', PostAction: '', Reports: JSON.stringify([
            {"id":"rep_1776000000012","name":"outlet-visits-today","label":"Visits Today","templateSheet":"OutletVisitsToday","isRecordLevel":false,"inputs":[],"pdfOptions":{}},
            {"id":"rep_1776000000013","name":"outlet-visits-tomorrow-upcoming","label":"Visits Tomorrow & Upcoming","templateSheet":"OutletVisitsTomorrowAndUpcomig","isRecordLevel":false,"inputs":[],"pdfOptions":{}},
            {"id":"rep_1776000000014","name":"outlet-visits-overdue","label":"Visits Overdue","templateSheet":"OutletVisitsOverdue","isRecordLevel":false,"inputs":[],"pdfOptions":{}}
        ]), CustomUIName: '', ListViews: ''
```

#### 1.5 Outlet Restocks Resource Configuration
- **Line Target**: Line 889 of [syncAppResources.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/syncAppResources.gs#L889)
- **Action**: Update empty `Reports` column with `Restock` and `RestockRecords`.
- **Target Content**:
```javascript
        UIFields: JSON.stringify([]), IncludeInAuthorizationPayload: 'TRUE', Functional: 'FALSE', PreAction: '', PostAction: '', Reports: '', CustomUIName: '', ListViews: ''
```
- **Replacement Content**:
```javascript
        UIFields: JSON.stringify([]), IncludeInAuthorizationPayload: 'TRUE', Functional: 'FALSE', PreAction: '', PostAction: '', Reports: JSON.stringify([
            {"id":"rep_1776000000015","name":"restock-order","label":"Restock Order","templateSheet":"Restock","isRecordLevel":true,"inputs":[{"targetCell":"AB6","field":"Code"}],"pdfOptions":{}},
            {"id":"rep_1776000000016","name":"restock-log","label":"Restock Log","templateSheet":"RestockRecords","isRecordLevel":false,"inputs":[{"label":"User","type":"select","targetCell":"J11","source":{"resource":"OutletRestocks","field":"RequestedUser"},"default":"Any User","required":false},{"label":"Date","type":"date","targetCell":"J12","required":false},{"label":"Progress","type":"select","targetCell":"J13","source":{"resource":"OutletRestocks","field":"Progress"},"default":"All Progress","required":false}],"pdfOptions":{}}
        ]), CustomUIName: '', ListViews: ''
```

#### 1.6 Outlet Deliveries Resource Configuration
- **Line Target**: Line 917 of [syncAppResources.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/syncAppResources.gs#L917)
- **Action**: Update empty `Reports` column with `Delivery` and `DeliveryRecords`.
- **Target Content**:
```javascript
        ]), IncludeInAuthorizationPayload: 'TRUE', Functional: 'FALSE', PreAction: '', PostAction: '', Reports: '', CustomUIName: '', ListViews: ''
```
- **Replacement Content**:
```javascript
        ]), IncludeInAuthorizationPayload: 'TRUE', Functional: 'FALSE', PreAction: '', PostAction: '', Reports: JSON.stringify([
            {"id":"rep_1776000000017","name":"delivery-receipt","label":"Delivery Receipt","templateSheet":"Delivery","isRecordLevel":true,"inputs":[{"targetCell":"AB6","field":"Code"}],"pdfOptions":{}},
            {"id":"rep_1776000000018","name":"delivery-log","label":"Delivery Log","templateSheet":"DeliveryRecords","isRecordLevel":false,"inputs":[{"label":"Driver/User","type":"select","targetCell":"J11","source":{"resource":"OutletDeliveries","field":"UserName"},"default":"Any User","required":false},{"label":"Date","type":"date","targetCell":"J12","required":false}],"pdfOptions":{}}
        ]), CustomUIName: '', ListViews: ''
```

#### 1.7 Outlet Returns Resource Configuration
- **Line Target**: Line 932 of [syncAppResources.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/syncAppResources.gs#L932)
- **Action**: Update empty `Reports` column with `Return` and `ReturnRecords`.
- **Target Content**:
```javascript
        UIFields: JSON.stringify([]), IncludeInAuthorizationPayload: 'TRUE', Functional: 'FALSE', PreAction: '', PostAction: '', Reports: '', CustomUIName: '', ListViews: ''
```
- **Replacement Content**:
```javascript
        UIFields: JSON.stringify([]), IncludeInAuthorizationPayload: 'TRUE', Functional: 'FALSE', PreAction: '', PostAction: '', Reports: JSON.stringify([
            {"id":"rep_1776000000019","name":"return-receipt","label":"Return Receipt","templateSheet":"Return","isRecordLevel":true,"inputs":[{"targetCell":"AB6","field":"Code"}],"pdfOptions":{}},
            {"id":"rep_1776000000020","name":"returns-log","label":"Returns Log","templateSheet":"ReturnRecords","isRecordLevel":false,"inputs":[{"label":"Username","type":"select","targetCell":"J11","source":{"resource":"OutletReturns","field":"Username"},"default":"Any User","required":false},{"label":"Date","type":"date","targetCell":"J12","required":false},{"label":"Return Reason","type":"select","targetCell":"J13","source":{"resource":"OutletReturns","field":"Reason"},"default":"Any Reason","required":false}],"pdfOptions":{}}
        ]), CustomUIName: '', ListViews: ''
```

#### 1.8 Outlet Consumptions Resource Configuration
- **Line Target**: Line 942 of [syncAppResources.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/syncAppResources.gs#L942)
- **Action**: Update empty `Reports` column with `Consumption` and `ConsumptionRecords`.
- **Target Content**:
```javascript
        Menu: JSON.stringify([{ "group": ["Field Sales"], "order": 6, "label": "Outlet Consumptions", "icon": "point_of_sale", "route": "/operation/outlet-consumptions", "pageTitle": "Outlet Consumptions", "pageDescription": "Record outlet stock consumption", "show": true }]), UIFields: JSON.stringify([]), IncludeInAuthorizationPayload: 'TRUE', Functional: 'FALSE', PreAction: '', PostAction: '', Reports: '', CustomUIName: '', ListViews: ''
```
- **Replacement Content**:
```javascript
        Menu: JSON.stringify([{ "group": ["Field Sales"], "order": 6, "label": "Outlet Consumptions", "icon": "point_of_sale", "route": "/operation/outlet-consumptions", "pageTitle": "Outlet Consumptions", "pageDescription": "Record outlet stock consumption", "show": true }]), UIFields: JSON.stringify([]), IncludeInAuthorizationPayload: 'TRUE', Functional: 'FALSE', PreAction: '', PostAction: '', Reports: JSON.stringify([
            {"id":"rep_1776000000021","name":"consumption-receipt","label":"Consumption Receipt","templateSheet":"Consumption","isRecordLevel":true,"inputs":[{"targetCell":"AB6","field":"Code"}],"pdfOptions":{}},
            {"id":"rep_1776000000022","name":"consumption-records-log","label":"Consumption Log","templateSheet":"ConsumptionRecords","isRecordLevel":false,"inputs":[{"label":"Username","type":"select","targetCell":"J11","source":{"resource":"OutletConsumptions","field":"Username"},"default":"Any User","required":false},{"label":"Date","type":"date","targetCell":"J12","required":false}],"pdfOptions":{}}
        ]), CustomUIName: '', ListViews: ''
```

#### 1.9 Consumption Invoices Resource Configuration
- **Line Target**: Line 958 of [syncAppResources.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/syncAppResources.gs#L958)
- **Action**: Update empty `Reports` column with `ConsumptionInvoice` and `InvoiceRecords`.
- **Target Content**:
```javascript
        Menu: JSON.stringify([{ "group": ["Field Sales"], "order": 7, "label": "Consumption Invoices", "icon": "receipt_long", "route": "/operation/outlet-consumption-invoices", "pageTitle": "Consumption Invoices", "pageDescription": "View outlet consumption invoices", "show": true }]), UIFields: JSON.stringify([]), IncludeInAuthorizationPayload: 'TRUE', Functional: 'FALSE', PreAction: '', PostAction: '', Reports: '', CustomUIName: '', ListViews: ''
```
- **Replacement Content**:
```javascript
        Menu: JSON.stringify([{ "group": ["Field Sales"], "order": 7, "label": "Consumption Invoices", "icon": "receipt_long", "route": "/operation/outlet-consumption-invoices", "pageTitle": "Consumption Invoices", "pageDescription": "View outlet consumption invoices", "show": true }]), UIFields: JSON.stringify([]), IncludeInAuthorizationPayload: 'TRUE', Functional: 'FALSE', PreAction: '', PostAction: '', Reports: JSON.stringify([
            {"id":"rep_1776000000023","name":"consumption-invoice","label":"Consumption Invoice","templateSheet":"ConsumptionInvoice","isRecordLevel":true,"inputs":[{"targetCell":"AB6","field":"Code"}],"pdfOptions":{}},
            {"id":"rep_1776000000024","name":"invoice-log","label":"Invoice Log","templateSheet":"InvoiceRecords","isRecordLevel":false,"inputs":[{"label":"Date","type":"date","targetCell":"J11","required":false},{"label":"Username","type":"select","targetCell":"J12","source":{"resource":"OutletConsumptionInvoices","field":"Username"},"default":"Any User","required":false},{"label":"Progress","type":"select","targetCell":"J13","source":{"resource":"OutletConsumptionInvoices","field":"Progress"},"default":"All Progress","required":false}],"pdfOptions":{}}
        ]), CustomUIName: '', ListViews: ''
```

#### 1.10 Outlet Payments Resource Configuration
- **Line Target**: Line 1023 of [syncAppResources.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/syncAppResources.gs#L1023)
- **Action**: Update empty `Reports` column with `Payment` and `PaymentRecords`.
- **Target Content**:
```javascript
        Reports: '',
```
- **Replacement Content**:
```javascript
        Reports: JSON.stringify([
            {"id":"rep_1776000000025","name":"payment-receipt","label":"Payment Receipt","templateSheet":"Payment","isRecordLevel":true,"inputs":[{"targetCell":"AB6","field":"Code"}],"pdfOptions":{}},
            {"id":"rep_1776000000026","name":"payment-log","label":"Payment Log","templateSheet":"PaymentRecords","isRecordLevel":false,"inputs":[{"label":"Date","type":"date","targetCell":"J11","required":false},{"label":"Username","type":"select","targetCell":"J12","source":{"resource":"OutletPayments","field":"Username"},"default":"Any User","required":false},{"label":"Payment Mode","type":"select","targetCell":"J13","source":{"resource":"OutletPayments","field":"Mode"},"default":"Every Mode","required":false}],"pdfOptions":{}}
        ]),
```

---

### Step 2: Implement Select Input logic in `ReportInputDialog.vue`
Modify the component `FRONTENT/src/components/master/ReportInputDialog.vue` to render `<q-select>` components for select fields, fetching options from the dataStore.

- **Line Target**: Line 18 in [ReportInputDialog.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/master/ReportInputDialog.vue#L18)
- **Action**: Insert the `<q-select>` template block before the text input block.
- **Target Content**:
```vue
        <template v-for="input in formFields" :key="input.label">
          <!-- Text input -->
          <q-input
            v-if="input.type === 'text'"
```
- **Replacement Content**:
```vue
        <template v-for="input in formFields" :key="input.label">
          <!-- Select dropdown -->
          <q-select
            v-if="input.type === 'select'"
            :model-value="formValues[input.label] || input.default || ''"
            :label="input.label"
            :options="getSelectOptions(input)"
            outlined
            dense
            emit-value
            map-options
            class="report-input"
            @update:model-value="updateField(input.label, $event)"
          />

          <!-- Text input -->
          <q-input
            v-else-if="input.type === 'text'"
```

- **Line Target**: Line 108 in [ReportInputDialog.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/master/ReportInputDialog.vue#L108)
- **Action**: Import `useDataStore` and define `getSelectOptions` in setup script.
- **Target Content**:
```javascript
import { computed } from 'vue'

const props = defineProps({
```
- **Replacement Content**:
```javascript
import { computed } from 'vue'
import { useDataStore } from 'src/stores/data'

const props = defineProps({
```
- **Line Target**: Line 137 in [ReportInputDialog.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/master/ReportInputDialog.vue#L137)
- **Action**: Define `dataStore` and `getSelectOptions(input)` helper.
- **Target Content**:
```javascript
function updateField(name, value) {
  emit('update:formValues', { ...props.formValues, [name]: value })
}
```
- **Replacement Content**:
```javascript
const dataStore = useDataStore()

function getSelectOptions(input) {
  if (input.options && Array.isArray(input.options)) {
    return input.options
  }
  if (input.source && input.source.resource && input.source.field) {
    const resourceName = input.source.resource
    const fieldName = input.source.field
    const records = dataStore.getRecords(resourceName) || []
    const uniqueValues = [...new Set(records.map(rec => rec[fieldName]))]
      .filter(val => val !== undefined && val !== null && val !== '')
      .sort()
    if (input.default && !uniqueValues.includes(input.default)) {
      return [input.default, ...uniqueValues]
    }
    return uniqueValues
  }
  return []
}

function updateField(name, value) {
  emit('update:formValues', { ...props.formValues, [name]: value })
}
```

---

### Step 3: Implement Option Fetching in `useReports.js`
Modify the composable `FRONTENT/src/composables/reports/useReports.js` to automatically preload the options' source resources when initiating a report.

- **Line Target**: Line 1 in [useReports.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/reports/useReports.js#L1)
- **Action**: Import `useDataStore`.
- **Target Content**:
```javascript
import { ref } from 'vue'
import { exportFile, useQuasar } from 'quasar'
import { useResourceIoStore } from 'src/stores/resourceIo'
```
- **Replacement Content**:
```javascript
import { ref } from 'vue'
import { exportFile, useQuasar } from 'quasar'
import { useResourceIoStore } from 'src/stores/resourceIo'
import { useDataStore } from 'src/stores/data'
```

- **Line Target**: Line 15 in [useReports.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/reports/useReports.js#L15)
- **Action**: Instantiate `dataStore`.
- **Target Content**:
```javascript
  const $q = useQuasar()
  const resourceIoStore = useResourceIoStore()
```
- **Replacement Content**:
```javascript
  const $q = useQuasar()
  const resourceIoStore = useResourceIoStore()
  const dataStore = useDataStore()
```

- **Line Target**: Line 66 in [useReports.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/reports/useReports.js#L66)
- **Action**: In `initiateReport()`, iterate over inputs and call `dataStore.loadResource` for select dropdowns to seed the options.
- **Target Content**:
```javascript
    if (requiresUserInput(report)) {
      // Initialize form with defaults
      const formInit = {}
      report.inputs
        .filter((input) => !input.field && input.type && input.label)
        .forEach((input) => {
          formInit[input.label] = input.default || ''
        })
      reportInputs.value = formInit
      showReportDialog.value = true
    } else {
```
- **Replacement Content**:
```javascript
    if (requiresUserInput(report)) {
      // Initialize form with defaults
      const formInit = {}
      report.inputs
        .filter((input) => !input.field && input.type && input.label)
        .forEach((input) => {
          formInit[input.label] = input.default || ''
          if (input.type === 'select' && input.source && input.source.resource) {
            dataStore.loadResource(input.source.resource, { cacheOnly: true }).catch(() => {})
            dataStore.loadResource(input.source.resource).catch(() => {})
          }
        })
      reportInputs.value = formInit
      showReportDialog.value = true
    } else {
```

---

## Documentation Updates Required
- [ ] Update Section 1.4 of [Documents/MODULE_WORKFLOWS.md](file:///f:/LITTLE%20LEAP/AQL/Documents/MODULE_WORKFLOWS.md) to note that out-of-the-box reports are fully populated in code config, and document the select type schema design.
- [ ] Update [Documents/CONTEXT_HANDOFF.md](file:///f:/LITTLE%20LEAP/AQL/Documents/CONTEXT_HANDOFF.md) outlining changes to report registrations and frontend dropdown logic.

## Acceptance Criteria
- [ ] `GAS/syncAppResources.gs` compiles successfully without syntax errors.
- [ ] Frontend builds cleanly.
- [ ] Select dialog inputs display dropdowns populated from unique resource record values (or static options) and are sent correctly to the GAS endpoint.
- [ ] Run target sync menu command to ensure definitions sync properly into `APP.Resources` in the active spreadsheet.

## Execution Self-Check Protocol
### Progress Log
- [ ] Step 1 completed
- [ ] Step 2 completed
- [ ] Step 3 completed
- [ ] Documentation updates completed
- [ ] Validation completed

