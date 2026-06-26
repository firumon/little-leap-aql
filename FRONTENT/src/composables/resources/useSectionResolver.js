import { computed, reactive, watch, markRaw } from 'vue'
import { useRoute } from 'vue-router'
import { toPascalCase } from 'src/utils/appHelpers'

// Vite statically discovers all component Vue files under src/components
const sectionModules = import.meta.glob('../../components/**/*.vue')

// Build normalized registry (e.g., "components/_common/List/Header.vue")
export const registry = {}
Object.keys(sectionModules).forEach((rawPath) => {
  const normalizedKey = rawPath.replace(/^\.\.\/\.\.\/components\//, 'components/')
  registry[normalizedKey] = sectionModules[rawPath]
})

/**
 * Resolves a single section component using 12-tier discovery.
 */
async function resolveSection(entityName, sectionFilename, defaultComponent, customUIName, scope, page, actionKey) {
  const scopeFolder = toPascalCase(scope)
  const actionPascal = actionKey ? toPascalCase(actionKey) : ''
  const candidates = []

  // Helper to push variant and generic files for a given directory path
  function addPaths(dir) {
    if (actionPascal) {
      candidates.push(`${dir}/${actionPascal}${sectionFilename}.vue`)
    }
    candidates.push(`${dir}/${sectionFilename}.vue`)
  }

  // 12-Tier Resolution checklist:
  // Tier 1: Tenant-custom, Entity-specific, Page-specific
  if (customUIName) {
    addPaths(`components/_custom/${customUIName}/${scopeFolder}/${entityName}/${page}`)
    // Tier 2: Tenant-custom, Entity-specific, Page-generic
    addPaths(`components/_custom/${customUIName}/${scopeFolder}/${entityName}`)
    // Tier 3: Tenant-custom, Scope-common, Page-specific
    addPaths(`components/_custom/${customUIName}/${scopeFolder}/${page}`)
    // Tier 4: Tenant-custom, Global Page-specific (Scope-generic)
    addPaths(`components/_custom/${customUIName}/${page}`)
    // Tier 5: Tenant-custom, Scope-common, Page-generic
    addPaths(`components/_custom/${customUIName}/${scopeFolder}`)
    // Tier 6: Tenant-custom, Tenant-global
    addPaths(`components/_custom/${customUIName}`)
  }

  // Tier 7: Entity-custom, Page-specific
  addPaths(`components/${scopeFolder}/${entityName}/${page}`)
  // Tier 8: Entity-custom, Page-generic
  addPaths(`components/${scopeFolder}/${entityName}`)

  // Tier 9: Scope-common, Page-specific
  addPaths(`components/_common/${scopeFolder}/${page}`)
  // Tier 10: Scope-common, Scope-generic
  addPaths(`components/_common/${scopeFolder}`)

  // Tier 11: Global-common, Page-specific
  addPaths(`components/_common/${page}`)
  // Tier 12: Global-common (Global fallback)
  addPaths(`components/_common`)

  // Check the checklist in order
  for (const path of candidates) {
    if (registry[path]) {
      try {
        const module = await registry[path]()
        return module.default || module
      } catch (err) {
        console.error(`Failed to load component section at ${path}:`, err)
      }
    }
  }

  return defaultComponent
}

/**
 * Hierarchical section resolver.
 *
 * @param {Object} options
 * @param {import('vue').Ref<string>} options.resourceSlug
 * @param {import('vue').Ref<string>} options.customUIName
 * @param {import('vue').Ref<string>|string} [options.scope]
 * @param {string} [options.page]
 * @param {import('vue').Ref<string>|string} [options.actionKey]
 * @param {Object} options.sectionDefs - map of section name -> target string, default component, or definition object
 *
 * @returns {{ sections: Object, sectionsReady: import('vue').ComputedRef<boolean> }}
 */
export function useSectionResolver({ resourceSlug, customUIName, scope, page, actionKey, sectionDefs }) {
  const route = useRoute()
  const sectionNames = Object.keys(sectionDefs)
  const sections = reactive(
    Object.fromEntries(sectionNames.map((name) => [name, null]))
  )

  const resolvedScope = computed(() => {
    return (typeof scope === 'object' && scope !== null && 'value' in scope)
      ? scope.value
      : (typeof scope === 'function' ? scope() : scope || 'masters')
  })

  const resolvedActionKey = computed(() => {
    return (typeof actionKey === 'object' && actionKey !== null && 'value' in actionKey)
      ? actionKey.value
      : (typeof actionKey === 'function' ? actionKey() : actionKey || '')
  })

  const derivedPage = computed(() => {
    if (page) return page
    const act = route.meta?.action || route.params.action || 'index'
    if (act === 'index') return 'Index'
    if (act === 'add') return 'Add'
    if (act === 'edit') return 'Edit'
    if (act === 'view') return 'View'
    if (act === 'action' || act === 'resource-page' || act === 'record-page') return 'Action'
    return 'Action'
  })

  async function resolveSections(slug, uiName, scopeVal, pageVal, actionKeyVal) {
    for (const sectionName of sectionNames) {
      let sectionFilename = sectionName
      let defaultComponent = null

      const def = sectionDefs[sectionName]
      if (typeof def === 'string') {
        sectionFilename = def
      } else if (def && typeof def === 'object' && 'section' in def) {
        sectionFilename = def.section
        defaultComponent = def.default
      } else if (def) {
        defaultComponent = def
      }

      const resolvedComp = await resolveSection(
        toPascalCase(slug),
        sectionFilename,
        defaultComponent,
        uiName,
        scopeVal,
        pageVal,
        actionKeyVal
      )
      sections[sectionName] = resolvedComp ? markRaw(resolvedComp) : null
    }
  }

  watch(
    () => [resourceSlug?.value, customUIName?.value, resolvedScope.value, derivedPage.value, resolvedActionKey.value],
    async ([slug, uiName, scopeVal, pageVal, actionKeyVal]) => {
      sectionNames.forEach((name) => { sections[name] = null })
      if (slug) {
        await resolveSections(slug, uiName || '', scopeVal, pageVal, actionKeyVal)
      }
    },
    { immediate: true }
  )

  const sectionsReady = computed(() => {
    return sectionNames.every((name) => sections[name] !== null)
  })

  return { sections, sectionsReady }
}
