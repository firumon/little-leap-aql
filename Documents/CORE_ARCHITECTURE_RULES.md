# AQL Frontend Architecture Rules (STRICT)

---\

## 1. SERVICES LAYER
* **Role**: Pure data providers (API/IDB gateway). No business logic. Standardized response: `{ success: boolean, data: any, error: any }`.
* **APIs & IDB**: All API requests, IndexedDB operation, offline sync, queueing, and persistence logic MUST exist ONLY inside services.
* **Logging**: Inside services only, controlled via environment variable `process.env.ENABLE_LOGS`.

---\

## 2. UTILITIES (appHelpers)
* **Role**: Reusable stateless helper functions in `src/utils/appHelpers.js` (e.g. `toPascalCase`, `mapHeaderAndArray`).
* **Rules**: Must be stateless, pure, side-effect free. Used in services, stores, composables, and components.
* **Restrictions**: No API calls, IDB access, business workflows, or UI logic.

---\

## 3. STORES (Pinia)
* **Role**: State managers, API command orchestrators, and IDB state hydrators. No business logic, validations, or UI logic.
* **Single Source of Truth**: All reactive resource-record state flows through Pinia stores.
* **Mandatory Store Primitives**:
  * `useDataStore` (`src/stores/data.js`): Default owner of reactive resource rows. Record reads go through `useRecord`, and Layer 2 (`_resource/`) and Layer 3 (`_ui/`, pages, components) never import the data store. See [UI_RECORD_ACCESS.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_RECORD_ACCESS.md).
  * `useResourceIoStore` (`src/stores/resourceIo.js`): Single command surface for API/fetch/sync/mutations. Hydrates `useDataStore`.
  * `useResourceStatusStore` (`src/stores/resourceStatus.js`): Fetch/sync status registry only. No API commands.
* **API Transport Contract**: One canonical envelope for frontend-to-GAS requests/responses (`{ requestId, action, token, sessionKey, resource, payload }`). Every protected request must carry a rolling `sessionKey` derived from the session token UUID parameters and the local generation counter (verified on GAS with asymmetric window: `stored - 2 <= clientGen <= stored + 30`; `SESSION_GEN_WINDOW_BACK = 2`, `SESSION_GEN_WINDOW_AHEAD = 30`; out-of-window rejections carry an encoded `sessionResync` enabling automatic single-retry without logout). All resource data in responses must persist via IDB/data flow. Batch dependencies must use `$ref` payload objects resolved by GAS; do not stringify/concatenate `$ref` values or put them in comments (for multi-code lists, use `$ref` + `$append` via `batchRefList`).

---\

## 4. COMPOSABLES
* **Role**: Contains all business logic, validation, workflow handling, and payload preparation.
* **Rules**: Can use stores and other composables. Must NOT use services directly, perform API/IDB operation, or exceed ~400 lines.
* **Record Access Architecture**: All record reads follow the strict separation between `useRecord()` (core logic/domain access), `usePageRecord()` (page setup/view orchestration), and `pageState.useRecord()` (form field binding). See [UI_RECORD_ACCESS.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_RECORD_ACCESS.md).
* **Domain Payload Chains**: When a business mutation on Resource A causes side-effects on Resource B (e.g. Order → Invoice, Audit → Restock), Layer 2 of Resource A calls the domain payload builder of Resource B directly. Layer 2 owns all cross-resource batch construction and permission aggregation. Builders return **Node Objects** — the Unified Node Transport Structure — or an array of them; a builder that cannot build returns `[{ valid: false, message }]`. There is no `{ valid, requests, permissions, … }` envelope and no constructor module. Spec: [UI_PAGE_STATE_NODES.md §5](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_PAGE_STATE_NODES.md).
* **Navigation**: Must use `useResourceNav` for routing. Direct `router.push()` is forbidden.
* **Component Resolution**: Must respect the decentralized page resolver (`usePageResolver`), section resolver (`useSectionResolver`), content resolver (`useContentResolver`), action resolver (`useActionResolver`), and common section wrapper (`useCommonSection`). Do not bypass them to perform ad-hoc template loading or layout overrides.
* **Dynamic Currency**: Always use the `useCurrency` `_C(value, showSymbol, target, source)` helper. Do not hardcode currency symbols (e.g. `₹`, `AED`).

---\

## 5. COMPONENTS & PAGES
* **Role**: UI rendering only. Invokes composables. No business logic, stores, services, API calls, or IDB operation.
* **Zero UI Schema Invention**: Page action handlers (`PageAction.js`) and UI components must never construct secondary/child business rows or calculate business formulas directly. UI passes collected form inputs to the Layer 2 Domain Payload Chain and hands the Node Objects it returns to `pageState.applyNodes()`, which gates on each node's own permissions before writing anything.
  * **A page never lists its own draft's columns either.** The opening record of a create page comes from a Layer 2 `build<Resource>InitNodes`, built on `resourceRow` so the sheet's own defaults are read rather than restated. Every consequence of a user's choice — a refilled price, a warehouse, a ledger row — is regenerated by a Layer 2 `derive` on that node, so the live nodes are always exactly the batch that would be sent, and the submit handler only validates. Spec: [UI_PAGE_STATE_NODES.md §5.7A–§5.7D](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_PAGE_STATE_NODES.md).
* **Content Atomicity**: One content/section component does one job, and every one of them is declared in the page contract with its own `Props<Identity>` block — never imported by a sibling. Atomic means one job, not one field. Rule and split test: [UI_CONTENT_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_CONTENT_SYSTEM.md) §6.
* **UI/Workflow Permission Gating**: All interactive elements and state-changing workflows must be gated using `allowed()` from `useResourceConfig`. For multi-resource actions, gate must verify ALL permissions (AND logic).

---\

## 6. VUE REACTIVITY & STATE COMPOSITION (STRICT)
* **Single Source of Truth**: Every UI state domain has one reactive source of truth.
* **Resource Aggregation**: Combine related resources (e.g., Products, SKUs, Storage locations) in a composable `computed()` property to form an array of unified aggregate objects. Derive all filter conditions (e.g. warehouse filter) from this single composed state.
* **Forbidden**: No parallel arrays, mirror objects, duplicate caches, watcher chains, or manual synchronization code to mimic reactivity. Fix stale UI by modifying the canonical reactive source.
* **Thin Page Orchestration**: Vue page files must act strictly as orchestrators:
  * *Templates*: No nested raw HTML layouts (like `div > div > ul > li`). Compose using child components and conditional flags (`v-if`/`v-else`).
  * *Scripts*: Mostly imports and thin binding logic to feed child components.
* **Indexed Joins, Never Linear Scans**: Any lookup that runs inside a render loop, a `v-for`, a per-row projection, or a per-keystroke/per-click handler MUST resolve through an `O(1)` `Map` built in a single pass. `.find()` / `.filter()` over a resource array is permitted only for a one-off, non-repeating read. A `.find()` whose input is another array's iteration — including one hidden inside a helper called per row — is a defect, not a style preference: it makes the projection `O(n×m)` and it recomputes in full on every reactive invalidation. The same applies inside an enrichment: `raw.map((r) => enrich(r, raw))` is `O(n²)`; build the grouping `Map` once in the `computed()` and hand each record its own bucket.
* **Once Per App, Not Once Per Consumer**: An enrichment or index is built **once for the application** wherever possible — never once per consuming component instance, and never once per row. A `computed()` declared inside a `use*Resource()` composable is memoized *per call site*, so N components calling it run the same enrichment pass N times over the same rows. Shared indexes belong at module scope (a lazily created singleton) or on the store, so every consumer reads the same instance. This is NOT the "duplicate caches" forbidden above: a forbidden cache is a *second writable copy of state*; an index is a *derived read-only projection of the one source*, and centralizing it is what keeps the single source of truth single.
  * **STRICT — a shared form/UI composable MUST NOT build option lists or any projection over a record set.** A composable that several cards call is memoized *per call site*, so a `computed()` in it that maps, filters or sorts a whole resource runs once **per card**, and re-runs in full for every one of them on every invalidation. Six cards calling one composable that builds `skuOptions` is six passes over the SKU catalogue per keystroke. The count is invisible at the call site, which is exactly why this must be a rule and not a judgement call.
    * **The test**: does this `computed()` touch more than the record in front of it? If it reads `items.value` of any resource — to map options, group lines, or total anything — it does not belong in the shared composable.
    * **Where it goes instead**: the Layer 2 module of the resource that OWNS those rows, wrapped in `recordSource.remember(...)`, so the pass runs once per app per data change and every card reads the same instance. A picker's options are a projection of a master resource; that master resource publishes them.
    * **What may stay** in the shared composable: reads of the page's own node, one-column setters, and formatting of a single value. Nothing that iterates a sheet.
    * This applies whatever the current row count is. A list that is cheap at 200 SKUs is the same code at 20,000, and the failure arrives as an unexplained typing lag long after the composable was written.
* **Resource Domain Cascade, No Bypass Links**: Every resource — root entity, child relation, or configuration entity (`OutletOperatingRules`, `OutletStorages`) — owns a Layer 2 module, and downstream resources consume upstream ones **in series** (`OutletOperatingRules → Outlets → OutletVisits`). Reading a parent's raw rows from the store when the parent's domain module already answers the question is a bypass link, and so is a hardcoded fallback constant: a resource default is CONFIGURATION, read via `useResourceConfig(RESOURCE_NAME).defaultValues` (`APP.Resources.DefaultValues`), never a `|| 30` compiled into a consumer. An unconfigured default resolves to `0`/`''` meaning "unknown", and consumers decline to act rather than invent a value. Spec: [UI_RESOURCE_DOMAIN_LOGIC.md §10.1–10.2](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_RESOURCE_DOMAIN_LOGIC.md).
* **Non-Destructive Entity Travel**: An enricher decorates, it never narrows — spread the source row first (`{ ...row, derivedKey }`), keep `_raw`, and carry joined relations as whole enriched objects. Returning a cherry-picked subset does not save memory; it forces the next consumer that needs an omitted attribute to re-derive a parallel copy from the store, which is exactly the split-brain the Single Source of Truth rule forbids. Layer 3 decides what to render; Layer 2 decides what is true. Spec: [UI_RESOURCE_DOMAIN_LOGIC.md §10.3](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_RESOURCE_DOMAIN_LOGIC.md).
* **Multi-Dimensional Pre-Indexing at Scale**: For 100k+ row workloads, the resource that OWNS the rows publishes composite indexes built in ONE pass — `Map<OutletCode, Map<SkuCode, qty>>`, its reverse, and the rollup totals — and every consumer performs `O(1)` reads into them. Sum into an index, never assign (one key can receive several rows). Two modules indexing the same sheet is the drift this rule exists to prevent. Spec: [UI_RESOURCE_DOMAIN_LOGIC.md §10.4](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_RESOURCE_DOMAIN_LOGIC.md).
* **Proactive Domain Elevation**: When Layer 3 work uncovers a missing domain helper, aggregation, or cross-resource projection (e.g. an SKU page needing outlet-wise stock distribution), it MUST NOT be inlined or duplicated in the page/UI composable. Raise it with the user, get confirmation, then implement it in the OWNING resource's Layer 2 module — the resource that owns the rows, not the one whose page discovered the need — honouring every domain invariant (pure builders, O(1) pre-indexing, non-destructive spreading, shared composable wrapper). Spec: [UI_RESOURCE_DOMAIN_LOGIC.md §10.6](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_RESOURCE_DOMAIN_LOGIC.md).
* **Enrich Once, Then Project**: Combine resources at the aggregate boundary (the `src/_resource/` composable), not at the point of display. A component or UI composable that reaches past the enriched record into raw `usePageRecord().items` to re-derive a label, name, or relation it could have read off the aggregate violates both this rule and Single Source of Truth above — it is a second implementation of the enrichment, arrived at by the slowest possible route.

---\

## 7. MOBILE-FIRST & LAYOUT CONTRACT
* **Mobile-First (95%+ target)**: Prioritize vertical fluid layouts and touch target sizes.
* **NO `QTable`**: Do not use `QTable` for listing records due to horizontal scrolling on mobile. Use stacked lists of `QCard` or `QList`/`QItem` instead.
* **Aesthetic Freedom**: Style cards (using elevation, shadows, borders, or flat designs) as appropriate for a premium experience. Do not restrict to "flat/bordered only."
* **Quasar-First**: All frontend layouts must use Quasar components/flex classes. Custom CSS in `custom.scss` is allowed only if Quasar options are completely insufficient.
* **Shared CSS lives in `src/css/custom.scss`**: When a component genuinely needs custom CSS, define it as a named class in `FRONTENT/src/css/custom.scss` and consume it by class name. A component-local `<style>` block is a last resort for rules that are provably single-use and non-reusable.
  * **Resolver-backed components carry NO `<style>` block at all** — anything under `components/sections/`, `components/contents/`, `components/actions/`, or `components/abstract/`. These are override targets: a tenant `.vue` override cannot inherit a scoped style, so scoped CSS silently breaks the override contract. Canonical class families already in `custom.scss`: `.aql-form-actions-*` (sticky form bar), `.aql-resource-action-*` (unified resource-action FABs), `.aql-report-action-*` (report FAB/pill), `.breadcrumb-bar` / `.crumb*` (breadcrumb), `.aql-list-switcher*`, `.aql-detail-*`.
  * Animations must honour `@media (prefers-reduced-motion: reduce)`.

### 7.1 Spacing Invariants (STRICT)

Two rules govern every gap on a page. Both are page-level tokens, never per-component choices — a card that picks its own numbers is how one module drifts away from the rest of the app.

#### 7.1.1 Mandatory Card Gutter

**All vertical space between consecutive cards, lists, sections and grouped blocks MUST resolve from `pageProps.gutter`.**

* Between siblings inside one component: `q-gutter-y-{gutter}` on their container.
* On a card that is not a flex sibling (a `q-list` child, a group card): `q-mb-{gutter}` on the card itself.
* A component that renders cards takes the token as a prop and passes it on — `AqlGroupedList` has a `gutter` prop for exactly this. A page-level `q-gutter-y-*` reaches the list root, never the cards inside it.
* Never hardcode `q-mb-md`, `q-mt-lg`, `q-py-md` or a `style="margin…"` for spacing between blocks.

```html
<!-- WRONG: fixed gap, ignores the page -->
<div class="q-gutter-y-md">

<!-- RIGHT: the page decides -->
<div :class="`q-gutter-y-${attrs.gutter || 'sm'}`">
```

#### 7.1.2 Single-Layer Edge Padding (Anti-Double-Padding)

**The gap between the screen edge and the content edge MUST equal exactly `pageProps.sectionPadding` for a section and `pageProps.contentPadding` for a content — applied once, by one owner.**

`Page.vue` already insets every `<Section>` placeholder with `q-px-{sectionPadding}` and wraps contents in `<AqlContentWrapper class="q-px-{contentPadding}">`. A child that adds its own `q-px-*` on top produces `sm + sm`, and the page's left edge stops lining up with every other page's.

**Who owns the inset:**

| Situation | Who applies `q-px-*` |
|---|---|
| Section with `inheritAttrs: false` (the leaf the resolver mounts) | **The component**, from its declared `padding` prop — `inheritAttrs: false` drops the placeholder's class, so this is the only layer |
| Section with attribute fallthrough on | **`Page.vue`** — the component adds none |
| Content inside `<AqlContentWrapper>` | **The wrapper** — the content adds none |

**Invisible containers never pad.** A wrapper carrying no border, no background and no card surface is not a visual boundary, so padding on it is indistinguishable from padding on its child — and doubles it. If a transparent `div`, a section root or a `q-card-section` holds children that already pad themselves, the outer layer applies none.
