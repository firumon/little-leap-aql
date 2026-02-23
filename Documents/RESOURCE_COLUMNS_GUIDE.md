# APP.Resources Columns Guide

This document explains each `APP > Resources` column, what to fill, and common value patterns.

## Usage Notes
- One row = one resource (`Products`, `PurchaseOrders`, `Shipments`, etc.).
- Keep `Name` stable after frontend routes/permissions go live.
- JSON columns must contain valid JSON (`{}` or `[]` format).

## Column Reference
| Column | Required | Type | Meaning | Typical Values / Format | Example |
|---|---|---|---|---|---|
| `Name` | Yes | Text | Unique resource key used in API + permissions | PascalCase resource name | `Products` |
| `Scope` | Yes | Text | Logical module for resource | `master`, `transaction`, `report`, `system` | `master` |
| `ParentResource` | Optional | Text | Points to a parent resource definition | Exact matched Name of another resource | `Products` |
| `IsActive` | Yes | Boolean | Enables/disables resource at runtime | `TRUE` / `FALSE` | `TRUE` |
| `FileID` | Yes | Text | Spreadsheet ID where sheet exists | Google Sheet file id | `1AbC...xyz` |
| `SheetName` | Yes | Text | Tab name inside target file | Exact tab name | `Products` |
| `CodePrefix` | Optional | Text | Prefix for generated `Code` | Any uppercase prefix | `LLMP` |
| `CodeSequenceLength` | Optional | Number | Digits for sequence part | Positive integer | `5` |
| `SkipColumns` | Optional | Number | Reserved offset for custom handlers | Integer (usually `0`) | `0` |
| `Audit` | Yes | Boolean | If true, backend manages audit fields | `TRUE` / `FALSE` | `TRUE` |
| `RequiredHeaders` | Optional | CSV Text | Fields required on create/update | Comma-separated header names | `Name,SKU` |
| `UniqueHeaders` | Optional | CSV Text | Single-column uniqueness checks | Comma-separated header names | `SKU` |
| `UniqueCompositeHeaders` | Optional | Text | Multi-column uniqueness checks | `A+B;C+D` or JSON array | `WarehouseCode+LocationCode` |
| `DefaultValues` | Optional | JSON Text | Default values used by backend | JSON object | `{"Status":"Active","Country":"UAE"}` |
| `RecordAccessPolicy` | Yes | Text | Row-level authorization model | `ALL`, `OWNER`, `OWNER_GROUP`, `OWNER_AND_UPLINE` | `OWNER_AND_UPLINE` |
| `OwnerUserField` | Optional | Text | Header used as owner column | Usually `CreatedBy` | `CreatedBy` |
| `AdditionalActions` | Optional | CSV Text | Declares domain actions supported by resource | Comma-separated action names | `Approve,Reject,Cancel` |
| `MenuGroup` | Optional | Text | Sidebar group label/classification | Any text | `Masters` |
| `MenuOrder` | Optional | Number | Sidebar order within group | Integer | `10` |
| `MenuLabel` | Optional | Text | Sidebar label | Any text | `Products` |
| `MenuIcon` | Optional | Text | Quasar/Material icon name | Icon id | `inventory_2` |
| `RoutePath` | Optional | Text | Frontend path mapped to resource | Absolute app route | `/masters/products` |
| `PageTitle` | Optional | Text | Page title shown in UI | Any text | `Products` |
| `PageDescription` | Optional | Text | Subtitle/help text | Any text | `Manage product master records` |
| `UIFields` | Optional | JSON Text | Field config for dynamic form/table | JSON array of field objects | `[{"header":"Name","label":"Name","type":"text","required":true}]` |
| `ShowInMenu` | Yes | Boolean | Whether to show in frontend menu | `TRUE` / `FALSE` | `TRUE` |
| `IncludeInAuthorizationPayload` | Yes | Boolean | Include this resource in login/getAuthorizedResources payload | `TRUE` / `FALSE` | `TRUE` |

## `RecordAccessPolicy` Meaning
- `ALL`: Any user with role action permission can access records.
- `OWNER`: Only creator/owner can access records.
- `OWNER_GROUP`: Owner + users in same designation hierarchy level.
- `OWNER_AND_UPLINE`: Owner + users in higher authority levels.

## `RolePermissions.Actions` Alignment
- Use `RolePermissions.Actions` to grant actions per role-resource.
- CRUD inference used by backend:
  - `Read` -> read permission
  - `Write` or `Create` -> create permission
  - `Update` -> update permission
  - `Delete` -> delete permission
- Additional actions (like `Approve`) are checked from same `Actions` list.
