/**
 * ============================================================
 * Little Leap — Custom Menu & Management UI
 * ============================================================
 * 
 * This script adds a "Little Leap" menu to the Google Sheet.
 * It provides dialog-based interfaces for managing Users, Roles,
 * Access Control, and Resources.
 * 
 * INSTRUCTIONS:
 * 1. Open your Google Sheet.
 * 2. Go to Extensions > Apps Script.
 * 3. Paste this code into a file (e.g., appMenu.gs).
 * 4. Save and reload the Google Sheet.
 * ============================================================
 */

// ── CONSTANTS ────────────────────────────────────────────────
const SHEETS = {
  USERS: 'Users',
  ROLES: 'Roles',
  USER_ROLES: 'UserRoles',
  ROLE_PERMISSIONS: 'RolePermissions',
  RESOURCES: 'Resources'
};

const UI_COLOR = '#4a86c8'; // Little Leap Brand Color

// ── MENU CREATION ────────────────────────────────────────────

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Little Leap')
    .addSubMenu(ui.createMenu('User Management')
      .addItem('Create New User', 'showCreateUserDialog')
      .addItem('Update User Details', 'showUpdateUserDialog')
      .addItem('Toggle User Status', 'showToggleUserStatusDialog'))
    .addSubMenu(ui.createMenu('Role Management')
      .addItem('Create New Role', 'showCreateRoleDialog')
      .addItem('Update Role Details', 'showUpdateRoleDialog'))
    .addSubMenu(ui.createMenu('Access Control')
      .addItem('Assign Roles to User', 'showAssignRoleDialog')
      .addItem('Manage Role Permissions', 'showManagePermissionsDialog'))
    .addSubMenu(ui.createMenu('Resource Management')
      .addItem('Add New Resource', 'showAddResourceDialog')
      .addItem('Edit Resource', 'showEditResourceDialog'))
    .addToUi();
}

// ── UI SHOW FUNCTIONS ────────────────────────────────────────

function showCreateUserDialog() {
  showDialog('createUser', 'Create New User', 400, 500);
}

function showUpdateUserDialog() {
  showDialog('updateUser', 'Update User Details', 400, 550, { users: getUsersList() });
}

function showToggleUserStatusDialog() {
  showDialog('toggleUser', 'Toggle User Status', 400, 350, { users: getUsersList() });
}

function showCreateRoleDialog() {
  showDialog('createRole', 'Create New Role', 400, 400);
}

function showUpdateRoleDialog() {
  showDialog('updateRole', 'Update Role Details', 400, 450, { roles: getRolesList() });
}

function showAssignRoleDialog() {
  showDialog('assignRole', 'Assign Roles to User', 450, 550, { users: getUsersList(), roles: getRolesList() });
}

function showManagePermissionsDialog() {
  showDialog('managePermissions', 'Manage Role Permissions', 600, 600, { roles: getRolesList(), resources: getResourcesList() });
}

function showAddResourceDialog() {
  showDialog('addResource', 'Add New Resource', 450, 650);
}

function showEditResourceDialog() {
  showDialog('editResource', 'Edit Resource', 450, 700, { resources: getResourcesList() });
}

/**
 * Generic function to render HTML dialogs
 */
function showDialog(action, title, width, height, data = {}) {
  const htmlTemplate = getHtmlTemplate(action, data);
  const html = HtmlService.createHtmlOutput(htmlTemplate)
    .setWidth(width)
    .setHeight(height);
  SpreadsheetApp.getUi().showModalDialog(html, title);
}

// ── SERVER-SIDE ACTIONS ──────────────────────────────────────

function handleCreateUser(form) {
  try {
    const sheet = getSheet(SHEETS.USERS);
    const existing = findRow(sheet, 2, form.email);
    if (existing !== -1) throw new Error('User with this email already exists.');

    const nextRow = sheet.getLastRow() + 1;
    const passwordHash = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, form.password));
    
    sheet.getRange(nextRow, 2, 1, 4).setValues([[form.name, form.email, passwordHash, 'Active']]);
    return { success: true, message: `User created: ${form.name}` };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function handleUpdateUser(form) {
  try {
    const sheet = getSheet(SHEETS.USERS);
    const row = findRow(sheet, 0, form.userId);
    if (row === -1) throw new Error('User not found.');
    
    sheet.getRange(row, 2).setValue(form.name);
    sheet.getRange(row, 3).setValue(form.email);
    
    if (form.password) {
       const passwordHash = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, form.password));
       sheet.getRange(row, 4).setValue(passwordHash);
    }

    return { success: true, message: `User updated successfully.` };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function handleToggleUserStatus(form) {
  try {
    const sheet = getSheet(SHEETS.USERS);
    const row = findRow(sheet, 0, form.userId);
    if (row === -1) throw new Error('User not found.');
    
    const currentStatus = sheet.getRange(row, 5).getValue();
    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    sheet.getRange(row, 5).setValue(newStatus);
    
    return { success: true, message: `User status changed to ${newStatus}.` };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function handleCreateRole(form) {
  try {
    const sheet = getSheet(SHEETS.ROLES);
    const existing = findRow(sheet, 1, form.name);
    if (existing !== -1) throw new Error('Role with this name already exists.');

    const nextRow = sheet.getLastRow() + 1;
    sheet.getRange(nextRow, 2, 1, 2).setValues([[form.name, form.description]]);
    return { success: true, message: `Role created: ${form.name}` };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function handleUpdateRole(form) {
  try {
    const sheet = getSheet(SHEETS.ROLES);
    const row = findRow(sheet, 0, form.roleId);
    if (row === -1) throw new Error('Role not found.');

    sheet.getRange(row, 2).setValue(form.name);
    sheet.getRange(row, 3).setValue(form.description);
    return { success: true, message: `Role updated successfully.` };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function handleSyncRoles(form) {
  try {
    const userId = form.userId;
    const checkedRoles = [];
    for (const key in form) {
        if (key.startsWith('role_') && form[key] === true) {
            checkedRoles.push(key.replace('role_', ''));
        }
    }

    const sheet = getSheet(SHEETS.USER_ROLES);
    const data = sheet.getDataRange().getValues();
    
    // Remove existing roles for this user
    for (let i = data.length - 1; i >= 1; i--) {
        if (data[i][0] == userId) {
            sheet.deleteRow(i + 1);
        }
    }
    
    // Add checked roles
    checkedRoles.forEach(roleId => {
        sheet.appendRow([userId, roleId]);
    });
    
    return { success: true, message: `Roles updated for user.` };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function handleSavePermissions(form) {
  try {
      const sheet = getSheet(SHEETS.ROLE_PERMISSIONS);
      const roleId = form.roleId;
      const resource = form.resource;
      
      deletePermissionRows(sheet, roleId, resource);
      
      sheet.appendRow([
          roleId,
          resource,
          form.canRead || false,
          form.canWrite || false,
          form.canUpdate || false,
          form.canDelete || false
      ]);
      
      return { success: true, message: `Permissions saved.` };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function handleAddResource(form) {
  try {
    const sheet = getSheet(SHEETS.RESOURCES);
    const existing = findRow(sheet, 0, form.name);
    if (existing !== -1) throw new Error('Resource with this name already exists.');
    
    const rowData = [
       form.name,
       form.fileId,
       form.sheetName,
       form.skipColumns || 0,
       form.timestamps || false,
       form.userDetails || false
    ];
    
    sheet.appendRow(rowData);
    return { success: true, message: `Resource added: ${form.name}` };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function handleEditResource(form) {
  try {
    const sheet = getSheet(SHEETS.RESOURCES);
    const row = findRow(sheet, 0, form.originalName);
    if (row === -1) throw new Error('Resource not found.');
    
    sheet.getRange(row, 1).setValue(form.name);
    sheet.getRange(row, 2).setValue(form.fileId);
    sheet.getRange(row, 3).setValue(form.sheetName);
    sheet.getRange(row, 4).setValue(form.skipColumns || 0);
    sheet.getRange(row, 5).setValue(form.timestamps || false);
    sheet.getRange(row, 6).setValue(form.userDetails || false);
    
    return { success: true, message: `Resource updated.` };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function getUserAssignedRoles(userId) {
    const sheet = getSheet(SHEETS.USER_ROLES);
    const data = sheet.getDataRange().getValues();
    const roles = [];
    for (let i = 1; i < data.length; i++) {
        if (data[i][0] == userId) {
            roles.push(data[i][1]);
        }
    }
    return roles;
}


function getUserDetails(userId) {
   const sheet = getSheet(SHEETS.USERS);
   const row = findRow(sheet, 0, userId);
   if (row === -1) return null;
   const values = sheet.getRange(row, 1, 1, 5).getValues()[0];
   return { id: values[0], name: values[1], email: values[2] };
}

function getRoleDetails(roleId) {
   const sheet = getSheet(SHEETS.ROLES);
   const row = findRow(sheet, 0, roleId);
    if (row === -1) return null;
   const values = sheet.getRange(row, 1, 1, 3).getValues()[0];
   return { id: values[0], name: values[1], description: values[2] };
}

function getResourceDetails(resourceName) {
   const sheet = getSheet(SHEETS.RESOURCES);
   const row = findRow(sheet, 0, resourceName);
   if (row === -1) return null;
   const values = sheet.getRange(row, 1, 1, 6).getValues()[0];
   return { 
     name: values[0], 
     fileId: values[1], 
     sheetName: values[2], 
     skipColumns: values[3], 
     timestamps: values[4], 
     userDetails: values[5] 
   };
}

// ── HELPERS ──────────────────────────────────────────────────

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error(`Sheet "${name}" not found.`);
  return sheet;
}

function findRow(sheet, colIndex, value) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) { // Skip header
    if (data[i][colIndex] == value) {
      return i + 1; // 1-based row index
    }
  }
  return -1;
}

function deletePermissionRows(sheet, roleId, resource) {
    const data = sheet.getDataRange().getValues();
    for (let i = data.length - 1; i >= 1; i--) {
        if (data[i][0] == roleId && data[i][1] == resource) {
            sheet.deleteRow(i + 1);
        }
    }
}

function getUsersList() {
  const sheet = getSheet(SHEETS.USERS);
  const data = sheet.getDataRange().getValues();
  const list = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) list.push({ id: data[i][0], name: data[i][1], email: data[i][2] });
  }
  return list;
}

function getRolesList() {
    const sheet = getSheet(SHEETS.ROLES);
    const data = sheet.getDataRange().getValues();
    const list = [];
    for (let i = 1; i < data.length; i++) {
        if (data[i][0]) list.push({ id: data[i][0], name: data[i][1] });
    }
    return list;
}

function getResourcesList() {
    try {
        const sheet = getSheet(SHEETS.RESOURCES);
        const data = sheet.getDataRange().getValues();
        const list = [];
        for (let i = 1; i < data.length; i++) {
            if (data[i][0]) list.push({ name: data[i][0] });
        }
        return list;
    } catch (e) { return []; }
}

// ── HTML TEMPLATE GENERATOR ──────────────────────────────────

function getHtmlTemplate(action, data) {
  let content = '';
  const styles = `
    <style>
      body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 20px; color: #333; }
      h2 { color: ${UI_COLOR}; margin-top: 0; }
      .form-group { margin-bottom: 12px; }
      label { display: block; margin-bottom: 4px; font-weight: 600; font-size: 0.85em; }
      input[type="text"], input[type="email"], input[type="password"], input[type="number"], select, textarea {
        width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;
      }
      button {
        background-color: ${UI_COLOR}; color: white; border: none; padding: 10px;
        border-radius: 4px; cursor: pointer; font-size: 1em; width: 100%; margin-top: 10px;
      }
      button:hover { background-color: #357ebd; }
      button:disabled { background-color: #ccc; cursor: not-allowed; }
      #message { margin-top: 15px; padding: 8px; border-radius: 4px; display: none; font-size: 0.85em; text-align: center; }
      .success { background-color: #dff0d8; color: #3c763d; border: 1px solid #d6e9c6; }
      .error { background-color: #f2dede; color: #a94442; border: 1px solid #ebccd1; }
      .checkbox-group { display: flex; align-items: center; gap: 8px; font-size: 0.9em; font-weight: normal; margin-top: 5px; }
      input[type="checkbox"] { width: auto; margin: 0; }
      .perm-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 5px; }
      .checkbox-list { border: 1px solid #ccc; border-radius: 4px; padding: 10px; max-height: 200px; overflow-y: auto; background: #fdfdfd; }
    </style>
  `;

  const commonScript = `
    <script>
      function submitForm(handlerName) {
         const btn = document.getElementById('submitBtn');
         const msg = document.getElementById('message');
         const form = document.getElementById('mainForm');
         
         btn.disabled = true;
         const originalText = btn.innerText;
         btn.innerText = 'Processing...';
         msg.style.display = 'none';

         const formData = {};
         for(let i=0; i<form.elements.length; i++){
             const e = form.elements[i];
             if(e.name) {
                 if(e.type === 'checkbox') formData[e.name] = e.checked;
                 else formData[e.name] = e.value;
             }
         }

         google.script.run
           .withSuccessHandler((res) => {
              btn.disabled = false;
              btn.innerText = originalText;
              msg.style.display = 'block';
              msg.className = res.success ? 'success' : 'error';
              msg.innerText = res.message;
              if (res.success) {
                  // Keep open for bulk actions (Sync Roles & Manage Permissions)
                  if (handlerName === 'handleSyncRoles' || handlerName === 'handleSavePermissions') {
                      form.reset();
                      // Briefly highlight success then hide message
                      setTimeout(() => { msg.style.display = 'none'; }, 3000);
                  } else {
                      form.reset();
                      setTimeout(() => google.script.host.close(), 1500);
                  }
              }
           })
           .withFailureHandler((err) => {
              btn.disabled = false;
              btn.innerText = originalText;
              msg.style.display = 'block';
              msg.className = 'error';
              msg.innerText = 'System Error: ' + err.message;
           })
           [handlerName](formData);
      }
      
      function loadDetails(type, id) {
          if(!id) return;
          google.script.run.withSuccessHandler(fillForm).withFailureHandler(alert)['get'+type+'Details'](id);
      }
      
      function fillForm(data) {
          if(!data) return;
          for (const key in data) {
              const el = document.querySelector('[name="' + key + '"]');
              if(el) {
                 if(el.type === 'checkbox') el.checked = !!data[key];
                 else el.value = data[key];
              }
          }
          const origEl = document.querySelector('[name="originalName"]');
          if(origEl && data.name) origEl.value = data.name;
      }
      
      function loadCurrentRoles(userId) {
          if(!userId) return;
          // Reset all checks 
          const checks = document.querySelectorAll('.role-check');
          checks.forEach(c => c.checked = false);
          
          google.script.run.withSuccessHandler((roles) => {
              roles.forEach(roleId => {
                  const el = document.querySelector('[name="role_' + roleId + '"]');
                  if(el) el.checked = true;
              });
          }).getUserAssignedRoles(userId);
      }
    </script>
  `;

  switch(action) {
    case 'createUser':
      content = `
        <h2>Create User</h2>
        <form id="mainForm" onsubmit="event.preventDefault(); submitForm('handleCreateUser');">
          <div class="form-group"><label>Name</label><input type="text" name="name" required></div>
          <div class="form-group"><label>Email</label><input type="email" name="email" required></div>
          <div class="form-group"><label>Password</label><input type="password" name="password" required></div>
          <button id="submitBtn">Create User</button>
        </form>`;
      break;

    case 'updateUser':
      const userOpts = data.users.map(u => `<option value="${u.id}">${u.name} (${u.email})</option>`).join('');
      content = `
        <h2>Update User</h2>
        <form id="mainForm" onsubmit="event.preventDefault(); submitForm('handleUpdateUser');">
           <div class="form-group">
            <label>Select User</label>
            <select name="userId" onchange="loadDetails('User', this.value)" required>
                <option value="">-- Select --</option>
                ${userOpts}
            </select>
          </div>
          <div class="form-group"><label>Name</label><input type="text" name="name" required></div>
          <div class="form-group"><label>Email</label><input type="email" name="email" required></div>
          <div class="form-group"><label>New Password (optional)</label><input type="password" name="password"></div>
          <button id="submitBtn">Update User</button>
        </form>`;
      break;
      
    case 'toggleUser':
       const tUserOpts = data.users.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
       content = `
         <h2>Toggle User Status</h2>
         <form id="mainForm" onsubmit="event.preventDefault(); submitForm('handleToggleUserStatus');">
            <div class="form-group">
             <label>Select User</label>
             <select name="userId" required><option value="">-- Select --</option>${tUserOpts}</select>
           </div>
           <p style="font-size:0.85em; color:#666;">Flips status between Active and Inactive.</p>
           <button id="submitBtn">Toggle Status</button>
         </form>`;
       break;

    case 'createRole':
      content = `
        <h2>Create Role</h2>
        <form id="mainForm" onsubmit="event.preventDefault(); submitForm('handleCreateRole');">
          <div class="form-group"><label>Role Name</label><input type="text" name="name" required></div>
          <div class="form-group"><label>Description</label><textarea name="description" rows="3"></textarea></div>
          <button id="submitBtn">Create Role</button>
        </form>`;
      break;

    case 'updateRole':
      const roleOpts = data.roles.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
      content = `
        <h2>Update Role</h2>
        <form id="mainForm" onsubmit="event.preventDefault(); submitForm('handleUpdateRole');">
           <div class="form-group">
            <label>Select Role</label>
            <select name="roleId" onchange="loadDetails('Role', this.value)" required>
                <option value="">-- Select --</option>
                ${roleOpts}
            </select>
          </div>
          <div class="form-group"><label>Role Name</label><input type="text" name="name" required></div>
          <div class="form-group"><label>Description</label><textarea name="description" rows="3"></textarea></div>
          <button id="submitBtn">Update Role</button>
        </form>`;
      break;
      
    case 'assignRole':
      const syncUserOpts = data.users.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
      const syncRoleChecks = data.roles.map(r => `
        <label class="checkbox-group">
          <input type="checkbox" name="role_${r.id}" class="role-check"> ${r.name}
        </label>`).join('');
      content = `
        <h2>Assign/Sync Roles</h2>
        <form id="mainForm" onsubmit="event.preventDefault(); submitForm('handleSyncRoles');">
           <div class="form-group">
             <label>Select User</label>
             <select name="userId" onchange="loadCurrentRoles(this.value)" required>
               <option value="">-- Select User --</option>
               ${syncUserOpts}
             </select>
           </div>
           <div class="form-group">
             <label>Roles (Check to assign, Uncheck to withdraw)</label>
             <div class="checkbox-list">
               ${syncRoleChecks}
             </div>
           </div>
           <button id="submitBtn">Sync Roles</button>
        </form>`;
      break;
      
   case 'managePermissions':
      const mpRoleOpts = data.roles.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
      const mpResOpts = data.resources.map(r => `<option value="${r.name}">${r.name}</option>`).join('');
      content = `
        <h2>Manage Permissions</h2>
        <form id="mainForm" onsubmit="event.preventDefault(); submitForm('handleSavePermissions');">
           <div class="form-group"><label>Role</label><select name="roleId" required><option value="">-- Select Role --</option>${mpRoleOpts}</select></div>
           <div class="form-group"><label>Resource</label><select name="resource" required><option value="">-- Select Resource --</option>${mpResOpts}</select></div>
           <div class="form-group">
              <label>Permissions</label>
              <div class="perm-row">
                  <label class="checkbox-group"><input type="checkbox" name="canRead" checked> Read</label>
                  <label class="checkbox-group"><input type="checkbox" name="canWrite"> Write</label>
                  <label class="checkbox-group"><input type="checkbox" name="canUpdate"> Update</label>
                  <label class="checkbox-group"><input type="checkbox" name="canDelete"> Delete</label>
              </div>
           </div>
           <button id="submitBtn">Save Permissions</button>
        </form>`;
      break;
      
    case 'addResource':
      content = `
        <h2>Add Resource</h2>
        <form id="mainForm" onsubmit="event.preventDefault(); submitForm('handleAddResource');">
          <div class="form-group"><label>Resource Name</label><input type="text" name="name" required></div>
          <div class="form-group"><label>File ID</label><input type="text" name="fileId" placeholder="Google Sheet ID" required></div>
          <div class="form-group"><label>Sheet Name</label><input type="text" name="sheetName" required></div>
          <div class="form-group"><label>Skip Columns at Beginning</label><input type="number" name="skipColumns" value="0"></div>
          <div class="form-group"><label class="checkbox-group"><input type="checkbox" name="timestamps"> Enable Timestamps (CreatedAt/UpdatedAt)</label></div>
          <div class="form-group"><label class="checkbox-group"><input type="checkbox" name="userDetails"> Enable User Details (CreatedUserId/UpdatedUserId)</label></div>
          <button id="submitBtn">Add Resource</button>
        </form>`;
      break;

    case 'editResource':
      const resOpts = data.resources.map(r => `<option value="${r.name}">${r.name}</option>`).join('');
      content = `
        <h2>Edit Resource</h2>
        <form id="mainForm" onsubmit="event.preventDefault(); submitForm('handleEditResource');">
          <input type="hidden" name="originalName">
           <div class="form-group">
            <label>Select Resource</label>
            <select name="resourceId" onchange="loadDetails('Resource', this.value)" required>
                <option value="">-- Select --</option>
                ${resOpts}
            </select>
          </div>
          <div class="form-group"><label>Resource Name</label><input type="text" name="name" required></div>
          <div class="form-group"><label>File ID</label><input type="text" name="fileId" required></div>
          <div class="form-group"><label>Sheet Name</label><input type="text" name="sheetName" required></div>
          <div class="form-group"><label>Skip Columns at Beginning</label><input type="number" name="skipColumns"></div>
          <div class="form-group"><label class="checkbox-group"><input type="checkbox" name="timestamps"> Enable Timestamps</label></div>
          <div class="form-group"><label class="checkbox-group"><input type="checkbox" name="userDetails"> Enable User Details</label></div>
          <button id="submitBtn">Update Resource</button>
        </form>`;
      break;
  }

  return `
    <!DOCTYPE html>
    <html>
      <head><base target="_top">${styles}</head>
      <body>
        ${content}
        <div id="message"></div>
        ${commonScript}
      </body>
    </html>
  `;
}
