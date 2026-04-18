import { computed, reactive, watch } from 'vue'
import { toPascalCase } from 'src/utils/appHelpers'
import { resolveTieredComponent } from 'src/composables/_resolveTieredComponent'

/**
 * Registries for action-context section overrides.
 * Mirror the ones in useSectionResolver (Vite requires literal glob patterns).
 */
const mastersEntityModules = import.meta.glob([
  '../components/Masters/*/*.vue',
  '!../components/Masters/_custom/**',
  '!../components/Masters/BulkUpload/**'
])
const mastersCustomModules = import.meta.glob('../components/Masters/_custom/**/*.vue')
const operationsEntityModules = import.meta.glob([
  '../components/Operations/*/*.vue',
  '!../components/Operations/_custom/**'
])
const operationsCustomModules = import.meta.glob('../components/Operations/_custom/**/*.vue')

/**
 * Resolves a single action-context section using 5-tier discovery:
 *   1. _custom/{ui}/{Entity}/Action{Section}{Action}.vue   tenant + entity + action
 *   2. _custom/{ui}/{Entity}/Action{Section}.vue           tenant + entity
 *   3. {Entity}/Action{Section}{Action}.vue                entity + action
 *   4. {Entity}/Action{Section}.vue                        entity
 *   5. default component (passed in)
 */
async function resolveActionSection(entityName, sectionName, actionName, defaultComponent, customUIName, scope) {
  const customModules = scope === 'operations' ? operationsCustomModules : mastersCustomModules
  const entityModules = scope === 'operations' ? operationsEntityModules : mastersEntityModules
  const folder = scope === 'operations' ? 'Operations' : 'Masters'
  const actionPascal = actionName ? toPascalCase(actionName) : ''

  const tiers = []
  if (customUIName) {
    if (actionPascal) {
      tiers.push({ modules: customModules, path: `../components/${folder}/_custom/${customUIName}/${entityName}/Action${sectionName}${actionPascal}.vue` })
    }
    tiers.push({ modules: customModules, path: `../components/${folder}/_custom/${customUIName}/${entityName}/Action${sectionName}.vue` })
  }
  if (actionPascal) {
    tiers.push({ modules: entityModules, path: `../components/${folder}/${entityName}/Action${sectionName}${actionPascal}.vue` })
  }
  tiers.push({ modules: entityModules, path: `../components/${folder}/${entityName}/Action${sectionName}.vue` })

  return resolveTieredComponent(tiers, defaultComponent)
}

/**
 * Action-page section resolver with per-action overrides.
 *
 * @param {Object} options
 * @param {import('vue').Ref<string>} options.resourceSlug
 * @param {import('vue').Ref<string>} options.customUIName
 * @param {import('vue').Ref<string>} options.actionKey - current action (e.g. 'Approve')
 * @param {Object} options.sectionDefs - map of section name -> default component
 *   Keys should be bare section names (e.g. 'Header'), not 'ActionHeader'.
 *   Files on disk are prefixed with 'Action' per tier conventions above.
 * @param {string} options.scope - 'masters' | 'operations'
 */
export function useActionResolver({ resourceSlug, customUIName, actionKey, sectionDefs, scope = 'masters' }) {
  const sectionNames = Object.keys(sectionDefs)
  const sections = reactive(
    Object.fromEntries(sectionNames.map((name) => [name, null]))
  )

  async function resolveAll(slug, uiName, actName) {
    const entityName = toPascalCase(slug)
    for (const sectionName of sectionNames) {
      sections[sectionName] = await resolveActionSection(
        entityName,
        sectionName,
        actName,
        sectionDefs[sectionName],
        uiName,
        scope
      )
    }
  }

  watch(
    () => [resourceSlug?.value, customUIName?.value, actionKey?.value],
    async ([slug, uiName, actName]) => {
      sectionNames.forEach((name) => { sections[name] = null })
      if (slug) {
        await resolveAll(slug, uiName || '', actName || '')
      }
    },
    { immediate: true }
  )

  const sectionsReady = computed(() => {
    return sectionNames.every((name) => sections[name] !== null)
  })

  return { sections, sectionsReady }
}
