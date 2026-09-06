import { computed, inject, shallowRef, watch } from 'vue'
import { toPascalCase } from 'src/utils/appHelpers'
import { isActionVisible } from 'src/composables/resources/useResourceConfig'
import { useResourceNav } from 'src/composables/resources/useResourceNav'

// Same registry the action resolver scans, kept in original case so an action
// name can be read back off the file name.
const customUiModules = import.meta.glob('../../_ui/**/*.{vue,js}')

const PREFIX = 'resourceaction'
// The cluster container and its menu trigger also start with the prefix.
const RESERVED = new Set(['resourceactions', 'resourceactionsfab'])
const TARGETS_NEEDING_CODE = new Set(['view', 'edit', 'action', 'record'])

const localActionFiles = []
Object.keys(customUiModules).forEach((rawPath) => {
  const path = rawPath.replace(/^\.\.\/\.\.\//, '')
  const cut = path.lastIndexOf('/')
  const file = path.slice(cut + 1)
  const dot = file.lastIndexOf('.')
  const base = file.slice(0, dot)
  const lower = base.toLowerCase()
  if (!lower.startsWith(PREFIX) || RESERVED.has(lower)) return
  const name = base.slice(PREFIX.length)
  if (!name) return
  localActionFiles.push({
    dir: path.slice(0, cut).toLowerCase(),
    ext: file.slice(dot + 1).toLowerCase(),
    name,
    actionName: `ResourceAction${name}`,
    loader: customUiModules[rawPath]
  })
})

function humanize (name) {
  return String(name).replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim()
}

function gate (value, record) {
  return typeof value === 'function' ? value(record) : value
}

/**
 * Finds local `ResourceAction*.{vue,js}` files under `_ui/` and turns the ones
 * that name a brand-new action into FAB cluster entries.
 *
 * A file whose name matches a CRUD or sheet action is NOT returned here — that
 * file is already the override for that entry, resolved by `useActionResolver`.
 *
 * @param {ComputedRef<object>} context - { page, scope, resource, uiName }
 * @param {ComputedRef<Set<string>>} taken - lowercased action names already listed
 */
export function useLocalResourceActions (context, taken) {
  const resourceConfig = inject('resourceConfig', null)
  const resourceRecord = inject('resourceRecord', null)
  const pageState      = inject('pageState', null)
  const nav = useResourceNav()

  const definitions = shallowRef([])

  const tiers = computed(() => {
    const ctx = context.value || {}
    const ui = String(ctx.uiName || '').toLowerCase()
    if (!ui) return []
    const scope = String(ctx.scope || '').toLowerCase()
    const resource = toPascalCase(ctx.resource || '').toLowerCase()
    const page = String(ctx.page || '').toLowerCase()
    if (!scope || !resource) return []
    const root = `_ui/${ui}/components/${scope}/${resource}`
    return page ? [`${root}/${page}`, root] : [root]
  })

  // `.vue` first inside a tier, matching the resolver's own preference.
  const candidates = computed(() => {
    const seen = new Set()
    const list = []
    for (const dir of tiers.value) {
      for (const ext of ['vue', 'js']) {
        for (const file of localActionFiles) {
          if (file.dir !== dir || file.ext !== ext) continue
          const key = file.actionName.toLowerCase()
          if (seen.has(key)) continue
          seen.add(key)
          list.push(file)
        }
      }
    }
    return list
  })

  let loadToken = 0
  watch(
    () => candidates.value.map((file) => `${file.dir}/${file.actionName}.${file.ext}`).join('|'),
    async () => {
      const token = ++loadToken
      const files = candidates.value
      const loaded = []
      for (const file of files) {
        if (file.ext !== 'js') {
          loaded.push({ file, def: null })
          continue
        }
        try {
          const mod = await file.loader()
          loaded.push({ file, def: mod.default ?? mod })
        } catch (err) {
          console.error(`[useLocalResourceActions] Failed to load "${file.dir}/${file.actionName}.js":`, err)
        }
      }
      if (token !== loadToken) return
      definitions.value = loaded
    },
    { immediate: true }
  )

  function callCtx (record) {
    return {
      record,
      config: resourceConfig?.config?.value || null,
      pageState,
      nav
    }
  }

  function resolveDef (entry, record) {
    if (typeof entry.def === 'function') {
      try {
        return entry.def(callCtx(record)) || {}
      } catch (err) {
        console.error(`[useLocalResourceActions] "${entry.file.actionName}" threw:`, err)
        return {}
      }
    }
    return entry.def && typeof entry.def === 'object' ? entry.def : {}
  }

  function runLocal (def, record) {
    if (def.kind === 'navigate') {
      const target = def.navigate?.target || 'record'
      const slug = def.navigate?.pageSlug || ''
      const query = typeof def.navigate?.query === 'function'
        ? def.navigate.query(record)
        : def.navigate?.query
      const params = {
        scope: def.navigate?.scope,
        resourceSlug: def.navigate?.resourceSlug,
        pageSlug: slug,
        query
      }
      if (target === 'action') params.action = def.navigate?.action || slug
      if (TARGETS_NEEDING_CODE.has(target)) params.code = def.navigate?.code || record?.Code
      nav.goTo(target, params)
      return
    }
    const custom = def.run || def.handler
    if (typeof custom === 'function') custom(callCtx(record))
  }

  const localEntries = computed(() => {
    const record = resourceRecord?.record?.value || null
    const used = taken?.value || new Set()
    const list = []
    for (const entry of definitions.value) {
      const key = entry.file.actionName.toLowerCase()
      if (used.has(key)) continue
      const def = resolveDef(entry, record)
      // `allowed` takes an action name, a list of them, or a map of resource to
      // action — so an action that writes another resource gates on that one.
      const perm = def.permission ?? def.permissions
      if (perm != null && resourceConfig?.allowed?.(perm) !== true) continue
      if (!isActionVisible(def, record)) continue
      if (gate(def.show, record) === false) continue
      if (gate(def.hide, record) === true) continue
      const label = def.label || humanize(entry.file.name)
      list.push({
        key: `local:${key}`,
        name: def.action || entry.file.name,
        actionName: entry.file.actionName,
        props: {
          icon: def.icon || 'bolt',
          color: def.color || 'primary',
          label,
          tooltip: def.tooltip || label
        },
        run: () => runLocal(def, record)
      })
    }
    return list
  })

  return { localEntries }
}
