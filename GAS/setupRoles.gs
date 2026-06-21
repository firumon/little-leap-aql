/**
 * ============================================================
 * AQL - Roles Setup
 * ============================================================
 * Setup default roles to kickstart the system permission assignments.
 */

function setupDefaultRoles() {
    const html = HtmlService.createHtmlOutputFromFile('rolesProgressDialog')
        .setWidth(600)
        .setHeight(650)
        .setTitle('Inject Default Roles & Permissions');
    SpreadsheetApp.getUi().showModalDialog(html, 'Inject Default Roles & Permissions');
}

function app_getRolesSetupSteps() {
  return [
    { id: 'prepare_roles', title: 'Prepare Roles Sheet', desc: 'Checking structure and configurations' },
    { id: 'role_Admin', title: 'Admin Role', desc: 'Injecting Admin role with system authority' },
    { id: 'role_ProcurementManager', title: 'Procurement Manager Role', desc: 'Injecting ProcurementManager role' },
    { id: 'role_StoreKeeper', title: 'Store Keeper Role', desc: 'Injecting StoreKeeper role' },
    { id: 'role_Accountant', title: 'Accountant Role', desc: 'Injecting Accountant role' },
    { id: 'role_DepartmentHead', title: 'Department Head Role', desc: 'Injecting DepartmentHead role' },
    { id: 'prepare_perms', title: 'Prepare Permissions Sheet', desc: 'Checking RolePermissions structure' },
    { id: 'perms_Admin', title: 'Admin Permissions', desc: 'Assigning Admin role actions' },
    { id: 'perms_ProcurementManager', title: 'Procurement Manager Permissions', desc: 'Assigning Procurement Manager actions' },
    { id: 'perms_StoreKeeper', title: 'Store Keeper Permissions', desc: 'Assigning StoreKeeper actions' },
    { id: 'perms_Accountant', title: 'Accountant Permissions', desc: 'Assigning Accountant actions' },
    { id: 'perms_DepartmentHead', title: 'Department Head Permissions', desc: 'Assigning Department Head actions' },
    { id: 'finalize', title: 'Finalize Setup', desc: 'Invalidating authorization caches' }
  ];
}

function app_executeRolesSetupStep(stepId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  if (stepId === 'prepare_roles') {
    let rolesSheet = ss.getSheetByName(CONFIG.SHEETS.ROLES);
    if (!rolesSheet) {
      throw new Error('Roles sheet not found. Run setupAppSheets first.');
    }
    return { success: true, status: 'DONE', message: 'Roles sheet verified.' };
  }
  
  const roleDefs = {
    'Admin': 'System Administrator with full access',
    'ProcurementManager': 'Manages international procurements, POs, and RFQs',
    'StoreKeeper': 'Manages warehouse receipt, GRNs, and stocking',
    'Accountant': 'Handles ledgers, charts of accounts, and financial entries',
    'DepartmentHead': 'Initiates and approves Department Requisitions'
  };

  if (stepId.indexOf('role_') === 0) {
    const roleName = stepId.substring(5);
    const roleDesc = roleDefs[roleName];
    const rolesSheet = ss.getSheetByName(CONFIG.SHEETS.ROLES);
    const existingRoles = rolesSheet.getRange(2, 2, Math.max(rolesSheet.getLastRow() - 1, 1), 1).getValues().flat();
    
    if (existingRoles.indexOf(roleName) !== -1) {
      return { success: true, status: 'SKIPPED', message: `Role "${roleName}" already exists.` };
    }
    
    const headers = rolesSheet.getRange(1, 1, 1, rolesSheet.getLastColumn()).getValues()[0];
    const rolesIdx = {}; headers.forEach((h, i) => rolesIdx[h] = i);
    const ctx = { sheet: rolesSheet, headers: headers, idx: rolesIdx };
    const newRoleId = nextId(ctx, 'RoleID', 'R', 4);
    
    rolesSheet.appendRow([newRoleId, roleName, roleDesc]);
    return { success: true, status: 'DONE', message: `Role "${roleName}" created with ID ${newRoleId}.` };
  }
  
  if (stepId === 'prepare_perms') {
    let permissionsSheet = ss.getSheetByName(CONFIG.SHEETS.ROLE_PERMISSIONS);
    if (!permissionsSheet) {
      throw new Error('RolePermissions sheet not found.');
    }
    return { success: true, status: 'DONE', message: 'RolePermissions sheet verified.' };
  }
  
  if (stepId.indexOf('perms_') === 0) {
    const roleName = stepId.substring(6);
    const rolesSheet = ss.getSheetByName(CONFIG.SHEETS.ROLES);
    const finalRoles = rolesSheet.getRange(2, 1, Math.max(rolesSheet.getLastRow() - 1, 1), 2).getValues();
    const roleMap = {};
    finalRoles.forEach(r => { roleMap[r[1]] = r[0]; });
    
    const roleId = roleMap[roleName];
    if (!roleId) {
      throw new Error(`Role ID not found for "${roleName}". Make sure role creation step ran successfully.`);
    }
    
    const permissionsSheet = ss.getSheetByName(CONFIG.SHEETS.ROLE_PERMISSIONS);
    const existingPermsData = permissionsSheet.getRange(2, 1, Math.max(permissionsSheet.getLastRow() - 1, 1), 3).getValues();
    
    let resources = [];
    let actions = '*';
    
    if (roleName === 'Admin') {
      resources = ['*'];
    } else if (roleName === 'ProcurementManager') {
      resources = [
        'Procurements', 'PurchaseRequisitions', 'PurchaseRequisitionItems',
        'RFQs', 'RFQItems', 'RFQSuppliers', 'SupplierQuotations', 'SupplierQuotationItems',
        'PurchaseOrders', 'PurchaseOrderItems', 'POFulfillments', 'Suppliers', 'Products', 'SKUs'
      ];
    } else if (roleName === 'StoreKeeper') {
      resources = [
        'GoodsReceipts', 'GoodsReceiptItems', 'StockMovements', 'Shipments', 'ShipmentItems',
        'WarehouseStorages', 'Warehouses'
      ];
    } else if (roleName === 'Accountant') {
      resources = [
        'ChartOfAccounts', 'EntryTemplates', 'Assets', 'Liabilities', 'Equity', 'Revenue', 'Expenses'
      ];
    } else if (roleName === 'DepartmentHead') {
      resources = ['PurchaseRequisitions', 'PurchaseRequisitionItems'];
      actions = 'Create,Read,Update,Approve,Reject';
    }
    
    let addedCount = 0;
    resources.forEach(res => {
      const exists = existingPermsData.find(row => row[0] === roleId && row[1] === res);
      if (!exists) {
        permissionsSheet.appendRow([roleId, res, actions]);
        addedCount++;
      }
    });
    
    if (addedCount === 0) {
      return { success: true, status: 'SKIPPED', message: `Permissions for "${roleName}" already configured.` };
    } else {
      return { success: true, status: 'DONE', message: `Assigned ${addedCount} resource permissions to "${roleName}".` };
    }
  }
  
  if (stepId === 'finalize') {
    if (typeof clearRolesCache === 'function') clearRolesCache();
    if (typeof clearRolePermissionsCache === 'function') clearRolePermissionsCache();
    return { success: true, status: 'DONE', message: 'System caches cleared.' };
  }
  
  throw new Error(`Unknown step ID: ${stepId}`);
}
