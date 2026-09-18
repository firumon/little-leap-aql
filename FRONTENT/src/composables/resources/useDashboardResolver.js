import { ref, computed, shallowRef, watch, getCurrentInstance } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from 'src/stores/auth'
import { useRecord } from 'src/composables/resources/useRecord'
import { findResourceConfig, evalPermissionRules } from 'src/composables/resources/useResourceConfig'
import { scoreDashboardItem, multiplierOf, positionWeight, shareWeight } from 'src/composables/dashboard/useDashboardScore'
import baseContract from 'src/pages/Dashboard/dashboard'

const BREAKPOINTS = ['xs', 'sm', 'md', 'lg', 'xl']
const MULTIPLIER_CAP_NORMAL = 2
const MULTIPLIER_CAP_CUSTOM = 3

const dbiModules = import.meta.glob('../../_resource/*/*/Dashboard/*.js')

const dbiRegistry = new Map()
for (const path of Object.keys(dbiModules)) {
  const match = path.match(/\/_resource\/([^/]+)\/([^/]+)\/Dashboard\/([^/]+)\.js$/)
  if (!match) continue
  const [, scope, resource, file] = match
  if (file.startsWith('_')) continue
  const key = `${scope.toLowerCase()}::${resource.toLowerCase()}::${file.toLowerCase()}`
  dbiRegistry.set(key, dbiModules[path])
}

export function useDashboardResolver () {
  const $q = useQuasar()
  const auth = useAuthStore()
  const { isLoading, rows } = useRecord()
  const app = getCurrentInstance()?.appContext.app

  const uiName = computed(() => {
    for (const cfg of auth.resources || []) {
      const custom = cfg?.ui?.customUIName
      if (custom && typeof custom === 'string' && custom.trim()) {
        return custom.trim()
      }
    }
    return 'AQL'
  })

  const dashboardProps = computed(() => ({
    ...baseContract,
    uiName: uiName.value
  }))
  const loaded = ref(false)
  const dbiCallCache = new Map()
  const loadedModules = shallowRef(new Map())
  const resourceLoadingMap = new Map()

  const getResourceLoading = (resource) => {
    if (!resourceLoadingMap.has(resource)) {
      resourceLoadingMap.set(
        resource,
        computed(() => isLoading(resource) && rows(resource).length === 0)
      )
    }
    return resourceLoadingMap.get(resource)
  }

  const isActive = (item) => {
    const baseActive = item.active !== false
    const except = Array.isArray(item.activeExcept) ? item.activeExcept : []
    if (!except.length) return baseActive

    const userRoles = Array.isArray(auth.user?.roles) ? auth.user.roles : []
    const userRoleIds = new Set(
      userRoles.map((r) => String(r?.id ?? '').trim().toLowerCase()).filter(Boolean)
    )

    const matches = except.some((id) => userRoleIds.has(String(id ?? '').trim().toLowerCase()))
    return matches ? !baseActive : baseActive
  }

  const permitted = (p, ownerResource) => {
    if (!p) return true

    if (typeof p === 'string' || Array.isArray(p)) {
      return evalPermissionRules(
        (Array.isArray(p) ? p : [p]).map((a) => `${ownerResource}:${a}`)
      )
    }

    return Object.entries(p).every(([resName, verbs]) => {
      if (verbs === true) return !!findResourceConfig(auth, resName)
      const list = Array.isArray(verbs) ? verbs : [verbs]
      return evalPermissionRules(list.map((a) => `${resName}:${a}`))
    })
  }

  const spanFor = (size) => {
    if (!size || typeof size !== 'object') return 12
    const at = BREAKPOINTS.indexOf($q.screen.name)
    for (let i = at; i >= 0; i--) {
      const v = size[BREAKPOINTS[i]]
      if (v === undefined || v === null) continue
      const picked = Array.isArray(v) ? v[0] : v
      const n = Number(picked)
      if (Number.isInteger(n) && n > 0) return n
    }
    return 12
  }

  watch(
    () => auth.resources,
    async (resources) => {
      const needed = []
      for (const cfg of resources || []) {
        const list = cfg?.ui?.dashboard
        if (!Array.isArray(list)) continue
        const scope = (cfg.scope || 'master').toLowerCase()
        const res = cfg.name.toLowerCase()
        for (const item of list) {
          if (!item || !item.name) continue
          const name = String(item.name).trim().toLowerCase()
          const regKey = `${scope}::${res}::${name}`
          const loader = dbiRegistry.get(regKey)
          if (loader) {
            needed.push({ key: regKey, loader })
          }
        }
      }

      if (!needed.length) {
        loaded.value = true
        return
      }

      const promises = needed.map(async ({ key, loader }) => {
        if (loadedModules.value.has(key)) return
        try {
          const mod = await loader()
          loadedModules.value.set(key, mod.default || mod)
        } catch {
          loadedModules.value.set(key, null)
        }
      })

      await Promise.allSettled(promises)
      loadedModules.value = new Map(loadedModules.value)
      loaded.value = true
    },
    { immediate: true }
  )

  const items = computed(() => {
    const survivorsByResource = new Map()

    for (const cfg of auth.resources || []) {
      const list = cfg?.ui?.dashboard
      if (!Array.isArray(list)) continue

      const resource = cfg.name
      const scope = cfg.scope || 'master'
      const scopeLower = scope.toLowerCase()
      const resourceLower = resource.toLowerCase()

      for (const sheetItem of list) {
        if (!sheetItem || !sheetItem.name) continue
        if (!isActive(sheetItem)) continue

        const name = String(sheetItem.name).trim()
        const regKey = `${scopeLower}::${resourceLower}::${name.toLowerCase()}`
        const dbiFn = loadedModules.value.get(regKey)
        const isCustom = !dbiFn

        let dbiResult = null
        if (!isCustom) {
          const cacheKey = `${resource}::${name}`
          if (dbiCallCache.has(cacheKey)) {
            dbiResult = dbiCallCache.get(cacheKey)
          } else {
            const rowProps = { ...(sheetItem.widgetProps || {}) }
            try {
              dbiResult = app ? app.runWithContext(() => dbiFn(rowProps)) : dbiFn(rowProps)
            } catch {
              dbiResult = null
            }
            dbiCallCache.set(cacheKey, dbiResult)
          }
        }

        if (!isCustom && !permitted(dbiResult?.permission, resource)) continue

        const props = {
          name,
          widget: sheetItem.widget ?? dbiResult?.widget,
          size: sheetItem.size ?? dbiResult?.size ?? { xs: [12] },
          multiplier: sheetItem.multiplier !== undefined ? sheetItem.multiplier : (dbiResult?.multiplier ?? 1),
          title: sheetItem.title ?? dbiResult?.title,
          subtitle: sheetItem.subtitle ?? dbiResult?.subtitle,
          caption: sheetItem.caption ?? dbiResult?.caption,
          widgetProps: { ...(dbiResult?.widgetProps || {}), ...(sheetItem.widgetProps || {}) }
        }

        if (isCustom && sheetItem.source !== undefined) {
          props.source = sheetItem.source
        }

        const maxCap = isCustom ? MULTIPLIER_CAP_CUSTOM : MULTIPLIER_CAP_NORMAL
        const rawMult = multiplierOf(props)
        const mult = Math.min(rawMult, maxCap)
        if (mult === 0) continue

        const span = spanFor(props.size)
        if (!span) continue

        const raw = scoreDashboardItem(
          isCustom ? props : (dbiResult || props),
          auth,
          resource,
          isCustom
        )

        const controls = isCustom ? [] : (dbiResult?.controls || [])
        const data = isCustom ? null : (dbiResult?.data || null)
        const authBonus = Boolean(dbiResult?.auth)
        const usersBonus = Boolean(dbiResult?.users)

        const entry = {
          key: `${resource}::${name}`,
          resource,
          scope,
          custom: isCustom,
          hideOnEmpty: sheetItem.hideOnEmpty === true,
          props,
          data,
          controls,
          resourceLoading: getResourceLoading(resource),
          span,
          raw,
          mult,
          auth: authBonus,
          users: usersBonus
        }

        if (!survivorsByResource.has(resource)) {
          survivorsByResource.set(resource, [])
        }
        survivorsByResource.get(resource).push(entry)
      }
    }

    const scored = []
    for (const [, resourceSurvivors] of survivorsByResource.entries()) {
      const n = resourceSurvivors.length
      const normalSurvivors = resourceSurvivors.filter((it) => !it.custom)
      const normalCount = normalSurvivors.length

      const normalBag = normalCount > 0
        ? normalSurvivors.reduce((acc, it) => acc + it.raw, 0) / normalCount
        : 0
      const normalShare = shareWeight(normalCount)

      resourceSurvivors.forEach((it, i) => {
        const position = positionWeight(i, n)
        const bag = it.custom ? it.raw : normalBag
        const share = it.custom ? 1 : normalShare
        const scoreValue = bag * position * share * it.mult

        scored.push({
          key: it.key,
          resource: it.resource,
          scope: it.scope,
          custom: it.custom,
          hideOnEmpty: it.hideOnEmpty,
          props: it.props,
          data: it.data,
          controls: it.controls,
          resourceLoading: it.resourceLoading,
          score: {
            raw: it.raw,
            bag,
            position,
            share,
            mult: it.mult,
            auth: it.auth,
            users: it.users,
            n,
            value: scoreValue
          },
          span: it.span
        })
      })
    }

    const cutoff = Number(auth.dashboardScoreCutoff) || 0
    const filtered = cutoff > 0
      ? scored.filter((it) => it.score.value >= cutoff)
      : scored

    return [...filtered].sort((a, b) => b.score.value - a.score.value)
  })

  return {
    dashboardProps,
    items,
    loaded
  }
}
