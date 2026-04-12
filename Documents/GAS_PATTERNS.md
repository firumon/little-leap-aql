# AQL - GAS Backend Patterns Guide

## Purpose
This document is the implementation-pattern reference for GAS work in AQL.

## When To Read This File
Read this file when you are changing GAS implementation, not for every task.

## Core Rule
- Prefer extending existing GAS files and existing patterns first.
- Create a new GAS file only when the current structure cannot support the task cleanly or safely.
- If a new pattern or file is needed, plan it first and document the reason.

## Preferred Pattern Order
1. pure CRUD via resource metadata
2. after-create hook
3. bulk array write with hook support
4. additional actions
5. composite save
6. propose a new generic pattern only if the above do not fit

## Anti-Patterns
- hardcoding resource-specific logic into generic core files when metadata/hook patterns fit
- inventing custom action shapes for work already covered by existing bulk/action/composite flows
- creating new GAS files by habit instead of by need

## Canonical Detail Owners
- Capability inventory: [GAS_API_CAPABILITIES.md](F:/LITTLE%20LEAP/AQL/Documents/GAS_API_CAPABILITIES.md)
- Resource config semantics: [RESOURCE_COLUMNS_GUIDE.md](F:/LITTLE%20LEAP/AQL/Documents/RESOURCE_COLUMNS_GUIDE.md)

## Maintenance Rule
Update this file when:
- a supported GAS implementation pattern changes
- a new backend extension pattern is approved
- the repo policy on reusing existing files versus creating new files changes
