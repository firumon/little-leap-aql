import { ref, watch, shallowRef, markRaw, inject } from 'vue'
import { toPascalCase } from 'src/utils/appHelpers'
import { evaluateProp } from 'src/composables/resources/useSectionResolver'

// Re-exported so content components can evaluate function-valued props exactly the
// way section components do, without reaching into the section resolver themselves.
export { evaluateProp }

// ─── Vite Glob Registries (module-level, built once at startup) ────────────────
//
// Registry 1: Framework-provided content components under src/components/
// Example key: 'components/contents/list.vue'
//
const frameworkContentModules = import.meta.glob('../../components/**/*.{vue,js}')

const frameworkRegistry = {}
Object.keys(frameworkContentModules).forEach((rawPath) => {
  const key = rawPath.replace(/^\.\.\/\.\.\//, '').toLowerCase()
  frameworkRegistry[key] = frameworkContentModules[rawPath]
})

// Registry 2: Tenant/client custom UI overrides under src/_ui/
// Example key: '_ui/aql/components/master/products/index/list.vue'
//
const customUiModules = import.meta.glob('../../_ui/**/*.{vue,js}')

const customUiRegistry = {}
Object.keys(customUiModules).forEach((rawPath) => {
  const key = rawPath.replace(/^\.\.\/\.\.\//, '').toLowerCase()
  customUiRegistry[key] = customUiModules[rawPath]
})

// ─── Composable ───────────────────────────────────────────────────────────────

/**
 * Resolves which content component to render and what final props to pass it,
 * based on a two-step lookup: (1) find a base content, (2) find an override or modifier.
 *
 * Mirrors useSectionResolver, but scoped to the `contents/` folder so page bodies
 * (rendered inside AqlContentWrapper) resolve independently from page sections.
 *
 * @param {ComputedRef<object>} preparedProps - Reactive object containing at minimum:
 *   { content, page, scope, resource, uiName, ...orchestratorState }
 * @param {object|null} defaultComponent - Optional fallback base component.
 */
export function useContentResolver(preparedProps, defaultComponent = null) {
  const ready             = ref(false)
  const resolvedComponent = shallowRef(null)
  const finalProps        = ref({})

  const resourceConfig = inject('resourceConfig', null)
  const resourceRecord = inject('resourceRecord', null)
  const pageState      = inject('pageState', null)

  watch(
    () => {
      const p = preparedProps.value
      return [p.content, p.page, p.scope, p.resource, p.uiName]
    },
    async ([content, page, scope, resource, uiName]) => {
      ready.value = false
      resolvedComponent.value = null
      finalProps.value = {}

      // Normalize all path segments to lowercase for case-insensitive lookup
      const contentKey = (content || '').toLowerCase()
      const pageKey    = (page    || '').toLowerCase()
      const scopeKey   = (scope   || '').toLowerCase()
      const uiKey      = (uiName  || '').toLowerCase()
      // resource slug → PascalCase → lowercase for path (e.g. 'stock-movements' → 'stockmovements')
      const resourceKey = toPascalCase(resource || '').toLowerCase()

      // ── Step 1: Locate the base content component ──────────────────────────
      //
      // Priority order:
      //   a. Custom UI generic content: _ui/${uiName}/components/contents/${content}.vue
      //   b. Framework generic content: components/contents/${content}.vue
      //   c. If neither exists, fall back to a ui-wide Vue override candidate
      //      as the base content.
      //
      const uiBase = uiKey ? `_ui/${uiKey}/components` : null

      // Build the override/modifier candidate list once (first match wins).
      // Also reused for base-content fallback when no custom/framework base exists.
      const overrideCandidates = uiBase
        ? [
            { path: `${uiBase}/${scopeKey}/${resourceKey}/${pageKey}/${contentKey}.vue`, isVueOverride: true  },
            { path: `${uiBase}/${scopeKey}/${resourceKey}/${pageKey}/${contentKey}.js`,  isVueOverride: false },
            { path: `${uiBase}/${scopeKey}/${resourceKey}/${contentKey}.vue`,            isVueOverride: true  },
            { path: `${uiBase}/${scopeKey}/${resourceKey}/${contentKey}.js`,             isVueOverride: false },
            { path: `${uiBase}/${scopeKey}/${pageKey}/${contentKey}.vue`,                isVueOverride: true  },
            { path: `${uiBase}/${scopeKey}/${pageKey}/${contentKey}.js`,                 isVueOverride: false },
            { path: `${uiBase}/${scopeKey}/${contentKey}.vue`,                           isVueOverride: true  },
            { path: `${uiBase}/${scopeKey}/${contentKey}.js`,                            isVueOverride: false },
            { path: `${uiBase}/${contentKey}.vue`,                                       isVueOverride: true  },
            { path: `${uiBase}/${contentKey}.js`,                                        isVueOverride: false },
          ]
        : []

      // Loads a Vue/JS module from the custom UI registry at the given path.
      async function loadCustomUiModule(path) {
        const loader = customUiRegistry[path]
        if (!loader) return null
        try {
          const mod = await loader()
          return mod.default ?? mod
        } catch (err) {
          console.error(`[useContentResolver] Failed to load module at "${path}":`, err)
          return null
        }
      }

      let baseContent = null
      const customBasePath = uiBase ? `${uiBase}/contents/${contentKey}.vue` : null
      if (customBasePath) {
        const mod = await loadCustomUiModule(customBasePath)
        if (mod) baseContent = markRaw(mod)
      }

      if (!baseContent) {
        const frameworkBasePath = `components/contents/${contentKey}.vue`
        const frameworkBaseLoader = frameworkRegistry[frameworkBasePath]
        if (frameworkBaseLoader) {
          try {
            const mod = await frameworkBaseLoader()
            baseContent = markRaw(mod.default ?? mod)
          } catch (err) {
            console.error(`[useContentResolver] Failed to load framework content at "${frameworkBasePath}":`, err)
          }
        }
      }

      // No custom/framework base — let a ui-wide Vue override candidate (isVueOverride)
      // serve as the base content. If nothing resolves here, render the fallback card.
      if (!baseContent) {
        for (const { path, isVueOverride } of overrideCandidates) {
          if (!isVueOverride) continue
          const mod = await loadCustomUiModule(path)
          if (mod) {
            baseContent = markRaw(mod)
            break
          }
        }
      }

      // Still nothing — fall back to the caller-supplied default so a JS modifier can
      // still adjust its props even though it was never registered under contents/.
      if (!baseContent && defaultComponent) {
        baseContent = markRaw(defaultComponent)
      }

      // No base content exists anywhere — render the fallback card
      if (!baseContent) {
        ready.value = true
        return
      }

      // ── Step 2: Look for a page/resource/scope-level override or modifier ──
      //
      // Lookup order (first match wins):
      //   1. Vue override — resource + page specific:  _ui/.../components/${scope}/${resource}/${page}/${content}.vue
      //   2. JS  modifier — resource + page specific:  _ui/.../components/${scope}/${resource}/${page}/${content}.js
      //   3. Vue override — resource specific:         _ui/.../components/${scope}/${resource}/${content}.vue
      //   4. JS  modifier — resource specific:         _ui/.../components/${scope}/${resource}/${content}.js
      //   5. Vue override — page specific:             _ui/.../components/${scope}/${page}/${content}.vue
      //   6. JS  modifier — page specific:             _ui/.../components/${scope}/${page}/${content}.js
      //   7. Vue override — scope-wide:                _ui/.../components/${scope}/${content}.vue
      //   8. JS  modifier — scope-wide:                _ui/.../components/${scope}/${content}.js
      //   9. Vue override — ui-wide:                   _ui/.../components/${content}.vue
      //  10. JS  modifier — ui-wide:                   _ui/.../components/${content}.js
      //
      const currentProps = preparedProps.value

      if (!uiKey) {
        // No custom UI configured — use base content with unmodified props
        resolvedComponent.value = baseContent
        finalProps.value = currentProps
        ready.value = true
        return
      }

      for (const { path, isVueOverride } of overrideCandidates) {
        const loader = customUiRegistry[path]
        if (!loader) continue

        const exported = await loadCustomUiModule(path)
        if (!exported) continue

        if (isVueOverride) {
          // Full Vue template override — replaces the base content entirely.
          // Props flow through unmodified so the override component can use $attrs.
          resolvedComponent.value = markRaw(exported)
          finalProps.value = currentProps
        } else {
          // JS modifier — keeps the base content, adjusts props before passing down.
          const modifiedProps = typeof exported === 'function'
            ? exported(currentProps, { pageState, resourceRecord, resourceConfig })
            : exported
          resolvedComponent.value = baseContent
          finalProps.value = { ...currentProps, ...modifiedProps }
        }

        break // first match wins; stop scanning
      }

      // No override matched — use base content with unmodified props
      if (!resolvedComponent.value) {
        resolvedComponent.value = baseContent
        finalProps.value = currentProps
      }

      ready.value = true
    },
    { immediate: true }
  )

  return { ready, resolvedComponent, finalProps }
}
