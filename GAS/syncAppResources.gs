/**
 * ============================================================
 * AQL - Sync APP.Resources from Code
 * ============================================================
 * Defines the default registry of APP.Resources in code so they can
 * be synced to the Google Sheet with one click.
 */

const APP_RESOURCES_CODE_CONFIG = [
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
        Reports: JSON.stringify([{"id":"rep_1774663957785","name":"product-list","label":"Product List","templateSheet":"ProductList","isRecordLevel":false,"inputs":[],"pdfOptions":{}}]),
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
        DefaultValues: '{"Status":"Active"}',
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
        DefaultValues: '{"Status":"Active"}',
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
        DefaultValues: '{"Status":"Active","Country":"UAE","Type":"Main"}',
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
            { header: 'City', label: 'City', type: 'text' },
            { header: 'Country', label: 'Country', type: 'text' },
            { header: 'Type', label: 'Type', type: 'text' },
            { header: 'Status', label: 'Status', type: 'status', required: true }
        ]),
        IncludeInAuthorizationPayload: 'TRUE',
        Functional: 'FALSE',
        PreAction: '',
        PostAction: '',
        Reports: JSON.stringify([{"id":"rep_1775978359788","name":"stock-report","label":"Stock Report","templateSheet":"WarehouseStockReport","isRecordLevel":true,"inputs":[{"targetCell":"AD10","field":"Code"}]}]),
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
        DefaultValues: '{"Status":"Active","Country":"UAE"}',
        RecordAccessPolicy: 'ALL',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: '',
        Menu: JSON.stringify([{"group":["Outlet Operations"],"order":1,"label":"Outlets","icon":"storefront","route":"/masters/outlets","pageTitle":"Outlets","pageDescription":"Manage outlet master records","show":true}]),
        UIFields: JSON.stringify([
            { header: 'Name', label: 'Name', type: 'text', required: true },
            { header: 'ContactPerson', label: 'Contact Person', type: 'text' },
            { header: 'Phone', label: 'Phone', type: 'text' },
            { header: 'Email', label: 'Email', type: 'text' },
            { header: 'Country', label: 'Country', type: 'text' },
            { header: 'Province', label: 'Province', type: 'text' },
            { header: 'City', label: 'City', type: 'text' },
            { header: 'CommunicationAddress', label: 'Communication Address', type: 'textarea' },
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
        Name: CONFIG.MASTER_SHEETS.OUTLET_OPERATING_RULES,
        Scope: 'master',
        ParentResource: CONFIG.MASTER_SHEETS.OUTLETS,
        IsActive: 'TRUE',
        SheetName: CONFIG.MASTER_SHEETS.OUTLET_OPERATING_RULES,
        CodePrefix: 'OOR',
        CodeSequenceLength: 5,
        LastDataUpdatedAt: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'OutletCode',
        UniqueHeaders: '',
        UniqueCompositeHeaders: 'OutletCode',
        DefaultValues: '{"Status":"Active","MaxStockValueLimit":0,"VisitFrequencyDays":14,"CreditLimit":0}',
        RecordAccessPolicy: 'ALL',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: '',
        Menu: JSON.stringify([{"group":["Outlet Operations"],"order":2,"label":"Operating Rules","icon":"rule","route":"/masters/outlet-operating-rules","pageTitle":"Outlet Operating Rules","pageDescription":"Manage outlet operating rules","show":true}]),
        UIFields: JSON.stringify([
            { header: 'OutletCode', label: 'Outlet Code', type: 'text', required: true },
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
        Name: CONFIG.MASTER_SHEETS.PORTS,
        Scope: 'master',
        IsActive: 'TRUE',
        SheetName: CONFIG.MASTER_SHEETS.PORTS,
        CodePrefix: 'PORT',
        CodeSequenceLength: 3,
        LastDataUpdatedAt: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'Name,Status',
        UniqueHeaders: 'Name',
        UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Active","Country":"UAE"}',
        RecordAccessPolicy: 'ALL',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: '',
        Menu: JSON.stringify([]),
        UIFields: JSON.stringify([
            { header: 'Name', label: 'Name', type: 'text', required: true },
            { header: 'Country', label: 'Country', type: 'text' },
            { header: 'PortType', label: 'Port Type', type: 'text' },
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
        Name: CONFIG.MASTER_SHEETS.CARRIERS,
        Scope: 'master',
        IsActive: 'TRUE',
        SheetName: CONFIG.MASTER_SHEETS.CARRIERS,
        CodePrefix: 'CARR',
        CodeSequenceLength: 4,
        LastDataUpdatedAt: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'Name,Status',
        UniqueHeaders: 'Name',
        UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Active"}',
        RecordAccessPolicy: 'ALL',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: '',
        Menu: JSON.stringify([]),
        UIFields: JSON.stringify([
            { header: 'Name', label: 'Name', type: 'text', required: true },
            { header: 'Type', label: 'Type', type: 'text' },
            { header: 'Phone', label: 'Phone', type: 'text' },
            { header: 'ContactPerson', label: 'Contact Person', type: 'text' },
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
        ParentResource: CONFIG.OPERATION_SHEETS.PROCUREMENTS,
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
        ParentResource: CONFIG.OPERATION_SHEETS.PROCUREMENTS,
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
        ParentResource: CONFIG.OPERATION_SHEETS.PROCUREMENTS,
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
        RequiredHeaders: 'OutletCode,Date,Status', UniqueHeaders: '', UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"PLANNED"}', RecordAccessPolicy: 'OWNER_AND_UPLINE', OwnerUserField: 'CreatedBy',
        AdditionalActions: JSON.stringify([
            { "action": "Complete", "label": "Complete", "icon": "task_alt", "color": "positive", "kind": "mutate", "confirm": false, "column": "Status", "columnValue": "COMPLETED", "columnValueOptions": [], "fields": [{ "name": "StatusCompletedComment", "label": "Completion Comment", "type": "textarea", "required": false }], "visibleWhen": { "column": "Status", "op": "eq", "value": "PLANNED" } },
            { "action": "Postpone", "label": "Postpone", "icon": "event_repeat", "color": "warning", "kind": "mutate", "confirm": false, "column": "Status", "columnValue": "POSTPONED", "columnValueOptions": [], "fields": [{ "name": "StatusPostponedComment", "label": "Postpone Reason", "type": "textarea", "required": true }], "visibleWhen": { "column": "Status", "op": "eq", "value": "PLANNED" } },
            { "action": "Cancel", "label": "Cancel", "icon": "cancel", "color": "negative", "kind": "mutate", "confirm": false, "column": "Status", "columnValue": "CANCELLED", "columnValueOptions": [], "fields": [{ "name": "StatusCancelledComment", "label": "Cancellation Reason", "type": "textarea", "required": true }], "visibleWhen": { "column": "Status", "op": "eq", "value": "PLANNED" } }
        ]),
        Menu: JSON.stringify([{ "group": ["Field Sales"], "order": 1, "label": "Outlet Visits", "icon": "event_available", "route": "/operations/outlet-visits", "pageTitle": "Outlet Visits", "pageDescription": "Plan and track field sales outlet visits", "show": true }]),
        UIFields: JSON.stringify([]), IncludeInAuthorizationPayload: 'TRUE', Functional: 'FALSE', PreAction: '', PostAction: '', Reports: '', CustomUIName: '', ListViews: ''
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
            { "action": "Approve", "label": "Approve", "icon": "task_alt", "color": "positive", "kind": "mutate", "confirm": false, "column": "Progress", "columnValue": "APPROVED", "fields": [{ "name": "ApprovedUser", "label": "Approved User", "type": "text", "required": false }, { "name": "Comment", "label": "Approval Comment", "type": "textarea", "required": false }], "visibleWhen": { "column": "Progress", "op": "eq", "value": "PENDING_APPROVAL" } },
            { "action": "Reject", "label": "Reject", "icon": "block", "color": "negative", "kind": "mutate", "confirm": false, "column": "Progress", "columnValue": "REJECTED", "fields": [{ "name": "Comment", "label": "Rejection Comment", "type": "textarea", "required": true }], "visibleWhen": { "column": "Progress", "op": "eq", "value": "PENDING_APPROVAL" } },
            { "action": "SendBack", "label": "Send Back", "icon": "undo", "color": "warning", "kind": "mutate", "confirm": false, "column": "Progress", "columnValue": "REVISION_REQUIRED", "fields": [{ "name": "Comment", "label": "Revision Comment", "type": "textarea", "required": true }], "visibleWhen": { "column": "Progress", "op": "eq", "value": "PENDING_APPROVAL" } }
        ]),
        Menu: JSON.stringify([{ "group": ["Field Sales"], "order": 2, "label": "Outlet Restocks", "icon": "inventory", "route": "/operations/outlet-restocks", "pageTitle": "Outlet Restocks", "pageDescription": "Request, approve, and fulfill outlet restocks", "show": true }]),
        UIFields: JSON.stringify([]), IncludeInAuthorizationPayload: 'TRUE', Functional: 'FALSE', PreAction: '', PostAction: '', Reports: '', CustomUIName: '', ListViews: ''
    },
    {
        Name: CONFIG.OPERATION_SHEETS.OUTLET_RESTOCK_ITEMS,
        Scope: 'operation', ParentResource: CONFIG.OPERATION_SHEETS.OUTLET_RESTOCKS, IsActive: 'TRUE', SheetName: CONFIG.OPERATION_SHEETS.OUTLET_RESTOCK_ITEMS,
        CodePrefix: 'ORSI', CodeSequenceLength: 7, LastDataUpdatedAt: 0, Audit: 'TRUE', RequiredHeaders: 'OutletRestockCode,SKU,Quantity', UniqueHeaders: '', UniqueCompositeHeaders: 'OutletRestockCode+SKU', DefaultValues: '{"Status":"Active","Quantity":0}', RecordAccessPolicy: 'OWNER_AND_UPLINE', OwnerUserField: 'CreatedBy', AdditionalActions: '', Menu: JSON.stringify([]), UIFields: JSON.stringify([]), IncludeInAuthorizationPayload: 'TRUE', Functional: 'FALSE', PreAction: '', PostAction: '', Reports: '', CustomUIName: '', ListViews: ''
    },
    {
        Name: CONFIG.OPERATION_SHEETS.OUTLET_DELIVERIES,
        Scope: 'operation', IsActive: 'TRUE', SheetName: CONFIG.OPERATION_SHEETS.OUTLET_DELIVERIES,
        CodePrefix: 'ODL', CodeSequenceLength: 6, LastDataUpdatedAt: 0, Audit: 'TRUE', RequiredHeaders: 'OutletRestockCode,OutletCode,WarehouseCode,ScheduledAt,ItemsJSON,Progress,Status', UniqueHeaders: '', UniqueCompositeHeaders: '', DefaultValues: '{"Status":"Active","Progress":"SCHEDULED"}', RecordAccessPolicy: 'OWNER_AND_UPLINE', OwnerUserField: 'CreatedBy', AdditionalActions: JSON.stringify([
            { "action": "Deliver", "label": "Deliver", "icon": "local_shipping", "color": "positive", "kind": "mutate", "confirm": true, "column": "Progress", "columnValue": "DELIVERED", "columnValueOptions": [], "fields": [], "visibleWhen": { "column": "Progress", "op": "eq", "value": "SCHEDULED" } },
            { "action": "Cancel", "label": "Cancel", "icon": "cancel", "color": "negative", "kind": "mutate", "confirm": true, "column": "Progress", "columnValue": "CANCELLED", "columnValueOptions": [], "fields": [{ "name": "Comment", "label": "Cancellation Comment", "type": "textarea", "required": false }], "visibleWhen": { "column": "Progress", "op": "eq", "value": "SCHEDULED" } }
        ]), Menu: JSON.stringify([{ "group": ["Field Sales"], "order": 3, "label": "Outlet Deliveries", "icon": "local_shipping", "route": "/operations/outlet-deliveries", "pageTitle": "Outlet Deliveries", "pageDescription": "Schedule, deliver, or cancel approved outlet restocks", "show": true }]), UIFields: JSON.stringify([
            { header: 'ScheduledAt', label: 'Scheduled At', type: 'datetime' },
            { header: 'DeliveredAt', label: 'Delivered At', type: 'datetime' },
            { header: 'CancelledAt', label: 'Cancelled At', type: 'datetime' },
            { header: 'ScheduledBy', label: 'Scheduled By', type: 'text' },
            { header: 'DeliveredBy', label: 'Delivered By', type: 'text' },
            { header: 'CancelledBy', label: 'Cancelled By', type: 'text' },
            { header: 'ItemsJSON', label: 'Items JSON', type: 'textarea' },
            { header: 'WarehouseCode', label: 'Warehouse Code', type: 'text', required: true },
            { header: 'OutletRestockCode', label: 'Outlet Restock Code', type: 'text', required: true },
            { header: 'OutletCode', label: 'Outlet Code', type: 'text', required: true },
            { header: 'Progress', label: 'Progress', type: 'status', required: true },
            { header: 'Status', label: 'Status', type: 'status', required: true },
            { header: 'AccessRegion', label: 'Access Region', type: 'text' },
            { header: 'Remarks', label: 'Remarks', type: 'textarea' }
        ]), IncludeInAuthorizationPayload: 'TRUE', Functional: 'FALSE', PreAction: '', PostAction: '', Reports: '', CustomUIName: '', ListViews: ''
    },
    {
        Name: CONFIG.OPERATION_SHEETS.OUTLET_CONSUMPTION,
        Scope: 'operation', IsActive: 'TRUE', SheetName: CONFIG.OPERATION_SHEETS.OUTLET_CONSUMPTION,
        CodePrefix: 'OCN', CodeSequenceLength: 6, LastDataUpdatedAt: 0, Audit: 'TRUE', RequiredHeaders: 'OutletCode,ConsumptionDate,RecordedByUserCode,Progress,Status', UniqueHeaders: '', UniqueCompositeHeaders: '', DefaultValues: '{"Status":"Active","Progress":"CONFIRMED"}', RecordAccessPolicy: 'OWNER_AND_UPLINE', OwnerUserField: 'CreatedBy', AdditionalActions: '', Menu: JSON.stringify([{ "group": ["Field Sales"], "order": 4, "label": "Outlet Consumption", "icon": "point_of_sale", "route": "/operations/outlet-consumption", "pageTitle": "Outlet Consumption", "pageDescription": "Record outlet stock consumption", "show": true }]), UIFields: JSON.stringify([]), IncludeInAuthorizationPayload: 'TRUE', Functional: 'FALSE', PreAction: '', PostAction: '', Reports: '', CustomUIName: '', ListViews: ''
    },
    {
        Name: CONFIG.OPERATION_SHEETS.OUTLET_CONSUMPTION_ITEMS,
        Scope: 'operation', ParentResource: CONFIG.OPERATION_SHEETS.OUTLET_CONSUMPTION, IsActive: 'TRUE', SheetName: CONFIG.OPERATION_SHEETS.OUTLET_CONSUMPTION_ITEMS,
        CodePrefix: 'OCNI', CodeSequenceLength: 7, LastDataUpdatedAt: 0, Audit: 'TRUE', RequiredHeaders: 'OutletConsumptionCode,SKU,ConsumedQty', UniqueHeaders: '', UniqueCompositeHeaders: 'OutletConsumptionCode+SKU', DefaultValues: '{"Status":"Active","ConsumedQty":0}', RecordAccessPolicy: 'OWNER_AND_UPLINE', OwnerUserField: 'CreatedBy', AdditionalActions: '', Menu: JSON.stringify([]), UIFields: JSON.stringify([]), IncludeInAuthorizationPayload: 'TRUE', Functional: 'FALSE', PreAction: '', PostAction: '', Reports: '', CustomUIName: '', ListViews: ''
    },
    {
        Name: CONFIG.OPERATION_SHEETS.OUTLET_MOVEMENTS,
        Scope: 'operation', IsActive: 'TRUE', SheetName: CONFIG.OPERATION_SHEETS.OUTLET_MOVEMENTS,
        CodePrefix: 'OMV', CodeSequenceLength: 7, LastDataUpdatedAt: 0, Audit: 'TRUE', RequiredHeaders: 'OutletCode,SKU,QtyChange,ReferenceType,ReferenceCode', UniqueHeaders: '', UniqueCompositeHeaders: '', DefaultValues: '{"Status":"Active","StorageName":"_default","QtyChange":0}', RecordAccessPolicy: 'OWNER_AND_UPLINE', OwnerUserField: 'CreatedBy', AdditionalActions: '', Menu: JSON.stringify([]), UIFields: JSON.stringify([]), IncludeInAuthorizationPayload: 'TRUE', Functional: 'FALSE', PreAction: '', PostAction: 'handleOutletMovementsBulkSave', Reports: '', CustomUIName: '', ListViews: ''
    },
    {
        Name: CONFIG.OPERATION_SHEETS.OUTLET_STORAGES,
        Scope: 'operation', IsActive: 'TRUE', SheetName: CONFIG.OPERATION_SHEETS.OUTLET_STORAGES,
        CodePrefix: 'OST', CodeSequenceLength: 7, LastDataUpdatedAt: 0, Audit: 'FALSE', RequiredHeaders: 'OutletCode,SKU,Quantity', UniqueHeaders: '', UniqueCompositeHeaders: 'OutletCode+SKU', DefaultValues: '{"Quantity":0}', RecordAccessPolicy: 'ALL', OwnerUserField: 'UpdatedBy', AdditionalActions: '', Menu: JSON.stringify([{ "group": ["Field Sales"], "order": 5, "label": "Outlet Stock", "icon": "store", "route": "/operations/outlet-storages", "pageTitle": "Outlet Stock", "pageDescription": "View movement-derived outlet stock balances", "show": true }]), UIFields: JSON.stringify([{ header: 'OutletCode', label: 'Outlet Code', type: 'text', required: true }, { header: 'SKU', label: 'SKU', type: 'text', required: true }, { header: 'Quantity', label: 'Quantity', type: 'number', required: true }]), IncludeInAuthorizationPayload: 'TRUE', Functional: 'FALSE', PreAction: '', PostAction: '', Reports: '', CustomUIName: '', ListViews: ''
    },
    {
        Name: CONFIG.OPERATION_SHEETS.PO_FULFILLMENTS,
        Scope: 'operation',
        ParentResource: CONFIG.OPERATION_SHEETS.PURCHASE_ORDERS,
        IsActive: 'TRUE',
        SheetName: CONFIG.OPERATION_SHEETS.PO_FULFILLMENTS,
        CodePrefix: 'POF',
        CodeSequenceLength: 6,
        LastDataUpdatedAt: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'POCode',
        UniqueHeaders: '',
        UniqueCompositeHeaders: '',
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
        Name: CONFIG.OPERATION_SHEETS.SHIPMENTS,
        Scope: 'operation',
        IsActive: 'TRUE',
        SheetName: CONFIG.OPERATION_SHEETS.SHIPMENTS,
        CodePrefix: 'SHP',
        CodeSequenceLength: 6,
        LastDataUpdatedAt: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'SupplierCode',
        UniqueHeaders: '',
        UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Draft"}',
        RecordAccessPolicy: 'OWNER_AND_UPLINE',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: 'Submit,Dispatch,Arrive,Clear',
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
        Name: CONFIG.OPERATION_SHEETS.SHIPMENT_ITEMS,
        Scope: 'operation',
        ParentResource: CONFIG.OPERATION_SHEETS.SHIPMENTS,
        IsActive: 'TRUE',
        SheetName: CONFIG.OPERATION_SHEETS.SHIPMENT_ITEMS,
        CodePrefix: 'SHPI',
        CodeSequenceLength: 6,
        LastDataUpdatedAt: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'ShipmentCode,SKU',
        UniqueHeaders: '',
        UniqueCompositeHeaders: 'ShipmentCode+SKU',
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
        Name: CONFIG.OPERATION_SHEETS.PORT_CLEARANCE,
        Scope: 'operation',
        IsActive: 'TRUE',
        SheetName: CONFIG.OPERATION_SHEETS.PORT_CLEARANCE,
        CodePrefix: 'CLR',
        CodeSequenceLength: 5,
        LastDataUpdatedAt: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'ShipmentCode',
        UniqueHeaders: 'ShipmentCode',
        UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Active","CustomsStatus":"Pending"}',
        RecordAccessPolicy: 'OWNER_AND_UPLINE',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: 'Submit,Hold,Clear',
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

function syncAppResourcesFromCode(silent) {
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
