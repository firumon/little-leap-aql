# Little Leap AQL

Little Leap AQL is the operating system for Little Leap's UAE baby-product distribution business. The core heartbeat is outlet distribution, periodic sales tracking, strict-cycle payment collection, controlled refills, and timely supplier purchase ordering.

## Current Architecture Direction
- Single Google Apps Script project in the `APP` spreadsheet.
- `APP.Resources` is the control plane for backend routing and frontend runtime metadata.
- External sheets (`MASTERS`, `TRANSACTIONS`, `REPORTS`) are accessed dynamically via `Resources.FileID` + `Resources.SheetName`.
- No separate Apps Script projects are required in external spreadsheet files unless explicitly requested.

## Current Tech Stack
- Frontend: Quasar (Vue 3 + Vite), Pinia, Axios, IndexedDB cache.
- Backend API: Google Apps Script Web App (`doPost`).
- Data layer: Google Sheets split across APP / MASTERS / TRANSACTIONS / REPORTS.

## Identity and Access Model
- Authentication uses `APP.Users` (`Email`, `PasswordHash`, `ApiKey` token).
- User org context:
  - `Users.DesignationID` (single designation)
  - `Users.Roles` (CSV multi-role IDs)
- Resource permissions come from `APP.RolePermissions` (`Actions` CSV such as `Read,Write,Update,Delete,Approve`).
- Record-level policy comes from `APP.Resources`:
  - `RecordAccessPolicy`
  - `OwnerUserField`

## Resource-Driven Runtime (Backend + Frontend)
`APP.Resources` drives both sides:

- Backend:
  - Which file/sheet to open.
  - Required/unique/default validation.
  - Code generation behavior (`CodePrefix`, `CodeSequenceLength`).
  - Audit and row-level access policy.
- Frontend:
  - Authorized menu items.
  - Dynamic page routing (`ui.routePath`).
  - Titles/descriptions and optional dynamic fields.

## Auth/Login Contract (Current)
`action=login` returns:
- `token`
- `user` with `designation` and `roles`
- `resources[]` authorized for the user role set, including:
  - identity: `name`, `scope`
  - routing/config: `ui` object (`menuGroup`, `menuOrder`, `menuLabel`, `menuIcon`, `routePath`, `pageTitle`, `pageDescription`, `fields`, `showInMenu`)
  - permissions: `permissions.canRead/canWrite/canUpdate/canDelete`
  - schema/cache support: `headers`
  - metadata: `fileId`, `sheetName`, `codePrefix`, `codeSequenceLength`, `actions`, `allowedActions`

This payload is consumed directly by frontend auth, menu rendering, route guard, and master data sync services.

## Master API Shape (Current)
Preferred generic API pattern:
- `action=get`, `scope=master`, `resource` (or `resources`)
- `action=create`, `scope=master`, `resource`, `record`
- `action=update`, `scope=master`, `resource`, `code`, `record`

Master list transport supports compact row payloads (`rows` array-of-arrays) plus incremental sync cursor (`lastUpdatedAt`, `meta.lastSyncAt`).

## Current Delivery Focus
Commercial operations heartbeat (primary):
1. Distribute products to outlets.
2. Track outlet sales on periodic cycles.
3. Collect payments from outlets on strict intervals.
4. Refill outlet stock only after approval from authorized roles.
5. Raise purchase orders to suppliers when stock reaches reorder risk.

Inbound and warehouse operations (supporting):
1. Shipment booking and port clearance.
2. Warehouse receiving/GRN and variance.
3. Putaway to shelf/bin locations.
4. Inventory movement and stock visibility.
