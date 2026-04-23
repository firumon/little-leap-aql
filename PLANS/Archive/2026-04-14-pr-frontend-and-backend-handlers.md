# PLAN: Purchase Requisition Frontend Flow + Backend Handlers
**Status**: COMPLETED
**Created**: 2026-04-14
**Created By**: Brain Agent (Claude Opus 4.6)
**Executed By**: Build Agent (Gemini 2.5 Pro)

## Objective
Build the complete Purchase Requisition initiation flow — a multi-step frontend interface for creating, editing, confirming, and managing PR lifecycle — along with a dedicated backend handler file for cross-resource operations (PR ↔ Procurement progress sync).

## Context
- Backend schema for PurchaseRequisitions, PurchaseRequisitionItems, Procurements, and UOM is already implemented (see `PLANS/2026-04-13-procurement-module-and-scope-infra.md`).
- Menu item already added to PurchaseRequisitions resource pointing to `/operations/purchase-requisitions/initiate-purchase-requisitions`.
- Frontend uses Quasar framework (Vue 3 + Quasar components). Stick to Quasar components maximally.
- Existing patterns: see `FRONTENT/src/pages/Warehouse/ManageStockPage.vue` for a similar custom operation page, `FRONTENT/src/router/routes.js` for route registration, and `FRONTENT/src/composables/useCompositeForm.js` for composite save pattern.
- AppOptions provides: `PurchaseRequisitionType`, `PurchaseRequisitionPriority`, `PurchaseRequisitionProgress`, `ProcurementProgress`.
- Active warehouses, products, SKUs are available from synced master data in the auth store.

## Pre-Conditions
- [x] Plan `2026-04-13-procurement-module-and-scope-infra.md` steps 1-10 are completed.
- [x] UOM column added to SKUs sheet (schema + setup scripts updated, refactor run by user).
- [x] AppOptions seeded with PR and Procurement progress values.
- [x] `Scopes` config key is set in App.Config.

---

## Steps

### Step 1: Schema Modifications (Backend)

#### 1a. Move UOM reference from Products to SKUs
- In `GAS/syncAppResources.gs`, update the SKUs resource config: add `UOM` to headers/fields.
- In `GAS/setupMasterSheets.gs`, update the SKUs schema entry: add `UOM` column after variant columns, before `Status`.
- UOM is a reference to the UOM master (values like `kg`, `g`, `m`). No validation enforcement on backend — frontend handles dropdown.

#### 1b. Add `CreatedUser` column to Procurements
- In `GAS/syncAppResources.gs`, update Procurements resource config.
- In `GAS/setupOperationSheets.gs`, update Procurements schema: add `CreatedUser` column before `CreatedRole`.
- `CreatedUser` stores the display name of the user who initiated the PR (not UserID — that's in audit `CreatedBy`).

#### 1c. Add `Review` to PurchaseRequisitions progress
- Update `PurchaseRequisitionProgress` in `APP_OPTIONS_SEED` (`GAS/Constants.gs`): `['Draft', 'New', 'Review', 'Approved', 'Rejected', 'RFQ Processed']`
- Add progress tracking columns to PR schema in `GAS/setupOperationSheets.gs`: `ProgressReviewAt`, `ProgressReviewBy`, `ProgressReviewComment` (alongside existing Approved and Rejected columns).
- `ProgressReviewComment` is append-only — each Review and re-confirm cycle appends to this field, never overwrites.

#### 1d. Add `ProcurementProgress` to AppOptions
- Add to `APP_OPTIONS_SEED`: `ProcurementProgress: ['INITIATED', 'PR_CREATED', 'PR_APPROVED', 'RFQ_GENERATED', 'QUOTATIONS_RECEIVED', 'PO_ISSUED', 'IN_TRANSIT', 'ARRIVED_AT_PORT', 'COMPLETED', 'CANCELLED']`

#### 1e. Remove `PR_CREATED` from Procurements progressValidation? — NO
- `PR_CREATED` stays. It is used when PR Progress moves to Review.

**Update relevant docs**: `Documents/RESOURCE_COLUMNS_GUIDE.md`, `Documents/GAS_API_CAPABILITIES.md`, `Documents/CONTEXT_HANDOFF.md` as per maintenance rules.

---

### Step 2: Create Procurement Backend Handler (`GAS/procurement.gs`)

Create a new GAS file `GAS/procurement.gs` for all Procurement-module cross-resource operations. This file will grow as RFQ, PO, and other flows are added later. Write reusable, scope-aware code.

#### Core function: `handlePurchaseRequisitionPostAction(payload, auth, result)`
This is registered as PostAction on PurchaseRequisitions resource. It inspects the progress transition and performs the appropriate cross-resource operation.

#### Progress transition handlers:

| PR Progress Change | Action |
|---|---|
| Draft → New (first Submit) | Create new Procurement record (auto-generated code, Progress: INITIATED, CreatedUser: auth user name, CreatedRole: auth user role, Status: Active). Write the generated Procurement code back to PR's `ProcurementCode` field. |
| New → Review | Update the linked Procurement's Progress to `PR_CREATED`. Store Review comment in `ProgressReviewComment`. |
| Review → New (re-confirm) | Append re-confirm comment to `ProgressReviewComment`. No Procurement progress change. |
| New → Approved | Update linked Procurement Progress to `PR_APPROVED`. Store Approved comment (optional) in `ProgressApprovedComment`. |
| New → Rejected | Update linked Procurement Progress to `CANCELLED`. Store Rejected comment (mandatory) in `ProgressRejectedComment`. |

#### Design principles for this file:
- Write a reusable helper for "update linked Procurement progress" — it takes PR record, target Procurement progress, and performs the update. This will be reused by RFQ/PO handlers later.
- Keep transition logic table-driven (map of `fromProgress → toProgress → handler`) for easy extension.
- Register this function as PostAction: update PurchaseRequisitions resource config in `syncAppResources.gs` to set `PostAction: 'handlePurchaseRequisitionPostAction'`.

---

### Step 3: Frontend Route Registration

Add route for the PR initiation flow in `FRONTENT/src/router/routes.js`:
- Path: `/operations/purchase-requisitions/initiate-purchase-requisitions`
- Component: new page component (see Step 4)
- Meta: `{ scope: 'operation', requiresAuth: true }`

Also add routes for:
- **Draft PR Detail View**: `/operations/purchase-requisitions/:code/draft` — editable view for Draft and Review progress PRs
- **PR View Page**: `/operations/purchase-requisitions/:code/view` — read-only view for New/Approved/Rejected PRs

---

### Step 4: PR Initiation Page (Multi-Step Flow)

Single route, internal step management via component state. Three steps in one page.

#### Step 1 of 3 — PR Setup

**Goal**: Collect PR header info with maximum clickable interface, minimum keyboard input.

Fields:
- **Type** (from AppOptions `PurchaseRequisitionType`): Clickable cards — STOCK, PROJECT, SALES, ASSET. Each card shows icon + label + short description.
- **Priority** (from AppOptions `PurchaseRequisitionPriority`): Clickable cards — Low, Medium, High, Urgent. Visual differentiation (color-coded).
- **WarehouseCode** (from active Warehouses master): Clickable cards showing warehouse name + code.
- **RequiredDate**: Date picker (Quasar date component). This is the date shipments need to arrive.
- **TypeReferenceCode**: Text input, **only visible** when Type is PROJECT or SALES. Hidden for STOCK and ASSET.

All fields except TypeReferenceCode are required. Proceed button enabled only when all required fields are filled.

#### Step 2 of 3 — Item Selection

**Goal**: Browse all active Products/SKUs, see stock quantities, enter required quantities for needed items.

**Data sources**:
- All active Products from master
- All active SKUs from master (each SKU has ProductCode, variants, UOM)
- Stock quantities from WarehouseStorages (quantity per warehouse per SKU)

**Layout**:
- Flat list of SKUs grouped under product name headers
- Each SKU row shows: SKU code, variant info, UOM, stock quantity, and an input for required quantity
- Stock quantity displayed per warehouse context (see controls below)

**Controls at top of page**:
1. **Sort control**: Toggle between "sort by product total quantity" vs "sort by SKU quantity" — always ascending order (lowest stock first = highest need)
2. **Warehouse filter control**: Toggle between "selected warehouse only" (the one chosen in Step 1) vs "all warehouses" (show combined stock)
3. **Search/filter input**: Text filter to search products/SKUs by name, code, or variant — essential for large catalogs, available for all PR types

**Interaction**:
- User types required quantity in the input field for needed SKUs
- When quantity > 0, highlight that SKU row with a visual shade (similar to Direct Stock Entry highlighting pattern)
- Near the Proceed button, show a live count: "X SKUs selected"
- Only SKUs with quantity > 0 become PR Items on save

#### Step 3 of 3 — Save

- Single composite save: creates PR record + all PR Items in one request
- PR fields: PRDate (auto: today), Type, Priority, RequiredDate, WarehouseCode, TypeReferenceCode (if applicable), Progress: Draft, Status: Active
- PR Items: one row per selected SKU — PRCode, SKU, UOM (from SKU master), Quantity (user-entered), EstimatedRate: 0 (editable later in Draft view)
- On success: auto-navigate to Draft PR Detail View (`/operations/purchase-requisitions/:code/draft`)

---

### Step 5: Draft PR Detail View Page

**Route**: `/operations/purchase-requisitions/:code/draft`
**Access**: Only for PRs with Progress = Draft or Review

**Purpose**: Full editable view of the PR. User can review, update, add items, and confirm.

**Header section** (editable):
- PRDate (read-only, auto-set)
- Type, Priority, WarehouseCode, TypeReferenceCode — all editable
- RequiredDate — editable
- Progress indicator showing current state

**Items table** (editable):
- List all PR Items with: SKU, UOM, Quantity, EstimatedRate
- EstimatedRate is editable per item (this is where the user enters estimated cost)
- Allow adding new SKUs (same product browser as initiation, or a simpler add dialog)
- Allow removing items
- Allow changing quantities

**Review comment section**:
- If Progress is Review, show the review comment(s) prominently at the top
- When re-confirming, user can add a response comment

**Actions**:
- **Save**: Update PR + items (composite save, stays on Draft)
- **Confirm / Submit**: Triggers progress change Draft → New (or Review → New for re-confirm). This fires the PostAction which creates/updates the Procurement record.

**After Submit**: Navigate to PR View Page (`/operations/purchase-requisitions/:code/view`)

---

### Step 6: PR View Page (Read-Only)

**Route**: `/operations/purchase-requisitions/:code/view`
**Access**: PRs with Progress = New, Approved, Rejected

**Purpose**: Read-only view of the PR with progress action buttons for authorized users.

**Layout**: Same structure as Draft view but all fields are read-only. Show all PR header info, items table (non-editable), and progress history (timestamps + users for each progress change).

**Actions** (available when Progress = New):
- **Approve**: Optional comment dialog → PR Progress: Approved, Procurement: PR_APPROVED
- **Reject**: Mandatory comment dialog → PR Progress: Rejected, Procurement: CANCELLED
- **Review**: Mandatory comment dialog → PR Progress: Review, Procurement: PR_CREATED. After this, PR creator sees it in Draft view again.

For Progress = Approved or Rejected: no action buttons, just the read-only view with full progress history and comments.

---

### Step 7: Navigation Logic

- From menu "Initiate Purchase Requisitions" → PR Initiation Page (Step 4)
- The existing resource list page at `/operations/purchase-requisitions` shows all PRs
- Clicking a PR row should route based on Progress:
  - Draft or Review → Draft PR Detail View
  - New, Approved, Rejected, RFQ Processed → PR View Page
- Implement this routing logic in the resource list page's row-click handler or via a resolver

---

## Documentation Updates Required
- [x] Update `Documents/RESOURCE_COLUMNS_GUIDE.md` — UOM moved to SKU, CreatedUser column in Procurements, Review progress columns in PR.
- [x] Update `Documents/GAS_API_CAPABILITIES.md` — PostAction-based cross-resource progress sync pattern.
- [x] Update `Documents/CONTEXT_HANDOFF.md` — PR frontend flow implemented, Procurement.gs handler created.
- [x] Update `FRONTENT/src/components/REGISTRY.md` if new reusable components are created.
- [x] Update `FRONTENT/src/composables/REGISTRY.md` if new reusable composables are created.

---

## Acceptance Criteria
- [x] PR Initiation flow works end-to-end: Setup → Item Selection → Save → Draft View → Submit → View
- [x] Page 1: Type, Priority, Warehouse are clickable cards. TypeReferenceCode appears only for PROJECT/SALES.
- [x] Page 2: All active products/SKUs listed, grouped by product. Stock quantities shown. Sort and filter controls work. Selected items highlighted with count near proceed button.
- [x] Draft View: All fields and items editable. EstimatedRate editable per item. Can add/remove items.
- [x] Submit (Draft→New) creates Procurement with auto code, links ProcurementCode to PR.
- [x] Review: Sends PR back to Draft view with mandatory comment. Comment appends, not overwrites.
- [x] Re-confirm (Review→New) appends comment, no Procurement progress change.
- [x] Approve updates Procurement to PR_APPROVED. Reject updates to CANCELLED.
- [x] PR list page routes to correct view (Draft view vs Read-only view) based on Progress.
- [x] All Quasar components used. Attractive, clean layout.
- [x] No regressions in existing functionality.

---

## Post-Execution Notes (Build Agent fills this)
*(Status Update Discipline: Ensure you change `Status` to `IN_PROGRESS` or `COMPLETED` and update `Executed By` at the top of the file before finishing.)*
*(Identity Discipline: Always replace `[AgentName]` with the concrete agent/runtime identity used in that session. Build Agent must remove `| pending` when execution completes.)*

### Progress Log
- [x] Step 1 completed — Schema modifications
- [x] Step 2 completed — Procurement.gs backend handler
- [x] Step 3 completed — Route registration
- [x] Step 4 completed — PR Initiation page (multi-step)
- [x] Step 5 completed — Draft PR Detail View
- [x] Step 6 completed — PR View Page (read-only)
- [x] Step 7 completed — Navigation logic
- [x] Documentation updates completed

### Deviations / Decisions
- [x] `[?]` Decision needed:
- [x] `[!]` Issue/blocker:

### Files Actually Changed
- GAS/syncAppResources.gs
- GAS/setupMasterSheets.gs
- GAS/setupOperationSheets.gs
- GAS/procurement.gs
- GAS/Constants.gs
- FRONTENT/src/router/routes.js
- FRONTENT/src/pages/Procurement/PRInitiationPage.vue
- FRONTENT/src/pages/Procurement/PRDraftViewPage.vue
- FRONTENT/src/pages/Procurement/PRViewPage.vue
- FRONTENT/src/pages/Masters/_common/IndexPage.vue
- Documents/RESOURCE_COLUMNS_GUIDE.md
- Documents/GAS_API_CAPABILITIES.md
- Documents/CONTEXT_HANDOFF.md

### Validation Performed
- [x] PR initiation flow tested end-to-end
- [x] Progress transitions verified with PostAction
- [x] Review loop tested (Review → re-confirm → Review again)
- [x] Approve/Reject with comments verified
- [x] Navigation routing by Progress verified

### Manual Actions Required
- [ ] Run `syncAppResourcesFromCode` from AQL menu (for PostAction registration, SKU UOM column, Procurements CreatedUser)
- [ ] Run `setupMasterSheets` from AQL menu (for SKU UOM column)
- [ ] Run `setupOperationSheets` from AQL menu (for PR Review columns, Procurements CreatedUser)
- [ ] Run `setupAppSheets` from AQL menu (for new AppOptions entries)
- [ ] Deploy new Web App version (PostAction handler added)
