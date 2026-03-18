/**
 * ============================================================
 * AQL - OPERATION Sheet Setup (Resources Driven)
 * ============================================================
 * Run this function in APP Apps Script project only.
 * It reads APP.Resources, opens target files by FileID,
 * and creates/updates configured OPERATION sheets there.
 */

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
            columnWidths: {
                Code: 150,
                SupplierCode: 140,
                ETD: 150,
                ETA: 150,
                Status: 120,
                CarrierCode: 140,
                PortCode: 140,
                AccessRegion: 130,
                CreatedAt: 170,
                UpdatedAt: 170,
                CreatedBy: 140,
                UpdatedBy: 140
            }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.SHIPMENT_ITEMS,
            headers: ['Code', 'ShipmentCode', 'SKU', 'ExpectedQty', 'Status'].concat(commonAuditColumns),
            statusDefault: 'Active',
            defaults: { Status: 'Active', ExpectedQty: 0 },
            statusValidation: ['Active', 'Inactive'],
            columnWidths: {
                Code: 150,
                ShipmentCode: 150,
                SKU: 150,
                ExpectedQty: 120,
                Status: 100,
                CreatedAt: 170,
                UpdatedAt: 170,
                CreatedBy: 140,
                UpdatedBy: 140
            }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.PORT_CLEARANCE,
            headers: ['Code', 'ShipmentCode', 'ClearanceDate', 'CustomsStatus', 'DutyAmount', 'AccessRegion', 'Status'].concat(commonAuditColumns),
            statusDefault: 'Active',
            defaults: { Status: 'Active', CustomsStatus: 'Pending', DutyAmount: 0 },
            customsStatusValidation: ['Pending', 'InProgress', 'Cleared', 'Held'],
            statusValidation: ['Active', 'Inactive'],
            columnWidths: {
                Code: 150,
                ShipmentCode: 150,
                ClearanceDate: 150,
                CustomsStatus: 130,
                DutyAmount: 120,
                AccessRegion: 130,
                Status: 100,
                CreatedAt: 170,
                UpdatedAt: 170,
                CreatedBy: 140,
                UpdatedBy: 140
            }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.GOODS_RECEIPTS,
            headers: ['Code', 'ShipmentCode', 'ReceivedDate', 'WarehouseCode', 'Status', 'AccessRegion'].concat(commonAuditColumns),
            statusDefault: 'Draft',
            defaults: { Status: 'Draft' },
            statusValidation: ['Draft', 'Verified', 'Accepted'],
            columnWidths: {
                Code: 150,
                ShipmentCode: 150,
                ReceivedDate: 150,
                WarehouseCode: 150,
                Status: 120,
                AccessRegion: 130,
                CreatedAt: 170,
                UpdatedAt: 170,
                CreatedBy: 140,
                UpdatedBy: 140
            }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.GOODS_RECEIPT_ITEMS,
            headers: ['Code', 'GRNCode', 'SKU', 'StorageName', 'ExpectedQty', 'ReceivedQty', 'DamagedQty', 'AcceptedQty', 'Status'].concat(commonAuditColumns),
            statusDefault: 'Active',
            defaults: { Status: 'Active', ExpectedQty: 0, ReceivedQty: 0, DamagedQty: 0, AcceptedQty: 0 },
            statusValidation: ['Active', 'Inactive'],
            columnWidths: {
                Code: 150,
                GRNCode: 150,
                SKU: 150,
                StorageName: 150,
                ExpectedQty: 120,
                ReceivedQty: 120,
                DamagedQty: 120,
                AcceptedQty: 120,
                Status: 100,
                CreatedAt: 170,
                UpdatedAt: 170,
                CreatedBy: 140,
                UpdatedBy: 140
            }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.STOCK_MOVEMENTS,
            headers: ['Code', 'WarehouseCode', 'StorageName', 'SKU', 'QtyChange', 'ReferenceType', 'ReferenceCode', 'Status', 'AccessRegion'].concat(commonAuditColumns),
            statusDefault: 'Active',
            defaults: { Status: 'Active', QtyChange: 0 },
            statusValidation: ['Active', 'Inactive'],
            columnWidths: {
                Code: 150,
                WarehouseCode: 130,
                StorageName: 130,
                SKU: 150,
                QtyChange: 120,
                ReferenceType: 140,
                ReferenceCode: 150,
                Status: 100,
                AccessRegion: 130,
                CreatedAt: 170,
                UpdatedAt: 170,
                CreatedBy: 140,
                UpdatedBy: 140
            }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.WAREHOUSE_STORAGES,
            headers: ['Code', 'WarehouseCode', 'StorageName', 'SKU', 'Quantity'].concat(commonAuditColumns),
            defaults: { Quantity: 0 },
            columnWidths: {
                Code: 150,
                WarehouseCode: 150,
                StorageName: 200,
                SKU: 150,
                Quantity: 120,
                CreatedAt: 170,
                UpdatedAt: 170,
                CreatedBy: 140,
                UpdatedBy: 140
            }
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

            trx_normalizeSheetSchema(sheet, schema.headers);
            trx_applySheetFormatting(sheet, schema.headers, schema.columnWidths);

            if (isNewSheet) {
                trx_trimToHeaderOnly(sheet);
            }

            trx_applyColumnDefaults(sheet, schema.headers, schema.defaults || {});
            trx_clearDataValidationForTable(sheet, schema.headers.length);

            if (schema.statusValidation) {
                trx_applyListValidation(sheet, schema.headers, 'Status', schema.statusValidation);
            }
            if (schema.customsStatusValidation) {
                trx_applyListValidation(sheet, schema.headers, 'CustomsStatus', schema.customsStatusValidation);
            }

            if (schema.headers.indexOf('Status') !== -1) {
                trx_fillBlankColumn(sheet, schema.headers, 'Status', schema.statusDefault || 'Active');
            }

            trx_protectHeaderRow(sheet, schema.headers.length);
            trx_applyBanding(sheet, schema.headers.length);

            if (sheet.getMaxRows() > 1) {
                sheet.getRange(2, 1, Math.max(sheet.getMaxRows() - 1, 1), schema.headers.length).setNumberFormat('@');
            }

            if (!fileSheetIndex[resource.fileId]) fileSheetIndex[resource.fileId] = 0;
            fileSheetIndex[resource.fileId]++;
            file.setActiveSheet(sheet);
            file.moveActiveSheet(fileSheetIndex[resource.fileId]);

        } catch (err) {
            results.push('Error for ' + schema.resourceName + ': ' + err.message);
        }
    });

    const summary = 'OPERATION setup (Resources driven) complete.\n\n' + results.join('\n');
    Logger.log(summary);
    try {
        SpreadsheetApp.getUi().alert(summary);
    } catch (e) {
        // Non-UI context
    }
}

// ------ Helper methods (prefixed with trx_ to avoid conflicts if bundled) ------

function trx_normalizeSheetSchema(sheet, targetHeaders) {
    const lastRow = Math.max(sheet.getLastRow(), 1);
    const lastCol = Math.max(sheet.getLastColumn(), 1);

    const currentValues = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    const currentHeaders = currentValues[0] || [];
    const headerIndexMap = {};
    currentHeaders.forEach((h, i) => { headerIndexMap[h] = i; });

    const existingRows = currentValues.slice(1);
    const normalizedRows = existingRows.map(function (row) {
        return targetHeaders.map(function (header) {
            const idx = headerIndexMap[header];
            return idx === undefined ? '' : row[idx];
        });
    });

    sheet.clearContents();
    sheet.getRange(1, 1, lastRow, lastCol).clearDataValidations();
    sheet.getRange(1, 1, 1, targetHeaders.length).setValues([targetHeaders]);

    if (normalizedRows.length > 0) {
        sheet.getRange(2, 1, normalizedRows.length, targetHeaders.length).setValues(normalizedRows);
    }

    const totalCols = sheet.getMaxColumns();
    if (totalCols > targetHeaders.length) {
        sheet.deleteColumns(targetHeaders.length + 1, totalCols - targetHeaders.length);
    }
}

function trx_applySheetFormatting(sheet, headers, columnWidths) {
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange
        .setFontWeight('bold')
        .setBackground('#2E7D32') // Greenish for operations
        .setFontColor('#ffffff')
        .setHorizontalAlignment('center')
        .setVerticalAlignment('middle')
        .setFontSize(10);

    sheet.setRowHeight(1, 32);
    sheet.setFrozenRows(1);

    headers.forEach(function (header, i) {
        if (columnWidths && columnWidths[header]) {
            sheet.setColumnWidth(i + 1, columnWidths[header]);
        }
    });
}

function trx_trimToHeaderOnly(sheet) {
    const maxRows = sheet.getMaxRows();
    if (maxRows > 1) {
        sheet.deleteRows(3, maxRows - 2);
    }
}

function trx_applyColumnDefaults(sheet, headers, defaults) {
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    Object.keys(defaults).forEach(function (key) {
        const colIdx = headers.indexOf(key);
        if (colIdx === -1) return;

        for (let row = 2; row <= lastRow; row++) {
            const cell = sheet.getRange(row, colIdx + 1);
            const value = cell.getValue();
            if (value === '' || value === null) {
                cell.setValue(defaults[key]);
            }
        }
    });
}

function trx_clearDataValidationForTable(sheet, colCount) {
    const maxRows = sheet.getMaxRows();
    if (maxRows < 2 || colCount < 1) return;
    sheet.getRange(2, 1, maxRows - 1, colCount).clearDataValidations();
}

function trx_applyListValidation(sheet, headers, columnName, valuesArray) {
    const colIdx = headers.indexOf(columnName);
    if (colIdx === -1) return;

    const rule = SpreadsheetApp.newDataValidation()
        .requireValueInList(valuesArray, true)
        .setAllowInvalid(false)
        .build();

    const maxRows = sheet.getMaxRows();
    if (maxRows < 2) return;
    sheet.getRange(2, colIdx + 1, maxRows - 1, 1).setDataValidation(rule);
}

function trx_fillBlankColumn(sheet, headers, columnName, defaultValue) {
    const colIdx = headers.indexOf(columnName);
    if (colIdx === -1) return;

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    for (let row = 2; row <= lastRow; row++) {
        const cell = sheet.getRange(row, colIdx + 1);
        const val = (cell.getValue() || '').toString().trim();
        if (!val) {
            cell.setValue(defaultValue);
        }
    }
}

function trx_applyBanding(sheet, headerCount) {
    const bandings = sheet.getBandings();
    bandings.forEach(function (b) { b.remove(); });

    const rowCount = Math.max(sheet.getLastRow(), 2);
    const tableRange = sheet.getRange(1, 1, rowCount, headerCount);
    const banding = tableRange.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY);
    banding
        .setHeaderRowColor('#2E7D32')
        .setFirstRowColor('#ffffff')
        .setSecondRowColor('#f0f7f1'); // Light green tint
}

function trx_protectHeaderRow(sheet, colCount) {
    const protections = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
    protections.forEach(function (p) {
        const r = p.getRange();
        if (r && r.getRow() === 1) {
            p.remove();
        }
    });

    const protection = sheet.getRange(1, 1, 1, colCount).protect();
    protection.setDescription(sheet.getName() + ' Headers - Do Not Edit');
    protection.setWarningOnly(true);
}
