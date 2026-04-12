# Schema Refactoring Guide

## Purpose
This guide explains how schema-related setup/refactor flows should be used to align sheets with current code-defined structure.

## Core Idea
When headers/columns change, use the setup/refactor workflow rather than making uncontrolled manual structural edits.

## Typical Flow
1. update the relevant code-defined schema/config
2. sync `APP.Resources` from code if resource metadata changed
3. run the relevant APP / MASTER / OPERATION / ACCOUNTS setup or refactor action
4. verify any dependent frontend/runtime assumptions

## Notes
- resource metadata and sheet structure should stay aligned
- workflow/action-related columns should remain aligned with current process design

## Canonical Detail Owners
- Resource metadata semantics: [RESOURCE_COLUMNS_GUIDE.md](F:/LITTLE%20LEAP/AQL/Documents/RESOURCE_COLUMNS_GUIDE.md)
- Setup flow: [NEW_CLIENT_SETUP_GUIDE.md](F:/LITTLE%20LEAP/AQL/Documents/NEW_CLIENT_SETUP_GUIDE.md)

## Maintenance Rule
Update this file when:
- the setup/refactor workflow changes
- schema alignment expectations change
- canonical detail-owner references change
