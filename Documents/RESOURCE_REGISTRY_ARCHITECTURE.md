# Resource Registry Architecture

## Purpose
This document explains how `APP.Resources` and related config determine runtime routing and metadata behavior.

## Core Model
- `APP.Resources` is the runtime registry for resource configuration.
- Resource metadata drives backend routing and frontend metadata exposure.
- Scope-level config can provide default file resolution when a resource-level `FileID` is blank.

## Scope Model
Canonical scopes are:
- `master`
- `operation`
- `accounts`
- `report`
- `system`

Scope values should be treated as canonical resource metadata, not casual aliases.

## File Resolution
Resolution order is:
1. resource-level `FileID`
2. scope-level config fallback
3. APP file fallback where applicable

## Permission Model
- user roles map to resource permissions
- resource metadata defines runtime behavior and UI exposure
- region and record rules are evaluated separately from raw CRUD permission

## Canonical Detail Owners
- Column-level semantics: [RESOURCE_COLUMNS_GUIDE.md](F:/LITTLE%20LEAP/AQL/Documents/RESOURCE_COLUMNS_GUIDE.md)
- APP control-plane structure: [APP_SHEET_STRUCTURE.md](F:/LITTLE%20LEAP/AQL/Documents/APP_SHEET_STRUCTURE.md)
- Current technical/runtime conventions: [TECHNICAL_SPECIFICATIONS.md](F:/LITTLE%20LEAP/AQL/Documents/TECHNICAL_SPECIFICATIONS.md)

## Maintenance Rule
Update this file when:
- resource scope behavior changes
- file-resolution behavior changes
- permission or registry runtime ownership changes
