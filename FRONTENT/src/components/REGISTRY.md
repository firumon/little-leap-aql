# Frontend Component Registry

Purpose: quick discovery of reusable UI blocks under `FRONTENT/src/components/`.

Rule: update this file whenever a new reusable component is added or a listed component's API changes.

Design principle:
- Prefer tiny, single-responsibility reusable components.
- Avoid page-private one-off wrappers unless there is a clear reuse path.

| Component Name | Description | Props | Events | Path |
|---|---|---|---|---|
| `MasterHeader` | Master page header with title/subtitle, sync status, and record counters. | `{ config: Object, filteredCount: Number, totalCount: Number, loading: Boolean, backgroundSyncing: Boolean }` | `reload()` | `FRONTENT/src/components/Masters/MasterHeader.vue` |
| `MasterToolbar` | Search and include-inactive controls for master list filtering. | `{ searchTerm: String, showInactive: Boolean }` | `update:searchTerm(value)`, `update:showInactive(value)`, `reload()` | `FRONTENT/src/components/Masters/MasterToolbar.vue` |
| `MasterList` | Card-list wrapper with loading/empty states for master records. | `{ loading: Boolean, items: Array, resolvePrimaryText: Function, resolveSecondaryText: Function }` | `open-detail(row)` | `FRONTENT/src/components/Masters/MasterList.vue` |
| `MasterRecordCard` | Individual master record card with status badge and click-to-open detail. | `{ row: Object, resolvePrimaryText: Function, resolveSecondaryText: Function }` | `open-detail(row)` | `FRONTENT/src/components/Masters/MasterRecordCard.vue` |
| `MasterDetailDialog` | Read-only detail dialog for selected master row with edit trigger. | `{ modelValue: Boolean, detailRow: Object, detailFields: Array, resolvePrimaryText: Function }` | `update:modelValue(value)`, `edit()` | `FRONTENT/src/components/Masters/MasterDetailDialog.vue` |
| `MasterEditorDialog` | Create/update dialog renderer for master form fields. | `{ modelValue: Boolean, isEdit: Boolean, config: Object, form: Object, resolvedFields: Array, statusOptions: Array, saving: Boolean }` | `update:modelValue(value)`, `update:form(form)`, `save()` | `FRONTENT/src/components/Masters/MasterEditorDialog.vue` |
| `BulkUploadControlsCard` | Left-side bulk upload controls: resource select, header input, file upload, and plotting. | `{ selectedResourceName: String, resourceOptions: Array, headersDisplay: String, rawContent: String, csvFile: Object }` | `update:selectedResourceName(value)`, `update:headersDisplay(value)`, `update:rawContent(value)`, `update:csvFile(file)`, `resourceSelected(value)`, `fileUpload(file)`, `downloadTemplate()`, `plotTable()` | `FRONTENT/src/components/Masters/BulkUpload/BulkUploadControlsCard.vue` |
| `BulkUploadPreviewTable` | Bulk upload preview/edit table with per-row inline editing and upload actions. | `{ rows: Array, columns: Array, isUploading: Boolean }` | `clearAll()`, `uploadAll()`, `deleteRow(row)`, `cellEdited(row, field, value)` | `FRONTENT/src/components/Masters/BulkUpload/BulkUploadPreviewTable.vue` |
| `BulkUploadEmptyState` | Empty-state panel for bulk upload page before plotting rows. | `{}` | `None` | `FRONTENT/src/components/Masters/BulkUpload/BulkUploadEmptyState.vue` |
| `ReportInputDialog` | Dynamic form dialog for collecting user inputs before PDF report generation. Renders text/number/date/boolean/select fields based on report config. | `{ modelValue: Boolean, report: Object, formValues: Object, isGenerating: Boolean }` | `update:modelValue(value)`, `update:formValues(values)`, `confirm()`, `cancel()` | `FRONTENT/src/components/Masters/ReportInputDialog.vue` |
