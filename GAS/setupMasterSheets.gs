/**
 * ============================================================
 * AQL - MASTER Sheet Setup (Resources Driven)
 * ============================================================
 * Run this function in APP Apps Script project only.
 * It reads APP.Resources, opens target files by FileID,
 * and creates/updates configured MASTER sheets there.
 *
 * Shared helpers: setupSheetUtils.gs (setup_* functions)
 */

function setupMasterSheets() {
  resetLogSheet_();
  logToSheet_('Starting Refactor MASTER Sheets');

  const commonAuditColumns = ['CreatedAt', 'UpdatedAt', 'CreatedBy', 'UpdatedBy'];

  const schemaByResource = [
    {
      resourceName: CONFIG.MASTER_SHEETS.PRODUCTS,
      headers: ['Code', 'Name', 'VariantTypes', 'AccessRegion', 'Status'].concat(commonAuditColumns),
      statusDefault: 'Active',
      defaults: { Status: 'Active' },
      columnWidths: {
        Code: 130, Name: 260, VariantTypes: 200, AccessRegion: 130, Status: 100,
        CreatedAt: 170, UpdatedAt: 170, CreatedBy: 140, UpdatedBy: 140
      }
    },
    {
      resourceName: CONFIG.MASTER_SHEETS.SKUS,
      headers: ['Code', 'ProductCode', 'Variant1', 'Variant2', 'Variant3', 'Variant4', 'Variant5', 'UOM', 'Status'].concat(commonAuditColumns),
      statusDefault: 'Active',
      defaults: { Status: 'Active' },
      columnWidths: {
        Code: 140, ProductCode: 140, Variant1: 150, Variant2: 150, Variant3: 150, Variant4: 150, Variant5: 150, UOM: 100, Status: 100,
        CreatedAt: 170, UpdatedAt: 170, CreatedBy: 140, UpdatedBy: 140
      }
    },
    {
      resourceName: CONFIG.MASTER_SHEETS.UOMS,
      headers: ['Code', 'Name', 'BaseUOM', 'ConversionFactor', 'Status'].concat(commonAuditColumns),
      statusDefault: 'Active',
      defaults: { Status: 'Active' },
      columnWidths: {
        Code: 100, Name: 200, BaseUOM: 100, ConversionFactor: 150, Status: 100,
        CreatedAt: 170, UpdatedAt: 170, CreatedBy: 140, UpdatedBy: 140
      }
    },
      {
        resourceName: CONFIG.MASTER_SHEETS.CURRENCIES,
        headers: ['Code', 'Name', 'Symbol', 'Subunit', 'Decimals', 'BaseCurrency', 'ConversionFactor', 'AccessRegion', 'Status'].concat(commonAuditColumns),
        statusDefault: 'Active',
        defaults: { Status: 'Active', Decimals: 2, BaseCurrency: 'FALSE', ConversionFactor: 1 },
        columnWidths: {
          Code: 100, Name: 200, Symbol: 80, Subunit: 100, Decimals: 90, BaseCurrency: 120, ConversionFactor: 150, AccessRegion: 130, Status: 100,
          CreatedAt: 170, UpdatedAt: 170, CreatedBy: 140, UpdatedBy: 140
        }
      },
      {
        resourceName: CONFIG.MASTER_SHEETS.PRICE_LIST,
        headers: ['Code', 'Name', 'Description', 'Currency', 'IsDefault', 'SKUPrices', 'AccessRegion', 'Status'].concat(commonAuditColumns),
        statusDefault: 'Active',
        defaults: { Status: 'Active', IsDefault: 'FALSE' },
        columnWidths: {
          Code: 130, Name: 260, Description: 300, Currency: 100, IsDefault: 100, SKUPrices: 400, AccessRegion: 130, Status: 100,
          CreatedAt: 170, UpdatedAt: 170, CreatedBy: 140, UpdatedBy: 140
        }
      },
      {
        resourceName: CONFIG.MASTER_SHEETS.PRICE_LIST_ITEMS,
        headers: ['Code', 'PriceListCode', 'SKUCode', 'Price', 'Status'].concat(commonAuditColumns),
        statusDefault: 'Active',
        defaults: { Status: 'Active' },
        columnWidths: {
          Code: 140, PriceListCode: 140, SKUCode: 140, Price: 100, Status: 100,
          CreatedAt: 170, UpdatedAt: 170, CreatedBy: 140, UpdatedBy: 140
        }
      },
    {
      resourceName: CONFIG.MASTER_SHEETS.SUPPLIERS,
      headers: ['Code', 'Name', 'Country', 'Province', 'City', 'CommunicationAddress', 'ContactPerson', 'Phone', 'Email', 'AccessRegion', 'Status'].concat(commonAuditColumns),
      statusDefault: 'Active',
      defaults: { Status: 'Active' },
      columnWidths: {
        Code: 130, Name: 220, Country: 150, Province: 150, City: 150, CommunicationAddress: 260, ContactPerson: 180, Phone: 140, Email: 220, AccessRegion: 130, Status: 100,
        CreatedAt: 170, UpdatedAt: 170, CreatedBy: 140, UpdatedBy: 140
      }
    },
    {
      resourceName: CONFIG.MASTER_SHEETS.WAREHOUSES,
      headers: ['Code', 'Name', 'Area', 'City', 'Province' ,'Country', 'Type', 'Licence', 'AccessRegion', 'Status'].concat(commonAuditColumns),
      statusDefault: 'Active',
      defaults: { Status: 'Active', Country: 'UAE', Type: 'Main' },
      columnWidths: {
        Code: 130, Name: 220, Province: 150, Area: 150, City: 150, Country: 130, Type: 120, Licence: 150, AccessRegion: 130, Status: 100,
        CreatedAt: 170, UpdatedAt: 170, CreatedBy: 140, UpdatedBy: 140
      }
    },
    {
      resourceName: CONFIG.MASTER_SHEETS.OUTLETS,
      headers: ['Code', 'Name', 'ContactPerson', 'Phone', 'Email', 'Country', 'Province', 'City', 'Area', 'CommunicationAddress', 'MapLocationLink', 'Picture', 'Picture2', 'Picture3', 'Licence', 'AccessRegion', 'Status'].concat(commonAuditColumns),
      statusDefault: 'Active',
      defaults: { Status: 'Active', Country: 'UAE' },
      columnWidths: {
        Code: 130, Name: 240, ContactPerson: 180, Phone: 140, Email: 220,
        Country: 120, Province: 150, Area: 150, City: 140, CommunicationAddress: 260,
        MapLocationLink: 180, Picture: 150, Picture2: 150, Picture3: 150, Licence: 150,
        AccessRegion: 130, Status: 100, CreatedAt: 170, UpdatedAt: 170, CreatedBy: 140, UpdatedBy: 140
      }
    },
    {
      resourceName: CONFIG.MASTER_SHEETS.OUTLET_OPERATING_RULES,
      headers: ['Code', 'OutletCode', 'MaxStockValueLimit', 'VisitFrequencyDays', 'CreditLimit', 'PriceListCode', 'AccessRegion', 'Status'].concat(commonAuditColumns),
      statusDefault: 'Active',
      defaults: { Status: 'Active', MaxStockValueLimit: 0, VisitFrequencyDays: 14, CreditLimit: 0, PriceListCode: '' },
      columnWidths: {
        Code: 130, OutletCode: 140, MaxStockValueLimit: 170, VisitFrequencyDays: 170, CreditLimit: 130, PriceListCode: 140,
        AccessRegion: 130, Status: 100, CreatedAt: 170, UpdatedAt: 170, CreatedBy: 140, UpdatedBy: 140
      }
    }
   ];

  const fileSheetIndex = {};
  const results = [];

  schemaByResource.forEach(function (schema) {
    logToSheet_('Processing ' + schema.resourceName);
    try {
      const resource = getResourceConfig(schema.resourceName);
      if (resource.codeSequenceLength > 0) {
        if (!resource.codePrefix) {
          throw new Error('CodePrefix is missing in Resources for ' + schema.resourceName);
        }
      }

      const file = openSpreadsheetById(resource.fileId);
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
      setup_applyHeaderFormatting(sheet, schema.headers, schema.columnWidths);
      if (isNewSheet) {
        setup_trimToHeaderOnly(sheet);
      }

      setup_applyColumnDefaults(sheet, schema.headers, schema.defaults || {});
      setup_clearDataValidations(sheet, schema.headers.length);
      setup_applyListValidation(sheet, schema.headers, 'Status', ['Active', 'Inactive']);
      setup_fillBlankColumn(sheet, schema.headers, 'Status', schema.statusDefault || 'Active');
      setup_protectHeaderRow(sheet, schema.headers.length);
      setup_applyBanding(sheet, schema.headers.length);
      setup_setPlainTextFormat(sheet, schema.headers.length);

      if (!fileSheetIndex[resource.fileId]) fileSheetIndex[resource.fileId] = 0;
      fileSheetIndex[resource.fileId]++;
      file.setActiveSheet(sheet);
      file.moveActiveSheet(fileSheetIndex[resource.fileId]);

    } catch (err) {
      results.push('Error for ' + schema.resourceName + ': ' + err.message);
    }
  });

  logToSheet_('Refactor MASTER Sheets completed');

  const summary = 'MASTER setup (Resources driven) complete.\n\n' + results.join('\n');

  // Clear all caches after setup
  if (typeof clearAllAppCaches === 'function') clearAllAppCaches();

  Logger.log(summary);
  try {
    SpreadsheetApp.getUi().alert(summary);
  } catch (e) {
    // Non-UI context
  }
}
