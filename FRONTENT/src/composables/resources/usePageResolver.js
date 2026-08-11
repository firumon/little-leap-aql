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
// resolves under its ACTION name (`/_action/approve` → `approve.vue`); every
// other route resolves under its `meta.page` (`index`, `add`, `view`, `edit`,
// `resource`, `record`).
//
// The action param is normalized exactly as a resource slug is (`toPascalCase`
// → lowercase), and for the same reason: casing is irrelevant to matching
// because the Vite glob registry lowercases every indexed path, but a HYPHEN is
// not. A raw `mark-delivered` produces the key `mark-delivered`, which
// `MarkDelivered.js` (indexed as `markdelivered.js`) can never match. Folding it
// through PascalCase first drops the separator, so a multi-word action slug can
// be filed under a PascalCase name like every other `_ui/` path segment.
// Single-word slugs are unaffected (`approve` → `approve`).
function resolveActionName(pageName, action) {
  if (pageName === 'action' && action) return toPascalCase(action).toLowerCase()
  return pageName
}

export function usePageResolver() {
  const resConfig = useResourceConfig()
  const { scope, resourceSlug, resourceName } = resConfig
  const { pageName, pageSlug, action, code } = useRouteConfig()

  const canonicalPage = computed(() =>
    resolveActionName(pageName.value, action.value)
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
    () => `${resourceSlug.value ?? ''}|${canonicalPage.value ?? ''}|${customUIName.value ?? ''}|${scope.value ?? ''}`,
    async () => {
      const token = ++resolveToken
      const slug    = resourceSlug.value
      const page    = canonicalPage.value
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
      }

      if (!slug) {
        notFound.value = true
        commit()
        return
      }

      // ── STAGE A: Load BP (always) ───────────────────────────────────
      // `resource` / `record` name their base contract directly (pages/{scope}/
      // resource.js, record.js); every other route uses its resolved page key.
      const bpPath = `pages/${scopeVal}/${page}.js`
      const bpLoader = pageRegistry[bpPath.toLowerCase()]
      paths.push({ path: bpPath, found: !!bpLoader })

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
  const pageProps = computed(() => {
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

  // Assembly contentWrapperProps
  const contentWrapperProps = computed(() => {
    const pageVal = canonicalPage.value
    const loadingVal = resourceRecord.loading.value
    const recordVal = resourceRecord.record.value
    const itemsVal = resourceRecord.records.value

    if (pageVal === 'index') return {
      loading: loadingVal,
      empty: !loadingVal && itemsVal.length === 0,
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
    sections,
    contents,
    visibleSectionsBeforeAction,
    contentWrapperProps,
    resourceConfig: resConfig,
    resourceRecord,
    checkedPaths,
    routeInfo: computed(() => ({
      scope: resConfig.scope.value,
      resourceSlug: resConfig.resourceSlug.value,
      page: canonicalPage.value,
      customUIName: customUIName.value,
      pageSlug: pageSlug.value,
      action: action.value
    }))
  }
}
