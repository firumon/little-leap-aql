import { ref, watch, computed, shallowRef, markRaw, unref } from 'vue'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useRouteConfig } from 'src/composables/resources/useRouteConfig'
import { useRecord } from 'src/composables/resources/useRecord'
import { toPascalCase } from 'src/utils/appHelpers'

// All page JS/Vue files under src/pages/
const pageModules = import.meta.glob('../../pages/**/*.{vue,js}')

// All custom UI overrides under src/_ui/
const customUiModules = import.meta.glob('../../_ui/**/*.{vue,js}')

const pageRegistry = {}
Object.keys(pageModules).forEach((rawPath) => {
  const normalizedKey = rawPath.replace(/^\.\.\/\.\.\//, '').toLowerCase()
  pageRegistry[normalizedKey] = pageModules[rawPath]
})

const customUiRegistry = {}
Object.keys(customUiModules).forEach((rawPath) => {
  const normalizedKey = rawPath.replace(/^\.\.\/\.\.\//, '').toLowerCase()
  customUiRegistry[normalizedKey] = customUiModules[rawPath]
})

// The lookup key every resolver scan below is built from. An action route
// resolves under its ACTION name (`/_action/approve` → `approve.vue`); a
// `resource` / `record` SUB-route resolves under its `:pageSlug`
// (`/operation/outlets/my-custom-page` → `MyCustomPage.js`, and every
// Section/Content/Action beneath it under `components/{Scope}/{Resource}/
// MyCustomPage/`); every other route resolves under its `meta.page` (`index`,
// `add`, `view`, `edit`), as do slug-less `resource` / `record` routes.
//
// The action param is normalized exactly as a resource slug is (`toPascalCase`
// → lowercase), and for the same reason: casing is irrelevant to matching
// because the Vite glob registry lowercases every indexed path, but a HYPHEN is
// not. A raw `mark-delivered` produces the key `mark-delivered`, which
// `MarkDelivered.js` (indexed as `markdelivered.js`) can never match. Folding it
// through PascalCase first drops the separator, so a multi-word action slug can
// be filed under a PascalCase name like every other `_ui/` path segment.
// Single-word slugs are unaffected (`approve` → `approve`).
function resolvePageKey(pageName, action, pageSlug) {
  if (pageName === 'action' && action) return toPascalCase(action).toLowerCase()
  if ((pageName === 'resource' || pageName === 'record') && pageSlug) {
    return toPascalCase(pageSlug).toLowerCase()
  }
  return pageName
}

export function usePageResolver() {
  const resConfig = useResourceConfig()
  const { scope, resourceSlug, resourceName } = resConfig
  const { pageName, pageSlug, action, code, query, path, level, route } = useRouteConfig()

  const canonicalPage = computed(() =>
    resolvePageKey(pageName.value, action.value, pageSlug.value)
  )

  // Record loading. Add/Edit form state and submission are owned by pageState
  // (usePageState.js) + the Create/Update content components + PageAction.vue —
  // see PAGE_STATE.md.
  const resourceRecord = useRecord()

  // Keyed on a primitive, not an array literal, for the same reason as the
  // resolver scan below: `watch` compares a getter's result with Object.is, so a
  // fresh array would re-fire on every re-evaluation and re-request on each
  // background sync.
  watch(
    () => `${resourceName.value ?? ''}|${code.value ?? ''}|${canonicalPage.value ?? ''}`,
    async () => {
      const page = canonicalPage.value
      if (!resourceName.value) return
      // `add` needs no server read, and a custom sub-route page (canonicalPage is
      // its pageSlug) fetches whatever it needs itself.
      if (page !== 'index' && page !== 'view' && !(page === 'edit' && code.value)) return

      await resourceRecord.reload()
      // Only the view page renders parents/children, so nothing else pays for
      // the extra round of relation fetches.
      if (page === 'view' && resourceRecord.record.value) {
        await resourceRecord.loadRelations()
      }
    },
    { immediate: true }
  )

  const customUIName = resConfig.customUIName

  const resolvedPageComponent = shallowRef(null)
  const jsModifier = shallowRef(null)
  const baseContractProps = ref({})
  const notFound = ref(false)
  const checkedPaths = ref([])
  const contractVersion = ref(0)
  const ready = ref(false)

  // Monotonic token guarding against out-of-order async resolves: if the lookup key
  // changes again while a scan awaits a dynamic import, the older scan must not
  // write its result over the newer one.
  let resolveToken = 0

  // Scan candidates
  watch(
    // Primitive key, not an array literal: `watch` compares a getter's result with
    // Object.is and never deep-compares, so a fresh array would re-fire this
    // callback every time any of these computeds merely re-evaluated to the SAME
    // value — e.g. whenever a background sync replaces the auth store's resources
    // array. That reset `ready` to false and flashed the page spinner mid-browse.
    () => `${resourceSlug.value ?? ''}|${canonicalPage.value ?? ''}|${pageName.value ?? ''}|${customUIName.value ?? ''}|${scope.value ?? ''}`,
    async () => {
      const token = ++resolveToken
      const slug    = resourceSlug.value
      const page    = canonicalPage.value
      const routeKind = pageName.value
      const uiName  = customUIName.value
      const scopeVal = scope.value

      // Resolved into locals and committed once at the end. The page component is
      // deliberately NOT nulled up front: doing so unmounts the entire page tree —
      // including every Section/Content/Action beneath it and the Quasar portals
      // they render — only to rebuild it moments later.
      let nextComponent = null
      let nextModifier  = null
      let nextContract  = {}
      const paths = []

      // Spinner only on the first resolve; a later key change keeps the current
      // page rendered until its replacement is ready.
      if (!resolvedPageComponent.value) ready.value = false
      notFound.value = false

      function commit () {
        baseContractProps.value     = nextContract
        jsModifier.value            = nextModifier
        resolvedPageComponent.value = nextComponent
        checkedPaths.value          = paths
        ready.value                 = true
        // Bumped HERE, never from a route-derived getter — the route changes
        // before the contract lands, and firing then uses the old page's hook.
        contractVersion.value++
      }

      if (!slug) {
        notFound.value = true
        commit()
        return
      }

      // ── STAGE A: Load BP (always) ───────────────────────────────────
      // The base contract is looked up under the resolved page key. A custom
      // sub-route resolves to its slug (`MyCustomPage`), and the framework layer
      // is NOT expected to carry an empty `pages/{scope}/mycustompage.js` for
      // every slug an app invents — so when that misses, fall back to the
      // route's generic contract (`resource.js` / `record.js`) and keep its
      // defaults (PageHeader, …) available.
      const bpPath = `pages/${scopeVal}/${page}.js`
      let bpLoader = pageRegistry[bpPath.toLowerCase()]
      paths.push({ path: bpPath, found: !!bpLoader })

      if (!bpLoader && page !== routeKind && (routeKind === 'resource' || routeKind === 'record')) {
        const fallbackPath = `pages/${scopeVal}/${routeKind}.js`
        bpLoader = pageRegistry[fallbackPath.toLowerCase()]
        paths.push({ path: fallbackPath, found: !!bpLoader })
      }

      if (bpLoader) {
        try {
          const mod = await bpLoader()
          nextContract = mod.default ?? mod ?? {}
        } catch (err) {
          console.error(`[usePageResolver] Failed to load BP ${bpPath}:`, err)
        }
      }
      // A newer lookup key superseded this scan mid-import — drop the stale result.
      if (token !== resolveToken) return

      if (!uiName) {
        commit()
        return
      }

      // ── STAGE B: Single ordered scan CC → CP → O2 → O3 → O4 → O5 ──
      // resource slug → PascalCase → lowercase for path (e.g. 'outlet-visits' → 'outletvisits'),
      // exactly as useContentResolver/useSectionResolver/useActionResolver normalize it, so a
      // PascalCase `_ui/.../OutletVisits/` folder matches the lowercased Vite glob registry key.
      const resourceKey = toPascalCase(slug || '').toLowerCase()

      const candidates = [
        { path: `_ui/${uiName}/pages/${scopeVal}/${resourceKey}/${page}.vue`, isVue: true  }, // CC
        { path: `_ui/${uiName}/pages/${scopeVal}/${resourceKey}/${page}.js`,  isVue: false }, // CP
        { path: `_ui/${uiName}/pages/${scopeVal}/${page}.vue`,                isVue: true  }, // O2
        { path: `_ui/${uiName}/pages/${scopeVal}/${page}.js`,                 isVue: false }, // O3
        { path: `_ui/${uiName}/pages/${page}.vue`,                            isVue: true  }, // O4
        { path: `_ui/${uiName}/pages/${page}.js`,                             isVue: false }  // O5
      ]

      for (const { path, isVue } of candidates) {
        const loader = customUiRegistry[path.toLowerCase()]
        paths.push({ path, found: !!loader })
        if (!loader) continue

        try {
          const mod = await loader()
          if (token !== resolveToken) return
          if (isVue) {
            nextComponent = markRaw(mod.default ?? mod)
          } else {
            nextModifier = mod.default ?? mod
          }
          break // first match wins, regardless of type
        } catch (err) {
          console.error(`[usePageResolver] Failed to load ${path}:`, err)
        }
      }

      commit()
    },
    { immediate: true }
  )

  const DEFAULT_SECTIONS = ['PageHeader']
  const DEFAULT_CONTENTS = []

  const sections = computed(() => pageProps.value.sections ?? DEFAULT_SECTIONS)
  const contents = computed(() => pageProps.value.contents ?? DEFAULT_CONTENTS)

  const visibleSectionsBeforeAction = computed(() =>
    sections.value.filter(s => s !== 'PageAction')
  )

  // Assembly pageProps
  const mergedContract = computed(() => {
    const rcProps = {
      page: canonicalPage.value,
      scope: scope.value,
      resource: resourceSlug.value,
      uiName: customUIName.value,
      gutter: 'xs',
      pageClass: '',
      sectionPadding: 'sm',
      sectionClass: '',
      contentPadding: 'sm',
      contentClass: '',
      ignorePadding: ['PageHeader','ListSwitcher'],
      loading: unref(resourceRecord.loading)
    }

    // Resolve BP (function or object)
    const bpExport = baseContractProps.value
    const bpProps = typeof bpExport === 'function' ? bpExport(rcProps) : (bpExport ?? {})

    const baseProps = { ...rcProps, ...bpProps }

    // Apply JS modifier if found
    if (jsModifier.value) {
      const extra = typeof jsModifier.value === 'function'
        ? jsModifier.value(baseProps)
        : jsModifier.value
      return { ...baseProps, ...extra }
    }

    return baseProps
  })

  // `ready` is a hook, not a prop. Kept out of pageProps because pageProps is
  // v-bound onto every Section/Content, where a function key becomes an attr.
  const pageProps = computed(() => {
    const { ready, ...props } = mergedContract.value
    return props
  })

  const pageReady = computed(() => {
    const fn = mergedContract.value.ready
    return typeof fn === 'function' ? fn : null
  })

  // Assembly contentWrapperProps
  const contentWrapperProps = computed(() => {
    const pageVal = canonicalPage.value
    const loadingVal = resourceRecord.loading.value
    const recordVal = resourceRecord.record.value
    const itemsVal = resourceRecord.records.value

    // ONLY MEANINGFUL WHILE NO VIEW IS SELECTED. This gate replaces the whole content
    // area — the List included — with a "no records" card, judged on the count of the
    // page's OWN resource. A list view is free to project a DIFFERENT resource
    // (OutletConsumptionInvoices' "To Invoice" reads OutletConsumptions), and for those
    // the count here answers a question nobody asked: a tenant with 37 outlets waiting to
    // be invoiced but no invoice yet on the books saw its pill say "To Invoice (37)"
    // above an empty card, because the invoices table itself was empty.
    //
    // With a view active the decision belongs to that view, which knows what it is
    // showing and carries its own empty state — usually a better-worded one than this
    // card's generic line.
    if (pageVal === 'index') return {
      loading: loadingVal,
      empty: !loadingVal && itemsVal.length === 0 && !resourceRecord.activeViewName?.value,
      hasData: itemsVal.length > 0
    }
    if (pageVal === 'view') return {
      loading: loadingVal, empty: false,
      requiresRecord: true, recordExists: !!recordVal
    }
    if (pageVal === 'add') return { loading: false, empty: false }
    if (pageVal === 'edit') return {
      loading: loadingVal, empty: false,
      requiresRecord: true, recordExists: !!recordVal
    }
    return { loading: false, empty: false }
  })

  return {
    ready,
    notFound,
    resolvedPageComponent,
    pageProps,
    pageReady,
    contractVersion,
    sections,
    contents,
    visibleSectionsBeforeAction,
    contentWrapperProps,
    resourceConfig: resConfig,
    resourceRecord,
    checkedPaths,
    // Everything a page contract can learn about where it is. Carries the whole
    // of `route` that matters here, so a contract never needs useRoute() — which
    // it could not call anyway, running outside setup.
    routeInfo: computed(() => ({
      scope: resConfig.scope.value,
      resourceSlug: resConfig.resourceSlug.value,
      resourceName: resConfig.resourceName.value,
      page: canonicalPage.value,
      routeKind: pageName.value,
      customUIName: customUIName.value,
      pageSlug: pageSlug.value,
      action: action.value,
      code: code.value,
      level: level.value,
      query: query.value,
      path: path.value,
      fullPath: route.fullPath,
      params: { ...route.params }
    }))
  }
}
