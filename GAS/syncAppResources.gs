/**
 * ============================================================
 * AQL - Sync APP.Resources from Code
 * ============================================================
 * Defines the default registry of APP.Resources in code so they can
 * be synced to the Google Sheet with one click.
 */

var APP_RESOURCES_CODE_CONFIG = null;

function initAppResourcesCodeConfig() {
    if (APP_RESOURCES_CODE_CONFIG) return;
    APP_RESOURCES_CODE_CONFIG = [
    // --- MASTER RESOURCES ---
    {
        Name: CONFIG.MASTER_SHEETS.PRODUCTS,
        Scope: 'master',
        IsActive: 'TRUE',
        SheetName: CONFIG.MASTER_SHEETS.PRODUCTS,
        CodePrefix: 'PRD',
        CodeSequenceLength: 5,
        LastDataUpdatedAt: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'Name,Status',
        UniqueHeaders: 'Name',
        UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Active"}',
        RecordAccessPolicy: 'ALL',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: '',
        Menu: JSON.stringify([{"group":["Product"],"order":1,"label":"Manage","icon":"inventory_2","route":"/master/products","pageTitle":"Products","pageDescription":"Manage product master records (parent models)","show":true,"menuAccess":{"require":"canWrite"}}]),
        UIFields: JSON.stringify([
            { header: 'Name', label: 'Name', type: 'text', required: true },
            { header: 'VariantTypes', label: 'Variant Types', type: 'text', hint: 'CSV e.g. Size,Color,Material' },
            { header: 'Status', label: 'Status', type: 'status', required: true }
        ]),
        IncludeInAuthorizationPayload: 'TRUE',
        Functional: 'FALSE',
        PreAction: '',
        PostAction: '',
        Reports: JSON.stringify([
            {"id":"rep_1774663957785","name":"product-list","label":"Product List","templateSheet":"ProductList","isRecordLevel":false,"inputs":[],"pdfOptions":{}},
            {"id":"rep_1776000000001","name":"product-return-history","label":"Product Return History","templateSheet":"ProductReturnHistory","isRecordLevel":true,"inputs":[{"targetCell":"AB6","field":"Code"}],"pdfOptions":{}},
            {"id":"rep_1776000000002","name":"product-stock-detail","label":"Product Stock Detail","templateSheet":"ProductStockDetail","isRecordLevel":true,"inputs":[{"targetCell":"AB6","field":"Code"}],"pdfOptions":{}}
        ]),
        CustomUIName: '',
        ListViews: ''
    },
    {
        Name: CONFIG.MASTER_SHEETS.SKUS,
        Scope: 'master',
        ParentResource: CONFIG.MASTER_SHEETS.PRODUCTS,
        IsActive: 'TRUE',
        SheetName: CONFIG.MASTER_SHEETS.SKUS,
        CodePrefix: 'SKU',
        CodeSequenceLength: 6,
        LastDataUpdatedAt: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'ProductCode,UOM,Status',
        UniqueHeaders: 'Code',
        UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Active","Barcode":""}',
        RecordAccessPolicy: 'ALL',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: '',
        Menu: JSON.stringify([{"group":["Product"],"order":2,"label":"SKUs","icon":"style","route":"/master/skus","pageTitle":"SKUs","pageDescription":"Manage sellable SKUs (child variants of a product)","show":true}]),
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
        IncludeInAuthorizationPayload: 'TRUE',
        Functional: 'FALSE',
        PreAction: '',
        PostAction: '',
        Reports: '',
        CustomUIName: '',
        ListViews: '',
        Relations: JSON.stringify({
            ProductCode: CONFIG.MASTER_SHEETS.PRODUCTS,
            UOM: CONFIG.MASTER_SHEETS.UOMS,
            TaxCode: CONFIG.MASTER_SHEETS.TAXES
        })
    },
         {
             Name: CONFIG.MASTER_SHEETS.UOMS,
             Scope: 'master',
             IsActive: 'TRUE',
             SheetName: CONFIG.MASTER_SHEETS.UOMS,
             CodePrefix: '',
             CodeSequenceLength: 0,
             LastDataUpdatedAt: 0,
             Audit: 'TRUE',
             RequiredHeaders: 'Code,Name',
             UniqueHeaders: 'Code',
             UniqueCompositeHeaders: '',
             DefaultValues: '{"Status":"Active"}',
             RecordAccessPolicy: 'ALL',
             OwnerUserField: 'CreatedBy',
             AdditionalActions: '',
             Menu: JSON.stringify([{"group":["Product"],"order":3,"label":"UOMs","icon":"straighten","route":"/master/uoms","pageTitle":"Units of Measure","pageDescription":"Manage units of measure","show":true}]),
             UIFields: JSON.stringify([
                 { header: 'Code', label: 'Code', type: 'text', required: true },
                 { header: 'Name', label: 'Name', type: 'text', required: true },
                 { header: 'BaseUOM', label: 'Base UOM', type: 'text' },
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
      DefaultValues: '{"Status":"Active","Decimals":2,"RoundingInterval":0.01,"BaseCurrency":"FALSE","ConversionFactor":1}',
      RecordAccessPolicy: 'ALL',
      OwnerUserField: 'CreatedBy',
      AdditionalActions: '',
      Menu: JSON.stringify([{"group":["Masters"],"order":1,"label":"Currencies","icon":"attach_money","route":"/master/currencies","pageTitle":"Currencies","pageDescription":"Manage currency master records","show":true}]),
      UIFields: JSON.stringify([
          { header: 'Code', label: 'Code', type: 'text', required: true, hint: 'e.g. AED, INR, USD' },
          { header: 'Name', label: 'Name', type: 'text', required: true },
          { header: 'Symbol', label: 'Symbol', type: 'text', required: true },
          { header: 'Subunit', label: 'Subunit', type: 'text', hint: 'e.g. Fils, Paise, Cent' },
          { header: 'Decimals', label: 'Decimals', type: 'number' },
          { header: 'RoundingInterval', label: 'Rounding Interval', type: 'number', hint: 'e.g. 0.01, 0.25, 0.50, 1.00' },
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
      DefaultValues: '{"Status":"Active","IsDefault":"FALSE","TaxInclusive":"FALSE","DiscountTaxPolicy":"POST_TAX"}',
      RecordAccessPolicy: 'ALL',
      OwnerUserField: 'CreatedBy',
      AdditionalActions: '',
      Menu: JSON.stringify([{"group":["Product"],"order":5,"label":"Price Lists","icon":"sell","route":"/master/price-lists","pageTitle":"Price Lists","pageDescription":"Manage product price lists","show":true}]),
      UIFields: JSON.stringify([
          { header: 'Name', label: 'Name', type: 'text', required: true },
          { header: 'Description', label: 'Description', type: 'textarea' },
          { header: 'Currency', label: 'Currency', type: 'text', required: true, hint: 'Currency code e.g. AED' },
          { header: 'IsDefault', label: 'Is Default', type: 'dropdown', options: ['TRUE','FALSE'] },
          { header: 'SKUPrices', label: 'SKU Prices (JSON)', type: 'textarea', hint: '{ "SKUCode": price }' },
          { header: 'TaxInclusive', label: 'Tax Inclusive', type: 'dropdown', options: ['TRUE','FALSE'] },
          { header: 'DiscountTaxPolicy', label: 'Discount Tax Policy', type: 'dropdown', options: ['PRE_TAX','POST_TAX'] },
          { header: 'Status', label: 'Status', type: 'status', required: true }
      ]),
      IncludeInAuthorizationPayload: 'TRUE',
      Functional: 'FALSE',
      PreAction: '',
      PostAction: '',
      Reports: '',
      CustomUIName: '',
      ListViews: '',
      Relations: JSON.stringify({
        Currency: CONFIG.MASTER_SHEETS.CURRENCIES
      })
    },
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
      DefaultValues: '{"Status":"Active","Price":0,"RSP":0}',
      RecordAccessPolicy: 'ALL',
      OwnerUserField: 'CreatedBy',
      AdditionalActions: '',
      Menu: JSON.stringify([]),
      UIFields: JSON.stringify([
          { header: 'PriceListCode', label: 'Price List Code', type: 'text', required: true },
          { header: 'SKUCode', label: 'SKU Code', type: 'text', required: true },
          { header: 'Price', label: 'Price', type: 'currency', required: true },
          { header: 'RSP', label: 'Retail Sale Price (RSP)', type: 'currency' },
          { header: 'Status', label: 'Status', type: 'status', required: true }
      ]),
      IncludeInAuthorizationPayload: 'TRUE',
      Functional: 'FALSE',
      PreAction: '',
      PostAction: '',
      Reports: '',
      CustomUIName: '',
      ListViews: '',
      Relations: JSON.stringify({
        PriceListCode: CONFIG.MASTER_SHEETS.PRICE_LIST,
        SKUCode: { resource: CONFIG.MASTER_SHEETS.SKUS, targetHeader: 'Code', labelHeader: '$product.Name' }
      })
    },
    {
        Name: CONFIG.MASTER_SHEETS.SUPPLIERS,
        Scope: 'master',
        IsActive: 'TRUE',
        SheetName: CONFIG.MASTER_SHEETS.SUPPLIERS,
        CodePrefix: 'SUP',
        CodeSequenceLength: 4,
        LastDataUpdatedAt: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'Name,Status',
        UniqueHeaders: 'Name',
        UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Active","TaxRegistrationNumber":"","TaxRegistrationName":""}',
        RecordAccessPolicy: 'ALL',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: '',
        Menu: JSON.stringify([{"group":["Procurement"],"order":1,"label":"Suppliers","icon":"business","route":"/master/suppliers","pageTitle":"Suppliers","pageDescription":"Manage supplier master records","show":true}]),
        UIFields: JSON.stringify([
            { header: 'Name', label: 'Name', type: 'text', required: true },
            { header: 'Country', label: 'Country', type: 'text' },
            { header: 'Province', label: 'Province', type: 'text' },
            { header: 'City', label: 'City', type: 'text' },
            { header: 'CommunicationAddress', label: 'Communication Address', type: 'textarea' },
            { header: 'ContactPerson', label: 'Contact Person', type: 'text' },
            { header: 'Phone', label: 'Phone', type: 'tel' },
            { header: 'Email', label: 'Email', type: 'text' },
            { header: 'TaxRegistrationNumber', label: 'Tax Registration Number', type: 'text' },
            { header: 'TaxRegistrationName', label: 'Tax Registration Name', type: 'text' },
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
    {
        Name: CONFIG.MASTER_SHEETS.WAREHOUSES,
        Scope: 'master',
        IsActive: 'TRUE',
        SheetName: CONFIG.MASTER_SHEETS.WAREHOUSES,
        CodePrefix: 'WH',
        CodeSequenceLength: 3,
        LastDataUpdatedAt: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'Name,Status',
        UniqueHeaders: 'Name',
        UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Active","Country":"UAE","Type":"Main","TaxRegistrationNumber":"","TaxRegistrationName":""}',
        RecordAccessPolicy: 'ALL',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: JSON.stringify([
            {"action":"ViewStock","label":"View Stock","icon":"inventory","color":"primary","kind":"navigate","confirm":false,"navigate":{"target":"record","pageSlug":"stock"}}
        ]),
        Menu: JSON.stringify([
            {"group":["Warehouse"],"order":1,"label":"Manage","icon":"warehouse","route":"/master/warehouses","pageTitle":"Warehouses","pageDescription":"Manage warehouse master records","show":true},
            {"group":["Warehouse"],"order":2,"label":"Stock List","icon":"inventory_2","route":"/master/warehouses/stock-list","pageTitle":"Warehouse Stock List","pageDescription":"Select a warehouse and view current stock","show":true}
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
        IncludeInAuthorizationPayload: 'TRUE',
        Functional: 'FALSE',
        PreAction: '',
        PostAction: '',
        Reports: JSON.stringify([
            {"id":"rep_1775978359788","name":"warehouse-stock-report-storage-wise","label":"Stock Report (Storage Wise)","templateSheet":"WarehouseStockReportStorageWise","isRecordLevel":true,"inputs":[{"targetCell":"AD10","field":"Code"}],"pdfOptions":{}},
            {"id":"rep_1776000000003","name":"warehouse-stock-report-product-wise","label":"Stock Report (Product Wise)","templateSheet":"WarehouseStockReportProductWise","isRecordLevel":true,"inputs":[{"targetCell":"AD10","field":"Code"}],"pdfOptions":{}},
            {"id":"rep_1776000000004","name":"restock-deliveries-worklist","label":"Delivery Worklist","templateSheet":"RestockDeliveriesWorklist","isRecordLevel":true,"inputs":[{"targetCell":"AB6","field":"Code"}],"pdfOptions":{}}
        ]),
        CustomUIName: '',
        ListViews: ''
    },
    {
        Name: CONFIG.MASTER_SHEETS.OUTLETS,
        Scope: 'master',
        IsActive: 'TRUE',
        SheetName: CONFIG.MASTER_SHEETS.OUTLETS,
        CodePrefix: 'OUT',
        CodeSequenceLength: 5,
        LastDataUpdatedAt: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'Name',
        UniqueHeaders: 'Name',
        UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Active","Country":"UAE","TaxRegistrationNumber":"","TaxRegistrationName":""}',
        RecordAccessPolicy: 'ALL',
        OwnerUserField: 'CreatedBy',
        // The four operational entry points an outlet's View page offers, as FAB items.
        //
        // All four are `navigate` actions: they collect nothing here, they open the target
        // resource's own Add flow, which already owns that workflow's validation. Declaring
        // them here rather than as buttons inside the View cards is what keeps eligibility in
        // ONE place — the Action subsystem gates each on the target resource's permissions
        // and on `visibleWhen` (UI_ACTION_SYSTEM.md §7).
        //
        // Each carries a `_ui` click handler (`components/Master/Outlets/View/
        // ResourceAction<Name>.js`) that adds `?outletCode=` so the target wizard opens with
        // this outlet already chosen. The `navigate` block below is the fallback if that
        // handler is ever removed: the user still lands on the right Add page, just without
        // the preselection.
        AdditionalActions: JSON.stringify([
            {"action":"NewRestock","label":"New Restock","icon":"inventory_2","color":"teal-7","kind":"navigate","confirm":false,"navigate":{"target":"add","scope":"operation","resourceSlug":"outlet-restocks"},"visibleWhen":{"column":"Status","op":"eq","value":"Active"}},
            {"action":"NewConsumption","label":"New Consumption","icon":"point_of_sale","color":"deep-orange","kind":"navigate","confirm":false,"navigate":{"target":"add","scope":"operation","resourceSlug":"outlet-consumptions"},"visibleWhen":{"column":"Status","op":"eq","value":"Active"}},
            {"action":"NewInvoice","label":"New Invoice","icon":"receipt_long","color":"primary","kind":"navigate","confirm":false,"navigate":{"target":"add","scope":"operation","resourceSlug":"outlet-consumption-invoices"},"visibleWhen":{"column":"Status","op":"eq","value":"Active"}},
            {"action":"NewPayment","label":"New Payment","icon":"payments","color":"positive","kind":"navigate","confirm":false,"navigate":{"target":"add","scope":"operation","resourceSlug":"outlet-payments"},"visibleWhen":{"column":"Status","op":"eq","value":"Active"}}
        ]),
        Menu: JSON.stringify([
            {"group":["Outlet Operations"],"order":1,"label":"Outlets","icon":"storefront","route":"/master/outlets","pageTitle":"Outlets","pageDescription":"Manage outlet master records","show":true},
            {"group":["Field Sales"],"order":1,"label":"Outlet Hub","icon":"hub","route":"/master/outlets/operation-hub","pageTitle":"Outlet Hub","pageDescription":"Outlet-centric view of visits, restocks, returns, invoices, and payments","show":true}
        ]),
        UIFields: JSON.stringify([
            { header: 'Name', label: 'Name', type: 'text', required: true },
            { header: 'ContactPerson', label: 'Contact Person', type: 'text' },
            { header: 'Phone', label: 'Phone', type: 'tel' },
            { header: 'Email', label: 'Email', type: 'text' },
            { header: 'Country', label: 'Country', type: 'text' },
            { header: 'Province', label: 'Province', type: 'text' },
            { header: 'Area', label: 'Area', type: 'text' },
            { header: 'City', label: 'City', type: 'text' },
            { header: 'CommunicationAddress', label: 'Communication Address', type: 'textarea' },
            { header: 'ShippingAddress', label: 'Shipping Address', type: 'textarea' },
            { header: 'BillingAddress', label: 'Billing Address', type: 'textarea' },
            { header: 'MapLocationLink', label: 'Map Location Link', type: 'link' },
            { header: 'Picture', label: 'Picture', type: 'file', accept: 'image/*' },
            { header: 'Picture2', label: 'Picture 2', type: 'file', accept: 'image/*' },
            { header: 'Picture3', label: 'Picture 3', type: 'file', accept: 'image/*' },
            { header: 'Licence', label: 'Licence', type: 'file' },
            { header: 'TaxRegistrationNumber', label: 'Tax Registration Number', type: 'text' },
            { header: 'TaxRegistrationName', label: 'Tax Registration Name', type: 'text' },
            { header: 'Status', label: 'Status', type: 'status', required: true }
        ]),
        IncludeInAuthorizationPayload: 'TRUE',
        Functional: 'FALSE',
        PreAction: '',
        PostAction: '',
        Reports: JSON.stringify([
            {"id":"rep_1776000000005","name":"outlet-visit-history","label":"Visit History","templateSheet":"OutletVisitHistory","isRecordLevel":true,"inputs":[{"targetCell":"H11","field":"Code"}],"pdfOptions":{}},
            {"id":"rep_1776000000006","name":"outlet-restock-history","label":"Restock History","templateSheet":"OutletRestockHistory","isRecordLevel":true,"inputs":[{"targetCell":"AB6","field":"Code"}],"pdfOptions":{}},
            {"id":"rep_1776000000007","name":"outlet-consumption-history","label":"Consumption History","templateSheet":"OutletConsumptionHistory","isRecordLevel":true,"inputs":[{"targetCell":"AB6","field":"Code"}],"pdfOptions":{}},
            {"id":"rep_1776000000008","name":"outlet-invoice-history","label":"Invoice History","templateSheet":"OutletInvoiceHistory","isRecordLevel":true,"inputs":[{"targetCell":"AB6","field":"Code"}],"pdfOptions":{}},
            {"id":"rep_1776000000009","name":"outlet-payment-history","label":"Payment History","templateSheet":"OutletPaymentHistory","isRecordLevel":true,"inputs":[{"targetCell":"AB6","field":"Code"}],"pdfOptions":{}},
            {"id":"rep_1776000000010","name":"outlet-return-history","label":"Return History","templateSheet":"OutletReturnHistory","isRecordLevel":true,"inputs":[{"targetCell":"AB6","field":"Code"}],"pdfOptions":{}},
            {"id":"rep_1776000000011","name":"outlet-stock-detail","label":"Stock Detail","templateSheet":"OutletStockDetail","isRecordLevel":true,"inputs":[{"targetCell":"AB6","field":"Code"}],"pdfOptions":{}}
        ]),
        CustomUIName: '',
        // Six queues, declared here so `AllOutlets` is the page's DEFAULT view and every pill
        // resolves its `Index/List<Name>.vue` override. Without this row the resource falls
        // through to auto-derived views (one per `Status` value — "Active", "Inactive"), and
        // the Index opens on a view no override is registered for.
        //
        // Five of the six are defined by events in OTHER resources — an Outlets row cannot
        // state when it was last paid — so the filters below are never what fills them; the
        // `.vue` override reads the Layer 2 aggregate. The entries exist for the NAME, the
        // default flag and the pill order; labels, icons and counts come from
        // `Index/ListSwitcher.js`.
        ListViews: JSON.stringify([
            { "name": "AllOutlets", "label": "All Outlets", "icon": "storefront", "color": "primary", "default": true, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Status", "operator": "eq", "value": "Active" }] } },
            { "name": "NoUpdates", "label": "No Updates", "icon": "running_with_errors", "color": "negative", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Status", "operator": "eq", "value": "Active" }] } },
            { "name": "RecentlyRestocked", "label": "Restocked", "icon": "inventory_2", "color": "teal-7", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Status", "operator": "eq", "value": "Active" }] } },
            { "name": "RecentlyConsumed", "label": "Consumed", "icon": "point_of_sale", "color": "deep-orange", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Status", "operator": "eq", "value": "Active" }] } },
            { "name": "RecentlyPaid", "label": "Paid", "icon": "payments", "color": "positive", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Status", "operator": "eq", "value": "Active" }] } },
            { "name": "RecentlyVisited", "label": "Visited", "icon": "event_available", "color": "info", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Status", "operator": "eq", "value": "Active" }] } }
        ])
    },
    {
        Name: CONFIG.MASTER_SHEETS.OUTLET_OPERATING_RULES,
        Scope: 'master',
        ParentResource: CONFIG.MASTER_SHEETS.OUTLETS,
        IsActive: 'TRUE',
        SheetName: CONFIG.MASTER_SHEETS.OUTLET_OPERATING_RULES,
        CodePrefix: 'OOR',
        CodeSequenceLength: 5,
        LastDataUpdatedAt: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'OutletCode,PriceListCode',
        UniqueHeaders: '',
        UniqueCompositeHeaders: 'OutletCode',
        DefaultValues: '{"Status":"Active","MaxStockValueLimit":0,"VisitFrequencyDays":14,"CreditLimit":0,"InvoiceDueDays":30}',
        RecordAccessPolicy: 'ALL',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: '',
        Menu: JSON.stringify([{"group":["Outlet Operations"],"order":2,"label":"Operating Rules","icon":"rule","route":"/master/outlet-operating-rules","pageTitle":"Outlet Operating Rules","pageDescription":"Manage outlet operating rules","show":true}]),
        UIFields: JSON.stringify([
            { header: 'OutletCode', label: 'Outlet Code', type: 'text', required: true },
            { header: 'PriceListCode', label: 'Price List Code', type: 'text', hint: 'Optional. Falls back to IsDefault price list.' },
            { header: 'MaxStockValueLimit', label: 'Max Stock Value Limit', type: 'currency' },
            { header: 'VisitFrequencyDays', label: 'Visit Frequency Days', type: 'number' },
            { header: 'InvoiceDueDays', label: 'Invoice Due Days', type: 'number', hint: 'Days after invoice date before payment falls due.' },
            { header: 'CreditLimit', label: 'Credit Limit', type: 'currency' },
            { header: 'Status', label: 'Status', type: 'status', required: true }
        ]),
        IncludeInAuthorizationPayload: 'TRUE',
        Functional: 'FALSE',
        PreAction: '',
        PostAction: '',
        Reports: '',
        CustomUIName: '',
        ListViews: '',
        Relations: JSON.stringify({
            OutletCode: CONFIG.MASTER_SHEETS.OUTLETS,
            PriceListCode: CONFIG.MASTER_SHEETS.PRICE_LIST
        })
    },
    {
        Name: CONFIG.MASTER_SHEETS.TAXES,
        Scope: 'master',
        IsActive: 'TRUE',
        SheetName: CONFIG.MASTER_SHEETS.TAXES,
        CodePrefix: 'TAX',
        CodeSequenceLength: 4,
        LastDataUpdatedAt: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'Code,Name',
        UniqueHeaders: 'Code',
        UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Active","PercentageTransaction":0,"FlatUnit":0,"CalculationOrder":1}',
        RecordAccessPolicy: 'ALL',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: '',
        Menu: JSON.stringify([{"group":["Masters"],"order":2,"label":"Taxes","icon":"percent","route":"/master/taxes","pageTitle":"Taxes","pageDescription":"Manage master tax categories and child sub-taxes","show":true}]),
        UIFields: JSON.stringify([
            { header: 'Code', label: 'Code', type: 'text', required: true },
            { header: 'Name', label: 'Name', type: 'text', required: true },
            { header: 'ParentCode', label: 'Parent Code', type: 'text', hint: 'Optional. Links to parent tax group.' },
            { header: 'PercentageTransaction', label: 'Percentage Transaction (%)', type: 'number' },
            { header: 'FlatUnit', label: 'Flat Unit Rate', type: 'number' },
            { header: 'CalculationOrder', label: 'Calculation Order', type: 'number' },
            { header: 'CompoundOn', label: 'Compound On', type: 'text', hint: 'Optional. blank, PREVIOUS, or [TaxCode]' },
            { header: 'Description', label: 'Description', type: 'textarea' },
            { header: 'Status', label: 'Status', type: 'status', required: true }
        ]),
        IncludeInAuthorizationPayload: 'TRUE',
        Functional: 'FALSE',
        PreAction: '',
        PostAction: '',
        Reports: '',
        CustomUIName: '',
        ListViews: '',
        Relations: JSON.stringify({
            ParentCode: CONFIG.MASTER_SHEETS.TAXES
        })
    },
    {
        Name: CONFIG.MASTER_SHEETS.LEADS,
        Scope: 'master',
        IsActive: 'TRUE',
        SheetName: CONFIG.MASTER_SHEETS.LEADS,
        CodePrefix: 'LED',
        CodeSequenceLength: 5,
        LastDataUpdatedAt: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'Name,Type,Progress,Status',
        UniqueHeaders: '',
        UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Active","Progress":"Draft"}',
        RecordAccessPolicy: 'ALL',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: JSON.stringify([
            {"action": "Approve", "label": "Approve Lead", "title": "Approve Lead", "subtitle": "{Name}", "icon": "verified", "color": "positive", "kind": "mutate", "confirm": false, "column": "Progress", "columnValue": "Approved", "columnValueOptions": [], "fields": [{"name": "Comment", "label": "Approval Comment", "type": "textarea", "required": true}], "visibleWhen": {"column": "Progress", "op": "eq", "value": "Processing"}},
            {"action": "Reject", "label": "Reject Lead", "title": "Reject Lead", "subtitle": "{Name}", "icon": "cancel", "color": "negative", "kind": "mutate", "confirm": false, "column": "Progress", "columnValue": "Rejected", "columnValueOptions": [], "fields": [{"name": "Comment", "label": "Rejection Reason", "type": "textarea", "required": true}], "visibleWhen": {"column": "Progress", "op": "eq", "value": "Processing"}},
            {"action": "Later", "label": "Mark for Later", "title": "Mark for Later", "subtitle": "{Name}", "icon": "schedule", "color": "warning", "kind": "mutate", "confirm": false, "column": "Progress", "columnValue": "Later", "columnValueOptions": [], "fields": [{"name": "Comment", "label": "Reason for Later", "type": "textarea", "required": true}], "visibleWhen": {"column": "Progress", "op": "eq", "value": "Processing"}},
            {"action": "ResumeLead", "label": "Resume Lead", "title": "Resume Lead", "subtitle": "{Name}", "icon": "autorenew", "color": "primary", "kind": "mutate", "confirm": false, "column": "Progress", "columnValue": "Processing", "columnValueOptions": [], "fields": [{"name": "ContactPerson1", "label": "Contact Person 1", "type": "text", "from": "$record.ContactPerson1"}, {"name": "Phone1", "label": "Phone 1", "type": "tel", "from": "$record.Phone1"}, {"name": "ContactPerson2", "label": "Contact Person 2", "type": "text", "from": "$record.ContactPerson2"}, {"name": "Phone2", "label": "Phone 2", "type": "tel", "from": "$record.Phone2"}, {"name": "ProgressProcessingComment", "value": "Resuming from Later on ${$today} by ${$userName}"}, {"name": "ProgressProcessingAt", "value": "$dateTime"}, {"name": "ProgressProcessingBy", "value": "$userName"}], "visibleWhen": {"column": "Progress", "op": "eq", "value": "Later"}}
        ]),
        Menu: JSON.stringify([{"group":["Leads"],"order":1,"label":"Leads","icon":"person_search","route":"/master/leads","pageTitle":"Leads","pageDescription":"Manage possible future outlets, suppliers, customers and partners","show":true}]),
        UIFields: JSON.stringify([
            { header: 'Name', label: 'Name', type: 'text', required: true },
            { header: 'ContactPerson1', label: 'Contact Person 1', type: 'text' },
            { header: 'ContactPerson2', label: 'Contact Person 2', type: 'text' },
            { header: 'Phone1', label: 'Phone 1', type: 'tel' },
            { header: 'Phone2', label: 'Phone 2', type: 'tel' },
            { header: 'Type', label: 'Type', type: 'openselect', required: true, hint: 'Pick a type, or add a new one.' },
            { header: 'Progress', label: 'Progress', type: 'select' },
            { header: 'ProgressProcessingAt', label: 'Processing At', type: 'datetime' },
            { header: 'ProgressProcessingBy', label: 'Processing By', type: 'text' },
            { header: 'ProgressProcessingComment', label: 'Processing Comment', type: 'textarea' },
            { header: 'ProgressLaterAt', label: 'Later At', type: 'datetime' },
            { header: 'ProgressLaterBy', label: 'Later By', type: 'text' },
            { header: 'ProgressLaterComment', label: 'Later Comment', type: 'textarea' },
            { header: 'ProgressRejectedAt', label: 'Rejected At', type: 'datetime' },
            { header: 'ProgressRejectedBy', label: 'Rejected By', type: 'text' },
            { header: 'ProgressRejectedComment', label: 'Rejected Comment', type: 'textarea' },
            { header: 'ProgressApprovedAt', label: 'Approved At', type: 'datetime' },
            { header: 'ProgressApprovedBy', label: 'Approved By', type: 'text' },
            { header: 'ProgressApprovedComment', label: 'Approved Comment', type: 'textarea' },
            { header: 'Country', label: 'Country', type: 'text' },
            { header: 'Province', label: 'Province', type: 'text' },
            { header: 'City', label: 'City', type: 'text' },
            { header: 'Area', label: 'Area', type: 'text' },
            { header: 'AccessRegion', label: 'Access Region', type: 'text' },
            { header: 'Status', label: 'Status', type: 'status', required: true }
        ]),
        IncludeInAuthorizationPayload: 'TRUE',
        Functional: 'FALSE',
        PreAction: '',
        PostAction: '',
        Reports: '',
        CustomUIName: '',
        ListViews: JSON.stringify([
            { "name": "RecentlyFollowedUp", "label": "Recently Followed Up", "icon": "history", "color": "primary", "default": true, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Status", "operator": "eq", "value": "Active" }] } },
            { "name": "Draft", "label": "Draft", "icon": "edit_note", "color": "grey-7", "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "Draft" }] } },
            { "name": "Processing", "label": "Processing", "icon": "autorenew", "color": "primary", "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "Processing" }] } },
            { "name": "OldLeads", "label": "Old Leads", "icon": "schedule", "color": "amber-8", "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "Processing" }] } },
            { "name": "Rejected", "label": "Rejected", "icon": "cancel", "color": "negative", "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "Rejected" }] } },
            { "name": "Later", "label": "Later", "icon": "schedule", "color": "warning", "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "Later" }] } },
            { "name": "Approved", "label": "Approved", "icon": "verified", "color": "positive", "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "Approved" }] } }
        ])
    },
    {
        Name: CONFIG.OPERATION_SHEETS.PROCUREMENTS,
        Scope: 'operation',
        IsActive: 'TRUE',
        SheetName: CONFIG.OPERATION_SHEETS.PROCUREMENTS,
        CodePrefix: 'PRC',
        CodeSequenceLength: 5,
        LastDataUpdatedAt: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'CreatedUser,CreatedRole',
        UniqueHeaders: '',
        UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Active","Progress":"INITIATED"}',
        RecordAccessPolicy: 'OWNER_AND_UPLINE',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: '',
        Menu: JSON.stringify([{"group":["Procurement"],"order":0,"label":"Procurements","icon":"shopping_cart","route":"/operation/procurements","pageTitle":"Procurements","pageDescription":"Central tracked procurement request","show":false}]),
        UIFields: JSON.stringify([
            { header: 'Progress', label: 'Progress', type: 'status' },
            { header: 'InitiatedDate', label: 'Initiated Date', type: 'date' },
            { header: 'CreatedUser', label: 'Created User', type: 'text' },
            { header: 'CreatedRole', label: 'Created Role', type: 'text' },
            { header: 'Status', label: 'Status', type: 'status' },
            { header: 'AccessRegion', label: 'Access Region', type: 'text' }
        ]),
        IncludeInAuthorizationPayload: 'TRUE',
        Functional: 'FALSE',
        PreAction: '',
        PostAction: 'linkProcurementCodeToPurchaseRequisition',
        Reports: '',
        CustomUIName: '',
        ListViews: JSON.stringify([
            { "name": "InFlight", "label": "In Flight", "icon": "sync", "color": "primary", "default": true, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "nin", "value": ["COMPLETED", "CANCELLED"] }] } },
            { "name": "Completed", "label": "Completed", "icon": "task_alt", "color": "positive", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "COMPLETED" }] } },
            { "name": "Cancelled", "label": "Cancelled", "icon": "block", "color": "negative", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "CANCELLED" }] } }
        ])
    },
    {
        Name: CONFIG.OPERATION_SHEETS.PURCHASE_REQUISITIONS,
        Scope: 'operation',
        ParentResource: '',
        IsActive: 'TRUE',
        SheetName: CONFIG.OPERATION_SHEETS.PURCHASE_REQUISITIONS,
        CodePrefix: 'PR',
        CodeSequenceLength: 6,
        LastDataUpdatedAt: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'Type,Priority',
        UniqueHeaders: '',
        UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Active","Progress":"Draft"}',
        RecordAccessPolicy: 'OWNER_AND_UPLINE',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: JSON.stringify([
            {"action":"Approve","label":"Approve","icon":"check_circle","color":"primary","kind":"mutate","confirm":false,"column":"Progress","columnValue":"Approved","columnValueOptions":[],"fields":[],"visibleWhen":{"column":"Progress","op":"eq","value":"Pending Approval"}},
            {"action":"Reject","label":"Reject","icon":"cancel","color":"warning","kind":"mutate","confirm":false,"column":"Progress","columnValue":"Rejected","columnValueOptions":[],"fields":[{"name":"Comment","label":"Comment","type":"textarea","required":true}],"visibleWhen":{"column":"Progress","op":"eq","value":"Pending Approval"}},
            {"action":"SendBack","label":"Request Revision","icon":"undo","color":"info","kind":"mutate","confirm":false,"column":"Progress","columnValue":"Revision Required","columnValueOptions":[],"fields":[{"name":"Comment","label":"Comment","type":"textarea","required":true}],"visibleWhen":{"column":"Progress","op":"eq","value":"Pending Approval"}},
            {"action":"Review","label":"Review Requisition","icon":"rate_review","color":"primary","kind":"navigate","confirm":false,"navigate":{"target":"record","pageSlug":"review"},"visibleWhen":{"column":"Progress","op":"eq","value":"Pending Approval"}}
        ]),
        Menu: JSON.stringify([
            {"group":["Procurement"],"order":2,"label":"Requisitions","icon":"request_quote","route":"/operation/purchase-requisitions","pageTitle":"Purchase Requisitions","pageDescription":"Internal requests for purchase","show":true},
            {"group":["Procurement"],"order":3,"label":"Initiate Purchase Requisitions","icon":"request_quote","route":"/operation/purchase-requisitions/initiate-purchase-requisitions","pageTitle":"Purchase Requisitions","pageDescription":"Initiate Purchase Requisition","show":true,"menuAccess":{"require":"canWrite"}}
        ]),
        UIFields: JSON.stringify([
            { header: 'ProcurementCode', label: 'Procurement Code', type: 'text' },
            { header: 'PRDate', label: 'PR Date', type: 'date' },
            { header: 'Type', label: 'Type', type: 'select' },
            { header: 'Priority', label: 'Priority', type: 'select' },
            { header: 'RequiredDate', label: 'Required Date', type: 'date' },
            { header: 'WarehouseCode', label: 'Warehouse Code', type: 'text' },
            { header: 'TypeReferenceCode', label: 'Type Reference Code', type: 'text' },
            { header: 'Progress', label: 'Progress', type: 'status' },
            { header: 'ProgressRevisionRequiredAt', label: 'Revision Required At', type: 'datetime' },
            { header: 'ProgressRevisionRequiredBy', label: 'Revision Required By', type: 'text' },
            { header: 'ProgressRevisionRequiredComment', label: 'Revision Required Comment', type: 'textarea' },
            { header: 'ProgressApprovedAt', label: 'Approved At', type: 'datetime' },
            { header: 'ProgressApprovedBy', label: 'Approved By', type: 'text' },
            { header: 'ProgressApprovedComment', label: 'Approved Comment', type: 'textarea' },
            { header: 'ProgressRejectedAt', label: 'Rejected At', type: 'datetime' },
            { header: 'ProgressRejectedBy', label: 'Rejected By', type: 'text' },
            { header: 'ProgressRejectedComment', label: 'Rejected Comment', type: 'textarea' },
            { header: 'Status', label: 'Status', type: 'status' },
            { header: 'AccessRegion', label: 'Access Region', type: 'text' }
        ]),
        IncludeInAuthorizationPayload: 'TRUE',
        Functional: 'FALSE',
        PreAction: '',
        PostAction: '',
        Reports: '',
        CustomUIName: '',
        ListViews: JSON.stringify([
            { "name": "Drafts", "label": "My Drafts", "icon": "edit_note", "color": "grey-7", "default": true, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "Draft" }] } },
            { "name": "PendingApproval", "label": "Awaiting Approval", "icon": "hourglass_top", "color": "warning", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "Pending Approval" }] } },
            { "name": "NeedsRevision", "label": "Needs Revision", "icon": "rate_review", "color": "orange", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "Revision Required" }] } },
            { "name": "Approved", "label": "Approved", "icon": "task_alt", "color": "primary", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "Approved" }] } },
            { "name": "RfqProcessed", "label": "RFQ Processed", "icon": "request_quote", "color": "positive", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "RFQ Processed" }] } },
            { "name": "Rejected", "label": "Rejected", "icon": "block", "color": "negative", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "Rejected" }] } }
        ]),
        Relations: JSON.stringify({
            WarehouseCode: CONFIG.MASTER_SHEETS.WAREHOUSES
        })
    },
    {
        Name: CONFIG.OPERATION_SHEETS.PURCHASE_REQUISITION_ITEMS,
        Scope: 'operation',
        ParentResource: CONFIG.OPERATION_SHEETS.PURCHASE_REQUISITIONS,
        IsActive: 'TRUE',
        SheetName: CONFIG.OPERATION_SHEETS.PURCHASE_REQUISITION_ITEMS,
        CodePrefix: 'PRI',
        CodeSequenceLength: 7,
        LastDataUpdatedAt: 0,
        Audit: 'FALSE',
        RequiredHeaders: 'Code,PurchaseRequisitionCode,SKU,UOM,Quantity',
        UniqueHeaders: 'Code',
        UniqueCompositeHeaders: '',
        DefaultValues: '{"Quantity":0,"EstimatedRate":0}',
        RecordAccessPolicy: 'OWNER_AND_UPLINE',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: '',
        Menu: JSON.stringify([]),
        UIFields: JSON.stringify([
            { header: 'PurchaseRequisitionCode', label: 'Purchase Requisition Code', type: 'text' },
            { header: 'SKU', label: 'SKU', type: 'text' },
            { header: 'UOM', label: 'Unit of Measure', type: 'text' },
            { header: 'Quantity', label: 'Quantity', type: 'number' },
            { header: 'EstimatedRate', label: 'Estimated Rate', type: 'currency' }
        ]),
        IncludeInAuthorizationPayload: 'TRUE',
        Functional: 'FALSE',
        PreAction: '',
        PostAction: '',
        Reports: '',
        CustomUIName: '',
        ListViews: '',
        Relations: JSON.stringify({
            SKU: { resource: CONFIG.MASTER_SHEETS.SKUS, targetHeader: 'Code', labelHeader: '$product.Name' },
            UOM: CONFIG.MASTER_SHEETS.UOMS
        })
    },
    {
        Name: CONFIG.OPERATION_SHEETS.RFQS,
        Scope: 'operation',
        ParentResource: '',
        IsActive: 'TRUE',
        SheetName: CONFIG.OPERATION_SHEETS.RFQS,
        CodePrefix: 'RFQ',
        CodeSequenceLength: 5,
        LastDataUpdatedAt: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'ProcurementCode',
        UniqueHeaders: '',
        UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Active","Progress":"DRAFT"}',
        RecordAccessPolicy: 'OWNER_AND_UPLINE',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: JSON.stringify([
            {"action":"AssignSupplier","label":"Assign Supplier","icon":"group_add","color":"primary","kind":"navigate","confirm":false,"navigate":{"target":"record","pageSlug":"assign-supplier"},"visibleWhen":{"column":"Progress","op":"nin","value":["CLOSED","CANCELLED"]}},
            {"action":"MarkAsSent","label":"Mark As Sent","icon":"send","color":"secondary","kind":"navigate","confirm":false,"navigate":{"target":"record","pageSlug":"mark-as-sent"},"visibleWhen":{"column":"Progress","op":"nin","value":["CLOSED","CANCELLED"]}},
            {"action":"Close","label":"Close RFQ","icon":"lock","color":"negative","kind":"mutate","confirm":true,"column":"Progress","columnValue":"CLOSED","columnValueOptions":[],"fields":[],"visibleWhen":{"column":"Progress","op":"eq","value":"SENT"}}
        ]),
        Menu: JSON.stringify([
            {"group":["Procurement"],"order":4,"label":"Request For Quotations","icon":"request_quote","route":"/operation/rfqs","pageTitle":"Request for Quotations","pageDescription":"Manage requests for quotation","show":true}
        ]),
        UIFields: JSON.stringify([
            { header: 'ProcurementCode', label: 'Procurement Code', type: 'text' },
            { header: 'PurchaseRequisitionCode', label: 'Purchase Requisition Code', type: 'text' },
            { header: 'PurchaseRequisitionItemsCode', label: 'Purchase Requisition Items Code', type: 'textarea' },
            { header: 'RFQDate', label: 'RFQ Date', type: 'date' },
            { header: 'LeadTimeDays', label: 'Lead Time Days', type: 'number' },
            { header: 'LeadTimeType', label: 'Lead Time Type', type: 'select' },
            { header: 'ShippingTermMode', label: 'Shipping Term Mode', type: 'select' },
            { header: 'ShippingTerm', label: 'Shipping Term', type: 'text' },
            { header: 'PaymentTermMode', label: 'Payment Term Mode', type: 'select' },
            { header: 'PaymentTerm', label: 'Payment Term', type: 'text' },
            { header: 'PaymentTermDetail', label: 'Payment Term Detail', type: 'textarea' },
            { header: 'QuotationValidityDays', label: 'Quotation Validity Days', type: 'number' },
            { header: 'QuotationValidityMode', label: 'Quotation Validity Mode', type: 'select' },
            { header: 'DeliveryMode', label: 'Delivery Mode', type: 'select' },
            { header: 'AllowPartialDelivery', label: 'Allow Partial Delivery', type: 'text' },
            { header: 'AllowSplitShipment', label: 'Allow Split Shipment', type: 'text' },
            { header: 'SubmissionDeadline', label: 'Submission Deadline', type: 'date' },
            { header: 'Progress', label: 'Progress', type: 'status' },
            { header: 'ProgressClosedComment', label: 'Closed Comment', type: 'textarea' },
            { header: 'ProgressClosedAt', label: 'Closed At', type: 'datetime' },
            { header: 'ProgressClosedBy', label: 'Closed By', type: 'text' },
            { header: 'Status', label: 'Status', type: 'status' },
            { header: 'AccessRegion', label: 'Access Region', type: 'text' }
        ]),
        IncludeInAuthorizationPayload: 'TRUE',
        Functional: 'FALSE',
        PreAction: '',
        PostAction: '',
        Reports: '',
        CustomUIName: '',
        ListViews: JSON.stringify([
            { "name": "Drafts", "label": "Drafts", "icon": "edit_note", "color": "grey-7", "default": true, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "DRAFT" }] } },
            { "name": "Sent", "label": "Out for Quoting", "icon": "send", "color": "primary", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "SENT" }] } },
            { "name": "Closed", "label": "Closed", "icon": "lock", "color": "positive", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "CLOSED" }] } },
            { "name": "Cancelled", "label": "Cancelled", "icon": "block", "color": "negative", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "CANCELLED" }] } }
        ])
    },
    {
        Name: CONFIG.OPERATION_SHEETS.RFQ_SUPPLIERS,
        Scope: 'operation',
        ParentResource: CONFIG.OPERATION_SHEETS.RFQS,
        IsActive: 'TRUE',
        SheetName: CONFIG.OPERATION_SHEETS.RFQ_SUPPLIERS,
        CodePrefix: 'RFQS',
        CodeSequenceLength: 6,
        LastDataUpdatedAt: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'RFQCode,SupplierCode',
        UniqueHeaders: '',
        UniqueCompositeHeaders: 'RFQCode+SupplierCode',
        DefaultValues: '{"Status":"Active","Progress":"ASSIGNED"}',
        RecordAccessPolicy: 'OWNER_AND_UPLINE',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: '',
        Menu: JSON.stringify([]),
        UIFields: JSON.stringify([
            { header: 'ProcurementCode', label: 'Procurement Code', type: 'text' },
            { header: 'RFQCode', label: 'RFQ Code', type: 'text' },
            { header: 'SupplierCode', label: 'Supplier Code', type: 'text' },
            { header: 'SentDate', label: 'Sent Date', type: 'date' },
            { header: 'Progress', label: 'Progress', type: 'status' },
            { header: 'Status', label: 'Status', type: 'status' },
            { header: 'AccessRegion', label: 'Access Region', type: 'text' }
        ]),
        IncludeInAuthorizationPayload: 'TRUE',
        Functional: 'FALSE',
        PreAction: '',
        PostAction: '',
        Reports: '',
        CustomUIName: '',
        ListViews: '',
        Relations: JSON.stringify({
            SupplierCode: CONFIG.MASTER_SHEETS.SUPPLIERS
        })
    },
    {
        Name: CONFIG.OPERATION_SHEETS.SUPPLIER_QUOTATIONS,
        Scope: 'operation',
        ParentResource: CONFIG.OPERATION_SHEETS.RFQS,
        IsActive: 'TRUE',
        SheetName: CONFIG.OPERATION_SHEETS.SUPPLIER_QUOTATIONS,
        CodePrefix: 'SQ',
        CodeSequenceLength: 5,
        LastDataUpdatedAt: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'RFQCode,SupplierCode',
        UniqueHeaders: '',
        UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Active","Progress":"RECEIVED","TotalAmount":0,"Currency":"AED","ExtraChargesBreakup":"{\\"tax\\":0,\\"freight\\":0,\\"commission\\":0,\\"handling\\":0,\\"other\\":0}","AllowPartialPO":"TRUE"}',
        RecordAccessPolicy: 'OWNER_AND_UPLINE',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: JSON.stringify([
            {"action":"Reject","label":"Reject","icon":"block","color":"negative","kind":"mutate","confirm":false,"column":"Progress","columnValue":"REJECTED","columnValueOptions":[],"fields":[{"name":"Comment","label":"Rejection Comment","type":"textarea","required":true}],"visibleWhen":{"column":"Progress","op":"eq","value":"RECEIVED"}}
        ]),
        Menu: JSON.stringify([
            {"group":["Procurement"],"order":5,"label":"Supplier Quotations","icon":"request_quote","route":"/operation/supplier-quotations","pageTitle":"Supplier Quotations","pageDescription":"Record and manage supplier quotation responses","show":true}
        ]),
        UIFields: JSON.stringify([
            { header: 'ProcurementCode', label: 'Procurement Code', type: 'text' },
            { header: 'RFQCode', label: 'RFQ Code', type: 'text' },
            { header: 'SupplierCode', label: 'Supplier Code', type: 'text' },
            { header: 'ResponseType', label: 'Response Type', type: 'select' },
            { header: 'ResponseDate', label: 'Response Date', type: 'date' },
            { header: 'DeclineReason', label: 'Decline Reason', type: 'textarea' },
            { header: 'AllowPartialPO', label: 'Allow Partial PO', type: 'text' },
            { header: 'SupplierQuotationReference', label: 'Supplier Quotation Reference', type: 'text' },
            { header: 'LeadTimeDays', label: 'Lead Time Days', type: 'number' },
            { header: 'LeadTimeType', label: 'Lead Time Type', type: 'select' },
            { header: 'DeliveryMode', label: 'Delivery Mode', type: 'select' },
            { header: 'AllowPartialDelivery', label: 'Allow Partial Delivery', type: 'text' },
            { header: 'AllowSplitShipment', label: 'Allow Split Shipment', type: 'text' },
            { header: 'ShippingTerm', label: 'Shipping Term', type: 'select' },
            { header: 'PaymentTerm', label: 'Payment Term', type: 'select' },
            { header: 'PaymentTermDetail', label: 'Payment Term Detail', type: 'textarea' },
            { header: 'QuotationValidityDays', label: 'Quotation Validity Days', type: 'number' },
            { header: 'ValidUntilDate', label: 'Valid Until Date', type: 'date' },
            { header: 'Currency', label: 'Currency', type: 'select' },
            { header: 'TotalAmount', label: 'Total Amount', type: 'currency' },
            { header: 'ExtraChargesBreakup', label: 'Extra Charges Breakup', type: 'textarea' },
            { header: 'Remarks', label: 'Remarks', type: 'textarea' },
            { header: 'Progress', label: 'Progress', type: 'status' },
            { header: 'ProgressRejectedComment', label: 'Rejected Comment', type: 'textarea' },
            { header: 'ProgressRejectedAt', label: 'Rejected At', type: 'datetime' },
            { header: 'ProgressRejectedBy', label: 'Rejected By', type: 'text' },
            { header: 'ResponseRecordedAt', label: 'Response Recorded At', type: 'datetime' },
            { header: 'ResponseRecordedBy', label: 'Response Recorded By', type: 'text' },
            { header: 'Status', label: 'Status', type: 'status' },
            { header: 'AccessRegion', label: 'Access Region', type: 'text' }
        ]),
        IncludeInAuthorizationPayload: 'TRUE',
        Functional: 'FALSE',
        PreAction: '',
        PostAction: '',
        Reports: '',
        CustomUIName: '',
        ListViews: JSON.stringify([
            { "name": "Received", "label": "Awaiting Decision", "icon": "mark_email_read", "color": "warning", "default": true, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "RECEIVED" }] } },
            { "name": "Accepted", "label": "Accepted", "icon": "verified", "color": "positive", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "ACCEPTED" }] } },
            { "name": "Rejected", "label": "Rejected", "icon": "block", "color": "negative", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "REJECTED" }] } }
        ]),
        Relations: JSON.stringify({
            SupplierCode: CONFIG.MASTER_SHEETS.SUPPLIERS,
            Currency: CONFIG.MASTER_SHEETS.CURRENCIES
        })
    },
    {
        Name: CONFIG.OPERATION_SHEETS.SUPPLIER_QUOTATION_ITEMS,
        Scope: 'operation',
        ParentResource: CONFIG.OPERATION_SHEETS.SUPPLIER_QUOTATIONS,
        IsActive: 'TRUE',
        SheetName: CONFIG.OPERATION_SHEETS.SUPPLIER_QUOTATION_ITEMS,
        CodePrefix: 'SQI',
        CodeSequenceLength: 6,
        LastDataUpdatedAt: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'SupplierQuotationCode,SKU',
        UniqueHeaders: '',
        UniqueCompositeHeaders: 'SupplierQuotationCode+PurchaseRequisitionItemCode',
        DefaultValues: '{"Status":"Active"}',
        RecordAccessPolicy: 'OWNER_AND_UPLINE',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: '',
        Menu: JSON.stringify([]),
        UIFields: JSON.stringify([
            { header: 'SupplierQuotationCode', label: 'Supplier Quotation Code', type: 'text' },
            { header: 'PurchaseRequisitionItemCode', label: 'Purchase Requisition Item Code', type: 'text' },
            { header: 'SKU', label: 'SKU', type: 'text' },
            { header: 'Description', label: 'Description', type: 'textarea' },
            { header: 'Quantity', label: 'Quantity', type: 'number' },
            { header: 'UnitPrice', label: 'Unit Price', type: 'currency' },
            { header: 'TotalPrice', label: 'Total Price', type: 'currency' },
            { header: 'LeadTimeDays', label: 'Lead Time Days', type: 'number' },
            { header: 'DeliveryDate', label: 'Delivery Date', type: 'date' },
            { header: 'Remarks', label: 'Remarks', type: 'textarea' },
            { header: 'Status', label: 'Status', type: 'status' }
        ]),
        IncludeInAuthorizationPayload: 'TRUE',
        Functional: 'FALSE',
        PreAction: '',
        PostAction: '',
        Reports: '',
        CustomUIName: '',
        ListViews: '',
        Relations: JSON.stringify({
            SKU: { resource: CONFIG.MASTER_SHEETS.SKUS, targetHeader: 'Code', labelHeader: '$product.Name' }
        })
    },
    {
        Name: CONFIG.OPERATION_SHEETS.PURCHASE_ORDERS,
        Scope: 'operation',
        ParentResource: '',
        IsActive: 'TRUE',
        SheetName: CONFIG.OPERATION_SHEETS.PURCHASE_ORDERS,
        CodePrefix: 'PO',
        CodeSequenceLength: 5,
        LastDataUpdatedAt: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'ProcurementCode,SupplierQuotationCode,SupplierCode,PODate,ShipToWarehouseCode',
        UniqueHeaders: '',
        UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Active","Progress":"CREATED","Currency":"AED","SubtotalAmount":0,"TotalAmount":0,"ExtraChargesBreakup":"{\\"tax\\":0,\\"freight\\":0,\\"commission\\":0,\\"handling\\":0,\\"other\\":0}"}',
        RecordAccessPolicy: 'OWNER_AND_UPLINE',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: JSON.stringify([
            {"action":"Send","label":"Send","icon":"send","color":"primary","kind":"mutate","confirm":false,"column":"Progress","columnValue":"SENT","columnValueOptions":[],"fields":[{"name":"Comment","label":"Comment","type":"textarea","required":false}],"visibleWhen":{"column":"Progress","op":"eq","value":"CREATED"}},
            {"action":"Acknowledge","label":"Acknowledge","icon":"done","color":"info","kind":"mutate","confirm":false,"column":"Progress","columnValue":"ACKNOWLEDGED","columnValueOptions":[],"fields":[{"name":"Comment","label":"Comment","type":"textarea","required":false}],"visibleWhen":{"column":"Progress","op":"eq","value":"SENT"}},
            {"action":"Accept","label":"Accept","icon":"check_circle","color":"positive","kind":"mutate","confirm":false,"column":"Progress","columnValue":"ACCEPTED","columnValueOptions":[],"fields":[{"name":"Comment","label":"Comment","type":"textarea","required":false}],"visibleWhen":{"column":"Progress","op":"eq","value":"ACKNOWLEDGED"}},
            {"action":"Cancel","label":"Cancel","icon":"cancel","color":"negative","kind":"navigate","confirm":false,"column":"Progress","columnValue":"CANCELLED","columnValueOptions":[],"fields":[{"name":"Comment","label":"Cancel Comment","type":"textarea","required":true}],"navigate":{"target":"record","pageSlug":"cancel-order"},"visibleWhen":{"column":"Progress","op":"in","value":["CREATED","SENT","ACKNOWLEDGED"]}}
        ]),
        Menu: JSON.stringify([
            {"group":["Procurement"],"order":6,"label":"Purchase Orders","icon":"receipt_long","route":"/operation/purchase-orders","pageTitle":"Purchase Orders","pageDescription":"Manage purchase orders","show":true,"menuAccess":{"require":"canWrite"}}
        ]),
        UIFields: JSON.stringify([
            { header: 'ProcurementCode', label: 'Procurement Code', type: 'text' },
            { header: 'SupplierQuotationCode', label: 'Supplier Quotation Code', type: 'text' },
            { header: 'SupplierCode', label: 'Supplier Code', type: 'text' },
            { header: 'PODate', label: 'PO Date', type: 'date' },
            { header: 'ShipToWarehouseCode', label: 'Ship To Warehouse Code', type: 'text' },
            { header: 'Progress', label: 'Progress', type: 'status' },
            { header: 'ProgressSentAt', label: 'Sent At', type: 'datetime' },
            { header: 'ProgressSentBy', label: 'Sent By', type: 'text' },
            { header: 'ProgressSentComment', label: 'Sent Comment', type: 'textarea' },
            { header: 'ProgressAcknowledgedAt', label: 'Acknowledged At', type: 'datetime' },
            { header: 'ProgressAcknowledgedBy', label: 'Acknowledged By', type: 'text' },
            { header: 'ProgressAcknowledgedComment', label: 'Acknowledged Comment', type: 'textarea' },
            { header: 'ProgressAcceptedAt', label: 'Accepted At', type: 'datetime' },
            { header: 'ProgressAcceptedBy', label: 'Accepted By', type: 'text' },
            { header: 'ProgressAcceptedComment', label: 'Accepted Comment', type: 'textarea' },
            { header: 'ProgressCancelledAt', label: 'Cancelled At', type: 'datetime' },
            { header: 'ProgressCancelledBy', label: 'Cancelled By', type: 'text' },
            { header: 'ProgressCancelledComment', label: 'Cancelled Comment', type: 'textarea' },
            { header: 'Currency', label: 'Currency', type: 'select' },
            { header: 'SubtotalAmount', label: 'Subtotal Amount', type: 'currency' },
            { header: 'ExtraChargesBreakup', label: 'Extra Charges Breakup', type: 'textarea' },
            { header: 'TotalAmount', label: 'Total Amount', type: 'currency' },
            { header: 'Remarks', label: 'Remarks', type: 'textarea' },
            { header: 'Status', label: 'Status', type: 'status' },
            { header: 'AccessRegion', label: 'Access Region', type: 'text' }
        ]),
        IncludeInAuthorizationPayload: 'TRUE',
        Functional: 'FALSE',
        PreAction: '',
        PostAction: '',
        Reports: '',
        CustomUIName: '',
        ListViews: JSON.stringify([
            { "name": "Open", "label": "Open Orders", "icon": "receipt_long", "color": "primary", "default": true, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "in", "value": ["CREATED", "SENT", "ACKNOWLEDGED"] }] } },
            { "name": "Receiving", "label": "Goods Receiving", "icon": "inventory_2", "color": "orange", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "in", "value": ["ACCEPTED", "GOODS_RECEIVING"] }] } },
            { "name": "Completed", "label": "Completed", "icon": "task_alt", "color": "positive", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "in", "value": ["GRN_GENERATED", "COMPLETED", "CLOSED"] }] } },
            { "name": "Cancelled", "label": "Cancelled", "icon": "block", "color": "negative", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "CANCELLED" }] } }
        ]),
        Relations: JSON.stringify({
            SupplierCode: CONFIG.MASTER_SHEETS.SUPPLIERS,
            ShipToWarehouseCode: CONFIG.MASTER_SHEETS.WAREHOUSES,
            Currency: CONFIG.MASTER_SHEETS.CURRENCIES
        })
    },
    {
        Name: CONFIG.OPERATION_SHEETS.PURCHASE_ORDER_ITEMS,
        Scope: 'operation',
        ParentResource: CONFIG.OPERATION_SHEETS.PURCHASE_ORDERS,
        IsActive: 'TRUE',
        SheetName: CONFIG.OPERATION_SHEETS.PURCHASE_ORDER_ITEMS,
        CodePrefix: 'POI',
        CodeSequenceLength: 6,
        LastDataUpdatedAt: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'PurchaseOrderCode,SupplierQuotationItemCode,SKU,OrderedQuantity',
        UniqueHeaders: '',
        UniqueCompositeHeaders: 'PurchaseOrderCode+SupplierQuotationItemCode',
        DefaultValues: '{"Status":"Active"}',
        RecordAccessPolicy: 'OWNER_AND_UPLINE',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: '',
        Menu: JSON.stringify([]),
        UIFields: JSON.stringify([
            { header: 'PurchaseOrderCode', label: 'Purchase Order Code', type: 'text' },
            { header: 'SupplierQuotationItemCode', label: 'Supplier Quotation Item Code', type: 'text' },
            { header: 'SKU', label: 'SKU', type: 'text' },
            { header: 'Description', label: 'Description', type: 'textarea' },
            { header: 'UOM', label: 'Unit of Measure', type: 'text' },
            { header: 'QuotedQuantity', label: 'Quoted Quantity', type: 'number' },
            { header: 'OrderedQuantity', label: 'Ordered Quantity', type: 'number' },
            { header: 'UnitPrice', label: 'Unit Price', type: 'currency' },
            { header: 'SupplierItemCode', label: 'Supplier Item Code', type: 'text' },
            { header: 'Remarks', label: 'Remarks', type: 'textarea' },
            { header: 'Status', label: 'Status', type: 'status' }
        ]),
        IncludeInAuthorizationPayload: 'TRUE',
        Functional: 'FALSE',
        PreAction: '',
        PostAction: '',
        Reports: '',
        CustomUIName: '',
        ListViews: '',
        Relations: JSON.stringify({
            SKU: { resource: CONFIG.MASTER_SHEETS.SKUS, targetHeader: 'Code', labelHeader: '$product.Name' },
            UOM: CONFIG.MASTER_SHEETS.UOMS
        })
    },
    {
        Name: CONFIG.OPERATION_SHEETS.PO_RECEIVINGS,
        Scope: 'operation',
        ParentResource: CONFIG.OPERATION_SHEETS.PURCHASE_ORDERS,
        IsActive: 'TRUE',
        SheetName: CONFIG.OPERATION_SHEETS.PO_RECEIVINGS,
        CodePrefix: 'POR',
        CodeSequenceLength: 5,
        LastDataUpdatedAt: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'ProcurementCode,PurchaseOrderCode,InspectionDate,InspectedUserName,Progress,Status',
        UniqueHeaders: '',
        UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Active","Progress":"DRAFT"}',
        RecordAccessPolicy: 'OWNER_AND_UPLINE',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: JSON.stringify([
            {"action":"Confirm","label":"Confirm","icon":"task_alt","color":"positive","kind":"mutate","confirm":false,"column":"Progress","columnValue":"CONFIRMED","columnValueOptions":[],"fields":[{"name":"Comment","label":"Confirmation Comment","type":"textarea","required":false}],"visibleWhen":{"column":"Progress","op":"eq","value":"DRAFT"}},
            {"action":"GenerateGRN","label":"Generate GRN","icon":"receipt_long","color":"primary","kind":"navigate","confirm":false,"navigate":{"target":"record","pageSlug":"generate-grn"},"column":"Progress","columnValue":"GRN_GENERATED","columnValueOptions":[],"fields":[{"name":"Comment","label":"GRN Generation Comment","type":"textarea","required":false}],"targets":[{"resource":"GoodsReceipts","mode":"create","key":"goodsReceipt","label":"Goods Receipt","fields":[{"name":"ProcurementCode","from":"$record.ProcurementCode"},{"name":"PurchaseOrderCode","from":"$record.PurchaseOrderCode"},{"name":"POReceivingCode","from":"$record.Code"},{"name":"Date","value":"$today"},{"name":"Status","value":"Active"}]}],"visibleWhen":{"column":"Progress","op":"eq","value":"CONFIRMED"}},
            {"action":"Cancel","label":"Cancel","icon":"cancel","color":"negative","kind":"navigate","confirm":false,"column":"Progress","columnValue":"CANCELLED","columnValueOptions":[],"fields":[{"name":"Comment","label":"Cancellation Comment","type":"textarea","required":true}],"navigate":{"target":"record","pageSlug":"cancel-receiving"},"visibleWhen":{"column":"Progress","op":"in","value":["DRAFT","CONFIRMED","GRN_GENERATED"]}}
        ]),
        Menu: JSON.stringify([
            {"group":["Procurement"],"order":7,"label":"PO Receiving","icon":"inventory_2","route":"/operation/po-receivings","pageTitle":"PO Receiving","pageDescription":"Inspect received purchase order quantities before GRN finalization","show":true,"menuAccess":{"require":"canWrite"}}
        ]),
        UIFields: JSON.stringify([
            { header: 'ProcurementCode', label: 'Procurement Code', type: 'text' },
            { header: 'PurchaseOrderCode', label: 'Purchase Order Code', type: 'text' },
            { header: 'InspectionDate', label: 'Inspection Date', type: 'date' },
            { header: 'InspectedUserName', label: 'Inspected User Name', type: 'text' },
            { header: 'Progress', label: 'Progress', type: 'status' },
            { header: 'ProgressConfirmedAt', label: 'Confirmed At', type: 'datetime' },
            { header: 'ProgressConfirmedBy', label: 'Confirmed By', type: 'text' },
            { header: 'ProgressConfirmedComment', label: 'Confirmed Comment', type: 'textarea' },
            { header: 'ProgressCancelledAt', label: 'Cancelled At', type: 'datetime' },
            { header: 'ProgressCancelledBy', label: 'Cancelled By', type: 'text' },
            { header: 'ProgressCancelledComment', label: 'Cancelled Comment', type: 'textarea' },
            { header: 'ProgressGRNGeneratedAt', label: 'GRN Generated At', type: 'datetime' },
            { header: 'ProgressGRNGeneratedBy', label: 'GRN Generated By', type: 'text' },
            { header: 'ProgressGRNGeneratedComment', label: 'GRN Generated Comment', type: 'textarea' },
            { header: 'Remarks', label: 'Remarks', type: 'textarea' },
            { header: 'Status', label: 'Status', type: 'status' },
            { header: 'AccessRegion', label: 'Access Region', type: 'text' }
        ]),
        IncludeInAuthorizationPayload: 'TRUE',
        Functional: 'FALSE',
        PreAction: '',
        PostAction: '',
        Reports: '',
        CustomUIName: '',
        ListViews: JSON.stringify([
            { "name": "Drafts", "label": "In Progress", "icon": "edit_note", "color": "blue-grey", "default": true, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "DRAFT" }] } },
            { "name": "Confirmed", "label": "Awaiting GRN", "icon": "task_alt", "color": "primary", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "CONFIRMED" }] } },
            { "name": "GrnGenerated", "label": "GRN Generated", "icon": "receipt_long", "color": "positive", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "GRN_GENERATED" }] } },
            { "name": "Cancelled", "label": "Cancelled", "icon": "block", "color": "negative", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "CANCELLED" }] } }
        ])
    },
    {
        Name: CONFIG.OPERATION_SHEETS.PO_RECEIVING_ITEMS,
        Scope: 'operation',
        ParentResource: CONFIG.OPERATION_SHEETS.PO_RECEIVINGS,
        IsActive: 'TRUE',
        SheetName: CONFIG.OPERATION_SHEETS.PO_RECEIVING_ITEMS,
        CodePrefix: 'PORI',
        CodeSequenceLength: 6,
        LastDataUpdatedAt: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'POReceivingCode,PurchaseOrderItemCode,SKU,Status',
        UniqueHeaders: '',
        UniqueCompositeHeaders: 'POReceivingCode+PurchaseOrderItemCode',
        DefaultValues: '{"Status":"Active","ReceivedQty":0,"DamagedQty":0,"RejectedQty":0}',
        RecordAccessPolicy: 'OWNER_AND_UPLINE',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: '',
        Menu: JSON.stringify([]),
        UIFields: JSON.stringify([
            { header: 'POReceivingCode', label: 'PO Receiving Code', type: 'text' },
            { header: 'PurchaseOrderItemCode', label: 'Purchase Order Item Code', type: 'text' },
            { header: 'SKU', label: 'SKU', type: 'text' },
            { header: 'ExpectedQty', label: 'Expected Qty', type: 'number' },
            { header: 'ReceivedQty', label: 'Received Qty', type: 'number' },
            { header: 'DamagedQty', label: 'Damaged Qty', type: 'number' },
            { header: 'RejectedQty', label: 'Rejected Qty', type: 'number' },
            { header: 'RejectedReason', label: 'Rejected Reason', type: 'textarea' },
            { header: 'Remarks', label: 'Remarks', type: 'textarea' },
            { header: 'Status', label: 'Status', type: 'status' }
        ]),
        IncludeInAuthorizationPayload: 'TRUE',
        Functional: 'FALSE',
        PreAction: '',
        PostAction: '',
        Reports: '',
        CustomUIName: '',
        ListViews: '',
        Relations: JSON.stringify({
            SKU: { resource: CONFIG.MASTER_SHEETS.SKUS, targetHeader: 'Code', labelHeader: '$product.Name' }
        })
    },
    {
        Name: CONFIG.OPERATION_SHEETS.GOODS_RECEIPTS,
        Scope: 'operation',
        ParentResource: CONFIG.OPERATION_SHEETS.PO_RECEIVINGS,
        IsActive: 'TRUE',
        SheetName: CONFIG.OPERATION_SHEETS.GOODS_RECEIPTS,
        CodePrefix: 'GRN',
        CodeSequenceLength: 5,
        LastDataUpdatedAt: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'ProcurementCode,PurchaseOrderCode,POReceivingCode,Date,Status',
        UniqueHeaders: '',
        UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Active"}',
        RecordAccessPolicy: 'OWNER_AND_UPLINE',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: JSON.stringify([
            {"action":"Invalidate","label":"Invalidate","icon":"block","color":"negative","kind":"mutate","confirm":true,"column":"Status","columnValue":"Inactive","columnValueOptions":[],"fields":[],"visibleWhen":{"column":"Status","op":"eq","value":"Active"}}
        ]),
        Menu: JSON.stringify([
            {"group":["Procurement"],"order":8,"label":"Goods Receipts","icon":"fact_check","route":"/operation/goods-receipts","pageTitle":"Goods Receipts","pageDescription":"View finalized GRNs generated from PO Receiving","show":true}
        ]),
        UIFields: JSON.stringify([
            { header: 'ProcurementCode', label: 'Procurement Code', type: 'text' },
            { header: 'PurchaseOrderCode', label: 'Purchase Order Code', type: 'text' },
            { header: 'POReceivingCode', label: 'PO Receiving Code', type: 'text' },
            { header: 'Date', label: 'Date', type: 'date' },
            { header: 'Status', label: 'Status', type: 'status' },
            { header: 'AccessRegion', label: 'Access Region', type: 'text' }
        ]),
        IncludeInAuthorizationPayload: 'TRUE',
        Functional: 'FALSE',
        PreAction: '',
        PostAction: '',
        Reports: '',
        CustomUIName: '',
        ListViews: JSON.stringify([
            { "name": "Active", "label": "Valid Receipts", "icon": "fact_check", "color": "positive", "default": true, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Status", "operator": "eq", "value": "Active" }] } },
            { "name": "Invalidated", "label": "Invalidated", "icon": "block", "color": "negative", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Status", "operator": "eq", "value": "Inactive" }] } }
        ])
    },
    {
        Name: CONFIG.OPERATION_SHEETS.GOODS_RECEIPT_ITEMS,
        Scope: 'operation',
        ParentResource: CONFIG.OPERATION_SHEETS.GOODS_RECEIPTS,
        IsActive: 'TRUE',
        SheetName: CONFIG.OPERATION_SHEETS.GOODS_RECEIPT_ITEMS,
        CodePrefix: 'GRNI',
        CodeSequenceLength: 6,
        LastDataUpdatedAt: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'GoodsReceiptCode,POReceivingItemCode,SKU,Qty,Status',
        UniqueHeaders: '',
        UniqueCompositeHeaders: 'GoodsReceiptCode+POReceivingItemCode',
        DefaultValues: '{"Status":"Active"}',
        RecordAccessPolicy: 'OWNER_AND_UPLINE',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: '',
        Menu: JSON.stringify([]),
        UIFields: JSON.stringify([
            { header: 'GoodsReceiptCode', label: 'Goods Receipt Code', type: 'text' },
            { header: 'POReceivingItemCode', label: 'PO Receiving Item Code', type: 'text' },
            { header: 'SKU', label: 'SKU', type: 'text' },
            { header: 'Qty', label: 'Qty', type: 'number' },
            { header: 'Status', label: 'Status', type: 'status' }
        ]),
        IncludeInAuthorizationPayload: 'TRUE',
        Functional: 'FALSE',
        PreAction: '',
        PostAction: '',
        Reports: '',
        CustomUIName: '',
        ListViews: '',
        Relations: JSON.stringify({
            SKU: { resource: CONFIG.MASTER_SHEETS.SKUS, targetHeader: 'Code', labelHeader: '$product.Name' }
        })
    },
    {
        Name: CONFIG.OPERATION_SHEETS.STOCK_MOVEMENTS,
        Scope: 'operation',
        IsActive: 'TRUE',
        SheetName: CONFIG.OPERATION_SHEETS.STOCK_MOVEMENTS,
        CodePrefix: 'STKMOV',
        CodeSequenceLength: 7,
        LastDataUpdatedAt: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'WarehouseCode,SKU,QtyChange,ReferenceType',
        UniqueHeaders: '',
        UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Active","QtyChange":0}',
        RecordAccessPolicy: 'ALL',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: JSON.stringify([
            { "action": "grn", "label": "GRN Posting", "kind": "mutate", "confirm": false, "column": "ReferenceType", "columnValue": "GRN" },
            { "action": "directEntry", "label": "Direct Entry", "kind": "mutate", "confirm": false, "column": "ReferenceType", "columnValue": "DirectEntry" },
            { "action": "stockAdjustment", "label": "Stock Adjustment", "kind": "mutate", "confirm": false, "column": "ReferenceType", "columnValue": "StockAdjustment" },
            { "action": "outletRestock", "label": "Outlet Restock", "kind": "mutate", "confirm": false, "column": "ReferenceType", "columnValue": "OutletRestock" },
            { "action": "outletReturn", "label": "Outlet Return", "kind": "mutate", "confirm": false, "column": "ReferenceType", "columnValue": "OutletReturn" },
            { "action": "warehouseTransfer", "label": "Warehouse Transfer", "kind": "mutate", "confirm": false, "column": "ReferenceType", "columnValue": "WarehouseTransfer" }
        ]),
        Menu: JSON.stringify([
            {"group":["Warehouse"],"order":2,"label":"Stock Movements","icon":"inventory","route":"/operation/stock-movements","pageTitle":"Stock Movements","pageDescription":"View stock movement records","show":true,"menuAccess":{"require":"canRead"}},
            {"group":["Warehouse"],"order":3,"label":"Direct Stock Entry","icon":"edit_note","route":"/operation/stock-movements/direct-entry","pageTitle":"Direct Stock Entry","pageDescription":"Directly enter stock quantities","show":true,"menuAccess":{"require":"canDirectEntry"}},
            {"group":["Warehouse"],"order":4,"label":"GRN Stock Entry","icon":"receipt_long","route":"/operation/stock-movements/grn-entry","pageTitle":"GRN Stock Entry","pageDescription":"Post finalized GRN quantities into warehouse stock","show":true,"menuAccess":{"require":"canGrn"}}
        ]),
        UIFields: JSON.stringify([
            { header: 'WarehouseCode', label: 'Warehouse Code', type: 'text' },
            { header: 'StorageName', label: 'Storage Name', type: 'text' },
            { header: 'SKU', label: 'SKU', type: 'text' },
            { header: 'QtyChange', label: 'Qty Change', type: 'number' },
            { header: 'ReferenceType', label: 'Reference Type', type: 'select' },
            { header: 'ReferenceCode', label: 'Reference Code', type: 'text' },
            { header: 'Status', label: 'Status', type: 'status' },
            { header: 'AccessRegion', label: 'Access Region', type: 'text' }
        ]),
        IncludeInAuthorizationPayload: 'TRUE',
        Functional: 'FALSE',
        PreAction: '',
        PostAction: 'handleStockMovementsBulkSave',
        Reports: '',
        CustomUIName: '',
        ListViews: '',
        Relations: JSON.stringify({
            WarehouseCode: CONFIG.MASTER_SHEETS.WAREHOUSES,
            SKU: { resource: CONFIG.MASTER_SHEETS.SKUS, targetHeader: 'Code', labelHeader: '$product.Name' }
        })
    },
    {
        Name: CONFIG.OPERATION_SHEETS.WAREHOUSE_STORAGES,
        Scope: 'operation',
        IsActive: 'TRUE',
        SheetName: CONFIG.OPERATION_SHEETS.WAREHOUSE_STORAGES,
        CodePrefix: 'LOC',
        CodeSequenceLength: 5,
        LastDataUpdatedAt: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'WarehouseCode,StorageName,SKU,Quantity',
        UniqueHeaders: '',
        UniqueCompositeHeaders: '',
        DefaultValues: '{"Quantity":0}',
        RecordAccessPolicy: 'ALL',
        OwnerUserField: 'UpdatedBy',
        AdditionalActions: '',
        Menu: JSON.stringify([]),
        UIFields: JSON.stringify([
            { header: 'WarehouseCode', label: 'Warehouse Code', type: 'text', required: true },
            { header: 'StorageName', label: 'Storage Name', type: 'text', required: true },
            { header: 'SKU', label: 'SKU', type: 'text', required: true },
            { header: 'Quantity', label: 'Quantity', type: 'number', required: true }
        ]),
        IncludeInAuthorizationPayload: 'TRUE',
        Functional: 'FALSE',
        PreAction: '',
        PostAction: '',
        Reports: '',
        CustomUIName: '',
        ListViews: '',
        Relations: JSON.stringify({
            WarehouseCode: CONFIG.MASTER_SHEETS.WAREHOUSES,
            SKU: { resource: CONFIG.MASTER_SHEETS.SKUS, targetHeader: 'Code', labelHeader: '$product.Name' }
        })
    },
    {
        Name: CONFIG.OPERATION_SHEETS.OUTLET_VISITS,
        Scope: 'operation', IsActive: 'TRUE', SheetName: CONFIG.OPERATION_SHEETS.OUTLET_VISITS,
        CodePrefix: 'OV', CodeSequenceLength: 6, LastDataUpdatedAt: 0, Audit: 'TRUE',
        RequiredHeaders: 'OutletCode,Date,Progress,Status', UniqueHeaders: '', UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Active","Progress":"PLANNED"}', RecordAccessPolicy: 'OWNER_AND_UPLINE', OwnerUserField: 'CreatedBy',
        AdditionalActions: JSON.stringify([
            { "action": "QuickVisit", "label": "Quick Visit", "title": "Quick Visit", "subtitle": "", "icon": "bolt", "color": "primary", "kind": "mutate", "resourceLevel": true, "confirm": false, "column": "Progress", "columnValue": "COMPLETED", "columnValueOptions": [], "fields": [{ "name": "OutletCode", "label": "Outlet", "type": "select", "source": { "resource": "Outlets", "field": "Code", "label": "Name" }, "required": true }, { "name": "Date", "value": "$today" }, { "name": "ProgressCompletedComment", "label": "Visit Notes", "type": "textarea", "required": true }, { "name": "ProgressPlannedComment", "value": "Quick visit recorded by ${$userName} on ${$dateTime}" }, { "name": "ProgressPlannedAt", "value": "$dateTime" }, { "name": "ProgressPlannedBy", "value": "$userName" }], "targets": [{ "resource": "OutletVisits", "mode": "create", "key": "nextVisit", "label": "Next Planned Visit", "when": { "field": "Date", "op": "notEmpty" }, "fields": [{ "name": "OutletCode", "from": "$record.OutletCode" }, { "name": "Progress", "value": "PLANNED" }, { "name": "Status", "value": "Active" }, { "name": "ProgressPlannedAt", "value": "$dateTime" }, { "name": "ProgressPlannedBy", "value": "$userName" }, { "name": "Date", "label": "Next Visit Date", "type": "date" }, { "name": "ProgressPlannedComment", "label": "Next Visit Planned Comment", "type": "textarea", "value": "Planned after a quick visit on ${$today}", "required": false }] }] },
            { "action": "Complete", "label": "Complete", "subtitle": "{$outlet.Name}", "icon": "task_alt", "color": "positive", "kind": "mutate", "confirm": false, "column": "Progress", "columnValue": "COMPLETED", "columnValueOptions": [], "fields": [{ "name": "Comment", "label": "Completion Comment", "type": "textarea", "required": false }], "targets": [{ "resource": "OutletVisits", "mode": "create", "key": "nextVisit", "label": "Next Planned Visit (optional)", "when": { "field": "Date", "op": "notEmpty" }, "fields": [{ "name": "OutletCode", "from": "$record.OutletCode" }, { "name": "Progress", "value": "PLANNED" }, { "name": "Status", "value": "Active" }, { "name": "ProgressPlannedAt", "value": "$dateTime" }, { "name": "ProgressPlannedBy", "value": "$userName" }, { "name": "Date", "label": "Next Visit Date", "type": "date", "value": "$date:30", "required": false }, { "name": "ProgressPlannedComment", "label": "Next Visit Planned Comment", "type": "textarea", "required": false }] }], "visibleWhen": { "column": "Progress", "op": "eq", "value": "PLANNED" } },
            { "action": "Postpone", "label": "Postpone", "subtitle": "{$outlet.Name}", "icon": "event_repeat", "color": "warning", "kind": "mutate", "confirm": false, "column": "Progress", "columnValue": "POSTPONED", "columnValueOptions": [], "fields": [{ "name": "Comment", "label": "Postpone Reason", "type": "textarea", "required": true }], "targets": [{ "resource": "OutletVisits", "mode": "create", "key": "newVisit", "label": "Rescheduled Visit", "fields": [{ "name": "OutletCode", "from": "$record.OutletCode" }, { "name": "Progress", "value": "PLANNED" }, { "name": "Status", "value": "Active" }, { "name": "ProgressPlannedAt", "value": "$dateTime" }, { "name": "ProgressPlannedBy", "value": "$userName" }, { "name": "Date", "label": "New Visit Date", "type": "date", "required": true }, { "name": "ProgressPlannedComment", "label": "Planned Comment", "type": "textarea", "from": "---POSTPONED ON ${$today}---\n${$record.ProgressPlannedComment}" }] }], "visibleWhen": { "column": "Progress", "op": "eq", "value": "PLANNED" } },
            { "action": "Cancel", "label": "Cancel", "subtitle": "{$outlet.Name}", "icon": "cancel", "color": "negative", "kind": "mutate", "confirm": false, "column": "Progress", "columnValue": "CANCELLED", "columnValueOptions": [], "fields": [{ "name": "Comment", "label": "Cancellation Reason", "type": "textarea", "required": true }], "visibleWhen": { "column": "Progress", "op": "eq", "value": "PLANNED" } }
        ]),
        Menu: JSON.stringify([{ "group": ["Field Sales"], "order": 2, "label": "Outlet Visits", "icon": "event_available", "route": "/operation/outlet-visits", "pageTitle": "Outlet Visits", "pageDescription": "Plan and track field sales outlet visits", "show": true }]),
        UIFields: JSON.stringify([
            { header: 'OutletCode', label: 'Outlet Code', type: 'text' },
            { header: 'Date', label: 'Date', type: 'date' },
            { header: 'RespondDate', label: 'Respond Date', type: 'datetime' },
            { header: 'Progress', label: 'Progress', type: 'status' },
            { header: 'ProgressPlannedAt', label: 'Planned At', type: 'datetime' },
            { header: 'ProgressPlannedBy', label: 'Planned By', type: 'text' },
            { header: 'ProgressPlannedComment', label: 'Planned Comment', type: 'textarea' },
            { header: 'ProgressCompletedAt', label: 'Completed At', type: 'datetime' },
            { header: 'ProgressCompletedBy', label: 'Completed By', type: 'text' },
            { header: 'ProgressCompletedComment', label: 'Completed Comment', type: 'textarea' },
            { header: 'ProgressPostponedAt', label: 'Postponed At', type: 'datetime' },
            { header: 'ProgressPostponedBy', label: 'Postponed By', type: 'text' },
            { header: 'ProgressPostponedComment', label: 'Postponed Comment', type: 'textarea' },
            { header: 'ProgressCancelledAt', label: 'Cancelled At', type: 'datetime' },
            { header: 'ProgressCancelledBy', label: 'Cancelled By', type: 'text' },
            { header: 'ProgressCancelledComment', label: 'Cancelled Comment', type: 'textarea' },
            { header: 'Status', label: 'Status', type: 'status' },
            { header: 'AccessRegion', label: 'Access Region', type: 'text' }
        ]), IncludeInAuthorizationPayload: 'TRUE', Functional: 'FALSE', PreAction: '', PostAction: '', Reports: JSON.stringify([
            {"id":"rep_1776000000012","name":"outlet-visits-today","label":"Visits Today","templateSheet":"OutletVisitsToday","isRecordLevel":false,"inputs":[],"pdfOptions":{}},
            {"id":"rep_1776000000013","name":"outlet-visits-tomorrow-upcoming","label":"Visits Tomorrow & Upcoming","templateSheet":"OutletVisitsTomorrowAndUpcomig","isRecordLevel":false,"inputs":[],"pdfOptions":{}},
            {"id":"rep_1776000000014","name":"outlet-visits-overdue","label":"Visits Overdue","templateSheet":"OutletVisitsOverdue","isRecordLevel":false,"inputs":[],"pdfOptions":{}}
        ]), CustomUIName: '',
        ListViews: JSON.stringify([
            { "name": "Today", "label": "Today", "icon": "today", "color": "primary", "default": true, "filter": {"type":"group","logic":"OR","items":[{"type":"group","logic":"AND","items":[{"type":"condition","column":"Progress","operator":"eq","value":"PLANNED"},{"type":"condition","column":"Date","operator":"lt","value":"$startOfDay:0"}]},{"type":"condition","column":"Date","operator":"eq","value":"$date:0"}] } },
            { "name": "Overdue", "label": "Overdue", "icon": "running_with_errors", "color": "negative", "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "PLANNED" }, { "type": "condition", "column": "Date", "operator": "lt", "value": "$daysIn:0" }] } },
            { "name": "Tomorrow", "label": "Tomorrow", "icon": "event", "color": "info", "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "PLANNED" }, { "type": "condition", "column": "Date", "operator": "eq", "value": "$daysIn:1" }] } },
            { "name": "Upcomings", "label": "Upcomings", "icon": "date_range", "color": "indigo-6", "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "PLANNED" }, { "type": "condition", "column": "Date", "operator": "gt", "value": "$daysIn:1" }] } },
            { "name": "Completed", "label": "Completed", "icon": "task_alt", "color": "positive", "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "COMPLETED" }] } },
            { "name": "Postponed", "label": "Postponed", "icon": "event_repeat", "color": "warning", "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "POSTPONED" }] } },
            { "name": "Cancelled", "label": "Cancelled", "icon": "cancel", "color": "negative", "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "CANCELLED" }] } }
        ]),
        Relations: JSON.stringify({
            OutletCode: CONFIG.MASTER_SHEETS.OUTLETS
        })
    },
    {
        Name: CONFIG.OPERATION_SHEETS.OUTLET_RESTOCKS,
        Scope: 'operation', IsActive: 'TRUE', SheetName: CONFIG.OPERATION_SHEETS.OUTLET_RESTOCKS,
        CodePrefix: 'ORS', CodeSequenceLength: 6, LastDataUpdatedAt: 0, Audit: 'TRUE',
        RequiredHeaders: 'Date,OutletCode,RequestedUser,Progress,Status', UniqueHeaders: '', UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Active","Progress":"DRAFT"}', RecordAccessPolicy: 'OWNER_AND_UPLINE', OwnerUserField: 'CreatedBy',
        AdditionalActions: JSON.stringify([
            { "action": "Submit", "label": "Submit for Approval", "icon": "send", "color": "primary", "kind": "mutate", "confirm": false, "column": "Progress", "columnValue": "PENDING_APPROVAL", "fields": [{ "name": "ProgressSubmittedComment", "label": "Submission Note", "type": "textarea", "required": false }], "visibleWhen": { "column": "Progress", "op": "eq", "value": "DRAFT" } },
            { "action": "Resubmit", "label": "Resubmit Request", "icon": "replay", "color": "primary", "kind": "mutate", "confirm": false, "column": "Progress", "columnValue": "PENDING_APPROVAL", "fields": [{ "name": "ProgressSubmittedComment", "label": "Resubmission Comment (Describe Changes)", "type": "textarea", "required": true }], "visibleWhen": { "column": "Progress", "op": "eq", "value": "REVISION_REQUIRED" } },
            { "action": "Approve", "label": "Approve & Allocate Stock", "icon": "task_alt", "color": "positive", "kind": "navigate", "navigate": { "target": "action", "pageSlug": "approve" }, "visibleWhen": { "column": "Progress", "op": "eq", "value": "PENDING_APPROVAL" } },
            { "action": "Revise", "label": "Request Revision", "icon": "edit_note", "color": "warning", "kind": "mutate", "confirm": false, "column": "Progress", "columnValue": "REVISION_REQUIRED", "fields": [{ "name": "ProgressRevisionRequiredComment", "label": "Revision Instructions (Mandatory)", "type": "textarea", "required": true }], "visibleWhen": { "column": "Progress", "op": "eq", "value": "PENDING_APPROVAL" } },
            { "action": "Reject", "label": "Reject Request", "icon": "block", "color": "negative", "kind": "mutate", "confirm": true, "column": "Progress", "columnValue": "REJECTED", "fields": [{ "name": "ProgressRejectedComment", "label": "Rejection Reason (Mandatory)", "type": "textarea", "required": true }], "visibleWhen": { "column": "Progress", "op": "eq", "value": "PENDING_APPROVAL" } },
            { "action": "MarkDelivered", "label": "Confirm Outlet Delivery", "icon": "local_shipping", "color": "teal-7", "kind": "navigate", "navigate": { "target": "action", "pageSlug": "mark-delivered" }, "visibleWhen": { "column": "Progress", "op": "in", "value": ["APPROVED", "PARTIALLY_DELIVERED"] } },
            { "action": "Reallocate", "label": "Reallocate Pending Items", "icon": "inventory_2", "color": "info", "kind": "navigate", "navigate": { "target": "action", "pageSlug": "reallocate" }, "visibleWhen": { "column": "Progress", "op": "eq", "value": "PARTIALLY_DELIVERED" } },
            { "action": "Cancel", "label": "Cancel Restock Request", "icon": "cancel", "color": "negative", "kind": "navigate", "navigate": { "target": "action", "pageSlug": "cancel-restock" }, "visibleWhen": { "column": "Progress", "op": "in", "value": ["DRAFT", "PENDING_APPROVAL", "REVISION_REQUIRED", "APPROVED", "PARTIALLY_DELIVERED"] } }
        ]),
        Menu: JSON.stringify([{ "group": ["Field Sales"], "order": 3, "label": "Outlet Restocks", "icon": "inventory", "route": "/operation/outlet-restocks", "pageTitle": "Outlet Restocks", "pageDescription": "Request, approve, and fulfill outlet restocks", "show": true }]),
        UIFields: JSON.stringify([
            { header: 'Date', label: 'Date', type: 'date' },
            { header: 'OutletCode', label: 'Outlet Code', type: 'text' },
            { header: 'OutletConsumptionCode', label: 'Outlet Consumption Code', type: 'text' },
            { header: 'RequestedUser', label: 'Requested User', type: 'text' },
            { header: 'ApprovedUser', label: 'Approved User', type: 'text' },
            { header: 'Progress', label: 'Progress', type: 'status' },
            { header: 'ProgressSubmittedAt', label: 'Submitted At', type: 'datetime' },
            { header: 'ProgressSubmittedBy', label: 'Submitted By', type: 'text' },
            { header: 'ProgressSubmittedComment', label: 'Submitted Comment', type: 'textarea' },
            { header: 'ProgressRevisionRequiredAt', label: 'Revision Required At', type: 'datetime' },
            { header: 'ProgressRevisionRequiredBy', label: 'Revision Required By', type: 'text' },
            { header: 'ProgressRevisionRequiredComment', label: 'Revision Required Comment', type: 'textarea' },
            { header: 'ProgressApprovedAt', label: 'Approved At', type: 'datetime' },
            { header: 'ProgressApprovedBy', label: 'Approved By', type: 'text' },
            { header: 'ProgressApprovedComment', label: 'Approved Comment', type: 'textarea' },
            { header: 'ProgressRejectedAt', label: 'Rejected At', type: 'datetime' },
            { header: 'ProgressRejectedBy', label: 'Rejected By', type: 'text' },
            { header: 'ProgressRejectedComment', label: 'Rejected Comment', type: 'textarea' },
            { header: 'ProgressDeliveredAt', label: 'Delivered At', type: 'datetime' },
            { header: 'ProgressDeliveredBy', label: 'Delivered By', type: 'text' },
            { header: 'ProgressDeliveredComment', label: 'Delivered Comment', type: 'textarea' },
            { header: 'ProgressCancelledAt', label: 'Cancelled At', type: 'datetime' },
            { header: 'ProgressCancelledBy', label: 'Cancelled By', type: 'text' },
            { header: 'ProgressCancelledComment', label: 'Cancelled Comment', type: 'textarea' },
            { header: 'Status', label: 'Status', type: 'status' },
            { header: 'AccessRegion', label: 'Access Region', type: 'text' }
        ]), IncludeInAuthorizationPayload: 'TRUE', Functional: 'FALSE', PreAction: '', PostAction: '', Reports: JSON.stringify([
            {"id":"rep_1776000000015","name":"restock-order","label":"Restock Order","templateSheet":"Restock","isRecordLevel":true,"inputs":[{"targetCell":"AB6","field":"Code"}],"pdfOptions":{}},
            {"id":"rep_1776000000016","name":"restock-log","label":"Restock Log","templateSheet":"RestockRecords","isRecordLevel":false,"inputs":[{"label":"User","type":"select","targetCell":"J11","source":{"resource":"OutletRestocks","field":"RequestedUser"},"default":"Any User","required":false},{"label":"Date","type":"select","targetCell":"J12","source":{"resource":"OutletRestocks","field":"Date"},"default":"Any Date","required":false},{"label":"Progress","type":"select","targetCell":"J13","source":{"resource":"OutletRestocks","field":"Progress"},"default":"All Progress","required":false}],"pdfOptions":{}}
        ]), CustomUIName: '',
        ListViews: JSON.stringify([
            { "name": "Drafts", "label": "My Drafts", "icon": "edit_note", "color": "grey-7", "default": true, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "DRAFT" }] } },
            { "name": "PendingApproval", "label": "Awaiting Approval", "icon": "hourglass_top", "color": "warning", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "PENDING_APPROVAL" }] } },
            { "name": "NeedsRevision", "label": "Needs Revision", "icon": "rate_review", "color": "orange", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "REVISION_REQUIRED" }] } },
            { "name": "Approved", "label": "Approved", "icon": "task_alt", "color": "positive", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "APPROVED" }] } },
            { "name": "PartiallyDelivered", "label": "Partially Delivered", "icon": "incomplete_circle", "color": "info", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "PARTIALLY_DELIVERED" }] } },
            { "name": "PendingCompletion", "label": "Pending Completion", "icon": "pending_actions", "color": "primary", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "in", "value": ["APPROVED", "PARTIALLY_DELIVERED"] }] } },
            { "name": "Delivered", "label": "Delivered", "icon": "local_shipping", "color": "teal-7", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "DELIVERED" }] } },
            { "name": "Rejected", "label": "Rejected", "icon": "block", "color": "negative", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "REJECTED" }] } }
        ]),
        Relations: JSON.stringify({
            OutletCode: CONFIG.MASTER_SHEETS.OUTLETS
        })
    },
    {
        Name: CONFIG.OPERATION_SHEETS.OUTLET_RESTOCK_ITEMS,
        Scope: 'operation', ParentResource: CONFIG.OPERATION_SHEETS.OUTLET_RESTOCKS, IsActive: 'TRUE', SheetName: CONFIG.OPERATION_SHEETS.OUTLET_RESTOCK_ITEMS,
        CodePrefix: 'ORSI', CodeSequenceLength: 7, LastDataUpdatedAt: 0, Audit: 'TRUE', RequiredHeaders: 'OutletRestockCode,SKU,Quantity', UniqueHeaders: '', UniqueCompositeHeaders: '', DefaultValues: '{"Status":"Active","Quantity":0,"Progress":"PENDING"}', RecordAccessPolicy: 'OWNER_AND_UPLINE', OwnerUserField: 'CreatedBy', AdditionalActions: '', Menu: JSON.stringify([]), UIFields: JSON.stringify([
            { header: 'OutletRestockCode', label: 'Outlet Restock Code', type: 'text' },
            { header: 'WarehouseCode', label: 'Warehouse Code', type: 'text' },
            { header: 'SKU', label: 'SKU', type: 'text' },
            { header: 'StorageName', label: 'Storage Name', type: 'text' },
            { header: 'Quantity', label: 'Quantity', type: 'number' },
            { header: 'Progress', label: 'Progress', type: 'status' },
            { header: 'ProgressAllocatedAt', label: 'Allocated At', type: 'datetime' },
            { header: 'ProgressAllocatedBy', label: 'Allocated By', type: 'text' },
            { header: 'ProgressAllocatedComment', label: 'Allocated Comment', type: 'textarea' },
            { header: 'ProgressDeliveredAt', label: 'Delivered At', type: 'datetime' },
            { header: 'ProgressDeliveredBy', label: 'Delivered By', type: 'text' },
            { header: 'ProgressDeliveredComment', label: 'Delivered Comment', type: 'textarea' },
            { header: 'ProgressCancelledAt', label: 'Cancelled At', type: 'datetime' },
            { header: 'ProgressCancelledBy', label: 'Cancelled By', type: 'text' },
            { header: 'ProgressCancelledComment', label: 'Cancelled Comment', type: 'textarea' },
            { header: 'Status', label: 'Status', type: 'status' },
            { header: 'AccessRegion', label: 'Access Region', type: 'text' }
        ]), IncludeInAuthorizationPayload: 'TRUE', Functional: 'FALSE', PreAction: '', PostAction: '', Reports: '', CustomUIName: '', ListViews: '',
        Relations: JSON.stringify({
            WarehouseCode: CONFIG.MASTER_SHEETS.WAREHOUSES,
            SKU: { resource: CONFIG.MASTER_SHEETS.SKUS, targetHeader: 'Code', labelHeader: '$product.Name' }
        })
    },
    {
        Name: CONFIG.OPERATION_SHEETS.OUTLET_DELIVERIES,
        Scope: 'operation', IsActive: 'TRUE', SheetName: CONFIG.OPERATION_SHEETS.OUTLET_DELIVERIES,
        CodePrefix: 'ODL', CodeSequenceLength: 6, LastDataUpdatedAt: 0, Audit: 'TRUE', RequiredHeaders: 'Date,UserName,Progress,Status', UniqueHeaders: '', UniqueCompositeHeaders: '', DefaultValues: '{"Status":"Active","Progress":"DRAFT"}', RecordAccessPolicy: 'OWNER_AND_UPLINE', OwnerUserField: 'CreatedBy',
        AdditionalActions: JSON.stringify([
            { "action": "MarkDeliver", "label": "Record Delivery", "icon": "assignment_turned_in", "color": "positive", "kind": "navigate", "navigate": { "target": "action", "pageSlug": "mark-deliver" }, "visibleWhen": { "column": "Progress", "op": "in", "value": ["DRAFT", "IN_TRANSIT"] } },
            { "action": "MakeInTransit", "label": "Dispatch Delivery", "icon": "local_shipping", "color": "info", "kind": "navigate", "navigate": { "target": "action", "pageSlug": "make-in-transit" }, "visibleWhen": { "column": "Progress", "op": "eq", "value": "DRAFT" } },
            { "action": "MarkComplete", "label": "Complete Delivery", "icon": "check_circle", "color": "positive", "kind": "navigate", "navigate": { "target": "action", "pageSlug": "mark-complete" }, "visibleWhen": { "column": "Progress", "op": "eq", "value": "IN_TRANSIT" } },
            { "action": "Cancel", "label": "Cancel Delivery", "icon": "cancel", "color": "negative", "kind": "navigate", "navigate": { "target": "action", "pageSlug": "cancel" }, "visibleWhen": { "column": "Progress", "op": "eq", "value": "DRAFT" } }
        ]),
        Menu: JSON.stringify([{ "group": ["Field Sales"], "order": 4, "label": "Outlet Deliveries", "icon": "local_shipping", "route": "/operation/outlet-deliveries", "pageTitle": "Outlet Deliveries", "pageDescription": "Create, deliver, or cancel allocated outlet restock items", "show": true }]),
        UIFields: JSON.stringify([
            { header: 'Date', label: 'Date', type: 'date', required: true },
            { header: 'UserName', label: 'User Name', type: 'text', required: true },
            { header: 'OutletRestockItemCodes', label: 'Restock Item Codes', type: 'textarea' },
            { header: 'Progress', label: 'Progress', type: 'status', required: true },
            { header: 'ProgressInTransitAt', label: 'In Transit At', type: 'datetime' },
            { header: 'ProgressInTransitBy', label: 'In Transit By', type: 'text' },
            { header: 'ProgressInTransitComment', label: 'In Transit Comment', type: 'textarea' },
            { header: 'ProgressCompletedAt', label: 'Completed At', type: 'datetime' },
            { header: 'ProgressCompletedBy', label: 'Completed By', type: 'text' },
            { header: 'ProgressCompletedComment', label: 'Completed Comment', type: 'textarea' },
            { header: 'CancelledAt', label: 'Cancelled At', type: 'datetime' },
            { header: 'CancelledBy', label: 'Cancelled By', type: 'text' },
            { header: 'CancelledComment', label: 'Cancelled Comment', type: 'textarea' },
            { header: 'Status', label: 'Status', type: 'status', required: true },
            { header: 'AccessRegion', label: 'Access Region', type: 'text' }
        ]), IncludeInAuthorizationPayload: 'TRUE', Functional: 'FALSE', PreAction: '', PostAction: '', Reports: JSON.stringify([
            {"id":"rep_1777000000001","name":"delivery-worklist","label":"Delivery Worklist","templateSheet":"RestockDeliveriesWorklist","isRecordLevel":false,"inputs":[{"label":"Warehouse","type":"select","targetCell":"AB6","source":{"resource":"Warehouses","field":"Code"},"required":true}],"pdfOptions":{}},
            {"id":"rep_1776000000017","name":"delivery-receipt","label":"Delivery Receipt","templateSheet":"Delivery","isRecordLevel":true,"inputs":[{"targetCell":"AB6","field":"Code"}],"pdfOptions":{}},
            {"id":"rep_1776000000018","name":"delivery-log","label":"Delivery Log","templateSheet":"DeliveryRecords","isRecordLevel":false,"inputs":[{"label":"Driver/User","type":"select","targetCell":"J11","source":{"resource":"OutletDeliveries","field":"UserName"},"default":"Any User","required":false},{"label":"Date","type":"select","targetCell":"J12","source":{"resource":"OutletDeliveries","field":"Date"},"default":"Any Date","required":false}],"pdfOptions":{}}
        ]), CustomUIName: '', ListViews: JSON.stringify([
            { "name": "Pending", "label": "Pending", "icon": "inventory", "color": "grey-7", "default": true, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Status", "operator": "eq", "value": "Active" }, { "type": "condition", "column": "Progress", "operator": "eq", "value": "DRAFT" }] } },
            { "name": "InTransit", "label": "In Transit", "icon": "local_shipping", "color": "info", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Status", "operator": "eq", "value": "Active" }, { "type": "condition", "column": "Progress", "operator": "eq", "value": "IN_TRANSIT" }] } },
            { "name": "Outlets", "label": "Ready to Load", "icon": "storefront", "color": "warning", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Status", "operator": "eq", "value": "Active" }] } },
            { "name": "Completed", "label": "Completed", "icon": "check_circle", "color": "positive", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Status", "operator": "eq", "value": "Active" }, { "type": "condition", "column": "Progress", "operator": "eq", "value": "COMPLETED" }] } },
            { "name": "Cancelled", "label": "Cancelled", "icon": "block", "color": "negative", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Status", "operator": "eq", "value": "Active" }, { "type": "condition", "column": "Progress", "operator": "eq", "value": "CANCELLED" }] } }
        ])
    },
    {
        Name: CONFIG.OPERATION_SHEETS.OUTLET_RETURNS,
        Scope: 'operation', IsActive: 'TRUE', SheetName: CONFIG.OPERATION_SHEETS.OUTLET_RETURNS,
        CodePrefix: 'OR', CodeSequenceLength: 6, LastDataUpdatedAt: 0, Audit: 'TRUE',
        RequiredHeaders: 'OutletCode,Date,SKU,Qty', UniqueHeaders: '', UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Active","Qty":0,"Price":0,"Progress":"SUBMITTED","InvoiceAdjustmentRequired":false,"InvoiceAdjustmentDone":false,"WarehouseActionRequired":false,"WarehouseActionCompleted":false,"WarehouseAction":"","WarehouseActionDisposedReason":"","ConsumptionInvoiceCode":"","SourceInvoiceCode":""}',
        RecordAccessPolicy: 'OWNER_AND_UPLINE', OwnerUserField: 'CreatedBy',
        AdditionalActions: JSON.stringify([
            { "action": "WarehouseAction", "label": "Confirm Warehouse Action", "icon": "warehouse", "color": "purple", "kind": "navigate", "navigate": { "target": "action", "pageSlug": "warehouse-action" }, "visibleWhen": { "column": "Progress", "op": "nin", "value": ["COMPLETED", "CANCELLED"] } },
            { "action": "MarkInvoiceAdjusted", "label": "Settle Return Credit", "icon": "receipt_long", "color": "primary", "kind": "navigate", "navigate": { "target": "action", "pageSlug": "mark-invoice-adjusted" }, "visibleWhen": { "column": "Progress", "op": "nin", "value": ["COMPLETED", "CANCELLED"] } },
            { "action": "Cancel", "label": "Cancel Return", "icon": "cancel", "color": "negative", "kind": "navigate", "navigate": { "target": "action", "pageSlug": "cancel" }, "visibleWhen": { "column": "Progress", "op": "nin", "value": ["COMPLETED", "CANCELLED"] } }
        ]),
        Menu: JSON.stringify([{ "group": ["Field Sales"], "order": 5, "label": "Outlet Returns", "icon": "assignment_return", "route": "/operation/outlet-returns", "pageTitle": "Outlet Returns", "pageDescription": "Track sales returns and unsold inventory returns from outlets", "show": true }]),
        UIFields: JSON.stringify([
            { header: 'OutletCode', label: 'Outlet Code', type: 'text' },
            { header: 'Date', label: 'Date', type: 'date' },
            { header: 'Username', label: 'User Name', type: 'text' },
            { header: 'SKU', label: 'SKU', type: 'text' },
            { header: 'Qty', label: 'Qty', type: 'number' },
            { header: 'Price', label: 'Price', type: 'currency' },
            { header: 'Reason', label: 'Reason', type: 'select' },
            { header: 'ReasonComment', label: 'Reason Comment', type: 'textarea' },
            { header: 'InvoiceAdjustmentRequired', label: 'Invoice Adjustment Required', type: 'text' },
            { header: 'InvoiceAdjustmentDone', label: 'Invoice Adjustment Done', type: 'text' },
            { header: 'ConsumptionInvoiceCode', label: 'Settled On Invoice', type: 'text' },
            { header: 'SourceInvoiceCode', label: 'Billed On Invoice', type: 'text' },
            { header: 'WarehouseActionRequired', label: 'Warehouse Action Required', type: 'text' },
            { header: 'WarehouseActionCompleted', label: 'Warehouse Action Completed', type: 'text' },
            { header: 'WarehouseCode', label: 'Warehouse Code', type: 'text' },
            { header: 'WarehouseAction', label: 'Warehouse Action', type: 'select' },
            { header: 'WarehouseActionDisposedReason', label: 'Warehouse Action Disposed Reason', type: 'textarea' },
            { header: 'WarehouseActionDisposedAt', label: 'Warehouse Action Disposed At', type: 'datetime' },
            { header: 'WarehouseActionDisposedBy', label: 'Warehouse Action Disposed By', type: 'text' },
            { header: 'WarehouseActionStockedAt', label: 'Warehouse Action Stocked At', type: 'datetime' },
            { header: 'WarehouseActionStockedBy', label: 'Warehouse Action Stocked By', type: 'text' },
            { header: 'Progress', label: 'Progress', type: 'status' },
            { header: 'Status', label: 'Status', type: 'status' },
            { header: 'AccessRegion', label: 'Access Region', type: 'text' }
        ]), IncludeInAuthorizationPayload: 'TRUE', Functional: 'FALSE', PreAction: '', PostAction: '', Reports: JSON.stringify([
            {"id":"rep_1776000000019","name":"return-receipt","label":"Return Receipt","templateSheet":"Return","isRecordLevel":true,"inputs":[{"targetCell":"AB6","field":"Code"}],"pdfOptions":{}},
            {"id":"rep_1776000000020","name":"returns-log","label":"Returns Log","templateSheet":"ReturnRecords","isRecordLevel":false,"inputs":[{"label":"Username","type":"select","targetCell":"J11","source":{"resource":"OutletReturns","field":"Username"},"default":"Any User","required":false},{"label":"Date","type":"select","targetCell":"J12","source":{"resource":"OutletReturns","field":"Date"},"default":"All Date","required":false},{"label":"Return Reason","type":"select","targetCell":"J13","source":{"resource":"OutletReturns","field":"Reason"},"default":"Any Reason","required":false}],"pdfOptions":{}}
        ]), CustomUIName: '',
        // The AWAITING views filter on the track flag PAIRS, which no `Progress eq <state>`
        // auto-view can express; `name` is what the frontend resolves `PropsList<name>` from.
        ListViews: JSON.stringify([
            { "name": "Submitted", "label": "Submitted", "icon": "assignment_return", "color": "warning", "default": true, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Status", "operator": "eq", "value": "Active" }, { "type": "condition", "column": "Progress", "operator": "nin", "value": ["COMPLETED", "CANCELLED"] }] } },
            { "name": "AwaitingInvoiceAdjustment", "label": "Awaiting Invoice Adjustment", "icon": "receipt_long", "color": "info", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Status", "operator": "eq", "value": "Active" }, { "type": "condition", "column": "Progress", "operator": "nin", "value": ["COMPLETED", "CANCELLED"] }, { "type": "condition", "column": "InvoiceAdjustmentRequired", "operator": "eq", "value": "TRUE" }, { "type": "condition", "column": "InvoiceAdjustmentDone", "operator": "ne", "value": "TRUE" }] } },
            { "name": "AwaitingWarehouseReceipt", "label": "Awaiting Warehouse Receipt", "icon": "warehouse", "color": "purple", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Status", "operator": "eq", "value": "Active" }, { "type": "condition", "column": "Progress", "operator": "nin", "value": ["COMPLETED", "CANCELLED"] }, { "type": "condition", "column": "WarehouseActionRequired", "operator": "eq", "value": "TRUE" }, { "type": "condition", "column": "WarehouseActionCompleted", "operator": "ne", "value": "TRUE" }] } },
            { "name": "Completed", "label": "Completed", "icon": "check_circle", "color": "positive", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Status", "operator": "eq", "value": "Active" }, { "type": "condition", "column": "Progress", "operator": "eq", "value": "COMPLETED" }] } },
            { "name": "Cancelled", "label": "Cancelled", "icon": "block", "color": "negative", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Status", "operator": "eq", "value": "Active" }, { "type": "condition", "column": "Progress", "operator": "eq", "value": "CANCELLED" }] } }
        ]),
        // No relation for either invoice column: `enrichRecord` keys the getter off the target
        // resource, so both would claim `$outletconsumptioninvoice` and shadow each other.
        Relations: JSON.stringify({
            OutletCode: CONFIG.MASTER_SHEETS.OUTLETS,
            WarehouseCode: CONFIG.MASTER_SHEETS.WAREHOUSES,
            SKU: { resource: CONFIG.MASTER_SHEETS.SKUS, targetHeader: 'Code', labelHeader: '$product.Name' }
        })
    },
    {
        Name: CONFIG.OPERATION_SHEETS.OUTLET_CONSUMPTIONS,
        Scope: 'operation', IsActive: 'TRUE', SheetName: CONFIG.OPERATION_SHEETS.OUTLET_CONSUMPTIONS,
        CodePrefix: 'OC', CodeSequenceLength: 6, LastDataUpdatedAt: 0, Audit: 'TRUE', RequiredHeaders: 'OutletCode,Date,Username,Progress,Status', UniqueHeaders: '', UniqueCompositeHeaders: '', DefaultValues: '{"Status":"Active","Progress":"PENDING_INVOICE_GENERATION"}', RecordAccessPolicy: 'OWNER_AND_UPLINE', OwnerUserField: 'CreatedBy',
        AdditionalActions: JSON.stringify([
            {"action":"MarkInvoiceGenerated","label":"Mark Invoice Generated","icon":"receipt_long","color":"positive","kind":"mutate","confirm":true,"column":"Progress","columnValue":"INVOICE_GENERATED","columnValueOptions":[],"fields":[{"name":"Comment","label":"Comment","type":"textarea","required":false}],"visibleWhen":{"column":"Progress","op":"eq","value":"PENDING_INVOICE_GENERATION"}},
            {"action":"CancelConsumption","label":"Cancel Consumption","icon":"cancel","color":"negative","kind":"navigate","navigate":{"target":"action","pageSlug":"cancel-consumption"},"visibleWhen":{"column":"Progress","op":"nin","value":["CANCELLED"]}},
            {"action":"MarkPendingInvoiceGeneration","label":"Revert To Invoiceable","icon":"undo","color":"warning","kind":"mutate","confirm":true,"column":"Progress","columnValue":"PENDING_INVOICE_GENERATION","columnValueOptions":[],"fields":[{"name":"Comment","label":"Comment","type":"textarea","required":false}],"visibleWhen":{"column":"Progress","op":"eq","value":"INVOICE_GENERATED"}}
        ]),
        Menu: JSON.stringify([{ "group": ["Field Sales"], "order": 6, "label": "Outlet Consumptions", "icon": "point_of_sale", "route": "/operation/outlet-consumptions", "pageTitle": "Outlet Consumptions", "pageDescription": "Record outlet stock consumption", "show": true }]), UIFields: JSON.stringify([
            { header: 'OutletCode', label: 'Outlet Code', type: 'text' },
            { header: 'Date', label: 'Date', type: 'date' },
            { header: 'Username', label: 'User Name', type: 'text' },
            { header: 'OutletVisitCode', label: 'Outlet Visit Code', type: 'text' },
            { header: 'Progress', label: 'Progress', type: 'status' },
            { header: 'ProgressPendingInvoiceGenerationAt', label: 'Pending Invoice Generation At', type: 'datetime' },
            { header: 'ProgressPendingInvoiceGenerationBy', label: 'Pending Invoice Generation By', type: 'text' },
            { header: 'ProgressPendingInvoiceGenerationComment', label: 'Pending Invoice Generation Comment', type: 'textarea' },
            { header: 'ProgressInvoiceGeneratedAt', label: 'Invoice Generated At', type: 'datetime' },
            { header: 'ProgressInvoiceGeneratedBy', label: 'Invoice Generated By', type: 'text' },
            { header: 'ProgressInvoiceGeneratedComment', label: 'Invoice Generated Comment', type: 'textarea' },
            { header: 'ProgressCancelledAt', label: 'Cancelled At', type: 'datetime' },
            { header: 'ProgressCancelledBy', label: 'Cancelled By', type: 'text' },
            { header: 'ProgressCancelledComment', label: 'Cancelled Comment', type: 'textarea' },
            { header: 'Status', label: 'Status', type: 'status' },
            { header: 'AccessRegion', label: 'Access Region', type: 'text' }
        ]), IncludeInAuthorizationPayload: 'TRUE', Functional: 'FALSE', PreAction: '', PostAction: '', Reports: JSON.stringify([
            {"id":"rep_1776000000021","name":"consumption-receipt","label":"Consumption Receipt","templateSheet":"Consumption","isRecordLevel":true,"inputs":[{"targetCell":"AB6","field":"Code"}],"pdfOptions":{}},
            {"id":"rep_1776000000022","name":"consumption-records-log","label":"Consumption Log","templateSheet":"ConsumptionRecords","isRecordLevel":false,"inputs":[{"label":"Username","type":"select","targetCell":"J11","source":{"resource":"OutletConsumptions","field":"Username"},"default":"Any User","required":false},{"label":"Date","type":"select","targetCell":"J12","source":{"resource":"OutletConsumptions","field":"Date"},"default":"All Date","required":false}],"pdfOptions":{}}
        ]), CustomUIName: '',
        // Four work queues, in the order a field officer walks through their day.
        //
        // The first two are PROJECTION views: what they list is not an
        // OutletConsumptions row at all. `ScheduledOutlets` lists today's and overdue
        // OutletVisits (the work still to be done), and `InvoiceableOutlets` lists
        // OUTLETS carrying uninvoiced consumptions rather than the consumptions
        // themselves. A sheet filter can only ever narrow this resource's own rows, so
        // the filters below are the closest honest narrowing and the real projection is
        // supplied by the per-view `.vue` overrides
        // (_ui/AQL/components/Operation/OutletConsumptions/Index/List<View>.vue,
        // UI_MODULE_DEVELOPER_GUIDE.md §7.1). The filters still matter: they drive the
        // pill counts and keep a deep link to either view from showing settled history.
        //
        // The last two are ordinary state filters over this resource's own rows.
        ListViews: JSON.stringify([
            { "name": "ScheduledOutlets", "label": "Scheduled Outlets", "icon": "event_available", "color": "primary", "default": true, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "nin", "value": ["CANCELLED"] }] } },
            { "name": "InvoiceableOutlets", "label": "Invoiceable Outlets", "icon": "request_quote", "color": "warning", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "PENDING_INVOICE_GENERATION" }] } },
            { "name": "Completed", "label": "Completed", "icon": "task_alt", "color": "positive", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "INVOICE_GENERATED" }] } },
            { "name": "Cancelled", "label": "Cancelled", "icon": "block", "color": "negative", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "CANCELLED" }] } }
        ]),
        Relations: JSON.stringify({
            OutletCode: CONFIG.MASTER_SHEETS.OUTLETS,
            OutletVisitCode: CONFIG.OPERATION_SHEETS.OUTLET_VISITS
        })
    },
    {
        Name: CONFIG.OPERATION_SHEETS.OUTLET_CONSUMPTION_ITEMS,
        Scope: 'operation', ParentResource: CONFIG.OPERATION_SHEETS.OUTLET_CONSUMPTIONS, IsActive: 'TRUE', SheetName: CONFIG.OPERATION_SHEETS.OUTLET_CONSUMPTION_ITEMS,
        CodePrefix: 'OCI', CodeSequenceLength: 7, LastDataUpdatedAt: 0, Audit: 'TRUE', RequiredHeaders: 'OutletConsumptionCode,SKU,Qty', UniqueHeaders: '', UniqueCompositeHeaders: 'OutletConsumptionCode+SKU', DefaultValues: '{"Status":"Active","Qty":0}', RecordAccessPolicy: 'OWNER_AND_UPLINE', OwnerUserField: 'CreatedBy', AdditionalActions: '', Menu: JSON.stringify([]), UIFields: JSON.stringify([
            { header: 'OutletConsumptionCode', label: 'Outlet Consumption Code', type: 'text' },
            { header: 'SKU', label: 'SKU', type: 'text' },
            { header: 'Qty', label: 'Qty', type: 'number' },
            { header: 'Status', label: 'Status', type: 'status' }
        ]), IncludeInAuthorizationPayload: 'TRUE', Functional: 'FALSE', PreAction: '', PostAction: '', Reports: '', CustomUIName: '', ListViews: '',
        Relations: JSON.stringify({
            SKU: { resource: CONFIG.MASTER_SHEETS.SKUS, targetHeader: 'Code', labelHeader: '$product.Name' }
        })
    },
    {
        Name: CONFIG.OPERATION_SHEETS.OUTLET_CONSUMPTION_INVOICES,
        Scope: 'operation', ParentResource: '', IsActive: 'TRUE', SheetName: CONFIG.OPERATION_SHEETS.OUTLET_CONSUMPTION_INVOICES,
        CodePrefix: 'OCINV', CodeSequenceLength: 7, LastDataUpdatedAt: 0, Audit: 'TRUE', RequiredHeaders: 'Date,OutletCode,Username,Progress,Status', UniqueHeaders: '', UniqueCompositeHeaders: '', DefaultValues: '{"Status":"Active","Subtotal":0,"Discount":0,"TotalTaxableAmount":0,"TotalTaxAmount":0,"TaxDetails":"[]","Progress":"PENDING_PAYMENT"}', RecordAccessPolicy: 'OWNER_AND_UPLINE', OwnerUserField: 'CreatedBy',
        AdditionalActions: JSON.stringify([
            {"action":"RecordPayment","label":"Record Payment","title":"Record Payment","subtitle":"{$outlet.Name} • {Code}","icon":"payments","color":"primary","kind":"mutate","confirm":false,"column":"Progress","columnValue":"PARTIALLY_PAID","columnValueOptions":["PARTIALLY_PAID","PAID"],"fields":[{"name":"Comment","label":"Payment Note","type":"textarea","required":false}],"targets":[{"resource":"OutletPayments","mode":"create","key":"payment","label":"Payment","fields":[{"name":"Date","value":"$today"},{"name":"OutletCode","from":"$record.OutletCode"},{"name":"OutletConsumptionInvoiceCode","from":"$record.Code"},{"name":"Username","value":"$userName"},{"name":"Progress","value":"SUBMITTED"},{"name":"Status","value":"Active"},{"name":"Amount","label":"Amount Received","type":"number","required":true},{"name":"Mode","label":"Payment Mode","type":"select","required":true,"options":["Cash","Cheque","Bank Transfer","Card","Other"]},{"name":"Reference","label":"Reference","type":"text"}]}],"visibleWhen":{"column":"Progress","op":"in","value":["PENDING_PAYMENT","PARTIALLY_PAID"]}},
            {"action":"MarkPartiallyPaid","label":"Mark Partially Paid","icon":"payments","color":"info","kind":"mutate","confirm":true,"column":"Progress","columnValue":"PARTIALLY_PAID","columnValueOptions":[],"fields":[{"name":"Comment","label":"Comment","type":"textarea","required":false}],"visibleWhen":{"column":"Progress","op":"eq","value":"PENDING_PAYMENT"}},
            {"action":"MarkPendingPayment","label":"Revert To Unpaid","icon":"undo","color":"warning","kind":"mutate","confirm":true,"column":"Progress","columnValue":"PENDING_PAYMENT","columnValueOptions":[],"fields":[{"name":"Comment","label":"Comment","type":"textarea","required":false}],"visibleWhen":{"column":"Progress","op":"in","value":["PARTIALLY_PAID","PAID"]}},
            {"action":"MarkPaid","label":"Settle & Mark Paid","icon":"price_check","color":"positive","kind":"navigate","navigate":{"target":"action","pageSlug":"mark-paid"},"column":"Progress","columnValue":"PAID","visibleWhen":{"column":"Progress","op":"in","value":["PENDING_PAYMENT","PARTIALLY_PAID"]}},
            {"action":"Cancel","label":"Cancel","icon":"cancel","color":"negative","kind":"navigate","confirm":false,"column":"Progress","columnValue":"CANCELLED","columnValueOptions":[],"fields":[{"name":"Comment","label":"Cancellation Comment","type":"textarea","required":true}],"navigate":{"target":"action","pageSlug":"cancel"},"visibleWhen":{"column":"Progress","op":"nin","value":["PAID","CANCELLED"]}}
        ]),
        Menu: JSON.stringify([{ "group": ["Field Sales"], "order": 7, "label": "Consumption Invoices", "icon": "receipt_long", "route": "/operation/outlet-consumption-invoices", "pageTitle": "Consumption Invoices", "pageDescription": "View outlet consumption invoices", "show": true }]), UIFields: JSON.stringify([
            // A COMMA-SEPARATED list when several consumptions are bundled onto one
            // invoice (`OC-000001,OC-000002`), a single code otherwise. Deliberately not
            // declared in `Relations` and the resource deliberately has no
            // `ParentResource`: a relation resolves one target code, so declaring one
            // here would silently fail to resolve every bundled invoice. Consumers match
            // by membership in the split list, never by equality — see
            // `src/_resource/Operation/OutletConsumptions/composables/useConsumptionPayload.js`.
            { header: 'OutletConsumptionCode', label: 'Consumption Code(s)', type: 'text' },
            { header: 'Date', label: 'Date', type: 'date' },
            { header: 'DueDate', label: 'Due Date', type: 'date' },
            { header: 'OutletCode', label: 'Outlet Code', type: 'text' },
            { header: 'Username', label: 'User Name', type: 'text' },
            { header: 'PriceListCode', label: 'Price List Code', type: 'text' },
            { header: 'Subtotal', label: 'Subtotal', type: 'currency' },
            { header: 'Discount', label: 'Discount', type: 'currency' },
            { header: 'TotalTaxableAmount', label: 'Total Taxable Amount', type: 'currency' },
            { header: 'TotalTaxAmount', label: 'Total Tax Amount', type: 'currency' },
            { header: 'TaxDetails', label: 'Tax Details', type: 'textarea' },
            { header: 'OutletReturnCodes', label: 'Outlet Return Codes', type: 'textarea' },
            { header: 'ReturnDeductionTotal', label: 'Return Deduction Total', type: 'currency' },
            { header: 'SettlementMismatchAmount', label: 'Settlement Mismatch', type: 'currency' },
            { header: 'SettlementReason', label: 'Settlement Reason', type: 'text' },
            { header: 'Progress', label: 'Progress', type: 'status' },
            { header: 'ProgressPendingPaymentAt', label: 'Pending Payment At', type: 'datetime' },
            { header: 'ProgressPendingPaymentBy', label: 'Pending Payment By', type: 'text' },
            { header: 'ProgressPendingPaymentComment', label: 'Pending Payment Comment', type: 'textarea' },
            { header: 'ProgressPartiallyPaidAt', label: 'Partially Paid At', type: 'datetime' },
            { header: 'ProgressPartiallyPaidBy', label: 'Partially Paid By', type: 'text' },
            { header: 'ProgressPartiallyPaidComment', label: 'Partially Paid Comment', type: 'textarea' },
            { header: 'ProgressPaidAt', label: 'Paid At', type: 'datetime' },
            { header: 'ProgressPaidBy', label: 'Paid By', type: 'text' },
            { header: 'ProgressPaidComment', label: 'Paid Comment', type: 'textarea' },
            { header: 'ProgressCancelledAt', label: 'Cancelled At', type: 'datetime' },
            { header: 'ProgressCancelledBy', label: 'Cancelled By', type: 'text' },
            { header: 'ProgressCancelledComment', label: 'Cancelled Comment', type: 'textarea' },
            { header: 'Status', label: 'Status', type: 'status' },
            { header: 'AccessRegion', label: 'Access Region', type: 'text' }
        ]), IncludeInAuthorizationPayload: 'TRUE', Functional: 'FALSE', PreAction: '', PostAction: '', Reports: JSON.stringify([
            {"id":"rep_1776000000023","name":"consumption-invoice","label":"Consumption Invoice","templateSheet":"ConsumptionInvoice","isRecordLevel":true,"inputs":[{"targetCell":"AB6","field":"Code"}],"pdfOptions":{}},
            {"id":"rep_1776000000024","name":"invoice-log","label":"Invoice Log","templateSheet":"InvoiceRecords","isRecordLevel":false,"inputs":[{"label":"Date","type":"select","targetCell":"J11","source":{"resource":"OutletConsumptionInvoices","field":"Date"},"default":"All Date","required":false},{"label":"Username","type":"select","targetCell":"J12","source":{"resource":"OutletConsumptionInvoices","field":"Username"},"default":"Any User","required":false},{"label":"Progress","type":"select","targetCell":"J13","source":{"resource":"OutletConsumptionInvoices","field":"Progress"},"default":"All Progress","required":false}],"pdfOptions":{}}
        ]), CustomUIName: '',
        ListViews: JSON.stringify([
            { "name": "NearDue", "label": "Near Due", "icon": "event", "color": "primary", "default": true, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "in", "value": ["PENDING_PAYMENT", "PARTIALLY_PAID"] }, { "type": "condition", "column": "DueDate", "operator": "gte", "value": "$daysIn:0" }, { "type": "condition", "column": "DueDate", "operator": "lte", "value": "$daysIn:7" }] } },
            { "name": "Overdue", "label": "Overdue", "icon": "running_with_errors", "color": "negative", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "in", "value": ["PENDING_PAYMENT", "PARTIALLY_PAID"] }, { "type": "condition", "column": "DueDate", "operator": "lt", "value": "$daysIn:0" }] } },
            { "name": "Completed", "label": "Completed", "icon": "task_alt", "color": "positive", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "PAID" }] } },
            { "name": "Cancelled", "label": "Cancelled", "icon": "block", "color": "negative", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "CANCELLED" }] } },
            { "name": "PendingInvoices", "label": "Pending", "icon": "pending_actions", "color": "orange", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "in", "value": ["PENDING_PAYMENT", "PARTIALLY_PAID"] }] } },
            { "name": "HighValueInvoices", "label": "High Value", "icon": "trending_up", "color": "deep-orange", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "in", "value": ["PENDING_PAYMENT", "PARTIALLY_PAID"] }] } },
            { "name": "WaiveOffInvoices", "label": "Waive-off", "icon": "cleaning_services", "color": "blue-grey-6", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "in", "value": ["PENDING_PAYMENT", "PARTIALLY_PAID"] }] } },
            { "name": "OutletPendings", "label": "Outlet Pendings", "icon": "storefront", "color": "indigo-6", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "in", "value": ["PENDING_PAYMENT", "PARTIALLY_PAID"] }] } },
            { "name": "InvoiceableOutlets", "label": "To Invoice", "icon": "request_quote", "color": "warning", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "in", "value": ["PENDING_PAYMENT", "PARTIALLY_PAID"] }] } }
        ]),
        Relations: JSON.stringify({
            OutletCode: CONFIG.MASTER_SHEETS.OUTLETS,
            PriceListCode: CONFIG.MASTER_SHEETS.PRICE_LIST
        })
    },
    {
        Name: CONFIG.OPERATION_SHEETS.OUTLET_CONSUMPTION_INVOICE_ITEMS,
        Scope: 'operation', ParentResource: CONFIG.OPERATION_SHEETS.OUTLET_CONSUMPTION_INVOICES, IsActive: 'TRUE', SheetName: CONFIG.OPERATION_SHEETS.OUTLET_CONSUMPTION_INVOICE_ITEMS,
        CodePrefix: 'OCII', CodeSequenceLength: 7, LastDataUpdatedAt: 0, Audit: 'TRUE', RequiredHeaders: 'OutletConsumptionInvoiceCode,SKU,Qty,Price', UniqueHeaders: '', UniqueCompositeHeaders: 'OutletConsumptionInvoiceCode+SKU', DefaultValues: '{"Status":"Active","Qty":0,"Price":0,"Total":0,"Discount":0,"TaxableAmount":0,"TaxAmount":0,"TaxCode":""}', RecordAccessPolicy: 'OWNER_AND_UPLINE', OwnerUserField: 'CreatedBy', AdditionalActions: '', Menu: JSON.stringify([]), UIFields: JSON.stringify([
            { header: 'OutletConsumptionInvoiceCode', label: 'Outlet Consumption Invoice Code', type: 'text' },
            { header: 'SKU', label: 'SKU', type: 'text' },
            { header: 'Qty', label: 'Qty', type: 'number' },
            { header: 'Price', label: 'Price', type: 'currency' },
            { header: 'Total', label: 'Total', type: 'currency' },
            { header: 'Discount', label: 'Discount', type: 'currency' },
            { header: 'TaxableAmount', label: 'Taxable Amount', type: 'currency' },
            { header: 'TaxAmount', label: 'Tax Amount', type: 'currency' },
            { header: 'TaxCode', label: 'Tax Code', type: 'text' },
            { header: 'Status', label: 'Status', type: 'status' }
        ]), IncludeInAuthorizationPayload: 'TRUE', Functional: 'FALSE', PreAction: '', PostAction: '', Reports: '', CustomUIName: '', ListViews: '',
        Relations: JSON.stringify({
            SKU: { resource: CONFIG.MASTER_SHEETS.SKUS, targetHeader: 'Code', labelHeader: '$product.Name' },
            TaxCode: CONFIG.MASTER_SHEETS.TAXES
        })
    },
    {
        Name: CONFIG.OPERATION_SHEETS.OUTLET_PAYMENTS,
        Scope: 'operation',
        IsActive: 'TRUE',
        SheetName: CONFIG.OPERATION_SHEETS.OUTLET_PAYMENTS,
        CodePrefix: 'OPAY',
        CodeSequenceLength: 6,
        LastDataUpdatedAt: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'Date,OutletCode,Amount,Mode',
        UniqueHeaders: '',
        UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Active","Amount":0,"Progress":"SUBMITTED"}',
        RecordAccessPolicy: 'OWNER_AND_UPLINE',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: JSON.stringify([
            {
                "action": "Cancel",
                "label": "Cancel",
                "icon": "cancel",
                "color": "negative",
                "kind": "navigate",
                "navigate": { "target": "action", "pageSlug": "cancel" },
                "confirm": false,
                "column": "Progress",
                "columnValue": "CANCELLED",
                "columnValueOptions": [],
                "fields": [
                    {
                        "name": "Comment",
                        "label": "Cancellation Reason",
                        "type": "textarea",
                        "required": true
                    }
                ],
                "visibleWhen": {
                    "column": "Progress",
                    "op": "eq",
                    "value": "SUBMITTED"
                }
            }
        ]),
        Menu: JSON.stringify([
            {
                "group": ["Field Sales"],
                "order": 8,
                "label": "Outlet Payments",
                "icon": "payments",
                "route": "/operation/outlet-payments",
                "pageTitle": "Outlet Payments",
                "pageDescription": "View and record outlet payments",
                "show": true
            }
        ]),
        UIFields: JSON.stringify([
            { header: 'Date', label: 'Date', type: 'date' },
            { header: 'OutletCode', label: 'Outlet Code', type: 'text' },
            { header: 'OutletConsumptionInvoiceCode', label: 'Outlet Consumption Invoice Code', type: 'text' },
            { header: 'Amount', label: 'Amount', type: 'currency' },
            { header: 'Mode', label: 'Mode', type: 'select' },
            { header: 'Reference', label: 'Reference', type: 'text' },
            { header: 'Username', label: 'User Name', type: 'text' },
            { header: 'Progress', label: 'Progress', type: 'status' },
            { header: 'ProgressSubmittedAt', label: 'Submitted At', type: 'datetime' },
            { header: 'ProgressSubmittedBy', label: 'Submitted By', type: 'text' },
            { header: 'ProgressSubmittedComment', label: 'Submitted Comment', type: 'textarea' },
            { header: 'ProgressCancelledAt', label: 'Cancelled At', type: 'datetime' },
            { header: 'ProgressCancelledBy', label: 'Cancelled By', type: 'text' },
            { header: 'ProgressCancelledComment', label: 'Cancelled Comment', type: 'textarea' },
            { header: 'Status', label: 'Status', type: 'status' },
            { header: 'AccessRegion', label: 'Access Region', type: 'text' }
        ]),
        IncludeInAuthorizationPayload: 'TRUE',
        Functional: 'FALSE',
        PreAction: '',
        PostAction: '',
        Reports: JSON.stringify([
            {"id":"rep_1776000000025","name":"payment-receipt","label":"Payment Receipt","templateSheet":"Payment","isRecordLevel":true,"inputs":[{"targetCell":"AB6","field":"Code"}],"pdfOptions":{}},
            {"id":"rep_1776000000026","name":"payment-log","label":"Payment Log","templateSheet":"PaymentRecords","isRecordLevel":false,"inputs":[{"label":"Date","type":"select","targetCell":"J11","source":{"resource":"OutletPayments","field":"Date"},"default":"All Date","required":false},{"label":"Username","type":"select","targetCell":"J12","source":{"resource":"OutletPayments","field":"Username"},"default":"Any User","required":false},{"label":"Payment Mode","type":"select","targetCell":"J13","source":{"resource":"OutletPayments","field":"Mode"},"default":"Every Mode","required":false}],"pdfOptions":{}}
        ]),
        CustomUIName: '',
        // Six queues, declared here so `NearDue` is the page's DEFAULT view and every pill
        // resolves its `Index/List<Name>.vue` override. Without this row the resource falls
        // through to auto-derived views (one per `Progress` value — "Submitted", "Cancelled"),
        // and the Index opens on a view no override is registered for.
        //
        // The four invoice queues project OutletConsumptionInvoices at runtime, not this
        // resource's own rows, so their filters below are never what fills them — the `.vue`
        // override reads the Layer 2 aggregate. The entries exist for the NAME, the default
        // flag and the pill order; the labels/icons/counts are supplied by
        // `Index/ListSwitcher.js`.
        ListViews: JSON.stringify([
            { "name": "NearDue", "label": "Near Due", "icon": "event", "color": "primary", "default": true, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "SUBMITTED" }] } },
            { "name": "Overdue", "label": "Overdue", "icon": "running_with_errors", "color": "negative", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "SUBMITTED" }] } },
            { "name": "PendingInvoices", "label": "Pending", "icon": "pending_actions", "color": "orange", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "SUBMITTED" }] } },
            { "name": "HighValueInvoices", "label": "High Value", "icon": "trending_up", "color": "deep-orange", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "SUBMITTED" }] } },
            { "name": "Collections", "label": "Collections", "icon": "savings", "color": "teal-7", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "SUBMITTED" }] } },
            { "name": "Cancelled", "label": "Cancelled", "icon": "block", "color": "grey-7", "default": false, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "CANCELLED" }] } }
        ]),
        Relations: JSON.stringify({
            OutletCode: CONFIG.MASTER_SHEETS.OUTLETS
        })
    },
    {
        Name: CONFIG.OPERATION_SHEETS.OUTLET_MOVEMENTS,
        Scope: 'operation', IsActive: 'TRUE', SheetName: CONFIG.OPERATION_SHEETS.OUTLET_MOVEMENTS,
        CodePrefix: 'OMV', CodeSequenceLength: 7, LastDataUpdatedAt: 0, Audit: 'TRUE', RequiredHeaders: 'OutletCode,SKU,QtyChange,ReferenceType,ReferenceCode', UniqueHeaders: '', UniqueCompositeHeaders: '', DefaultValues: '{"Status":"Active","StorageName":"_default","QtyChange":0}', RecordAccessPolicy: 'OWNER_AND_UPLINE', OwnerUserField: 'CreatedBy', AdditionalActions: '', Menu: JSON.stringify([]), UIFields: JSON.stringify([
            { header: 'OutletCode', label: 'Outlet Code', type: 'text' },
            { header: 'StorageName', label: 'Storage Name', type: 'text' },
            { header: 'SKU', label: 'SKU', type: 'text' },
            { header: 'QtyChange', label: 'Qty Change', type: 'number' },
            { header: 'ReferenceType', label: 'Reference Type', type: 'select' },
            { header: 'ReferenceCode', label: 'Reference Code', type: 'text' },
            { header: 'ReferenceItemCode', label: 'Reference Item Code', type: 'text' },
            { header: 'MovementDate', label: 'Movement Date', type: 'date' },
            { header: 'Status', label: 'Status', type: 'status' },
            { header: 'AccessRegion', label: 'Access Region', type: 'text' }
        ]), IncludeInAuthorizationPayload: 'TRUE', Functional: 'FALSE', PreAction: '', PostAction: 'handleOutletMovementsBulkSave', Reports: '', CustomUIName: '', ListViews: '',
        Relations: JSON.stringify({
            OutletCode: CONFIG.MASTER_SHEETS.OUTLETS,
            SKU: { resource: CONFIG.MASTER_SHEETS.SKUS, targetHeader: 'Code', labelHeader: '$product.Name' }
        })
    },
    {
        Name: CONFIG.OPERATION_SHEETS.OUTLET_STORAGES,
        Scope: 'operation', IsActive: 'TRUE', SheetName: CONFIG.OPERATION_SHEETS.OUTLET_STORAGES,
        CodePrefix: 'OST', CodeSequenceLength: 7, LastDataUpdatedAt: 0, Audit: 'FALSE', RequiredHeaders: 'OutletCode,SKU,Quantity', UniqueHeaders: '', UniqueCompositeHeaders: 'OutletCode+SKU', DefaultValues: '{"Quantity":0}', RecordAccessPolicy: 'ALL', OwnerUserField: 'UpdatedBy', AdditionalActions: '',
        Menu: JSON.stringify([]), UIFields: JSON.stringify([{ header: 'OutletCode', label: 'Outlet Code', type: 'text', required: true }, { header: 'SKU', label: 'SKU', type: 'text', required: true }, { header: 'Quantity', label: 'Quantity', type: 'number', required: true }]), IncludeInAuthorizationPayload: 'TRUE', Functional: 'FALSE', PreAction: '', PostAction: '', Reports: '', CustomUIName: '', ListViews: '',
        Relations: JSON.stringify({
            OutletCode: CONFIG.MASTER_SHEETS.OUTLETS,
            SKU: { resource: CONFIG.MASTER_SHEETS.SKUS, targetHeader: 'Code', labelHeader: '$product.Name' }
        })
    },
    {
        Name: CONFIG.OPERATION_SHEETS.WAREHOUSE_TRANSFERS,
        Scope: 'operation',
        IsActive: 'TRUE',
        SheetName: CONFIG.OPERATION_SHEETS.WAREHOUSE_TRANSFERS,
        CodePrefix: 'WT',
        CodeSequenceLength: 6,
        LastDataUpdatedAt: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'SourceWarehouseCode,Date,Progress,Status',
        UniqueHeaders: 'Code',
        UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Active","Progress":"DRAFT","IsInstant":"FALSE"}',
        RecordAccessPolicy: 'OWNER_AND_UPLINE',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: JSON.stringify([
            { "action": "Approve", "label": "Approve", "icon": "check_circle", "color": "positive", "kind": "mutate", "confirm": true, "column": "Progress", "columnValue": "APPROVED", "visibleWhen": { "column": "Progress", "op": "eq", "value": "PENDING_APPROVAL" } },
            { "action": "Reject", "label": "Reject", "icon": "cancel", "color": "negative", "kind": "mutate", "confirm": false, "column": "Progress", "columnValue": "REJECTED", "fields": [{ "name": "Comment", "label": "Rejection Reason", "type": "textarea", "required": true }], "visibleWhen": { "column": "Progress", "op": "in", "value": ["PENDING_APPROVAL", "APPROVED"] } },
            { "action": "Complete", "label": "Complete", "icon": "task_alt", "color": "positive", "kind": "mutate", "confirm": true, "column": "Progress", "columnValue": "COMPLETED", "fields": [{ "name": "Comment", "label": "Completion Comment", "type": "textarea", "required": false }], "visibleWhen": [{ "column": "Progress", "op": "eq", "value": "APPROVED" }, { "column": "DestinationWarehouseCode", "op": "notEmpty" }] },
            { "action": "ClaimAndComplete", "label": "Claim & Complete", "icon": "local_shipping", "color": "primary", "kind": "mutate", "confirm": false, "column": "Progress", "columnValue": "COMPLETED", "fields": [{ "name": "DestinationWarehouseCode", "label": "Destination Warehouse", "type": "select", "source": { "resource": "Warehouses", "field": "Code" }, "required": true }, { "name": "Comment", "label": "Completion Comment", "type": "textarea", "required": false }], "visibleWhen": [{ "column": "Progress", "op": "eq", "value": "APPROVED" }, { "column": "DestinationWarehouseCode", "op": "empty" }] }
        ]),
        Menu: JSON.stringify([{ "group": ["Warehouse"], "order": 5, "label": "Transfers", "icon": "swap_horiz", "route": "/operation/warehouse-transfers", "pageTitle": "Warehouse Transfers", "pageDescription": "Transfer inventory between warehouses", "show": true }]),
        UIFields: JSON.stringify([
            { header: 'SourceWarehouseCode', label: 'Source Warehouse Code', type: 'text' },
            { header: 'DestinationWarehouseCode', label: 'Destination Warehouse Code', type: 'text' },
            { header: 'Date', label: 'Date', type: 'date' },
            { header: 'Username', label: 'User Name', type: 'text' },
            { header: 'Reference', label: 'Reference', type: 'text' },
            { header: 'IsInstant', label: 'Is Instant', type: 'text' },
            { header: 'Progress', label: 'Progress', type: 'status' },
            { header: 'ProgressPendingApprovalAt', label: 'Pending Approval At', type: 'datetime' },
            { header: 'ProgressPendingApprovalBy', label: 'Pending Approval By', type: 'text' },
            { header: 'ProgressPendingApprovalComment', label: 'Pending Approval Comment', type: 'textarea' },
            { header: 'ProgressApprovedAt', label: 'Approved At', type: 'datetime' },
            { header: 'ProgressApprovedBy', label: 'Approved By', type: 'text' },
            { header: 'ProgressApprovedComment', label: 'Approved Comment', type: 'textarea' },
            { header: 'ProgressCompletedAt', label: 'Completed At', type: 'datetime' },
            { header: 'ProgressCompletedBy', label: 'Completed By', type: 'text' },
            { header: 'ProgressCompletedComment', label: 'Completed Comment', type: 'textarea' },
            { header: 'ProgressRejectedAt', label: 'Rejected At', type: 'datetime' },
            { header: 'ProgressRejectedBy', label: 'Rejected By', type: 'text' },
            { header: 'ProgressRejectedComment', label: 'Rejected Comment', type: 'textarea' },
            { header: 'Status', label: 'Status', type: 'status' },
            { header: 'AccessRegion', label: 'Access Region', type: 'text' }
        ]),
        IncludeInAuthorizationPayload: 'TRUE',
        Functional: 'FALSE',
        PreAction: '',
        PostAction: 'handleWarehouseTransfers',
        Reports: '',
        CustomUIName: '',
        ListViews: '',
        Relations: JSON.stringify({
            SourceWarehouseCode: CONFIG.MASTER_SHEETS.WAREHOUSES,
            DestinationWarehouseCode: CONFIG.MASTER_SHEETS.WAREHOUSES
        })
    },
    {
        Name: CONFIG.OPERATION_SHEETS.WAREHOUSE_TRANSFER_ITEMS,
        Scope: 'operation',
        ParentResource: CONFIG.OPERATION_SHEETS.WAREHOUSE_TRANSFERS,
        IsActive: 'TRUE',
        SheetName: CONFIG.OPERATION_SHEETS.WAREHOUSE_TRANSFER_ITEMS,
        CodePrefix: 'WTI',
        CodeSequenceLength: 7,
        LastDataUpdatedAt: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'WarehouseTransferCode,SKUCode,Quantity,Status',
        UniqueHeaders: 'Code',
        UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Active","Quantity":0,"Progress":"PENDING","SourceStorageName":"_default","DestinationStorageName":"_default"}',
        RecordAccessPolicy: 'OWNER_AND_UPLINE',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: '',
        Menu: JSON.stringify([]),
        UIFields: JSON.stringify([
            { header: 'WarehouseTransferCode', label: 'Warehouse Transfer Code', type: 'text' },
            { header: 'SKUCode', label: 'SKU Code', type: 'text' },
            { header: 'Quantity', label: 'Quantity', type: 'number' },
            { header: 'SourceStorageName', label: 'Source Storage Name', type: 'text' },
            { header: 'DestinationStorageName', label: 'Destination Storage Name', type: 'text' },
            { header: 'Progress', label: 'Progress', type: 'status' },
            { header: 'ProgressTransferredAt', label: 'Transferred At', type: 'datetime' },
            { header: 'ProgressTransferredBy', label: 'Transferred By', type: 'text' },
            { header: 'ProgressTransferredComment', label: 'Transferred Comment', type: 'textarea' },
            { header: 'ProgressCancelledAt', label: 'Cancelled At', type: 'datetime' },
            { header: 'ProgressCancelledBy', label: 'Cancelled By', type: 'text' },
            { header: 'ProgressCancelledComment', label: 'Cancelled Comment', type: 'textarea' },
            { header: 'Status', label: 'Status', type: 'status' }
        ]),
        IncludeInAuthorizationPayload: 'TRUE',
        Functional: 'FALSE',
        PreAction: '',
        PostAction: 'handleWarehouseTransferItems',
        Reports: '',
        CustomUIName: '',
        ListViews: '',
        Relations: JSON.stringify({
            SKUCode: { resource: CONFIG.MASTER_SHEETS.SKUS, targetHeader: 'Code', labelHeader: '$product.Name' }
        })
    },
    {
        Name: CONFIG.OPERATION_SHEETS.LEAD_FOLLOW_UPS,
        Scope: 'operation',
        ParentResource: CONFIG.MASTER_SHEETS.LEADS,
        IsActive: 'TRUE',
        SheetName: CONFIG.OPERATION_SHEETS.LEAD_FOLLOW_UPS,
        CodePrefix: 'LFU',
        CodeSequenceLength: 6,
        LastDataUpdatedAt: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'LeadCode,Date,Purpose,Progress,Status',
        UniqueHeaders: '',
        UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Active","Progress":"Awaiting"}',
        RecordAccessPolicy: 'OWNER_AND_UPLINE',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: JSON.stringify([
            {"action": "QuickFollowUp", "label": "Quick Follow Up", "title": "Quick Follow Up", "subtitle": "", "icon": "bolt", "color": "primary", "kind": "mutate", "resourceLevel": true, "confirm": false, "column": "Progress", "columnValue": "Completed", "columnValueOptions": [], "fields": [{"name": "LeadCode", "label": "Lead", "type": "select", "source": {"resource": "Leads", "field": "Code", "label": "Name"}, "required": true}, {"name": "Username", "value": "$userName"}, {"name": "Date", "value": "$today"}, {"name": "Purpose", "value": "Others"}, {"name": "PurposeDetail", "value": "Quick visit"}, {"name": "Outcome", "label": "Follow-up Outcome", "type": "textarea", "required": true}, {"name": "ProgressCompletedComment", "value": "Quick follow-up recorded by ${$userName} on ${$dateTime}"}, {"name": "ProgressCompletedAt", "value": "$dateTime"}, {"name": "ProgressCompletedBy", "value": "$userName"}], "targets": [{"resource": "LeadFollowUps", "mode": "create", "key": "nextFollowUp", "label": "Next Follow Up (optional)", "when": {"field": "Date", "op": "notEmpty"}, "fields": [{"name": "LeadCode", "from": "$record.LeadCode"}, {"name": "Progress", "value": "Awaiting"}, {"name": "Status", "value": "Active"}, {"name": "Username", "value": "$userName"}, {"name": "Date", "label": "Next Follow Up Date", "type": "date", "value": "$date:15", "required": false}, {"name": "Purpose", "label": "Next Purpose", "type": "select", "required": true}, {"name": "PurposeDetail", "label": "Next Purpose Detail", "type": "textarea", "required": false}]}, {"resource": "Leads", "mode": "update", "key": "lead", "code": "$record.LeadCode", "fields": [{"name": "Progress", "value": "Processing"}]}]},
            {"action": "Complete", "label": "Complete", "subtitle": "{$lead.Name}", "icon": "task_alt", "color": "positive", "kind": "mutate", "confirm": false, "column": "Progress", "columnValue": "Completed", "columnValueOptions": [], "fields": [{"name": "Outcome", "label": "Follow-up Outcome", "type": "textarea", "required": true}], "targets": [{"resource": "LeadFollowUps", "mode": "create", "key": "nextFollowUp", "label": "Next Follow Up (optional)", "when": {"field": "Date", "op": "notEmpty"}, "fields": [{"name": "LeadCode", "from": "$record.LeadCode"}, {"name": "Progress", "value": "Awaiting"}, {"name": "Status", "value": "Active"}, {"name": "Username", "value": "$userName"}, {"name": "Date", "label": "Next Follow Up Date", "type": "date", "value": "$date:15", "required": false}, {"name": "Purpose", "label": "Next Purpose", "type": "select", "required": true}, {"name": "PurposeDetail", "label": "Next Purpose Detail", "type": "textarea", "required": false}]}], "visibleWhen": {"column": "Progress", "op": "eq", "value": "Awaiting"}},
            {"action": "Postpone", "label": "Postpone", "subtitle": "{$lead.Name}", "icon": "event_repeat", "color": "warning", "kind": "mutate", "confirm": false, "column": "Progress", "columnValue": "Postponed", "columnValueOptions": [], "fields": [{"name": "Comment", "label": "Postpone Reason", "type": "textarea", "required": true}], "targets": [{"resource": "LeadFollowUps", "mode": "create", "key": "nextFollowUp", "label": "Rescheduled Follow Up", "fields": [{"name": "LeadCode", "from": "$record.LeadCode"}, {"name": "Progress", "value": "Awaiting"}, {"name": "Status", "value": "Active"}, {"name": "Username", "value": "$userName"}, {"name": "Date", "label": "New Follow Up Date", "type": "date", "value": "$date:15", "required": true}, {"name": "Purpose", "label": "Purpose", "type": "select", "required": true, "from": "$record.Purpose"}, {"name": "PurposeDetail", "label": "Purpose Detail", "type": "textarea", "required": false, "from": "---POSTPONED ON ${$today}---\n${$record.PurposeDetail}"}]}], "visibleWhen": {"column": "Progress", "op": "eq", "value": "Awaiting"}},
            {"action": "Cancel", "label": "Cancel", "subtitle": "{$lead.Name}", "icon": "cancel", "color": "negative", "kind": "mutate", "confirm": false, "column": "Progress", "columnValue": "Cancelled", "columnValueOptions": [], "fields": [{"name": "Comment", "label": "Cancellation Reason", "type": "textarea", "required": true}], "visibleWhen": {"column": "Progress", "op": "eq", "value": "Awaiting"}}
        ]),
        Menu: JSON.stringify([{"group":["Leads"],"order":2,"label":"Lead Follow Ups","icon":"follow_the_signs","route":"/operation/lead-follow-ups","pageTitle":"Lead Follow Ups","pageDescription":"Track lead communication, visits and follow-up outcomes","show":true}]),
        UIFields: JSON.stringify([
            { header: 'LeadCode', label: 'Lead', type: 'text', required: true },
            { header: 'Date', label: 'Date', type: 'date', required: true },
            { header: 'RespondDate', label: 'Respond Date', type: 'datetime' },
            { header: 'Username', label: 'User Name', type: 'text' },
            { header: 'Purpose', label: 'Purpose', type: 'select', required: true },
            { header: 'PurposeDetail', label: 'Purpose Detail', type: 'textarea' },
            { header: 'Outcome', label: 'Outcome', type: 'textarea' },
            { header: 'Progress', label: 'Progress', type: 'select' },
            { header: 'ProgressCompletedAt', label: 'Completed At', type: 'datetime' },
            { header: 'ProgressCompletedBy', label: 'Completed By', type: 'text' },
            { header: 'ProgressCompletedComment', label: 'Completed Comment', type: 'textarea' },
            { header: 'ProgressPostponedAt', label: 'Postponed At', type: 'datetime' },
            { header: 'ProgressPostponedBy', label: 'Postponed By', type: 'text' },
            { header: 'ProgressPostponedComment', label: 'Postponed Comment', type: 'textarea' },
            { header: 'ProgressCancelledAt', label: 'Cancelled At', type: 'datetime' },
            { header: 'ProgressCancelledBy', label: 'Cancelled By', type: 'text' },
            { header: 'ProgressCancelledComment', label: 'Cancelled Comment', type: 'textarea' },
            { header: 'Status', label: 'Status', type: 'status' },
            { header: 'AccessRegion', label: 'Access Region', type: 'text' }
        ]),
        IncludeInAuthorizationPayload: 'TRUE',
        Functional: 'FALSE',
        PreAction: '',
        PostAction: '',
        Reports: '',
        CustomUIName: '',
        ListViews: JSON.stringify([
            { "name": "Recent", "label": "Recent", "icon": "schedule", "color": "primary", "default": true, "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "RespondDate", "operator": "gte", "value": "$hoursAgo:48" }, { "type": "condition", "column": "RespondDate", "operator": "lte", "value": "$hoursIn:0" }] } },
            { "name": "Overdue", "label": "Overdue", "icon": "running_with_errors", "color": "negative", "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "Awaiting" }, { "type": "condition", "column": "Date", "operator": "lt", "value": "$daysIn:0" }] } },
            { "name": "Today", "label": "Today", "icon": "today", "color": "primary", "filter": { "type": "group", "logic": "OR", "items": [{ "type": "condition", "column": "Date", "operator": "eq", "value": "$date:0" }, { "type": "condition", "column": "RespondDate", "operator": "eq", "value": "$date:0" }] } },
            { "name": "Tomorrow", "label": "Tomorrow", "icon": "event", "color": "info", "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "Awaiting" }, { "type": "condition", "column": "Date", "operator": "eq", "value": "$daysIn:1" }] } },
            { "name": "Upcomings", "label": "Upcomings", "icon": "date_range", "color": "indigo-6", "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "Awaiting" }, { "type": "condition", "column": "Date", "operator": "gt", "value": "$daysIn:1" }] } },
            { "name": "Completed", "label": "Completed", "icon": "task_alt", "color": "positive", "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "Completed" }] } },
            { "name": "Postponed", "label": "Postponed", "icon": "event_repeat", "color": "warning", "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "Postponed" }] } },
            { "name": "Cancelled", "label": "Cancelled", "icon": "cancel", "color": "negative", "filter": { "type": "group", "logic": "AND", "items": [{ "type": "condition", "column": "Progress", "operator": "eq", "value": "Cancelled" }] } }
        ]),
        Relations: JSON.stringify({
            LeadCode: { resource: CONFIG.MASTER_SHEETS.LEADS, targetHeader: 'Code', labelHeader: 'Name' }
        })
    },
    {
        Name: CONFIG.ACCOUNTS_SHEETS.CHART_OF_ACCOUNTS,
        Scope: 'master',
        IsActive: 'TRUE',
        SheetName: CONFIG.ACCOUNTS_SHEETS.CHART_OF_ACCOUNTS,
        CodePrefix: 'COA',
        CodeSequenceLength: 4,
        LastDataUpdatedAt: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'Name,AccountType',
        UniqueHeaders: 'Name',
        UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Active","AccountType":"ASSETS"}',
        RecordAccessPolicy: 'ALL',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: '',
        Menu: JSON.stringify([]),
        UIFields: JSON.stringify([]),
        IncludeInAuthorizationPayload: 'TRUE',
        Functional: 'FALSE',
        PreAction: '',
        PostAction: '',
        Reports: '',
        CustomUIName: '',
        ListViews: ''
    },
    {
        Name: CONFIG.ACCOUNTS_SHEETS.ENTRY_TEMPLATES,
        Scope: 'master',
        IsActive: 'TRUE',
        SheetName: CONFIG.ACCOUNTS_SHEETS.ENTRY_TEMPLATES,
        CodePrefix: 'ETPL',
        CodeSequenceLength: 4,
        LastDataUpdatedAt: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'Name',
        UniqueHeaders: 'Name',
        UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Active"}',
        RecordAccessPolicy: 'ALL',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: '',
        Menu: JSON.stringify([]),
        UIFields: JSON.stringify([]),
        IncludeInAuthorizationPayload: 'TRUE',
        Functional: 'FALSE',
        PreAction: '',
        PostAction: '',
        Reports: '',
        CustomUIName: '',
        ListViews: '',
        Relations: JSON.stringify({
            COACode: CONFIG.ACCOUNTS_SHEETS.CHART_OF_ACCOUNTS
        })
    },
    {
        Name: CONFIG.ACCOUNTS_SHEETS.ASSETS,
        Scope: 'accounts',
        IsActive: 'TRUE',
        SheetName: CONFIG.ACCOUNTS_SHEETS.ASSETS,
        CodePrefix: 'AST',
        CodeSequenceLength: 6,
        LastDataUpdatedAt: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'COACode,Amount',
        UniqueHeaders: '',
        UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Active"}',
        RecordAccessPolicy: 'ALL',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: '',
        Menu: JSON.stringify([]),
        UIFields: JSON.stringify([]),
        IncludeInAuthorizationPayload: 'TRUE',
        Functional: 'FALSE',
        PreAction: '',
        PostAction: '',
        Reports: '',
        CustomUIName: '',
        ListViews: '',
        Relations: JSON.stringify({
            COACode: CONFIG.ACCOUNTS_SHEETS.CHART_OF_ACCOUNTS
        })
    },
    {
        Name: CONFIG.ACCOUNTS_SHEETS.LIABILITIES,
        Scope: 'accounts',
        IsActive: 'TRUE',
        SheetName: CONFIG.ACCOUNTS_SHEETS.LIABILITIES,
        CodePrefix: 'LIA',
        CodeSequenceLength: 6,
        LastDataUpdatedAt: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'COACode,Amount',
        UniqueHeaders: '',
        UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Active"}',
        RecordAccessPolicy: 'ALL',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: '',
        Menu: JSON.stringify([]),
        UIFields: JSON.stringify([]),
        IncludeInAuthorizationPayload: 'TRUE',
        Functional: 'FALSE',
        PreAction: '',
        PostAction: '',
        Reports: '',
        CustomUIName: '',
        ListViews: '',
        Relations: JSON.stringify({
            COACode: CONFIG.ACCOUNTS_SHEETS.CHART_OF_ACCOUNTS
        })
    },
    {
        Name: CONFIG.ACCOUNTS_SHEETS.EQUITY,
        Scope: 'accounts',
        IsActive: 'TRUE',
        SheetName: CONFIG.ACCOUNTS_SHEETS.EQUITY,
        CodePrefix: 'EQT',
        CodeSequenceLength: 6,
        LastDataUpdatedAt: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'COACode,Amount',
        UniqueHeaders: '',
        UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Active"}',
        RecordAccessPolicy: 'ALL',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: '',
        Menu: JSON.stringify([]),
        UIFields: JSON.stringify([]),
        IncludeInAuthorizationPayload: 'TRUE',
        Functional: 'FALSE',
        PreAction: '',
        PostAction: '',
        Reports: '',
        CustomUIName: '',
        ListViews: '',
        Relations: JSON.stringify({
            COACode: CONFIG.ACCOUNTS_SHEETS.CHART_OF_ACCOUNTS
        })
    },
    {
        Name: CONFIG.ACCOUNTS_SHEETS.REVENUE,
        Scope: 'accounts',
        IsActive: 'TRUE',
        SheetName: CONFIG.ACCOUNTS_SHEETS.REVENUE,
        CodePrefix: 'REV',
        CodeSequenceLength: 6,
        LastDataUpdatedAt: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'COACode,Amount',
        UniqueHeaders: '',
        UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Active"}',
        RecordAccessPolicy: 'ALL',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: '',
        Menu: JSON.stringify([]),
        UIFields: JSON.stringify([]),
        IncludeInAuthorizationPayload: 'TRUE',
        Functional: 'FALSE',
        PreAction: '',
        PostAction: '',
        Reports: '',
        CustomUIName: '',
        ListViews: '',
        Relations: JSON.stringify({
            COACode: CONFIG.ACCOUNTS_SHEETS.CHART_OF_ACCOUNTS
        })
    },
    {
        Name: CONFIG.ACCOUNTS_SHEETS.EXPENSES,
        Scope: 'accounts',
        IsActive: 'TRUE',
        SheetName: CONFIG.ACCOUNTS_SHEETS.EXPENSES,
        CodePrefix: 'EXP',
        CodeSequenceLength: 6,
        LastDataUpdatedAt: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'COACode,Amount',
        UniqueHeaders: '',
        UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Active"}',
        RecordAccessPolicy: 'ALL',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: '',
        Menu: JSON.stringify([]),
        UIFields: JSON.stringify([]),
        IncludeInAuthorizationPayload: 'TRUE',
        Functional: 'FALSE',
        PreAction: '',
        PostAction: '',
        Reports: '',
        CustomUIName: '',
        ListViews: '',
        Relations: JSON.stringify({
            COACode: CONFIG.ACCOUNTS_SHEETS.CHART_OF_ACCOUNTS
        })
    },
    {
        Name: CONFIG.ACCOUNTS_SHEETS.TAX_TRANSACTIONS,
        Scope: 'accounts',
        IsActive: 'TRUE',
        SheetName: CONFIG.ACCOUNTS_SHEETS.TAX_TRANSACTIONS,
        CodePrefix: 'TXD',
        CodeSequenceLength: 7,
        LastDataUpdatedAt: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'Date,Resource,ResourceCode,TaxCode,TaxAmount',
        UniqueHeaders: '',
        UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Active","TaxableAmount":0,"TaxAmount":0}',
        RecordAccessPolicy: 'ALL',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: '',
        Menu: JSON.stringify([]),
        UIFields: JSON.stringify([]),
        IncludeInAuthorizationPayload: 'TRUE',
        Functional: 'FALSE',
        PreAction: '',
        PostAction: '',
        Reports: '',
        CustomUIName: '',
        ListViews: '',
        Relations: JSON.stringify({
            TaxCode: CONFIG.MASTER_SHEETS.TAXES
        })
    },
    // --- FUNCTIONAL RESOURCES ---
    {
        Name: 'BulkUploadMasters',
        Scope: 'master',
        IsActive: 'TRUE',
        SheetName: '',
        CodePrefix: '',
        CodeSequenceLength: 0,
        LastDataUpdatedAt: 0,
        Audit: 'FALSE',
        RequiredHeaders: '',
        UniqueHeaders: '',
        UniqueCompositeHeaders: '',
        DefaultValues: '',
        RecordAccessPolicy: 'ALL',
        OwnerUserField: '',
        AdditionalActions: '',
        Menu: JSON.stringify([{"group":["Masters"],"order":99,"label":"Bulk Upload","icon":"cloud_upload","route":"/master/bulk-upload","pageTitle":"Bulk Upload Masters","pageDescription":"Upload bulk data to any master resource","show":true}]),
        UIFields: JSON.stringify([]),
        IncludeInAuthorizationPayload: 'TRUE',
        Functional: 'TRUE',
        PreAction: '',
        PostAction: '',
        Reports: '',
        CustomUIName: '',
        ListViews: ''
    }
];
}

function syncAppResourcesFromCode(silent) {
    initAppResourcesCodeConfig();
    if (!silent) resetLogSheet_();
    logToSheet_('Starting Sync APP.Resources from Code');

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEETS.RESOURCES);
    if (!sheet) throw new Error('Resources sheet not found');

    // â”€â”€ Detect and add missing column headers â”€â”€
    var lastColumn = sheet.getLastColumn();
    var headers = [];
    if (lastColumn > 0) {
        headers = sheet.getRange(1, 1, 1, Math.max(lastColumn, 1)).getValues()[0];
    }
    if (headers.length === 1 && headers[0] === '') {
        headers = [];
    }
    var headersAdded = 0;
    var allCodeKeys = {};
    APP_RESOURCES_CODE_CONFIG.forEach(function (resource) {
        Object.keys(resource).forEach(function (key) {
            allCodeKeys[key] = true;
        });
    });
    Object.keys(allCodeKeys).forEach(function (key) {
        if (headers.indexOf(key) === -1) {
            var nextCol = headers.length + 1;
            if (nextCol > sheet.getMaxColumns()) {
                var missingHeaderCols = nextCol - sheet.getMaxColumns();
                sheet.insertColumnsAfter(sheet.getMaxColumns(), missingHeaderCols);
            }
            sheet.getRange(1, nextCol).setValue(key);
            headers.push(key);
            headersAdded++;
        }
    });

    logToSheet_('Headers checked, columns added: ' + headersAdded);

    // Re-read headers if new ones were added
    if (headersAdded > 0) {
        var latestColCount = Math.max(sheet.getLastColumn(), 1);
        headers = sheet.getRange(1, 1, 1, latestColCount).getValues()[0];
    }

    const idx = {};
    headers.forEach(function (h, i) { idx[h] = i; });

    const existingValues = sheet.getDataRange().getValues();
    const resourceRowMap = {}; // Name -> rowIndex (1-based)
    for (let r = 1; r < existingValues.length; r++) {
        const name = (existingValues[r][idx['Name']] || '').toString().trim();
        if (name) {
            resourceRowMap[name] = r + 1; // 1-based row index for updating
        }
    }

    let updated = 0;
    let added = 0;

    APP_RESOURCES_CODE_CONFIG.forEach(function (resource) {
        if (resourceRowMap[resource.Name]) {
            // Update existing record
            const rowNum = resourceRowMap[resource.Name];
            Object.keys(resource).forEach(function (key) {
                // Preserve user-managed config columns on sync unless code explicitly provides a non-empty value.
                if (idx[key] !== undefined && key !== 'FileID' && (key !== 'ListViews' || (resource.ListViews && resource.ListViews !== ''))) {
                    sheet.getRange(rowNum, idx[key] + 1).setValue(resource[key]);
                }
            });
            // FileID is intentionally left as-is on existing rows.
            updated++;
        } else {
            // Add new record â€” use setValues after clearing any inherited data validation
            const newRow = [];
            headers.forEach(function (h) {
                if (resource[h] !== undefined) {
                    newRow.push(resource[h]);
                } else if (h === 'FileID') {
                    // Leave blank â€” config-driven resolution at runtime
                    newRow.push('');
                } else {
                    newRow.push('');
                }
            });
            if (newRow.length > sheet.getMaxColumns()) {
                var neededColumns = newRow.length - sheet.getMaxColumns();
                sheet.insertColumnsAfter(sheet.getMaxColumns(), neededColumns);
            }
            var targetRowNum = sheet.getLastRow() + 1;
            if (targetRowNum > sheet.getMaxRows()) {
                var neededRows = targetRowNum - sheet.getMaxRows();
                sheet.insertRowsAfter(sheet.getMaxRows(), neededRows);
            }
            var targetRange = sheet.getRange(targetRowNum, 1, 1, newRow.length);
            targetRange.clearDataValidations();
            targetRange.setValues([newRow]);
            added++;
        }
    });

    logToSheet_('Resources: ' + added + ' added, ' + updated + ' updated');
    logToSheet_('APP.Resources sync completed');

    if (!silent) {
        try {
            SpreadsheetApp.getUi().alert('APP.Resources Sync Complete.\n\nNew columns added: ' + headersAdded + '\nResources added: ' + added + '\nResources updated: ' + updated + '\n\nNote: If any resources exist in an external file instead of the core APP file, make sure to manually set their FileID in the sheet.');
        } catch (e) {
            // Context without UI
        }
    }

    // Clear the resource config cache after sync
    if (typeof clearAllAppCaches === 'function') {
        clearAllAppCaches();
    }
}

