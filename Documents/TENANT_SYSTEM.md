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
* **Onboarding Rule**: Adding a new tenant simply requires duplicating the template Google Sheet (`__tenant_app__`), deploying its script as a web app, and writing its code and URL to this master sheet. **No frontend code changes or redeployments are required.**

### B. The Master Router API (`MASTER/`)
A container-bound Apps Script project attached to the `TENANTS` spreadsheet. It serves as the public bootstrap resolver.
* **Script ID**: `1gWyoy-tvOBR61iopJEo2FPpKIme1B8tw-P9IemDTAbCRG9YfbP1-KXxz`
* **Web App Deployment URL**: `https://script.google.com/macros/s/AKfycbzf37M3i9UE3NfqprIbUCvX8oeKThVyK3qvoVv-KwFI_6JDnTY-_rjDsjINZyYZELdZ/exec`
* **Local Files**:
  * [MASTER/.clasp.json](file:///f:/LITTLE%20LEAP/AQL/MASTER/.clasp.json): Connects the local directory to the Master script ID.
  * [MASTER/appsscript.json](file:///f:/LITTLE%20LEAP/AQL/MASTER/appsscript.json): Manifest containing PWA configurations.
  * [MASTER/api.gs](file:///f:/LITTLE%20LEAP/AQL/MASTER/api.gs): Implements the `doPost(e)` function. It parses `{ action: "getTenantUrl", tenantCode: "CODE" }` and returns the raw text string containing the tenant's spreadsheet URL.

### C. The Standalone Shared Library (`AqlCore`)
A standalone Apps Script project containing the core codebase, database models, sheet layouts, triggers, and menu definitions. All tenant spreadsheets import this project as a library under the namespace `AqlCore`.
* **Script ID**: `1qTNMNpdGwfF3zr-53KqWtM5ibM2bblHiHBIIwB3aJtX3k-82jMLmIiPg`

### D. The Development Script (`AQL`)
A container-bound Apps Script project attached to the development `App` spreadsheet. Used for quick iteration and verification during development.
* **Script ID**: `1sTCRkDJ--z23c0QrF3WuPr94EfktHYdohs_E0zVHpDAfwCW7N0vTL42n`

### E. The Tenant Wrapper Script Template (`TENANTS/` / `__tenant_app__`)
* **Location**: [TENANTS/tenant.gs](file:///f:/LITTLE%20LEAP/AQL/TENANTS/tenant.gs)
* **Purpose**: Serves as a ready-to-copy boilerplate script containing thin forwarder wrappers for all triggers (`onOpen`), API endpoints (`doPost`), toolbar menus, and `google.script.run` backend calls. The template spreadsheet (`__tenant_app__`) has this script pre-bound and configured to reference `AqlCore` as a library with `developmentMode: false`.
* **Registry & Deployment Automation**:
  * **Live Central Sheet**: Project IDs and Deployment IDs are dynamically retrieved in real-time from the master **`Tenants`** spreadsheet tab via the Master API.
  * **Commands**:
    * `npm run tenant:push`: Pushes `tenant.gs` to all tenants.
    * `npm run tenant:update-libs`: Automatically updates the `AqlCore` library version and pushes to all tenants (without resetting web app permissions).
    * `npm run tenant:deploy`: Deploys new web app versions for all tenants.
    *(e.g., `node scripts/tenant.js push LPAJAEGCC` pushes to a single tenant).*
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
Whenever a new tenant is added, follow these steps to connect and configure their Apps Script project. Note that the template spreadsheet (`__tenant_app__`) already contains the pre-bound wrapper script and the correct library configuration, so pushing the wrapper or adding the tenant to the local registry is not required during the initial setup phase.

1. **Authorize the Script**:
   - Open the newly copied tenant `App` spreadsheet.
   - Click **Extensions > Apps Script** to open its container project.
   - In the editor's top toolbar, select the **`onOpen`** function from the dropdown list and click **Run**.
   - Accept Google's **Authorization Required** prompt to grant the script read/write permissions to the sheet.
   - Once execution completes, **refresh/reload** the Google Sheets browser tab to display the custom **AQL 🚀** menu.
2. **Set the `APP_FILE_ID` Script Property**:
   - In the Apps Script editor, click **Project Settings** (gear icon on the left sidebar).
   - Under the **Script Properties** section, click **Add script property**.
   - Add property `APP_FILE_ID` with the value set to the spreadsheet ID of the tenant's new `App` file itself.
3. **Initialize Sheets & Config**:
   - In the `App` spreadsheet, click the menu **`AQL 🚀` > `⚙️ Setup & Refactor` > `Refactor APP Sheets`**.
   - Open the **`Config`** sheet and paste the generated File IDs (`MasterFileID`, `OperationFileID`, `AccountsFileID`).
   - Run the setup menus: **`Refactor MASTER Sheets`**, **`Setup All operation`**, and **`Setup Base Accounts`** to format the database files.
4. **Deploy Web App**:
   - In the Apps Script editor, click **Deploy > New deployment**, select type **Web app**.
   - Configure it to execute as **Me (your admin email)** and set who has access to **Anyone**, then click **Deploy**.
   - Copy the generated Web App URL.
5. **Register in TENANTS Master Sheet**:
   - Open the central **`TENANTS`** master spreadsheet.
   - In the **`Tenants`** tab, add a new row with `Code`, `Name`, `Detail`, `Project ID` (Script ID), and `Deployment ID`.
   - Automation scripts (`npm run tenant:push`, `npm run tenant:update-libs`) automatically fetch live project IDs from the Master sheet API. No local registry file editing is required.

---

### 📦 AqlCore Library Version Upgrades
Whenever you update code in the local workspace:
1. **Dual Pushing**: Run `npm run gas:push` (which runs `scripts/push-gas.js`). This automatically pushes workspace code to **both** `AQL` (development app) and `AqlCore` (standalone library).
2. **Publish New Library Version**: After pushing to `AqlCore`, publish a new version of the library in the Google Apps Script Web Editor for `AqlCore` (Deploy > Manage deployments > Edit > New version).
3. **Safe Automated Library Upgrade**: Run `npm run tenant:update-libs` to:
   - Query `clasp versions` for the latest version number of `AqlCore`.
   - Update `"version"` in `TENANTS/appsscript.json` (setting `developmentMode` to `false`).
   - Fetch live tenant list from the Master sheet and push the updated manifest to all tenants without redeploying (preserving "Anyone" web app access permissions).
4. **Web App Redeployment (If Needed)**: Run `npm run tenant:deploy` only when a full Web App redeployment is required. Because Apps Script resets web app access settings on CLI deployment, you must open the tenant's online script editor and ensure **Who has access** is set to **Anyone**.

