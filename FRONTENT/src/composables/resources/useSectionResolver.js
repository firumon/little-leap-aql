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

// ─── Composable ───────────────────────────────────────────────────────────────

/**
 * Resolves which section component to render and what final props to pass it,
 * based on a two-step lookup: (1) find a base section, (2) find an override or modifier.
 *
 * @param {ComputedRef<object>} preparedProps - Reactive object containing at minimum:
 *   { section, page, scope, resource, uiName, ...orchestratorState }
 */
export function useSectionResolver(preparedProps) {
  const ready             = ref(false)
  const resolvedComponent = shallowRef(null)
  const finalProps        = ref({})

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
      //
      let baseSection = null

      if (uiKey) {
        const customBasePath = `_ui/${uiKey}/components/sections/${sectionKey}.vue`
        const customBaseLoader = customUiRegistry[customBasePath]
        if (customBaseLoader) {
          try {
            const mod = await customBaseLoader()
            baseSection = markRaw(mod.default ?? mod)
          } catch (err) {
            console.error(`[useSectionResolver] Failed to load custom base section at "${customBasePath}":`, err)
          }
        }
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

      const uiBase = `_ui/${uiKey}/components`
      const overrideCandidates = [
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

      for (const { path, isVueOverride } of overrideCandidates) {
        const loader = customUiRegistry[path]
        if (!loader) continue

        try {
          const mod = await loader()
          const exported = mod.default ?? mod

          if (isVueOverride) {
            // Full Vue template override — replaces the base section entirely.
            // Props flow through unmodified so the override component can use $attrs.
            resolvedComponent.value = markRaw(exported)
            finalProps.value = currentProps
          } else {
            // JS modifier — keeps the base section, adjusts props before passing down.
            const modifiedProps = typeof exported === 'function'
              ? exported(currentProps)
              : exported
            resolvedComponent.value = baseSection
            finalProps.value = { ...currentProps, ...modifiedProps }
          }

          break // first match wins; stop scanning
        } catch (err) {
          console.error(`[useSectionResolver] Failed to load override at "${path}":`, err)
        }
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
