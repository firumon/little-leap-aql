import { ref, watch, computed, shallowRef, markRaw } from 'vue'
import { toPascalCase } from 'src/utils/appHelpers'
import Frame from 'src/components/Frame.vue'

const customUiModules = import.meta.glob('../../_ui/**/*.{vue,js}')

const customUiRegistry = {}
Object.keys(customUiModules).forEach((rawPath) => {
  const key = rawPath.replace(/^\.\.\/\.\.\//, '').toLowerCase()
  customUiRegistry[key] = customUiModules[rawPath]
})

export function useWidgetResolver (tileProps, uiName) {
  const ready = ref(false)
  const resolvedComponent = shallowRef(Frame)
  const modifier = shallowRef(null)

  const finalProps = computed(() => {
    const current = tileProps.value || {}
    const mod = modifier.value
    const applied = typeof mod === 'function' ? mod(current) : mod
    if (!applied || typeof applied !== 'object') return current
    return { ...current, ...applied }
  })

  let resolveToken = 0

  const lookupKey = computed(() => {
    const p = tileProps.value || {}
    const widget = p.widget ?? ''
    const name = p.name ?? ''
    const scope = p.scope ?? ''
    const resource = p.resource ?? ''
    const ui = typeof uiName === 'string' ? uiName : (uiName?.value ?? '')
    return `${widget}|${name}|${scope}|${resource}|${ui}`
  })

  watch(
    lookupKey,
    async () => {
      const token = ++resolveToken
      const p = tileProps.value || {}
      const widget = p.widget || ''
      const name = p.name || ''
      const scope = p.scope || ''
      const resource = p.resource || ''
      const currentUi = typeof uiName === 'string' ? uiName : (uiName?.value ?? '')

      let nextComponent = Frame
      let nextModifier = null

      const widgetKey = widget.toLowerCase()
      const nameKey = name.toLowerCase()
      const scopeKey = scope.toLowerCase()
      const uiKey = (currentUi || 'AQL').toLowerCase()
      const resourceKey = toPascalCase(resource || '').toLowerCase()

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

      if (uiBase && widgetKey) {
        const customWidgetPath = `${uiBase}/widgets/${widgetKey}.vue`
        const mod = await loadCustomUiModule(customWidgetPath)
        if (mod) {
          nextComponent = markRaw(mod)
        }
      }

      if (uiBase && nameKey) {
        const modifierCandidates = [
          `${uiBase}/${scopeKey}/${resourceKey}/dashboard/${nameKey}.js`,
          `${uiBase}/${scopeKey}/${resourceKey}/${nameKey}.js`,
          `${uiBase}/${scopeKey}/dashboard/${nameKey}.js`
        ]

        for (const path of modifierCandidates) {
          if (!customUiRegistry[path]) continue
          const mod = await loadCustomUiModule(path)
          if (mod) {
            nextModifier = mod
            break
          }
        }
      }

      if (token !== resolveToken) return

      resolvedComponent.value = nextComponent
      modifier.value = nextModifier
      ready.value = true
    },
    { immediate: true }
  )

  return {
    ready,
    resolvedComponent,
    finalProps
  }
}
