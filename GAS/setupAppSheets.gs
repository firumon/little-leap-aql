/**
 * ============================================================
 * Little Leap AQL - APP Database Sheet Setup Script
 * ============================================================
 */

// Shared constants are located in Constants.gs

function setupAppSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const sheetConfigs = [
    {
      name: CONFIG.SHEETS.USERS,
      headers: ['UserID', 'Name', 'Email', 'PasswordHash', 'DesignationID', 'Roles', 'Status', 'Avatar', 'ApiKey'],
      autoIdFormula: '="U"&TEXT(ROW()-1,"0000")',
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
        Status: 100,
        Avatar: 200,
        ApiKey: 220
      }
    },
    {
      name: CONFIG.SHEETS.DESIGNATIONS,
      headers: ['DesignationID', 'Name', 'HierarchyLevel', 'Status', 'Description'],
      autoIdFormula: '="D"&TEXT(ROW()-1,"0000")',
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
      name: CONFIG.SHEETS.ROLES,
      headers: ['RoleID', 'Name', 'Description'],
      autoIdFormula: '="R"&TEXT(ROW()-1,"0000")',
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
      name: CONFIG.SHEETS.RESOURCES,
      headers: [
        'Name',
        'Scope',
        'IsActive',
        'FileID',
        'SheetName',
        'CodePrefix',
        'CodeSequenceLength',
        'SkipColumns',
        'Audit',
        'RequiredHeaders',
        'UniqueHeaders',
        'UniqueCompositeHeaders',
        'DefaultValues',
        'RecordAccessPolicy',
        'OwnerUserField',
        'AdditionalActions',
        'MenuGroup',
        'MenuOrder',
        'MenuLabel',
        'MenuIcon',
        'RoutePath',
        'PageTitle',
        'PageDescription',
        'UIFields',
        'ShowInMenu',
        'IncludeInAuthorizationPayload'
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
          colHeader: 'ShowInMenu',
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
        }
      ],
      columnWidths: {
        Name: 180,
        Scope: 100,
        IsActive: 90,
        FileID: 280,
        SheetName: 160,
        CodePrefix: 120,
        CodeSequenceLength: 140,
        SkipColumns: 110,
        Audit: 90,
        RequiredHeaders: 220,
        UniqueHeaders: 220,
        UniqueCompositeHeaders: 260,
        DefaultValues: 260,
        RecordAccessPolicy: 160,
        OwnerUserField: 150,
        AdditionalActions: 220,
        MenuGroup: 120,
        MenuOrder: 110,
        MenuLabel: 140,
        MenuIcon: 120,
        RoutePath: 220,
        PageTitle: 180,
        PageDescription: 260,
        UIFields: 320,
        ShowInMenu: 100,
        IncludeInAuthorizationPayload: 220
      }
    }
  ];

  const results = [];

  sheetConfigs.forEach(function(config) {
    let sheet = ss.getSheetByName(config.name);

    if (sheet) {
      results.push('Skipped existing sheet: ' + config.name);
      return;
    }

    sheet = ss.insertSheet(config.name);

    const headerRange = sheet.getRange(1, 1, 1, config.headers.length);
    headerRange.setValues([config.headers]);
    headerRange
      .setFontWeight('bold')
      .setBackground(CONFIG.BRAND_COLOR)
      .setFontColor('#ffffff')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle')
      .setFontSize(10);

    sheet.setRowHeight(1, 32);
    sheet.setFrozenRows(1);

    config.headers.forEach(function(header, index) {
      if (config.columnWidths && config.columnWidths[header]) {
        sheet.setColumnWidth(index + 1, config.columnWidths[header]);
      }
    });

    var totalCols = sheet.getMaxColumns();
    if (totalCols > config.headers.length) {
      sheet.deleteColumns(config.headers.length + 1, totalCols - config.headers.length);
    }

    var totalRows = sheet.getMaxRows();
    if (totalRows > 2) {
      sheet.deleteRows(3, totalRows - 2);
    }

    if (config.autoIdFormula) {
      sheet.getRange(2, 1).setFormula(config.autoIdFormula);
    }

    if (config.validations && config.validations.length > 0) {
      config.validations.forEach(function(v) {
        var colIndex = config.headers.indexOf(v.colHeader);
        if (colIndex === -1) return;
        sheet.getRange(2, colIndex + 1, 1, 1).setDataValidation(v.rule);
      });
    }

    var tableRange = sheet.getRange(1, 1, 2, config.headers.length);
    var banding = tableRange.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY);
    banding.setHeaderRowColor(CONFIG.BRAND_COLOR)
      .setFirstRowColor('#ffffff')
      .setSecondRowColor('#f3f6fb');

    var protection = sheet.getRange(1, 1, 1, config.headers.length).protect();
    protection.setDescription(config.name + ' Headers - Do Not Edit');
    protection.setWarningOnly(true);

    sheet.getRange(2, 1, 1, config.headers.length).setNumberFormat('@');

    results.push('Created sheet: ' + config.name);
  });

  var defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && defaultSheet.getLastRow() === 0) {
    ss.deleteSheet(defaultSheet);
    results.push('Removed empty default Sheet1');
  }

  var summary = 'Setup complete.\n\n' + results.join('\n');
  Logger.log(summary);
  try {
    SpreadsheetApp.getUi().alert(summary);
  } catch (e) {}
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
  headers.forEach(function(h, i) { idx[h] = i; });

  const targets = ['IsActive', 'Audit', 'ShowInMenu', 'IncludeInAuthorizationPayload'];
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['TRUE', 'FALSE'], true)
    .setAllowInvalid(false)
    .build();

  const maxRows = Math.max(sheet.getMaxRows() - 1, 1);
  targets.forEach(function(header) {
    if (idx[header] === undefined) return;
    sheet.getRange(2, idx[header] + 1, maxRows, 1).setDataValidation(rule);
  });

  SpreadsheetApp.getUi().alert('Resources boolean validation updated to TRUE/FALSE dropdown.');
}
