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

---

## 3. Deployment & Permission Rules (STRICT)

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

## 4. Key CLI Commands

* **Push Master changes**: `npm run master:push`
* **Deploy/Update Master version**: `npm run master:deploy`
* **Open Master IDE**: `npm run master:open`
