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

function setup_getAccountSchemas() {
    const commonAuditColumns = ['CreatedAt', 'UpdatedAt', 'Revision', 'CreatedBy', 'UpdatedBy'];

    return [
        {
            resourceName: CONFIG.ACCOUNTS_SHEETS.CHART_OF_ACCOUNTS,
            headers: ['Code', 'Name', 'Description', 'AccountType', 'Status'].concat(commonAuditColumns),
            statusDefault: 'Active',
            defaults: { Status: 'Active', AccountType: 'ASSETS' },
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
        },
        {
            resourceName: CONFIG.ACCOUNTS_SHEETS.TAX_TRANSACTIONS,
            headers: ['Code', 'Date', 'Resource', 'ResourceCode', 'CounterPartyType', 'CounterPartyCode', 'TaxCode', 'TaxableAmount', 'TaxAmount', 'AccessRegion', 'Status'].concat(commonAuditColumns),
            statusDefault: 'Active',
            defaults: { Status: 'Active', TaxableAmount: 0, TaxAmount: 0 },
            columnWidths: { Code: 140, Date: 120, Resource: 200, ResourceCode: 150, CounterPartyType: 150, CounterPartyCode: 150, TaxCode: 130, TaxableAmount: 130, TaxAmount: 130, AccessRegion: 130, Status: 100 }
        }
    ];
}

function setupAccountSheets(options) {
    options = options || {};
    if (typeof clearAllAppCaches === 'function') clearAllAppCaches();
    resetLogSheet_();

    logToSheet_('Starting Setup Base Accounts');

    const schemaByResource = setup_getAccountSchemas();
    const selectedResources = options.selectedResources;
    const decisions = options.decisions || {};

    const schemasToProcess = (selectedResources && selectedResources.length > 0)
        ? schemaByResource.filter(function (s) { return selectedResources.indexOf(s.resourceName) !== -1; })
        : schemaByResource;

    const results = [];

    schemasToProcess.forEach(function (schema) {
        try {
            const outcome = setup_refactorResourceSheet(schema, {
                decisions: decisions,
                allSchemas: schemaByResource,
                headerColor: ACCOUNTS_HEADER_COLOR,
                altColor: ACCOUNTS_ALT_ROW_COLOR
            });
            const prefix = outcome.isNewSheet ? 'Created: ' : 'Updated: ';
            results.push(prefix + schema.resourceName + (outcome.changed ? ' (' + outcome.message + ')' : ' (no change)'));
        } catch (err) {
            results.push('Error for ' + schema.resourceName + ': ' + err.message);
        }
    });

    logToSheet_('Setup Base Accounts completed');

    const summary = 'Accounts sheets setup complete.\n\n' + results.join('\n');
    
    // Clear all caches after setup
    if (typeof clearAllAppCaches === 'function') clearAllAppCaches();

    Logger.log(summary);
    if (!options.dialog) {
        try {
            SpreadsheetApp.getUi().alert(summary);
        } catch (e) { }
    }
    return summary;
}
