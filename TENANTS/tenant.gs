// AQL - Tenant Wrapper Script Template
//
// Instructions:
// 1. Create a container-bound Apps Script project in the Tenant Spreadsheet.
// 2. In the Apps Script Editor, click the "+" next to "Libraries".
// 3. Paste the Master Apps Script ID and add it with the title: AqlCore
// 4. Replace the entire content of your tenant's Code.gs with this file.
// 5. Deploy as a Web App:
//    - Execute As: Me (your admin email)
//    - Who has access: Anyone

const CORE_LIB = AqlCore;

// ============================================================
// 1. Web App API Endpoints
// ============================================================

function doPost(e) { return CORE_LIB.doPost(e); }
function doGet(e) { return CORE_LIB.doGet(e); }

// ============================================================
// 2. Spreadsheet Triggers
// ============================================================

function onOpen(e) { CORE_LIB.onOpen(e); }

// ============================================================
// 3. Toolbar Menu Actions Forwarders
// ============================================================

// --- Users Submenu ---
function showCreateUserDialog() { CORE_LIB.showCreateUserDialog(); }
function showUpdateUserDialog() { CORE_LIB.showUpdateUserDialog(); }
function showToggleUserStatusDialog() { CORE_LIB.showToggleUserStatusDialog(); }

// --- Designations Submenu ---
function showCreateDesignationDialog() { CORE_LIB.showCreateDesignationDialog(); }
function showUpdateDesignationDialog() { CORE_LIB.showUpdateDesignationDialog(); }

// --- Access Regions Submenu ---
function showCreateAccessRegionDialog() { CORE_LIB.showCreateAccessRegionDialog(); }
function showUpdateAccessRegionDialog() { CORE_LIB.showUpdateAccessRegionDialog(); }

// --- Roles Submenu ---
function showCreateRoleDialog() { CORE_LIB.showCreateRoleDialog(); }
function showUpdateRoleDialog() { CORE_LIB.showUpdateRoleDialog(); }
function setupDefaultRoles() { CORE_LIB.setupDefaultRoles(); }

// --- Resources Submenu ---
function showAddResourceDialog() { CORE_LIB.showAddResourceDialog(); }
function showEditResourceDialog() { CORE_LIB.showEditResourceDialog(); }
function app_showReportManagerDialog() { CORE_LIB.app_showReportManagerDialog(); }
function app_showActionManagerDialog() { CORE_LIB.app_showActionManagerDialog(); }
function app_showListViewsManagerDialog() { CORE_LIB.app_showListViewsManagerDialog(); }
function syncAppResourcesFromCode() { CORE_LIB.syncAppResourcesFromCode(); }
function regenerateAppCacheAndNotify() { CORE_LIB.regenerateAppCacheAndNotify(); }

// --- Setup & Refactor Submenu ---
function setupAppSheets() { CORE_LIB.setupAppSheets(); }
function setAppFileId() { CORE_LIB.setAppFileId(); }
function setupMasterSheets() { CORE_LIB.setupMasterSheets(); }
function setupOperationSheets() { CORE_LIB.setupOperationSheets(); }
function setupAccountSheets() { CORE_LIB.setupAccountSheets(); }
function generateSpreadsheetForNewTenant() {
  // No-op: Tenant sheets do not support tenant generation.
}


// ============================================================
// 4. HTML Dialog Callbacks (google.script.run targets)
// ============================================================

// --- Admin Dialog Forms ---
function handleCreateUser(form) { return CORE_LIB.handleCreateUser(form); }
function handleUpdateUser(form) { return CORE_LIB.handleUpdateUser(form); }
function handleToggleUserStatus(form) { return CORE_LIB.handleToggleUserStatus(form); }
function handleCreateDesignation(form) { return CORE_LIB.handleCreateDesignation(form); }
function handleUpdateDesignation(form) { return CORE_LIB.handleUpdateDesignation(form); }
function handleCreateAccessRegion(form) { return CORE_LIB.handleCreateAccessRegion(form); }
function handleUpdateAccessRegion(form) { return CORE_LIB.handleUpdateAccessRegion(form); }

// --- Detail Loaders for Admin Forms ---
function getUserDetails(userId) { return CORE_LIB.getUserDetails(userId); }
function getDesignationDetails(designationId) { return CORE_LIB.getDesignationDetails(designationId); }
function getAccessRegionDetails(code) { return CORE_LIB.getAccessRegionDetails(code); }
function getRoleDetails(roleId) { return CORE_LIB.getRoleDetails(roleId); }
function getResourceDetails(resourceName) { return CORE_LIB.getResourceDetails(resourceName); }

// --- Roles & Actions Mapping ---
function handleCreateRole(form) { return CORE_LIB.handleCreateRole(form); }
function handleUpdateRole(form) { return CORE_LIB.handleUpdateRole(form); }
function handleAddResource(form) { return CORE_LIB.handleAddResource(form); }
function handleEditResource(form) { return CORE_LIB.handleEditResource(form); }

// --- Action Manager Dialog ---
function app_getActionManagerData() { return CORE_LIB.app_getActionManagerData(); }
function app_saveResourceActions(resourceName, json) { return CORE_LIB.app_saveResourceActions(resourceName, json); }

// --- List Views Manager Dialog ---
function app_getListViewsManagerData() { return CORE_LIB.app_getListViewsManagerData(); }
function app_saveResourceListViews(resourceName, json, listViewsMode) {
  return CORE_LIB.app_saveResourceListViews(resourceName, json, listViewsMode);
}

// --- Report Manager Dialog ---
function app_getReportManagerData() { return CORE_LIB.app_getReportManagerData(); }
function app_saveResourceReports(resourceName, json) { return CORE_LIB.app_saveResourceReports(resourceName, json); }
