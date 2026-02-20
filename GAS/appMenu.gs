/**
 * AQL Admin Menu
 * Aligned with latest APP schema.
 */

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('AQL')
    .addSubMenu(ui.createMenu('Users')
      .addItem('Create User', 'showCreateUserDialog')
      .addItem('Update User', 'showUpdateUserDialog')
      .addItem('Toggle User Status', 'showToggleUserStatusDialog'))
    .addSubMenu(ui.createMenu('Designations')
      .addItem('Create Designation', 'showCreateDesignationDialog')
      .addItem('Update Designation', 'showUpdateDesignationDialog'))
    .addSubMenu(ui.createMenu('Roles')
      .addItem('Create Role', 'showCreateRoleDialog')
      .addItem('Update Role', 'showUpdateRoleDialog'))
    .addSubMenu(ui.createMenu('Resources')
      .addItem('Add Resource', 'showAddResourceDialog')
      .addItem('Edit Resource', 'showEditResourceDialog'))
    .addToUi();
}

function showCreateUserDialog() {
  showDialog('createUser', 'Create User', 620, 760, baseDialogData());
}
function showUpdateUserDialog() {
  showDialog('updateUser', 'Update User', 620, 780, baseDialogData());
}
function showToggleUserStatusDialog() {
  showDialog('toggleUser', 'Toggle User Status', 460, 360, baseDialogData());
}
function showCreateDesignationDialog() {
  showDialog('createDesignation', 'Create Designation', 480, 450, baseDialogData());
}
function showUpdateDesignationDialog() {
  showDialog('updateDesignation', 'Update Designation', 500, 520, baseDialogData());
}
function showCreateRoleDialog() {
  showDialog('createRole', 'Create Role', 900, 760, baseDialogData());
}
function showUpdateRoleDialog() {
  showDialog('updateRole', 'Update Role', 900, 800, baseDialogData());
}
function showAddResourceDialog() {
  showDialog('addResource', 'Add Resource', 780, 920, baseDialogData());
}
function showEditResourceDialog() {
  showDialog('editResource', 'Edit Resource', 780, 950, baseDialogData());
}

function baseDialogData() {
  return {
    users: getUsersList(),
    roles: getRolesList(),
    designations: getDesignationsList(),
    resources: getResourcesList(),
    roleActionsMatrix: getRoleActionMatrix()
  };
}

function showDialog(action, title, width, height, data) {
  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(getHtmlTemplate(action, data || {})).setWidth(width).setHeight(height),
    title
  );
}

function handleCreateUser(form) {
  try {
    const ctx = ctxOf(CONFIG.SHEETS.USERS);
    const name = txt(form.name), email = txt(form.email), password = txt(form.password);
    if (!name || !email || !password) throw new Error('Name, Email, Password are required.');
    if (findRow(ctx.sheet, ctx.idx.Email, email, 2, false) !== -1) throw new Error('Email already exists.');

    ctx.sheet.appendRow(toRow(ctx.headers, {
      UserID: nextId(ctx, 'UserID', 'U', 4),
      Name: name,
      Email: email,
      PasswordHash: hashPasswordMenu(password),
      DesignationID: txt(form.designationId),
      Roles: rolesInputToCsv(form.roles),
      Status: 'Active',
      Avatar: '',
      ApiKey: ''
    }));
    return ok('User created.');
  } catch (e) { return fail(e); }
}

function handleUpdateUser(form) {
  try {
    const ctx = ctxOf(CONFIG.SHEETS.USERS);
    const userId = txt(form.userId);
    const row = findRow(ctx.sheet, ctx.idx.UserID, userId, 2, true);
    if (row === -1) throw new Error('User not found.');

    const name = txt(form.name), email = txt(form.email);
    if (!name || !email) throw new Error('Name and Email are required.');
    const er = findRow(ctx.sheet, ctx.idx.Email, email, 2, false);
    if (er !== -1 && er !== row) throw new Error('Email already exists.');

    put(ctx.sheet, row, ctx.idx.Name, name);
    put(ctx.sheet, row, ctx.idx.Email, email);
    put(ctx.sheet, row, ctx.idx.DesignationID, txt(form.designationId));
    put(ctx.sheet, row, ctx.idx.Roles, rolesInputToCsv(form.roles));
    if (txt(form.password)) put(ctx.sheet, row, ctx.idx.PasswordHash, hashPasswordMenu(form.password));
    return ok('User updated.');
  } catch (e) { return fail(e); }
}

function handleToggleUserStatus(form) {
  try {
    const ctx = ctxOf(CONFIG.SHEETS.USERS);
    const row = findRow(ctx.sheet, ctx.idx.UserID, txt(form.userId), 2, true);
    if (row === -1) throw new Error('User not found.');
    const cur = (get(ctx.sheet, row, ctx.idx.Status) || 'Active').toString().trim();
    put(ctx.sheet, row, ctx.idx.Status, cur === 'Active' ? 'Inactive' : 'Active');
    return ok('Status updated.');
  } catch (e) { return fail(e); }
}

function handleCreateDesignation(form) {
  try {
    const ctx = ctxOf(CONFIG.SHEETS.DESIGNATIONS);
    const name = txt(form.name);
    if (!name) throw new Error('Designation name required.');
    if (findRow(ctx.sheet, ctx.idx.Name, name, 2, false) !== -1) throw new Error('Designation already exists.');
    ctx.sheet.appendRow(toRow(ctx.headers, {
      DesignationID: nextId(ctx, 'DesignationID', 'D', 4),
      Name: name,
      HierarchyLevel: Number(form.hierarchyLevel || 0) || '',
      Status: txt(form.status || 'Active'),
      Description: txt(form.description)
    }));
    return ok('Designation created.');
  } catch (e) { return fail(e); }
}

function handleUpdateDesignation(form) {
  try {
    const ctx = ctxOf(CONFIG.SHEETS.DESIGNATIONS);
    const row = findRow(ctx.sheet, ctx.idx.DesignationID, txt(form.designationId), 2, true);
    if (row === -1) throw new Error('Designation not found.');
    if (!txt(form.name)) throw new Error('Designation name required.');
    put(ctx.sheet, row, ctx.idx.Name, txt(form.name));
    put(ctx.sheet, row, ctx.idx.HierarchyLevel, Number(form.hierarchyLevel || 0) || '');
    put(ctx.sheet, row, ctx.idx.Status, txt(form.status || 'Active'));
    put(ctx.sheet, row, ctx.idx.Description, txt(form.description));
    return ok('Designation updated.');
  } catch (e) { return fail(e); }
}

function handleCreateRole(form) {
  try {
    const ctx = ctxOf(CONFIG.SHEETS.ROLES);
    const name = txt(form.name);
    if (!name) throw new Error('Role name required.');
    if (findRow(ctx.sheet, ctx.idx.Name, name, 2, false) !== -1) throw new Error('Role already exists.');

    const roleId = nextId(ctx, 'RoleID', 'R', 4);
    ctx.sheet.appendRow(toRow(ctx.headers, { RoleID: roleId, Name: name, Description: txt(form.description) }));
    saveRolePermissionMatrix(roleId, form);
    return ok('Role created.');
  } catch (e) { return fail(e); }
}

function handleUpdateRole(form) {
  try {
    const ctx = ctxOf(CONFIG.SHEETS.ROLES);
    const roleId = txt(form.roleId);
    const row = findRow(ctx.sheet, ctx.idx.RoleID, roleId, 2, true);
    if (row === -1) throw new Error('Role not found.');
    if (!txt(form.name)) throw new Error('Role name required.');
    put(ctx.sheet, row, ctx.idx.Name, txt(form.name));
    put(ctx.sheet, row, ctx.idx.Description, txt(form.description));
    saveRolePermissionMatrix(roleId, form);
    return ok('Role updated.');
  } catch (e) { return fail(e); }
}

function saveRolePermissionMatrix(roleId, form) {
  const ctx = ctxOf(CONFIG.SHEETS.ROLE_PERMISSIONS);
  const values = ctx.sheet.getDataRange().getValues();
  for (let i = values.length; i >= 2; i--) {
    if ((values[i - 1][ctx.idx.RoleID] || '').toString().trim() === roleId) {
      ctx.sheet.deleteRow(i);
    }
  }

  const matrix = getRoleActionMatrix();
  matrix.resources.forEach(function(resource) {
    const selected = [];
    matrix.actionsByResource[resource].forEach(function(action) {
      const key = permKey(resource, action);
      if (form[key] === true || String(form[key]).toLowerCase() === 'true') selected.push(action);
    });
    if (selected.length) {
      ctx.sheet.appendRow(toRow(ctx.headers, {
        RoleID: roleId,
        Resource: resource,
        Actions: selected.join(',')
      }));
    }
  });
}

function handleAddResource(form) {
  try {
    const ctx = ctxOf(CONFIG.SHEETS.RESOURCES);
    const name = txt(form.name);
    if (!name) throw new Error('Resource Name required.');
    if (findRow(ctx.sheet, ctx.idx.Name, name, 2, true) !== -1) throw new Error('Resource already exists.');
    const rowObj = mapResource(form); rowObj.Name = name;
    ctx.sheet.appendRow(toRow(ctx.headers, rowObj));
    return ok('Resource added.');
  } catch (e) { return fail(e); }
}

function handleEditResource(form) {
  try {
    const ctx = ctxOf(CONFIG.SHEETS.RESOURCES);
    const key = txt(form.originalName || form.resourceId);
    const row = findRow(ctx.sheet, ctx.idx.Name, key, 2, true);
    if (row === -1) throw new Error('Resource not found.');
    const rowObj = mapResource(form); rowObj.Name = txt(form.name || key);
    Object.keys(rowObj).forEach(function(h) { put(ctx.sheet, row, ctx.idx[h], rowObj[h]); });
    return ok('Resource updated.');
  } catch (e) { return fail(e); }
}

function getUserDetails(userId) {
  const ctx = ctxOf(CONFIG.SHEETS.USERS), row = findRow(ctx.sheet, ctx.idx.UserID, txt(userId), 2, true);
  if (row === -1) return null;
  return { userId: get(ctx.sheet, row, ctx.idx.UserID), name: get(ctx.sheet, row, ctx.idx.Name), email: get(ctx.sheet, row, ctx.idx.Email), designationId: get(ctx.sheet, row, ctx.idx.DesignationID), roles: get(ctx.sheet, row, ctx.idx.Roles) };
}
function getDesignationDetails(designationId) {
  const ctx = ctxOf(CONFIG.SHEETS.DESIGNATIONS), row = findRow(ctx.sheet, ctx.idx.DesignationID, txt(designationId), 2, true);
  if (row === -1) return null;
  return { designationId: get(ctx.sheet, row, ctx.idx.DesignationID), name: get(ctx.sheet, row, ctx.idx.Name), hierarchyLevel: get(ctx.sheet, row, ctx.idx.HierarchyLevel), status: get(ctx.sheet, row, ctx.idx.Status), description: get(ctx.sheet, row, ctx.idx.Description) };
}
function getRoleDetails(roleId) {
  const ctx = ctxOf(CONFIG.SHEETS.ROLES), row = findRow(ctx.sheet, ctx.idx.RoleID, txt(roleId), 2, true);
  if (row === -1) return null;
  const roleActions = getRoleActionsByResource(roleId);
  return { roleId: get(ctx.sheet, row, ctx.idx.RoleID), name: get(ctx.sheet, row, ctx.idx.Name), description: get(ctx.sheet, row, ctx.idx.Description), roleActions: roleActions };
}
function getResourceDetails(resourceName) {
  const ctx = ctxOf(CONFIG.SHEETS.RESOURCES), row = findRow(ctx.sheet, ctx.idx.Name, txt(resourceName), 2, true);
  if (row === -1) return null;
  const out = { originalName: get(ctx.sheet, row, ctx.idx.Name) };
  ctx.headers.forEach(function(h) { out[toFormName(h)] = get(ctx.sheet, row, ctx.idx[h]); });
  return out;
}

function getUsersList() { return listRows(CONFIG.SHEETS.USERS, 'UserID', 'Name', 'Email'); }
function getRolesList() { return listRows(CONFIG.SHEETS.ROLES, 'RoleID', 'Name'); }
function getDesignationsList() { return listRows(CONFIG.SHEETS.DESIGNATIONS, 'DesignationID', 'Name').map(function(d){ return { id: d.id, name: d.name }; }); }
function getResourcesList() { return listRows(CONFIG.SHEETS.RESOURCES, 'Name', 'Name').map(function(r){ return { name: r.name }; }); }

function getRoleActionMatrix() {
  try {
    const resources = getResourcesList().map(function(r){ return r.name; });
    const ctx = ctxOf(CONFIG.SHEETS.RESOURCES);
    const matrix = { resources: resources, actionsByResource: {} };
    resources.forEach(function(resourceName) {
      const row = findRow(ctx.sheet, ctx.idx.Name, resourceName, 2, true);
      let extra = '';
      if (row !== -1 && ctx.idx.AdditionalActions !== undefined) extra = (get(ctx.sheet, row, ctx.idx.AdditionalActions) || '').toString();
      const base = ['Read', 'Write', 'Update', 'Delete'];
      const merged = base.concat(extra.split(',').map(function(x){ return x.trim(); }).filter(Boolean));
      matrix.actionsByResource[resourceName] = uniqueKeepOrder(merged);
    });
    return matrix;
  } catch (e) {
    return { resources: [], actionsByResource: {} };
  }
}

function getRoleActionsByResource(roleId) {
  const ctx = ctxOf(CONFIG.SHEETS.ROLE_PERMISSIONS);
  const values = ctx.sheet.getDataRange().getValues();
  const out = {};
  for (let i = 1; i < values.length; i++) {
    const r = (values[i][ctx.idx.RoleID] || '').toString().trim();
    if (r !== roleId) continue;
    const resource = (values[i][ctx.idx.Resource] || '').toString().trim();
    const actions = (values[i][ctx.idx.Actions] || '').toString().split(',').map(function(a){ return a.trim(); }).filter(Boolean);
    out[resource] = actions;
  }
  return out;
}

function listRows(sheetName, idHeader, nameHeader, extraHeader) {
  try {
    const ctx = ctxOf(sheetName), values = ctx.sheet.getDataRange().getValues(), out = [];
    for (let i = 1; i < values.length; i++) {
      const id = (values[i][ctx.idx[idHeader]] || '').toString().trim(); if (!id) continue;
      const row = { id: id, name: values[i][ctx.idx[nameHeader]] || id };
      if (extraHeader && ctx.idx[extraHeader] !== undefined) row.email = values[i][ctx.idx[extraHeader]] || '';
      out.push(row);
    }
    return out;
  } catch (e) { return []; }
}

function mapResource(form) {
  return {
    Scope: txt(form.scope || 'master').toLowerCase(),
    IsActive: boolText(form.isActive, true),
    FileID: txt(form.fileId),
    SheetName: txt(form.sheetName),
    CodePrefix: txt(form.codePrefix),
    CodeSequenceLength: numOrBlank(form.codeSequenceLength),
    SkipColumns: Number(form.skipColumns || 0) || 0,
    Audit: boolText(form.audit, false),
    RequiredHeaders: txt(form.requiredHeaders),
    UniqueHeaders: txt(form.uniqueHeaders),
    UniqueCompositeHeaders: txt(form.uniqueCompositeHeaders),
    DefaultValues: txt(form.defaultValues),
    RecordAccessPolicy: txt(form.recordAccessPolicy || 'ALL').toUpperCase(),
    OwnerUserField: txt(form.ownerUserField || 'CreatedBy'),
    AdditionalActions: txt(form.additionalActions),
    MenuGroup: txt(form.menuGroup),
    MenuOrder: numOrBlank(form.menuOrder),
    MenuLabel: txt(form.menuLabel),
    MenuIcon: txt(form.menuIcon),
    RoutePath: txt(form.routePath),
    PageTitle: txt(form.pageTitle),
    PageDescription: txt(form.pageDescription),
    UIFields: txt(form.uiFields),
    ShowInMenu: boolText(form.showInMenu, true),
    IncludeInAuthorizationPayload: boolText(form.includeInAuthorizationPayload, true)
  };
}

function ctxOf(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet not found: ' + sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const idx = {};
  headers.forEach(function(h, i) { idx[h] = i; });
  return { sheet: sheet, headers: headers, idx: idx };
}
function toRow(headers, obj) { return headers.map(function(h) { return obj[h] !== undefined ? obj[h] : ''; }); }
function put(sheet, row, idx, value) { if (idx !== undefined) sheet.getRange(row, idx + 1).setValue(value); }
function get(sheet, row, idx) { return idx === undefined ? '' : sheet.getRange(row, idx + 1).getValue(); }
function txt(v) { return (v || '').toString().trim(); }
function numOrBlank(v) { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : ''; }
function boolText(v, fallback) { if (v === true || String(v).toUpperCase() === 'TRUE') return 'TRUE'; if (v === false || String(v).toUpperCase() === 'FALSE') return 'FALSE'; return fallback ? 'TRUE' : 'FALSE'; }
function rolesInputToCsv(value) { return csv(Array.isArray(value) ? value.join(',') : value); }
function csv(v) { const seen = {}; return (v || '').toString().split(',').map(function(x){ return x.trim(); }).filter(function(x){ if (!x) return false; if (seen[x]) return false; seen[x] = 1; return true; }).join(','); }
function hashPasswordMenu(password) { return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password || '')); }
function findRow(sheet, colIndex, value, startRow, matchCase) {
  if (colIndex === undefined || value === undefined || value === null || value === '') return -1;
  const from = startRow || 2;
  if (sheet.getLastRow() < from) return -1;
  const range = sheet.getRange(from, colIndex + 1, sheet.getLastRow() - from + 1, 1);
  const finder = range.createTextFinder(String(value)).matchEntireCell(true);
  finder.matchCase(matchCase === true);
  const m = finder.findNext();
  return m ? m.getRow() : -1;
}
function nextId(ctx, header, prefix, digits) {
  if (ctx.idx[header] === undefined) return '';
  const values = ctx.sheet.getDataRange().getValues(), re = new RegExp('^' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\d+)$'); let max = 0;
  for (let i = 1; i < values.length; i++) {
    const m = ((values[i][ctx.idx[header]] || '').toString().trim()).match(re);
    if (m) { const n = Number(m[1]); if (n > max) max = n; }
  }
  return prefix + String(max + 1).padStart(digits || 4, '0');
}
function uniqueKeepOrder(list) { const s = {}; const out = []; list.forEach(function(v){ const k = (v || '').toString().trim(); if (!k) return; const nk = k.toUpperCase(); if (s[nk]) return; s[nk] = 1; out.push(k); }); return out; }
function permKey(resource, action) { return 'perm__' + sanitizeKey(resource) + '__' + sanitizeKey(action); }
function sanitizeKey(v) { return (v || '').toString().replace(/[^a-zA-Z0-9]/g, '_'); }
function ok(msg) { return { success: true, message: msg }; }
function fail(err) { return { success: false, message: err.message || String(err) }; }
function toFormName(h) {
  const m = { FileID:'fileId', SheetName:'sheetName', CodePrefix:'codePrefix', CodeSequenceLength:'codeSequenceLength', SkipColumns:'skipColumns', IsActive:'isActive', RequiredHeaders:'requiredHeaders', UniqueHeaders:'uniqueHeaders', UniqueCompositeHeaders:'uniqueCompositeHeaders', DefaultValues:'defaultValues', RecordAccessPolicy:'recordAccessPolicy', OwnerUserField:'ownerUserField', AdditionalActions:'additionalActions', MenuGroup:'menuGroup', MenuOrder:'menuOrder', MenuLabel:'menuLabel', MenuIcon:'menuIcon', RoutePath:'routePath', PageTitle:'pageTitle', PageDescription:'pageDescription', UIFields:'uiFields', ShowInMenu:'showInMenu', IncludeInAuthorizationPayload:'includeInAuthorizationPayload' };
  return m[h] || (h.charAt(0).toLowerCase() + h.slice(1));
}
function esc(v) { return (v == null ? '' : String(v)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

function getHtmlTemplate(action, data) {
  const users = data.users || [], roles = data.roles || [], resources = data.resources || [], designations = data.designations || [], matrix = data.roleActionsMatrix || { resources: [], actionsByResource: {} };
  const uo = users.map(function(x){ return '<option value="' + esc(x.id) + '">' + esc(x.name) + ' (' + esc(x.id) + ')</option>'; }).join('');
  const ro = roles.map(function(x){ return '<option value="' + esc(x.id) + '">' + esc(x.name) + ' (' + esc(x.id) + ')</option>'; }).join('');
  const rso = resources.map(function(x){ return '<option value="' + esc(x.name) + '">' + esc(x.name) + '</option>'; }).join('');
  const doo = designations.map(function(x){ return '<option value="' + esc(x.id) + '">' + esc(x.name) + '</option>'; }).join('');

  const style = '<style>body{font-family:Segoe UI,Arial,sans-serif;padding:14px}.row{display:grid;grid-template-columns:1fr 1fr;gap:8px}.g{margin:8px 0}label{display:block;font-size:12px;font-weight:600}input,select,textarea{width:100%;padding:7px;box-sizing:border-box;border:1px solid #ccc;border-radius:6px}textarea{min-height:60px}.note{font-size:12px;color:#666}button{width:100%;padding:9px;background:#2563eb;border:0;border-radius:7px;color:#fff;font-weight:600;margin-top:8px}.msg{display:none;margin-top:8px;padding:8px;border-radius:6px;font-size:12px}.ok{background:#ecfdf5;color:#065f46}.er{background:#fef2f2;color:#991b1b}.box{border:1px solid #ddd;border-radius:8px;padding:8px;margin-top:8px}.small{font-size:11px;color:#666}.checks{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.checks label{font-weight:400;font-size:12px;display:flex;gap:6px;align-items:center}</style>';
  const js = '<script>function submitForm(h){const f=document.getElementById("mainForm"),b=document.getElementById("submitBtn"),m=document.getElementById("msg"),p={};Array.from(f.elements).forEach(function(el){if(!el.name)return;if(el.type==="checkbox"){if(el.name==="roles"){if(!p.roles)p.roles=[];if(el.checked)p.roles.push(el.value);}else{p[el.name]=el.checked;}}else p[el.name]=el.value;});b.disabled=true;const t=b.innerText;b.innerText="Processing...";m.style.display="none";google.script.run.withSuccessHandler(function(r){b.disabled=false;b.innerText=t;m.style.display="block";m.className="msg "+(r.success?"ok":"er");m.innerText=r.message||"Done";if(r.success)setTimeout(function(){google.script.host.close();},800);}).withFailureHandler(function(e){b.disabled=false;b.innerText=t;m.style.display="block";m.className="msg er";m.innerText=e.message||String(e);})[h](p);}function loadDetails(t,id){if(!id)return;google.script.run.withSuccessHandler(function(d){fillForm(d,t);})["get"+t+"Details"](id);}function fillForm(d,t){if(!d)return;Object.keys(d).forEach(function(k){const el=document.querySelector("[name=\'"+k+"\']");if(!el)return;if(el.type==="checkbox"){const v=d[k];el.checked=(v===true||String(v).toUpperCase()==="TRUE");}else el.value=d[k]==null?"":d[k];});if(t==="User"){const roles=(d.roles||"").toString().split(",").map(function(x){return x.trim();});document.querySelectorAll("input[name=roles]").forEach(function(cb){cb.checked=roles.indexOf(cb.value)!==-1;});}if(t==="Role"){document.querySelectorAll("input[data-perm=1]").forEach(function(cb){cb.checked=false;});const map=d.roleActions||{};Object.keys(map).forEach(function(res){(map[res]||[]).forEach(function(act){const k="perm__"+res.replace(/[^a-zA-Z0-9]/g,"_")+"__"+act.replace(/[^a-zA-Z0-9]/g,"_");const cb=document.querySelector("input[name=\'"+k+"\']");if(cb)cb.checked=true;});});}}</script>';

  function roleChecks() {
    return '<div class="box"><div class="small">Select Roles</div><div class="checks">' + roles.map(function(r){ return '<label><input type="checkbox" name="roles" value="' + esc(r.id) + '"> ' + esc(r.name) + '</label>'; }).join('') + '</div></div>';
  }
  function roleMatrix() {
    return '<div class="box">' + matrix.resources.map(function(resource){
      const actions = matrix.actionsByResource[resource] || [];
      return '<div class="g"><div><b>' + esc(resource) + '</b></div><div class="checks">' + actions.map(function(action){
        const k = permKey(resource, action);
        return '<label><input data-perm="1" type="checkbox" name="' + esc(k) + '" value="true"> ' + esc(action) + '</label>';
      }).join('') + '</div></div>';
    }).join('') + '</div>';
  }

  let body = '';
  if (action === 'createUser') body = '<h2>Create User</h2><form id="mainForm" onsubmit="event.preventDefault();submitForm(\'handleCreateUser\')"><div class="g"><label>Name</label><input name="name" required></div><div class="g"><label>Email</label><input name="email" type="email" required></div><div class="g"><label>Password</label><input name="password" type="password" required></div><div class="g"><label>Designation</label><select name="designationId"><option value="">-- Select --</option>'+doo+'</select></div>'+roleChecks()+'<button id="submitBtn">Create User</button></form>';
  else if (action === 'updateUser') body = '<h2>Update User</h2><p class="note">Select user to auto-fill all fields and role checks.</p><form id="mainForm" onsubmit="event.preventDefault();submitForm(\'handleUpdateUser\')"><div class="g"><label>User</label><select name="userId" onchange="loadDetails(\'User\',this.value)" required><option value="">-- Select --</option>'+uo+'</select></div><div class="g"><label>Name</label><input name="name" required></div><div class="g"><label>Email</label><input name="email" type="email" required></div><div class="g"><label>Designation</label><select name="designationId"><option value="">-- Select --</option>'+doo+'</select></div>'+roleChecks()+'<div class="g"><label>New Password (optional)</label><input name="password" type="password"></div><button id="submitBtn">Update User</button></form>';
  else if (action === 'toggleUser') body = '<h2>Toggle User Status</h2><form id="mainForm" onsubmit="event.preventDefault();submitForm(\'handleToggleUserStatus\')"><div class="g"><label>User</label><select name="userId" required><option value="">-- Select --</option>'+uo+'</select></div><button id="submitBtn">Toggle</button></form>';
  else if (action === 'createDesignation') body = '<h2>Create Designation</h2><form id="mainForm" onsubmit="event.preventDefault();submitForm(\'handleCreateDesignation\')"><div class="g"><label>Name</label><input name="name" required></div><div class="g"><label>HierarchyLevel</label><input name="hierarchyLevel" type="number"></div><div class="g"><label>Status</label><select name="status"><option>Active</option><option>Inactive</option></select></div><div class="g"><label>Description</label><textarea name="description"></textarea></div><button id="submitBtn">Create</button></form>';
  else if (action === 'updateDesignation') body = '<h2>Update Designation</h2><form id="mainForm" onsubmit="event.preventDefault();submitForm(\'handleUpdateDesignation\')"><div class="g"><label>Designation</label><select name="designationId" onchange="loadDetails(\'Designation\',this.value)" required><option value="">-- Select --</option>'+doo+'</select></div><div class="g"><label>Name</label><input name="name" required></div><div class="g"><label>HierarchyLevel</label><input name="hierarchyLevel" type="number"></div><div class="g"><label>Status</label><select name="status"><option>Active</option><option>Inactive</option></select></div><div class="g"><label>Description</label><textarea name="description"></textarea></div><button id="submitBtn">Update</button></form>';
  else if (action === 'createRole') body = '<h2>Create Role</h2><form id="mainForm" onsubmit="event.preventDefault();submitForm(\'handleCreateRole\')"><div class="g"><label>Name</label><input name="name" required></div><div class="g"><label>Description</label><textarea name="description"></textarea></div><div class="small">Select actions per resource</div>'+roleMatrix()+'<button id="submitBtn">Create Role</button></form>';
  else if (action === 'updateRole') body = '<h2>Update Role</h2><p class="note">Select role to auto-check assigned resource actions.</p><form id="mainForm" onsubmit="event.preventDefault();submitForm(\'handleUpdateRole\')"><div class="g"><label>Role</label><select name="roleId" onchange="loadDetails(\'Role\',this.value)" required><option value="">-- Select --</option>'+ro+'</select></div><div class="g"><label>Name</label><input name="name" required></div><div class="g"><label>Description</label><textarea name="description"></textarea></div><div class="small">Select actions per resource</div>'+roleMatrix()+'<button id="submitBtn">Update Role</button></form>';
  else if (action === 'addResource' || action === 'editResource') {
    const ed = action === 'editResource';
    body = '<h2>'+(ed?'Edit':'Add')+' Resource</h2><form id="mainForm" onsubmit="event.preventDefault();submitForm(\''+(ed?'handleEditResource':'handleAddResource')+'\')">'+(ed?'<div class="g"><label>Resource</label><select name="resourceId" onchange="loadDetails(\'Resource\',this.value)" required><option value="">-- Select --</option>'+rso+'</select></div><input type="hidden" name="originalName">':'')+'<div class="row"><div class="g"><label>Name</label><input name="name" required></div><div class="g"><label>Scope</label><input name="scope" value="master"></div></div><div class="row"><div class="g"><label>FileID</label><input name="fileId" required></div><div class="g"><label>SheetName</label><input name="sheetName" required></div></div><div class="row"><div class="g"><label>CodePrefix</label><input name="codePrefix"></div><div class="g"><label>CodeSequenceLength</label><input name="codeSequenceLength" type="number"></div></div><div class="row"><div class="g"><label>SkipColumns</label><input name="skipColumns" type="number" value="0"></div><div class="g"><label>RecordAccessPolicy</label><select name="recordAccessPolicy"><option>ALL</option><option>OWNER</option><option>OWNER_GROUP</option><option>OWNER_AND_UPLINE</option></select></div></div><div class="g"><label>RequiredHeaders</label><input name="requiredHeaders"></div><div class="g"><label>UniqueHeaders</label><input name="uniqueHeaders"></div><div class="g"><label>UniqueCompositeHeaders</label><input name="uniqueCompositeHeaders"></div><div class="g"><label>DefaultValues (JSON)</label><textarea name="defaultValues"></textarea></div><div class="g"><label>OwnerUserField</label><input name="ownerUserField" value="CreatedBy"></div><div class="g"><label>AdditionalActions</label><input name="additionalActions"></div><div class="row"><div class="g"><label>MenuGroup</label><input name="menuGroup"></div><div class="g"><label>MenuOrder</label><input name="menuOrder" type="number"></div></div><div class="row"><div class="g"><label>MenuLabel</label><input name="menuLabel"></div><div class="g"><label>MenuIcon</label><input name="menuIcon"></div></div><div class="g"><label>RoutePath</label><input name="routePath"></div><div class="g"><label>PageTitle</label><input name="pageTitle"></div><div class="g"><label>PageDescription</label><textarea name="pageDescription"></textarea></div><div class="g"><label>UIFields</label><textarea name="uiFields"></textarea></div><div class="checks"><label><input type="checkbox" name="isActive" value="true" checked> IsActive</label><label><input type="checkbox" name="audit" value="true"> Audit</label><label><input type="checkbox" name="showInMenu" value="true" checked> ShowInMenu</label><label><input type="checkbox" name="includeInAuthorizationPayload" value="true" checked> IncludeInAuthorizationPayload</label></div><button id="submitBtn">'+(ed?'Update':'Add')+' Resource</button></form>';
  } else body = '<h2>Unsupported</h2>';

  return '<!doctype html><html><head><base target="_top">' + style + '</head><body>' + body + '<div id="msg" class="msg"></div>' + js + '</body></html>';
}
