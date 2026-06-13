# AQL Multi-Tenant System Architecture

This document defines the architecture, data flow, and deployment procedures for the AQL Multi-Tenant URL Routing System.

---

## 1. System Overview

The AQL Multi-Tenant System decouples the frontend Single Page Application (SPA) from a single hardcoded Google Apps Script URL. It enables a single static build of the frontend (e.g., hosted on Firebase Hosting) to dynamically route API traffic to the correct tenant's Google Sheet and Apps Script backend based on:
1. A URL query parameter (`?t=TENANT_CODE`).
2. Long-term local storage cache (`aql_tenant_url` and `aql_tenant_code`).
3. An onboarding selector page (`/select-tenant`) for users accessing the root URL directly.

---

## 2. Key Components

### A. The Master Database (`TENANTS` Google Sheet)
* **Maintainer**: Firose Hussain ([github.com/firumon](https://github.com/firumon))
* **Location**: Located in the Google Drive folder `AQL`.
* **Structure**: A Google Sheet named `TENANTS` containing two tabs:
  * **`Tenants`**: Maps tenant details (`Code`, `Name`).
  * **`URL`**: Maps tenant codes to their active deployed Google Apps Script Web App URLs (`Code`, `URL`, `Details`).
* **Onboarding Rule**: Adding a new tenant simply requires duplicating the template Google Sheet, deploying its script as a web app, and writing its code and URL to this master sheet. **No frontend code changes or redeployments are required.**

### B. The Master Router API (`MASTER/`)
A container-bound Apps Script project attached to the `TENANTS` spreadsheet. It serves as the public bootstrap resolver.
* **Script ID**: `1gWyoy-tvOBR61iopJEo2FPpKIme1B8tw-P9IemDTAbCRG9YfbP1-KXxz`
* **Web App Deployment URL**: `https://script.google.com/macros/s/AKfycbzf37M3i9UE3NfqprIbUCvX8oeKThVyK3qvoVv-KwFI_6JDnTY-_rjDsjINZyYZELdZ/exec`
* **Local Files**:
  * [MASTER/.clasp.json](file:///f:/LITTLE%20LEAP/AQL/MASTER/.clasp.json): Connects the local directory to the Master script ID.
  * [MASTER/appsscript.json](file:///f:/LITTLE%20LEAP/AQL/MASTER/appsscript.json): Manifest containing PWA configurations.
  * [MASTER/api.gs](file:///f:/LITTLE%20LEAP/AQL/MASTER/api.gs): Implements the `doPost(e)` function. It parses `{ action: "getTenantUrl", tenantCode: "CODE" }` and returns the raw text string containing the tenant's spreadsheet URL.

### C. The Tenant Wrapper Script Template (`TENANTS/`)
* **Location**: [TENANTS/tenant.gs](file:///f:/LITTLE%20LEAP/AQL/TENANTS/tenant.gs)
* **Purpose**: Serves as a ready-to-copy boilerplate script containing thin forwarder wrappers for all triggers (`onOpen`), API endpoints (`doPost`), toolbar menus, and `google.script.run` backend calls made by the HTML dialog files (like `actionManager`, `listViewsManager`, and `reportManager`).
* **Usage**: Onboard a new tenant, copy this exact script into their Apps Script Code.gs, and add `AqlCore` library dependency.
* **Registry & Deployment Automation**:
  * **[tenant_registry.json](file:///f:/LITTLE%20LEAP/AQL/TENANTS/tenant_registry.json)**: Stores maps of tenant keys to their container-bound Apps Script IDs.
  * **Deploy/Push Command**: To clasp push the wrapper code directly to any registered tenant:
    ```bash
    npm run tenant:push <TENANT_KEY>
    ```
    *(e.g., `npm run tenant:push TEMPLATE` pushes to the template container script).*
* **Synchronization & Maintenance Rule**: If any of the following 3 types of functions are added, removed, or changed in the core `GAS/` codebase, you MUST add or update the corresponding forwarding function in [TENANTS/tenant.gs](file:///f:/LITTLE%20LEAP/AQL/TENANTS/tenant.gs):
  1. **Spreadsheet Triggers**: Event hooks (like `onOpen`, `onEdit`, `onChange`) captured directly by the container script.
  2. **Custom Sheet Menu Callbacks**: Target function string names registered in [appMenu.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/appMenu.gs) (e.g. `showCreateUserDialog`).
  3. **HTML Dialog Callbacks (google.script.run targets)**: Functions called from container-bound HTML modal dialogs/sidebars. Browser clients cannot invoke library namespaces directly (e.g. `google.script.run.AqlCore.myFunc()` is invalid); they must invoke a local wrapper function in `tenant.gs` which forwards the call to the library.

### D. The Frontend Resolver (PWA)
* **[api.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/config/api.js)**: Configured to warn in development if `VITE_GAS_URL` is empty instead of throwing an error, allowing the static production build to compile without hardcoded URLs.
* **[axios.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/boot/axios.js) (Boot File)**:
  * Intercepts incoming page requests before Quasar initializes.
  * If a `?t=CODE` query parameter is found in the URL:
    * If `CODE` matches the cached tenant in `localStorage`, it strips the query parameter from the URL address bar using `window.history.replaceState` without reloading.
    * If `CODE` is different or missing from cache, it queries the `VITE_MASTER_GAS_URL` via a POST request, stores the returned tenant URL and code in `localStorage`, and strips the parameter.
  * If no `?t=` is found, it falls back to using the cached tenant URL from `localStorage` as the `apiClient.defaults.baseURL`.
* **[SelectTenantPage.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/pages/AuthPage/SelectTenantPage.vue)**: 
  * Renders a styled, responsive login-like screen showing the AQL logo and brief description.
  * Prompts the user to enter their tenant code manually if they visit the root URL with no query parameters and have no cached URL.
  * Submits the code, caches the resolved URL, and redirects them to the login flow.
* **[routes.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/router/routes.js) & [index.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/router/index.js)**: Registers the `/select-tenant` route and adds the router guard to redirect unauthenticated/uncached requests.

---

## 3. Deployment & Maintenance Rules

### ⚠️ Web App Access Reset Warning (CRITICAL)
Due to security constraints in the Google Apps Script API, deploying code using `clasp deploy --deploymentId <id>` (or `npm run master:deploy`) **automatically resets the Web App's access level to "Only myself"**, locking out public anonymous traffic.

#### Safe Production Update Workflow:
1. Run **`npm run master:push`** to push code modifications to Google's servers without altering the live Web App version.
2. Open the Apps Script editor:
   ```bash
   npm run master:open
   ```
3. In the browser editor, click **Deploy > Manage deployments**.
4. Select the deployment ID `AKfycbzf...` on the left and click **Edit (Pencil icon)**.
5. Select **Version: New version**, verify **Who has access** is set to **Anyone**, and click **Deploy**.

*If you accidentally deploy via CLI using `npm run master:deploy`, you must immediately open the editor (`npm run master:open`) and manually toggle the access level of the deployment back to "Anyone".*

### 👥 Tenant Onboarding Workflow
Whenever a new tenant is added, follow these steps to connect and configure their Apps Script project:

1. **Register the Script ID**: 
   - Open the new tenant's spreadsheet and click **Extensions > Apps Script** to open its container project.
   - Copy the project's **Script ID** (found in Project Settings / Gear icon).
   - Open **[TENANTS/tenant_registry.json](file:///f:/LITTLE%20LEAP/AQL/TENANTS/tenant_registry.json)** and add their tenant code and Script ID under the `tenants` object.
2. **Push the Wrapper**: 
   - Run the deployment script to clasp push [tenant.gs](file:///f:/LITTLE%20LEAP/AQL/TENANTS/tenant.gs) and the manifest into the new tenant project:
     ```bash
     npm run tenant:push <TENANT_CODE>
     ```
3. **Configure the Library Link**:
   - In the tenant's online Apps Script editor, click the **"+"** button next to **Libraries** in the left sidebar.
   - Paste the Master Apps Script ID: `1gWyoy-tvOBR61iopJEo2FPpKIme1B8tw-P9IemDTAbCRG9YfbP1-KXxz`.
   - Set the title exactly as **`AqlCore`**.
   - Select the latest available version from the dropdown. 
   - *Tip:* If a newly created Master version is missing from the list, **remove the AqlCore library entirely, re-paste the ID, and add it again** to force Google to clear its version list cache.
4. **Authorize the Script**:
   - In the editor's top toolbar, select the **`onOpen`** function from the dropdown list and click **Run**.
   - Accept Google's **Authorization Required** prompt to grant the script read/write permissions to the sheet.
   - Once execution completes, **refresh/reload** the Google Sheets browser tab to display the custom **AQL 🚀** menu.
5. **Deploy Web App & Register in TENANTS Master Sheet**:
   - Click **Deploy > New deployment**, select type **Web app**, configure it to execute as **Me** and set who has access to **Anyone**, then click **Deploy**.
   - Copy the Web App URL, open the master **`TENANTS`** spreadsheet, and in the **`URL`** tab add a new row with the tenant `Code`, Web App `URL`, and `Details`.

---

### 📦 Master Library Version Upgrades
Whenever a new version of the Master Apps Script Library (`AqlCore`) is deployed:
1. **Automated version query & deployment**: Running `npm run tenant:push` (or `node scripts/deploy-tenant.js`) will:
   - Run `npx clasp versions` on the `GAS/` project to query the latest deployed library version.
   - Automatically update the `"version"` field in `TENANTS/appsscript.json`.
   - Push the code wrapper and manifest to the registered tenant(s).
   - Automatically run `npx clasp deploy` to update the tenant's webapp deployment.
2. **Access Reset (CRITICAL)**: Command-line deployment resets the web app access permissions. You MUST open the Apps Script online editor for the deployed tenant, click **Deploy > Manage deployments**, edit the active webapp deployment, and change **Who has access** to **Anyone**, then deploy.
3. **Existing Tenants Update**: For already existing tenants where the library is included, sheet administrators should open their online Apps Script editor, click **Libraries > AqlCore**, change the version to the latest available version, and click **Save**. If the new version does not show up in the dropdown list, remove the `AqlCore` library entirely, re-paste the ID, and add it again to refresh the version list cache.


