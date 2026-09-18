# Record Access Architecture

This document explains how code reads records in the app.

---

## 1. The Three Record Names

Three things in the app share the word "record". Each one has a different job, lives in a different file, and has different callers.

| Name | File | What it is for | Who may call it |
|---|---|---|---|
| `useRecord()` | `FRONTENT/src/composables/resources/useRecord.js` | Core record singleton. Reads raw rows from the data store, enriches them, and builds indexes. | Logic layer (`_resource/`), `usePageRecord`. |
| `usePageRecord()` | `FRONTENT/src/composables/resources/usePageRecord.js` | Page record composable. Reads route parameters to manage page records, lists, views, paging, and reloads. | Page setup in `usePageResolver.js` (provided to UI as `resourceRecord`). |
| `pageState.useRecord()` | `FRONTENT/src/composables/resources/usePageStateMutations.js` | Method on `pageState`. Binds a single form field node to a resource code. | Form components and page actions using `pageState`. |

> [!NOTE]
> `pageState.useRecord(key, resource, role)` is a method on `pageState`, not a composable. It does not load records or read lists. It only binds form fields.

---

## 2. Layer Flow

Data flows in one direction from top to bottom:

```
Data Store (Pinia)
       │
       ▼
  useRecord()           (Core singleton)
   ├───┼───┐
   │   │   └──► Logic Layer (_resource/ modules)
   │   │
   │   └──────► usePageRecord()  (Page composable in setup)
   │                   │
   ▼                   ▼
UI Layer (_ui/, Pages, Components)
```

1. The data store holds the raw sheet data.
2. `useRecord()` is the only reader of the data store for records.
3. The logic layer (`_resource/`) calls `useRecord()` for all record and index data.
4. `usePageRecord()` wraps `useRecord()` with page concerns (route, views, search, paging).
5. The UI layer (`_ui/`, pages, components) reads its own record from the injected `resourceRecord`. It reads other resources through their Layer 2 modules (`_resource/`).

---

## 3. The `useRecord()` API

`useRecord()` takes no arguments. It returns a singleton object cached across the app:

```javascript
import { useRecord } from 'src/composables/resources/useRecord'

const recordSource = useRecord()
```

The returned object provides:

- `rows(resource)`: Returns a plain array of raw row objects (`{ Code, ... }`) — no relation keys. It is not a `computed`, so read it inside your own `computed()` when you need the result to stay reactive.
- `enrich(resource, code)`: One record by its code, as a reactive Proxy. Sheet columns read straight through; `$parent`, `$Children` and `_relation` resolve on access. Returns `null` when either argument is missing.
- `enriched(resource)`: A plain array of every record in the resource, each one enriched. Not a `computed` — wrap it if you need reactivity.
- `recordsBy(resource, header, value)`: An array of the enriched records whose `header` equals `value`. Backed by one shared `O(1)` index per resource and header, built on first use. Returns `[]` when nothing matches or any argument is blank.
- `recordBy(resource, header, value)`: The first enriched record whose `header` equals `value`, or `null`. With `header` set to `'Code'` it is a direct map read, not an index scan.
- `indexOf(resource, header)`: Returns the unwrapped `Map` of value → rows from `getIndex`. Read inside a `computed`, it tracks the index. The rows in the map are raw store rows (read-only, not enriched proxies), and blank values are skipped. Use for fast grouping across a whole column.
- `relations(resource)`: The resource's relation metadata — `parents`, `children`, `linkRefs`, `refs`.
- `isLoading(resource)`: A plain `true`/`false` saying whether that resource is fetching right now. Not a ref.
- `remember(key, build)`: Runs a build function once inside the long-lived store scope and caches the result forever. Use this for shared domain projections and option lists.

---

## 4. The `usePageRecord()` Composable

`usePageRecord(resourceNameOverride?, codeOverride?)` runs inside Vue `setup()`. It reads active route parameters using `useRouteConfig()`.

It wraps `useRecord()` and adds page-level features:
- `record`: The active single record matching the route code.
- `records` / `items`: The reactive list of records for the active resource.
- `filteredRecords` / `filteredItems`: The list after applying the search filter.
- `filterTerm`: Reactive search string bound to the page search bar.
- `currentPage`: Current page number for list pagination.
- `effectiveViews`, `activeViewName`, `activeView`, `setActiveView`: View tabs and filters.
- `reload()`: Refreshes records and sync status for the page.
- `loadRelations()`: Loads child and parent records for the active record.

`usePageResolver.js` calls `usePageRecord()` once per page and provides it under the name `resourceRecord`. UI components inject `resourceRecord` rather than calling `usePageRecord()` themselves.

---

## 5. Shared Projections with `remember(key, build)`

A domain projection (like an option list, total stock map, or status bucket) must be built once for the whole app. It must not be rebuilt per component call site.

`recordSource.remember(key, build)` solves this:

```javascript
const build = (recordSource) => {
  const options = computed(() => {
    return recordSource.rows('Products').map((p) => ({ label: p.Name, value: p.Code }))
  })
  return { options }
}

export function useProductResource () {
  const recordSource = useRecord()
  return recordSource.remember('useProductResource', () => build(recordSource))
}
```

Key points:
- **Key naming rule**: The cache key must match the exported composable name (e.g. `'useProductResource'`). Every key must be unique across the app.
- **Built once**: The factory runs the first time the function is called. Future calls return the cached object.
- **Survives unmount**: Built inside a detached scope on the store. It does not stop when a component leaves the screen.
- **Stays reactive**: The computed properties track the store rows and update when new data arrives.

---

## 6. Rules per Layer

### Layer 1: Data Store
- Holds raw tables and cache sync.
- Does not import composables.

### Layer 2: Logic Layer (`FRONTENT/src/_resource/`)
- Calls `useRecord()` for record access.
- Never imports `useDataStore` or `src/stores/data`.
- Wraps shared indexes and option lists with `recordSource.remember(...)`.

### Layer 3: UI Layer (`FRONTENT/src/_ui/`, Pages, Components)
- Never imports `useDataStore` or `src/stores/data`.
- Never imports `useRecord`.
- Reads its own page record from the injected `resourceRecord`.
- Reads other resources by calling their Layer 2 composables (`_resource/`).

---

## 7. Do Not Do This

- **DO NOT** import `useDataStore` in UI components or Layer 2 modules. All record reads go through `useRecord` or `usePageRecord`.
- **DO NOT** import `useRecord` in UI components. Use the injected `resourceRecord` for the page's record, or call the owning resource's Layer 2 module.
- **DO NOT** build a custom `find()` or `filter()` loop over rows when `recordSource.recordsBy` or `recordSource.recordBy` already indexes them in `O(1)`.
- **DO NOT** build option lists inside UI composables. Build them in the owning resource's Layer 2 module with `remember()`.
- **DO NOT** mix up `useRecord()` with `pageState.useRecord()`. One is a record source; the other is a form field binding method.
