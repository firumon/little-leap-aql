/**
 * ============================================================
 * Little Leap AQL - MASTER Sheet Setup (Resources Driven)
 * ============================================================
 * Run this function in APP Apps Script project only.
 * It reads APP.Resources, opens target files by FileID,
 * and creates/updates configured MASTER sheets there.
 */

function setupMasterSheets() {
  const commonAuditColumns = ['CreatedAt', 'UpdatedAt', 'CreatedBy', 'UpdatedBy'];

  const schemaByResource = [
    {
      resourceName: CONFIG.MASTER_SHEETS.PRODUCTS,
      headers: ['Code', 'Name', 'SKU', 'Status'].concat(commonAuditColumns),
      statusDefault: 'Active',
      defaults: { Status: 'Active' },
      columnWidths: {
        Code: 130,
        Name: 260,
        SKU: 140,
        Status: 100,
        CreatedAt: 170,
        UpdatedAt: 170,
        CreatedBy: 140,
        UpdatedBy: 140
      }
    },
    {
      resourceName: CONFIG.MASTER_SHEETS.SUPPLIERS,
      headers: ['Code', 'Name', 'Country', 'ContactPerson', 'Phone', 'Email', 'Status'].concat(commonAuditColumns),
      statusDefault: 'Active',
      defaults: { Status: 'Active' },
      columnWidths: {
        Code: 130,
        Name: 220,
        Country: 150,
        ContactPerson: 180,
        Phone: 140,
        Email: 220,
        Status: 100,
        CreatedAt: 170,
        UpdatedAt: 170,
        CreatedBy: 140,
        UpdatedBy: 140
      }
    },
    {
      resourceName: CONFIG.MASTER_SHEETS.WAREHOUSES,
      headers: ['Code', 'Name', 'City', 'Country', 'Type', 'Status'].concat(commonAuditColumns),
      statusDefault: 'Active',
      defaults: { Status: 'Active', Country: 'UAE', Type: 'Main' },
      columnWidths: {
        Code: 130,
        Name: 220,
        City: 150,
        Country: 130,
        Type: 120,
        Status: 100,
        CreatedAt: 170,
        UpdatedAt: 170,
        CreatedBy: 140,
        UpdatedBy: 140
      }
    },
    {
      resourceName: CONFIG.MASTER_SHEETS.WAREHOUSE_LOCATIONS,
      headers: ['Code', 'WarehouseCode', 'LocationCode', 'Description', 'Status'].concat(commonAuditColumns),
      statusDefault: 'Active',
      defaults: { Status: 'Active' },
      columnWidths: {
        Code: 130,
        WarehouseCode: 150,
        LocationCode: 150,
        Description: 240,
        Status: 100,
        CreatedAt: 170,
        UpdatedAt: 170,
        CreatedBy: 140,
        UpdatedBy: 140
      }
    },
    {
      resourceName: CONFIG.MASTER_SHEETS.CARRIERS,
      headers: ['Code', 'Name', 'Type', 'Phone', 'ContactPerson', 'Status'].concat(commonAuditColumns),
      statusDefault: 'Active',
      defaults: { Status: 'Active' },
      columnWidths: {
        Code: 130,
        Name: 220,
        Type: 120,
        Phone: 140,
        ContactPerson: 180,
        Status: 100,
        CreatedAt: 170,
        UpdatedAt: 170,
        CreatedBy: 140,
        UpdatedBy: 140
      }
    },
    {
      resourceName: CONFIG.MASTER_SHEETS.PORTS,
      headers: ['Code', 'Name', 'Country', 'PortType', 'Status'].concat(commonAuditColumns),
      statusDefault: 'Active',
      defaults: { Status: 'Active', Country: 'UAE' },
      columnWidths: {
        Code: 130,
        Name: 220,
        Country: 130,
        PortType: 130,
        Status: 100,
        CreatedAt: 170,
        UpdatedAt: 170,
        CreatedBy: 140,
        UpdatedBy: 140
      }
    }
  ];

  const statusValidationRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Active', 'Inactive'], true)
    .setAllowInvalid(false)
    .build();

  const results = [];

  schemaByResource.forEach(function(schema) {
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

      normalizeSheetSchema(sheet, schema.headers);
      applyMasterSheetFormatting(sheet, schema.headers, schema.columnWidths);
      if (isNewSheet) {
        trimToHeaderOnly(sheet);
      }

      applyColumnDefaults(sheet, schema.headers, schema.defaults || {});
      applyStatusValidation(sheet, schema.headers, statusValidationRule);
      fillBlankStatus(sheet, schema.headers, schema.statusDefault || 'Active');
      protectHeaderRow(sheet, schema.headers.length);
      applyBanding(sheet, schema.headers.length);

      if (sheet.getMaxRows() > 1) {
        sheet.getRange(2, 1, Math.max(sheet.getMaxRows() - 1, 1), schema.headers.length).setNumberFormat('@');
      }
    } catch (err) {
      results.push('Error for ' + schema.resourceName + ': ' + err.message);
    }
  });

  const summary = 'MASTER setup (Resources driven) complete.\n\n' + results.join('\n');
  Logger.log(summary);
  try {
    SpreadsheetApp.getUi().alert(summary);
  } catch (e) {
    // Non-UI context
  }
}

function normalizeSheetSchema(sheet, targetHeaders) {
  const lastRow = Math.max(sheet.getLastRow(), 1);
  const lastCol = Math.max(sheet.getLastColumn(), 1);

  const currentValues = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const currentHeaders = currentValues[0] || [];
  const headerIndexMap = buildHeaderIndexMap(currentHeaders);

  const existingRows = currentValues.slice(1);
  const normalizedRows = existingRows.map(function(row) {
    return targetHeaders.map(function(header) {
      const idx = headerIndexMap[header];
      return idx === undefined ? '' : row[idx];
    });
  });

  sheet.clearContents();

  sheet.getRange(1, 1, 1, targetHeaders.length).setValues([targetHeaders]);

  if (normalizedRows.length > 0) {
    sheet.getRange(2, 1, normalizedRows.length, targetHeaders.length).setValues(normalizedRows);
  }

  const totalCols = sheet.getMaxColumns();
  if (totalCols > targetHeaders.length) {
    sheet.deleteColumns(targetHeaders.length + 1, totalCols - targetHeaders.length);
  }
}

function applyMasterSheetFormatting(sheet, headers, columnWidths) {
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange
    .setFontWeight('bold')
    .setBackground(CONFIG.BRAND_COLOR)
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setFontSize(10);

  sheet.setRowHeight(1, 32);
  sheet.setFrozenRows(1);

  headers.forEach(function(header, i) {
    if (columnWidths && columnWidths[header]) {
      sheet.setColumnWidth(i + 1, columnWidths[header]);
    }
  });
}

function trimToHeaderOnly(sheet) {
  const maxRows = sheet.getMaxRows();
  if (maxRows > 1) {
    sheet.deleteRows(3, maxRows - 2);
  }
}

function applyColumnDefaults(sheet, headers, defaults) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  Object.keys(defaults).forEach(function(key) {
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

function applyStatusValidation(sheet, headers, validationRule) {
  const statusCol = headers.indexOf('Status');
  if (statusCol === -1) return;

  const maxRows = sheet.getMaxRows();
  if (maxRows < 2) return;
  sheet.getRange(2, statusCol + 1, maxRows - 1, 1).setDataValidation(validationRule);
}

function fillBlankStatus(sheet, headers, defaultStatus) {
  const statusCol = headers.indexOf('Status');
  if (statusCol === -1) return;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  for (let row = 2; row <= lastRow; row++) {
    const cell = sheet.getRange(row, statusCol + 1);
    const val = (cell.getValue() || '').toString().trim();
    if (!val) {
      cell.setValue(defaultStatus || 'Active');
    }
  }
}

function applyBanding(sheet, headerCount) {
  const bandings = sheet.getBandings();
  bandings.forEach(function(b) { b.remove(); });

  const rowCount = Math.max(sheet.getLastRow(), 2);
  const tableRange = sheet.getRange(1, 1, rowCount, headerCount);
  const banding = tableRange.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY);
  banding
    .setHeaderRowColor(CONFIG.BRAND_COLOR)
    .setFirstRowColor('#ffffff')
    .setSecondRowColor('#f3f6fb');
}

function protectHeaderRow(sheet, colCount) {
  const protections = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
  protections.forEach(function(p) {
    const r = p.getRange();
    if (r && r.getRow() === 1) {
      p.remove();
    }
  });

  const protection = sheet.getRange(1, 1, 1, colCount).protect();
  protection.setDescription(sheet.getName() + ' Headers - Do Not Edit');
  protection.setWarningOnly(true);
}

function buildHeaderIndexMap(headers) {
  const map = {};
  headers.forEach(function(h, i) {
    map[h] = i;
  });
  return map;
}
