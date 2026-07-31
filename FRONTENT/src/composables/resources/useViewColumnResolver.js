import { ref, shallowRef, watch, markRaw, toValue } from 'vue'
import { toPascalCase } from 'src/utils/appHelpers'

// ─── Vite Glob Registry (module-level, built once at startup) ──────────────────
const customUiModules = import.meta.glob('../../_ui/**/*.{vue,js}')

const customUiRegistry = {}
Object.keys(customUiModules).forEach((rawPath) => {
  const key = rawPath.replace(/^\.\.\/\.\.\//, '').toLowerCase()
  customUiRegistry[key] = customUiModules[rawPath]
})

/**
 * Resolves a single column-level custom UI override (ViewColumn<Col>.(vue|js)).
 *
 * The lookup uses the RESOURCE THAT OWNS THE COLUMN — for a parent record this is
 * the parent resource, regardless of the current page resource.
 *
 * Candidate paths (all lowercase, first match wins):
 *   _ui/{ui}/components/{scope}/{resourceSlug}/viewcolumn{col}.(vue|js)
 *   _ui/{ui}/components/{scope}/viewcolumn{col}.(vue|js)
 *   _ui/{ui}/components/viewcolumn{col}.(vue|js)
 *
 * @returns {Promise<{ component: object|null, modifier: Function|object|null }>}
 */
export async function resolveColumnOverride({ columnName, resourceSlug, scope, uiName }) {
  const uiKey = (uiName || '').toLowerCase()
  if (!uiKey || !columnName) return { component: null, modifier: null }

  const scopeKey = (scope || '').toLowerCase()
  const resourceKey = toPascalCase(resourceSlug || '').toLowerCase()
  const colName = String(columnName).toLowerCase()
  const uiBase = `_ui/${uiKey}/components`

  const candidates = [
    { path: `${uiBase}/${scopeKey}/${resourceKey}/viewcolumn${colName}.vue`, isVue: true },
    { path: `${uiBase}/${scopeKey}/${resourceKey}/viewcolumn${colName}.js`, isVue: false },
    { path: `${uiBase}/${scopeKey}/viewcolumn${colName}.vue`, isVue: true },
    { path: `${uiBase}/${scopeKey}/viewcolumn${colName}.js`, isVue: false },
    { path: `${uiBase}/viewcolumn${colName}.vue`, isVue: true },
    { path: `${uiBase}/viewcolumn${colName}.js`, isVue: false }
  ]

  for (const { path, isVue } of candidates) {
    const loader = customUiRegistry[path]
    if (!loader) continue
    try {
      const mod = await loader()
      const exported = mod.default ?? mod
      if (isVue) return { component: markRaw(exported), modifier: null }
      if (typeof exported === 'function' || (typeof exported === 'object' && exported !== null)) {
        return { component: null, modifier: exported }
      }
    } catch (err) {
      console.error(`[useViewColumnResolver] Failed to load module at "${path}":`, err)
    }
  }

  return { component: null, modifier: null }
}

/**
 * Reactive single-column resolver composable.
 */
export function useViewColumnResolver({ columnName, resourceSlug, scope, uiName }) {
  const resolvedComponent = shallowRef(null)
  const modifier = ref(null)

  // Primitive key, not an array literal: `watch` compares a getter's result with
  // Object.is and never deep-compares, so a fresh array would re-fire this callback
  // (and its dynamic-import scan) on every re-evaluation, once per rendered column.
  let resolveToken = 0

  watch(
    () => `${toValue(columnName) ?? ''}|${toValue(resourceSlug) ?? ''}|${toValue(scope) ?? ''}|${toValue(uiName) ?? ''}`,
    async () => {
      const token = ++resolveToken
      const { component, modifier: mod } = await resolveColumnOverride({
        columnName:   toValue(columnName),
        resourceSlug: toValue(resourceSlug),
        scope:        toValue(scope),
        uiName:       toValue(uiName)
      })
      // A newer key superseded this scan mid-import — drop the stale result.
      if (token !== resolveToken) return
      resolvedComponent.value = component
      modifier.value = mod
    },
    { immediate: true }
  )

  return { resolvedComponent, modifier }
}
