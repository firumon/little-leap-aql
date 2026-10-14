/**
 * ============================================================
 * AQL - APP Database Sheet Setup Script
 * ============================================================
 */

// Shared constants are located in Constants.gs

function setupAppSheets() {
  if (typeof clearAllAppCaches === 'function') clearAllAppCaches();
  resetLogSheet_();

  logToSheet_('Starting Refactor APP Sheets');

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const sheetConfigs = [
    {
      name: CONFIG.SHEETS.CONFIG,
      headers: ['Key', 'Value'],
      autoIdFormula: null,
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
        'Settings',
        'DefaultValues',
        'AccessPolicy',
        'AccessRegionSource',
        'OwnerUserField',
        'AdditionalActions',
        'Menu',
        'UIFields',
        'IncludeInAuthorizationPayload',
        'Functional',
        'PreAction',
        'PostAction',
        'Dashboard',
        'Reports',
        'ListViews',
        'Options',
        'CustomUIName',
        'Relations'
      ],
      autoIdFormula: null,
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
        Settings: 320,
        DefaultValues: 260,
        AccessPolicy: 140,
        AccessRegionSource: 260,
        OwnerUserField: 150,
        AdditionalActions: 220,
        Menu: 400,
        UIFields: 320,
        IncludeInAuthorizationPayload: 220,
        Functional: 100,
        PreAction: 180,
        PostAction: 180,
        Dashboard: 320,
        Reports: 320,
        ListViews: 320,
        Options: 320,
        CustomUIName: 160,
        Relations: 320
      }
    },
    {
      name: CONFIG.SHEETS.ROLES,
      headers: ['RoleID', 'Name', 'Description'],
      autoIdFormula: null,
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
      columnWidths: {
        RoleID: 100,
        Resource: 180,
        Actions: 300
      }
    },
    {
      name: CONFIG.SHEETS.DESIGNATIONS,
      headers: ['DesignationID', 'Name', 'ParentDesignationID', 'Status', 'AccessRegion', 'DashboardScoreCutoff', 'Description'],
      autoIdFormula: null,
      columnWidths: {
        DesignationID: 120,
        Name: 180,
        ParentDesignationID: 140,
        Status: 100,
        AccessRegion: 160,
        DashboardScoreCutoff: 170,
        Description: 320
      }
    },
    {
      name: CONFIG.SHEETS.USERS,
      headers: ['UserID', 'Name', 'Email', 'PasswordHash', 'DesignationID', 'Roles', 'Status', 'Avatar', 'ApiKey'],
      autoIdFormula: null,
      columnWidths: {
        UserID: 100,
        Name: 180,
        Email: 220,
        PasswordHash: 260,
        DesignationID: 120,
        Roles: 180,
        Status: 100,
        Avatar: 200,
        ApiKey: 220
      }
    },
    {
      name: CONFIG.SHEETS.ACCESS_REGIONS,
      headers: ['Code', 'Name', 'Parent'],
      autoIdFormula: null,
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

  logToSheet_('APP sheets processed: ' + results.length + ' sheets');

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
       ['ViewsFileID', ''],
       ['ReportsFileID', ''],
       ['MasterSyncTTL', '900'],
       ['AccountsSyncTTL', '60'],
       ['OperationsSyncTTL', '300'],
       ['PriceListLookup', 'INLINE'],
       ['Currency', 'AED'],
       ['File', '{"provider":"php","url":"","bucketName":"","region":"","token":"","apiKey":"","params":{}}']
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

  logToSheet_('Config keys seeded');

  var oldAppOptionsSheet = ss.getSheetByName('AppOptions');
  if (oldAppOptionsSheet) {
    ss.deleteSheet(oldAppOptionsSheet);
    results.push('Removed obsolete AppOptions sheet');
  }

  var summary = 'Setup complete.\n\n' + results.join('\n');
  Logger.log(summary);

  logToSheet_('Syncing APP.Resources from code...');
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

  logToSheet_('APP File ID stored');

  // Clear caches after full setup
  if (typeof clearAllAppCaches === 'function') {
    clearAllAppCaches();
  }

  logToSheet_('Caches cleared, Refactor APP Sheets completed');

  try {
    SpreadsheetApp.getUi().alert(summary);
  } catch (e) { }
}


// Local helpers removed — now using shared setup_* from setupSheetUtils.gs

