import { ref, watch, computed, shallowRef, markRaw } from 'vue'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { usePageOrchestrator } from 'src/composables/resources/usePageOrchestrator'

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

function resolveActionName(pageName, pageSlug) {
  if (pageName === 'action' && pageSlug) return pageSlug
  return pageName
}

export function usePageResolver() {
  const resConfig = useResourceConfig()
  const {
    scope,
    resourceSlug,
    pageName,
    pageSlug
  } = resConfig

  const canonicalPage = computed(() =>
    resolveActionName(pageName.value, pageSlug.value)
  )

  const customUIName = resConfig.customUIName

  const resolvedPageComponent = shallowRef(null)
  const jsModifier = shallowRef(null)
  const baseContractProps = ref({})
  const notFound = ref(false)
  const checkedPaths = ref([])
  const ready = ref(false)

  // Scan candidates
  watch(
    () => [
      resourceSlug.value,
      canonicalPage.value,
      customUIName.value,
      scope.value
    ],
    async ([slug, page, uiName, scopeVal]) => {
      ready.value = false
      resolvedPageComponent.value = null
      jsModifier.value = null
      baseContractProps.value = {}
      notFound.value = false
      checkedPaths.value = []

      if (!slug) {
        notFound.value = true
        ready.value = true
        return
      }

      // ── STAGE A: Load BP (always) ───────────────────────────────────
      const bpKey = pageName.value === 'resource-page' ? 'resource'
        : pageName.value === 'record-page' ? 'record'
        : page

      const bpPath = `pages/${scopeVal}/${bpKey}.js`
      const bpLoader = pageRegistry[bpPath.toLowerCase()]
      checkedPaths.value.push({ path: bpPath, found: !!bpLoader })

      if (bpLoader) {
        try {
          const mod = await bpLoader()
          baseContractProps.value = mod.default ?? mod ?? {}
        } catch (err) {
          console.error(`[usePageResolver] Failed to load BP ${bpPath}:`, err)
        }
      }

      if (!uiName) {
        ready.value = true
        return
      }

      // ── STAGE B: Single ordered scan CC → CP → O2 → O3 → O4 → O5 ──
      const candidates = [
        { path: `_ui/${uiName}/pages/${scopeVal}/${slug}/${page}.vue`, isVue: true  }, // CC
        { path: `_ui/${uiName}/pages/${scopeVal}/${slug}/${page}.js`,  isVue: false }, // CP
        { path: `_ui/${uiName}/pages/${scopeVal}/${page}.vue`,         isVue: true  }, // O2
        { path: `_ui/${uiName}/pages/${scopeVal}/${page}.js`,          isVue: false }, // O3
        { path: `_ui/${uiName}/pages/${page}.vue`,                     isVue: true  }, // O4
        { path: `_ui/${uiName}/pages/${page}.js`,                      isVue: false }  // O5
      ]

      for (const { path, isVue } of candidates) {
        const loader = customUiRegistry[path.toLowerCase()]
        checkedPaths.value.push({ path, found: !!loader })
        if (!loader) continue

        try {
          const mod = await loader()
          if (isVue) {
            resolvedPageComponent.value = markRaw(mod.default ?? mod)
          } else {
            jsModifier.value = mod.default ?? mod
          }
          break // first match wins, regardless of type
        } catch (err) {
          console.error(`[usePageResolver] Failed to load ${path}:`, err)
        }
      }

      ready.value = true
    },
    { immediate: true }
  )

  const DEFAULT_SECTIONS = ['Header', 'Toolbar', 'Content', 'Action']
  const DEFAULT_CONTENTS = []

  const sections = computed(() => pageProps.value.sections ?? DEFAULT_SECTIONS)
  const contents = computed(() => pageProps.value.contents ?? DEFAULT_CONTENTS)

  const visibleSectionsBeforeAction = computed(() =>
    sections.value.filter(s => s !== 'Action')
  )

  const hasActionSection = computed(() =>
    sections.value.includes('Action')
  )

  // Call the orchestrator
  const orch = usePageOrchestrator(resConfig, canonicalPage)
  const {
    resourceRecord, parentForm, childGroups, saving, actionForm, selectedOutcome,
    currentActionConfig, actionAllowedForRecord, actionName, isMockMultiOutcome,
    outcomeOptions, resolvedActionFields, submitting, handleSave, navigateBack,
    handleSubmit, navigateToView, addChildRecord, removeChildRecord, updateChildField
  } = orch

  // Assembly pageProps
  const pageProps = computed(() => {
    const rcProps = {
      page: canonicalPage.value,
      parentForm,
      childGroups,
      actionForm,
      isMockMultiOutcome: isMockMultiOutcome.value,
      outcomeOptions: outcomeOptions.value,
      resolvedActionFields: resolvedActionFields.value,
      selectedOutcome: selectedOutcome.value,
      loading: resourceRecord.loading,
      saving,
      submitting,
      currentActionConfig: currentActionConfig.value,
      actionAllowedForRecord: actionAllowedForRecord.value,
      actionName: actionName.value,
      onSave: handleSave,
      onCancel: navigateBack,
      onSubmit: handleSubmit,
      onNavigateToView: navigateToView,
      'onUpdate:field': (header, val) => { parentForm[header] = val },
      'onAdd-child': addChildRecord,
      'onRemove-child': removeChildRecord,
      'onUpdate-child-field': updateChildField,
      'onUpdate:selected-outcome': val => { selectedOutcome.value = val },
      'onUpdate:action-field': (header, val) => { actionForm[header] = val }
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
    if (pageVal === 'action') return {
      loading: loadingVal, empty: false,
      requiresRecord: true, recordExists: !!recordVal,
      emptyIcon: 'block',
      emptyTitle: 'Action Unavailable',
      emptyMessage: `Action "${actionName.value}" is not available or not configured for this record.`
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
    hasActionSection,
    contentWrapperProps,
    resourceConfig: resConfig,
    resourceRecord,
    checkedPaths,
    routeInfo: computed(() => ({
      scope: resConfig.scope.value,
      resourceSlug: resConfig.resourceSlug.value,
      page: canonicalPage.value,
      customUIName: customUIName.value,
      pageSlug: resConfig.pageSlug.value
    }))
  }
}
