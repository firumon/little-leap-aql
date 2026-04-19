import { computed, reactive, watch } from 'vue'
import { toPascalCase } from 'src/utils/appHelpers'
import { resolveTieredComponent } from 'src/composables/resources/_resolveTieredComponent'

/**
 * Scans components/Masters/{Entity}/ for entity-level section overrides.
 * Excludes _custom/ and BulkUpload/ subdirectories.
 */
const mastersEntitySectionModules = import.meta.glob([
  '../../components/Masters/*/*.vue',
  '!../../components/Masters/_custom/**',
  '!../../components/Masters/BulkUpload/**'
])

/**
 * Scans components/Masters/_custom/{Code}/ for tenant-custom section overrides.
 */
const mastersCustomSectionModules = import.meta.glob('../../components/Masters/_custom/**/*.vue')

/**
 * Scans components/Operations/{Entity}/ for entity-level section overrides.
 */
const operationsEntitySectionModules = import.meta.glob([
  '../../components/Operations/*/*.vue',
  '!../../components/Operations/_custom/**'
])

/**
 * Scans components/Operations/_custom/{Code}/ for tenant-custom section overrides.
 */
const operationsCustomSectionModules = import.meta.glob('../../components/Operations/_custom/**/*.vue')


/**
 * Resolves a single section component using 4-tier discovery:
 *   1. Tenant-custom (entity-specific): components/{Scope}/_custom/{CustomUIName}/{Entity}/{Section}.vue
 *   2. Tenant-custom (cross-entity):    components/{Scope}/_custom/{CustomUIName}/{Section}.vue
 *   3. Entity-custom:                   components/{Scope}/{Entity}/{Section}.vue
 *   4. Default:                         (passed in as defaultComponent)
 */
async function resolveSection(entityName, sectionName, defaultComponent, customUIName, scope = 'masters') {
  const customModules = scope === 'operations' ? operationsCustomSectionModules : mastersCustomSectionModules
  const entityModules = scope === 'operations' ? operationsEntitySectionModules : mastersEntitySectionModules
  const folder = scope === 'operations' ? 'Operations' : 'Masters'

  const tiers = []
  if (customUIName) {
    tiers.push({ modules: customModules, path: `../../components/${folder}/_custom/${customUIName}/${entityName}/${sectionName}.vue` })
    tiers.push({ modules: customModules, path: `../../components/${folder}/_custom/${customUIName}/${sectionName}.vue` })
  }
  tiers.push({ modules: entityModules, path: `../../components/${folder}/${entityName}/${sectionName}.vue` })

  return resolveTieredComponent(tiers, defaultComponent)
}

/**
 * Generic section resolver for any page action.
 *
 * @param {Object} options
 * @param {import('vue').Ref<string>} options.resourceSlug
 * @param {import('vue').Ref<string>} options.customUIName
 * @param {Object} options.sectionDefs
 * @param {string} options.scope - 'masters' | 'operations'
 *
 * @returns {{ sections: Object, sectionsReady: import('vue').ComputedRef<boolean> }}
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
