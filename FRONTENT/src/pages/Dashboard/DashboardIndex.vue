<template>
  <q-page padding :class="dashboardProps.pageClass">
    <div class="row items-center q-mb-md">
      <div class="text-subtitle1">Dashboard</div>
      <q-space />
      <div class="text-caption text-grey-7">
        {{ headerSummary }}
      </div>
    </div>

    <div v-if="loaded && !tiles.length" class="aql-dashboard-blank">
      <q-icon name="dashboard_customize" size="40px" color="grey-5" />
      <div class="aql-dashboard-blank__text">{{ blankMessage }}</div>
    </div>

    <div
      v-show="tiles.length"
      ref="gridEl"
      class="aql-dashboard-grid"
      :class="dashboardProps.gridClass"
      :style="gridStyle"
    >
      <Widget
        v-for="tile in tiles"
        :key="tile.key"
        :item="tile.item"
        :data="tile.data"
        :error="tile.error"
        :scope="tile.scope"
        :resource="tile.resource"
        :ui-name="tile.uiName"
        :span="tile.span"
        :grid-width="gridWidth"
        :gap="dashboardProps.gap"
        :row-unit="dashboardProps.rowUnit"
      />
    </div>
  </q-page>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount, shallowRef } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from 'src/stores/auth'
import { useDataStore } from 'src/stores/data'
import { findResourceConfig, evalPermissionRules } from 'src/composables/resources/useResourceConfig'
import { buildDashboardContext } from 'src/composables/dashboard/useDashboardContext'
import { useDashboardResolver } from 'src/composables/resources/useDashboardResolver'
import { resolveDashboardItem } from 'src/composables/dashboard/useDashboardItem'
import { scoreDashboardItem, multiplierOf } from 'src/composables/dashboard/useDashboardScore'
import Widget from 'src/components/Widget.vue'

const $q = useQuasar()
const auth = useAuthStore()
const dataStore = useDataStore()

const { ready: dashboardReady, dashboardProps } = useDashboardResolver()

const gridStyle = computed(() => ({
  gap: `${dashboardProps.value.gap}px`,
  gridTemplateColumns: `repeat(${dashboardProps.value.columns}, 1fr)`
}))

const descriptorModules = import.meta.glob('../../_resource/*/*/Dashboard/index.js')

const descriptorRegistry = {}
Object.keys(descriptorModules).forEach((rawPath) => {
  const resource = rawPath.split('/').slice(-3)[0]
  descriptorRegistry[resource.toLowerCase()] = descriptorModules[rawPath]
})

const descriptorsByItemKey = shallowRef({})
const loaded = ref(false)

const gridEl = ref(null)
const gridWidth = ref(0)
let observer = null

onMounted(() => {
  observer = new ResizeObserver(([entry]) => {
    gridWidth.value = entry.contentRect.width
  })
  const attach = () => {
    if (!gridEl.value) return false
    gridWidth.value = gridEl.value.getBoundingClientRect().width
    observer.observe(gridEl.value)
    return true
  }
  if (!attach()) requestAnimationFrame(attach)
})

onBeforeUnmount(() => observer?.disconnect())

const BREAKPOINTS = ['xs', 'sm', 'md', 'lg', 'xl']

const allItems = computed(() => {
  const out = []
  for (const cfg of auth.resources || []) {
    const list = cfg?.ui?.dashboard
    if (!Array.isArray(list)) continue
    for (const item of list) {
      if (!item?.name || !item?.widget) continue
      if (item.active === false) continue
      if (multiplierOf(item) === 0) continue
      out.push({
        item,
        resource: cfg.name,
        scope: cfg.scope || 'master',
        uiName: cfg.ui?.customUIName || 'AQL'
      })
    }
  }
  return out
})

const neededResources = computed(() => {
  const set = new Set()
  for (const { item, resource } of allItems.value) {
    set.add(resource)
    const p = item.permission
    if (p && typeof p === 'object' && !Array.isArray(p)) {
      Object.keys(p).forEach((r) => set.add(r))
    }
  }
  return [...set]
})

const permitted = (item, ownerResource) => {
  const p = item.permission
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
    return Number(picked) || 12
  }
  return 0
}

const headerSummary = computed(() => {
  const cutoff = auth.dashboardScoreCutoff
  const cutoffSegment = cutoff > 0 ? ` · cutoff ${cutoff}` : ''
  return `${tiles.value.length} of ${allItems.value.length} items${cutoffSegment} · ${$q.screen.name}`
})

const blankMessage = computed(() => allItems.value.length
  ? 'Nothing to show for you right now.'
  : 'No resource has anything in App.Resources.Dashboard.')

const tiles = computed(() => {
  if (!loaded.value) return []
  const out = []
  const cutoff = Number(auth.dashboardScoreCutoff) || 0

  for (const { item, resource, scope, uiName } of allItems.value) {
    if (!permitted(item, resource)) continue

    const score = scoreDashboardItem(item, auth, resource)
    if (cutoff > 0 && score < cutoff) continue

    const span = spanFor(item.size)
    if (!span) continue

    const itemKey = `${resource}::${item.name}`
    const descriptor = descriptorsByItemKey.value[itemKey] || null

    let data = null
    let error = null

    if (descriptor) {
      try {
        const controls = Object.fromEntries(
          (descriptor.controls || []).map((c) => [c.name, c.value])
        )
        const result = descriptor.compute(buildDashboardContext(controls))
        data = {
          name: descriptor.name,
          title: descriptor.title,
          subtitle: descriptor.subtitle,
          caption: descriptor.caption,
          controls: descriptor.controls,
          ...(result || {})
        }
      } catch (err) {
        console.error(`[Dashboard] Failed compute for "${resource}::${item.name}":`, err)
        data = null
        error = err?.message || String(err)
      }
    }

    out.push({
      key: itemKey,
      item,
      data,
      error,
      resource,
      scope,
      uiName,
      span,
      multiplier: multiplierOf(item),
      score,
      auth: Boolean(item.auth),
      users: Boolean(item.users)
    })
  }

  return [...out].sort((a, b) => b.score - a.score)
})

onMounted(async () => {
  const resourceModules = {}
  for (const resource of neededResources.value) {
    const key = resource.toLowerCase()
    if (!descriptorRegistry[key]) continue
    try {
      const mod = await descriptorRegistry[key]()
      resourceModules[key] = mod.descriptors || mod.default || []
    } catch (err) {
      console.error(`[Dashboard] Failed to load dashboard data for "${resource}":`, err)
    }
  }

  const resolvedByItemKey = {}
  await Promise.all(
    allItems.value.map(async ({ item, resource, scope, uiName }) => {
      const source = item.source || item.name
      const rawList = resourceModules[resource.toLowerCase()] || []
      const descriptor = rawList.find((d) => d?.name === source) || null
      if (!descriptor) return

      const resolved = await resolveDashboardItem({
        descriptor,
        name: item.name,
        scope,
        resource,
        uiName
      })
      resolvedByItemKey[`${resource}::${item.name}`] = resolved
    })
  )

  descriptorsByItemKey.value = resolvedByItemKey
  loaded.value = true

  for (const resource of neededResources.value) {
    if (dataStore.hasRows(resource)) continue
    dataStore.loadResource(resource).catch(() => {})
  }
})
</script>

<style scoped>
.aql-dashboard-blank {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 48px 16px;
  text-align: center;
}

.aql-dashboard-blank__text {
  font-size: 13px;
  opacity: 0.6;
}

.aql-dashboard-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  grid-auto-rows: 40px;
  grid-auto-flow: row dense;
}
</style>
