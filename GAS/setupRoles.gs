/**
 * ============================================================
 * Little Leap AQL - Roles Setup
 * ============================================================
 * Setup default roles to kickstart the system permission assignments.
 */

function setupDefaultRoles() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Roles Sheet
    let rolesSheet = ss.getSheetByName(CONFIG.SHEETS.ROLES);
    if (!rolesSheet) {
        throw new Error('Roles sheet not found. Run setupAppSheets first.');
    }

    // Define standard roles
    const roles = [
        { name: 'Admin', description: 'System Administrator with full access' },
        { name: 'ProcurementManager', description: 'Manages international procurements, POs, and RFQs' },
        { name: 'StoreKeeper', description: 'Manages warehouse receipt, GRNs, and stocking' },
        { name: 'Accountant', description: 'Handles ledgers, charts of accounts, and financial entries' },
        { name: 'DepartmentHead', description: 'Initiates and approves Department Requisitions' }
    ];

    const existingRoles = rolesSheet.getRange(2, 2, Math.max(rolesSheet.getLastRow() - 1, 1), 1).getValues().flat();
    let addedRolesCount = 0;

    const headers = rolesSheet.getRange(1, 1, 1, rolesSheet.getLastColumn()).getValues()[0];
    const rolesIdx = {}; headers.forEach((h, i) => rolesIdx[h] = i);
    const ctx = { sheet: rolesSheet, headers: headers, idx: rolesIdx };

    roles.forEach(role => {
        if (existingRoles.indexOf(role.name) === -1) {
            const newRoleId = nextId(ctx, 'RoleID', 'R', 4);
            rolesSheet.appendRow([newRoleId, role.name, role.description]);
            addedRolesCount++;
        }
    });

    // Role Permissions Sheet
    let permissionsSheet = ss.getSheetByName(CONFIG.SHEETS.ROLE_PERMISSIONS);
    if (!permissionsSheet) {
        throw new Error('RolePermissions sheet not found.');
    }

    // After adding roles, fetch them again to get the exact RoleID generated
    SpreadsheetApp.flush();
    const finalRoles = rolesSheet.getRange(2, 1, Math.max(rolesSheet.getLastRow() - 1, 1), 2).getValues();
    const roleMap = {};
    finalRoles.forEach(r => { roleMap[r[1]] = r[0]; });

    const permissions = [];

    // Admin Permissions
    if (roleMap['Admin']) {
        permissions.push({ roleId: roleMap['Admin'], resource: '*', actions: '*' });
    }

    // Procurement Manager Permissions
    if (roleMap['ProcurementManager']) {
        const pmResources = [
            'Procurements', 'PurchaseRequisitions', 'PurchaseRequisitionItems',
            'RFQs', 'RFQItems', 'RFQSuppliers', 'SupplierQuotations', 'SupplierQuotationItems',
            'PurchaseOrders', 'PurchaseOrderItems', 'POFulfillments', 'Suppliers', 'Products', 'SKUs'
        ];
        pmResources.forEach(res => {
            permissions.push({ roleId: roleMap['ProcurementManager'], resource: res, actions: '*' });
        });
    }

    // StoreKeeper Permissions
    if (roleMap['StoreKeeper']) {
        const skResources = [
            'GoodsReceipts', 'GoodsReceiptItems', 'StockMovements', 'Shipments', 'ShipmentItems',
            'WarehouseStorages', 'Warehouses'
        ];
        skResources.forEach(res => {
            permissions.push({ roleId: roleMap['StoreKeeper'], resource: res, actions: '*' });
        });
    }

    // Accountant Permissions
    if (roleMap['Accountant']) {
        const accResources = [
            'ChartOfAccounts', 'EntryTemplates', 'Assets', 'Liabilities', 'Equity', 'Revenue', 'Expenses'
        ];
        accResources.forEach(res => {
            permissions.push({ roleId: roleMap['Accountant'], resource: res, actions: '*' });
        });
    }

    // Department Head Permissions
    if (roleMap['DepartmentHead']) {
        const dhResources = [
            'PurchaseRequisitions', 'PurchaseRequisitionItems'
        ];
        dhResources.forEach(res => {
            permissions.push({ roleId: roleMap['DepartmentHead'], resource: res, actions: 'Create,Read,Update,Approve,Reject' });
        });
    }

    // Write permissions that are missing
    const existingPermsData = permissionsSheet.getRange(2, 1, Math.max(permissionsSheet.getLastRow() - 1, 1), 3).getValues();
    let addedPermsCount = 0;

    permissions.forEach(p => {
        const exists = existingPermsData.find(row => row[0] === p.roleId && row[1] === p.resource);
        if (!exists) {
            permissionsSheet.appendRow([p.roleId, p.resource, p.actions]);
            addedPermsCount++;
        } else if (exists && exists[2] !== p.actions && p.actions === '*') {
            // Overwrite if previously partial and now needs full *
            // For safety, not fully overwriting here unless explicit, but let's just append missing for now
        }
    });

    const summary = `Roles Setup Complete.\nAdded Roles: ${addedRolesCount}\nAdded RolePermissions: ${addedPermsCount}`;
    Logger.log(summary);
    try {
        SpreadsheetApp.getUi().alert(summary);
    } catch (e) { }
}
