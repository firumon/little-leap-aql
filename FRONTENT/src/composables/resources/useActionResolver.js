import { ref, watch, computed, shallowRef, markRaw, inject } from 'vue'
import { toPascalCase } from 'src/utils/appHelpers'
import { resolvePlaceholderProps } from 'src/utils/placeholderProps'
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
 * buttons, ResourceActions) resolve independently from page sections and contents.
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
  // Holds the modifier FUNCTION, not its result. Calling it once at resolve time froze
  // every prop it derives from live data. shallowRef so Vue never proxies it.
  const modifier          = shallowRef(null)

  const resourceConfig = inject('resourceConfig', null)
  const resourceRecord = inject('resourceRecord', null)
  const pageState      = inject('pageState', null)

  const finalProps = computed(() => {
    const current = preparedProps.value || {}
    // Props addressed to THIS action by an ancestor — `PropsAction` (broadcast to
    // every action) then `PropsPageAction` / `PropsFormActionSubmit` (this one only) —
    // spread flat. The JS modifier still lands last. See src/utils/placeholderProps.js.
    const placeholder = resolvePlaceholderProps(current, current.action, 'Action')
    const applied = typeof modifier.value === 'function'
      ? modifier.value(current, { pageState, resourceRecord, resourceConfig })
      : modifier.value
    if (!placeholder && !applied) return current
    return { ...current, ...placeholder, ...applied }
  })

  // Monotonic token guarding against out-of-order async resolves: if the lookup
  // key changes again while a scan is awaiting a dynamic import, the older scan
  // must not write its result over the newer one.
  let resolveToken = 0

  watch(
    // MUST return a primitive. A getter returning an array literal builds a new
    // reference on every evaluation, and `watch` compares sources with Object.is
    // (it does not deep-compare a getter's array result) — so the callback would
    // re-fire on every reactive read of `preparedProps`, which wraps useAttrs().
    // That re-render feeds the next attrs change: an unbounded resolve loop that
    // thrashes memory and pins the tab. A joined string only changes when one of
    // the five lookup segments genuinely changes.
    () => {
      const p = preparedProps.value || {}
      return `${p.action ?? ''}|${p.page ?? ''}|${p.scope ?? ''}|${p.resource ?? ''}|${p.uiName ?? ''}`
    },
    async () => {
      const token = ++resolveToken
      // Read the live object rather than destructuring the watch source: the
      // source is now a string, and watch callbacks are not reactivity-tracked.
      const { action, page, scope, resource, uiName } = preparedProps.value || {}

      // Resolution writes into these locals and commits ONCE at the end (see
      // `commit`). Nothing is nulled up front: clearing `resolvedComponent` mid-scan
      // unmounts the live component, and for a component that renders a Quasar
      // portal (`q-page-sticky`) the remount allocates a NEW portal node while the
      // old one is still being torn down — which is how identical FAB clusters
      // stacked up. Committing once means an unchanged component is re-assigned to
      // the same object, `shallowRef` sees no change, and the portal survives.
      let nextComponent = null
      let nextModifier  = null

      // Only show the spinner on the very first resolve. On a later key change the
      // previous cluster stays on screen until its replacement is ready, so the
      // page never flickers through an empty state.
      if (!resolvedComponent.value) ready.value = false

      function commit () {
        modifier.value          = nextModifier
        resolvedComponent.value = nextComponent
        ready.value             = true
      }

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

      // A newer lookup key superseded this scan while it awaited its imports —
      // drop the stale result rather than clobbering the current one.
      if (token !== resolveToken) return

      // No base action exists anywhere — commit null so Action.vue renders the
      // "Action Not Defined" card.
      if (!baseAction) {
        commit()
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
        nextComponent = baseAction
        commit()
        return
      }

      for (const { path, isVueOverride } of overrideCandidates) {
        const loader = customUiRegistry[path]
        if (!loader) continue

        const exported = await loadCustomUiModule(path)
        if (token !== resolveToken) return
        if (!exported) continue

        if (isVueOverride) {
          // Full Vue template override — replaces the base action entirely.
          // Props flow through unmodified so the override component can use $attrs.
          nextComponent = markRaw(exported)
        } else {
          // JS modifier — keeps the base action, adjusts props before passing down.
          // Cached unapplied; finalProps runs it over the live preparedProps.
          nextModifier = typeof exported === 'function' ? markRaw(exported) : exported
          nextComponent = baseAction
        }

        break // first match wins; stop scanning
      }

      // No override matched — use base action with unmodified props
      if (!nextComponent) nextComponent = baseAction

      commit()
    },
    { immediate: true }
  )

  return { ready, resolvedComponent, finalProps }
}
