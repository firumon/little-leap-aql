import { computed, markRaw, reactive, watch } from 'vue'

/**
 * Scans components/Masters/{Entity}/ for entity-level section overrides.
 * Excludes _custom/ and BulkUpload/ subdirectories.
 */
const entitySectionModules = import.meta.glob([
  '../components/Masters/*/*.vue',
  '!../components/Masters/_custom/**',
  '!../components/Masters/BulkUpload/**'
])

/**
 * Scans components/Masters/_custom/{Code}/ for tenant-custom section overrides.
 */
const customSectionModules = import.meta.glob('../components/Masters/_custom/**/*.vue')

function toPascalCase(slug) {
  if (!slug) return ''
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')
}

/**
 * Resolves a single section component using 3-tier discovery:
 *   1. Tenant-custom: components/Masters/_custom/{Code}/{Entity}{Action}{Section}.vue
 *   2. Entity-custom: components/Masters/{Entity}/{Action}{Section}.vue
 *   3. Default:       (passed in as defaultComponent)
 */
async function resolveSection(entityName, sectionName, defaultComponent, customUIName) {
  // Tier 1: Tenant-custom
  if (customUIName) {
    const customPath = `../components/Masters/_custom/${customUIName}/${entityName}${sectionName}.vue`
    if (customSectionModules[customPath]) {
      try {
        const mod = await customSectionModules[customPath]()
        return markRaw(mod.default || mod)
      } catch (e) {
        console.warn(`[SectionResolver] Failed to load custom ${sectionName} for ${customUIName}/${entityName}`, e)
      }
    }
  }

  // Tier 2: Entity-custom
  const entityPath = `../components/Masters/${entityName}/${sectionName}.vue`
  if (entitySectionModules[entityPath]) {
    try {
      const mod = await entitySectionModules[entityPath]()
      return markRaw(mod.default || mod)
    } catch (e) {
      console.warn(`[SectionResolver] Failed to load entity ${sectionName} for ${entityName}`, e)
    }
  }

  // Tier 3: Default
  return markRaw(defaultComponent)
}

/**
 * Generic section resolver for any page action.
 *
 * @param {Object} options
 * @param {import('vue').Ref<string>} options.resourceSlug - Resource slug from route (e.g., 'products')
 * @param {import('vue').Ref<string>} options.customUIName - CustomUIName from resource config (e.g., 'A2930')
 * @param {Object} options.sectionDefs - Map of section names to their default components
 *   e.g., { ListHeader: MasterListHeader, ListReportBar: MasterListReportBar, ... }
 *
 * @returns {{ sections: Object, sectionsReady: import('vue').ComputedRef<boolean> }}
 *   sections is a reactive object with shallowRef for each section key.
 */
export function useSectionResolver({ resourceSlug, customUIName, sectionDefs }) {
  const sectionNames = Object.keys(sectionDefs)
  const sections = reactive(
    Object.fromEntries(sectionNames.map((name) => [name, null]))
  )

  async function resolveSections(slug, uiName) {
    const entityName = toPascalCase(slug)
    for (const sectionName of sectionNames) {
      sections[sectionName] = await resolveSection(
        entityName,
        sectionName,
        sectionDefs[sectionName],
        uiName
      )
    }
  }

  watch(
    () => [resourceSlug?.value, customUIName?.value],
    async ([slug, uiName]) => {
      sectionNames.forEach((name) => { sections[name] = null })
      if (slug) {
        await resolveSections(slug, uiName || '')
      }
    },
    { immediate: true }
  )

  const sectionsReady = computed(() => {
    return sectionNames.every((name) => sections[name] !== null)
  })

  return { sections, sectionsReady }
}
