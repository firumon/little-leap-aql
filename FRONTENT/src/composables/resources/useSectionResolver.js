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
 * Resolves local custom Vue templates (Tiers 1-8) and local JS logic modifiers (Tiers 7-8 only).
 */
async function resolveSectionOverride(entityName, sectionName, customUIName, scope, page) {
  const scopeFolder = toPascalCase(scope)
  let resolvedVue = null
  let resolvedJs = null

  // 1. Build customUI (Tenant-custom Tiers 1-6) candidates - VUE ONLY
  const customUiPaths = []
  if (customUIName) {
    customUiPaths.push(`components/_custom/${customUIName}/${scopeFolder}/${entityName}/${page}/${sectionName}.vue`)
    customUiPaths.push(`components/_custom/${customUIName}/${scopeFolder}/${entityName}/${sectionName}.vue`)
    customUiPaths.push(`components/_custom/${customUIName}/${scopeFolder}/${page}/${sectionName}.vue`)
    customUiPaths.push(`components/_custom/${customUIName}/${page}/${sectionName}.vue`)
    customUiPaths.push(`components/_custom/${customUIName}/${scopeFolder}/${sectionName}.vue`)
    customUiPaths.push(`components/_custom/${customUIName}/${sectionName}.vue`)
  }

  // 2. Build local/entity candidates (Tiers 7 & 8)
  const localVuePaths = [
    `components/${scopeFolder}/${entityName}/${page}/${sectionName}.vue`,
    `components/${scopeFolder}/${entityName}/${sectionName}.vue`
  ]
  const localJsPaths = [
    `components/${scopeFolder}/${entityName}/${page}/${sectionName}.js`,
    `components/${scopeFolder}/${entityName}/${sectionName}.js`
  ]

  // Scan customUI first (highest priority) for Vue template override
  for (const path of customUiPaths) {
    if (registry[path]) {
      try {
        const module = await registry[path]()
        resolvedVue = module.default || module
        break
      } catch (err) {
        console.error(`Failed to load custom UI Vue override at ${path}:`, err)
      }
    }
  }

  // Scan Tiers 7 & 8 (local) for Vue template if not found in customUI
  if (!resolvedVue) {
    for (const path of localVuePaths) {
      if (registry[path]) {
        try {
          const module = await registry[path]()
          resolvedVue = module.default || module
          break
        } catch (err) {
          console.error(`Failed to load local Vue override at ${path}:`, err)
        }
      }
    }
  }

  // Scan Tiers 7 & 8 (local) for JS logic modifier
  for (const path of localJsPaths) {
    if (registry[path]) {
      try {
        const module = await registry[path]()
        resolvedJs = module.default || module
        break
      } catch (err) {
        console.error(`Failed to load local JS modifier at ${path}:`, err)
      }
    }
  }

  return { resolvedVue, resolvedJs }
}

/**
 * Resolves custom Vue template overrides and local JS modifiers for a single section.
 */
export function useSectionResolver({ sectionName, page }) {
  const resourceConfig = inject('resourceConfig', null)

  const resourceSlug = computed(() => resourceConfig?.resourceSlug?.value || '')
  const customUIName = computed(() => resourceConfig?.customUIName?.value || '')
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
    propModifier.value = resolvedJs
      ? (props) => {
          const result = typeof resolvedJs === 'function' ? resolvedJs(props) : resolvedJs
          return { ...props, ...result }
        }
      : ((props) => props)
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
