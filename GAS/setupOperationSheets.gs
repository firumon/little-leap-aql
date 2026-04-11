/**
 * ============================================================
 * AQL - OPERATION Sheet Setup (Resources Driven)
 * ============================================================
 * Run this function in APP Apps Script project only.
 * It reads APP.Resources, opens target files by FileID,
 * and creates/updates configured OPERATION sheets there.
 *
 * Shared helpers: setupSheetUtils.gs (setup_* functions)
 */

var OPERATION_HEADER_COLOR = '#2E7D32';
var OPERATION_ALT_ROW_COLOR = '#f0f7f1';

function setupOperationSheets() {
    const commonAuditColumns = ['CreatedAt', 'UpdatedAt', 'CreatedBy', 'UpdatedBy'];

    const schemaByResource = [
        {
            resourceName: CONFIG.OPERATION_SHEETS.PROCUREMENTS,
            headers: ['Code', 'Progress', 'InitiatedDate', 'CreatedRole', 'Status', 'AccessRegion'].concat(commonAuditColumns),
            statusDefault: 'Active',
            defaults: { Status: 'Active', Progress: 'INITIATED' },
            progressValidation: ['INITIATED', 'PR_CREATED', 'PR_APPROVED', 'RFQ_GENERATED', 'QUOTATIONS_RECEIVED', 'PO_ISSUED', 'IN_TRANSIT', 'ARRIVED_AT_PORT', 'COMPLETED', 'CANCELLED'],
            columnWidths: { Code: 150, Progress: 180, InitiatedDate: 150, CreatedRole: 150, Status: 100, AccessRegion: 130 }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.PURCHASE_REQUISITIONS,
            headers: ['Code', 'ProcurementCode', 'Progress', 'ProgressPENDINGAt', 'ProgressPENDINGBy', 'ProgressPENDINGComment', 'Status', 'AccessRegion'].concat(commonAuditColumns),
            statusDefault: 'Active',
            defaults: { Status: 'Active', Progress: 'PENDING' },
            progressValidation: ['PENDING', 'VERIFIED', 'APPROVED', 'REJECTED'],
            columnWidths: { Code: 150, ProcurementCode: 150, Progress: 120, ProgressPENDINGAt: 150, ProgressPENDINGBy: 150, ProgressPENDINGComment: 200, Status: 100 }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.PURCHASE_REQUISITION_ITEMS,
            headers: ['Code', 'PRCode', 'SKU', 'Quantity', 'ExpectedDate', 'Notes', 'Status'].concat(commonAuditColumns),
            statusDefault: 'Active',
            defaults: { Status: 'Active', Quantity: 0 },
            columnWidths: { Code: 150, PRCode: 150, SKU: 150, Quantity: 100, ExpectedDate: 150, Notes: 200, Status: 100 }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.RFQS,
            headers: ['Code', 'ProcurementCode', 'Deadline', 'Terms', 'Progress', 'Status', 'AccessRegion'].concat(commonAuditColumns),
            statusDefault: 'Active',
            defaults: { Status: 'Active', Progress: 'DRAFT' },
            progressValidation: ['DRAFT', 'PUBLISHED', 'CLOSED', 'CANCELLED'],
            columnWidths: { Code: 150, ProcurementCode: 150, Deadline: 150, Terms: 250, Progress: 120, Status: 100 }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.RFQ_ITEMS,
            headers: ['Code', 'RFQCode', 'SKU', 'Quantity', 'Status'].concat(commonAuditColumns),
            statusDefault: 'Active',
            defaults: { Status: 'Active', Quantity: 0 },
            columnWidths: { Code: 150, RFQCode: 150, SKU: 150, Quantity: 100, Status: 100 }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.RFQ_SUPPLIERS,
            headers: ['Code', 'ProcurementCode', 'RFQCode', 'SupplierCode', 'Progress', 'Status'].concat(commonAuditColumns),
            statusDefault: 'Active',
            defaults: { Status: 'Active', Progress: 'SENT' },
            progressValidation: ['SENT', 'QUOTATION_RECEIVED', 'REJECTED', 'APPROVED'],
            columnWidths: { Code: 150, ProcurementCode: 150, RFQCode: 150, SupplierCode: 150, Progress: 150, Status: 100 }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.SUPPLIER_QUOTATIONS,
            headers: ['Code', 'ProcurementCode', 'SupplierCode', 'RFQCode', 'DocumentUrl', 'TotalAmount', 'Currency', 'ValidUntil', 'Status'].concat(commonAuditColumns),
            statusDefault: 'Active',
            defaults: { Status: 'Active', TotalAmount: 0, Currency: 'AED' },
            columnWidths: { Code: 150, ProcurementCode: 150, SupplierCode: 150, RFQCode: 150, DocumentUrl: 250, TotalAmount: 120, Currency: 100, ValidUntil: 150, Status: 100 }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.SUPPLIER_QUOTATION_ITEMS,
            headers: ['Code', 'QuotationCode', 'SKU', 'SupplierItemCode', 'Quantity', 'UnitPrice', 'Status'].concat(commonAuditColumns),
            statusDefault: 'Active',
            defaults: { Status: 'Active', Quantity: 0, UnitPrice: 0 },
            columnWidths: { Code: 150, QuotationCode: 150, SKU: 150, SupplierItemCode: 150, Quantity: 100, UnitPrice: 100, Status: 100 }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.PURCHASE_ORDERS,
            headers: ['Code', 'ProcurementCode', 'SupplierCode', 'RFQCode', 'QuotationCode', 'Progress', 'TotalAmount', 'Currency', 'Status', 'AccessRegion'].concat(commonAuditColumns),
            statusDefault: 'Active',
            defaults: { Status: 'Active', Progress: 'DRAFT', TotalAmount: 0, Currency: 'AED' },
            progressValidation: ['DRAFT', 'APPROVED', 'SENT_TO_SUPPLIER', 'SUPPLIER_ACKNOWLEDGED', 'SUPPLIER_ACCEPTED', 'CANCELLED'],
            columnWidths: { Code: 150, ProcurementCode: 150, SupplierCode: 150, RFQCode: 150, QuotationCode: 150, Progress: 180, TotalAmount: 120, Currency: 100, Status: 100 }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.PURCHASE_ORDER_ITEMS,
            headers: ['Code', 'POCode', 'SKU', 'SupplierItemCode', 'Quantity', 'UnitPrice', 'TotalPrice', 'Status'].concat(commonAuditColumns),
            statusDefault: 'Active',
            defaults: { Status: 'Active', Quantity: 0, UnitPrice: 0, TotalPrice: 0 },
            columnWidths: { Code: 150, POCode: 150, SKU: 150, SupplierItemCode: 150, Quantity: 100, UnitPrice: 100, TotalPrice: 100, Status: 100 }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.PO_FULFILLMENTS,
            headers: ['Code', 'ProcurementCode', 'POCode', 'DocumentName', 'Description', 'Purpose', 'DocumentUrl', 'Status'].concat(commonAuditColumns),
            statusDefault: 'Active',
            defaults: { Status: 'Active' },
            columnWidths: { Code: 150, ProcurementCode: 150, POCode: 150, DocumentName: 180, Description: 250, Purpose: 150, DocumentUrl: 250, Status: 100 }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.SHIPMENTS,
            headers: ['Code', 'SupplierCode', 'ETD', 'ETA', 'Status', 'CarrierCode', 'PortCode', 'AccessRegion'].concat(commonAuditColumns),
            statusDefault: 'Draft',
            defaults: { Status: 'Draft' },
            statusValidation: ['Draft', 'InTransit', 'Arrived', 'Cleared', 'Received'],
            columnWidths: { Code: 150, SupplierCode: 140, ETD: 150, ETA: 150, Status: 120, CarrierCode: 140, PortCode: 140, AccessRegion: 130, CreatedAt: 170, UpdatedAt: 170, CreatedBy: 140, UpdatedBy: 140 }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.SHIPMENT_ITEMS,
            headers: ['Code', 'ShipmentCode', 'SKU', 'ExpectedQty', 'Status'].concat(commonAuditColumns),
            statusDefault: 'Active',
            defaults: { Status: 'Active', ExpectedQty: 0 },
            statusValidation: ['Active', 'Inactive'],
            columnWidths: { Code: 150, ShipmentCode: 150, SKU: 150, ExpectedQty: 120, Status: 100, CreatedAt: 170, UpdatedAt: 170, CreatedBy: 140, UpdatedBy: 140 }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.PORT_CLEARANCE,
            headers: ['Code', 'ShipmentCode', 'ClearanceDate', 'CustomsStatus', 'DutyAmount', 'AccessRegion', 'Status'].concat(commonAuditColumns),
            statusDefault: 'Active',
            defaults: { Status: 'Active', CustomsStatus: 'Pending', DutyAmount: 0 },
            customsStatusValidation: ['Pending', 'InProgress', 'Cleared', 'Held'],
            statusValidation: ['Active', 'Inactive'],
            columnWidths: { Code: 150, ShipmentCode: 150, ClearanceDate: 150, CustomsStatus: 130, DutyAmount: 120, AccessRegion: 130, Status: 100, CreatedAt: 170, UpdatedAt: 170, CreatedBy: 140, UpdatedBy: 140 }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.GOODS_RECEIPTS,
            headers: ['Code', 'ShipmentCode', 'ReceivedDate', 'WarehouseCode', 'Status', 'AccessRegion'].concat(commonAuditColumns),
            statusDefault: 'Draft',
            defaults: { Status: 'Draft' },
            statusValidation: ['Draft', 'Verified', 'Accepted'],
            columnWidths: { Code: 150, ShipmentCode: 150, ReceivedDate: 150, WarehouseCode: 150, Status: 120, AccessRegion: 130, CreatedAt: 170, UpdatedAt: 170, CreatedBy: 140, UpdatedBy: 140 }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.GOODS_RECEIPT_ITEMS,
            headers: ['Code', 'GRNCode', 'SKU', 'StorageName', 'ExpectedQty', 'ReceivedQty', 'DamagedQty', 'AcceptedQty', 'Status'].concat(commonAuditColumns),
            statusDefault: 'Active',
            defaults: { Status: 'Active', ExpectedQty: 0, ReceivedQty: 0, DamagedQty: 0, AcceptedQty: 0 },
            statusValidation: ['Active', 'Inactive'],
            columnWidths: { Code: 150, GRNCode: 150, SKU: 150, StorageName: 150, ExpectedQty: 120, ReceivedQty: 120, DamagedQty: 120, AcceptedQty: 120, Status: 100, CreatedAt: 170, UpdatedAt: 170, CreatedBy: 140, UpdatedBy: 140 }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.STOCK_MOVEMENTS,
            headers: ['Code', 'WarehouseCode', 'StorageName', 'SKU', 'QtyChange', 'ReferenceType', 'ReferenceCode', 'Status', 'AccessRegion'].concat(commonAuditColumns),
            statusDefault: 'Active',
            defaults: { Status: 'Active', QtyChange: 0 },
            statusValidation: ['Active', 'Inactive'],
            referenceTypeValidation: APP_OPTIONS_SEED.StockMovementReferenceType,
            columnWidths: { Code: 150, WarehouseCode: 130, StorageName: 130, SKU: 150, QtyChange: 120, ReferenceType: 140, ReferenceCode: 150, Status: 100, AccessRegion: 130, CreatedAt: 170, UpdatedAt: 170, CreatedBy: 140, UpdatedBy: 140 }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.WAREHOUSE_STORAGES,
            headers: ['Code', 'WarehouseCode', 'StorageName', 'SKU', 'Quantity'].concat(commonAuditColumns),
            defaults: { Quantity: 0 },
            columnWidths: { Code: 150, WarehouseCode: 150, StorageName: 200, SKU: 150, Quantity: 120, CreatedAt: 170, UpdatedAt: 170, CreatedBy: 140, UpdatedBy: 140 }
        }
    ];

    const fileSheetIndex = {};
    const results = [];

    schemaByResource.forEach(function (schema) {
        try {
            const resource = getResourceConfig(schema.resourceName);
            if (!resource.codePrefix) {
                throw new Error('CodePrefix is missing in Resources for ' + schema.resourceName);
            }
            if (!resource.codeSequenceLength || resource.codeSequenceLength <= 0) {
                throw new Error('CodeSequenceLength is missing/invalid in Resources for ' + schema.resourceName);
            }

            const file = SpreadsheetApp.openById(resource.fileId);
            let sheet = file.getSheetByName(resource.sheetName);
            let isNewSheet = false;

            if (!sheet) {
                sheet = file.insertSheet(resource.sheetName);
                isNewSheet = true;
                results.push('Created: ' + schema.resourceName + ' in file ' + resource.fileId);
            } else {
                results.push('Updated: ' + schema.resourceName + ' in file ' + resource.fileId);
            }

            setup_normalizeSheetSchema(sheet, schema.headers);
            setup_applyHeaderFormatting(sheet, schema.headers, schema.columnWidths, OPERATION_HEADER_COLOR);

            if (isNewSheet) {
                setup_trimToHeaderOnly(sheet);
            }

            setup_applyColumnDefaults(sheet, schema.headers, schema.defaults || {});
            setup_clearDataValidations(sheet, schema.headers.length);

            if (schema.statusValidation) {
                setup_applyListValidation(sheet, schema.headers, 'Status', schema.statusValidation);
            }
            if (schema.customsStatusValidation) {
                setup_applyListValidation(sheet, schema.headers, 'CustomsStatus', schema.customsStatusValidation);
            }
            if (schema.progressValidation && schema.headers.indexOf('Progress') !== -1) {
                setup_applyListValidation(sheet, schema.headers, 'Progress', schema.progressValidation);
            }
            if (schema.referenceTypeValidation && schema.headers.indexOf('ReferenceType') !== -1) {
                setup_applyListValidation(sheet, schema.headers, 'ReferenceType', schema.referenceTypeValidation);
            }

            if (schema.headers.indexOf('Status') !== -1) {
                setup_fillBlankColumn(sheet, schema.headers, 'Status', schema.statusDefault || 'Active');
            }

            setup_protectHeaderRow(sheet, schema.headers.length);
            setup_applyBanding(sheet, schema.headers.length, OPERATION_HEADER_COLOR, OPERATION_ALT_ROW_COLOR);
            setup_setPlainTextFormat(sheet, schema.headers.length);

            if (!fileSheetIndex[resource.fileId]) fileSheetIndex[resource.fileId] = 0;
            fileSheetIndex[resource.fileId]++;
            file.setActiveSheet(sheet);
            file.moveActiveSheet(fileSheetIndex[resource.fileId]);

        } catch (err) {
            results.push('Error for ' + schema.resourceName + ': ' + err.message);
        }
    });

    const summary = 'OPERATION setup (Resources driven) complete.\n\n' + results.join('\n');
    
    // Clear all caches after setup
    if (typeof clearAllAppCaches === 'function') clearAllAppCaches();

    Logger.log(summary);
    try {
        SpreadsheetApp.getUi().alert(summary);
    } catch (e) {
        // Non-UI context
    }
}
