# ACCOUNTS Google Sheet Structure

This document defines the structure for the ACCOUNTS framework encompassing the Chart of Accounts, Entry Templates, and the operational ledger sheets (Assets, Liabilities, Equity, Revenue, Expenses).

## 1) ChartOfAccounts (Master)
Hierarchical chart defining all accounting buckets.

Columns:
- `Code` (Prefix: COA)
- `Name`
- `Description`
- `AccountType` (ASSETS, LIABILITIES, EQUITY, REVENUE, EXPENSES)
- `Status`
- Audit Columns

## 2) EntryTemplates (Master)
Pre-defined templates for non-accountant users to create entries without knowing COA specifics.

Columns:
- `Code` (Prefix: ETPL)
- `Name` (e.g., "Tea/Snack purchase for office staffs")
- `Description`
- `COACode` (Which account this maps to)
- `Params` (JSON config of predefined cash flows, keys/values)
- `Fields` (JSON defining the fields the user must fill, like 'Amount', 'Description')
- `Status`
- Audit Columns

## 3) Ledger Sheets (Operations)
Five distinct sheets, all sharing the exact same structure but physically separated per user request.

Sheets:
- **Assets** (Prefix: AST)
- **Liabilities** (Prefix: LIA)
- **Equity** (Prefix: EQT)
- **Revenue** (Prefix: REV)
- **Expenses** (Prefix: EXP)

Common Columns:
- `Code` 
- `ReferenceCode` (Link to ProcurementCode, ShipmentCode, etc.)
- `COACode` 
- `OperationDate` 
- `Amount` 
- `Description` 
- `Status` 
- Audit Columns

## Setup Scripts
Run `setupAccountSheets()` from `GAS/setupAccountSheets.gs`.
