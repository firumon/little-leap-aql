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

### Roles
- functional role definitions

### RolePermissions
- role-to-resource action matrix

### Resources
- runtime metadata registry for backend and frontend
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
