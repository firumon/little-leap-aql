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

### C. The Frontend Resolver (PWA)
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
