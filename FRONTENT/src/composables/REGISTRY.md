# Frontend Composable Registry

Purpose: quick discovery of reusable state/logic modules under `FRONTENT/src/composables/`.

Rule: update this file whenever a new composable is added or a listed composable's signature/returns change.

Design principle:
- Prefer tiny, single-responsibility composables with clear reuse intent.
- Avoid page-private one-off abstractions unless there is a clear reuse path.

| Composable Name | Description (What & Why) | Arguments | Returns | Path |
|---|---|---|---|---|
| `useResourceConfig` | Resolves current resource configuration from route params + auth store. Provides scope, slug, code, action, config, headers, fields, additionalActions, and permissions. | `()` | `{ scope, resourceSlug, code, action, level, config, resourceName, resourceHeaders, resolvedFields, additionalActions, permissions }` | `FRONTENT/src/composables/useResourceConfig.js` |
| `useResourceData` | Cache-first data loading, search, and filtering for a resource. Background sync after cache hit. | `(resourceName: Ref<String>)` | `{ items, filteredItems, loading, backgroundSyncing, searchTerm, showInactive, reload, getRecordByCode }` | `FRONTENT/src/composables/useResourceData.js` |
| `useResourceRelations` | Discovers parent-child relationships from auth store resource list. Supports recursive tree building. | `(resourceName: Ref<String>)` | `{ childResources, parentResource, hasChildren, hasParent, getChildResources, getResourceByName, buildResourceTree }` | `FRONTENT/src/composables/useResourceRelations.js` |
| `useCompositeForm` | Manages parent + child records form state for composite Add/Edit pages with atomic save via compositeSave API. | `(config: Object, childResources: Array)` | `{ form, childRecords, saving, initializeForCreate, initializeForEdit, addChildRecord, removeChildRecord, updateChildField, validateForm, save }` | `FRONTENT/src/composables/useCompositeForm.js` |
| `useActionFields` | Resolves form fields for additional action pages based on resource headers + AdditionalActions config. Column existence gating. | `(actionConfig: Object, headers: Array)` | `{ fields, resolvedFields, guessFieldType }` | `FRONTENT/src/composables/useActionFields.js` |
| `useBulkUpload` | Shared logic for bulk upload flow: resource/header selection, draft restore/save, table plotting, row edits, and upload execution. | `()` | `{ selectedResourceName, rawContent, csvFile, headersDisplay, rows, isUploading, resourceOptions, selectedResourceHeaders, activeHeaders, columns, onResourceSelected, downloadTemplate, handleFileUpload, plotTable, onCellEdited, deleteRow, saveDraft, clearAll, uploadAll }` | `FRONTENT/src/composables/useBulkUpload.js` |
| `useReports` | Report generation orchestration: resolves toolbar/record-level report configs, collects user inputs via dialog, builds cellData payloads, calls GAS backend, converts Base64 PDF to download. | `()` | `{ isGenerating, showReportDialog, activeReport, reportInputs, getToolbarReports, getRecordReports, requiresUserInput, initiateReport, confirmReportDialog, cancelReportDialog, executeReport }` | `FRONTENT/src/composables/useReports.js` |
