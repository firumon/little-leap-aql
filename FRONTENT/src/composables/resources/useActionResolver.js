import { ref, watch, computed, shallowRef, markRaw, inject } from 'vue'
import { toPascalCase } from 'src/utils/appHelpers'
import { evaluateProp } from 'src/composables/resources/useSectionResolver'

// Re-exported so action components can evaluate function-valued props exactly the
// way section/content components do, without reaching into the section resolver.
export { evaluateProp }

// ─── Vite Glob Registries (module-level, built once at startup) ────────────────
//
// Registry 1: Framework-provided action components under src/components/
// Example key: 'components/actions/formactionsubmit.vue'
//
const frameworkActionModules = import.meta.glob('../../components/**/*.{vue,js}')

const frameworkRegistry = {}
Object.keys(frameworkActionModules).forEach((rawPath) => {
  const key = rawPath.replace(/^\.\.\/\.\.\//, '').toLowerCase()
  frameworkRegistry[key] = frameworkActionModules[rawPath]
})

// Registry 2: Tenant/client custom UI overrides under src/_ui/
// Example key: '_ui/aql/components/master/products/add/formactionsubmit.vue'
//
const customUiModules = import.meta.glob('../../_ui/**/*.{vue,js}')

const customUiRegistry = {}
Object.keys(customUiModules).forEach((rawPath) => {
  const key = rawPath.replace(/^\.\.\/\.\.\//, '').toLowerCase()
  customUiRegistry[key] = customUiModules[rawPath]
})

// ─── Composable ───────────────────────────────────────────────────────────────

/**
 * Resolves which action component to render and what final props to pass it,
 * based on a two-step lookup: (1) find a base action, (2) find an override or modifier.
 *
 * Mirrors useSectionResolver / useContentResolver, but scoped to the `actions/`
 * folder so page-level actions (PageAction, FormActions, the individual form
 * buttons, CrudActions) resolve independently from page sections and contents.
 *
 * Unlike useSectionResolver/useContentResolver — which snapshot their merged props
 * inside the watch — `finalProps` here is a computed over the LIVE `preparedProps`.
 * Action props change without changing any lookup key all the time (a submit button
 * enabling once an outcome is picked, a label switching on record status), and a
 * snapshot would silently freeze them at first resolve. Only the JS-modifier result
 * is cached, since that is what the async scan produced.
 *
 * @param {ComputedRef<object>} preparedProps - Reactive object containing at minimum:
 *   { action, page, scope, resource, uiName, ...orchestratorState }
 * @param {object|null} defaultComponent - Optional fallback base component.
 */
export function useActionResolver(preparedProps, defaultComponent = null) {
  const ready             = ref(false)
  const resolvedComponent = shallowRef(null)
  // Props returned by a matched JS modifier, or null when a Vue override matched /
  // nothing matched. Merged over the live preparedProps by `finalProps` below.
  const modifierProps     = ref(null)

  const finalProps = computed(() => {
    const current = preparedProps.value || {}
    return modifierProps.value ? { ...current, ...modifierProps.value } : current
  })

  const resourceConfig = inject('resourceConfig', null)
  const resourceRecord = inject('resourceRecord', null)
  const pageState      = inject('pageState', null)

  watch(
    () => {
      const p = preparedProps.value
      return [p.action, p.page, p.scope, p.resource, p.uiName]
    },
    async ([action, page, scope, resource, uiName]) => {
      ready.value = false
      resolvedComponent.value = null
      modifierProps.value = null

      // Normalize all path segments to lowercase for case-insensitive lookup
      const actionKey = (action || '').toLowerCase()
      const pageKey   = (page   || '').toLowerCase()
      const scopeKey  = (scope  || '').toLowerCase()
      const uiKey     = (uiName || '').toLowerCase()
      // resource slug → PascalCase → lowercase for path (e.g. 'stock-movements' → 'stockmovements')
      const resourceKey = toPascalCase(resource || '').toLowerCase()

      // ── Step 1: Locate the base action component ───────────────────────────
      //
      // Priority order:
      //   a. Custom UI generic action: _ui/${uiName}/components/actions/${action}.vue
      //   b. Framework generic action: components/actions/${action}.vue
      //   c. If neither exists, fall back to a ui-wide Vue override candidate
      //      as the base action.
      //
      const uiBase = uiKey ? `_ui/${uiKey}/components` : null

      // Build the override/modifier candidate list once (first match wins).
      // Also reused for base-action fallback when no custom/framework base exists.
      const overrideCandidates = uiBase
        ? [
            { path: `${uiBase}/${scopeKey}/${resourceKey}/${pageKey}/${actionKey}.vue`, isVueOverride: true  },
            { path: `${uiBase}/${scopeKey}/${resourceKey}/${pageKey}/${actionKey}.js`,  isVueOverride: false },
            { path: `${uiBase}/${scopeKey}/${resourceKey}/${actionKey}.vue`,            isVueOverride: true  },
            { path: `${uiBase}/${scopeKey}/${resourceKey}/${actionKey}.js`,             isVueOverride: false },
            { path: `${uiBase}/${scopeKey}/${pageKey}/${actionKey}.vue`,                isVueOverride: true  },
            { path: `${uiBase}/${scopeKey}/${pageKey}/${actionKey}.js`,                 isVueOverride: false },
            { path: `${uiBase}/${scopeKey}/${actionKey}.vue`,                           isVueOverride: true  },
            { path: `${uiBase}/${scopeKey}/${actionKey}.js`,                            isVueOverride: false },
            { path: `${uiBase}/${actionKey}.vue`,                                       isVueOverride: true  },
            { path: `${uiBase}/${actionKey}.js`,                                        isVueOverride: false },
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
          console.error(`[useActionResolver] Failed to load module at "${path}":`, err)
          return null
        }
      }

      let baseAction = null
      const customBasePath = uiBase ? `${uiBase}/actions/${actionKey}.vue` : null
      if (customBasePath) {
        const mod = await loadCustomUiModule(customBasePath)
        if (mod) baseAction = markRaw(mod)
      }

      if (!baseAction) {
        const frameworkBasePath = `components/actions/${actionKey}.vue`
        const frameworkBaseLoader = frameworkRegistry[frameworkBasePath]
        if (frameworkBaseLoader) {
          try {
            const mod = await frameworkBaseLoader()
            baseAction = markRaw(mod.default ?? mod)
          } catch (err) {
            console.error(`[useActionResolver] Failed to load framework action at "${frameworkBasePath}":`, err)
          }
        }
      }

      // No custom/framework base — let a ui-wide Vue override candidate (isVueOverride)
      // serve as the base action. If nothing resolves here, render the fallback card.
      if (!baseAction) {
        for (const { path, isVueOverride } of overrideCandidates) {
          if (!isVueOverride) continue
          const mod = await loadCustomUiModule(path)
          if (mod) {
            baseAction = markRaw(mod)
            break
          }
        }
      }

      // Still nothing — fall back to the caller-supplied default so a JS modifier can
      // still adjust its props even though it was never registered under actions/.
      if (!baseAction && defaultComponent) {
        baseAction = markRaw(defaultComponent)
      }

      // No base action exists anywhere — render the fallback card
      if (!baseAction) {
        ready.value = true
        return
      }

      // ── Step 2: Look for a page/resource/scope-level override or modifier ──
      //
      // Lookup order (first match wins):
      //   1. Vue override — resource + page specific:  _ui/.../components/${scope}/${resource}/${page}/${action}.vue
      //   2. JS  modifier — resource + page specific:  _ui/.../components/${scope}/${resource}/${page}/${action}.js
      //   3. Vue override — resource specific:         _ui/.../components/${scope}/${resource}/${action}.vue
      //   4. JS  modifier — resource specific:         _ui/.../components/${scope}/${resource}/${action}.js
      //   5. Vue override — page specific:             _ui/.../components/${scope}/${page}/${action}.vue
      //   6. JS  modifier — page specific:             _ui/.../components/${scope}/${page}/${action}.js
      //   7. Vue override — scope-wide:                _ui/.../components/${scope}/${action}.vue
      //   8. JS  modifier — scope-wide:                _ui/.../components/${scope}/${action}.js
      //   9. Vue override — ui-wide:                   _ui/.../components/${action}.vue
      //  10. JS  modifier — ui-wide:                   _ui/.../components/${action}.js
      //
      if (!uiKey) {
        // No custom UI configured — use base action with unmodified props
        resolvedComponent.value = baseAction
        ready.value = true
        return
      }

      for (const { path, isVueOverride } of overrideCandidates) {
        const loader = customUiRegistry[path]
        if (!loader) continue

        const exported = await loadCustomUiModule(path)
        if (!exported) continue

        if (isVueOverride) {
          // Full Vue template override — replaces the base action entirely.
          // Props flow through unmodified so the override component can use $attrs.
          resolvedComponent.value = markRaw(exported)
        } else {
          // JS modifier — keeps the base action, adjusts props before passing down.
          // Cached here; finalProps merges it over the live preparedProps.
          modifierProps.value = typeof exported === 'function'
            ? exported(preparedProps.value, { pageState, resourceRecord, resourceConfig })
            : exported
          resolvedComponent.value = baseAction
        }

        break // first match wins; stop scanning
      }

      // No override matched — use base action with unmodified props
      if (!resolvedComponent.value) {
        resolvedComponent.value = baseAction
      }

      ready.value = true
    },
    { immediate: true }
  )

  return { ready, resolvedComponent, finalProps }
}
