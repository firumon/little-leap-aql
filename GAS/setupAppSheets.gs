/**
 * ============================================================
 * AQL - APP Database Sheet Setup Script
 * ============================================================
 */

// Shared constants are located in Constants.gs

function setupAppSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const sheetConfigs = [
    {
      name: CONFIG.SHEETS.CONFIG,
      headers: ['Key', 'Value'],
      autoIdFormula: null,
      validations: [],
      columnWidths: {
        Key: 200,
        Value: 400
      }
    },
    {
      name: CONFIG.SHEETS.RESOURCES,
      headers: [
        'Name',
        'Scope',
        'ParentResource',
        'IsActive',
        'FileID',
        'SheetName',
        'CodePrefix',
        'CodeSequenceLength',
        'LastDataUpdatedAt',
        'Audit',
        'RequiredHeaders',
        'UniqueHeaders',
        'UniqueCompositeHeaders',
        'DefaultValues',
        'RecordAccessPolicy',
        'OwnerUserField',
        'AdditionalActions',
        'Menu',
        'UIFields',
        'IncludeInAuthorizationPayload',
        'Functional',
        'PreAction',
        'PostAction',
        'Reports',
        'ListViews',
        'CustomUIName'
      ],
      autoIdFormula: null,
      validations: [
        {
          colHeader: 'IsActive',
          rule: SpreadsheetApp.newDataValidation()
            .requireValueInList(['TRUE', 'FALSE'], true)
            .setAllowInvalid(false)
            .build()
        },
        {
          colHeader: 'Audit',
          rule: SpreadsheetApp.newDataValidation()
            .requireValueInList(['TRUE', 'FALSE'], true)
            .setAllowInvalid(false)
            .build()
        },
        {
          colHeader: 'IncludeInAuthorizationPayload',
          rule: SpreadsheetApp.newDataValidation()
            .requireValueInList(['TRUE', 'FALSE'], true)
            .setAllowInvalid(false)
            .build()
        },
        {
          colHeader: 'Functional',
          rule: SpreadsheetApp.newDataValidation()
            .requireValueInList(['TRUE', 'FALSE'], true)
            .setAllowInvalid(false)
            .build()
        }
      ],
      columnWidths: {
        Name: 180,
        Scope: 100,
        ParentResource: 180,
        IsActive: 90,
        FileID: 280,
        SheetName: 160,
        CodePrefix: 120,
        CodeSequenceLength: 140,
        LastDataUpdatedAt: 170,
        Audit: 90,
        RequiredHeaders: 220,
        UniqueHeaders: 220,
        UniqueCompositeHeaders: 260,
        DefaultValues: 260,
        RecordAccessPolicy: 160,
        OwnerUserField: 150,
        AdditionalActions: 220,
        Menu: 400,
        UIFields: 320,
        IncludeInAuthorizationPayload: 220,
        Functional: 100,
        PreAction: 180,
        PostAction: 180,
        Reports: 320,
        ListViews: 320,
        CustomUIName: 160
      }
    },
    {
      name: CONFIG.SHEETS.ROLES,
      headers: ['RoleID', 'Name', 'Description'],
      autoIdFormula: null,
      validations: [],
      columnWidths: {
        RoleID: 100,
        Name: 180,
        Description: 320
      }
    },
    {
      name: CONFIG.SHEETS.ROLE_PERMISSIONS,
      headers: ['RoleID', 'Resource', 'Actions'],
      autoIdFormula: null,
      validations: [],
      columnWidths: {
        RoleID: 100,
        Resource: 180,
        Actions: 300
      }
    },
    {
      name: CONFIG.SHEETS.DESIGNATIONS,
      headers: ['DesignationID', 'Name', 'HierarchyLevel', 'Status', 'Description'],
      autoIdFormula: null,
      validations: [
        {
          colHeader: 'Status',
          rule: SpreadsheetApp.newDataValidation()
            .requireValueInList(['Active', 'Inactive'], true)
            .setAllowInvalid(false)
            .build()
        }
      ],
      columnWidths: {
        DesignationID: 120,
        Name: 180,
        HierarchyLevel: 120,
        Status: 100,
        Description: 320
      }
    },
    {
      name: CONFIG.SHEETS.USERS,
      headers: ['UserID', 'Name', 'Email', 'PasswordHash', 'DesignationID', 'Roles', 'AccessRegion', 'Status', 'Avatar', 'ApiKey'],
      autoIdFormula: null,
      validations: [
        {
          colHeader: 'Status',
          rule: SpreadsheetApp.newDataValidation()
            .requireValueInList(['Active', 'Inactive'], true)
            .setAllowInvalid(false)
            .build()
        }
      ],
      columnWidths: {
        UserID: 100,
        Name: 180,
        Email: 220,
        PasswordHash: 260,
        DesignationID: 120,
        Roles: 180,
        AccessRegion: 120,
        Status: 100,
        Avatar: 200,
        ApiKey: 220
      }
    },
    {
      name: CONFIG.SHEETS.ACCESS_REGIONS,
      headers: ['Code', 'Name', 'Parent'],
      autoIdFormula: null,
      validations: [
        {
          colHeader: 'Code',
          rule: SpreadsheetApp.newDataValidation()
            .requireFormulaSatisfied('=REGEXMATCH(A2, "^[A-Z]{3}[0-9]{3}$")')
            .setAllowInvalid(false)
            .build()
        }
      ],
      columnWidths: {
        Code: 120,
        Name: 200,
        Parent: 120
      }
    },
    {
      name: CONFIG.SHEETS.METADATA,
      headers: ['Key', 'Value'],
      autoIdFormula: null,
      validations: [],
      columnWidths: {
        Key: 300,
        Value: 600
      }
    },
  ];

  const results = [];
  let fileSheetIndex = 0;

  sheetConfigs.forEach(function (config) {
    let sheet = ss.getSheetByName(config.name);
    let isNewSheet = false;

    if (!sheet) {
      sheet = ss.insertSheet(config.name);
      isNewSheet = true;
      results.push('Created sheet: ' + config.name);
    } else {
      results.push('Updated sheet: ' + config.name);
    }

    // Refactor schema dynamically (preserves data if sheet exists)
    setup_normalizeSheetSchema(sheet, config.headers);

    // Styling
    const headerRange = sheet.getRange(1, 1, 1, config.headers.length);
    headerRange
      .setFontWeight('bold')
      .setBackground(CONFIG.BRAND_COLOR)
      .setFontColor('#ffffff')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle')
      .setFontSize(10);

    sheet.setRowHeight(1, 32);
    sheet.setFrozenRows(1);

    config.headers.forEach(function (header, index) {
      if (config.columnWidths && config.columnWidths[header]) {
        sheet.setColumnWidth(index + 1, config.columnWidths[header]);
      }
    });

    if (isNewSheet) {
      var totalRows = sheet.getMaxRows();
      if (totalRows > 2) {
        sheet.deleteRows(3, totalRows - 2);
      }
    }

    if (config.autoIdFormula) {
      const lr = Math.max(sheet.getLastRow(), 2);
      for (let r = 2; r <= lr; r++) {
        sheet.getRange(r, 1).setFormula(config.autoIdFormula);
      }
    }

    if (config.validations && config.validations.length > 0) {
      const dataRows = Math.max(sheet.getMaxRows() - 1, 1);
      config.validations.forEach(function (v) {
        var colIndex = config.headers.indexOf(v.colHeader);
        if (colIndex === -1) return;
        sheet.getRange(2, colIndex + 1, dataRows, 1).setDataValidation(v.rule);
      });
    }

    // Banding
    const bandings = sheet.getBandings();
    bandings.forEach(function (b) { b.remove(); });

    var rowCount = Math.max(sheet.getLastRow(), 2);
    var tableRange = sheet.getRange(1, 1, rowCount, config.headers.length);
    var banding = tableRange.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY);
    banding.setHeaderRowColor(CONFIG.BRAND_COLOR)
      .setFirstRowColor('#ffffff')
      .setSecondRowColor('#f3f6fb');

    // Protections
    const protections = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
    protections.forEach(function (p) {
      const r = p.getRange();
      if (r && r.getRow() === 1) {
        p.remove();
      }
    });
    var protection = sheet.getRange(1, 1, 1, config.headers.length).protect();
    protection.setDescription(config.name + ' Headers - Do Not Edit');
    protection.setWarningOnly(true);

    if (sheet.getMaxRows() > 1) {
      sheet.getRange(2, 1, Math.max(sheet.getMaxRows() - 1, 1), config.headers.length).setNumberFormat('@');
    }

    fileSheetIndex++;
    ss.setActiveSheet(sheet);
    ss.moveActiveSheet(fileSheetIndex);

  });

  // Ensure Config sheet includes expected keys (append any missing keys).
  var configSheet = ss.getSheetByName(CONFIG.SHEETS.CONFIG);
  if (configSheet) {
    var defaultKeys = [
      ['CompanyName', ''],
      ['CompanyLogo', ''],
      ['ContactEmail', ''],
      ['ContactPhone', ''],
      ['ColorPrimary', ''],
      ['ColorSecondary', ''],
      ['MasterFileID', ''],
      ['OperationFileID', ''],
      ['ReportFileID', ''],
      ['AccountsFileID', ''],
      ['MasterSyncTTL', '900'],
      ['AccountsSyncTTL', '60'],
      ['OperationsSyncTTL', '300']
    ];

    var lastRow = configSheet.getLastRow();
    if (lastRow <= 1) {
      configSheet.getRange(2, 1, defaultKeys.length, 2).setValues(defaultKeys);
    } else {
      var existingKeys = {};
      var keyValues = configSheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var k = 0; k < keyValues.length; k++) {
        var existingKey = (keyValues[k][0] || '').toString().trim().toLowerCase();
        if (existingKey) existingKeys[existingKey] = true;
      }

      var missingRows = [];
      for (var i = 0; i < defaultKeys.length; i++) {
        var expectedKey = (defaultKeys[i][0] || '').toString().trim().toLowerCase();
        if (!expectedKey || existingKeys[expectedKey]) continue;
        missingRows.push(defaultKeys[i]);
      }

      if (missingRows.length) {
        configSheet
          .getRange(configSheet.getLastRow() + 1, 1, missingRows.length, 2)
          .setValues(missingRows);
      }
    }
  }

  // AppOptions sheet — horizontal layout, no header row, each row = [key, val1, val2, ...]
  var appOptionsSheet = ss.getSheetByName(CONFIG.SHEETS.APP_OPTIONS);
  if (!appOptionsSheet) {
    appOptionsSheet = ss.insertSheet(CONFIG.SHEETS.APP_OPTIONS);
    results.push('Created sheet: ' + CONFIG.SHEETS.APP_OPTIONS);
  } else {
    results.push('Updated sheet: ' + CONFIG.SHEETS.APP_OPTIONS);
  }

  // Column widths: key column wider, value columns standard
  appOptionsSheet.setColumnWidth(1, 250);
  for (var col = 2; col <= 10; col++) {
    appOptionsSheet.setColumnWidth(col, 160);
  }

  // Seed missing option groups — never overwrites existing rows
  var appOptionsData = appOptionsSheet.getLastRow() > 0
    ? appOptionsSheet.getRange(1, 1, appOptionsSheet.getLastRow(), 1).getValues()
    : [];
  var existingOptionKeys = appOptionsData.map(function (r) { return (r[0] || '').toString().trim(); }).filter(Boolean);
  var seedKeys = Object.keys(APP_OPTIONS_SEED);
  var optionRowsToAppend = [];
  for (var s = 0; s < seedKeys.length; s++) {
    var seedKey = seedKeys[s];
    if (existingOptionKeys.indexOf(seedKey) === -1) {
      optionRowsToAppend.push([seedKey].concat(APP_OPTIONS_SEED[seedKey]));
    }
  }
  if (optionRowsToAppend.length > 0) {
    var appendStartRow = appOptionsSheet.getLastRow() + 1;
    var maxCols = optionRowsToAppend.reduce(function (max, r) { return Math.max(max, r.length); }, 1);
    // Pad all rows to maxCols to match range dimensions
    var paddedRows = optionRowsToAppend.map(function (r) {
      while (r.length < maxCols) {
        r.push('');
      }
      return r;
    });
    appOptionsSheet.getRange(appendStartRow, 1, paddedRows.length, maxCols).setValues(paddedRows);
  }

  // Delete empty rows beyond the last row with data
  var finalLastRow = appOptionsSheet.getLastRow();
  if (finalLastRow < appOptionsSheet.getMaxRows()) {
    var rowsToDelete = appOptionsSheet.getMaxRows() - finalLastRow;
    appOptionsSheet.deleteRows(finalLastRow + 1, rowsToDelete);
  }

  fileSheetIndex++;
  ss.setActiveSheet(appOptionsSheet);
  ss.moveActiveSheet(fileSheetIndex);

  var defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && defaultSheet.getLastRow() === 0) {
    ss.deleteSheet(defaultSheet);
    results.push('Removed empty default Sheet1');
  }

  var summary = 'Setup complete.\n\n' + results.join('\n');
  Logger.log(summary);

  try {
    syncAppResourcesFromCode(true);
    summary += '\n\nAutomatically synced APP.Resources from code.';
  } catch (e) {
    summary += '\n\n(Note: Auto-sync of APP.Resources failed: ' + e.message + ')';
  }

  try {
    setAppFileId();
    summary += '\nStored APP_FILE_ID in Script Properties.';
  } catch (e) {
    summary += '\n(Note: Failed to store APP_FILE_ID in Script Properties: ' + e.message + ')';
  }

  // Clear caches after full setup
  if (typeof clearAllAppCaches === 'function') {
    clearAllAppCaches();
  }

  try {
    SpreadsheetApp.getUi().alert(summary);
  } catch (e) { }
}

/**
 * Run this on existing APP sheets to fix Resources boolean validation
 * for text-based TSV paste (TRUE/FALSE).
 */
function fixResourcesBooleanValidation() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.RESOURCES);
  if (!sheet) throw new Error('Resources sheet not found');

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const idx = {};
  headers.forEach(function (h, i) { idx[h] = i; });

  const targets = ['IsActive', 'Audit', 'IncludeInAuthorizationPayload', 'Functional'];
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['TRUE', 'FALSE'], true)
    .setAllowInvalid(false)
    .build();

  const maxRows = Math.max(sheet.getMaxRows() - 1, 1);
  targets.forEach(function (header) {
    if (idx[header] === undefined) return;
    sheet.getRange(2, idx[header] + 1, maxRows, 1).setDataValidation(rule);
  });

  SpreadsheetApp.getUi().alert('Resources boolean validation updated to TRUE/FALSE dropdown.');
}

/**
 * Run on existing APP files to add Access Region structures without rebuilding.
 */
function upgradeAppSheetsForAccessRegions() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const users = ss.getSheetByName(CONFIG.SHEETS.USERS);
  if (!users) throw new Error('Users sheet not found');

  const userHeaders = getSheetHeaders(users);
  if (userHeaders.indexOf('AccessRegion') === -1) {
    const statusIndex = userHeaders.indexOf('Status');
    const insertAt = statusIndex === -1 ? userHeaders.length + 1 : (statusIndex + 1);
    users.insertColumnBefore(insertAt);
    users.getRange(1, insertAt).setValue('AccessRegion');
    users.setColumnWidth(insertAt, 120);
    users.getRange(2, insertAt, Math.max(users.getMaxRows() - 1, 1), 1).clearDataValidations();
  }

  let accessRegionSheet = ss.getSheetByName(CONFIG.SHEETS.ACCESS_REGIONS);
  if (!accessRegionSheet) {
    accessRegionSheet = ss.insertSheet(CONFIG.SHEETS.ACCESS_REGIONS);
    accessRegionSheet.getRange(1, 1, 1, 3).setValues([['Code', 'Name', 'Parent']]);
    accessRegionSheet.getRange(1, 1, 1, 3)
      .setFontWeight('bold')
      .setBackground(CONFIG.BRAND_COLOR)
      .setFontColor('#ffffff')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle')
      .setFontSize(10);
    accessRegionSheet.setRowHeight(1, 32);
    accessRegionSheet.setFrozenRows(1);
    accessRegionSheet.setColumnWidth(1, 120);
    accessRegionSheet.setColumnWidth(2, 200);
    accessRegionSheet.setColumnWidth(3, 120);
    accessRegionSheet.getRange(1, 1, 1, 3).protect().setDescription('AccessRegions Headers - Do Not Edit').setWarningOnly(true);
  }

  const codeRule = SpreadsheetApp.newDataValidation()
    .requireFormulaSatisfied('=REGEXMATCH(A2, "^[A-Z]{3}[0-9]{3}$")')
    .setAllowInvalid(false)
    .build();
  accessRegionSheet.getRange(2, 1, Math.max(accessRegionSheet.getMaxRows() - 1, 1), 1).setDataValidation(codeRule);

  SpreadsheetApp.getUi().alert('Upgrade complete: Users.AccessRegion and AccessRegions sheet are ready.');
}

// Local helpers removed — now using shared setup_* from setupSheetUtils.gs
