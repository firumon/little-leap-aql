# New Client Setup Guide

This document outlines the step-by-step process for deploying a brand new instance of AQL for a new client (e.g., Loyal Promise). Everything can be done without touching code after the initial script copy.

## Prerequisites
- A Google Account for the client (preferably a shared/service workspace account).
- Node.js installed locally for building the frontend.

## Step 1: Create the Database Files
1. In the client's Google Drive, create **four new, empty Google Spreadsheets**:
   - `APP`
   - `MASTERS`
   - `OPERATIONS`
   - `REPORTS`
2. **Copy the File IDs** for `MASTERS`, `OPERATIONS`, and `REPORTS` from their URLs (the long string between `/d/` and `/edit`). You will need these shortly.

## Step 2: Establish the Codebase
1. Open the `APP` spreadsheet.
2. Go to **Extensions > Apps Script**.
3. Copy all `.gs` files from the repository's `GAS/` folder into this single Apps Script project. *(Alternatively, use `clasp push` if configured).*
4. Save the project and return to the `APP` spreadsheet. Refresh the page. You should now see an **AQL 🚀** menu at the top.

## Step 3: Initialize the APP Database
1. From the `APP` spreadsheet menu, click **AQL 🚀 > ⚙️ Setup & Refactor > Refactor APP Sheets**.
   - **What happens:** It creates the core structural sheets (`Users`, `AccessRegions`, `Designations`, `Roles`, `RolePermissions`). It also automatically generates the `Resources` sheet complete with all required configuration columns.
2. Accept the Google authorization prompts (first-time run only) and run it again if the prompt interrupts the process.

## Step 4: Configure Deployment Settings
1. Open the `Config` sheet in the APP spreadsheet (created automatically by Step 3).
2. Fill in the following values:
   - `CompanyName`: The client's company name (e.g., "Heilung Trading LLC")
   - `CompanyLogo`: URL to the client's logo image
   - `ContactEmail`: Client's primary contact email
   - `ContactPhone`: Client's primary contact phone
   - `MastersFileID`: Paste the MASTERS spreadsheet File ID from Step 1
   - `OperationsFileID`: Paste the OPERATIONS spreadsheet File ID from Step 1
   - `ReportsFileID`: Paste the REPORTS spreadsheet File ID from Step 1
   - `AccountsFileID`: (Optional) If using a separate ACCOUNTS file, paste its File ID

## Step 5: Link External Databases (Optional Override)
1. If specific resources need to point to a different file than the scope default configured in Step 4, open the `Resources` sheet.
2. Set the `FileID` column for those specific resource rows only.
3. Resources with an empty `FileID` will automatically use the scope-based file ID from the `Config` sheet.

## Step 6: Generate Data Sheets via Menu
Use the custom menu in the `APP` spreadsheet to generate all database tabs. Click these sequentially:
1. **AQL 🚀 > ⚙️ Setup & Refactor > Refactor MASTER Sheets**
2. **AQL 🚀 > ⚙️ Setup & Refactor > Operations > Setup All Operations**
3. **AQL 🚀 > ⚙️ Setup & Refactor > Accounts > Setup Base Accounts**

## Step 7: Initial Security & Role Seeding
1. Stay in the `APP` spreadsheet.
2. Click **AQL 🚀 > 🛡️ Roles > Inject Default Roles**.
   - **What happens:** It builds the default `Admin` role with full matrix access and adds an initial admin user to the `Users` sheet if one does not exist.
3. Open the `Users` sheet and verify your email is listed as an active user, mapped to the `Admin` RoleID.

## Step 8: Deploy the API
1. Go back to **Extensions > Apps Script**.
2. Click **Deploy > New deployment**.
3. Select type: **Web app**.
4. Description: `Initial Deployment [Client Name]`.
5. Run as: **Me** (the account owner).
6. Who has access: **Anyone** (the API secures endpoints via standard token policies, but the web endpoint must be publicly reachable).
7. Click Deploy and **Copy the Web App URL**.

## Step 9: Frontend Wiring
1. In your local repository's `FRONTENT/` directory, create or update an environment file (e.g., `.env.production`).
2. Set the API variable:
   ```env
   VITE_GAS_API_URL=https://script.google.com/macros/s/YOUR_WEB_APP_ID/exec
   ```
3. Run `npm run build` to compile the Vue/Quasar frontend.
4. Host the `dist/` payload on the client's preferred hosting platform (Firebase, Vercel, Netlify).
