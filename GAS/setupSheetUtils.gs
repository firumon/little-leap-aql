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
 * Builds a read-only plan comparing sheet headers against targetHeaders.
 * Does not write anything to the sheet.
 */
function setup_buildSchemaPlan(sheet, targetHeaders) {
  var sheetName = sheet.getName();
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastCol === 0 || lastRow === 0) {
    return {
      sheetName: sheetName,
      isNewSheet: false,
      isEmpty: true,
      hasChanges: true,
      currentHeaders: [],
      targetHeaders: targetHeaders,
      unchanged: [],
      added: targetHeaders.slice(),
      removed: [],
      moved: [],
      renameSuspects: [],
      hasQuestions: false,
      summary: 'Empty sheet: will add all ' + targetHeaders.length + ' columns'
    };
  }

  var rawHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0] || [];
  var lastNonEmpty = -1;
  for (var i = rawHeaders.length - 1; i >= 0; i--) {
    if (rawHeaders[i] !== '' && rawHeaders[i] !== null && rawHeaders[i] !== undefined) {
      lastNonEmpty = i;
      break;
    }
  }

  if (lastNonEmpty === -1) {
    return {
      sheetName: sheetName,
      isNewSheet: false,
      isEmpty: true,
      hasChanges: true,
      currentHeaders: [],
      targetHeaders: targetHeaders,
      unchanged: [],
      added: targetHeaders.slice(),
      removed: [],
      moved: [],
      renameSuspects: [],
      hasQuestions: false,
      summary: 'Empty sheet: will add all ' + targetHeaders.length + ' columns'
    };
  }

  var currentHeaders = rawHeaders.slice(0, lastNonEmpty + 1).map(function(h) {
    return (h === null || h === undefined) ? '' : String(h).trim();
  });

  var exactMatch = (currentHeaders.length === targetHeaders.length);
  if (exactMatch) {
    for (var j = 0; j < targetHeaders.length; j++) {
      if (currentHeaders[j] !== targetHeaders[j]) {
        exactMatch = false;
        break;
      }
    }
  }

  if (exactMatch) {
    return {
      sheetName: sheetName,
      isNewSheet: false,
      isEmpty: false,
      hasChanges: false,
      currentHeaders: currentHeaders,
      targetHeaders: targetHeaders,
      unchanged: targetHeaders.slice(),
      added: [],
      removed: [],
      moved: [],
      renameSuspects: [],
      hasQuestions: false,
      summary: 'Up to date'
    };
  }

  var SETUP_PROTECTED_AUDIT_COLUMNS = ['CreatedAt', 'UpdatedAt', 'Revision', 'CreatedBy', 'UpdatedBy'];

  var added = [];
  targetHeaders.forEach(function(h) {
    if (currentHeaders.indexOf(h) === -1) {
      added.push(h);
    }
  });

  var removed = [];
  currentHeaders.forEach(function(h) {
    if (h && targetHeaders.indexOf(h) === -1) {
      if (SETUP_PROTECTED_AUDIT_COLUMNS.indexOf(h) === -1) {
        removed.push(h);
      }
    }
  });

  var unchanged = [];
  var moved = [];
  targetHeaders.forEach(function(h, targetIdx) {
    var curIdx = currentHeaders.indexOf(h);
    if (curIdx !== -1) {
      if (curIdx === targetIdx) {
        unchanged.push(h);
      } else {
        moved.push(h);
      }
    }
  });

  // A suspect: exactly one column removed, exactly one added, matching positions
  var renameSuspects = [];
  if (removed.length === 1 && added.length === 1) {
    var oldPos = currentHeaders.indexOf(removed[0]);
    var newPos = targetHeaders.indexOf(added[0]);
    if (oldPos === newPos) {
      renameSuspects.push({
        oldName: removed[0],
        newName: added[0],
        position: oldPos
      });
    }
  }

  var hasChanges = (added.length > 0 || removed.length > 0 || moved.length > 0);
  var hasQuestions = (removed.length > 0 && added.length > 0);

  var summaryParts = [];
  if (added.length > 0) summaryParts.push(added.length + ' added');
  if (removed.length > 0) summaryParts.push(removed.length + ' removed');
  if (moved.length > 0) summaryParts.push(moved.length + ' moved');
  var summary = summaryParts.length > 0 ? summaryParts.join(', ') : 'No changes';

  return {
    sheetName: sheetName,
    isNewSheet: false,
    isEmpty: false,
    hasChanges: hasChanges,
    currentHeaders: currentHeaders,
    targetHeaders: targetHeaders,
    unchanged: unchanged,
    added: added,
    removed: removed,
    moved: moved,
    renameSuspects: renameSuspects,
    hasQuestions: hasQuestions,
    summary: summary
  };
}

/**
 * Normalizes sheet columns in-place to match targetHeaders without clearing sheet data.
 * @param {Sheet} sheet
 * @param {Array<string>} targetHeaders
 * @param {Object} [decisions] - Optional mapping of removed columns to added columns.
 */
function setup_normalizeSheetSchema(sheet, targetHeaders, decisions) {
  var plan = setup_buildSchemaPlan(sheet, targetHeaders);

  // 7. Empty sheet just gets headers written
  if (plan.isEmpty) {
    sheet.getRange(1, 1, 1, targetHeaders.length).setValues([targetHeaders]);
    var totalCols = sheet.getMaxColumns();
    if (totalCols > targetHeaders.length) {
      sheet.deleteColumns(targetHeaders.length + 1, totalCols - targetHeaders.length);
    }
    return { changed: true, summary: 'initialized empty sheet' };
  }

  // 2. Nothing to do -> return immediately (zero writes)
  if (!plan.hasChanges) {
    return { changed: false, summary: 'no change' };
  }

  var renames = (decisions && (decisions.renames || decisions.confirmedRenames)) || decisions || {};

  if (plan.renameSuspects && plan.renameSuspects.length > 0) {
    plan.renameSuspects.forEach(function(suspect) {
      if (!renames[suspect.oldName]) {
        if (typeof logToSheet_ === 'function') {
          logToSheet_('Suspected rename ' + suspect.oldName + ' -> ' + suspect.newName + ' in ' + sheet.getName() + ' not confirmed; treating as remove + add');
        }
      }
    });
  }

  // 3. Apply confirmed renames
  var curHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] || [];
  Object.keys(renames).forEach(function(oldCol) {
    var newCol = renames[oldCol];
    if (newCol && plan.removed.indexOf(oldCol) !== -1 && plan.added.indexOf(newCol) !== -1) {
      var colIdx = curHeaders.indexOf(oldCol);
      if (colIdx !== -1) {
        sheet.getRange(1, colIdx + 1).setValue(newCol);
        curHeaders[colIdx] = newCol;
        if (typeof logToSheet_ === 'function') {
          logToSheet_('Renamed column in ' + sheet.getName() + ': ' + oldCol + ' -> ' + newCol);
        }
      }
    }
  });

  // 4. Insert added columns at target positions
  curHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] || [];
  targetHeaders.forEach(function(targetCol, targetIdx) {
    if (curHeaders.indexOf(targetCol) === -1) {
      var targetPos = targetIdx + 1;
      if (targetPos <= sheet.getLastColumn()) {
        sheet.insertColumnBefore(targetPos);
      } else {
        var maxCols = sheet.getMaxColumns();
        if (targetPos > maxCols) {
          sheet.insertColumnsAfter(maxCols, targetPos - maxCols);
        }
      }
      sheet.getRange(1, targetPos).setValue(targetCol);
      curHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] || [];
      if (typeof logToSheet_ === 'function') {
        logToSheet_('Inserted column ' + targetCol + ' in ' + sheet.getName() + ' at position ' + targetPos);
      }
    }
  });

  // 5. Move out-of-place columns one at a time and re-read after each move
  for (var i = 0; i < targetHeaders.length; i++) {
    var colName = targetHeaders[i];
    var desiredPos = i + 1;
    curHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] || [];
    var currentPos = curHeaders.indexOf(colName) + 1;
    if (currentPos > 0 && currentPos !== desiredPos) {
      sheet.moveColumns(sheet.getRange(1, currentPos, sheet.getMaxRows(), 1), desiredPos);
      if (typeof logToSheet_ === 'function') {
        logToSheet_('Moved column ' + colName + ' in ' + sheet.getName() + ' from ' + currentPos + ' to ' + desiredPos);
      }
    }
  }

  // 6. Delete removed columns from right to left after logging contents
  var PROTECTED_AUDIT_COLUMNS = ['CreatedAt', 'UpdatedAt', 'Revision', 'CreatedBy', 'UpdatedBy'];
  curHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] || [];
  var colsToDelete = [];
  for (var c = 0; c < curHeaders.length; c++) {
    var hName = curHeaders[c];
    if (targetHeaders.indexOf(hName) === -1) {
      if (PROTECTED_AUDIT_COLUMNS.indexOf(hName) !== -1) {
        if (typeof logToSheet_ === 'function') {
          logToSheet_('WARNING: Protected audit column ' + hName + ' in sheet ' + sheet.getName() + ' will not be deleted');
        }
      } else {
        colsToDelete.push({ index: c + 1, name: hName });
      }
    }
  }
  colsToDelete.sort(function(a, b) { return b.index - a.index; });

  colsToDelete.forEach(function(item) {
    var lastRow = sheet.getLastRow();
    var colData = [];
    if (lastRow >= 2) {
      colData = sheet.getRange(2, item.index, lastRow - 1, 1).getValues().map(function(r) { return r[0]; });
    }

    var recorded = setup_recordDeletedColumn_(sheet.getName(), item.name, colData);
    if (!recorded) {
      if (typeof logToSheet_ === 'function') {
        logToSheet_('SKIPPED deleting column ' + item.name + ' in sheet ' + sheet.getName() + ': could not record contents safely');
      }
      return;
    }

    sheet.deleteColumn(item.index);
  });

  var lastColFinal = sheet.getLastColumn();
  var maxColsFinal = sheet.getMaxColumns();
  if (maxColsFinal > lastColFinal) {
    sheet.deleteColumns(lastColFinal + 1, maxColsFinal - lastColFinal);
  }

  return { changed: true, summary: plan.summary };
}

/**
 * Safely records deleted column contents to _LOGS_ before deletion.
 * Caps dump string to prevent hitting cell limits and confirms write succeeded.
 * Returns true if record was confirmed written, false otherwise.
 */
function setup_recordDeletedColumn_(sheetName, colName, colData) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) return false;

    var lSheet = (typeof logSheet !== 'undefined' && logSheet) ? logSheet : ss.getSheetByName('_LOGS_');
    if (!lSheet) {
      lSheet = ss.insertSheet('_LOGS_');
      var mc = lSheet.getMaxColumns();
      if (mc > 2) lSheet.deleteColumns(3, mc - 2);
      lSheet.getRange(1, 1, 1, 2).setValues([['Timestamp', 'Message']]);
      lSheet.getRange(1, 1, 1, 2).setFontWeight('bold');
      lSheet.setColumnWidth(1, 100);
      lSheet.setColumnWidth(2, 600);
    }

    var totalRows = colData ? colData.length : 0;
    var rawJson = JSON.stringify(colData || []);
    var maxChars = 30000;
    var dumpStr = rawJson.length > maxChars
      ? rawJson.substring(0, maxChars) + '... [TRUNCATED; ' + totalRows + ' total rows]'
      : rawJson;

    var now = new Date();
    var time = ('0' + now.getHours()).slice(-2) + ':' +
                ('0' + now.getMinutes()).slice(-2) + ':' +
                ('0' + now.getSeconds()).slice(-2);
    var msg = 'Deleting removed column ' + colName + ' in sheet ' + sheetName + ' (total rows: ' + totalRows + '); contents: ' + dumpStr;

    lSheet.appendRow([time, msg]);
    SpreadsheetApp.flush();
    return true;
  } catch (err) {
    return false;
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
 * Fills blank cells in specified columns with default values in bulk.
 */
function setup_applyColumnDefaults(sheet, headers, defaults) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  var numRows = lastRow - 1;

  Object.keys(defaults).forEach(function(key) {
    var colIdx = headers.indexOf(key);
    if (colIdx === -1) return;

    var range = sheet.getRange(2, colIdx + 1, numRows, 1);
    var values = range.getValues();
    var hasBlank = false;

    for (var r = 0; r < numRows; r++) {
      var val = values[r][0];
      if (val === '' || val === null || val === undefined) {
        values[r][0] = defaults[key];
        hasBlank = true;
      }
    }

    if (hasBlank) {
      range.setValues(values);
    }
  });
}

/**
 * Fills blank values in a named column with a default in bulk.
 */
function setup_fillBlankColumn(sheet, headers, columnName, defaultValue) {
  var colIdx = headers.indexOf(columnName);
  if (colIdx === -1) return;

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  var numRows = lastRow - 1;

  var range = sheet.getRange(2, colIdx + 1, numRows, 1);
  var values = range.getValues();
  var hasBlank = false;

  for (var r = 0; r < numRows; r++) {
    var val = (values[r][0] === null || values[r][0] === undefined) ? '' : String(values[r][0]).trim();
    if (!val) {
      values[r][0] = defaultValue;
      hasBlank = true;
    }
  }

  if (hasBlank) {
    range.setValues(values);
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

/**
 * Computes 1-based target position of a resource tab within its spreadsheet file
 * based on its position in the full schema list for that file.
 */
function setup_getSchemaTargetPosition(allSchemas, resourceName, fileId) {
  var fileSchemas = (allSchemas || []).filter(function(s) {
    try {
      var cfg = getResourceConfig(s.resourceName);
      return cfg && cfg.fileId === fileId;
    } catch(e) {
      return false;
    }
  });

  for (var i = 0; i < fileSchemas.length; i++) {
    if (fileSchemas[i].resourceName === resourceName) {
      return i + 1;
    }
  }
  return 1;
}

/**
 * Refactors a single resource sheet.
 * Unified engine used by both the server-side loops and the dialog runner.
 */
function setup_refactorResourceSheet(schema, options) {
  options = options || {};
  var decisions = options.decisions || {};
  var headerColor = options.headerColor || CONFIG.BRAND_COLOR;
  var altColor = options.altColor || '#f3f6fb';
  var targetPos = options.targetPos;

  var resource = getResourceConfig(schema.resourceName);
  if (typeof logToSheet_ === 'function') {
    logToSheet_('Processing ' + schema.resourceName);
  }

  if (resource.codeSequenceLength > 0 && !resource.codePrefix) {
    throw new Error('CodePrefix is missing in Resources for ' + schema.resourceName);
  }
  if (!resource.fileId) throw new Error('FileId is missing or empty for ' + schema.resourceName);

  if (!targetPos && options.allSchemas && resource.fileId) {
    targetPos = setup_getSchemaTargetPosition(options.allSchemas, schema.resourceName, resource.fileId);
  }

  var file = openSpreadsheetById(resource.fileId);
  var sheet = file.getSheetByName(resource.sheetName);
  var isNewSheet = false;

  if (!sheet) {
    sheet = file.insertSheet(resource.sheetName);
    isNewSheet = true;
  }

  var sheetDecisions = decisions[schema.resourceName] || decisions || {};
  var normResult = setup_normalizeSheetSchema(sheet, schema.headers, sheetDecisions);
  var schemaChanged = isNewSheet || (normResult && normResult.changed);

  if (schemaChanged) {
    setup_applyHeaderFormatting(sheet, schema.headers, schema.columnWidths, headerColor);
    if (isNewSheet) {
      setup_trimToHeaderOnly(sheet);
    }
    setup_protectHeaderRow(sheet, schema.headers.length);
    setup_applyBanding(sheet, schema.headers.length, headerColor, altColor);
    setup_setPlainTextFormat(sheet, schema.headers.length);
  }

  setup_applyColumnDefaults(sheet, schema.headers, schema.defaults || {});
  if (schema.headers.indexOf('Status') !== -1) {
    setup_fillBlankColumn(sheet, schema.headers, 'Status', schema.statusDefault || 'Active');
  }

  if (targetPos && targetPos > 0) {
    var maxPos = file.getNumSheets();
    var destPos = Math.min(targetPos, maxPos);
    if (sheet.getIndex() !== destPos) {
      file.setActiveSheet(sheet);
      file.moveActiveSheet(destPos);
    }
  }

  var changeDesc = 'no change';
  if (isNewSheet) {
    changeDesc = 'created sheet';
  } else if (normResult && normResult.summary) {
    changeDesc = normResult.summary;
  }

  return {
    success: true,
    resourceName: schema.resourceName,
    sheetName: resource.sheetName,
    isNewSheet: isNewSheet,
    changed: schemaChanged,
    message: changeDesc
  };
}
