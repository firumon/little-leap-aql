/**
 * ============================================================
 * Little Leap AQL - Sync APP.Resources from Code
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
        SkipColumns: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'Name,Status',
        UniqueHeaders: 'Name',
        UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Active"}',
        RecordAccessPolicy: 'ALL',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: '',
        MenuGroup: 'Masters',
        MenuOrder: 1,
        MenuLabel: 'Products',
        MenuIcon: 'inventory_2',
        RoutePath: '/masters/products',
        PageTitle: 'Products',
        PageDescription: 'Manage product master records (parent models)',
        UIFields: JSON.stringify([
            { header: 'Name', label: 'Name', type: 'text', required: true },
            { header: 'VariantTypes', label: 'Variant Types', type: 'text', hint: 'CSV e.g. Size,Color,Material' },
            { header: 'Status', label: 'Status', type: 'status', required: true }
        ]),
        ShowInMenu: 'TRUE',
        IncludeInAuthorizationPayload: 'TRUE'
    },
    {
        Name: CONFIG.MASTER_SHEETS.SKUS,
        Scope: 'master',
        ParentResource: CONFIG.MASTER_SHEETS.PRODUCTS,
        IsActive: 'TRUE',
        SheetName: CONFIG.MASTER_SHEETS.SKUS,
        CodePrefix: 'SKU',
        CodeSequenceLength: 6,
        SkipColumns: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'ProductCode,Status',
        UniqueHeaders: 'Code',
        UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Active"}',
        RecordAccessPolicy: 'ALL',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: '',
        MenuGroup: 'Masters',
        MenuOrder: 2,
        MenuLabel: 'SKUs',
        MenuIcon: 'style',
        RoutePath: '/masters/skus',
        PageTitle: 'SKUs',
        PageDescription: 'Manage sellable SKUs (child variants of a product)',
        UIFields: JSON.stringify([
            { header: 'ProductCode', label: 'Product Code', type: 'text', required: true },
            { header: 'Variant1', label: 'Variant 1', type: 'text' },
            { header: 'Variant2', label: 'Variant 2', type: 'text' },
            { header: 'Variant3', label: 'Variant 3', type: 'text' },
            { header: 'Variant4', label: 'Variant 4', type: 'text' },
            { header: 'Variant5', label: 'Variant 5', type: 'text' },
            { header: 'Status', label: 'Status', type: 'status', required: true }
        ]),
        ShowInMenu: 'TRUE',
        IncludeInAuthorizationPayload: 'TRUE'
    },
    {
        Name: CONFIG.MASTER_SHEETS.SUPPLIERS,
        Scope: 'master',
        IsActive: 'TRUE',
        SheetName: CONFIG.MASTER_SHEETS.SUPPLIERS,
        CodePrefix: 'SUP',
        CodeSequenceLength: 4,
        SkipColumns: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'Name,Status',
        UniqueHeaders: 'Name',
        UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Active"}',
        RecordAccessPolicy: 'ALL',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: '',
        MenuGroup: 'Masters',
        MenuOrder: 3,
        MenuLabel: 'Suppliers',
        MenuIcon: 'handshake',
        RoutePath: '/masters/suppliers',
        PageTitle: 'Suppliers',
        PageDescription: 'Manage supplier master records',
        UIFields: JSON.stringify([
            { header: 'Name', label: 'Name', type: 'text', required: true },
            { header: 'Country', label: 'Country', type: 'text' },
            { header: 'ContactPerson', label: 'Contact Person', type: 'text' },
            { header: 'Phone', label: 'Phone', type: 'text' },
            { header: 'Email', label: 'Email', type: 'text' },
            { header: 'Status', label: 'Status', type: 'status', required: true }
        ]),
        ShowInMenu: 'TRUE',
        IncludeInAuthorizationPayload: 'TRUE'
    },
    {
        Name: CONFIG.MASTER_SHEETS.WAREHOUSES,
        Scope: 'master',
        IsActive: 'TRUE',
        SheetName: CONFIG.MASTER_SHEETS.WAREHOUSES,
        CodePrefix: 'WH',
        CodeSequenceLength: 3,
        SkipColumns: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'Name,Status',
        UniqueHeaders: 'Name',
        UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Active","Country":"UAE","Type":"Main"}',
        RecordAccessPolicy: 'ALL',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: '',
        MenuGroup: 'Masters',
        MenuOrder: 4,
        MenuLabel: 'Warehouses',
        MenuIcon: 'warehouse',
        RoutePath: '/masters/warehouses',
        PageTitle: 'Warehouses',
        PageDescription: 'Manage warehouse master records',
        UIFields: JSON.stringify([
            { header: 'Name', label: 'Name', type: 'text', required: true },
            { header: 'City', label: 'City', type: 'text' },
            { header: 'Country', label: 'Country', type: 'text' },
            { header: 'Type', label: 'Type', type: 'text' },
            { header: 'Status', label: 'Status', type: 'status', required: true }
        ]),
        ShowInMenu: 'TRUE',
        IncludeInAuthorizationPayload: 'TRUE'
    },
    {
        Name: CONFIG.MASTER_SHEETS.WAREHOUSE_LOCATIONS,
        Scope: 'master',
        ParentResource: CONFIG.MASTER_SHEETS.WAREHOUSES,
        IsActive: 'TRUE',
        SheetName: CONFIG.MASTER_SHEETS.WAREHOUSE_LOCATIONS,
        CodePrefix: 'LOC',
        CodeSequenceLength: 5,
        SkipColumns: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'WarehouseCode,LocationCode,Status',
        UniqueHeaders: '',
        UniqueCompositeHeaders: 'WarehouseCode+LocationCode',
        DefaultValues: '{"Status":"Active"}',
        RecordAccessPolicy: 'ALL',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: '',
        MenuGroup: 'Masters',
        MenuOrder: 5,
        MenuLabel: 'Locations',
        MenuIcon: 'grid_on',
        RoutePath: '/masters/warehouse-locations',
        PageTitle: 'Warehouse Locations',
        PageDescription: 'Manage shelf/bin location master records',
        UIFields: JSON.stringify([
            { header: 'WarehouseCode', label: 'Warehouse Code', type: 'text', required: true },
            { header: 'LocationCode', label: 'Location Code', type: 'text', required: true },
            { header: 'Description', label: 'Description', type: 'text' },
            { header: 'Status', label: 'Status', type: 'status', required: true }
        ]),
        ShowInMenu: 'TRUE',
        IncludeInAuthorizationPayload: 'TRUE'
    },
    {
        Name: CONFIG.MASTER_SHEETS.CARRIERS,
        Scope: 'master',
        IsActive: 'TRUE',
        SheetName: CONFIG.MASTER_SHEETS.CARRIERS,
        CodePrefix: 'CARR',
        CodeSequenceLength: 4,
        SkipColumns: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'Name,Status',
        UniqueHeaders: 'Name',
        UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Active"}',
        RecordAccessPolicy: 'ALL',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: '',
        MenuGroup: 'Masters',
        MenuOrder: 6,
        MenuLabel: 'Carriers',
        MenuIcon: 'local_shipping',
        RoutePath: '/masters/carriers',
        PageTitle: 'Carriers',
        PageDescription: 'Manage carrier master records',
        UIFields: JSON.stringify([
            { header: 'Name', label: 'Name', type: 'text', required: true },
            { header: 'Type', label: 'Type', type: 'text' },
            { header: 'Phone', label: 'Phone', type: 'text' },
            { header: 'ContactPerson', label: 'Contact Person', type: 'text' },
            { header: 'Status', label: 'Status', type: 'status', required: true }
        ]),
        ShowInMenu: 'TRUE',
        IncludeInAuthorizationPayload: 'TRUE'
    },
    {
        Name: CONFIG.MASTER_SHEETS.PORTS,
        Scope: 'master',
        IsActive: 'TRUE',
        SheetName: CONFIG.MASTER_SHEETS.PORTS,
        CodePrefix: 'PORT',
        CodeSequenceLength: 3,
        SkipColumns: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'Name,Status',
        UniqueHeaders: 'Name',
        UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Active","Country":"UAE"}',
        RecordAccessPolicy: 'ALL',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: '',
        MenuGroup: 'Masters',
        MenuOrder: 7,
        MenuLabel: 'Ports',
        MenuIcon: 'anchor',
        RoutePath: '/masters/ports',
        PageTitle: 'Ports',
        PageDescription: 'Manage port master records',
        UIFields: JSON.stringify([
            { header: 'Name', label: 'Name', type: 'text', required: true },
            { header: 'Country', label: 'Country', type: 'text' },
            { header: 'PortType', label: 'Port Type', type: 'text' },
            { header: 'Status', label: 'Status', type: 'status', required: true }
        ]),
        ShowInMenu: 'TRUE',
        IncludeInAuthorizationPayload: 'TRUE'
    },

    // --- TRANSACTION RESOURCES ---
    {
        Name: CONFIG.TRANSACTION_SHEETS.SHIPMENTS,
        Scope: 'transaction',
        IsActive: 'TRUE',
        SheetName: CONFIG.TRANSACTION_SHEETS.SHIPMENTS,
        CodePrefix: 'SHP',
        CodeSequenceLength: 6,
        SkipColumns: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'SupplierCode',
        UniqueHeaders: '',
        UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Draft"}',
        RecordAccessPolicy: 'OWNER_AND_UPLINE',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: 'Submit,Dispatch,Arrive,Clear',
        MenuGroup: 'Transactions',
        MenuOrder: 1,
        MenuLabel: 'Shipments',
        MenuIcon: 'directions_boat',
        RoutePath: '/transactions/shipments',
        PageTitle: 'Shipments',
        PageDescription: 'Manage inward shipments',
        UIFields: JSON.stringify([]),
        ShowInMenu: 'TRUE',
        IncludeInAuthorizationPayload: 'TRUE'
    },
    {
        Name: CONFIG.TRANSACTION_SHEETS.SHIPMENT_ITEMS,
        Scope: 'transaction',
        ParentResource: CONFIG.TRANSACTION_SHEETS.SHIPMENTS,
        IsActive: 'TRUE',
        SheetName: CONFIG.TRANSACTION_SHEETS.SHIPMENT_ITEMS,
        CodePrefix: 'SHPI',
        CodeSequenceLength: 6,
        SkipColumns: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'ShipmentCode,VariantCode',
        UniqueHeaders: '',
        UniqueCompositeHeaders: 'ShipmentCode+VariantCode',
        DefaultValues: '{"Status":"Active"}',
        RecordAccessPolicy: 'OWNER_AND_UPLINE',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: '',
        MenuGroup: 'Transactions',
        MenuOrder: 2,
        MenuLabel: 'Shipment Items',
        MenuIcon: 'view_list',
        RoutePath: '',
        PageTitle: 'Shipment Items',
        PageDescription: 'Items in a shipment',
        UIFields: JSON.stringify([]),
        ShowInMenu: 'FALSE',
        IncludeInAuthorizationPayload: 'TRUE'
    },
    {
        Name: CONFIG.TRANSACTION_SHEETS.PORT_CLEARANCE,
        Scope: 'transaction',
        IsActive: 'TRUE',
        SheetName: CONFIG.TRANSACTION_SHEETS.PORT_CLEARANCE,
        CodePrefix: 'CLR',
        CodeSequenceLength: 5,
        SkipColumns: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'ShipmentCode',
        UniqueHeaders: 'ShipmentCode',
        UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Active","CustomsStatus":"Pending"}',
        RecordAccessPolicy: 'OWNER_AND_UPLINE',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: 'Submit,Hold,Clear',
        MenuGroup: 'Transactions',
        MenuOrder: 3,
        MenuLabel: 'Port Clearance',
        MenuIcon: 'verified_user',
        RoutePath: '/transactions/port-clearance',
        PageTitle: 'Port Clearance',
        PageDescription: 'Manage customs clearance',
        UIFields: JSON.stringify([]),
        ShowInMenu: 'TRUE',
        IncludeInAuthorizationPayload: 'TRUE'
    },
    {
        Name: CONFIG.TRANSACTION_SHEETS.GOODS_RECEIPTS,
        Scope: 'transaction',
        IsActive: 'TRUE',
        SheetName: CONFIG.TRANSACTION_SHEETS.GOODS_RECEIPTS,
        CodePrefix: 'GRN',
        CodeSequenceLength: 6,
        SkipColumns: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'ShipmentCode,WarehouseCode',
        UniqueHeaders: '',
        UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Draft"}',
        RecordAccessPolicy: 'OWNER_AND_UPLINE',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: 'Verify,Accept',
        MenuGroup: 'Transactions',
        MenuOrder: 4,
        MenuLabel: 'Goods Receipts',
        MenuIcon: 'receipt_long',
        RoutePath: '/transactions/goods-receipts',
        PageTitle: 'Goods Receipts',
        PageDescription: 'Manage inward warehouse receiving',
        UIFields: JSON.stringify([]),
        ShowInMenu: 'TRUE',
        IncludeInAuthorizationPayload: 'TRUE'
    },
    {
        Name: CONFIG.TRANSACTION_SHEETS.GOODS_RECEIPT_ITEMS,
        Scope: 'transaction',
        ParentResource: CONFIG.TRANSACTION_SHEETS.GOODS_RECEIPTS,
        IsActive: 'TRUE',
        SheetName: CONFIG.TRANSACTION_SHEETS.GOODS_RECEIPT_ITEMS,
        CodePrefix: 'GRNI',
        CodeSequenceLength: 6,
        SkipColumns: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'GRNCode,VariantCode',
        UniqueHeaders: '',
        UniqueCompositeHeaders: 'GRNCode+VariantCode',
        DefaultValues: '{"Status":"Active"}',
        RecordAccessPolicy: 'OWNER_AND_UPLINE',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: '',
        MenuGroup: 'Transactions',
        MenuOrder: 5,
        MenuLabel: 'GRN Items',
        MenuIcon: 'view_list',
        RoutePath: '',
        PageTitle: 'GRN Items',
        PageDescription: 'Items in a goods receipt',
        UIFields: JSON.stringify([]),
        ShowInMenu: 'FALSE',
        IncludeInAuthorizationPayload: 'TRUE'
    },
    {
        Name: CONFIG.TRANSACTION_SHEETS.STOCK_MOVEMENTS,
        Scope: 'transaction',
        IsActive: 'TRUE',
        SheetName: CONFIG.TRANSACTION_SHEETS.STOCK_MOVEMENTS,
        CodePrefix: 'STKMOV',
        CodeSequenceLength: 7,
        SkipColumns: 0,
        Audit: 'TRUE',
        RequiredHeaders: 'WarehouseCode,VariantCode,QtyChange,ReferenceType',
        UniqueHeaders: '',
        UniqueCompositeHeaders: '',
        DefaultValues: '{"Status":"Active","QtyChange":0}',
        RecordAccessPolicy: 'ALL',
        OwnerUserField: 'CreatedBy',
        AdditionalActions: '',
        MenuGroup: 'Transactions',
        MenuOrder: 6,
        MenuLabel: 'Stock Movements',
        MenuIcon: 'swap_horiz',
        RoutePath: '/transactions/stock-movements',
        PageTitle: 'Stock Movements',
        PageDescription: 'Global ledger of inventory flows',
        UIFields: JSON.stringify([]),
        ShowInMenu: 'TRUE',
        IncludeInAuthorizationPayload: 'TRUE'
    }
];

function syncAppResourcesFromCode(silent) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEETS.RESOURCES);
    if (!sheet) throw new Error('Resources sheet not found');

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
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
                if (idx[key] !== undefined && key !== 'FileID') { // Preserve existing FileID if already valid
                    sheet.getRange(rowNum, idx[key] + 1).setValue(resource[key]);
                }
            });
            // Optionally sync FileID if empty:
            const existingFileID = sheet.getRange(rowNum, idx['FileID'] + 1).getValue();
            if (!existingFileID) {
                sheet.getRange(rowNum, idx['FileID'] + 1).setValue(ss.getId());
            }
            updated++;
        } else {
            // Add new record
            const newRow = [];
            headers.forEach(function (h) {
                if (resource[h] !== undefined) {
                    newRow.push(resource[h]);
                } else if (h === 'FileID') {
                    // Default to current APP file ID, but this could be changed manually by users later if modularized
                    newRow.push(ss.getId());
                } else {
                    newRow.push('');
                }
            });
            sheet.appendRow(newRow);
            added++;
        }
    });

    if (!silent) {
        try {
            SpreadsheetApp.getUi().alert('APP.Resources Sync Complete.\n\nAdded: ' + added + '\nUpdated: ' + updated + '\n\nNote: If any resources exist in an external file instead of the core APP file, make sure to manually set their FileID in the sheet.');
        } catch (e) {
            // Context without UI
        }
    }
}
