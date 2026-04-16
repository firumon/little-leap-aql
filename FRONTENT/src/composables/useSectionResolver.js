import { computed, markRaw, reactive, watch } from 'vue'
import { toPascalCase } from 'src/utils/appHelpers'

/**
 * Scans components/Masters/{Entity}/ for entity-level section overrides.
 * Excludes _custom/ and BulkUpload/ subdirectories.
 */
const mastersEntitySectionModules = import.meta.glob([
  '../components/Masters/*/*.vue',
  '!../components/Masters/_custom/**',
  '!../components/Masters/BulkUpload/**'
])

/**
 * Scans components/Masters/_custom/{Code}/ for tenant-custom section overrides.
 */
const mastersCustomSectionModules = import.meta.glob('../components/Masters/_custom/**/*.vue')

/**
 * Scans components/Operations/{Entity}/ for entity-level section overrides.
 */
const operationsEntitySectionModules = import.meta.glob([
  '../components/Operations/*/*.vue',
  '!../components/Operations/_custom/**'
])

/**
 * Scans components/Operations/_custom/{Code}/ for tenant-custom section overrides.
 */
const operationsCustomSectionModules = import.meta.glob('../components/Operations/_custom/**/*.vue')


/**
 * Resolves a single section component using 4-tier discovery:
 *   1. Tenant-custom (entity-specific): components/{Scope}/_custom/{CustomUIName}/{Entity}/{Section}.vue
 *   2. Tenant-custom (cross-entity): components/{Scope}/_custom/{CustomUIName}/{Section}.vue
 *   3. Entity-custom: components/{Scope}/{Entity}/{Section}.vue
 *   4. Default:       (passed in as defaultComponent)
 */
async function resolveSection(entityName, sectionName, defaultComponent, customUIName, scope = 'masters') {

  const customSectionModules = scope === 'operations' ? operationsCustomSectionModules : mastersCustomSectionModules
  const entitySectionModules = scope === 'operations' ? operationsEntitySectionModules : mastersEntitySectionModules
  const folder = scope === 'operations' ? 'Operations' : 'Masters'

  // Tier 1: Tenant-custom (entity-specific)
  if (customUIName) {
    const customEntitySpecificPath = `../components/${folder}/_custom/${customUIName}/${entityName}/${sectionName}.vue`
    if (customSectionModules[customEntitySpecificPath]) {
      try {
        const mod = await customSectionModules[customEntitySpecificPath]()
        return markRaw(mod.default || mod)
      } catch (e) {
        console.warn(`[SectionResolver] Failed to load custom entity-specific ${sectionName} for ${customUIName}/${entityName} in ${scope}`, e)
      }
    }

    // Tier 2: Tenant-custom (cross-entity)
    const customCrossEntityPath = `../components/${folder}/_custom/${customUIName}/${sectionName}.vue`
    if (customSectionModules[customCrossEntityPath]) {
      try {
        const mod = await customSectionModules[customCrossEntityPath]()
        return markRaw(mod.default || mod)
      } catch (e) {
        console.warn(`[SectionResolver] Failed to load custom cross-entity ${sectionName} for ${customUIName} in ${scope}`, e)
      }
    }
  }

  // Tier 3: Entity-custom
  const entityPath = `../components/${folder}/${entityName}/${sectionName}.vue`
  if (entitySectionModules[entityPath]) {
    try {
      const mod = await entitySectionModules[entityPath]()
      return markRaw(mod.default || mod)
    } catch (e) {
      console.warn(`[SectionResolver] Failed to load entity ${sectionName} for ${entityName} in ${scope}`, e)
    }
  }

  // Tier 4: Default
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
 * @param {string} options.scope - Target scope ('masters' or 'operations'). Defaults to 'masters'.
 *
 * @returns {{ sections: Object, sectionsReady: import('vue').ComputedRef<boolean> }}
 *   sections is a reactive object with shallowRef for each section key.
 */
export function useSectionResolver({ resourceSlug, customUIName, sectionDefs, scope = 'masters' }) {
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
        uiName,
        scope
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
