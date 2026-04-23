# PLAN: CustomUIName — 3-Tier Page & Section Resolution
**Status**: COMPLETED
**Created**: 2026-03-31
**Created By**: Brain Agent (Claude Code)
**Executed By**: Solo Agent (Claude Code)

## Objective
Add `CustomUIName` column to `APP.Resources` and implement 3-tier component resolution for all master page actions (Index, View, Add, Edit, Action). This enables per-tenant UI customization driven by data (no rebuild needed), with the resolution chain: **tenant-custom → entity-custom → default**.

Also: rename `ListPage` → `IndexPage`, move entity-level section overrides from `pages/` to `components/`, and extract all action pages into section components.

## Resolution Chains

### Page-level (ActionResolverPage)
```
1st: pages/Masters/_custom/{Code}/{Entity}.vue              ← tenant custom (index)
     pages/Masters/_custom/{Code}/{Entity}{Action}.vue       ← tenant custom (other actions)
2nd: pages/Masters/{Entity}/{Action}Page.vue                 ← entity custom
3rd: pages/Masters/_common/{Action}Page.vue                  ← default
```

### Section-level (useSectionResolver inside _common pages)
```
1st: components/Masters/_custom/{Code}/{Entity}{Action}{Section}.vue  ← tenant custom
2nd: components/Masters/{Entity}/{Action}{Section}.vue                 ← entity custom
3rd: components/Masters/Master{Action}{Section}.vue                    ← default
```

## Section Definitions Per Action

| Action | Sections | Default Components |
|--------|----------|--------------------|
| Index | ListHeader, ListReportBar, ListToolbar, ListRecords | MasterListHeader, MasterListReportBar, MasterListToolbar, MasterListRecords |
| View | ViewHeader, ViewActionBar, ViewDetails, ViewAudit, ViewChildren | MasterViewHeader, MasterViewActionBar, MasterViewDetails, MasterViewAudit, MasterViewChildren |
| Add | AddHeader, AddForm, AddChildren, AddActions | MasterAddHeader, MasterAddForm, MasterAddChildren, MasterAddActions |
| Edit | EditHeader, EditForm, EditChildren, EditActions | MasterEditHeader, MasterEditForm, MasterEditChildren, MasterEditActions |
| Action | ActionHeader, ActionForm, ActionActions | MasterActionHeader, MasterActionForm, MasterActionActions |

## Steps

### Step 1: GAS — Add CustomUIName column
- Add `CustomUIName: ''` to every resource in syncAppResources.gs
- Read it in resourceRegistry.gs config builder
- Include it in auth payload ui object

### Step 2: Rename ListPage → IndexPage
- Rename _common/ListPage.vue → _common/IndexPage.vue
- Update route meta: action 'list' → 'index'
- Update ActionResolverPage: default action → 'index'

### Step 3: Create generic useSectionResolver composable
- Replace useListSectionResolver.js with useSectionResolver.js
- Glob patterns for components/Masters/ (entity + custom)
- 3-tier resolution: custom → entity → default
- Accepts: actionName, resourceSlug, customUIName, sectionDefs

### Step 4: Update ActionResolverPage for 3-tier page resolution
- Add useResourceConfig to read customUIName
- Add _custom glob pattern
- 3-tier: custom page → entity page → _common page

### Steps 5-9: Extract sections from each page
Each page gets refactored into thin orchestrator + section components.

### Step 10: Create _custom directories + registries
### Step 11: Update all documentation
### Step 12: Build verification + commit

## Acceptance Criteria
- [ ] `CustomUIName` column exists in APP.Resources schema
- [ ] `CustomUIName` value is delivered in auth payload `ui` object
- [ ] IndexPage.vue works (renamed from ListPage)
- [ ] Route meta uses 'index' action, not 'list'
- [ ] ActionResolverPage resolves 3-tier: _custom/{Code}/{Entity} → {Entity}/{Action}Page → _common/{Action}Page
- [ ] useSectionResolver resolves 3-tier for all 5 actions
- [ ] All 20 default section components exist and render correctly
- [ ] _custom/ directories exist with REGISTRY.md files
- [ ] npm run build succeeds
- [ ] Zero stale references to old names
- [ ] Docs updated (MODULE_WORKFLOWS, CONTEXT_HANDOFF, registries)
