# AQL Menu Admin Guide

This is the **single admin-facing guide** for all actions available in the Google Sheet menu:

- `AQL 🚀 > 👥 Users`
- `AQL 🚀 > 💼 Designations`
- `AQL 🚀 > 🌍 Access Regions`
- `AQL 🚀 > 🛡️ Roles`
- `AQL 🚀 > 📚 Resources`
- `AQL 🚀 > ⚙️ Setup & Refactor`

Use this document when an admin asks:
- where to go in menu
- what each action does
- what inputs are required
- what happens after clicking submit

## 1. Before You Start

1. Open the **APP** spreadsheet (not MASTERS/OPERATIONS/REPORTS).
2. Refresh the sheet to ensure `AQL 🚀` menu is visible.
3. Ensure you have edit access to APP spreadsheet.
4. Keep `Documents/RESOURCE_COLUMNS_GUIDE.md` nearby when editing resources.

## 2. Menu Map (Quick Reference)

| Menu Path | Purpose |
|---|---|
| `👥 Users > Create User` | Add a new system user with designation/roles/region scope. |
| `👥 Users > Update User` | Edit name/email/designation/roles/region; optionally reset password. |
| `👥 Users > Toggle User Status` | Switch user between `Active` and `Inactive`. |
| `💼 Designations > Create Designation` | Add a designation and hierarchy level. |
| `💼 Designations > Update Designation` | Edit designation metadata. |
| `🌍 Access Regions > Create Access Region` | Add a region node for access control hierarchy. |
| `🌍 Access Regions > Update Access Region` | Edit region code/name/parent. |
| `🛡️ Roles > Create Role` | Create role and assign per-resource actions. |
| `🛡️ Roles > Update Role` | Update role name/description and action matrix. |
| `🛡️ Roles > Inject Default Roles` | Populate baseline default roles. |
| `📚 Resources > Add Resource` | Create a resource row in `APP.Resources`. |
| `📚 Resources > Edit Resource` | Update existing resource config. |
| `📚 Resources > Manage Reports` | Configure report templates and report inputs per resource. |
| `📚 Resources > Manage Actions` | Configure `AdditionalActions` definitions per resource. |
| `📚 Resources > Manage Lists` | Configure list view filters per resource (`ListViews`). |
| `📚 Resources > Sync APP.Resources from Code` | Reconcile sheet schema/default rows with `syncAppResources.gs` source config. |
| `⚙️ Setup & Refactor > Refactor APP Sheets` | Ensure APP sheet structure and config tabs are aligned with code. |
| `⚙️ Setup & Refactor > Store APP File ID in Properties` | Save current APP file id to Script Properties for web app runtime fallback. |
| `⚙️ Setup & Refactor > Refactor MASTER Sheets` | Create/refactor configured master sheets. |
| `⚙️ Setup & Refactor > Setup All Operations` | Create/refactor operation sheets. |
| `⚙️ Setup & Refactor > Setup Base Accounts` | Create/refactor base account sheets. |

## 3. Users (`AQL 🚀 > 👥 Users`)

### 3.1 Create User
Required inputs:
- `Name`
- `Email`
- `Password`

Optional but recommended:
- `Designation`
- `Roles` (one or more)
- `Access Region` (leave empty for universe access)

Result:
- Adds a new row to `APP.Users` with `Status = Active`.
- Password is stored as hash.

### 3.2 Update User
Flow:
1. Select a user.
2. Form auto-fills current values.
3. Update fields and submit.

Notes:
- `Name` and `Email` remain required.
- `New Password` is optional.

### 3.3 Toggle User Status
Flow:
1. Select user.
2. Click toggle.

Result:
- Flips `Status` between `Active` and `Inactive`.

## 4. Designations (`AQL 🚀 > 💼 Designations`)

### 4.1 Create Designation
Required:
- `Name`

Optional:
- `HierarchyLevel`
- `Status` (`Active` / `Inactive`)
- `Description`

### 4.2 Update Designation
Flow:
1. Select designation.
2. Edit fields.
3. Submit.

## 5. Access Regions (`AQL 🚀 > 🌍 Access Regions`)

### 5.1 Create Access Region
Required:
- `Code` (must match `AAA999`, example: `UAE001`)
- `Name`

Optional:
- `Parent` (must exist if set)

Validation:
- Parent cannot be same as code.
- Duplicate code not allowed.

### 5.2 Update Access Region
Flow:
1. Select region.
2. Form auto-fills.
3. Edit and submit.

Validation rules are same as create.

## 6. Roles (`AQL 🚀 > 🛡️ Roles`)

### 6.1 Create Role
Required:
- `Name`

Optional:
- `Description`

Critical step:
- Select actions for each resource in matrix (`Read/Write/Update/Delete` + additional actions).

### 6.2 Update Role
Flow:
1. Select role.
2. Form and action matrix auto-fill.
3. Update fields and permissions.

### 6.3 Inject Default Roles
Purpose:
- Seeds standard baseline roles.

When to use:
- New setup / missing default role baseline.

## 7. Resources (`AQL 🚀 > 📚 Resources`)

### 7.1 Add Resource / Edit Resource
Purpose:
- Manage rows in `APP.Resources`, which drives routing, authorization payload, and master runtime behavior.

Minimum critical fields:
- `Name`
- `Scope`
- `SheetName` (for non-functional resources)
- `RecordAccessPolicy`

Important references:
- `Documents/RESOURCE_COLUMNS_GUIDE.md` (column-by-column meaning)
- `Documents/APP_SHEET_STRUCTURE.md` (`Resources` schema)

### 7.2 Manage Reports
Purpose:
- Configure per-resource report definitions stored in `Resources.Reports` JSON.

Admin input needed:
- Report label/name
- Template sheet
- Input mappings
- PDF options (if needed)

Reference:
- `Documents/MODULE_WORKFLOWS.md` section 1 (Report Generation)

### 7.3 Manage Actions
Purpose:
- Configure per-resource `AdditionalActions` definitions.

Admin input needed:
- Action label / key
- Target fields and behavior parameters per action

Reference:
- `Documents/RESOURCE_COLUMNS_GUIDE.md` (`AdditionalActions`)

### 7.4 Manage Lists
Purpose:
- Configure per-resource `ListViews` filters.

Behavior:
- If custom views exist: dialog shows view list for add/edit/delete.
- If no custom views: dialog shows select + `Update`:
  - `Fallback to default Active/Inactive` -> writes blank `ListViews` cell
  - `Switch off ListViews for <Resource>` -> writes `[]`
- Adding any view writes non-empty JSON array (custom mode).
- Deleting last custom view writes `[]` (off mode).

Reference:
- `Documents/RESOURCE_COLUMNS_GUIDE.md` (`ListViews` JSON schema + operators)
- `Documents/MODULE_WORKFLOWS.md` section 2 (List View runtime flow)

### 7.5 Sync APP.Resources from Code
Purpose:
- Applies `GAS/syncAppResources.gs` code-level defaults/headers to sheet safely.

When to use:
- After code changes touching `APP_RESOURCES_CODE_CONFIG`
- During setup/refactor recovery

## 8. Setup & Refactor (`AQL 🚀 > ⚙️ Setup & Refactor`)

### 8.1 Refactor APP Sheets
Use when:
- APP schema tabs/headers drift from expected structure.

### 8.2 Store APP File ID in Properties
Use when:
- Web app runtime cannot resolve APP spreadsheet context.

### 8.3 Refactor MASTER Sheets
Use when:
- Master sheet structures need creation or alignment.

### 8.4 Setup All Operations
Use when:
- Operation sheets are missing or need schema alignment.

### 8.5 Setup Base Accounts
Use when:
- Accounts baseline sheets are missing or need schema alignment.

## 9. Common Admin Mistakes

1. Running menu actions from non-APP spreadsheet.
2. Editing `APP.Resources` JSON columns manually without valid JSON.
3. Changing resource names casually after routes/permissions already depend on them.
4. Forgetting to sync/refactor after schema-related code updates.

## 10. Maintenance Rule (Mandatory)

When any `AQL 🚀` menu item is **added, removed, renamed, or behavior-changed** in code:

1. Update this document (`Documents/AQL_MENU_ADMIN_GUIDE.md`) in the same task.
2. Update index links in `Documents/README.md` if needed.
3. Update `Documents/CONTEXT_HANDOFF.md` if runtime behavior changed.

Do not close the task until these docs are aligned.
