# New Client Setup Guide

## Purpose
This guide covers the current recommended process for setting up a new AQL client instance.

## Prerequisites
- Google account/workspace for the client
- Local access to this repository
- `clasp` configured for GAS deployment

## Setup Flow

### Step 1: Create Spreadsheet Files
Create the required spreadsheets:
- `APP`
- `MASTERS`
- `OPERATIONS`
- `REPORTS`
- optional separate `ACCOUNTS`

Collect their file IDs for config setup.

### Step 2: Connect the APP Script Project
1. Open the `APP` spreadsheet and create/open its Apps Script project.
2. Copy the Script ID.
3. Create a client-specific `GAS/clasp-configs/{client-name}.clasp.json`.
4. Point `GAS/.clasp.json` to that client config.
5. Run `cd GAS && clasp push`.

This is the preferred setup path. Manual copy-paste is not the standard deployment workflow.

### Step 3: Initialize APP Structure
From the APP spreadsheet, run the setup/refactor menu actions needed to create APP control sheets and sync resource metadata.

### Step 4: Configure APP Settings
Populate the `Config` sheet with:
- company branding/contact values
- file IDs for MASTER / OPERATION / REPORT / ACCOUNTS scopes
- sync TTL settings

### Step 5: Validate Resolution
Validate that resource/file resolution works correctly after config is filled.

### Step 6: Generate Target Sheets
Run the relevant setup/refactor actions to create or refactor master, operation, and accounts sheets.

### Step 7: Seed Security and Access
Create or inject initial roles and ensure an admin user exists with the right access.

### Step 8: Deploy API
Create a Web App deployment for the APP Apps Script project and capture the Web App URL.

### Step 9: Wire Frontend
Set the frontend environment to the deployed GAS Web App URL and build/deploy the frontend as needed.

## Canonical Detail Owners
- APP structure: [APP_SHEET_STRUCTURE.md](F:/LITTLE%20LEAP/AQL/Documents/APP_SHEET_STRUCTURE.md)
- Resource/runtime config: [RESOURCE_REGISTRY_ARCHITECTURE.md](F:/LITTLE%20LEAP/AQL/Documents/RESOURCE_REGISTRY_ARCHITECTURE.md)
- Schema refactor flow: [SCHEMA_REFACTORING_GUIDE.md](F:/LITTLE%20LEAP/AQL/Documents/SCHEMA_REFACTORING_GUIDE.md)

## Maintenance Rule
Update this file when:
- the preferred setup/deployment flow changes
- required setup steps or prerequisites change
- config keys or deployment expectations change materially
