function doPost(e) {
  var params = {};
  if (e && e.parameter) {
    for (var k in e.parameter) {
      params[k] = e.parameter[k];
    }
  }
  if (e && e.postData && e.postData.contents) {
    try {
      var json = JSON.parse(e.postData.contents);
      for (var jk in json) {
        params[jk] = json[jk];
      }
    } catch (_) {}
  }
  return getTenantDetails(params);
}

function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  return getTenantDetails(params);
}

function getTenantDetails(params) {
  var tenantCode = (params.tenantCode || params.tenant || params.t || params.code || '').toString().trim();
  if (!tenantCode) {
    return jsonResponse({ success: false, error: 'Tenant code is required' });
  }

  var tenant = findTenant(tenantCode);
  if (!tenant) {
    return jsonResponse({ success: false, error: 'Tenant not found' });
  }

  if (!tenant.url) {
    return jsonResponse({ success: false, error: 'Tenant deployment URL not configured' });
  }

  return jsonResponse({
    success: true,
    code: tenant.code,
    name: tenant.name,
    url: tenant.url
  });
}

function findTenant(tenantCode) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Tenants') || ss.getSheetByName('URL');
  if (!sheet) return null;

  var data = sheet.getDataRange().getValues();
  if (!data || data.length <= 1) return null;

  var headers = data[0].map(function(h) { return (h || '').toString().trim().toLowerCase(); });
  var idxCode = headers.indexOf('code');
  var idxName = headers.indexOf('name');
  var idxDeploy = headers.indexOf('deployment id');
  if (idxDeploy === -1) idxDeploy = headers.indexOf('deploymentid');
  var idxUrl = headers.indexOf('url');

  var target = tenantCode.toLowerCase();

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var code = (idxCode !== -1 ? row[idxCode] : row[0] || '').toString().trim();
    if (!code || code.toLowerCase() !== target) continue;

    var name = (idxName !== -1 ? row[idxName] : '').toString().trim() || code;
    var deploymentId = (idxDeploy !== -1 ? row[idxDeploy] : '').toString().trim();
    var rawUrl = (idxUrl !== -1 ? row[idxUrl] : '').toString().trim();

    var url = '';
    if (deploymentId) {
      url = 'https://script.google.com/macros/s/' + deploymentId + '/exec';
    } else if (rawUrl && rawUrl.indexOf('http') === 0) {
      url = rawUrl;
    }

    return {
      code: code,
      name: name,
      url: url
    };
  }

  return null;
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
