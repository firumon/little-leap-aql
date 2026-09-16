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
- region hierarchy for scoped access

### Designations
- hierarchy/authority model
- columns: `DesignationID`, `Name`, `HierarchyLevel`, `Status`, `AccessRegion`, `DashboardScoreCutoff`, `Description`
- `AccessRegion` holds the region scope at designation level. Access region was previously
  held at role level; the column exists and is written by the menu, but nothing reads it yet
- `DashboardScoreCutoff` is a number. A dashboard item scoring below it is not shown to this
  designation. Blank or `0` shows everything
- both columns reach the app on the login payload under `user.designation`

### Roles
- functional role definitions

### RolePermissions
- role-to-resource action matrix

### Resources
- runtime metadata registry for backend and frontend
- includes resource configuration columns such as `Settings` (custom resource setting definitions), `Dashboard` (widget analytics declarations), and `Options` (resource-specific option lists, sitting immediately after `ListViews` and before `CustomUIName`)
- column meanings are owned by [SCHEMA_RESOURCE_COLUMNS.md](F:/LITTLE%20LEAP/AQL/Documents/SCHEMA_RESOURCE_COLUMNS.md)

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
