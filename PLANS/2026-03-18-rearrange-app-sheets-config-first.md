# Plan: Rearrange APP Sheets to make Config First

Move the `CONFIG` sheet configuration to the first position in the `setupAppSheets.gs` script to ensure it's the first sheet created and positioned in the APP spreadsheet.

- Created By: Solo Agent (Antigravity)
- Executed By: Solo Agent (Antigravity)

## Proposed Changes

### GAS Backend

#### [MODIFY] [setupAppSheets.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/setupAppSheets.gs)
- Move the `CONFIG` sheet configuration object from the end of the `sheetConfigs` array to the beginning.
- This will cause `setupAppSheets` to create/update the `Config` sheet first and move it to index 1 (the first sheet tab).

## Verification Plan

### Automated Tests
- Run `cd GAS && clasp push` to deploy the changes.
- Since we cannot programmatically verify the sheet order in the UI from here, we will rely on code review and successful deployment.

### Manual Verification
- Ask the user to run the `AQL 🚀 > Setup & Refactor` menu action in the APP spreadsheet.
- Verify that the `Config` sheet is now the first tab (leftmost).
