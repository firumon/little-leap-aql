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

// ============================================================
// 2. Spreadsheet Triggers
// ============================================================

function onOpen(e) { CORE_LIB.onOpen(e); }

// ============================================================
// 3. Toolbar Menu Actions Forwarders
// ============================================================

// --- Consolidated Manage Menu Items ---
function showManageUsersDialog() { CORE_LIB.showManageUsersDialog(); }
function showManageDesignationsDialog() { CORE_LIB.showManageDesignationsDialog(); }
function showManageAccessRegionsDialog() { CORE_LIB.showManageAccessRegionsDialog(); }

// --- Roles Submenu ---
function showManageRoleDialog() { CORE_LIB.showManageRoleDialog(); }
function setupDefaultRoles() { CORE_LIB.setupDefaultRoles(); }

// --- Resources Submenu ---
function showAddResourceDialog() { CORE_LIB.showAddResourceDialog(); }
function showEditResourceDialog() { CORE_LIB.showEditResourceDialog(); }
function app_showReportManagerDialog() { CORE_LIB.app_showReportManagerDialog(); }
function app_showActionManagerDialog() { CORE_LIB.app_showActionManagerDialog(); }
function app_showListViewsManagerDialog() { CORE_LIB.app_showListViewsManagerDialog(); }
function app_showRelationsManagerDialog() { CORE_LIB.app_showRelationsManagerDialog(); }
function syncAppResourcesFromCode() { CORE_LIB.syncAppResourcesFromCode(); }
function recalculateAllResourcesLastDataUpdatedAtAndNotify() { CORE_LIB.recalculateAllResourcesLastDataUpdatedAtAndNotify(); }
function regenerateAppCacheAndNotify() { CORE_LIB.regenerateAppCacheAndNotify(); }

// --- Diagnostics (run from the Apps Script editor, never as a cell formula) ---
function diagCacheHealth() { return CORE_LIB.diagCacheHealth(); }

// --- Setup & Refactor Submenu ---
function setupAppSheets() { CORE_LIB.setupAppSheets(); }
function setAppFileId() { CORE_LIB.setAppFileId(); }
function setupMasterSheets() { CORE_LIB.setupMasterSheets(); }
function setupOperationSheets() { CORE_LIB.setupOperationSheets(); }
function setupAccountSheets() { CORE_LIB.setupAccountSheets(); }
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
function handleManageUser(form) { return CORE_LIB.handleManageUser(form); }
function handleManageDesignation(form) { return CORE_LIB.handleManageDesignation(form); }
function handleManageAccessRegion(form) { return CORE_LIB.handleManageAccessRegion(form); }

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

// --- Relations Manager Dialog ---
function app_getRelationsManagerData() { return CORE_LIB.app_getRelationsManagerData(); }
function app_saveResourceRelations(resourceName, json) { return CORE_LIB.app_saveResourceRelations(resourceName, json); }

// --- Roles Setup Progress Dialog ---
function app_getRolesSetupSteps() { return CORE_LIB.app_getRolesSetupSteps(); }
function app_executeRolesSetupStep(stepId) { return CORE_LIB.app_executeRolesSetupStep(stepId); }
