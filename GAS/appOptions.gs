/**
 * ============================================================
 * AQL - AppOptions Reader
 * ============================================================
 * Reads the AppOptions sheet from the APP spreadsheet and returns
 * a map of { optionGroupKey: [value1, value2, ...] }.
 *
 * Sheet layout (no header row):
 *   Column A = option group key (e.g. "StockMovementReferenceType")
 *   Column B onwards = selectable values (e.g. "GRN", "DirectEntry", ...)
 *
 * Used by handleLogin() to bundle appOptions into the login payload.
 * Users must re-login to pick up changes made in the sheet.
 */
function getAppOptions() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEETS.APP_OPTIONS);
  if (!sheet) return {};
  var lastRow = sheet.getLastRow();
  if (lastRow < 1) return {};
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) return {};
  var data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var result = {};
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var key = (row[0] || '').toString().trim();
    if (!key) continue;
    var values = [];
    for (var j = 1; j < row.length; j++) {
      var val = (row[j] || '').toString().trim();
      if (val) values.push(val);
    }
    if (values.length > 0) result[key] = values;
  }
  return result;
}
