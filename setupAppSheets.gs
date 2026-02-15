/**
 * ============================================================
 * Little Leap — APP Database Sheet Setup Script
 * ============================================================
 * 
 * Run this script from Extensions → Apps Script in the APP 
 * Google Sheet to create the required sheets:
 *   - Users      (auto-ID: U0001, U0002, ...)
 *   - Roles      (auto-ID: R0001, R0002, ...)
 *   - UserRoles  (no ID column — junction table)
 *   - RolePermissions (no ID column — junction table)
 * 
 * Each sheet is created as a named Table (matching the sheet 
 * name) with header + 1 data row. New rows are added as needed.
 * 
 * The script is IDEMPOTENT — running it multiple times is safe.
 * Existing sheets with matching names are skipped.
 * ============================================================
 */

/**
 * Main entry point — run this function.
 */
function setupAppSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // ── Sheet Definitions ──────────────────────────────────────
  const sheetConfigs = [
    {
      name: 'Users',
      headers: ['UserID', 'Name', 'Email', 'PasswordHash', 'Status'],
      // Auto-ID formula for column 1: generates U0001, U0002, ...
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
        'UserID': 100,
        'Name': 180,
        'Email': 220,
        'PasswordHash': 260,
        'Status': 100
      }
    },
    {
      name: 'Roles',
      headers: ['RoleID', 'Name', 'Description'],
      // Auto-ID formula for column 1: generates R0001, R0002, ...
      autoIdFormula: '="R"&TEXT(ROW()-1,"0000")',
      validations: [],
      columnWidths: {
        'RoleID': 100,
        'Name': 180,
        'Description': 320
      }
    },
    {
      name: 'UserRoles',
      headers: ['UserID', 'RoleID'],
      autoIdFormula: null,  // No ID column — junction table
      validations: [],
      columnWidths: {
        'UserID': 120,
        'RoleID': 120
      }
    },
    {
      name: 'RolePermissions',
      headers: ['RoleID', 'Resource', 'CanRead', 'CanWrite', 'CanUpdate', 'CanDelete'],
      autoIdFormula: null,  // No ID column — junction table
      validations: [
        {
          colHeader: 'CanRead',
          rule: SpreadsheetApp.newDataValidation()
            .requireCheckbox()
            .build()
        },
        {
          colHeader: 'CanWrite',
          rule: SpreadsheetApp.newDataValidation()
            .requireCheckbox()
            .build()
        },
        {
          colHeader: 'CanUpdate',
          rule: SpreadsheetApp.newDataValidation()
            .requireCheckbox()
            .build()
        },
        {
          colHeader: 'CanDelete',
          rule: SpreadsheetApp.newDataValidation()
            .requireCheckbox()
            .build()
        }
      ],
      columnWidths: {
        'RoleID': 100,
        'Resource': 180,
        'CanRead': 90,
        'CanWrite': 90,
        'CanUpdate': 100,
        'CanDelete': 100
      }
    }
  ];

  // ── Process Each Sheet ─────────────────────────────────────
  const results = [];

  sheetConfigs.forEach(function(config) {
    // Check if sheet already exists
    let sheet = ss.getSheetByName(config.name);

    if (sheet) {
      results.push('⏭️  Sheet "' + config.name + '" already exists — skipped.');
      return;
    }

    // Create the sheet
    sheet = ss.insertSheet(config.name);

    // 1. Write headers
    const headerRange = sheet.getRange(1, 1, 1, config.headers.length);
    headerRange.setValues([config.headers]);

    // 2. Format headers — bold, background color, white text, center-aligned
    headerRange
      .setFontWeight('bold')
      .setBackground('#4a86c8')
      .setFontColor('#ffffff')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle')
      .setFontSize(10);

    // 3. Set header row height
    sheet.setRowHeight(1, 32);

    // 4. Freeze header row
    sheet.setFrozenRows(1);

    // 5. Set column widths
    config.headers.forEach(function(header, index) {
      if (config.columnWidths && config.columnWidths[header]) {
        sheet.setColumnWidth(index + 1, config.columnWidths[header]);
      }
    });

    // 6. Remove extra columns (Google Sheets defaults to 26 columns)
    var totalCols = sheet.getMaxColumns();
    if (totalCols > config.headers.length) {
      sheet.deleteColumns(config.headers.length + 1, totalCols - config.headers.length);
    }

    // 7. Remove extra rows — keep only header + 1 data row
    var totalRows = sheet.getMaxRows();
    if (totalRows > 2) {
      sheet.deleteRows(3, totalRows - 2);
    }

    // 8. Set auto-ID formula in row 2, column 1 (if applicable)
    if (config.autoIdFormula) {
      sheet.getRange(2, 1).setFormula(config.autoIdFormula);
    }

    // 9. Apply data validation rules to data row(s)
    if (config.validations && config.validations.length > 0) {
      config.validations.forEach(function(v) {
        var colIndex = config.headers.indexOf(v.colHeader);
        if (colIndex === -1) return;

        var validationRange = sheet.getRange(2, colIndex + 1, 1, 1);
        validationRange.setDataValidation(v.rule);
      });
    }

    // 10. Create named table (banded range) — header + 1 data row
    var tableRange = sheet.getRange(1, 1, 2, config.headers.length);
    var banding = tableRange.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY);
    banding.setHeaderRowColor('#4a86c8')
           .setFirstRowColor('#ffffff')
           .setSecondRowColor('#f3f6fb');

    // 11. Add header row protection (warning only — no hard lock)
    var protection = sheet.getRange(1, 1, 1, config.headers.length).protect();
    protection.setDescription(config.name + ' Headers — Do Not Edit');
    protection.setWarningOnly(true);

    // 12. Set default number format for data row to plain text
    //     (prevents auto-formatting of IDs, hashes, etc.)
    sheet.getRange(2, 1, 1, config.headers.length).setNumberFormat('@');

    results.push('✅  Sheet "' + config.name + '" created successfully.');
  });

  // ── Remove default "Sheet1" if it exists and is empty ──────
  var defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && defaultSheet.getLastRow() === 0) {
    ss.deleteSheet(defaultSheet);
    results.push('🗑️  Removed empty default "Sheet1".');
  }

  // ── Summary ────────────────────────────────────────────────
  var summary = '🏁 Setup Complete!\n\n' + results.join('\n');
  Logger.log(summary);
  try {
    SpreadsheetApp.getUi().alert(summary);
  } catch (e) {
    // getUi() not available in this context — summary is in the Execution Log
  }
}
