/**
 * ============================================================
 * AQL - Master Tenant Router API
 * ============================================================
 * Handles public tenant-to-url lookup and tenant project listing.
 * Reads the unified "Tenants" sheet:
 * Headers: Code, Name, Detail, Project ID, Deployment ID
 */

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
    } catch (err) {
      // Ignore JSON parse error if params were supplied in query string
    }
  }
  return handleMasterRequest(params);
}

function handleMasterRequest(params) {
  var action = (params.action || '').toString().trim();
  var tenantCode = (params.tenantCode || params.tenant || params.t || params.code || '').toString().trim();
  
  // If tenantCode is provided or action is getTenantUrl
  if (action === 'getTenantUrl' || (!action && tenantCode)) {
    if (!tenantCode) {
      return textResponse('ERROR: Tenant code is required');
    }
    
    var tenant = findTenantRecord(tenantCode);
    if (!tenant) {
      return textResponse('ERROR: Tenant not found');
    }
    
    var url = buildTenantWebAppUrl(tenant);
    if (!url) {
      return textResponse('ERROR: Tenant deployment URL not configured');
    }
    
    return textResponse(url);
  }
  
  if (action === 'getTenants' || action === 'getTenantProjects' || action === 'list') {
    var allTenants = getAllTenantRecords();
    return jsonResponse({
      success: true,
      tenants: allTenants
    });
  }
  
  // Default fallback: return active tenants list
  var list = getAllTenantRecords();
  return jsonResponse({
    success: true,
    message: 'AQL Master Tenant Router Active',
    tenants: list
  });
}

function getTenantsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Tenants');
  if (!sheet) {
    // Fallback to legacy URL sheet if Tenants tab does not exist yet
    sheet = ss.getSheetByName('URL');
  }
  return sheet;
}

function getAllTenantRecords() {
  var sheet = getTenantsSheet();
  if (!sheet) return [];
  
  var data = sheet.getDataRange().getValues();
  if (!data || data.length <= 1) return [];
  
  var headers = data[0].map(function(h) { return (h || '').toString().trim().toLowerCase(); });
  var idxCode = headers.indexOf('code');
  var idxName = headers.indexOf('name');
  var idxDetail = headers.indexOf('detail');
  if (idxDetail === -1) idxDetail = headers.indexOf('details');
  var idxProject = headers.indexOf('project id');
  if (idxProject === -1) idxProject = headers.indexOf('projectid');
  if (idxProject === -1) idxProject = headers.indexOf('script id');
  if (idxProject === -1) idxProject = headers.indexOf('scriptid');
  var idxDeploy = headers.indexOf('deployment id');
  if (idxDeploy === -1) idxDeploy = headers.indexOf('deploymentid');
  var idxUrl = headers.indexOf('url');
  
  var list = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var code = (idxCode !== -1 ? row[idxCode] : row[0] || '').toString().trim();
    if (!code) continue;
    
    var name = (idxName !== -1 ? row[idxName] : '').toString().trim();
    var detail = (idxDetail !== -1 ? row[idxDetail] : '').toString().trim();
    var projectId = (idxProject !== -1 ? row[idxProject] : '').toString().trim();
    var deploymentId = (idxDeploy !== -1 ? row[idxDeploy] : '').toString().trim();
    var rawUrl = (idxUrl !== -1 ? row[idxUrl] : '').toString().trim();
    
    var url = '';
    if (deploymentId) {
      url = 'https://script.google.com/macros/s/' + deploymentId + '/exec';
    } else if (rawUrl && rawUrl.indexOf('http') === 0) {
      url = rawUrl;
    }
    
    list.push({
      code: code,
      name: name || code,
      detail: detail,
      projectId: projectId,
      deploymentId: deploymentId,
      url: url
    });
  }
  return list;
}

function findTenantRecord(tenantCode) {
  var list = getAllTenantRecords();
  var target = tenantCode.toLowerCase();
  for (var i = 0; i < list.length; i++) {
    if (list[i].code.toLowerCase() === target) {
      return list[i];
    }
  }
  return null;
}

function buildTenantWebAppUrl(tenant) {
  if (tenant.deploymentId) {
    return 'https://script.google.com/macros/s/' + tenant.deploymentId + '/exec';
  }
  if (tenant.url) {
    return tenant.url;
  }
  return '';
}

function textResponse(text) {
  return ContentService.createTextOutput(text)
    .setMimeType(ContentService.MimeType.TEXT);
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
