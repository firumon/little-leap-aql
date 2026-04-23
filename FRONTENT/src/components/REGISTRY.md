# Frontend Component Registry

Purpose: quick discovery of reusable UI blocks under `FRONTENT/src/components/`.

Rule: update this file whenever a new reusable component is added or a listed component's API changes.

Design principle:
- Prefer tiny, single-responsibility reusable components.
- Avoid page-private one-off wrappers unless there is a clear reuse path.

| Component Name | Description | Props | Events | Path |
|---|---|---|---|---|
| `MasterListHeader` | Master list header with title/subtitle, sync status, and record counters. | `{ config: Object, filteredCount: Number, totalCount: Number, loading: Boolean, backgroundSyncing: Boolean }` | `reload()` | `FRONTENT/src/components/Masters/MasterListHeader.vue` |
| `MasterListReportBar` | Toolbar-level report actions rendered as a standalone section card; hidden when no toolbar reports exist. | `{ reports: Array, isGenerating: Boolean }` | `generate-report(report)` | `FRONTENT/src/components/Masters/MasterListReportBar.vue` |
| `MasterListToolbar` | Search input for master list filtering. | `{ searchTerm: String }` | `update:searchTerm(value)` | `FRONTENT/src/components/Masters/MasterListToolbar.vue` |
| `MasterListRecords` | Card-list section with loading/empty states, field-based title/subtitle resolution, and child count badges per record. | `{ items: Array, loading: Boolean, resolvedFields: Array, childCountMap: Object }` | `navigate-to-view(row)` | `FRONTENT/src/components/Masters/MasterListRecords.vue` |
| `MasterListRecordsRecord` | Individual master record card with click-to-open detail (no status badge). | `{ row: Object, resolvePrimaryText: Function, resolveSecondaryText: Function }` | `open-detail(row)` | `FRONTENT/src/components/Masters/_common/MasterListRecordsRecord.vue` |
| `MasterListRecordsLoading` | Loading spinner for the master list. | `{}` | `None` | `FRONTENT/src/components/Masters/_common/MasterListRecordsLoading.vue` |
| `MasterListRecordsEmpty` | Empty state for the master list. | `{}` | `None` | `FRONTENT/src/components/Masters/_common/MasterListRecordsEmpty.vue` |
| `MasterListViewSwitcher` | Filter view chip bar for switching between named list views (Active/Inactive, custom filters). Shows counts per view, outlined/filled toggle for active state. Hidden when no views configured. | `{ views: Array, activeViewName: String, counts: Object }` | `update:activeViewName(name)` | `FRONTENT/src/components/Masters/MasterListViewSwitcher.vue` |
| `ResourceBreadcrumb` | Breadcrumb navigation for resource sub-route pages (Resource > Code > Action). Shared across masters, operations, and accounts scopes. | `{ scope: String, resourceSlug: String, resourceTitle: String, code: String, action: String, actionLabel: String }` |  | `FRONTENT/src/components/Masters/_common/ResourceBreadcrumb.vue` |
| `ChildRecordsTable` | Inline editable table for child resource records within Add/Edit/View pages. | `{ childResource: Object, records: Array, headers: Array, readonly: Boolean }` | `add`, `remove(index)`, `update(index, field, value)` | `FRONTENT/src/components/Masters/ChildRecordsTable.vue` |
| `BulkUploadControlsCard` | Left-side bulk upload controls: resource select, header input, file upload, and plotting. | `{ selectedResourceName: String, resourceOptions: Array, headersDisplay: String, rawContent: String, csvFile: Object }` | `update:selectedResourceName(value)`, `update:headersDisplay(value)`, `update:rawContent(value)`, `update:csvFile(file)`, `resourceSelected(value)`, `fileUpload(file)`, `downloadTemplate()`, `plotTable()` | `FRONTENT/src/components/Masters/BulkUpload/BulkUploadControlsCard.vue` |
| `BulkUploadPreviewTable` | Bulk upload preview/edit table with per-row inline editing and upload actions. | `{ rows: Array, columns: Array, isUploading: Boolean }` | `clearAll()`, `uploadAll()`, `deleteRow(row)`, `cellEdited(row, field, value)` | `FRONTENT/src/components/Masters/BulkUpload/BulkUploadPreviewTable.vue` |
| `BulkUploadEmptyState` | Empty-state panel for bulk upload page before plotting rows. | `{}` | `None` | `FRONTENT/src/components/Masters/BulkUpload/BulkUploadEmptyState.vue` |
| `ReportInputDialog` | Dynamic form dialog for collecting user inputs before PDF report generation. Renders text/number/date/boolean/select fields based on report config. | `{ modelValue: Boolean, report: Object, formValues: Object, isGenerating: Boolean }` | `update:modelValue(value)`, `update:formValues(values)`, `confirm()`, `cancel()` | `FRONTENT/src/components/Masters/ReportInputDialog.vue` |
| `MasterViewHeader` | View page header with record code, primary text title, and status badge. | `{ config, record, resourceName, code, primaryText }` | — | `FRONTENT/src/components/Masters/MasterViewHeader.vue` |
| `MasterViewActionBar` | View page action buttons: edit, additional actions, record-level reports. | `{ config, record, code, resourceSlug, scope, additionalActions, permissions }` | — | `FRONTENT/src/components/Masters/MasterViewActionBar.vue` |
| `MasterViewDetails` | Key-value detail grid for record fields on the View page. | `{ record, resolvedFields, resourceHeaders }` | — | `FRONTENT/src/components/Masters/MasterViewDetails.vue` |
| `MasterViewAudit` | Created/Updated audit timestamps on the View page. | `{ record }` | — | `FRONTENT/src/components/Masters/MasterViewAudit.vue` |
| `MasterViewChildren` | Child resource record tables on the View page. | `{ childResources, record, code }` | — | `FRONTENT/src/components/Masters/MasterViewChildren.vue` |
| `MasterViewChild` | Single child resource section on the View page. | `{ childResource: Object, childRecords: Array, additionalActions: Array }` | `view-child(childResource, code)` | `FRONTENT/src/components/Masters/_common/MasterViewChild.vue` |
| `MasterViewLoading` | Loading spinner for the master view page. | `{}` | `None` | `FRONTENT/src/components/Masters/_common/MasterViewLoading.vue` |
| `MasterViewEmpty` | Empty state for the master view page. | `{}` | `back` | `FRONTENT/src/components/Masters/_common/MasterViewEmpty.vue` |
| `MasterAddHeader` | Add page header with "Create {ResourceName}" title. | `{ config, resourceName }` | — | `FRONTENT/src/components/Masters/MasterAddHeader.vue` |
| `MasterAddForm` | Add page form fields (status select + text inputs). | `{ resolvedFields, parentForm, resourceHeaders }` | `update:field(header, value)` | `FRONTENT/src/components/Masters/MasterAddForm.vue` |
| `MasterAddChildren` | Add page child records table with inline editing. | `{ childResources, childRecords }` | `add-child(name)`, `remove-child(name, index)`, `update-child-field(name, index, field, value)` | `FRONTENT/src/components/Masters/MasterAddChildren.vue` |
| `MasterAddActions` | Add page cancel/submit action buttons. | `{ saving, submitLabel }` | `cancel()`, `submit()` | `FRONTENT/src/components/Masters/MasterAddActions.vue` |
| `MasterEditHeader` | Edit page header with "Edit {ResourceName} — {Code}" title. | `{ config, resourceName, code }` | — | `FRONTENT/src/components/Masters/MasterEditHeader.vue` |
| `MasterEditForm` | Edit page form with read-only code field + editable fields. | `{ resolvedFields, parentForm, resourceHeaders, code }` | `update:field(header, value)` | `FRONTENT/src/components/Masters/MasterEditForm.vue` |
| `MasterEditChildren` | Edit page child records table with inline editing. | `{ childResources, childRecords }` | `add-child(name)`, `remove-child(name, index)`, `update-child-field(name, index, field, value)` | `FRONTENT/src/components/Masters/MasterEditChildren.vue` |
| `MasterEditActions` | Edit page cancel/submit action buttons. | `{ saving, submitLabel }` | `cancel()`, `submit()` | `FRONTENT/src/components/Masters/MasterEditActions.vue` |
| `MasterActionHeader` | Action page header with action icon, label, and record code. | `{ config, record, code, actionConfig, primaryText }` | — | `FRONTENT/src/components/Masters/MasterActionHeader.vue` |
| `MasterActionForm` | Action page form with outcome selector and dynamic fields. | `{ actionConfig, actionFields, actionForm }` | `update:field(key, value)`, `update:outcome(value)` | `FRONTENT/src/components/Masters/MasterActionForm.vue` |
| `MasterActionActions` | Action page submit/cancel buttons with configurable label/icon/color. | `{ actionConfig, saving, submitDisabled }` | `cancel()`, `submit()` | `FRONTENT/src/components/Masters/MasterActionActions.vue` |
| `StockEntryGrid` | Editable stock register for `/operations/stock-movements/direct-entry`. Loads existing stock for a warehouse, allows inline editing and new rows, handles save deltas. | `{ warehouseCode: String }` | — | `FRONTENT/src/components/Warehouse/StockEntryGrid.vue` |
| `MenuTreeNode` | Recursive sidebar menu node renderer. Renders a `q-expansion-item` (group) or `q-item` (leaf) based on `node.type`. Used by `MainLayout.vue` to build an N-level sidebar tree from `group` path arrays. | `{ node: Object }` (node has `type: 'group'|'leaf'`, `key`, `label/navLabel`, `icon/navIcon`, `children?`, `routePath?`) | — | `FRONTENT/src/components/MenuTreeNode.vue` |
| `PurchaseRequisitionAddItemDialog` | Bottom-sheet add-item dialog used by PR create/review flows for SKU selection and quantity/rate entry. | `{ modelValue, newItem, skuOptions, formatCurrency }` | `update:modelValue(value)`, `filter-skus(...)`, `confirm-add-item()` | `FRONTENT/src/components/Operations/PurchaseRequisitions/PurchaseRequisitionAddItemDialog.vue` |
