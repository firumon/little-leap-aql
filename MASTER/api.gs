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
  var action = (params.action || '').toString().trim();
  if (action === 'getTenants' || action === 'list') {
    return getTenantsList();
  }

  return getTenantDetails(params);
}

function doGet() {
  return jsonResponse({ success: false, error: 'Only POST requests are allowed' });
}

function getTenantsList() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Tenants') || ss.getSheetByName('URL');
  if (!sheet) {
    return jsonResponse({ success: false, error: 'Tenants sheet not found' });
  }

  var data = sheet.getDataRange().getValues();
  if (!data || data.length <= 1) {
    return jsonResponse({ success: true, tenants: [] });
  }

  var headers = data[0].map(function(h) { return (h || '').toString().trim().toLowerCase(); });
  var idxCode = headers.indexOf('code');
  var idxProject = headers.indexOf('project id');
  if (idxProject === -1) idxProject = headers.indexOf('projectid');
  if (idxProject === -1) idxProject = headers.indexOf('script id');
  if (idxProject === -1) idxProject = headers.indexOf('scriptid');

  if (idxCode === -1 || idxProject === -1) {
    return jsonResponse({ success: false, error: 'Required columns not found' });
  }

  var tenants = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var code = (row[idxCode] || '').toString().trim();
    var projectId = (row[idxProject] || '').toString().trim();
    if (!code || !projectId) continue;

    tenants.push({
      code: code,
      projectId: projectId
    });
  }

  return jsonResponse({
    success: true,
    tenants: tenants
  });
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
