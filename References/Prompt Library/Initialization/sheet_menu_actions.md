# Initialization: AQL Sheet Menu Actions & Setup Scripts

> **Scope boundary**: This document covers modifying, configuring, and adding items to the Google Sheets AQL custom menu (`AQL 🚀`), managing admin dialogs, handling menu-triggered GAS callbacks, and running the setup/refactoring scripts that initialize sheet schemas. **DO NOT** load any frontend codebase files under `FRONTENT/` or frontend-only docs/specs when the task is restricted to sheet menu/setup scripts, to keep memory footprint and token consumption minimal.

Use this instruction when the user query/chat message is about the **app menu**, **spreadsheet menu**, **aql menu**, or related backend setup/refactor scripts.

---

## 1. Mandatory Pre-Reads (With Line-Level Links)

Before writing any menu actions or setup code, you must read the following files:
- The menu structure, submenus, and dialog triggers in [appMenu.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/appMenu.gs#L6-L56).
- The dialog loader and action handlers in [appMenu.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/appMenu.gs#L58-L111) and [appMenu.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/appMenu.gs#L304-L376).
- The resource synchronization script in [syncAppResources.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/syncAppResources.gs#L1276-L1350).
- The sheet setup/refactor utilities in [setupSheetUtils.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/setupSheetUtils.gs#L11-L100).
- The APP sheet database configuration in [setupAppSheets.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/setupAppSheets.gs#L9-L100).
- The MASTER sheet database configuration in [setupMasterSheets.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/setupMasterSheets.gs#L12-L50).
- The AQL Menu Admin Guide in [AQL_MENU_ADMIN_GUIDE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/AQL_MENU_ADMIN_GUIDE.md#L18-L56).

---

## 2. Sheet Schema & Column Matrix (App Spreadsheet)

The custom AQL menu actions primarily create, read, update, or toggle records inside the control-plane `APP` spreadsheet. You must be well educated about these sheets and their columns:

### A. Core Control-Plane Sheets
1. **`Config`**: Stores deployment-specific configurations (e.g. key-value file IDs like `MasterFileID`, `OperationFileID`, etc. and sync metadata).
   - Columns: `Key`, `Value`
2. **`Resources`**: Stores the metadata configurations driving both backend API dispatching and frontend dynamic page rendering.
   - Columns: `Name`, `Scope`, `ParentResource`, `IsActive`, `FileID`, `SheetName`, `CodePrefix`, `CodeSequenceLength`, `LastDataUpdatedAt`, `Audit`, `RequiredHeaders`, `UniqueHeaders`, `UniqueCompositeHeaders`, `DefaultValues`, `RecordAccessPolicy`, `OwnerUserField`, `AdditionalActions`, `Menu`, `UIFields`, `IncludeInAuthorizationPayload`, `Functional`, `PreAction`, `PostAction`, `Reports`, `ListViews`, `CustomUIName`.
3. **`Users`**: Standard identity and authorization record.
   - Columns: `UserID`, `Name`, `Email`, `PasswordHash`, `DesignationID`, `Roles` (comma-separated), `AccessRegion`, `Status` (Active/Inactive), `Avatar`, `ApiKey`.
4. **`Designations`**: Hierarchy and authority definition mapping.
   - Columns: `DesignationID`, `Name`, `HierarchyLevel`, `Status`, `Description`.
5. **`AccessRegions`**: Tree structure for access control boundaries.
   - Columns: `Code` (must match `AAA999`), `Name`, `Parent`.
6. **`Roles`**: Roles container sheet.
   - Columns: `RoleID`, `Name`, `Description`.
7. **`RolePermissions`**: Role-to-resource authorization matrix.
   - Columns: `RoleID`, `Resource`, `Actions` (comma-separated permissions).

### B. Crucial JSON-Based Columns in `Resources`
When creating forms or dialogs editing the `Resources` sheet, you must handle the following columns which accept JSON arrays/objects:
- **`Menu`**: JSON array of objects representing frontend sidebar entries. For example:
  ```json
  [{"group":["Masters"],"order":1,"label":"SKUs","icon":"grid_on","route":"/masters/skus","pageTitle":"SKUs","pageDescription":"Manage SKUs","show":true}]
  ```
  *Rule*: The dialog edit form typically updates the first array item and preserves the rest of the array via a hidden field `_menuArrayFull` (see [appMenu.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/appMenu.gs#L357-L375) mapping).
- **`UIFields`**: JSON array of fields defining form properties.
- **`AdditionalActions`**: JSON array configuring custom lifecycle transitions (e.g. Approve, Reject, Cancel).
- **`ListViews`**: JSON array defining list filter rules and criteria configurations.
- **`Reports`**: JSON array mapping printable report template sheets and cell inputs.
- **`DefaultValues`**: JSON object containing default key-value mappings for new records.

---

## 3. HTML Dialog Design & UI/UX Guardrails

When creating or modifying admin dialogs rendered inside Google Sheets:
- **Layout**: Keep forms clean, nicely arranged, and compact. Group related fields in labeled box containers or grids.
- **Checkbox Handling**: Checkbox inputs frequently cause state/binding and display issues in Google Sheets HTML dialog environments. 
  - *If rendering/state issues occur, or for toggle values, use `<select>` dropdowns* (e.g., `<option value="TRUE">Active</option>`) instead of raw check inputs.
- **Nice UI/UX Feedback**: Always present loading/updating messages (e.g., `<div id="status">Saving user... Please wait.</div>`) when calling `google.script.run`. Ensure buttons are disabled during processing to prevent duplicate submissions.
- **HTML Escaping**: Use `esc()` on all variable outputs in `buildDialogBody` to prevent rendering crashes or script injection.

---

## 4. Step-by-Step Implementation Checklist

1. **Menu Item Declaration**: Add the item under the appropriate submenu in `onOpen()` using `.addItem('Label', 'functionName')`.
2. **Dialog Wrapper**: Implement `function show<Action>Dialog()` to trigger `showDialog('actionName', 'Title', width, height, baseDialogData())`.
3. **Template UI**: Update `buildDialogBody(action, data)` inside `GAS/appMenu.gs` (or a dedicated HTML template like `adminDialog.html`) to render the custom form inputs. Use select dropdowns for toggle states and include loading panels.
4. **Backend Callback Handler**: Implement `function handle<Action>(form)` to receive form input, sanitize it (e.g. using `txt(form.field)`), validate fields (required, duplicate codes), write/append to the target sheet, and return an `{ success: true, message: '...' }` envelope.
5. **Code Config Sync**: If the modification involves default system resources, also update `APP_RESOURCES_CODE_CONFIG` inside `GAS/syncAppResources.gs` so the changes are applied during code sync.
6. **Sheet Refactoring Setup**: If the sheet schema changes, update the config list in `setupAppSheets.gs` or `setupMasterSheets.gs` with the new columns, column widths, validation rules, and default values.

---

## 5. Explicit Guardrails (DOs and DO NOTs)

- **DO NOT** load or edit frontend codes/docs under `FRONTENT/` when editing sheet menu actions. Keep memory and token usage to the minimum.
- **DO NOT** hardcode spreadsheet IDs inside setup scripts; always retrieve them dynamically from `CONFIG.SHEETS.CONFIG` or use `resolveFileIdForScope(scope, code)`.
- **DO** use `clearResourceConfigCache()`, `clearRolesCache()`, `clearRolePermissionsCache()`, or `clearAllAppCaches()` to invalidate cached sheets when records are created or edited.
- **DO** validate JSON formatting before saving JSON-backed fields.
- **DO** log action status to the log sheet via `logToSheet_` inside handlers.

---

## 6. Targeted Verification Plan

1. **Clasp Push**: Run `npm run gas:push` (or `cd GAS && clasp push`) to sync local changes.
2. **Spreadsheet Verification**:
   - Reload the APP spreadsheet and open the `AQL 🚀` menu.
   - Click the modified menu action and verify that the popup dialog opens with the nicely arranged layout.
   - Input sample values and verify that loading states appear during submit.
   - Verify that data is correctly written to the sheet and validation errors are handled gracefully in the dialog.
3. **Setup and Sync Run**: Run `Sync APP.Resources from Code` or `Refactor APP Sheets` to confirm configuration consistency and zero metadata drifts.
