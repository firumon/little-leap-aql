# New Client Setup Guide (Tenant Generation)

This guide covers the process for setting up and configuring spreadsheet files for a new tenant (client instance) using the automated generation menu.

---

## Step 1: Create Drive Folder
1. Create a new folder in Google Drive.
2. Name it with the company name (e.g., `Company Name`).
   > [!TIP]
   > Prefix the folder name with `AQL ` (e.g., `AQL Company Name`) if you are planning to transfer ownership of the folder later.
3. Open the folder and copy its **Folder ID** from the browser URL.

---

## Step 2: Generate Tenant Spreadsheets
1. Open the main Master/Admin generator spreadsheet (File ID: `1POS4HDCdwHtyaIWF_qGqn51V_pL9DeTRnBva_cLk4i0`).
2. Go to the menu **`AQL 🚀` > `GENERATE SPREADSHEET FOR NEW TENANT`**.
3. When prompted, paste the **Google Drive Folder ID** copied in Step 1 and click **OK**.
4. The script will automatically copy the `App` template and template files for `Views` and `Reports` (configuring their `Config` sheets with the appropriate `IMPORTRANGE` formula), and create new empty spreadsheets for `Master`, `Operations`, and `Accounts` in the target folder.

---

## Step 3: Authorize and Initialize the App Script
1. Open the newly copied **`App`** spreadsheet in the target folder.
2. Go to **Extensions > Apps Script** from the top menu.
3. In the Apps Script Editor, select **`onOpen`** from the function dropdown in the top toolbar and click **Run**.
4. When the "Authorization Required" dialog appears, click **Review Permissions**, select your Google account, click **Advanced** > **Go to App (unsafe)**, and grant the required permissions.
5. In the Apps Script editor, click the **Project Settings** (gear icon on the left sidebar). Under the **Script Properties** section, click **Add script property** and add:
   - **Property**: `APP_FILE_ID`
   - **Value**: The file ID of this newly copied `App` spreadsheet itself (you can copy it from the spreadsheet URL or from the success dialog shown in Step 2).
6. Once the script execution completes, **reload/refresh** the `App` spreadsheet browser tab. The **`AQL 🚀`** custom menu should now appear in the menu bar.

---

## Step 4: Refactor App Control Sheets
1. In the `App` spreadsheet, click the menu **`AQL 🚀` > `⚙️ Setup & Refactor` > `Refactor APP Sheets`**.
2. This creates the required APP control sheets (such as `Config`, `Resources`, `Metadata`, etc.) and automatically syncs resource metadata from code.

---

## Step 5: Configure Spreadsheet File IDs & Settings
1. Open the **`Config`** sheet in the `App` spreadsheet.
2. Update the values with the correct file IDs and client details:
   - **`MasterFileID`**: Paste the ID of the generated `Master` spreadsheet.
   - **`OperationFileID`**: Paste the ID of the generated `Operations` spreadsheet.
   - **`AccountsFileID`**: Paste the ID of the generated `Accounts` spreadsheet.
   - Other branding settings (e.g., `CompanyName`, `CompanyLogo`, `Currency`, etc.).
   
3. **Advanced Resource Routing**:
   - If any specific resource (e.g., a particular sheet or tab) needs to reside in a separate spreadsheet file instead of the default scoped file:
     1. Create that spreadsheet file or copy an existing one.
     2. Copy its File ID.
     3. Paste the File ID into the **`FileID`** column of the corresponding row in the **`Resources`** sheet.
     4. If this file ID is also required to be imported into `Views` or `Reports`, add it as a new config entry in the `Config` sheet (e.g., `OutletFileID` => `<FileID>`).
   - *Note:* If the **`FileID`** column in the `Resources` sheet is left empty, the resource will automatically fall back to the scope's default file ID (e.g. `MasterFileID`) defined in the `Config` sheet.

---

## Step 6: Generate Scoped Sheets
In the `App` spreadsheet menu, execute the following setup actions in order:
1. **`AQL 🚀` > `⚙️ Setup & Refactor` > `Refactor MASTER Sheets`**
2. **`AQL 🚀` > `⚙️ Setup & Refactor` > `Setup All Operations`**
3. **`AQL 🚀` > `⚙️ Setup & Refactor` > `Setup Base Accounts`**

This will automatically create all the normalized sheets and apply formatting, schemas, data validations, and protections in the respective target spreadsheets.

---

## Step 7: Populate Data and Add Users
1. Populate the master data sheets (such as `Products`, `SKUs`, etc.) in the `Master` spreadsheet.
2. Add initial system users by going to **`AQL 🚀` > `👥 Users` > `Create User`** from the `App` spreadsheet menu to register designations and access roles.

---

## Step 8: Deploy Apps Script as Web App & Register Tenant URL

> [!IMPORTANT]
> **Pre-deployment Checklist**:
> Before executing the deployment, ensure:
> 1. All target spreadsheets (Master, Operations, Accounts, Views, Reports) are fully initialized and formatted (Step 6).
> 2. The `APP_FILE_ID` Script Property has been set inside Apps Script Project Settings (Step 3).
> 3. The `Config` sheet values are correct, and initial system designations and users have been registered (Step 5 & Step 7).
>
> Once all target sheets are successfully created, populated, and configured:
1. In the **`App`** spreadsheet, open **Extensions > Apps Script**.
2. Click **Deploy > New deployment** in the top-right corner.
3. Click the gear icon next to "Select type" and select **Web app**.
4. Set the configurations:
   - **Description**: E.g., `Production Deploy`
   - **Execute as**: `Me (your admin email)`
   - **Who has access**: `Anyone`
5. Click **Deploy**. Copy the generated **Web App URL**.
6. Open the central **`TENANTS`** Master spreadsheet.
7. Go to the **`URL`** tab and add a new row containing:
   - **`Code`**: The tenant code (e.g., `NEWCO`).
   - **`URL`**: The copied Web App URL.
   - **`Details`**: E.g., Company name or details.

---

## Maintenance & Library Upgrades (Existing Tenants)
Whenever a new version of the standalone `AqlCore` script library is deployed:
1. **Pushing Code Updates**: Run `npm run gas:push` to deploy local workspace changes to both `AQL` (dev sheet) and `AqlCore` (standalone library). Once pushed to `AqlCore`, publish a new version of the library.
2. **Automated Manifest Update & Deployment**: Running `npm run tenant:push` (or `node scripts/deploy-tenant.js`) will:
   - Query the latest version of the `AqlCore` library (Script ID: `1qTNMNpdGwfF3zr-53KqWtM5ibM2bblHiHBIIwB3aJtX3k-82jMLmIiPg`).
   - Automatically update both `"version"` and `"libraryId"` fields in `TENANTS/appsscript.json` (setting `developmentMode` to `false`).
   - Push and deploy the new wrapper to the specified tenant(s).
3. **Update Access Permissions (CRITICAL)**: Because Apps Script resets web app access settings on command-line deployment, you MUST open the tenant's online script editor (using `clasp open` or Extensions > Apps Script) and change **Who has access** to **Anyone**.
4. **Existing Tenants Update**: For already existing tenants where the library is included, sheet administrators should open their online Apps Script editor, click **Libraries > AqlCore**, change the version to the latest available version, ensure **Development mode** is set to **OFF** (false), and click **Save**. If the new version does not show up in the dropdown list, remove the `AqlCore` library entirely, re-paste the ID (`1qTNMNpdGwfF3zr-53KqWtM5ibM2bblHiHBIIwB3aJtX3k-82jMLmIiPg`), and add it again to refresh the version list cache.

