import { ref, watch, computed, shallowRef, markRaw } from 'vue'
import { useAuthStore } from 'src/stores/auth'
import baseContract from 'src/pages/Dashboard/dashboard'

const customUiModules = import.meta.glob('../../_ui/**/*.{vue,js}')

const customUiRegistry = {}
Object.keys(customUiModules).forEach((rawPath) => {
  const key = rawPath.replace(/^\.\.\/\.\.\//, '').toLowerCase()
  customUiRegistry[key] = customUiModules[rawPath]
})

export function useDashboardResolver () {
  const auth = useAuthStore()

  const uiName = computed(() => {
    for (const cfg of auth.resources || []) {
      const custom = cfg?.ui?.customUIName
      if (custom && typeof custom === 'string' && custom.trim()) {
        return custom.trim()
      }
    }
    return 'AQL'
  })

  const ready = ref(false)
  const resolvedPageComponent = shallowRef(null)
  const jsModifier = shallowRef(null)

  const dashboardProps = computed(() => {
    const base = { ...baseContract }
    const applied = typeof jsModifier.value === 'function'
      ? jsModifier.value(base)
      : jsModifier.value
    return applied ? { ...base, ...applied } : base
  })

  let resolveToken = 0

  watch(
    () => uiName.value,
    async (currentUiName) => {
      const token = ++resolveToken
      const targetUi = (currentUiName || 'AQL').toLowerCase()

      let nextComponent = null
      let nextModifier = null

      const jsPath = `_ui/${targetUi}/pages/dashboard.js`
      const vuePath = `_ui/${targetUi}/pages/dashboard.vue`

      if (customUiRegistry[jsPath]) {
        try {
          const mod = await customUiRegistry[jsPath]()
          if (token === resolveToken) {
            nextModifier = mod.default ?? mod
          }
        } catch (err) {
          console.error(`[useDashboardResolver] Failed to load "${jsPath}":`, err)
        }
      }

      if (token !== resolveToken) return

      if (customUiRegistry[vuePath]) {
        try {
          const mod = await customUiRegistry[vuePath]()
          if (token === resolveToken) {
            nextComponent = markRaw(mod.default ?? mod)
          }
        } catch (err) {
          console.error(`[useDashboardResolver] Failed to load "${vuePath}":`, err)
        }
      }

      if (token !== resolveToken) return

      resolvedPageComponent.value = nextComponent
      jsModifier.value = nextModifier
      ready.value = true
    },
    { immediate: true }
  )

  return {
    ready,
    resolvedPageComponent,
    dashboardProps
  }
}

