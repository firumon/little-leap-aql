import { ref, watch, computed, shallowRef, markRaw, inject } from 'vue'
import { toPascalCase } from 'src/utils/appHelpers'
import { resolvePlaceholderProps } from 'src/utils/placeholderProps'
import { evaluateProp } from 'src/composables/resources/useSectionResolver'
import { evalPermissionRules } from 'src/composables/resources/useResourceConfig'

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
  // Holds the modifier FUNCTION, not its result. A modifier returns a sorted slice of
  // `props.items`, so calling it once at resolve time froze the list. shallowRef so Vue
  // never proxies it.
  const modifier          = shallowRef(null)

  const resourceConfig = inject('resourceConfig', null)
  const resourceRecord = inject('resourceRecord', null)
  const pageState      = inject('pageState', null)

  // Live computed, not a snapshot assigned inside the watch: the watch only re-runs when
  // one of the five lookup keys changes, so a snapshot would freeze every prop.
  const finalProps = computed(() => {
    const current = preparedProps.value || {}
    // Props addressed to THIS content by an ancestor — `PropsContent` (broadcast to
    // every content) then `PropsList` / `PropsListToday` (this one only) — spread flat.
    // The JS modifier still lands last. See src/utils/placeholderProps.js.
    const placeholder = resolvePlaceholderProps(current, current.content, 'Content')
    const applied = typeof modifier.value === 'function'
      ? modifier.value(current, { pageState, resourceRecord, resourceConfig })
      : modifier.value
    if (!placeholder && !applied) return current
    return { ...current, ...placeholder, ...applied }
  })

  // Declarative gate from the page contract's top-level `permissions` block:
  //   permissions: { CompleteVisit: ['OutletVisits:complete'] }
  // A content with no entry renders unconditionally, as it always did.
  const permitted = computed(() => {
    const current = preparedProps.value || {}
    const rules = current.permissions?.[current.content]
    if (!rules) return true
    return evalPermissionRules(rules, { config: resourceConfig?.config })
  })

  // Monotonic token guarding against out-of-order async resolves: if the lookup
  // key changes again while a scan is awaiting a dynamic import, the older scan
  // must not write its result over the newer one.
  let resolveToken = 0

  // MUST be a primitive. A getter returning an array literal builds a new reference on
  // every evaluation, and `watch` compares sources with Object.is (it does not
  // deep-compare a getter's array result) — so the callback would re-fire on every
  // reactive read of `preparedProps`, which wraps useAttrs(). That re-render feeds the
  // next attrs change: an unbounded resolve loop that thrashes memory and pins the tab.
  // A joined string only changes when one of the five lookup segments genuinely changes.
  const lookupKey = computed(() => {
    const p = preparedProps.value || {}
    return `${p.content ?? ''}|${p.page ?? ''}|${p.scope ?? ''}|${p.resource ?? ''}|${p.uiName ?? ''}`
  })

  // The lookup key `resolvedComponent` currently corresponds to. Because resolution is
  // async, it lags `lookupKey` for the couple of frames a scan takes.
  const resolvedKey = ref(null)

  // False while a scan is in flight — i.e. while `resolvedComponent` still holds the
  // component for the PREVIOUS key. Callers that would otherwise feed the new key's props
  // into the old component during that window can use this to hold the last committed
  // state instead. Kept as a derived comparison rather than a flag toggled inside the
  // watch, so it cannot desync from what was actually committed.
  const settled = computed(() => resolvedKey.value === lookupKey.value)

  watch(
    lookupKey,
    async (key) => {
      const token = ++resolveToken
      // Read the live object rather than destructuring the watch source: the
      // source is now a string, and watch callbacks are not reactivity-tracked.
      const { content, page, scope, resource, uiName } = preparedProps.value || {}

      // Resolution writes into these locals and commits ONCE at the end. Nothing is
      // nulled up front: clearing `resolvedComponent` mid-scan unmounts the live
      // component and rebuilds any portal it renders. Committing once means an
      // unchanged component is re-assigned to the same object, `shallowRef` sees no
      // change, and the existing DOM (and its portals) survives untouched.
      let nextComponent = null
      let nextModifier  = null

      // Spinner only on the very first resolve; later key changes keep the previous
      // content on screen until its replacement is ready.
      if (!resolvedComponent.value) ready.value = false

      function commit () {
        modifier.value          = nextModifier
        resolvedComponent.value = nextComponent
        resolvedKey.value       = key
        ready.value             = true
      }

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

      // A newer lookup key superseded this scan while it awaited its imports —
      // drop the stale result rather than clobbering the current one.
      if (token !== resolveToken) return

      // No base content exists anywhere — commit null so the caller renders its
      // fallback card.
      if (!baseContent) {
        commit()
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
      if (!uiKey) {
        // No custom UI configured — use base content with unmodified props
        nextComponent = baseContent
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
          // Full Vue template override — replaces the base content entirely.
          // Props flow through unmodified so the override component can use $attrs.
          nextComponent = markRaw(exported)
        } else {
          // JS modifier — keeps the base content, adjusts props before passing down.
          // Cached unapplied; finalProps runs it over the live preparedProps.
          nextModifier = typeof exported === 'function' ? markRaw(exported) : exported
          nextComponent = baseContent
        }

        break // first match wins; stop scanning
      }

      // No override matched — use base content with unmodified props
      if (!nextComponent) nextComponent = baseContent

      commit()
    },
    { immediate: true }
  )

  return { ready, settled, permitted, resolvedComponent, finalProps }
}
