/**
 * ============================================================
 * AQL - Report Generator
 * ============================================================
 * Generates PDF reports from REPORTS spreadsheet templates.
 * Duplicates a template sheet, injects cell data, flushes
 * formulas, exports to PDF, cleans up, and returns Base64.
 */

/**
 * Main entry point for report generation.
 * Called from apiDispatcher.gs via action 'generateReport'.
 *
 * @param {Object} auth - Authenticated user context from validateToken.
 * @param {Object} data - Request payload containing:
 *   - {string} resource      - Resource name (e.g. 'Products')
 *   - {string} reportName    - Report identifier matching Reports config
 *   - {string} templateSheet - Sheet name in REPORTS file to clone
 *   - {Array}  cellData      - Array of { cell: 'A1', value: 'Test' }
 * @returns {Object} { success, base64, fileName, message }
 */
function generateReportPdf(auth, data) {
  var resource = (data.resource || '').toString().trim();
  var reportName = (data.reportName || '').toString().trim();
  var templateSheetName = (data.templateSheet || '').toString().trim();
  var cellData = data.cellData;

  if (!templateSheetName) {
    return { success: false, message: 'templateSheet is required' };
  }
  if (!Array.isArray(cellData)) {
    return { success: false, message: 'cellData must be an array' };
  }

  // Locate the REPORTS spreadsheet via Resources registry or fallback
  var reportsFileId = _resolveReportsFileId();
  if (!reportsFileId) {
    return { success: false, message: 'REPORTS file not configured. Add a resource with Scope=report or configure CONFIG.REPORTS_FILE_ID.' };
  }

  var reportsFile;
  try {
    reportsFile = SpreadsheetApp.openById(reportsFileId);
  } catch (err) {
    return { success: false, message: 'Cannot open REPORTS file: ' + err.toString() };
  }

  var templateSheet = reportsFile.getSheetByName(templateSheetName);
  if (!templateSheet) {
    return { success: false, message: 'Template sheet not found: ' + templateSheetName };
  }

  // Create temporary sheet by duplicating the template
  var tempName = '_TEMP_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
  var tempSheet;

  try {
    tempSheet = templateSheet.copyTo(reportsFile);
    tempSheet.setName(tempName);

    // Inject cell data
    for (var i = 0; i < cellData.length; i++) {
      var entry = cellData[i];
      var cell = (entry.cell || '').toString().trim();
      var value = entry.value !== undefined ? entry.value : '';
      if (!cell) continue;

      try {
        tempSheet.getRange(cell).setValue(value);
      } catch (rangeErr) {
        // Skip invalid cell references silently
      }
    }

    // Flush to recalculate formulas
    SpreadsheetApp.flush();

    // Export the temporary sheet to PDF
    var pdfBlob = _exportSheetAsPdf(reportsFile, tempSheet);
    var base64 = Utilities.base64Encode(pdfBlob.getBytes());

    // Generate a meaningful file name
    var fileName = (reportName || templateSheetName).replace(/[^a-zA-Z0-9_\-\s]/g, '') + '.pdf';

    return {
      success: true,
      base64: base64,
      fileName: fileName,
      message: 'Report generated successfully'
    };

  } catch (err) {
    return { success: false, message: 'Report generation failed: ' + err.toString() };

  } finally {
    // Always clean up the temporary sheet
    _deleteTemporarySheet(reportsFile, tempName);
  }
}

/**
 * Exports a single sheet from a spreadsheet as PDF using UrlFetchApp.
 *
 * @param {Spreadsheet} spreadsheet - The spreadsheet object.
 * @param {Sheet} sheet - The sheet to export.
 * @returns {Blob} PDF blob of the exported sheet.
 */
function _exportSheetAsPdf(spreadsheet, sheet) {
  var ssId = spreadsheet.getId();
  var sheetId = sheet.getSheetId();

  var url = 'https://docs.google.com/spreadsheets/d/' + ssId + '/export?'
    + 'exportFormat=pdf'
    + '&format=pdf'
    + '&size=A4'
    + '&portrait=true'
    + '&fitw=true'
    + '&gridlines=false'
    + '&printtitle=false'
    + '&sheetnames=false'
    + '&pagenum=UNDEFINED'
    + '&fzr=false'
    + '&gid=' + sheetId;

  var token = ScriptApp.getOAuthToken();
  var response = UrlFetchApp.fetch(url, {
    headers: { 'Authorization': 'Bearer ' + token },
    muteHttpExceptions: true
  });

  if (response.getResponseCode() !== 200) {
    throw new Error('PDF export failed with status ' + response.getResponseCode() + ': ' + response.getContentText().substring(0, 200));
  }

  return response.getBlob().setName('report.pdf');
}

/**
 * Deletes a temporary sheet by name, silently ignoring errors.
 *
 * @param {Spreadsheet} spreadsheet - The spreadsheet object.
 * @param {string} sheetName - Name of the sheet to delete.
 */
function _deleteTemporarySheet(spreadsheet, sheetName) {
  try {
    var sheet = spreadsheet.getSheetByName(sheetName);
    if (sheet) {
      spreadsheet.deleteSheet(sheet);
    }
  } catch (err) {
    // Best-effort cleanup; log silently
  }
}

/**
 * Resolves the REPORTS file ID.
 * Tries APP.Config sheet first, then searches Resources for a
 * report-scoped or REPORTS-named entry.
 *
 * @returns {string|null} File ID or null if not found.
 */
function _resolveReportsFileId() {
  return resolveFileIdForScope('report', '');
}
