# APP Sheet Structure

## Purpose
This document describes the APP spreadsheet as the control plane for authentication, authorization, config, and resource metadata.

## Core Sheets
- `Users`
- `AccessRegions`
- `Designations`
- `Roles`
- `RolePermissions`
- `Resources`
- `Config`

## Sheet Responsibilities

### Users
- identity and authentication record
- role/designation/region assignment

### AccessRegions
- region hierarchy for scoped access (Code, Name, Parent)
- canonical specification: [ACCESS_REGION_AND_POLICY_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/ACCESS_REGION_AND_POLICY_SYSTEM.md#2-core-concepts)

### Designations
- hierarchy/authority model
- columns: `DesignationID`, `Name`, `ParentDesignationID`, `Status`, `AccessRegion`, `DashboardScoreCutoff`, `Description`
- `AccessRegion` holds the active region scope for users with this designation (resolved during login/profile fetch; see [ACCESS_REGION_AND_POLICY_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/ACCESS_REGION_AND_POLICY_SYSTEM.md#23-how-a-user-gets-their-region))
- `DashboardScoreCutoff` is a number. A dashboard item scoring below it is not shown to this
  designation. Blank or `0` shows everything
- both columns reach the app on the login payload under `user.designation`

### Roles
- functional role definitions

### RolePermissions
- role-to-resource action matrix

### Resources
- runtime metadata registry for backend and frontend
- includes resource configuration columns such as `AccessPolicy` (5-digit octal ROPDU scope permissions), `AccessRegionSource` (JSON object of region inheritance paths), `Settings` (custom resource setting definitions), `Dashboard` (widget analytics declarations), and `Options` (resource-specific option lists, sitting immediately after `ListViews` and before `CustomUIName`)
- column meanings are owned by [SCHEMA_RESOURCE_COLUMNS.md](file:///f:/LITTLE%20LEAP/AQL/Documents/SCHEMA_RESOURCE_COLUMNS.md); access policy and region source specifications are owned by [ACCESS_REGION_AND_POLICY_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/ACCESS_REGION_AND_POLICY_SYSTEM.md)

### Config
- deployment-specific settings such as file IDs and sync-related values

## Setup
APP structure is created/refreshed through setup/refactor scripts and related menu actions.

## Canonical Detail Owners
- Resource column semantics: [SCHEMA_RESOURCE_COLUMNS.md](F:/LITTLE%20LEAP/AQL/Documents/SCHEMA_RESOURCE_COLUMNS.md)
- Resource/runtime routing: [SCHEMA_RESOURCE_REGISTRY.md](F:/LITTLE%20LEAP/AQL/Documents/SCHEMA_RESOURCE_REGISTRY.md)
- Setup flow: [TENANT_NEW_CLIENT_SETUP.md](F:/LITTLE%20LEAP/AQL/Documents/TENANT_NEW_CLIENT_SETUP.md)

## Maintenance Rule
Update this file when:
- APP control sheets are added, removed, or repurposed
- APP responsibilities change materially
- canonical detail-owner references change
