/**
 * ============================================================
 * Little Leap AQL - ACCOUNTS Sheet Setup
 * ============================================================
 * Run this function in APP Apps Script project to setup accounts
 * related sheets.
 */

function setupAccountSheets() {
    const commonAuditColumns = ['CreatedAt', 'UpdatedAt', 'CreatedBy', 'UpdatedBy'];

    const schemaByResource = [
        {
            resourceName: CONFIG.ACCOUNTS_SHEETS.CHART_OF_ACCOUNTS,
            headers: ['Code', 'Name', 'Description', 'AccountType', 'Status'].concat(commonAuditColumns),
            statusDefault: 'Active',
            defaults: { Status: 'Active', AccountType: 'ASSETS' },
            typeValidation: ['ASSETS', 'LIABILITIES', 'EQUITY', 'REVENUE', 'EXPENSES'],
            columnWidths: { Code: 150, Name: 200, Description: 300, AccountType: 150, Status: 100 }
        },
        {
            resourceName: CONFIG.ACCOUNTS_SHEETS.ENTRY_TEMPLATES,
            headers: ['Code', 'Name', 'Description', 'COACode', 'Params', 'Fields', 'Status'].concat(commonAuditColumns),
            statusDefault: 'Active',
            defaults: { Status: 'Active' },
            columnWidths: { Code: 150, Name: 200, Description: 300, COACode: 150, Params: 250, Fields: 250, Status: 100 }
        },
        {
            resourceName: CONFIG.ACCOUNTS_SHEETS.ASSETS,
            headers: ['Code', 'ReferenceCode', 'COACode', 'OperationDate', 'Amount', 'Description', 'Status'].concat(commonAuditColumns),
            statusDefault: 'Active',
            defaults: { Status: 'Active', Amount: 0 },
            columnWidths: { Code: 150, ReferenceCode: 150, COACode: 150, OperationDate: 150, Amount: 120, Description: 300, Status: 100 }
        },
        {
            resourceName: CONFIG.ACCOUNTS_SHEETS.LIABILITIES,
            headers: ['Code', 'ReferenceCode', 'COACode', 'OperationDate', 'Amount', 'Description', 'Status'].concat(commonAuditColumns),
            statusDefault: 'Active',
            defaults: { Status: 'Active', Amount: 0 },
            columnWidths: { Code: 150, ReferenceCode: 150, COACode: 150, OperationDate: 150, Amount: 120, Description: 300, Status: 100 }
        },
        {
            resourceName: CONFIG.ACCOUNTS_SHEETS.EQUITY,
            headers: ['Code', 'ReferenceCode', 'COACode', 'OperationDate', 'Amount', 'Description', 'Status'].concat(commonAuditColumns),
            statusDefault: 'Active',
            defaults: { Status: 'Active', Amount: 0 },
            columnWidths: { Code: 150, ReferenceCode: 150, COACode: 150, OperationDate: 150, Amount: 120, Description: 300, Status: 100 }
        },
        {
            resourceName: CONFIG.ACCOUNTS_SHEETS.REVENUE,
            headers: ['Code', 'ReferenceCode', 'COACode', 'OperationDate', 'Amount', 'Description', 'Status'].concat(commonAuditColumns),
            statusDefault: 'Active',
            defaults: { Status: 'Active', Amount: 0 },
            columnWidths: { Code: 150, ReferenceCode: 150, COACode: 150, OperationDate: 150, Amount: 120, Description: 300, Status: 100 }
        },
        {
            resourceName: CONFIG.ACCOUNTS_SHEETS.EXPENSES,
            headers: ['Code', 'ReferenceCode', 'COACode', 'OperationDate', 'Amount', 'Description', 'Status'].concat(commonAuditColumns),
            statusDefault: 'Active',
            defaults: { Status: 'Active', Amount: 0 },
            columnWidths: { Code: 150, ReferenceCode: 150, COACode: 150, OperationDate: 150, Amount: 120, Description: 300, Status: 100 }
        }
    ];

    const fileSheetIndex = {};
    const results = [];

    schemaByResource.forEach(function (schema) {
        try {
            const resource = getResourceConfig(schema.resourceName);
            if (!resource.codePrefix) throw new Error('CodePrefix is missing');
            if (!resource.fileId) throw new Error('FileId is missing or empty');

            const file = SpreadsheetApp.openById(resource.fileId);
            let sheet = file.getSheetByName(resource.sheetName);
            let isNewSheet = false;

            if (!sheet) {
                sheet = file.insertSheet(resource.sheetName);
                isNewSheet = true;
                results.push('Created: ' + schema.resourceName);
            } else {
                results.push('Updated: ' + schema.resourceName);
            }

            // Using existing trx_ helper functions from setupOperationSheets.gs
            trx_normalizeSheetSchema(sheet, schema.headers);
            trx_applySheetFormatting(sheet, schema.headers, schema.columnWidths);

            if (isNewSheet) trx_trimToHeaderOnly(sheet);

            trx_applyColumnDefaults(sheet, schema.headers, schema.defaults || {});
            trx_clearDataValidationForTable(sheet, schema.headers.length);

            if (schema.headers.indexOf('Status') !== -1) {
                trx_applyListValidation(sheet, schema.headers, 'Status', ['Active', 'Inactive', 'Draft']);
                trx_fillBlankColumn(sheet, schema.headers, 'Status', schema.statusDefault || 'Active');
            }

            if (schema.typeValidation && schema.headers.indexOf('AccountType') !== -1) {
                trx_applyListValidation(sheet, schema.headers, 'AccountType', schema.typeValidation);
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

    const summary = 'Accounts sheets setup complete.\n\n' + results.join('\n');
    Logger.log(summary);
    try {
        SpreadsheetApp.getUi().alert(summary);
    } catch (e) { }
}
