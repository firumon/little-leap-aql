# ACCOUNTS Sheet Structure

## Purpose
This document describes the accounts-related sheet families and their roles.

## Current Accounts Resources
- `ChartOfAccounts`
- `EntryTemplates`
- `Assets`
- `Liabilities`
- `Equity`
- `Revenue`
- `Expenses`

## Structural Expectations
- account/classification sheets define accounting structure
- ledger sheets store account-scope records according to current setup/runtime behavior
- standard 5 audit columns on audited sheets: `CreatedAt`, `UpdatedAt`, `Revision`, `CreatedBy`, `UpdatedBy`

## Maintenance Rule
Update this file when:
- an accounts sheet is added, removed, or repurposed
- accounting structure expectations change materially
