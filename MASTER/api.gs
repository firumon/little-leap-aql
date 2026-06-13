/**
 * ============================================================
 * AQL - Master Tenant Router API
 * ============================================================
 * Handles public tenant-to-url lookup.
 */

function doPost(e) {
  var response = { success: false, url: '', message: '' };
  
  try {
    // 1. Parse JSON payload
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput('ERROR: Empty request body')
        .setMimeType(ContentService.MimeType.TEXT);
    }

    var postData = JSON.parse(e.postData.contents);
    var action = postData.action;
    var tenantCode = (postData.tenantCode || '').toString().trim();
    
    if (action !== 'getTenantUrl') {
      return ContentService.createTextOutput('ERROR: Invalid action')
        .setMimeType(ContentService.MimeType.TEXT);
    }
    
    if (!tenantCode) {
      return ContentService.createTextOutput('ERROR: Tenant code is required')
        .setMimeType(ContentService.MimeType.TEXT);
    }
    
    // 2. Open active container spreadsheet
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var urlSheet = ss.getSheetByName('URL');
    if (!urlSheet) {
      return ContentService.createTextOutput('ERROR: URL configuration sheet not found')
        .setMimeType(ContentService.MimeType.TEXT);
    }
    
    // 3. Read data range
    var data = urlSheet.getDataRange().getValues();
    // Headers: Code, URL, Details
    var url = '';
    for (var i = 1; i < data.length; i++) {
      var rowCode = (data[i][0] || '').toString().trim();
      if (rowCode.toLowerCase() === tenantCode.toLowerCase()) {
        url = (data[i][1] || '').toString().trim();
        break;
      }
    }
    
    if (url) {
      return ContentService.createTextOutput(url)
        .setMimeType(ContentService.MimeType.TEXT);
    } else {
      return ContentService.createTextOutput('ERROR: Tenant not found')
        .setMimeType(ContentService.MimeType.TEXT);
    }
    
  } catch (err) {
    return ContentService.createTextOutput('ERROR: ' + err.message)
      .setMimeType(ContentService.MimeType.TEXT);
  }
}
