/**
 * ============================================================
 * AQL - Shared Setup Sheet Utilities
 * ============================================================
 * Single source of truth for sheet schema normalization,
 * formatting, validation, and protection helpers.
 * Used by setupAppSheets, setupMasterSheets, setupOperationSheets,
 * and setupAccountSheets.
 */

/**
 * Normalizes sheet columns to match targetHeaders, preserving existing data.
 * Clears stale data validations before rebuild.
 */
function setup_normalizeSheetSchema(sheet, targetHeaders) {
  var lastRow = Math.max(sheet.getLastRow(), 1);
  var lastCol = Math.max(sheet.getLastColumn(), 1);

  var currentValues = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var currentHeaders = currentValues[0] || [];
  var headerIndexMap = {};
  currentHeaders.forEach(function(h, i) { headerIndexMap[h] = i; });

  var existingRows = currentValues.slice(1);
  var normalizedRows = existingRows.map(function(row) {
    return targetHeaders.map(function(header) {
      var idx = headerIndexMap[header];
      return idx === undefined ? '' : row[idx];
    });
  });

  sheet.clearContents();
  sheet.getRange(1, 1, lastRow, lastCol).clearDataValidations();
  sheet.getRange(1, 1, 1, targetHeaders.length).setValues([targetHeaders]);

  if (normalizedRows.length > 0) {
    sheet.getRange(2, 1, normalizedRows.length, targetHeaders.length).setValues(normalizedRows);
  }

  var totalCols = sheet.getMaxColumns();
  if (totalCols > targetHeaders.length) {
    sheet.deleteColumns(targetHeaders.length + 1, totalCols - targetHeaders.length);
  }
}

/**
 * Applies header formatting (bold, color, frozen row) and column widths.
 * @param {string} headerColor - Background color for header row (hex).
 */
function setup_applyHeaderFormatting(sheet, headers, columnWidths, headerColor) {
  var color = headerColor || CONFIG.BRAND_COLOR;
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange
    .setFontWeight('bold')
    .setBackground(color)
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setFontSize(10);

  sheet.setRowHeight(1, 32);
  sheet.setFrozenRows(1);

  if (columnWidths) {
    headers.forEach(function(header, i) {
      if (columnWidths[header]) {
        sheet.setColumnWidth(i + 1, columnWidths[header]);
      }
    });
  }
}

/**
 * Trims a new sheet to header + 1 empty row.
 */
function setup_trimToHeaderOnly(sheet) {
  var maxRows = sheet.getMaxRows();
  if (maxRows > 2) {
    sheet.deleteRows(3, maxRows - 2);
  }
}

/**
 * Fills blank cells in specified columns with default values.
 */
function setup_applyColumnDefaults(sheet, headers, defaults) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  Object.keys(defaults).forEach(function(key) {
    var colIdx = headers.indexOf(key);
    if (colIdx === -1) return;

    for (var row = 2; row <= lastRow; row++) {
      var cell = sheet.getRange(row, colIdx + 1);
      var value = cell.getValue();
      if (value === '' || value === null) {
        cell.setValue(defaults[key]);
      }
    }
  });
}

/**
 * Clears all data validations in the data area (row 2+).
 */
function setup_clearDataValidations(sheet, colCount) {
  var maxRows = sheet.getMaxRows();
  if (maxRows < 2 || colCount < 1) return;
  sheet.getRange(2, 1, maxRows - 1, colCount).clearDataValidations();
}

/**
 * Applies a dropdown list validation to a named column.
 */
function setup_applyListValidation(sheet, headers, columnName, valuesArray) {
  var colIdx = headers.indexOf(columnName);
  if (colIdx === -1) return;

  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(valuesArray, true)
    .setAllowInvalid(false)
    .build();

  var maxRows = sheet.getMaxRows();
  if (maxRows < 2) return;
  sheet.getRange(2, colIdx + 1, maxRows - 1, 1).setDataValidation(rule);
}

/**
 * Fills blank values in a named column with a default.
 */
function setup_fillBlankColumn(sheet, headers, columnName, defaultValue) {
  var colIdx = headers.indexOf(columnName);
  if (colIdx === -1) return;

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  for (var row = 2; row <= lastRow; row++) {
    var cell = sheet.getRange(row, colIdx + 1);
    var val = (cell.getValue() || '').toString().trim();
    if (!val) {
      cell.setValue(defaultValue);
    }
  }
}

/**
 * Protects the header row with a warning-only protection.
 */
function setup_protectHeaderRow(sheet, colCount) {
  var protections = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
  protections.forEach(function(p) {
    var r = p.getRange();
    if (r && r.getRow() === 1) {
      p.remove();
    }
  });

  var protection = sheet.getRange(1, 1, 1, colCount).protect();
  protection.setDescription(sheet.getName() + ' Headers - Do Not Edit');
  protection.setWarningOnly(true);
}

/**
 * Applies alternating row banding.
 * @param {string} headerColor - Header row banding color (hex).
 * @param {string} altColor - Second row alternation color (hex).
 */
function setup_applyBanding(sheet, headerCount, headerColor, altColor) {
  var bandings = sheet.getBandings();
  bandings.forEach(function(b) { b.remove(); });

  var rowCount = Math.max(sheet.getLastRow(), 2);
  var tableRange = sheet.getRange(1, 1, rowCount, headerCount);
  var banding = tableRange.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY);
  banding
    .setHeaderRowColor(headerColor || CONFIG.BRAND_COLOR)
    .setFirstRowColor('#ffffff')
    .setSecondRowColor(altColor || '#f3f6fb');
}

/**
 * Sets all data cells to plain text format.
 */
function setup_setPlainTextFormat(sheet, headerCount) {
  if (sheet.getMaxRows() > 1) {
    sheet.getRange(2, 1, Math.max(sheet.getMaxRows() - 1, 1), headerCount).setNumberFormat('@');
  }
}
