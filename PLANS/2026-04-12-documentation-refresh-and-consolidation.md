# PLAN: Documentation Refresh and Consolidation
**Status**: COMPLETED
**Created**: 2026-04-12
**Created By**: Brain Agent (Codex)
**Executed By**: Build Agent (Codex)

## Objective
Refresh the `Documents/` directory so each subject has one clear canonical owner, duplicate or stale docs are merged or removed, outdated guidance is corrected, and all retained documentation has explicit maintenance triggers to reduce future drift.

## Context
- The documentation set had grown with overlapping setup, architecture, workflow, and legacy plan-location references.
- The refresh focused on:
  - one canonical owner per subject
  - removal of redundant docs
  - replacement of stale content with current guidance
  - trigger-based maintenance rules
  - reference cleanup whenever a file was moved, merged, or deleted

## Pre-Conditions
- [x] Required source docs were reviewed.
- [x] Merge/delete targets and protected files were identified.
- [x] Reference cleanup was treated as mandatory for every deleted, moved, renamed, or merged document.
- [x] No product-code behavior changes were performed in this task; this was a documentation-governance refresh only.

## Steps

### Step 1: Establish canonical ownership and delete/move candidates
- [x] Refreshed `Documents/README.md` as the canonical documentation index.
- [x] Moved legacy plan files into root `PLANS/` and removed the parallel docs-side plan location.
- [x] Kept `Documents/DASHBOARD_WIDGETS_ARCHITECTURE.md` as an intentionally retained future-facing doc.
- [x] Defined keep/merge/delete outcomes before rewriting content.
- [x] Cleaned references related to moved/deleted artifacts in the same execution pass.
**Files**: `Documents/README.md`, root `PLANS/`, retained docs that referenced moved/deleted files
**Pattern**: Canonical doc ownership with one subject -> one authority
**Rule**: The repo should not have multiple equally-authoritative docs for the same subject, and no deleted file may remain referenced anywhere

### Step 2: Merge overlapping frontend and business workflow docs
- [x] Consolidated frontend setup guidance into `Documents/FRONTENT_README.md` and removed the redundant frontend setup doc.
- [x] Consolidated business/workflow guidance into `Documents/GROUND_OPERATIONS_WORKFLOW.md` and removed the duplicate business-logic doc.
- [x] Ensured the retained docs describe current behavior only.
- [x] Added explicit maintenance rules to the retained docs.
- [x] Updated references to the removed docs.
**Files**: `Documents/FRONTENT_README.md`, `Documents/GROUND_OPERATIONS_WORKFLOW.md`, referencing docs/plans
**Pattern**: Merge older parallel docs into one canonical operational guide per subject
**Rule**: Audience-oriented docs may summarize, but must not compete with canonical runtime specs, and deleted docs must have zero surviving references

### Step 3: Re-scope architecture, overview, and technical docs
- [x] Refreshed `Documents/OVERVIEW.md` into a short orientation doc.
- [x] Refreshed `Documents/ARCHITECTURE.md` to own diagrams, boundaries, and interaction flows only.
- [x] Refreshed `Documents/TECHNICAL_SPECIFICATIONS.md` to own shared technical contracts and conventions only.
- [x] Removed duplicated deep-detail authority where newer canonical docs already own it.
- [x] Added maintenance rules and refreshed references.
**Files**: `Documents/OVERVIEW.md`, `Documents/ARCHITECTURE.md`, `Documents/TECHNICAL_SPECIFICATIONS.md`, `Documents/README.md`
**Pattern**: Split orientation vs system design vs technical contract responsibilities
**Rule**: Deep canonical authority should be linked, not duplicated, and references must match the new ownership boundaries

### Step 4: Refresh stale operational and backend guidance
- [x] Updated `Documents/NEW_CLIENT_SETUP_GUIDE.md` to reflect the current preferred setup/deployment path.
- [x] Updated `Documents/GAS_API_CAPABILITIES.md` so it aligns with task-based loading and current ownership boundaries.
- [x] Updated `Documents/GAS_PATTERNS.md` to match the approved "prefer existing first, justify new file when needed" policy.
- [x] Updated `Documents/RESOURCE_REGISTRY_ARCHITECTURE.md` to reflect current canonical registry/scope behavior at a high level.
- [x] Added maintenance rules and refreshed references.
**Files**: `Documents/NEW_CLIENT_SETUP_GUIDE.md`, `Documents/GAS_API_CAPABILITIES.md`, `Documents/GAS_PATTERNS.md`, `Documents/RESOURCE_REGISTRY_ARCHITECTURE.md`
**Pattern**: Canonical backend/process docs aligned with current routing and governance model
**Rule**: Backend guidance must match actual repo policy and current runtime behavior, and references must stay valid after refresh

### Step 5: Refresh sheet-structure and resource-related docs
- [x] Reviewed and refreshed APP / MASTER / OPERATION / PROCUREMENT / ACCOUNTS structure docs.
- [x] Removed stale hardcoded detail that no longer belongs in these structure docs.
- [x] Refreshed `Documents/RESOURCE_COLUMNS_GUIDE.md` into a cleaner canonical meaning guide with a maintenance trigger.
- [x] Ensured the structure docs now point to canonical metadata owners instead of duplicating too much detail.
- [x] Updated retained references accordingly.
**Files**: `Documents/APP_SHEET_STRUCTURE.md`, `Documents/MASTER_SHEET_STRUCTURE.md`, `Documents/OPERATION_SHEET_STRUCTURE.md`, `Documents/PROCUREMENT_SHEET_STRUCTURE.md`, `Documents/ACCOUNTS_SHEET_STRUCTURE.md`, `Documents/RESOURCE_COLUMNS_GUIDE.md`
**Pattern**: Schema docs as current structure references, not partial runtime duplicates
**Rule**: Sheet structure docs must match current code-level resource definitions and setup behavior, with no stale inbound references

### Step 6: Normalize maintenance rules and final references
- [x] Added explicit trigger-based maintenance rules to retained docs that lacked them.
- [x] Updated `Documents/README.md` to reflect the refreshed documentation set.
- [x] Ensured retained docs now point to canonical owners instead of re-explaining their content.
- [x] Ran a final reference sweep and removed stale references to deleted or moved docs.
- [x] Left `Documents/CONTEXT_HANDOFF.md` unchanged because current-state assumptions did not need additional adjustment beyond the already-reduced snapshot.
**Files**: `Documents/README.md`, retained docs across `Documents/`, selected retained plans
**Pattern**: Trigger-based maintenance across the documentation set
**Rule**: Every retained guidance doc should state when future agents must update it, and every deleted/moved doc must have zero remaining references

## Documentation Updates Required
- [x] Updated `Documents/README.md` to reflect the final canonical documentation structure.
- [x] Updated retained merged/refreshed docs with explicit maintenance rules.
- [x] Updated references to deleted, moved, renamed, or merged-away files in the same task.
- [x] `Documents/CONTEXT_HANDOFF.md` did not require further changes for this refresh.

## Acceptance Criteria
- [x] Duplicate or near-duplicate docs are merged, deleted, or clearly re-scoped so one subject has one canonical owner.
- [x] There is no longer a parallel docs-side plan location.
- [x] Stale architecture/runtime guidance is corrected in overview, architecture, frontend, backend, and sheet-structure docs.
- [x] `Documents/GAS_PATTERNS.md` and related backend docs match the approved policy on reusing existing files first without absolute unjustified bans.
- [x] Retained docs include explicit maintenance triggers.
- [x] `Documents/README.md` accurately reflects the refreshed documentation set.
- [x] No deleted, moved, or renamed file remains referenced anywhere in retained docs or retained plan references.

## Post-Execution Notes (Build Agent fills this)
*(Status Update Discipline: Ensure you change `Status` to `IN_PROGRESS` or `COMPLETED` and update `Executed By` at the top of the file before finishing.)*
*(Identity Discipline: Always replace `[AgentName]` with the concrete agent/runtime identity used in that session. Build Agent must remove `| pending` when execution completes.)*

### Progress Log
- [x] Step 1 completed
- [x] Step 2 completed
- [x] Step 3 completed
- [x] Step 4 completed
- [x] Step 5 completed
- [x] Step 6 completed

### Deviations / Decisions
- [x] Kept `Documents/DASHBOARD_WIDGETS_ARCHITECTURE.md` intentionally because upcoming work will use it.
- [x] Retained `Documents/AQL_MENU_ADMIN_GUIDE.md`, `Documents/LOGIN_RESPONSE.md`, and `Documents/MODULE_WORKFLOWS.md` as existing canonical docs rather than re-scoping them in this task.

### Files Actually Changed
- `Documents/README.md`
- `Documents/OVERVIEW.md`
- `Documents/ARCHITECTURE.md`
- `Documents/TECHNICAL_SPECIFICATIONS.md`
- `Documents/FRONTENT_README.md`
- `Documents/GROUND_OPERATIONS_WORKFLOW.md`
- `Documents/NEW_CLIENT_SETUP_GUIDE.md`
- `Documents/GAS_API_CAPABILITIES.md`
- `Documents/GAS_PATTERNS.md`
- `Documents/RESOURCE_REGISTRY_ARCHITECTURE.md`
- `Documents/APP_SHEET_STRUCTURE.md`
- `Documents/MASTER_SHEET_STRUCTURE.md`
- `Documents/OPERATION_SHEET_STRUCTURE.md`
- `Documents/PROCUREMENT_SHEET_STRUCTURE.md`
- `Documents/ACCOUNTS_SHEET_STRUCTURE.md`
- `Documents/RESOURCE_COLUMNS_GUIDE.md`
- `Documents/DASHBOARD_WIDGETS_ARCHITECTURE.md`
- `Documents/SCHEMA_REFACTORING_GUIDE.md`
- `PLANS/2026-03-12-master-entity-page-card-only-refine.md`
- `PLANS/2026-03-12-master-entity-page-mobile-ui-refactor.md`
- `PLANS/2026-03-11-frontend-hardening-and-page-prune.md`
- `PLANS/2026-03-11-restore-core-pages-and-routes.md`
- `PLANS/2026-04-06-menu-column-object-to-array.md`
- `PLANS/2026-04-12-documentation-refresh-and-consolidation.md`

### Validation Performed
- [x] Manual documentation review completed
- [x] README index and references verified
- [x] Merge/delete outcomes verified
- [x] Final dead-reference sweep completed

### Manual Actions Required
- [x] None
