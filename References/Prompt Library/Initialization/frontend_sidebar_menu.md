# AQL Frontend Sidebar Menu & Access Control

Use this document to initialize an AI agent session when the task involves modifying, adding, deleting, ordering, or changing permission gates for the web application's sidebar menu.

---

## 1. Role Boundaries (Mandatory)

Before proceeding, read and follow the role boundaries defined in [MULTI_AGENT_PROTOCOL.md](file:///f:/LITTLE%20LEAP/AQL/Documents/MULTI_AGENT_PROTOCOL.md). Your default role is `Guide Agent`. To execute sidebar menu changes, you must be in the `Solo Agent` or `Build Agent` role — state the role switch briefly to the user.

---

## 2. System Architecture & Coordination

The AQL Web App sidebar menu is dynamically generated from metadata configured in `APP.Resources` in the Google Sheet. The runtime frontend application fetches this resource list during the login sequence, filters it by the user's role permissions, structures it into a nested group tree, and renders it recursively.

### A. Core File Coordinates
* **Backend Default Config**: Programmed in `initAppResourcesCodeConfig()` within [syncAppResources.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/syncAppResources.gs).
* **Metadata Parser**: Converts sheet rows into outbound JSON payloads in [resourceRegistry.gs:L94-L116](file:///f:/LITTLE%20LEAP/AQL/GAS/resourceRegistry.gs#L94-L116) and [L550-L553](file:///f:/LITTLE%20LEAP/AQL/GAS/resourceRegistry.gs#L550-L553).
* **Frontend Nav Tree Composables**:
  * [useMainLayoutNavTree.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/layout/useMainLayoutNavTree.js): Groups resource items into parent-child paths and sorts them.
  * [useMenuAccess.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/layout/useMenuAccess.js): Handles permission gating check algorithms.
* **Sidebar Renderer**: Recursively draws folders/leaves in [MenuTreeNode.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/MenuTreeNode.vue).

---

## 3. Mandatory Pre-Reads (With Line-Level Links)

Before writing any code related to the sidebar menu:
* Read menu payload parsing: [resourceRegistry.gs:L94-L116](file:///f:/LITTLE%20LEAP/AQL/GAS/resourceRegistry.gs#L94-L116)
* Read navigation tree generation: [useMainLayoutNavTree.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/layout/useMainLayoutNavTree.js#L48-L117)
* Read permission check algorithms: [useMenuAccess.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/layout/useMenuAccess.js#L47-L81)
* Read the admin menu structure: [Documents/AQL_MENU_ADMIN_GUIDE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/AQL_MENU_ADMIN_GUIDE.md)

---

## 4. Data Flow & Schema Matrix

### A. Metadata Schema (Menu JSON)
Each entry in the `Menu` JSON column inside `APP.Resources` has the following schema:
```json
{
  "group": ["NestingGroup1", "NestingGroup2"], // Array of strings (e.g. ["Warehouse"] or ["Operations", "Warehouse"])
  "order": 1,                                  // Number sorting priority (lower = appears higher)
  "label": "Display Text",                     // Text rendered on sidebar (falls back to Resource Name)
  "icon": "inventory_2",                       // Material icon name (falls back to list_alt)
  "route": "/masters/products",                 // Route endpoint mapping
  "show": true,                                // Boolean toggle visibility
  "menuAccess": {                              // Permission gate object
    "require": "canWrite",                     // Case 1: single required permission
    "all": [                                   // Case 2: all conditions must pass
      { "resource": "Products", "require": "canRead" }
    ],
    "any": [                                   // Case 3: any conditions can pass
      { "resource": "Products", "require": "canWrite" }
    ]
  }
}
```

### B. Tree-Packing & Sorting Pipeline
1. `useMainLayoutNavTree` pulls authorized resources from the logged-in user's Pinia state (`authStore.resources`).
2. Iterates through the `ui.menus` list of each resource.
3. Skips menus where `show === false` or `route` is invalid.
4. Executes `evaluateMenuAccess()` to verify if user permissions permit access.
5. Splits the menu's `group` array into segments and builds folder objects (`type: 'group'`) recursively, placing link items (`type: 'leaf'`) as children.
6. Sorts child items within each group by their `order` value, falling back to an alphabetical comparison of labels.
7. Groups dynamically inherit the minimum `order` value of their children to determine the sorting sequence of groups.

---

## 5. Step-by-Step Implementation Checklist

Follow these steps when adding, removing, or modifying sidebar menu items:

### Step 1: Impact Analysis & Code Discovery
1. **Target Config Identification**: Search `GAS/syncAppResources.gs` for the target resource config under `APP_RESOURCES_CODE_CONFIG`.
2. **Review Group Ordering**: Reference the taxonomy section in [AQL_MENU_ADMIN_GUIDE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/AQL_MENU_ADMIN_GUIDE.md) to check existing order values for the target group (e.g. Procurement order 6 -> PO, 7 -> PO Receiving, 8 -> Goods Receipts) and choose a sequence number that fits.
3. **Route Validation**: Search `FRONTENT/src/router/routes.js` to ensure the route matching the `Menu.route` parameter exists and resolves to the correct page resolver.

### Step 2: Backend Menu Configuration Updates
1. Modify the `Menu` JSON string within the resource definition inside `GAS/syncAppResources.gs`.
2. Ensure that group names, icon parameters, and path targets are correctly structured.
3. If custom gating logic is required, configure the `menuAccess` property structure (using `require`, `all`, or `any` keys).

### Step 3: Frontend Gating & Navigation Verification
1. If the route definition changed, update the router mappings.
2. If introducing custom permission fields, ensure the checks in [useMenuAccess.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/layout/useMenuAccess.js) handle the new permission payload property safely.

---

## 6. Explicit Guardrails (DOs and DO NOTs)

* **DO NOT** hardcode sidebar navigation paths, groups, labels, or icons directly in the Vue templates of page files.
* **DO NOT** bypass `useMenuAccess` checks. The route guards and sidebar generation must evaluate permissions dynamically.
* **DO NOT** omit the `menuAccess` property on administrative actions; default back to `canRead` on the current resource if absent.
* **DO** verify that the spelling and casing of permissions in `menuAccess` (e.g. `canRead`, `canWrite`) match user role permissions.
* **DO** keep the sorting orders aligned with the business-taxonomy hierarchy.

---

## 7. Targeted Verification Plan

### A. Code Deployment
Push the modified configuration block to the Apps Script project:
`npm run gas:push` (or `cd GAS && clasp push`)

### B. Sheets Propagation Order (Instruct the User)
Instruct the user to run the following sheet operations from the `AQL 🚀` menu to apply the menu updates:
1. **Sync resources**: Run `AQL 🚀 > 🔄 Sync & Cache > Sync APP.Resources from Code` (saves updated menu configuration structures to the `APP.Resources` sheet).
2. **Refresh cache**: Run `AQL 🚀 > 🔄 Sync & Cache > Regenerate App Cache` (warmed up values are written to script properties).
3. **Re-login**: Log out and log back into the web client.

### C. Manual Runtime Testing
1. Verify that the new menu option renders in the sidebar under the correct folder.
2. Verify that clicking the menu item navigates to the target page without throwing routing errors.
3. Log in with a role that lacks the required permissions (e.g., Operator role trying to see Admin configuration) and verify that the menu item is hidden.
