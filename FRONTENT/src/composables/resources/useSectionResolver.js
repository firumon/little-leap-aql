import { computed, ref, shallowRef, watch, markRaw, inject } from 'vue'
import { toPascalCase } from 'src/utils/appHelpers'

// Vite statically discovers all component Vue and JS files under src/components
const sectionModules = import.meta.glob('../../components/**/*.{vue,js}')

// Build normalized registry (e.g., "components/_common/List/Header.vue")
export const registry = {}
Object.keys(sectionModules).forEach((rawPath) => {
  const normalizedKey = rawPath.replace(/^\.\.\/\.\.\/components\//, 'components/')
  registry[normalizedKey] = sectionModules[rawPath]
})

/**
 * Resolves local custom Vue (template-only) and JS (logic modifier) section files using Tiers 1-8 lookup.
 */
async function resolveSectionOverride(entityName, sectionName, customUIName, scope, page) {
  const scopeFolder = toPascalCase(scope)
  const candidates = []

  function addPaths(dir) {
    candidates.push(`${dir}/${sectionName}`)
  }

  // Tiers 1-8 Resolution checklist (custom/local overrides only, no common fallbacks):
  if (customUIName) {
    // Tier 1: Tenant-custom, Entity-specific, Page-specific
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

  let resolvedVue = null
  let resolvedJs = null

  // Check the checklist in order
  for (const basePath of candidates) {
    const vuePath = `${basePath}.vue`
    const jsPath = `${basePath}.js`

    // Look for Vue template
    if (registry[vuePath] && !resolvedVue) {
      try {
        const module = await registry[vuePath]()
        const comp = module.default || module
        const hasTemplate = !!(comp && (comp.render || comp.ssrRender || typeof comp === 'function'))
        if (hasTemplate) {
          resolvedVue = comp
        }
      } catch (err) {
        console.error(`Failed to load Vue override at ${vuePath}:`, err)
      }
    }

    // Look for JS logic modifier
    if (registry[jsPath] && !resolvedJs) {
      try {
        const module = await registry[jsPath]()
        resolvedJs = module.default || module
      } catch (err) {
        console.error(`Failed to load JS override at ${jsPath}:`, err)
      }
    }

    // Stop searching once we have resolved both components
    if (resolvedVue && resolvedJs) {
      break
    }
  }

  return { resolvedVue, resolvedJs }
}

/**
 * Resolves custom Vue and JS overrides for a single section.
 */
export function useSectionResolver({ sectionName, page }) {
  const resourceConfig = inject('resourceConfig', null)

  const resourceSlug = computed(() => resourceConfig?.resourceSlug?.value || '')
  const customUIName = computed(() => resourceConfig?.config?.value?.ui?.customUIName || resourceConfig?.customUIName?.value || '')
  const scope = computed(() => resourceConfig?.scope?.value || 'masters')

  const resolvedComponent = shallowRef(null)
  const propModifier = shallowRef((props) => props)
  const sectionsReady = ref(false)

  async function resolve() {
    sectionsReady.value = false
    const entityName = toPascalCase(resourceSlug.value)

    if (!resourceSlug.value) {
      resolvedComponent.value = null
      propModifier.value = (props) => props
      sectionsReady.value = true
      return
    }

    const { resolvedVue, resolvedJs } = await resolveSectionOverride(
      entityName,
      sectionName,
      customUIName.value,
      scope.value,
      page
    )

    resolvedComponent.value = resolvedVue ? markRaw(resolvedVue) : null
    propModifier.value = resolvedJs || ((props) => props)
    sectionsReady.value = true
  }

  watch(
    () => [resourceSlug.value, customUIName.value, scope.value, page],
    async () => {
      await resolve()
    },
    { immediate: true }
  )

  return {
    resolvedComponent,
    propModifier,
    sectionsReady
  }
}
