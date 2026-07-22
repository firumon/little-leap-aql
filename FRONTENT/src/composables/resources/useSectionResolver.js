import { ref, watch, computed, shallowRef, markRaw, inject } from 'vue'
import { toPascalCase } from 'src/utils/appHelpers'

// ─── Vite Glob Registries (module-level, built once at startup) ────────────────
//
// Registry 1: Framework-provided section components under src/components/
// Example key: 'components/sections/header.vue'
//
const frameworkSectionModules = import.meta.glob('../../components/**/*.{vue,js}')

const frameworkRegistry = {}
Object.keys(frameworkSectionModules).forEach((rawPath) => {
  const key = rawPath.replace(/^\.\.\/\.\.\//, '').toLowerCase()
  frameworkRegistry[key] = frameworkSectionModules[rawPath]
})

// Registry 2: Tenant/client custom UI overrides under src/_ui/
// Example key: '_ui/aql/components/master/products/index/header.vue'
//
const customUiModules = import.meta.glob('../../_ui/**/*.{vue,js}')

const customUiRegistry = {}
Object.keys(customUiModules).forEach((rawPath) => {
  const key = rawPath.replace(/^\.\.\/\.\.\//, '').toLowerCase()
  customUiRegistry[key] = customUiModules[rawPath]
})

// Expose registry for backward compatibility with ViewChildren (Children.vue)
export const registry = {}
Object.keys(frameworkSectionModules).forEach((rawPath) => {
  const key = rawPath.replace(/^\.\.\/\.\.\//, '')
  registry[key] = frameworkSectionModules[rawPath]
})
Object.keys(customUiModules).forEach((rawPath) => {
  const key = rawPath.replace(/^\.\.\/\.\.\//, '')
  registry[key] = customUiModules[rawPath]

  // Legacy components/_custom/... path mapping
  /*if (key.startsWith('_ui/')) {
    const parts = key.split('/')
    if (parts[2] === 'components') {
      const uiName = parts[1]
      const rest = parts.slice(3).join('/')
      const legacyKey = `components/_custom/${uiName}/${rest}`
      registry[legacyKey] = customUiModules[rawPath]
    }
  }*/
})

// ─── Prop Evaluator ───────────────────────────────────────────────────────────
//
// Evaluates a modifier prop value. If the value is a function, it is called with
// the unwrapped record and config objects so modifier files stay concise:
//
//   export default {
//     title: (record, config) => record?.Name ?? config?.name
//   }
//
// resourceRecord and resourceConfig are the full injected objects from provide/inject;
// this helper unwraps .record.value and .config.value before passing them in.
//
export function evaluateProp(val, resourceRecord, resourceConfig) {
  if (typeof val !== 'function') return val
  return val(
    resourceRecord?.record?.value ?? null,
    resourceConfig?.config?.value ?? null
  )
}

// ─── Composable ───────────────────────────────────────────────────────────────

/**
 * Resolves which section component to render and what final props to pass it,
 * based on a two-step lookup: (1) find a base section, (2) find an override or modifier.
 *
 * @param {ComputedRef<object>} preparedProps - Reactive object containing at minimum:
 *   { section, page, scope, resource, uiName, ...orchestratorState }
 */
export function useSectionResolver(preparedProps, defaultComponent = null) {
  const ready             = ref(false)
  const resolvedComponent = shallowRef(null)
  const finalProps        = ref({})

  const resourceConfig = inject('resourceConfig', null)
  const resourceRecord = inject('resourceRecord', null)
  const pageState      = inject('pageState', null)

  watch(
    () => {
      const p = preparedProps.value
      return [p.section, p.page, p.scope, p.resource, p.uiName]
    },
    async ([section, page, scope, resource, uiName]) => {
      ready.value = false
      resolvedComponent.value = null
      finalProps.value = {}

      // Normalize all path segments to lowercase for case-insensitive lookup
      const sectionKey  = (section  || '').toLowerCase()
      const pageKey     = (page     || '').toLowerCase()
      const scopeKey    = (scope    || '').toLowerCase()
      const uiKey       = (uiName   || '').toLowerCase()
      // resource slug → PascalCase → lowercase for path (e.g. 'stock-movements' → 'stockmovements')
      const resourcePascal = toPascalCase(resource || '')
      const resourceKey    = resourcePascal.toLowerCase()

      // ── Step 1: Locate the base section component ──────────────────────────
      //
      // Priority order:
      //   a. Custom UI generic section: _ui/${uiName}/components/sections/${section}.vue
      //   b. Framework generic section: components/sections/${section}.vue
      //   c. If neither exists, fall back to a ui-wide Vue override candidate
      //      as the base section.
      //
      const uiBase = uiKey ? `_ui/${uiKey}/components` : null

      // Build the override/modifier candidate list once (first match wins).
      // Also reused for base-section fallback when no custom/framework base exists.
      const overrideCandidates = uiBase
        ? [
            { path: `${uiBase}/${scopeKey}/${resourceKey}/${pageKey}/${sectionKey}.vue`, isVueOverride: true  },
            { path: `${uiBase}/${scopeKey}/${resourceKey}/${pageKey}/${sectionKey}.js`,  isVueOverride: false },
            { path: `${uiBase}/${scopeKey}/${resourceKey}/${sectionKey}.vue`,            isVueOverride: true  },
            { path: `${uiBase}/${scopeKey}/${resourceKey}/${sectionKey}.js`,             isVueOverride: false },
            { path: `${uiBase}/${scopeKey}/${pageKey}/${sectionKey}.vue`,                isVueOverride: true  },
            { path: `${uiBase}/${scopeKey}/${pageKey}/${sectionKey}.js`,                 isVueOverride: false },
            { path: `${uiBase}/${scopeKey}/${sectionKey}.vue`,                           isVueOverride: true  },
            { path: `${uiBase}/${scopeKey}/${sectionKey}.js`,                            isVueOverride: false },
            { path: `${uiBase}/${sectionKey}.vue`,                                       isVueOverride: true  },
            { path: `${uiBase}/${sectionKey}.js`,                                        isVueOverride: false },
          ]
        : []

      // Loads a Vue/JS module from the custom UI registry at the given path.
      // Returns { component, isVue } so callers can decide base vs override usage.
      async function loadCustomUiModule(path) {
        const loader = customUiRegistry[path]
        if (!loader) return null
        try {
          const mod = await loader()
          return mod.default ?? mod
        } catch (err) {
          console.error(`[useSectionResolver] Failed to load module at "${path}":`, err)
          return null
        }
      }

      let baseSection = null
      const customBasePath = uiBase ? `${uiBase}/sections/${sectionKey}.vue` : null
      if (customBasePath) {
        const mod = await loadCustomUiModule(customBasePath)
        if (mod) baseSection = markRaw(mod)
      }

      if (!baseSection) {
        const frameworkBasePath = `components/sections/${sectionKey}.vue`
        const frameworkBaseLoader = frameworkRegistry[frameworkBasePath]
        if (frameworkBaseLoader) {
          try {
            const mod = await frameworkBaseLoader()
            baseSection = markRaw(mod.default ?? mod)
          } catch (err) {
            console.error(`[useSectionResolver] Failed to load framework section at "${frameworkBasePath}":`, err)
          }
        }
      }

      // No custom/framework base — let a ui-wide Vue override candidate (isVueOverride)
      // serve as the base section. If nothing resolves here, render the fallback card.
      if (!baseSection) {
        for (const { path, isVueOverride } of overrideCandidates) {
          if (!isVueOverride) continue
          const mod = await loadCustomUiModule(path)
          if (mod) {
            baseSection = markRaw(mod)
            break
          }
        }
      }

      // No custom/framework/ui-wide base found — fall back to the caller-supplied
      // default so a JS modifier can still adjust its props even though it was never
      // registered under components/sections/ or _ui/.../sections/.
      if (!baseSection && defaultComponent) {
        baseSection = markRaw(defaultComponent)
      }

      // No base section exists anywhere — render the fallback card
      if (!baseSection) {
        ready.value = true
        return
      }

      // ── Step 2: Look for a page/resource/scope-level override or modifier ──
      //
      // Lookup order (first match wins):
      //   1. Vue override — resource + page specific:  _ui/.../components/${scope}/${resource}/${page}/${section}.vue
      //   2. JS  modifier — resource + page specific:  _ui/.../components/${scope}/${resource}/${page}/${section}.js
      //   3. Vue override — resource specific:         _ui/.../components/${scope}/${resource}/${section}.vue
      //   4. JS  modifier — resource specific:         _ui/.../components/${scope}/${resource}/${section}.js
      //   5. Vue override — page specific:             _ui/.../components/${scope}/${page}/${section}.vue
      //   6. JS  modifier — page specific:             _ui/.../components/${scope}/${page}/${section}.js
      //   7. Vue override — scope-wide:                _ui/.../components/${scope}/${section}.vue
      //   8. JS  modifier — scope-wide:                _ui/.../components/${scope}/${section}.js
      //   9. Vue override — ui-wide:                   _ui/.../components/${section}.vue
      //  10. JS  modifier — ui-wide:                   _ui/.../components/${section}.js
      //
      const currentProps = preparedProps.value

      if (!uiKey) {
        // No custom UI configured — use base section with unmodified props
        resolvedComponent.value = baseSection
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
          // Full Vue template override — replaces the base section entirely.
          // Props flow through unmodified so the override component can use $attrs.
          resolvedComponent.value = markRaw(exported)
          finalProps.value = currentProps
        } else {
          // JS modifier — keeps the base section, adjusts props before passing down.
          const modifiedProps = typeof exported === 'function'
            ? exported(currentProps, { pageState, resourceRecord, resourceConfig })
            : exported
          resolvedComponent.value = baseSection
          finalProps.value = { ...currentProps, ...modifiedProps }
        }

        break // first match wins; stop scanning
      }

      // No override matched — use base section with unmodified props
      if (!resolvedComponent.value) {
        resolvedComponent.value = baseSection
        finalProps.value = currentProps
      }

      ready.value = true
    },
    { immediate: true }
  )

  return { ready, resolvedComponent, finalProps }
}
