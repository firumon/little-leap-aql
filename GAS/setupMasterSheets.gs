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
      headers: ['Code', 'Name', 'City', 'Country', 'Type', 'AccessRegion', 'Status'].concat(commonAuditColumns),
      statusDefault: 'Active',
      defaults: { Status: 'Active', Country: 'UAE', Type: 'Main' },
      columnWidths: {
        Code: 130, Name: 220, City: 150, Country: 130, Type: 120, AccessRegion: 130, Status: 100,
        CreatedAt: 170, UpdatedAt: 170, CreatedBy: 140, UpdatedBy: 140
      }
    },
    {
      resourceName: CONFIG.MASTER_SHEETS.PORTS,
      headers: ['Code', 'Name', 'Country', 'PortType', 'AccessRegion', 'Status'].concat(commonAuditColumns),
      statusDefault: 'Active',
      defaults: { Status: 'Active', Country: 'UAE' },
      columnWidths: {
        Code: 130, Name: 220, Country: 130, PortType: 130, AccessRegion: 130, Status: 100,
        CreatedAt: 170, UpdatedAt: 170, CreatedBy: 140, UpdatedBy: 140
      }
    },
    {
      resourceName: CONFIG.MASTER_SHEETS.CARRIERS,
      headers: ['Code', 'Name', 'Type', 'Phone', 'ContactPerson', 'AccessRegion', 'Status'].concat(commonAuditColumns),
      statusDefault: 'Active',
      defaults: { Status: 'Active' },
      columnWidths: {
        Code: 130, Name: 220, Type: 120, Phone: 140, ContactPerson: 180, AccessRegion: 130, Status: 100,
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
    }
  ];

  const fileSheetIndex = {};
  const results = [];

  schemaByResource.forEach(function (schema) {
    try {
      const resource = getResourceConfig(schema.resourceName);
      if (resource.codeSequenceLength > 0) {
        if (!resource.codePrefix) {
          throw new Error('CodePrefix is missing in Resources for ' + schema.resourceName);
        }
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
