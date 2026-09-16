import { ref, watch, computed, shallowRef, markRaw } from 'vue'
import { toPascalCase } from 'src/utils/appHelpers'

const frameworkModules = import.meta.glob('../../components/widgets/*.vue')

const frameworkRegistry = {}
Object.keys(frameworkModules).forEach((rawPath) => {
  const key = rawPath.replace(/^\.\.\/\.\.\//, '').toLowerCase()
  frameworkRegistry[key] = frameworkModules[rawPath]
})

const customUiModules = import.meta.glob('../../_ui/**/*.{vue,js}')

const customUiRegistry = {}
Object.keys(customUiModules).forEach((rawPath) => {
  const key = rawPath.replace(/^\.\.\/\.\.\//, '').toLowerCase()
  customUiRegistry[key] = customUiModules[rawPath]
})

// Base is found by `widget`. Override is found by the sheet item `name`, so two
// tiles sharing one widget can still be changed apart.
export function useWidgetResolver (preparedProps) {
  const ready = ref(false)
  const resolvedComponent = shallowRef(null)
  const customized = ref(false)

  const finalProps = computed(() => preparedProps.value || {})

  let resolveToken = 0

  watch(
    () => {
      const p = preparedProps.value || {}
      return `${p.widget ?? ''}|${p.name ?? ''}|${p.scope ?? ''}|${p.resource ?? ''}|${p.uiName ?? ''}`
    },
    async () => {
      const token = ++resolveToken
      const { widget, name, scope, resource, uiName } = preparedProps.value || {}

      let nextComponent = null
      let nextCustom = false

      if (!resolvedComponent.value) ready.value = false

      function commit () {
        resolvedComponent.value = nextComponent
        customized.value = nextCustom
        ready.value = true
      }

      const widgetKey = (widget || '').toLowerCase()
      const nameKey = (name || '').toLowerCase()
      const scopeKey = (scope || '').toLowerCase()
      const uiKey = (uiName || '').toLowerCase()
      const resourceKey = toPascalCase(resource || '').toLowerCase()

      if (!widgetKey) {
        commit()
        return
      }

      const uiBase = uiKey ? `_ui/${uiKey}/components` : null

      async function loadCustomUiModule (path) {
        const loader = customUiRegistry[path]
        if (!loader) return null
        try {
          const mod = await loader()
          return mod.default ?? mod
        } catch (err) {
          console.error(`[useWidgetResolver] Failed to load module at "${path}":`, err)
          return null
        }
      }

      let baseWidget = null
      if (uiBase) {
        const mod = await loadCustomUiModule(`${uiBase}/widgets/${widgetKey}.vue`)
        if (mod) {
          baseWidget = markRaw(mod)
          nextCustom = true
        }
      }

      if (!baseWidget) {
        const loader = frameworkRegistry[`components/widgets/${widgetKey}.vue`]
        if (loader) {
          try {
            const mod = await loader()
            baseWidget = markRaw(mod.default ?? mod)
          } catch (err) {
            console.error(`[useWidgetResolver] Failed to load framework widget "${widgetKey}":`, err)
          }
        }
      }

      if (token !== resolveToken) return

      if (!baseWidget) {
        commit()
        return
      }

      if (!uiKey || !nameKey) {
        nextComponent = baseWidget
        commit()
        return
      }

      const overrideCandidates = [
        `${uiBase}/${scopeKey}/${resourceKey}/dashboard/${nameKey}.vue`,
        `${uiBase}/${scopeKey}/${resourceKey}/${nameKey}.vue`,
        `${uiBase}/${scopeKey}/dashboard/${nameKey}.vue`,
        `${uiBase}/${scopeKey}/${nameKey}.vue`,
        `${uiBase}/${nameKey}.vue`
      ]

      for (const path of overrideCandidates) {
        if (!customUiRegistry[path]) continue
        const exported = await loadCustomUiModule(path)
        if (token !== resolveToken) return
        if (!exported) continue

        nextComponent = markRaw(exported)
        nextCustom = true
        break
      }

      if (!nextComponent) nextComponent = baseWidget

      commit()
    },
    { immediate: true }
  )

  return { ready, customized, resolvedComponent, finalProps }
}

