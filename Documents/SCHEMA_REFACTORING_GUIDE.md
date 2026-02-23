# Schema Refactoring Guide

When changing the schema (columns/headers) of existing Master, Transaction, or App sheets, there is a built-in mechanism that allows for a "one-click" refactoring that safely repositions columns without data loss.

## How it works (The Refactor Operations)

In the `AQL` menu in the Google Sheet, under `Setup & Refactor`, you will find four options:
1. **Sync APP.Resources from Code**
2. **Refactor APP Sheets**
3. **Refactor MASTER Sheets**
4. **Refactor TRANSACTION Sheets**

### What does "Sync APP.Resources from Code" do?
The `APP.Resources` sheet dictates the overall architecture (what FileID a sheet belongs to, what Frontend columns it supports, Menu Groups, Code Prefixes, etc.). Now, there is an array in `GAS/syncAppResources.gs` which serves as the "source of truth". Clicking this ensures that any new modules or schema definitions created by developers are immediately pushed into the `APP.Resources` data matrix. Existing data (like custom FileIDs set by the user) is preserved safely.

### Backend Execution
When you click one of these buttons, the script will:
1. Loop through the configured schemas in the code (`setupMasterSheets.gs` or `setupTransactionSheets.gs`).
2. Backup all the existing data currently stored in the sheet into memory.
3. Automatically clear the sheet contents and recreate the columns in the exact order defined by the updated script.
4. Restore the backed-up data into the **new structure** by matching the exact column names (headers).
5. If a sheet does not exist yet, it simply creates it with the new schema.
6. Existing data under columns that are no longer defined mathematically drop off. Data added to new columns are initialized with null/defaults if configured.

This process ensures that column orders strictly match the code configuration and the data is safely rearranged instead of blindly deleted. Note: The script clears the sheet contents rather than deleting the sheet directly so that the sheet ID (GID) won't change, which avoids breaking external data links or filters.

---

## Modifying Frontend Along with Sheet Schema

Whenever a column is added or removed in the Google Apps Script (`setupMasterSheets.gs` or `setupTransactionSheets.gs`), corresponding changes must be made in the frontend to tell the Quasar UI to render that new column/field.

### Updating Frontend Configuration
To add the newly defined columns to the frontend:
1. Open the file `FRONTENT/src/config/masters.js` (for master entities) or `FRONTENT/src/config/transactions.js` (for transaction entities).
2. Locate the object matching the resource you modified.
3. Inside the `fields: [...]` array, add your new column configuration object.
   Example:
   ```javascript
   { header: 'NewColumnName', label: 'User Friendly Name', type: 'text', required: false }
   ```

### Workflow Summary for Schema Updates
1. **Update GS File**: Add/Remove columns in the `headers` array of `setupMasterSheets.gs` or `setupTransactionSheets.gs`.
2. **Run Refactor**: Go to Google Sheet menu `AQL` -> `Setup & Refactor` -> Select the correct Refactor button (e.g., Refactor MASTER Sheets).
3. **Update Frontend Config**: Open `FRONTENT/src/config/masters.js` or `transactions.js` and update the `fields` array.
4. **Test UI**: Hot-reload the frontend app to see the updated table and form fields correctly writing to & reading from the backend.
