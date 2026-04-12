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
        Menu: JSON.stringify([{ group: ['Product'], order: 1, label: 'Manage', icon: 'inventory_2', route: '/masters/products', pageTitle: 'Products', pageDescription: 'Manage product master records (parent models)', show: true, menuAccess: { require: 'canWrite' } }]),
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
        RequiredHeaders: 'ProductCode,Status',
        UniqueHeaders: 'Code',
        UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Active"}',
        RecordAccessPolicy: 'ALL',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: '',
        Menu: JSON.stringify([{ group: ['Masters', 'Product'], order: 2, label: 'SKUs', icon: 'style', route: '/masters/skus', pageTitle: 'SKUs', pageDescription: 'Manage sellable SKUs (child variants of a product)', show: true }]),
        UIFields: JSON.stringify([
            { header: 'ProductCode', label: 'Product Code', type: 'text', required: true },
            { header: 'Variant1', label: 'Variant 1', type: 'text' },
            { header: 'Variant2', label: 'Variant 2', type: 'text' },
            { header: 'Variant3', label: 'Variant 3', type: 'text' },
            { header: 'Variant4', label: 'Variant 4', type: 'text' },
            { header: 'Variant5', label: 'Variant 5', type: 'text' },
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
        Menu: JSON.stringify([{ group: ['Masters', 'Procurement'], order: 3, label: 'Suppliers', icon: 'handshake', route: '/masters/suppliers', pageTitle: 'Suppliers', pageDescription: 'Manage supplier master records', show: true }]),
        UIFields: JSON.stringify([
            { header: 'Name', label: 'Name', type: 'text', required: true },
            { header: 'Country', label: 'Country', type: 'text' },
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
        AdditionalActions: '',
        Menu: JSON.stringify([{ group: ['Warehouse'], order: 1, label: 'Manage', icon: 'warehouse', route: '/masters/warehouses', pageTitle: 'Warehouses', pageDescription: 'Manage warehouse master records', show: true }]),
        Menu: JSON.stringify([
            {"group":["Warehouse"],"order":1,"label":"Manage","icon":"warehouse","route":"/masters/warehouses","pageTitle":"Warehouses","pageDescription":"Manage warehouse master records","show":true},
            {"group":["Stock"],"order":2,"label":"Warehouse","icon":"warehouse","route":"/masters/warehouses/stock","pageTitle":"Warehouse Product Stocks","pageDescription":"Get the report of Stocks of a Warehouse","show":true}
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
        Menu: JSON.stringify([{ group: ['Masters', 'Logistics'], order: 5, label: 'Ports', icon: 'anchor', route: '/masters/ports', pageTitle: 'Ports', pageDescription: 'Manage port master records', show: true }]),
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
        Menu: JSON.stringify([{ group: ['Masters', 'Logistics'], order: 6, label: 'Carriers', icon: 'local_shipping', route: '/masters/carriers', pageTitle: 'Carriers', pageDescription: 'Manage carrier master records', show: true }]),
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
        Name: CONFIG.OPERATION_SHEETS.PROCUREMENTS,
        Scope: 'operation',
        IsActive: 'TRUE',
        SheetName: CONFIG.OPERATION_SHEETS.PROCUREMENTS,
        CodePrefix: 'PRC',
        CodeSequenceLength: 5,
        LastDataUpdatedAt: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'CreatedRole',
        UniqueHeaders: '',
        UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Active","Progress":"INITIATED"}',
        RecordAccessPolicy: 'OWNER_AND_UPLINE',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: '',
        Menu: JSON.stringify([{ group: ['Operations', 'Procurement'], order: 0, label: 'Procurements', icon: 'shopping_cart', route: '/operations/procurements', pageTitle: 'Procurements', pageDescription: 'Central tracked procurement request', show: false }]),
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
        Name: CONFIG.OPERATION_SHEETS.PURCHASE_REQUISITIONS,
        Scope: 'operation',
        ParentResource: CONFIG.OPERATION_SHEETS.PROCUREMENTS,
        IsActive: 'TRUE',
        SheetName: CONFIG.OPERATION_SHEETS.PURCHASE_REQUISITIONS,
        CodePrefix: 'PR',
        CodeSequenceLength: 6,
        LastDataUpdatedAt: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'ProcurementCode',
        UniqueHeaders: '',
        UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Active","Progress":"PENDING"}',
        RecordAccessPolicy: 'OWNER_AND_UPLINE',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: 'Approve,Reject,Verify',
        Menu: JSON.stringify([{ group: ['Operations', 'Procurement'], order: 1, label: 'Purchase Requisitions', icon: 'request_quote', route: '/operations/prs', pageTitle: 'Purchase Requisitions', pageDescription: 'Internal requests for purchase', show: true }]),
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
        CodeSequenceLength: 6,
        LastDataUpdatedAt: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'PRCode,SKU',
        UniqueHeaders: '',
        UniqueCompositeHeaders: 'PRCode+SKU',
        DefaultValues: '{"Status":"Active"}',
        RecordAccessPolicy: 'OWNER_AND_UPLINE',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: '',
        Menu: JSON.stringify([{ group: ['Operations', 'Procurement'], order: 3, label: 'PR Items', icon: 'list', route: '', pageTitle: 'PR Items', pageDescription: 'Items in Purchase Requisition', show: false }]),
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
        AdditionalActions: 'Publish,Close',
        Menu: JSON.stringify([{ group: ['Operations', 'Procurement'], order: 2, label: 'RFQs', icon: 'compare_arrows', route: '/operations/rfqs', pageTitle: 'RFQs', pageDescription: 'Request For Quotation', show: true }]),
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
        Name: CONFIG.OPERATION_SHEETS.RFQ_ITEMS,
        Scope: 'operation',
        ParentResource: CONFIG.OPERATION_SHEETS.RFQS,
        IsActive: 'TRUE',
        SheetName: CONFIG.OPERATION_SHEETS.RFQ_ITEMS,
        CodePrefix: 'RFQI',
        CodeSequenceLength: 6,
        LastDataUpdatedAt: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'RFQCode,SKU',
        UniqueHeaders: '',
        UniqueCompositeHeaders: 'RFQCode+SKU',
        DefaultValues: '{"Status":"Active"}',
        RecordAccessPolicy: 'OWNER_AND_UPLINE',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: '',
        Menu: JSON.stringify([{ group: ['Operations', 'Procurement'], order: 5, label: 'RFQ Items', icon: 'list', route: '', pageTitle: 'RFQ Items', pageDescription: 'Items requested for quotation', show: false }]),
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
        DefaultValues: '{"Status":"Active","Progress":"SENT"}',
        RecordAccessPolicy: 'OWNER_AND_UPLINE',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: '',
        Menu: JSON.stringify([{ group: ['Operations', 'Procurement'], order: 6, label: 'RFQ Suppliers', icon: 'people', route: '', pageTitle: 'RFQ Suppliers', pageDescription: 'Suppliers targeted for RFQ', show: false }]),
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
        DefaultValues: '{"Status":"Active"}',
        RecordAccessPolicy: 'ALL',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: '',
        Menu: JSON.stringify([{ group: ['Operations', 'Procurement'], order: 3, label: 'Supplier Quotations', icon: 'attach_money', route: '/operations/quotations', pageTitle: 'Supplier Quotations', pageDescription: 'Quotations received from suppliers', show: true }]),
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
        RequiredHeaders: 'QuotationCode,SKU',
        UniqueHeaders: '',
        UniqueCompositeHeaders: 'QuotationCode+SKU',
        DefaultValues: '{"Status":"Active"}',
        RecordAccessPolicy: 'ALL',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: '',
        Menu: JSON.stringify([{ group: ['Operations', 'Procurement'], order: 8, label: 'Quotation Items', icon: 'list', route: '', pageTitle: 'Quotation Items', pageDescription: '', show: false }]),
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
        RequiredHeaders: 'ProcurementCode,SupplierCode',
        UniqueHeaders: '',
        UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Active","Progress":"DRAFT"}',
        RecordAccessPolicy: 'OWNER_AND_UPLINE',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: 'Approve,Send,Acknowledge,Accept',
        Menu: JSON.stringify([{ group: ['Operations', 'Procurement'], order: 4, label: 'Purchase Orders', icon: 'fact_check', route: '/operations/pos', pageTitle: 'Purchase Orders', pageDescription: 'Orders sent to suppliers', show: true }]),
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
        RequiredHeaders: 'POCode,SKU',
        UniqueHeaders: '',
        UniqueCompositeHeaders: 'POCode+SKU',
        DefaultValues: '{"Status":"Active"}',
        RecordAccessPolicy: 'OWNER_AND_UPLINE',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: '',
        Menu: JSON.stringify([{ group: ['Operations', 'Procurement'], order: 10, label: 'PO Items', icon: 'list', route: '', pageTitle: 'PO Items', pageDescription: '', show: false }]),
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
        Menu: JSON.stringify([{ group: ['Operations', 'Procurement'], order: 11, label: 'PO Documents', icon: 'folder', route: '', pageTitle: 'PO Fulfillments', pageDescription: 'Documents related to POs', show: false }]),
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
        Menu: JSON.stringify([{ group: ['Operations', 'Procurement'], order: 5, label: 'Shipments', icon: 'directions_boat', route: '/operations/shipments', pageTitle: 'Shipments', pageDescription: 'Manage inward shipments', show: true }]),
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
        Menu: JSON.stringify([{ group: ['Operations', 'Procurement'], order: 2, label: 'Shipment Items', icon: 'view_list', route: '', pageTitle: 'Shipment Items', pageDescription: 'Items in a shipment', show: false }]),
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
        Menu: JSON.stringify([{ group: ['Operations', 'Warehouse'], order: 5, label: 'Port Clearance', icon: 'verified_user', route: '/operations/port-clearance', pageTitle: 'Port Clearance', pageDescription: 'Manage customs clearance', show: true }]),
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
        IsActive: 'TRUE',
        SheetName: CONFIG.OPERATION_SHEETS.GOODS_RECEIPTS,
        CodePrefix: 'GRN',
        CodeSequenceLength: 6,
        LastDataUpdatedAt: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'ShipmentCode,WarehouseCode',
        UniqueHeaders: '',
        UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Draft"}',
        RecordAccessPolicy: 'OWNER_AND_UPLINE',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: 'Verify,Accept',
        Menu: JSON.stringify([{ group: ['Operations', 'Warehouse'], order: 6, label: 'Goods Receipts', icon: 'receipt_long', route: '/operations/goods-receipts', pageTitle: 'Goods Receipts', pageDescription: 'Manage inward warehouse receiving', show: true }]),
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
        RequiredHeaders: 'GRNCode,SKU',
        UniqueHeaders: '',
        UniqueCompositeHeaders: 'GRNCode+SKU',
        DefaultValues: '{"Status":"Active"}',
        RecordAccessPolicy: 'OWNER_AND_UPLINE',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: '',
        Menu: JSON.stringify([{ group: ['Operations', 'Warehouse'], order: 5, label: 'GRN Items', icon: 'view_list', route: '', pageTitle: 'GRN Items', pageDescription: 'Items in a goods receipt', show: false }]),
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
            { group: ['Warehouse'], order: 2, label: 'Stock Movements', icon: 'inventory', route: '/operations/stock-movements', pageTitle: 'Stock Movements', pageDescription: 'View stock movement records', show: true },
            { group: ['Warehouse'], order: 3, label: 'Direct Stock Entry', icon: 'edit_note', route: '/operations/stock-movements/direct-entry', pageTitle: 'Direct Stock Entry', pageDescription: 'Directly enter stock quantities', show: true, menuAccess: { require: 'canWrite' } }
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
        Menu: JSON.stringify([{ group: ['Operations', 'Warehouse'], order: 4, label: 'Warehouse Storages', icon: 'inventory', route: '/operations/warehouse-storages', pageTitle: 'Warehouse Storages', pageDescription: 'Real-time updated inventory locations', show: true }]),
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
        Menu: JSON.stringify([{ group: ['Accounts'], order: 1, label: 'Chart Of Accounts', icon: 'account_balance_wallet', route: '/masters/chart-of-accounts', pageTitle: 'Chart of Accounts', pageDescription: 'COA Ledger structure', show: true }]),
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
        Menu: JSON.stringify([{ group: ['Accounts'], order: 2, label: 'Entry Templates', icon: 'dynamic_form', route: '/masters/entry-templates', pageTitle: 'Entry Templates', pageDescription: 'Templates for accounting entries', show: true }]),
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
        Menu: JSON.stringify([{ group: ['Accounts'], order: 3, label: 'Assets', icon: 'assured_workload', route: '/accounts/assets', pageTitle: 'Assets Tracker', pageDescription: 'Asset account entries', show: true }]),
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
        Menu: JSON.stringify([{ group: ['Accounts'], order: 4, label: 'Liabilities', icon: 'account_balance', route: '/accounts/liabilities', pageTitle: 'Liabilities Tracker', pageDescription: 'Liability account entries', show: true }]),
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
        Menu: JSON.stringify([{ group: ['Accounts'], order: 5, label: 'Equity', icon: 'monetization_on', route: '/accounts/equity', pageTitle: 'Equity Tracker', pageDescription: 'Equity account entries', show: true }]),
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
        Menu: JSON.stringify([{ group: ['Accounts'], order: 6, label: 'Revenue', icon: 'trending_up', route: '/accounts/revenue', pageTitle: 'Revenue Tracker', pageDescription: 'Revenue account entries', show: true }]),
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
        Menu: JSON.stringify([{ group: ['Accounts'], order: 7, label: 'Expenses', icon: 'trending_down', route: '/accounts/expenses', pageTitle: 'Expenses Tracker', pageDescription: 'Expense account entries', show: true }]),
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
        Menu: JSON.stringify([{ group: ['Masters'], order: 99, label: 'Bulk Upload', icon: 'cloud_upload', route: '/masters/bulk-upload', pageTitle: 'Bulk Upload Masters', pageDescription: 'Upload bulk data to any master resource', show: true }]),
        UIFields: JSON.stringify([]),
        IncludeInAuthorizationPayload: 'TRUE',
        Functional: 'TRUE',
        PreAction: '',
        PostAction: 'handleBulkUpsertRecords',
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
