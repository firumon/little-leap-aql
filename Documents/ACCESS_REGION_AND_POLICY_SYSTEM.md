# Access Regions and Access Policy System

This document is the single source of truth for Access Regions, Access Policy, and Access Region Sources in AQL.

---

## 1. Quick Overview

In AQL, we keep data safe by using **Access Regions** and **Access Policies**.

- An **Access Region** is a place or group boundary (like a city, state, or branch).
- Regions live in a tree. A parent region has child regions under it.
- A user belongs to an Access Region.
- A record belongs to an Access Region.
- An **Access Policy** sets what regions a user can see for each resource.
- An **Access Region Source** tells the system how a new row finds its region.

---

## 2. Core Concepts

### 2.1 The Region Tree
Regions live in the `AccessRegions` sheet.
Every region has:
- A `Code`: A unique ID. It must be 3 letters and 3 numbers (like `UAE001` or `QTR002`).
- A `Name`: A plain name (like `Dubai` or `Doha`).
- A `Parent`: The code of the parent region above it. If blank, this region is at the top.

```
       Gulf (GLF001)
       /           \
  UAE (UAE001)   Qatar (QTR001)
     /      \
Dubai     Abu Dhabi
(DXB001)   (AUH001)
```

In code, `getAccessRegionContext()` in [`GAS/accessRegion.gs`](file:///f:/LITTLE%20LEAP/AQL/GAS/accessRegion.gs#L23) reads this sheet. It builds:
1. `rows`: A list of all regions.
2. `byCode`: A map of regions by their code.
3. `childMap`: A map showing all direct children of each parent code.

### 2.2 The Universe Concept
A blank region means **Universe**.
- **User with blank region**: This user is a Universe User. They see all records across all regions.
- **Record with blank region**: This record is a Universe Record. Every user can see it, no matter what region the user has.

### 2.3 How a User Gets Their Region
The system finds a user's region using `resolveUserAccessRegionCode(userRow)` in [`GAS/accessRegion.gs`](file:///f:/LITTLE%20LEAP/AQL/GAS/accessRegion.gs#L83):
1. The user has a `DesignationID`.
2. The system reads the user's designation from `APP.Designations`.
3. If the designation has an `AccessRegion`, that code is used.
4. If not, the system falls back to `userRow.AccessRegion` on `APP.Users`. (This fallback is temporary for older setups).

### 2.4 User Scope: Assigned, Children, and Parents
When a user logs in, the system builds their full region scope with `buildUserAccessRegionScope(userRow)`:
- `assignedCode`: The user's main region code.
- `isUniverse`: `true` if `assignedCode` is blank, otherwise `false`.
- `children`: A flat list of all descendant region codes under the user (children, grandchildren, etc.). Found using breadth-first search in `expandAccessRegionCodes()`.
- `parents`: A list of all ancestor region codes above the user (parent, grandparent, etc.). Found by walking up in `getAncestorRegionCodes()`.
- `regionNames`: A lookup map of `code -> Name`.

---

## 3. Access Policy (`ROPDU`)

The `AccessPolicy` column lives in `APP.Resources`.
It is a 5-digit text code made of numbers from 0 to 7 (octal).

```
   R   O   P   D   U
   │   │   │   │   │
   │   │   │   │   └─ Up / Parent Privileges (Digit 5)
   │   │   │   └───── Down / Child Privileges (Digit 4)
   │   │   └───────── Peer Privileges (Digit 3)
   │   └───────────── Owner Privileges (Digit 2)
   └───────────────── Region Access Scope (Digit 1)
```

### 3.1 Digit 1: Region Scope (`R`)
Digit 1 (`R`) controls which region rows the user can see.
It is a bitmask:
- **Bit 0 (Value 1)**: `SAME` region (records with the user's exact region code).
- **Bit 1 (Value 2)**: `DOWN` regions (records in child/descendant regions).
- **Bit 2 (Value 4)**: `UP` regions (records in parent/ancestor regions).

You add the values together:
- `1`: Only SAME region.
- `3` (`1 + 2`): SAME + DOWN regions.
- `5` (`1 + 4`): SAME + UP regions.
- `7` (`1 + 2 + 4`): SAME + DOWN + UP regions.

> [!IMPORTANT]
> **Code Truth on Bit Weights**:
> In [`GAS/accessRegion.gs`](file:///f:/LITTLE%20LEAP/AQL/GAS/accessRegion.gs#L189-L191):
> ```javascript
> const r = parseInt(policy.charAt(0), 10) || 0;
> return { same: (r & 1) === 1, down: (r & 2) === 2, up: (r & 4) === 4 };
> ```
> This code is the true rule of the system:
> - Bit 1 (`+2`) gives `down` (children).
> - Bit 2 (`+4`) gives `up` (parents).
>
> *(Note: The Google Sheet dialog `accessPolicyManager.html` has labels that show Up as `+2` and Down as `+4`. The running backend uses `+2` for down and `+4` for up as written in `accessRegion.gs`).*

### 3.2 Digits 2 to 5 (`O`, `P`, `D`, `U`)
The other 4 digits declare row action privileges:
- **Digit 2 (`O`)**: Owner Privileges.
- **Digit 3 (`P`)**: Peer Privileges.
- **Digit 4 (`D`)**: Downline Privileges.
- **Digit 5 (`U`)**: Upline Privileges.

Each of these digits uses:
- `+1`: Execute
- `+2`: Update
- `+4`: Delete
- Total `7`: Execute + Update + Delete.

> [!NOTE]
> **Current Codebase Implementation Status**:
> The `O`, `P`, `D`, `U` digits of `AccessPolicy` are preserved in the 5-digit octal string for future upline/owner action privileges.
> The legacy `RecordAccessPolicy` column (`ALL`, `OWNER`, `OWNER_AND_UPLINE`) has been retired from `APP.Resources` in favor of `AccessPolicy` and `AccessRegionSource`.
> In the current backend engine, row read and write filtering in [`GAS/resourceApi.gs`](file:///f:/LITTLE%20LEAP/AQL/GAS/resourceApi.gs#L779-L784) checks `AccessRegion` and Digit 1 (`R`).

### 3.3 Default Policies by Scope
When the `AccessPolicy` cell in `APP.Resources` is blank, the resource takes its default policy based on its `Scope`:
- `master`: `77111` (Digit 1 = `7`: Same + Down + Up).
- `operation`: `37111` (Digit 1 = `3`: Same + Down).
- `accounts`: `37010` (Digit 1 = `3`: Same + Down).
- `view` / `report`: `71111` (Digit 1 = `7`: Same + Down + Up).

If you change a policy and it matches the scope default, the cell is saved as blank. If it is different, it is saved as text (with a single quote `'` in sheets) to keep any leading zero.

---

## 4. AccessRegionSource

The `AccessRegionSource` column in `APP.Resources` holds a JSON object.
It tells the system two things:
1. Where the record holds its region (`self`).
2. How to find the region if the record does not have one yet (`subject`).

```json
{
  "self": {
    "column": "AccessRegion",
    "resolve": false
  },
  "subject": [
    {
      "column": "OutletCode",
      "resource": "Outlets",
      "empty": "next",
      "fail": "user"
    },
    {
      "user": true
    }
  ]
}
```

### 4.1 The `self` Rule
`self` describes the record's own region field:
- `column`: The name of the column in this sheet (defaults to `'AccessRegion'`).
- `resolve`: A boolean flag (`true` or `false`).
  - `false` (default): The column holds a standard region code (like `UAE001`).
  - `true`: The column holds a **place name** (like `Dubai` or `Al Ain`).
    - **On read**: The system matches the place name to a region code using `nameToCodeMap`. If no code matches, access is blocked.
    - **On write**: The system skips auto-stamping (`applyAccessRegionOnWrite` stops). The column is filled by normal user input.

### 4.2 The `subject` Rule
`subject` is an ordered list of steps. The system tries each step one by one until it finds a region.

#### Step Type A: Sheet Lookups
```json
{
  "column": "OutletCode",
  "resource": "Outlets",
  "empty": "next",
  "fail": "user"
}
```
- `column`: The column on this incoming row that holds a code (like `OutletCode`).
- `resource`: The sheet to look in. If left blank, the system looks up the relation in `resourceConfig.relations[column]`.
- `empty`: What to do if this row has no value in `column`:
  - `'stop'` (default): Stop looking right away.
  - `'next'`: Skip this step and try the next subject step.
- `fail`: What to do if the target record does not exist or has no region:
  - `'user'`: Keep the user's region as a backup. Then move to the next step.
  - `"<column_name>"`: Jump back to an earlier subject step.

#### Step Type B: Current User Fallback
```json
{
  "user": true
}
```
This step takes the region code of the user who is saving the row. It returns that region code immediately.

---

## 5. How Incoming Rows Get Their Region (Write Flow)

When a row is created, updated, or saved in bulk, here is the exact path it follows.

```
Incoming Record Payload (from Frontend / Client)
          │
          ▼
buildNewResourceRow() / mergeMasterRow()
  - Extracts fields from payload
  - If the payload includes the region column, it is placed on the row!
          │
          ▼
applyAccessRegionOnWrite()
  - Is self.resolve === true?  ───► YES ──► STOP (Do not stamp code; place name kept)
          │ NO
  - Target column = self.column || 'AccessRegion'
  - Is cell already filled?    ───► YES ──► STOP (Incoming region accepted; skip fallback!)
          │ NO
          ▼
resolveAccessRegionOnWriteFallback()  (Safety Net Walk)
  - Get user's assigned region
  - Walk rule.subject steps:
      • If { user: true } ────────► Return user's region
      • If sheet lookup:
          Find referenced row
          Read target's region
          Found? ────────────────► Return target region code
          Lookup failed? ────────► Handle 'fail' rule
          Empty foreign key? ────► Handle 'empty' rule (stop or next)
          │
          ▼
Stamp row[targetColumn] = resolvedCode
(If no code found, leave blank => Row becomes Universe Record)
```

### 5.1 Frontend-First Setting & Server Fallback
AQL uses a **Frontend-First** region assignment pattern:
1. **Frontend sets the region**: Frontend composables and form logic know the user context, selected outlet, or warehouse. The frontend derives the region and sends it directly in the record payload.
2. **GAS accepts incoming values**: `buildNewResourceRow()` and `mergeMasterRow()` accept the incoming region.
3. **GAS skips expensive lookups**: When `applyAccessRegionOnWrite()` runs, it checks:
   ```javascript
   const existingVal = (row[colIndex] !== undefined && row[colIndex] !== null)
     ? row[colIndex].toString().trim()
     : '';
   if (existingVal !== '') return;
   ```
   Because `existingVal !== ''`, GAS **immediately returns** and skips all sheet opens, relation lookups, and subject walks. This makes writes fast.
4. **Safety Net**: If an incoming row does not have a region set (e.g., from an external script or third-party write), `applyAccessRegionOnWrite()` runs `resolveAccessRegionOnWriteFallback()` to safely derive the region from `AccessRegionSource` or user designation.

### 5.2 Where Write Stamping Happens in Code
In [`GAS/resourceApi.gs`](file:///f:/LITTLE%20LEAP/AQL/GAS/resourceApi.gs):
- `handleCreateResource` calls `applyAccessRegionOnWrite()` at line 338.
- `handleSaveCompositeResource` calls `applyAccessRegionOnWrite()` for parents (line 1703) and children (line 1811).
- `handleBulkSaveResource` calls `applyAccessRegionOnWrite()` at line 2190.
- `handleExecuteAction` calls `applyAccessRegionOnWrite()` for action targets at line 626 in [`GAS/actionTargets.gs`](file:///f:/LITTLE%20LEAP/AQL/GAS/actionTargets.gs#L626).
- `stockMovements.gs` calls it at line 98.
- `warehouseTransfers.gs` calls it at line 199.

### 5.3 On Record Updates
When an existing record is updated via `handleResourceUpdateRecord`:
1. `enforceRecordLevelAccess()` checks if the user is allowed to edit this row.
2. `mergeMasterRow()` applies incoming fields over the existing row.
3. If the update payload includes a new region, it is merged; if omitted, the existing row's region is preserved.


---

## 6. How Records Are Filtered on Read

When data is read from Google Sheets, the server checks each row before sending it to the client.

### 6.1 Read Filtering Flow
In [`GAS/resourceApi.gs`](file:///f:/LITTLE%20LEAP/AQL/GAS/resourceApi.gs#L709-L711):
```javascript
const filteredRows = rows.filter(function (row) {
  return canAccessRowByPolicy(auth, resource.config, row, idx, nameToCodeMap, scope);
});
```

Here is how `canAccessRowByAccessRegion()` checks a row:
1. **Find Region Header**: The system looks for `self.column` or `AccessRegion`. If neither exists, access is granted (`true`).
2. **Read Cell Value**:
   - If `self.resolve === true`: The cell holds a place name. It looks up the name in `nameToCodeMap`. If no region code matches that name, access is denied (`false`).
   - If `self.resolve === false`: The cell holds a region code.
3. **Blank Code Check**: If the record has no region code, it is a Universe Record. Access is granted (`true`).
4. **Universe User Check**: If the user has no region code, the user is a Universe User. Access is granted (`true`).
5. **Allowed Regions Check**: The system checks if `auth.regions[resourceName][recordRegionCode] === true`.
   - If `true`: The user can see the row.
   - If `false`: The row is dropped.

### 6.2 Single-Record Enforcements
If a user tries to read, update, or run an action on a specific record, `enforceRecordLevelAccess()` runs.
If `canAccessRowByPolicy()` returns `false`, it throws an immediate error:
`"Access denied by record-level policy"`.

This check guards:
- `handleFindResource` (finding a row by code).
- `handleUpdateResource` (updating a row).
- `handleSaveCompositeResource` (updating parent records).
- `handleExecuteAction` (running workflow buttons).
- `handleBulkSaveResource` (bulk updating rows).
- Action targets in [`GAS/actionTargets.gs`](file:///f:/LITTLE%20LEAP/AQL/GAS/actionTargets.gs#L660).

---

## 7. Frontend Integration

### 7.1 Login & Profile Payload
When a user logs in, the backend sends their profile in the auth response:
```json
{
  "user": {
    "id": "USR001",
    "name": "John Doe",
    "accessRegion": {
      "code": "UAE001",
      "isUniverse": false,
      "children": ["DXB001", "AUH001"],
      "parents": ["GLF001"],
      "regions": {
        "Outlets": { "UAE001": true, "DXB001": true, "AUH001": true },
        "Warehouses": { "UAE001": true }
      }
    }
  },
  "accessRegions": [
    { "code": "GLF001", "name": "Gulf", "parent": "" },
    { "code": "UAE001", "name": "UAE", "parent": "GLF001" },
    { "code": "DXB001", "name": "Dubai", "parent": "UAE001" }
  ]
}
```

### 7.2 Checking Region Access in Vue
Frontend components must never inspect Pinia stores directly.
Always use `useAuth()` from [`FRONTENT/src/composables/core/useAuth.js`](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/core/useAuth.js#L62):

```javascript
import { useAuth } from 'src/composables/core/useAuth'

const { user, hasRegionAccess } = useAuth()

// Check if current user can access a warehouse in Dubai:
const allowed = hasRegionAccess('DXB001', 'Warehouses')
```

How `hasRegionAccess(regionCode, resourceName)` works:
- Blank `regionCode` returns `true` (Universe record).
- If `user.accessRegion.isUniverse` is `true`, it returns `true`.
- Otherwise, it checks `user.accessRegion.regions[resourceName][regionCode] === true`.

### 7.3 List View Tokens
List view filters in `APP.Resources.ListViews` can use dynamic region tokens evaluated by [`FRONTENT/src/utils/tokenEvaluator.js`](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/utils/tokenEvaluator.js#L313-L329):
- `$userRegion`: Resolves to the user's assigned region code string (e.g. `'UAE001'`).
- `$userRegions`: Resolves to an array containing the user's region code (`['UAE001']`), meant for `in` / `not_in` operators.

### 7.4 Form Fields
`AccessRegion` is an audit column.
In [`FRONTENT/src/composables/resources/useFormFields.js`](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/resources/useFormFields.js#L23) and `useListStrategy.js`, `AccessRegion` is in `ignoredFields`. It is never shown as a text box in normal Add or Edit forms.

---

## 8. Google Sheets Admin Dialogs

All region and policy settings are managed through the Google Sheets toolbar under `AQL 🚀`.

| Menu Item | Dialog File | What it does |
|---|---|---|
| `AQL 🚀 > 🌍 Manage Access Regions` | `adminDialog.html` | Add or update region nodes. Sets `Code` (`AAA999`), `Name`, and `Parent`. Checks for duplicates and self-parenting. Clears region cache on save. |
| `AQL 🚀 > 📚 Resources > 🗺️ Manage Access Region Source` | `accessRegionSourceManager.html` | Interactive card builder for `AccessRegionSource` JSON. Configures Self Column, Value Type (Code vs Place Name), Subject Lookups, and Failure rules. |
| `AQL 🚀 > 📚 Resources > 🛡️ Manage Access Policy` | `accessPolicyManager.html` | Interactive card builder for 5-digit `ROPDU` octal string. Shows checkboxes for Same (+1), Up (+2), Down (+4), owner privileges, and scope inheritance badges. |
| `AQL 🚀 > 💼 Manage Designations` | `adminDialog.html` | Assigns an `AccessRegion` to a designation. Users with this designation inherit this region. |
| `AQL 🚀 > 👥 Manage Users` | `adminDialog.html` | Assigns a user to a `DesignationID`. |

---

## 9. Truth Reconciliation & Audit Table

Here is the exact truth comparing the codebase against older docs and dialogs:

| Topic | Old Document or Dialog Statement | Codebase Ultimate Truth | Status |
|---|---|---|---|
| **R Bit Weights** | `accessPolicyManager.html` shows Up as `+2` and Down as `+4`. | [`GAS/accessRegion.gs:190`](file:///f:/LITTLE%20LEAP/AQL/GAS/accessRegion.gs#L190): `down: (r & 2) === 2`, `up: (r & 4) === 4`. | Code is truth. Bit 1 (`+2`) is Down; Bit 2 (`+4`) is Up. |
| **ROPDU Letters** | `SHEET_TOOLBAR_MENU_GUIDE.md` had: "R: Read, O: Others read, P: Parent modify, D: Descendant modify, U: Universe modify". | Code and `accessPolicyManager.html`: `R`: Region, `O`: Owner, `P`: Peer, `D`: Downline, `U`: Upline. | Documentation error in old guide. Corrected and linked here. |
| **Designation Region** | `SHEET_APP_STRUCTURE.md` said: "the column exists... but nothing reads it yet". | [`GAS/accessRegion.gs:87-89`](file:///f:/LITTLE%20LEAP/AQL/GAS/accessRegion.gs#L87-L89): `resolveUserAccessRegionCode()` explicitly reads `desig.accessRegion`. | Active and fully working in code. Old doc was outdated. |
| **OPDU Row Filtering** | Some docs suggested row-level filtering by owner and upline on all operations. | [`GAS/resourceApi.gs:779-784`](file:///f:/LITTLE%20LEAP/AQL/GAS/resourceApi.gs#L779-L784): `canAccessRowByPolicy()` delegates only to `canAccessRowByAccessRegion()`. | Only region is enforced at row level today. Legacy `RecordAccessPolicy` column retired. |
| **AccessRegion on Write** | Older code had hardcoded `isRegionHeader('AccessRegion')` dropping incoming values. | `isRegionHeader` is removed. Incoming region in payloads is honored by `applyAccessRegionOnWrite()` (`existingVal !== ''`), skipping GAS fallback derivations. Fallback walk runs only when incoming region is blank. | Aligned with frontend-first architecture. |
| **Place Name Resolution** | None / Unclear. | If `self.resolve === true`, place name is mapped to region code on read using `nameToCodeMap`, and write-time stamping is skipped. | Fully implemented in `resourceApi.gs`. |

