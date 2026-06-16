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
        Menu: JSON.stringify([{"group":["Product"],"order":1,"label":"Manage","icon":"inventory_2","route":"/masters/products","pageTitle":"Products","pageDescription":"Manage product master records (parent models)","show":true,"menuAccess":{"require":"canWrite"}}]),
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
        IncludeInAuthorizationPayload: 'TRUE',
        Functional: 'FALSE',
        PreAction: '',
        PostAction: '',
        Reports: '',
        CustomUIName: '',
        ListViews: ''
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
             Menu: JSON.stringify([{"group":["Product"],"order":3,"label":"UOMs","icon":"straighten","route":"/masters/uoms","pageTitle":"Units of Measure","pageDescription":"Manage units of measure","show":true}]),
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
      Menu: JSON.stringify([{"group":["Masters"],"order":1,"label":"Currencies","icon":"attach_money","route":"/masters/currencies","pageTitle":"Currencies","pageDescription":"Manage currency master records","show":true}]),
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
      Menu: JSON.stringify([{"group":["Product"],"order":5,"label":"Price Lists","icon":"sell","route":"/masters/price-lists","pageTitle":"Price Lists","pageDescription":"Manage product price lists","show":true}]),
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
      ListViews: ''
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
          { header: 'Price', label: 'Price', type: 'number', required: true },
          { header: 'RSP', label: 'Retail Sale Price (RSP)', type: 'number' },
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
        ListViews: ''
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
        DefaultValues: '{"Status":"Active","MaxStockValueLimit":0,"VisitFrequencyDays":14,"CreditLimit":0}',
        RecordAccessPolicy: 'ALL',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: '',
        Menu: JSON.stringify([{"group":["Outlet Operations"],"order":2,"label":"Operating Rules","icon":"rule","route":"/masters/outlet-operating-rules","pageTitle":"Outlet Operating Rules","pageDescription":"Manage outlet operating rules","show":true}]),
        UIFields: JSON.stringify([
            { header: 'OutletCode', label: 'Outlet Code', type: 'text', required: true },
            { header: 'PriceListCode', label: 'Price List Code', type: 'text', hint: 'Optional. Falls back to IsDefault price list.' },
            { header: 'MaxStockValueLimit', label: 'Max Stock Value Limit', type: 'number' },
            { header: 'VisitFrequencyDays', label: 'Visit Frequency Days', type: 'number' },
            { header: 'CreditLimit', label: 'Credit Limit', type: 'number' },
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
        Menu: JSON.stringify([{"group":["Masters"],"order":2,"label":"Taxes","icon":"percent","route":"/masters/taxes","pageTitle":"Taxes","pageDescription":"Manage master tax categories and child sub-taxes","show":true}]),
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
        ListViews: ''
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
        Menu: JSON.stringify([{"group":["Procurement"],"order":0,"label":"Procurements","icon":"shopping_cart","route":"/operations/procurements","pageTitle":"Procurements","pageDescription":"Central tracked procurement request","show":false}]),
        UIFields: JSON.stringify([]),
        IncludeInAuthorizationPayload: 'TRUE',
        Functional: 'FALSE',
        PreAction: '',
        PostAction: 'linkProcurementCodeToPurchaseRequisition',
        Reports: '',
        CustomUIName: '',
        ListViews: ''
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
            {"action":"Approve","label":"Approve","icon":"","color":"primary","kind":"mutate","confirm":false,"column":"Progress","columnValue":"Approved","columnValueOptions":[],"fields":[],"visibleWhen":{"column":"Progress","op":"eq","value":"Pending Approval"}},
            {"action":"Reject","label":"Reject","icon":"","color":"warning","kind":"mutate","confirm":false,"column":"Progress","columnValue":"Rejected","columnValueOptions":[],"fields":[{"name":"Comment","label":"Comment","type":"textarea","required":true}],"visibleWhen":{"column":"Progress","op":"eq","value":"Pending Approval"}},
            {"action":"SendBack","label":"Request Revision","icon":"","color":"info","kind":"mutate","confirm":false,"column":"Progress","columnValue":"Revision Required","columnValueOptions":[],"fields":[{"name":"Comment","label":"Comment","type":"textarea","required":true}],"visibleWhen":{"column":"Progress","op":"eq","value":"Pending Approval"}}
        ]),
        Menu: JSON.stringify([
            {"group":["Procurement"],"order":2,"label":"Requisitions","icon":"request_quote","route":"/operations/purchase-requisitions","pageTitle":"Purchase Requisitions","pageDescription":"Internal requests for purchase","show":true},
            {"group":["Procurement"],"order":3,"label":"Initiate Purchase Requisitions","icon":"request_quote","route":"/operations/purchase-requisitions/initiate-purchase-requisitions","pageTitle":"Purchase Requisitions","pageDescription":"Initiate Purchase Requisition","show":true,"menuAccess":{"require":"canWrite"}}
        ]),
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
            {"action":"AssignSupplier","label":"Assign Supplier","icon":"group_add","color":"primary","kind":"navigate","confirm":false,"navigate":{"target":"record-page","pageSlug":"assign-supplier"},"visibleWhen":{"column":"Progress","op":"nin","value":["CLOSED","CANCELLED"]}},
            {"action":"MarkAsSent","label":"Mark As Sent","icon":"send","color":"secondary","kind":"navigate","confirm":false,"navigate":{"target":"record-page","pageSlug":"mark-as-sent"},"visibleWhen":{"column":"Progress","op":"nin","value":["CLOSED","CANCELLED"]}},
            {"action":"Close","label":"Close RFQ","icon":"lock","color":"negative","kind":"mutate","confirm":true,"column":"Progress","columnValue":"CLOSED","columnValueOptions":[],"fields":[],"visibleWhen":{"column":"Progress","op":"eq","value":"SENT"}}
        ]),
        Menu: JSON.stringify([
            {"group":["Procurement"],"order":4,"label":"Request For Quotations","icon":"request_quote","route":"/operations/rfqs","pageTitle":"Request for Quotations","pageDescription":"Manage requests for quotation","show":true}
        ]),
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
            {"group":["Procurement"],"order":5,"label":"Supplier Quotations","icon":"request_quote","route":"/operations/supplier-quotations","pageTitle":"Supplier Quotations","pageDescription":"Record and manage supplier quotation responses","show":true}
        ]),
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
            {"action":"Cancel","label":"Cancel","icon":"cancel","color":"negative","kind":"mutate","confirm":false,"column":"Progress","columnValue":"CANCELLED","columnValueOptions":[],"fields":[{"name":"Comment","label":"Cancel Comment","type":"textarea","required":true}],"visibleWhen":{"column":"Progress","op":"in","value":["CREATED","SENT","ACKNOWLEDGED"]}}
        ]),
        Menu: JSON.stringify([
            {"group":["Procurement"],"order":6,"label":"Purchase Orders","icon":"receipt_long","route":"/operations/purchase-orders","pageTitle":"Purchase Orders","pageDescription":"Manage purchase orders","show":true,"menuAccess":{"require":"canWrite"}}
        ]),
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
            {"action":"GenerateGRN","label":"Generate GRN","icon":"receipt_long","color":"primary","kind":"mutate","confirm":true,"column":"Progress","columnValue":"GRN_GENERATED","columnValueOptions":[],"fields":[{"name":"Comment","label":"GRN Generation Comment","type":"textarea","required":false}],"visibleWhen":{"column":"Progress","op":"eq","value":"CONFIRMED"}},
            {"action":"Cancel","label":"Cancel","icon":"cancel","color":"negative","kind":"mutate","confirm":false,"column":"Progress","columnValue":"CANCELLED","columnValueOptions":[],"fields":[{"name":"Comment","label":"Cancellation Comment","type":"textarea","required":true}],"visibleWhen":{"column":"Progress","op":"in","value":["DRAFT","CONFIRMED","GRN_GENERATED"]}}
        ]),
        Menu: JSON.stringify([
            {"group":["Procurement"],"order":7,"label":"PO Receiving","icon":"inventory_2","route":"/operations/po-receivings","pageTitle":"PO Receiving","pageDescription":"Inspect received purchase order quantities before GRN finalization","show":true,"menuAccess":{"require":"canWrite"}}
        ]),
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
            {"group":["Procurement"],"order":8,"label":"Goods Receipts","icon":"fact_check","route":"/operations/goods-receipts","pageTitle":"Goods Receipts","pageDescription":"View finalized GRNs generated from PO Receiving","show":true}
        ]),
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
        AdditionalActions: '',
        Menu: JSON.stringify([
            {"group":["Warehouse"],"order":2,"label":"Stock Movements","icon":"inventory","route":"/operations/stock-movements","pageTitle":"Stock Movements","pageDescription":"View stock movement records","show":true},
            {"group":["Warehouse"],"order":3,"label":"Direct Stock Entry","icon":"edit_note","route":"/operations/stock-movements/direct-entry","pageTitle":"Direct Stock Entry","pageDescription":"Directly enter stock quantities","show":true,"menuAccess":{"require":"canWrite"}},
            {"group":["Warehouse"],"order":4,"label":"GRN Stock Entry","icon":"receipt_long","route":"/operations/stock-movements/grn-entry","pageTitle":"GRN Stock Entry","pageDescription":"Post finalized GRN quantities into warehouse stock","show":true,"menuAccess":{"require":"canWrite"}},
            {"group":["Product"],"order":2,"label":"Movements - NI","icon":"inventory","route":"/masters/products","pageTitle":"Stock Movements","pageDescription":"View stock movement records","show":true}
        ]),
        UIFields: JSON.stringify([]),
        IncludeInAuthorizationPayload: 'TRUE',
        Functional: 'FALSE',
        PreAction: '',
        PostAction: 'handleStockMovementsBulkSave',
        Reports: '',
        CustomUIName: '',
        ListViews: ''
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
        ListViews: ''
    },
    {
        Name: CONFIG.OPERATION_SHEETS.OUTLET_VISITS,
        Scope: 'operation', IsActive: 'TRUE', SheetName: CONFIG.OPERATION_SHEETS.OUTLET_VISITS,
        CodePrefix: 'OV', CodeSequenceLength: 6, LastDataUpdatedAt: 0, Audit: 'TRUE',
        RequiredHeaders: 'OutletCode,Date,Progress,Status', UniqueHeaders: '', UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Active","Progress":"PLANNED"}', RecordAccessPolicy: 'OWNER_AND_UPLINE', OwnerUserField: 'CreatedBy',
        AdditionalActions: JSON.stringify([
            { "action": "Complete", "label": "Complete", "icon": "task_alt", "color": "positive", "kind": "mutate", "confirm": false, "column": "Progress", "columnValue": "COMPLETED", "columnValueOptions": [], "fields": [{ "name": "ProgressCompletedComment", "label": "Completion Comment", "type": "textarea", "required": false }], "visibleWhen": { "column": "Progress", "op": "eq", "value": "PLANNED" } },
            { "action": "Postpone", "label": "Postpone", "icon": "event_repeat", "color": "warning", "kind": "mutate", "confirm": false, "column": "Progress", "columnValue": "POSTPONED", "columnValueOptions": [], "fields": [{ "name": "ProgressPostponedComment", "label": "Postpone Reason", "type": "textarea", "required": true }], "visibleWhen": { "column": "Progress", "op": "eq", "value": "PLANNED" } },
            { "action": "Cancel", "label": "Cancel", "icon": "cancel", "color": "negative", "kind": "mutate", "confirm": false, "column": "Progress", "columnValue": "CANCELLED", "columnValueOptions": [], "fields": [{ "name": "ProgressCancelledComment", "label": "Cancellation Reason", "type": "textarea", "required": true }], "visibleWhen": { "column": "Progress", "op": "eq", "value": "PLANNED" } }
        ]),
        Menu: JSON.stringify([{ "group": ["Field Sales"], "order": 2, "label": "Outlet Visits", "icon": "event_available", "route": "/operations/outlet-visits", "pageTitle": "Outlet Visits", "pageDescription": "Plan and track field sales outlet visits", "show": true }]),
        UIFields: JSON.stringify([]), IncludeInAuthorizationPayload: 'TRUE', Functional: 'FALSE', PreAction: '', PostAction: '', Reports: JSON.stringify([
            {"id":"rep_1776000000012","name":"outlet-visits-today","label":"Visits Today","templateSheet":"OutletVisitsToday","isRecordLevel":false,"inputs":[],"pdfOptions":{}},
            {"id":"rep_1776000000013","name":"outlet-visits-tomorrow-upcoming","label":"Visits Tomorrow & Upcoming","templateSheet":"OutletVisitsTomorrowAndUpcomig","isRecordLevel":false,"inputs":[],"pdfOptions":{}},
            {"id":"rep_1776000000014","name":"outlet-visits-overdue","label":"Visits Overdue","templateSheet":"OutletVisitsOverdue","isRecordLevel":false,"inputs":[],"pdfOptions":{}}
        ]), CustomUIName: '', ListViews: ''
    },
    {
        Name: CONFIG.OPERATION_SHEETS.OUTLET_RESTOCKS,
        Scope: 'operation', IsActive: 'TRUE', SheetName: CONFIG.OPERATION_SHEETS.OUTLET_RESTOCKS,
        CodePrefix: 'ORS', CodeSequenceLength: 6, LastDataUpdatedAt: 0, Audit: 'TRUE',
        RequiredHeaders: 'Date,OutletCode,RequestedUser,Progress,Status', UniqueHeaders: '', UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Active","Progress":"DRAFT"}', RecordAccessPolicy: 'OWNER_AND_UPLINE', OwnerUserField: 'CreatedBy',
        AdditionalActions: JSON.stringify([
            { "action": "Submit", "label": "Submit", "icon": "send", "color": "primary", "kind": "mutate", "confirm": false, "column": "Progress", "columnValue": "PENDING_APPROVAL", "fields": [{ "name": "Comment", "label": "Submit Comment", "type": "textarea", "required": true }], "visibleWhen": { "column": "Progress", "op": "eq", "value": "REVISION_REQUIRED" } },
            { "action": "Submit", "label": "Submit", "icon": "send", "color": "primary", "kind": "mutate", "confirm": false, "column": "Progress", "columnValue": "PENDING_APPROVAL", "fields": [{ "name": "Comment", "label": "Submit Comment", "type": "textarea", "required": false }], "visibleWhen": { "column": "Progress", "op": "eq", "value": "DRAFT" } },
            { "action": "Reject", "label": "Reject", "icon": "block", "color": "negative", "kind": "mutate", "confirm": false, "column": "Progress", "columnValue": "REJECTED", "fields": [{ "name": "Comment", "label": "Rejection Comment", "type": "textarea", "required": true }], "visibleWhen": { "column": "Progress", "op": "eq", "value": "PENDING_APPROVAL" } },
            { "action": "SendBack", "label": "Send Back", "icon": "undo", "color": "warning", "kind": "mutate", "confirm": false, "column": "Progress", "columnValue": "REVISION_REQUIRED", "fields": [{ "name": "Comment", "label": "Revision Comment", "type": "textarea", "required": true }], "visibleWhen": { "column": "Progress", "op": "eq", "value": "PENDING_APPROVAL" } }
        ]),
        Menu: JSON.stringify([{ "group": ["Field Sales"], "order": 3, "label": "Outlet Restocks", "icon": "inventory", "route": "/operations/outlet-restocks", "pageTitle": "Outlet Restocks", "pageDescription": "Request, approve, and fulfill outlet restocks", "show": true }]),
        UIFields: JSON.stringify([]), IncludeInAuthorizationPayload: 'TRUE', Functional: 'FALSE', PreAction: '', PostAction: '', Reports: JSON.stringify([
            {"id":"rep_1776000000015","name":"restock-order","label":"Restock Order","templateSheet":"Restock","isRecordLevel":true,"inputs":[{"targetCell":"AB6","field":"Code"}],"pdfOptions":{}},
            {"id":"rep_1776000000016","name":"restock-log","label":"Restock Log","templateSheet":"RestockRecords","isRecordLevel":false,"inputs":[{"label":"User","type":"select","targetCell":"J11","source":{"resource":"OutletRestocks","field":"RequestedUser"},"default":"Any User","required":false},{"label":"Date","type":"select","targetCell":"J12","source":{"resource":"OutletRestocks","field":"Date"},"default":"Any Date","required":false},{"label":"Progress","type":"select","targetCell":"J13","source":{"resource":"OutletRestocks","field":"Progress"},"default":"All Progress","required":false}],"pdfOptions":{}}
        ]), CustomUIName: '', ListViews: ''
    },
    {
        Name: CONFIG.OPERATION_SHEETS.OUTLET_RESTOCK_ITEMS,
        Scope: 'operation', ParentResource: CONFIG.OPERATION_SHEETS.OUTLET_RESTOCKS, IsActive: 'TRUE', SheetName: CONFIG.OPERATION_SHEETS.OUTLET_RESTOCK_ITEMS,
        CodePrefix: 'ORSI', CodeSequenceLength: 7, LastDataUpdatedAt: 0, Audit: 'TRUE', RequiredHeaders: 'OutletRestockCode,SKU,Quantity', UniqueHeaders: '', UniqueCompositeHeaders: '', DefaultValues: '{"Status":"Active","Quantity":0,"Progress":"PENDING"}', RecordAccessPolicy: 'OWNER_AND_UPLINE', OwnerUserField: 'CreatedBy', AdditionalActions: JSON.stringify([{ "action": "Cancel", "label": "Cancel", "icon": "cancel", "color": "negative", "kind": "mutate", "confirm": false, "column": "Progress", "columnValue": "CANCELLED", "fields": [{ "name": "Comment", "label": "Cancel Comment", "type": "textarea", "required": true }], "visibleWhen": { "column": "Progress", "op": "eq", "value": "PENDING" } }]), Menu: JSON.stringify([]), UIFields: JSON.stringify([]), IncludeInAuthorizationPayload: 'TRUE', Functional: 'FALSE', PreAction: '', PostAction: '', Reports: '', CustomUIName: '', ListViews: ''
    },
    {
        Name: CONFIG.OPERATION_SHEETS.OUTLET_DELIVERIES,
        Scope: 'operation', IsActive: 'TRUE', SheetName: CONFIG.OPERATION_SHEETS.OUTLET_DELIVERIES,
        CodePrefix: 'ODL', CodeSequenceLength: 6, LastDataUpdatedAt: 0, Audit: 'TRUE', RequiredHeaders: 'Date,UserName,Progress,Status', UniqueHeaders: '', UniqueCompositeHeaders: '', DefaultValues: '{"Status":"Active","Progress":"DRAFT"}', RecordAccessPolicy: 'OWNER_AND_UPLINE', OwnerUserField: 'CreatedBy', AdditionalActions: '',
        Menu: JSON.stringify([{ "group": ["Field Sales"], "order": 4, "label": "Outlet Deliveries", "icon": "local_shipping", "route": "/operations/outlet-deliveries", "pageTitle": "Outlet Deliveries", "pageDescription": "Create, deliver, or cancel allocated outlet restock items", "show": true }]),
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
        ]), CustomUIName: '', ListViews: ''
    },
    {
        Name: CONFIG.OPERATION_SHEETS.OUTLET_RETURNS,
        Scope: 'operation', IsActive: 'TRUE', SheetName: CONFIG.OPERATION_SHEETS.OUTLET_RETURNS,
        CodePrefix: 'OR', CodeSequenceLength: 6, LastDataUpdatedAt: 0, Audit: 'TRUE',
        RequiredHeaders: 'OutletCode,Date,SKU,Qty', UniqueHeaders: '', UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Active","Qty":0,"Price":0,"Progress":"SUBMITTED","InvoiceAdjustmentRequired":false,"InvoiceAdjustmentDone":false,"WarehouseActionRequired":false,"WarehouseActionCompleted":false,"WarehouseAction":"","WarehouseActionDisposedReason":""}',
        RecordAccessPolicy: 'OWNER_AND_UPLINE', OwnerUserField: 'CreatedBy',
        AdditionalActions: JSON.stringify([
            { "action": "Dispose", "label": "Dispose Stock", "icon": "delete_outline", "color": "negative", "kind": "mutate", "confirm": true, "column": "WarehouseAction", "columnValue": "Disposed", "columnValueOptions": [], "fields": [{ "name": "WarehouseActionDisposedReason", "label": "Disposal Reason", "type": "textarea", "required": true }], "visibleWhen": { "column": "WarehouseActionCompleted", "op": "eq", "value": "FALSE" } },
            { "action": "Stock", "label": "Stock to Warehouse", "icon": "store", "color": "primary", "kind": "mutate", "confirm": true, "column": "WarehouseAction", "columnValue": "Stocked", "columnValueOptions": [], "fields": [], "visibleWhen": { "column": "WarehouseActionCompleted", "op": "eq", "value": "FALSE" } },
            { "action": "Cancel", "label": "Cancel", "icon": "cancel", "color": "negative", "kind": "mutate", "confirm": true, "column": "Progress", "columnValue": "CANCELLED", "columnValueOptions": [], "fields": [{ "name": "ProgressCancelledComment", "label": "Cancellation Reason", "type": "textarea", "required": true }], "visibleWhen": { "column": "Progress", "op": "nin", "value": ["CANCELLED"] } }
        ]),
        Menu: JSON.stringify([{ "group": ["Field Sales"], "order": 5, "label": "Outlet Returns", "icon": "assignment_return", "route": "/operations/outlet-returns", "pageTitle": "Outlet Returns", "pageDescription": "Track sales returns and unsold inventory returns from outlets", "show": true }]),
        UIFields: JSON.stringify([]), IncludeInAuthorizationPayload: 'TRUE', Functional: 'FALSE', PreAction: '', PostAction: '', Reports: JSON.stringify([
            {"id":"rep_1776000000019","name":"return-receipt","label":"Return Receipt","templateSheet":"Return","isRecordLevel":true,"inputs":[{"targetCell":"AB6","field":"Code"}],"pdfOptions":{}},
            {"id":"rep_1776000000020","name":"returns-log","label":"Returns Log","templateSheet":"ReturnRecords","isRecordLevel":false,"inputs":[{"label":"Username","type":"select","targetCell":"J11","source":{"resource":"OutletReturns","field":"Username"},"default":"Any User","required":false},{"label":"Date","type":"select","targetCell":"J12","source":{"resource":"OutletReturns","field":"Date"},"default":"All Date","required":false},{"label":"Return Reason","type":"select","targetCell":"J13","source":{"resource":"OutletReturns","field":"Reason"},"default":"Any Reason","required":false}],"pdfOptions":{}}
        ]), CustomUIName: '', ListViews: ''
    },
    {
        Name: CONFIG.OPERATION_SHEETS.OUTLET_CONSUMPTIONS,
        Scope: 'operation', IsActive: 'TRUE', SheetName: CONFIG.OPERATION_SHEETS.OUTLET_CONSUMPTIONS,
        CodePrefix: 'OC', CodeSequenceLength: 6, LastDataUpdatedAt: 0, Audit: 'TRUE', RequiredHeaders: 'OutletCode,Date,Username,Progress,Status', UniqueHeaders: '', UniqueCompositeHeaders: '', DefaultValues: '{"Status":"Active","Progress":"PENDING_INVOICE_GENERATION"}', RecordAccessPolicy: 'OWNER_AND_UPLINE', OwnerUserField: 'CreatedBy',
        AdditionalActions: JSON.stringify([
            {"action":"MarkInvoiceGenerated","label":"Mark Invoice Generated","icon":"receipt_long","color":"positive","kind":"mutate","confirm":true,"column":"Progress","columnValue":"INVOICE_GENERATED","columnValueOptions":[],"fields":[{"name":"Comment","label":"Comment","type":"textarea","required":false}],"visibleWhen":{"column":"Progress","op":"eq","value":"PENDING_INVOICE_GENERATION"}},
            {"action":"Cancel","label":"Cancel","icon":"cancel","color":"negative","kind":"mutate","confirm":true,"column":"Progress","columnValue":"CANCELLED","columnValueOptions":[],"fields":[{"name":"Comment","label":"Cancellation Comment","type":"textarea","required":true}],"visibleWhen":{"column":"Progress","op":"nin","value":["CANCELLED"]}}
        ]),
        Menu: JSON.stringify([{ "group": ["Field Sales"], "order": 6, "label": "Outlet Consumptions", "icon": "point_of_sale", "route": "/operations/outlet-consumptions", "pageTitle": "Outlet Consumptions", "pageDescription": "Record outlet stock consumption", "show": true }]), UIFields: JSON.stringify([]), IncludeInAuthorizationPayload: 'TRUE', Functional: 'FALSE', PreAction: '', PostAction: '', Reports: JSON.stringify([
            {"id":"rep_1776000000021","name":"consumption-receipt","label":"Consumption Receipt","templateSheet":"Consumption","isRecordLevel":true,"inputs":[{"targetCell":"AB6","field":"Code"}],"pdfOptions":{}},
            {"id":"rep_1776000000022","name":"consumption-records-log","label":"Consumption Log","templateSheet":"ConsumptionRecords","isRecordLevel":false,"inputs":[{"label":"Username","type":"select","targetCell":"J11","source":{"resource":"OutletConsumptions","field":"Username"},"default":"Any User","required":false},{"label":"Date","type":"select","targetCell":"J12","source":{"resource":"OutletConsumptions","field":"Date"},"default":"All Date","required":false}],"pdfOptions":{}}
        ]), CustomUIName: '', ListViews: ''
    },
    {
        Name: CONFIG.OPERATION_SHEETS.OUTLET_CONSUMPTION_ITEMS,
        Scope: 'operation', ParentResource: CONFIG.OPERATION_SHEETS.OUTLET_CONSUMPTIONS, IsActive: 'TRUE', SheetName: CONFIG.OPERATION_SHEETS.OUTLET_CONSUMPTION_ITEMS,
        CodePrefix: 'OCI', CodeSequenceLength: 7, LastDataUpdatedAt: 0, Audit: 'TRUE', RequiredHeaders: 'OutletConsumptionCode,SKU,Qty', UniqueHeaders: '', UniqueCompositeHeaders: 'OutletConsumptionCode+SKU', DefaultValues: '{"Status":"Active","Qty":0}', RecordAccessPolicy: 'OWNER_AND_UPLINE', OwnerUserField: 'CreatedBy', AdditionalActions: '', Menu: JSON.stringify([]), UIFields: JSON.stringify([]), IncludeInAuthorizationPayload: 'TRUE', Functional: 'FALSE', PreAction: '', PostAction: '', Reports: '', CustomUIName: '', ListViews: ''
    },
    {
        Name: CONFIG.OPERATION_SHEETS.OUTLET_CONSUMPTION_INVOICES,
        Scope: 'operation', ParentResource: '', IsActive: 'TRUE', SheetName: CONFIG.OPERATION_SHEETS.OUTLET_CONSUMPTION_INVOICES,
        CodePrefix: 'OCINV', CodeSequenceLength: 7, LastDataUpdatedAt: 0, Audit: 'TRUE', RequiredHeaders: 'OutletConsumptionCode,Date,OutletCode,Username,Progress,Status', UniqueHeaders: '', UniqueCompositeHeaders: '', DefaultValues: '{"Status":"Active","Subtotal":0,"Discount":0,"TotalTaxableAmount":0,"TotalTaxAmount":0,"TaxDetails":"[]","Progress":"PENDING_PAYMENT"}', RecordAccessPolicy: 'OWNER_AND_UPLINE', OwnerUserField: 'CreatedBy',
        AdditionalActions: JSON.stringify([
            {"action":"MarkPartiallyPaid","label":"Mark Partially Paid","icon":"payments","color":"info","kind":"mutate","confirm":true,"column":"Progress","columnValue":"PARTIALLY_PAID","columnValueOptions":[],"fields":[{"name":"Comment","label":"Comment","type":"textarea","required":false}],"visibleWhen":{"column":"Progress","op":"eq","value":"PENDING_PAYMENT"}},
            {"action":"MarkPaid","label":"Mark Paid","icon":"paid","color":"positive","kind":"mutate","confirm":true,"column":"Progress","columnValue":"PAID","columnValueOptions":[],"fields":[{"name":"Comment","label":"Comment","type":"textarea","required":false}],"visibleWhen":{"column":"Progress","op":"in","value":["PENDING_PAYMENT","PARTIALLY_PAID"]}},
            {"action":"Cancel","label":"Cancel","icon":"cancel","color":"negative","kind":"mutate","confirm":true,"column":"Progress","columnValue":"CANCELLED","columnValueOptions":[],"fields":[{"name":"Comment","label":"Cancellation Comment","type":"textarea","required":true}],"visibleWhen":{"column":"Progress","op":"nin","value":["PAID","CANCELLED"]}}
        ]),
        Menu: JSON.stringify([{ "group": ["Field Sales"], "order": 7, "label": "Consumption Invoices", "icon": "receipt_long", "route": "/operations/outlet-consumption-invoices", "pageTitle": "Consumption Invoices", "pageDescription": "View outlet consumption invoices", "show": true }]), UIFields: JSON.stringify([]), IncludeInAuthorizationPayload: 'TRUE', Functional: 'FALSE', PreAction: '', PostAction: '', Reports: JSON.stringify([
            {"id":"rep_1776000000023","name":"consumption-invoice","label":"Consumption Invoice","templateSheet":"ConsumptionInvoice","isRecordLevel":true,"inputs":[{"targetCell":"AB6","field":"Code"}],"pdfOptions":{}},
            {"id":"rep_1776000000024","name":"invoice-log","label":"Invoice Log","templateSheet":"InvoiceRecords","isRecordLevel":false,"inputs":[{"label":"Date","type":"select","targetCell":"J11","source":{"resource":"OutletConsumptionInvoices","field":"Date"},"default":"All Date","required":false},{"label":"Username","type":"select","targetCell":"J12","source":{"resource":"OutletConsumptionInvoices","field":"Username"},"default":"Any User","required":false},{"label":"Progress","type":"select","targetCell":"J13","source":{"resource":"OutletConsumptionInvoices","field":"Progress"},"default":"All Progress","required":false}],"pdfOptions":{}}
        ]), CustomUIName: '', ListViews: ''
    },
    {
        Name: CONFIG.OPERATION_SHEETS.OUTLET_CONSUMPTION_INVOICE_ITEMS,
        Scope: 'operation', ParentResource: CONFIG.OPERATION_SHEETS.OUTLET_CONSUMPTION_INVOICES, IsActive: 'TRUE', SheetName: CONFIG.OPERATION_SHEETS.OUTLET_CONSUMPTION_INVOICE_ITEMS,
        CodePrefix: 'OCII', CodeSequenceLength: 7, LastDataUpdatedAt: 0, Audit: 'TRUE', RequiredHeaders: 'OutletConsumptionInvoiceCode,SKU,Qty,Price', UniqueHeaders: '', UniqueCompositeHeaders: 'OutletConsumptionInvoiceCode+SKU', DefaultValues: '{"Status":"Active","Qty":0,"Price":0,"Total":0,"Discount":0,"TaxableAmount":0,"TaxAmount":0,"TaxCode":""}', RecordAccessPolicy: 'OWNER_AND_UPLINE', OwnerUserField: 'CreatedBy', AdditionalActions: '', Menu: JSON.stringify([]), UIFields: JSON.stringify([]), IncludeInAuthorizationPayload: 'TRUE', Functional: 'FALSE', PreAction: '', PostAction: '', Reports: '', CustomUIName: '', ListViews: ''
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
                "kind": "mutate",
                "confirm": false,
                "column": "Progress",
                "columnValue": "CANCELLED",
                "columnValueOptions": [],
                "fields": [
                    {
                        "name": "ProgressCancelledComment",
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
                "route": "/operations/outlet-payments",
                "pageTitle": "Outlet Payments",
                "pageDescription": "View and record outlet payments",
                "show": true
            }
        ]),
        UIFields: JSON.stringify([]),
        IncludeInAuthorizationPayload: 'TRUE',
        Functional: 'FALSE',
        PreAction: '',
        PostAction: '',
        Reports: JSON.stringify([
            {"id":"rep_1776000000025","name":"payment-receipt","label":"Payment Receipt","templateSheet":"Payment","isRecordLevel":true,"inputs":[{"targetCell":"AB6","field":"Code"}],"pdfOptions":{}},
            {"id":"rep_1776000000026","name":"payment-log","label":"Payment Log","templateSheet":"PaymentRecords","isRecordLevel":false,"inputs":[{"label":"Date","type":"select","targetCell":"J11","source":{"resource":"OutletPayments","field":"Date"},"default":"All Date","required":false},{"label":"Username","type":"select","targetCell":"J12","source":{"resource":"OutletPayments","field":"Username"},"default":"Any User","required":false},{"label":"Payment Mode","type":"select","targetCell":"J13","source":{"resource":"OutletPayments","field":"Mode"},"default":"Every Mode","required":false}],"pdfOptions":{}}
        ]),
        CustomUIName: '',
        ListViews: ''
    },
    {
        Name: CONFIG.OPERATION_SHEETS.OUTLET_MOVEMENTS,
        Scope: 'operation', IsActive: 'TRUE', SheetName: CONFIG.OPERATION_SHEETS.OUTLET_MOVEMENTS,
        CodePrefix: 'OMV', CodeSequenceLength: 7, LastDataUpdatedAt: 0, Audit: 'TRUE', RequiredHeaders: 'OutletCode,SKU,QtyChange,ReferenceType,ReferenceCode', UniqueHeaders: '', UniqueCompositeHeaders: '', DefaultValues: '{"Status":"Active","StorageName":"_default","QtyChange":0}', RecordAccessPolicy: 'OWNER_AND_UPLINE', OwnerUserField: 'CreatedBy', AdditionalActions: '', Menu: JSON.stringify([]), UIFields: JSON.stringify([]), IncludeInAuthorizationPayload: 'TRUE', Functional: 'FALSE', PreAction: '', PostAction: 'handleOutletMovementsBulkSave', Reports: '', CustomUIName: '', ListViews: ''
    },
    {
        Name: CONFIG.OPERATION_SHEETS.OUTLET_STORAGES,
        Scope: 'operation', IsActive: 'TRUE', SheetName: CONFIG.OPERATION_SHEETS.OUTLET_STORAGES,
        CodePrefix: 'OST', CodeSequenceLength: 7, LastDataUpdatedAt: 0, Audit: 'FALSE', RequiredHeaders: 'OutletCode,SKU,Quantity', UniqueHeaders: '', UniqueCompositeHeaders: 'OutletCode+SKU', DefaultValues: '{"Quantity":0}', RecordAccessPolicy: 'ALL', OwnerUserField: 'UpdatedBy', AdditionalActions: '',
        Menu: JSON.stringify([]), UIFields: JSON.stringify([{ header: 'OutletCode', label: 'Outlet Code', type: 'text', required: true }, { header: 'SKU', label: 'SKU', type: 'text', required: true }, { header: 'Quantity', label: 'Quantity', type: 'number', required: true }]), IncludeInAuthorizationPayload: 'TRUE', Functional: 'FALSE', PreAction: '', PostAction: '', Reports: '', CustomUIName: '', ListViews: ''
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
        ListViews: ''
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
        ListViews: ''
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
        ListViews: ''
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
        ListViews: ''
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
        ListViews: ''
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
        ListViews: ''
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
        ListViews: ''
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
        Menu: JSON.stringify([{"group":["Masters"],"order":99,"label":"Bulk Upload","icon":"cloud_upload","route":"/masters/bulk-upload","pageTitle":"Bulk Upload Masters","pageDescription":"Upload bulk data to any master resource","show":true}]),
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
                // Preserve user-managed config columns on sync.
                if (idx[key] !== undefined && key !== 'FileID' && key !== 'ListViews') {
                    sheet.getRange(rowNum, idx[key] + 1).setValue(resource[key]);
                }
            });
            // FileID and ListViews are intentionally left as-is on existing rows.
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
