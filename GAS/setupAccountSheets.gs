/**
 * ============================================================
 * AQL - ACCOUNTS Sheet Setup
 * ============================================================
 * Run this function in APP Apps Script project to setup accounts
 * related sheets.
 *
 * Shared helpers: setupSheetUtils.gs (setup_* functions)
 */

var ACCOUNTS_HEADER_COLOR = '#5C6BC0';
var ACCOUNTS_ALT_ROW_COLOR = '#f0f1fa';

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

            setup_normalizeSheetSchema(sheet, schema.headers);
            setup_applyHeaderFormatting(sheet, schema.headers, schema.columnWidths, ACCOUNTS_HEADER_COLOR);

            if (isNewSheet) setup_trimToHeaderOnly(sheet);

            setup_applyColumnDefaults(sheet, schema.headers, schema.defaults || {});
            setup_clearDataValidations(sheet, schema.headers.length);

            if (schema.headers.indexOf('Status') !== -1) {
                setup_applyListValidation(sheet, schema.headers, 'Status', ['Active', 'Inactive', 'Draft']);
                setup_fillBlankColumn(sheet, schema.headers, 'Status', schema.statusDefault || 'Active');
            }

            if (schema.typeValidation && schema.headers.indexOf('AccountType') !== -1) {
                setup_applyListValidation(sheet, schema.headers, 'AccountType', schema.typeValidation);
            }

            setup_protectHeaderRow(sheet, schema.headers.length);
            setup_applyBanding(sheet, schema.headers.length, ACCOUNTS_HEADER_COLOR, ACCOUNTS_ALT_ROW_COLOR);
            setup_setPlainTextFormat(sheet, schema.headers.length);

            if (!fileSheetIndex[resource.fileId]) fileSheetIndex[resource.fileId] = 0;
            fileSheetIndex[resource.fileId]++;
            file.setActiveSheet(sheet);
            file.moveActiveSheet(fileSheetIndex[resource.fileId]);

        } catch (err) {
            results.push('Error for ' + schema.resourceName + ': ' + err.message);
        }
    });

    const summary = 'Accounts sheets setup complete.\n\n' + results.join('\n');
    
    // Clear all caches after setup
    if (typeof clearAllAppCaches === 'function') clearAllAppCaches();

    Logger.log(summary);
    try {
        SpreadsheetApp.getUi().alert(summary);
    } catch (e) { }
}
