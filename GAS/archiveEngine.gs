function handleArchive(auth, payload) {
  if (!auth || !auth.user) {
    return { success: false, message: 'Unauthorized' };
  }

  var resources = payload && payload.resources && typeof payload.resources === 'object' ? payload.resources : null;
  if (!resources || !Object.keys(resources).length) {
    return { success: false, message: 'No resources provided for archive' };
  }

  var archivedMap = {};

  for (var resourceName in resources) {
    var codes = resources[resourceName];
    if (!Array.isArray(codes) || !codes.length) continue;

    var result = archive_processResourceBatch(resourceName, codes);
    for (var k in result) {
      if (!archivedMap[k]) archivedMap[k] = [];
      archivedMap[k] = archivedMap[k].concat(result[k]);
    }
  }

  return {
    success: true,
    archived: archivedMap,
    data: { archived: archivedMap }
  };
}

function archive_getPeriodFolderName(frequency) {
  var now = new Date();
  var year = now.getFullYear();
  var m = now.getMonth() + 1;
  var f = Math.max(1, Math.min(12, Number(frequency) || 1));
  var periodLength = Math.max(1, Math.floor(12 / f));
  var periodIndex = Math.floor((m - 1) / periodLength);
  var startMonth = periodIndex * periodLength + 1;
  var endMonth = Math.min(12, startMonth + periodLength - 1);

  var sStr = (startMonth < 10 ? '0' : '') + startMonth;
  var eStr = (endMonth < 10 ? '0' : '') + endMonth;
  return year + '_' + sStr + eStr;
}

function archive_getOrCreateFolder(parentFolder, name) {
  var iter = parentFolder.getFoldersByName(name);
  if (iter.hasNext()) return iter.next();
  return parentFolder.createFolder(name);
}

function archive_getOrCreateSpreadsheet(folder, fileName) {
  var iter = folder.getFilesByName(fileName);
  while (iter.hasNext()) {
    var file = iter.next();
    if (file.getMimeType() === MimeType.GOOGLE_SHEETS) {
      return SpreadsheetApp.openById(file.getId());
    }
  }

  var newSs = SpreadsheetApp.create(fileName);
  var newFile = DriveApp.getFileById(newSs.getId());
  newFile.moveTo(folder);
  return newSs;
}

function archive_headersMatch(h1, h2) {
  if (!Array.isArray(h1) || !Array.isArray(h2)) return false;
  if (h1.length !== h2.length) return false;
  for (var i = 0; i < h1.length; i++) {
    if (String(h1[i] || '').trim() !== String(h2[i] || '').trim()) return false;
  }
  return true;
}

function archive_resolveTargetTab(targetSs, baseSheetName, sourceHeaders) {
  var candidateName = baseSheetName;
  var suffix = 0;

  while (true) {
    var sheet = targetSs.getSheetByName(candidateName);
    if (!sheet) {
      sheet = targetSs.insertSheet(candidateName);
      if (sourceHeaders && sourceHeaders.length) {
        sheet.getRange(1, 1, 1, sourceHeaders.length).setValues([sourceHeaders]);
        sheet.getRange(1, 1, 1, sourceHeaders.length)
          .setFontWeight('bold')
          .setBackground('#455a64')
          .setFontColor('#ffffff')
          .setHorizontalAlignment('center')
          .setVerticalAlignment('middle')
          .setFontSize(10);
        sheet.setRowHeight(1, 30);
        sheet.setFrozenRows(1);
      }

      var defaultTab = targetSs.getSheetByName('Sheet1');
      if (defaultTab && targetSs.getSheets().length > 1 && candidateName !== 'Sheet1') {
        try { targetSs.deleteSheet(defaultTab); } catch (e) {}
      }
      return sheet;
    }

    var targetHeaders = [];
    if (sheet.getLastColumn() > 0) {
      targetHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    }
    if (archive_headersMatch(sourceHeaders, targetHeaders)) {
      return sheet;
    }

    suffix++;
    candidateName = baseSheetName + '_' + suffix;
  }
}

function archive_findForeignKeyHeader(childConfig, parentResourceName) {
  var rels = childConfig.relations || {};
  for (var h in rels) {
    var r = typeof rels[h] === 'string' ? rels[h] : rels[h]?.resource;
    if (r === parentResourceName) return h;
  }

  var expected = parentResourceName.replace(/s$/, '') + 'Code';
  var headers = childConfig.headers || [];
  if (headers.indexOf(expected) !== -1) return expected;

  for (var i = 0; i < headers.length; i++) {
    if (headers[i].endsWith('Code') && headers[i] !== 'Code') {
      var prefix = headers[i].slice(0, -4);
      if (parentResourceName.toLowerCase().indexOf(prefix.toLowerCase()) !== -1) {
        return headers[i];
      }
    }
  }

  return expected;
}

function archive_processResourceBatch(resourceName, rawCodes) {
  var configMap = getResourceConfigMap();
  var config = configMap[resourceName];
  if (!config) throw new Error('Resource not configured: ' + resourceName);

  var archiveConfig = config.archive || {};
  var freq = Number(archiveConfig.frequency) || 1;

  var appSs = getAppSpreadsheet();
  var appFile = DriveApp.getFileById(appSs.getId());
  var parentFolders = appFile.getParents();
  var rootFolder = parentFolders.hasNext() ? parentFolders.next() : DriveApp.getRootFolder();
  var archiveParent = archive_getOrCreateFolder(rootFolder, 'ARCHIVE');
  var periodFolder = archive_getOrCreateFolder(archiveParent, archive_getPeriodFolderName(freq));

  var sourceFileId = resolveFileIdForScope(config.scope, config.fileId);
  var defaultFileName = DriveApp.getFileById(sourceFileId).getName();
  var targetFileName = (archiveConfig.filename || '').toString().trim() || defaultFileName;
  var targetSs = archive_getOrCreateSpreadsheet(periodFolder, targetFileName);

  var childConfigs = [];
  for (var name in configMap) {
    if (configMap[name].parentResource === resourceName && configMap[name].isActive) {
      childConfigs.push(configMap[name]);
    }
  }

  var sourceSs = SpreadsheetApp.openById(sourceFileId);
  var sourceSheet = sourceSs.getSheetByName(config.sheetName);
  if (!sourceSheet) throw new Error('Source sheet not found: ' + config.sheetName);

  var parentData = sourceSheet.getDataRange().getValues();
  if (parentData.length <= 1) return {};

  var parentHeaders = parentData[0];
  var parentCodeIdx = parentHeaders.indexOf('Code');
  if (parentCodeIdx === -1) throw new Error('Source sheet missing Code column: ' + config.sheetName);

  var codeSet = {};
  for (var i = 0; i < rawCodes.length; i++) {
    var c = String(rawCodes[i] || '').trim();
    if (c) codeSet[c] = true;
  }

  var parentRows = [];
  for (var r = 1; r < parentData.length; r++) {
    var codeVal = String(parentData[r][parentCodeIdx] || '').trim();
    if (codeSet[codeVal]) {
      parentRows.push({ rowIndex: r + 1, code: codeVal, values: parentData[r] });
    }
  }

  if (!parentRows.length) return {};

  var childRowsByResource = {};
  for (var cIdx = 0; cIdx < childConfigs.length; cIdx++) {
    var child = childConfigs[cIdx];
    var childFileId = resolveFileIdForScope(child.scope, child.fileId);
    var childSs = childFileId === sourceFileId ? sourceSs : SpreadsheetApp.openById(childFileId);
    var childSheet = childSs.getSheetByName(child.sheetName);
    if (!childSheet) continue;

    var childData = childSheet.getDataRange().getValues();
    if (childData.length <= 1) continue;

    var childHeaders = childData[0];
    var childCodeIdx = childHeaders.indexOf('Code');
    var fkHeader = archive_findForeignKeyHeader(child, resourceName);
    var fkIdx = childHeaders.indexOf(fkHeader);
    if (fkIdx === -1) continue;

    var matchingChildRows = [];
    for (var cr = 1; cr < childData.length; cr++) {
      var fkVal = String(childData[cr][fkIdx] || '').trim();
      if (codeSet[fkVal]) {
        var chCode = childCodeIdx !== -1 ? String(childData[cr][childCodeIdx] || '').trim() : '';
        matchingChildRows.push({ rowIndex: cr + 1, code: chCode, values: childData[cr] });
      }
    }

    childRowsByResource[child.name] = {
      config: child,
      sheet: childSheet,
      headers: childHeaders,
      codeIdx: childCodeIdx,
      rows: matchingChildRows
    };
  }

  var parentTargetTab = archive_resolveTargetTab(targetSs, config.sheetName, parentHeaders);
  var parentTargetData = parentTargetTab.getDataRange().getValues();
  var parentExistingCodes = {};
  var parentTargetCodeIdx = parentHeaders.indexOf('Code');
  for (var pt = 1; pt < parentTargetData.length; pt++) {
    var existingCode = String(parentTargetData[pt][parentTargetCodeIdx] || '').trim();
    if (existingCode) parentExistingCodes[existingCode] = true;
  }

  var parentAppendRows = [];
  for (var p = 0; p < parentRows.length; p++) {
    if (!parentExistingCodes[parentRows[p].code]) {
      parentAppendRows.push(parentRows[p].values);
    }
  }
  if (parentAppendRows.length > 0) {
    parentTargetTab.getRange(parentTargetTab.getLastRow() + 1, 1, parentAppendRows.length, parentHeaders.length).setValues(parentAppendRows);
  }

  for (var chName in childRowsByResource) {
    var chObj = childRowsByResource[chName];
    if (!chObj.rows.length) continue;

    var chTargetTab = archive_resolveTargetTab(targetSs, chObj.config.sheetName, chObj.headers);
    var chTargetData = chTargetTab.getDataRange().getValues();
    var chExistingCodes = {};
    for (var ct = 1; ct < chTargetData.length; ct++) {
      var chCode = String(chTargetData[ct][chObj.codeIdx] || '').trim();
      if (chCode) chExistingCodes[chCode] = true;
    }

    var chAppendRows = [];
    for (var crIdx = 0; crIdx < chObj.rows.length; crIdx++) {
      if (!chExistingCodes[chObj.rows[crIdx].code]) {
        chAppendRows.push(chObj.rows[crIdx].values);
      }
    }
    if (chAppendRows.length > 0) {
      chTargetTab.getRange(chTargetTab.getLastRow() + 1, 1, chAppendRows.length, chObj.headers.length).setValues(chAppendRows);
    }
  }

  var archivedSummary = {};

  for (var childKey in childRowsByResource) {
    var cGroup = childRowsByResource[childKey];
    if (!cGroup.rows.length) continue;

    cGroup.rows.sort(function(a, b) { return b.rowIndex - a.rowIndex; });
    var deletedChildCodes = [];
    for (var d = 0; d < cGroup.rows.length; d++) {
      cGroup.sheet.deleteRow(cGroup.rows[d].rowIndex);
      if (cGroup.rows[d].code) deletedChildCodes.push(cGroup.rows[d].code);
    }

    archivedSummary[childKey] = deletedChildCodes;
    updateResourceSyncCursor(childKey);
  }

  parentRows.sort(function(a, b) { return b.rowIndex - a.rowIndex; });
  var deletedParentCodes = [];
  for (var pr = 0; pr < parentRows.length; pr++) {
    sourceSheet.deleteRow(parentRows[pr].rowIndex);
    deletedParentCodes.push(parentRows[pr].code);
  }

  archivedSummary[resourceName] = deletedParentCodes;
  updateResourceSyncCursor(resourceName);

  return archivedSummary;
}
