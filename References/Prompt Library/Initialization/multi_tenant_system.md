# Initialization: Multi-Tenant System & Routing

> **Scope boundary**: This document covers investigations, modifications, or deployments related to the dynamic multi-tenant system, the Master Apps Script project, and the frontend tenant-URL routing boot process. Self-contained — load only when query involves tenant mapping, master sheet lookup, or PWA boot configuration.

Use this instruction when the user's query is about:
1. Dynamic tenant URL lookup, browser cache management, or the `/select-tenant` page.
2. The central `TENANTS` Google Sheet, adding new tenants, or editing tenant mappings.
3. The `MASTER/` directory code, `MASTER/api.gs`, or deployment configurations for the Master script.
4. Handling `VITE_MASTER_GAS_URL` in `.env` or configuring Axios base URL at boot.

---

## 1. System Architecture Overview

The multi-tenant architecture dynamically resolves the correct tenant backend Apps Script URL at boot time:

```
[Browser Client]
  ├── 1. Reads ?t=TenantCode or localStorage cache
  ├── 2. If missing, redirects to /select-tenant
  ├── 3. Submits code -> queries Master Apps Script URL via POST
  ├── 4. Master GAS reads attached Google Sheet "TENANTS", URL tab
  ├── 5. Master GAS returns the raw text tenant URL
  ├── 6. Client caches URL & Code in localStorage, and cleans the URL bar
  └── 7. Client sets baseURL on axios and redirects to login/dashboard
```

---

## 2. Core Repository Files

When modifying or investigating, inspect these files:
* **Frontend Boot & Router**:
  * [axios.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/boot/axios.js): Handles query parameter lookup, `localStorage` caching, and URL cleansing.
  * [api.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/config/api.js): Warns instead of throws if build-time `VITE_GAS_URL` is empty.
  * [routes.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/router/routes.js): Registers the `/select-tenant` route.
  * [index.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/router/index.js): Redirects requests lacking cached URLs to `/select-tenant`.
  * [SelectTenantPage.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/pages/AuthPage/SelectTenantPage.vue): Manual entry page for tenant code.
* **Master Backend Scripts**:
  * [api.gs](file:///f:/LITTLE%20LEAP/AQL/MASTER/api.gs): Master `doPost(e)` action for tenant-to-url resolution.
  * [appsscript.json](file:///f:/LITTLE%20LEAP/AQL/MASTER/appsscript.json): Master Apps Script manifest.
  * [.clasp.json](file:///f:/LITTLE%20LEAP/AQL/MASTER/.clasp.json): Master script ID association.
* **Deployment & Setup**:
  * [deploy-master-gas.js](file:///f:/LITTLE%20LEAP/AQL/scripts/deploy-master-gas.js): Reads `.env` for `VITE_MASTER_GAS_URL` and redeploys to that ID.
  * [package.json](file:///f:/LITTLE%20LEAP/AQL/package.json): Defines script commands for master management.
* **Tenant Wrapper Script**:
  * [tenant.gs](file:///f:/LITTLE%20LEAP/AQL/TENANTS/tenant.gs): Boilerplate wrapper script template containing forwarding wrappers for all triggers, custom sheet menu callbacks, and HTML dialog functions.

---

## 3. Wrapper Script Template Sync Rules

When editing functions inside the core `GAS/` codebase, you MUST update [tenant.gs](file:///f:/LITTLE%20LEAP/AQL/TENANTS/tenant.gs) if modifications affect any of these 3 public-facing function types:
1. **Spreadsheet Triggers**: Event hooks (like `onOpen`, `onEdit`, `onChange`) captured directly by the container script.
2. **Custom Sheet Menu Callbacks**: Target function string names registered in [appMenu.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/appMenu.gs) (e.g. `showCreateUserDialog`).
3. **HTML Dialog Callbacks (google.script.run targets)**: Functions called from container-bound HTML modal dialogs/sidebars. Browser clients cannot invoke library namespaces directly (e.g. `google.script.run.AqlCore.myFunc()` is invalid); they must invoke a local wrapper function in `tenant.gs` which forwards the call to the library.

---

## 4. Tenant Onboarding & Library Upgrades

* **Adding a New Tenant**: 
  1. Add their tenant code and Apps Script ID to **[tenant_registry.json](file:///f:/LITTLE%20LEAP/AQL/TENANTS/tenant_registry.json)**.
  2. Push the wrapper template specifically to them: `node scripts/deploy-tenant.js <TENANT_CODE>` (or `npm run tenant:push <TENANT_CODE>`).
  3. In the Apps Script web editor, add library `AqlCore` (ID: `1gWyoy-tvOBR61iopJEo2FPpKIme1B8tw-P9IemDTAbCRG9YfbP1-KXxz`) and select the latest version.
  4. Select `onOpen` function and click **Run** to authorize the script permissions. Refresh the Google Sheet browser tab to display the menu.
  5. *Cache Refresh Tip:* If a newly published Master library version does not appear, remove the `AqlCore` library entirely, re-paste the ID, and add it again to refresh Google's version list cache.
* **Upgrading Master Library Version**:
  1. Update `"version": "NEW_VERSION"` inside **[appsscript.json](file:///f:/LITTLE%20LEAP/AQL/TENANTS/appsscript.json)**.
  2. Push wrapper changes to all tenants: `npm run tenant:push`.
  3. Instruct sheet administrators to select the latest library version within their Apps Script editors (under Libraries > AqlCore) for their live sheets to execute the latest code.
  4. *Tip:* If the latest version does not show, instruct them to remove and re-add the library.
  5. **Step-by-Step Spreadsheet Setup**: For full instructions on folder creation, generating spreadsheets using the menu, setting up configuration/file IDs, routing custom resources, and running refactoring scripts, see the [New Client Setup Guide](file:///f:/LITTLE%20LEAP/AQL/Documents/NEW_CLIENT_SETUP_GUIDE.md).

---

## 5. Deployment & Permission Rules (STRICT)

> [!WARNING]
> **API Deployment Permission Reset**: 
> Running `npx clasp deploy` or `npm run master:deploy` automatically resets the Google Apps Script Web App's access permissions to **"Only myself"** (due to Google API security restrictions).

### Safe Pushing Rule
To update the Master script without resetting the access settings:
1. Run `npm run master:push` to push the local code modifications to the project.
2. Visit the online Apps Script IDE (`npm run master:open`).
3. Click **Deploy > Manage deployments**, click **Edit (Pencil)** on the deployment `AKfycbzf...`, choose **New version**, ensure access is **Anyone**, and click **Deploy**.

If you run `npm run master:deploy`, you must immediately instruct the user to open the online IDE and manually change the access level back to **Anyone**.

---

## 6. Key CLI Commands

* **Push Master changes**: `npm run master:push`
* **Deploy/Update Master version**: `npm run master:deploy`
* **Open Master IDE**: `npm run master:open`
* **Push Wrapper to Tenant**: `npm run tenant:push <TENANT_KEY>` (e.g. `npm run tenant:push TEMPLATE` or `npm run tenant:push DEMO`)
