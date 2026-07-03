// Onboarding Custom Menu
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('New ➕')
    .addItem('Create Tenant', 'showCreateTenantDialog')
    .addToUi();
}

// Dialog Loader
function showCreateTenantDialog() {
  const html = HtmlService.createTemplateFromFile('createTenantDialog');
  const dialog = html.evaluate()
    .setWidth(500)
    .setHeight(400)
    .setTitle('Create New Tenant');
  SpreadsheetApp.getUi().showModalDialog(dialog, 'Create New Tenant');
}

// Step 1: Register Tenant & Create Folder
function onboardStep1_initTenant(name, code, dirName) {
  try {
    const sName = (name || '').trim();
    const sCode = (code || '').trim().toUpperCase();
    const sDirName = (dirName || '').trim();

    if (!sName || !sCode || !sDirName) {
      throw new Error('Name, Code, and Directory Name are all required.');
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Check for duplicate in Tenants sheet
    let tenantsSheet = ss.getSheetByName('Tenants');
    if (!tenantsSheet) {
      tenantsSheet = ss.insertSheet('Tenants');
      tenantsSheet.appendRow(['Code', 'Name']);
    }

    const tenantsData = tenantsSheet.getDataRange().getValues();
    for (let i = 1; i < tenantsData.length; i++) {
      const existingCode = (tenantsData[i][0] || '').toString().trim().toUpperCase();
      if (existingCode === sCode) {
        throw new Error('Tenant Code "' + sCode + '" already exists in Tenants sheet.');
      }
    }

    // Check for duplicate in URL sheet
    let urlSheet = ss.getSheetByName('URL');
    if (!urlSheet) {
      urlSheet = ss.insertSheet('URL');
      urlSheet.appendRow(['Code', 'URL', 'Details']);
    }

    const urlData = urlSheet.getDataRange().getValues();
    for (let i = 1; i < urlData.length; i++) {
      const existingCode = (urlData[i][0] || '').toString().trim().toUpperCase();
      if (existingCode === sCode) {
        throw new Error('Tenant Code "' + sCode + '" already exists in URL sheet.');
      }
    }

    // Create Drive Directory under folder ID 1e8RvfsBT6XS9JDL5HY4TgM-vuZOWH4Gi
    const parentFolderId = '1e8RvfsBT6XS9JDL5HY4TgM-vuZOWH4Gi';
    let parentFolder;
    try {
      parentFolder = DriveApp.getFolderById(parentFolderId);
    } catch (e) {
      throw new Error('Could not retrieve parent folder AQL (ID: ' + parentFolderId + '). ' + e.message);
    }

    const newFolder = parentFolder.createFolder(sDirName);
    const newFolderId = newFolder.getId();

    // Write records
    tenantsSheet.appendRow([sCode, sName]);
    urlSheet.appendRow([sCode, '', sName]);

    return {
      success: true,
      folderId: newFolderId,
      folderName: sDirName
    };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

// Step 2: Copy App Template
function onboardStep2_copyAppTemplate(folderId) {
  try {
    const folder = DriveApp.getFolderById(folderId);
    const templateId = '1kHbeO-OZWjYCElNQUBfWe446_uNEH2IoKiHCiRjK-K4';
    const templateFile = DriveApp.getFileById(templateId);
    const appFile = templateFile.makeCopy('App', folder);
    const appFileId = appFile.getId();

    return {
      success: true,
      appFileId: appFileId
    };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

// Step 3: Copy/Create spreadsheets & Setup Config formulas
function onboardStep3_createRemainingSheets(folderId, appFileId) {
  try {
    const folder = DriveApp.getFolderById(folderId);
    const fileNames = ['Master', 'Operation', 'Accounts', 'Views', 'Reports'];
    const templateIds = {
      'Reports': '10wAJaxB41u37B4aWW9G4G5iyjeSZS9nIxP_yXTw9V9U',
      'Views': '1StZu0oTCmnDskin38vXAHUh8JKru58Kl8xi_7IDVpfs'
    };
    const createdFiles = {};

    for (let i = 0; i < fileNames.length; i++) {
      const name = fileNames[i];
      let file;
      let newSs;
      if (templateIds[name]) {
        const templateFile = DriveApp.getFileById(templateIds[name]);
        file = templateFile.makeCopy(name, folder);
        newSs = SpreadsheetApp.openById(file.getId());
      } else {
        newSs = SpreadsheetApp.create(name);
        file = DriveApp.getFileById(newSs.getId());
        file.moveTo(folder);
      }
      createdFiles[name] = newSs.getId();
    }

    const formula = '=IMPORTRANGE("https://docs.google.com/spreadsheets/d/' + appFileId + '/edit?gid=713789327#gid=713789327","Config!A1:B100")';

    const setupConfigSheet = (ssId) => {
      const ss = SpreadsheetApp.openById(ssId);
      let sheet = ss.getSheetByName('Config');
      if (!sheet) {
        sheet = ss.insertSheet('Config');
      }
      sheet.getRange('A1').setFormula(formula);
    };

    setupConfigSheet(createdFiles['Views']);
    setupConfigSheet(createdFiles['Reports']);

    return {
      success: true,
      appFileId: appFileId,
      masterFileId: createdFiles['Master'],
      operationFileId: createdFiles['Operation'],
      accountsFileId: createdFiles['Accounts'],
      viewsFileId: createdFiles['Views'],
      reportsFileId: createdFiles['Reports']
    };
  } catch (e) {
    return { success: false, message: e.message };
  }
}
