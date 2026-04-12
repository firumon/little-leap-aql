# AQL Overview

## Purpose
This is the short orientation document for AQL. It should explain what the system is, what it supports, and where to go next for deeper detail.

## What AQL Is
AQL is the operating system for Little Leap's UAE baby-product distribution business. The primary operational heartbeat is:
1. distribute products to outlets
2. track outlet sales on recurring cycles
3. collect payments on strict intervals
4. approve and execute refills
5. raise supplier purchase orders before stock-out risk

Inbound logistics, warehouse intake, and internal stock control support that commercial cycle.

## Current Runtime Direction
- Frontend: Quasar, Vue 3, Pinia, Vite
- Backend: Google Apps Script Web App with a single `doPost` entry
- Data model: Google Sheets split across APP, MASTERS, OPERATIONS, REPORTS, and optionally ACCOUNTS
- Control plane: `APP.Resources` drives routing, permissions, metadata, and sheet resolution

## Where To Read Next
- Business workflow: [GROUND_OPERATIONS_WORKFLOW.md](F:/LITTLE%20LEAP/AQL/Documents/GROUND_OPERATIONS_WORKFLOW.md)
- System boundaries: [ARCHITECTURE.md](F:/LITTLE%20LEAP/AQL/Documents/ARCHITECTURE.md)
- Technical contracts: [TECHNICAL_SPECIFICATIONS.md](F:/LITTLE%20LEAP/AQL/Documents/TECHNICAL_SPECIFICATIONS.md)
- Task-based loading: [DOC_ROUTING.md](F:/LITTLE%20LEAP/AQL/Documents/DOC_ROUTING.md)

## Maintenance Rule
Update this file when the project identity, primary business heartbeat, major runtime direction, or canonical next-doc references change.
