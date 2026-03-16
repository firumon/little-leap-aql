# Frontend Composable Registry

Purpose: quick discovery of reusable state/logic modules under `FRONTENT/src/composables/`.

Rule: update this file whenever a new composable is added or a listed composable's signature/returns change.

Design principle:
- Prefer tiny, single-responsibility composables with clear reuse intent.
- Avoid page-private one-off abstractions unless there is a clear reuse path.

| Composable Name | Description (What & Why) | Arguments | Returns | Path |
|---|---|---|---|---|
| `useMasterPage` | Shared orchestration logic for dynamic master pages: route resolution, cache-first loading, search/filter, dialogs, optimistic create/update, and background sync. | `()` | `{ route, currentResource, config, items, filteredItems, searchTerm, showInactive, loading, saving, backgroundSyncing, showDialog, showDetailDialog, isEdit, form, detailRow, statusOptions, resolvedFields, detailFields, resolvePrimaryText, resolveSecondaryText, reload, openCreateDialog, openDetailDialog, editFromDetail, save }` | `FRONTENT/src/composables/useMasterPage.js` |
| `useBulkUpload` | Shared logic for bulk upload flow: resource/header selection, draft restore/save, table plotting, row edits, and upload execution. | `()` | `{ selectedResourceName, rawContent, csvFile, headersDisplay, rows, isUploading, resourceOptions, selectedResourceHeaders, activeHeaders, columns, onResourceSelected, downloadTemplate, handleFileUpload, plotTable, onCellEdited, deleteRow, saveDraft, clearAll, uploadAll }` | `FRONTENT/src/composables/useBulkUpload.js` |
