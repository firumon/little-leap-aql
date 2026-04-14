# AQL - GAS API Capabilities Reference

## Purpose
This document describes what the GAS backend can already do before a new backend design or implementation path is proposed.

## When To Read This File
Read this file when:
- designing new backend behavior
- checking whether an existing GAS capability already covers a request
- planning or implementing backend changes

Do not treat this as a universal startup read for every task.

## Current Capability Areas
- generic CRUD by action/scope/resource
- bulk create/update with `records: []`
- bulk upload flow for the dedicated Bulk Upload UI
- post-write hook support (e.g., PostAction-based cross-resource progress sync)
- additional actions / workflow transitions
- composite save for parent + children
- report generation
- batch action execution
- year-scoped code generation for operation-scope resources (e.g., PR26000001)
- view scope read-only behavior (no CRUD operations, full dataset return without pagination)

## Key Rules
- Prefer existing capabilities before proposing new backend patterns.
- Resource metadata belongs in `syncAppResources.gs`.
- Operational multi-record saves should use the supported bulk-array path, not invent custom action shapes when an existing pattern fits.

## Canonical Detail Owners
- Implementation patterns and anti-patterns: [GAS_PATTERNS.md](F:/LITTLE%20LEAP/AQL/Documents/GAS_PATTERNS.md)
- Resource metadata semantics: [RESOURCE_COLUMNS_GUIDE.md](F:/LITTLE%20LEAP/AQL/Documents/RESOURCE_COLUMNS_GUIDE.md)
- Task-based reading expectations: [DOC_ROUTING.md](F:/LITTLE%20LEAP/AQL/Documents/DOC_ROUTING.md)

## When To Escalate
Escalate when the requirement cannot be covered by current generic CRUD, hook, batch, action, or composite-save patterns.

## Maintenance Rule
Update this file when:
- a backend capability is added, removed, or materially changed
- a new generic backend pattern becomes officially supported
- escalation guidance changes
