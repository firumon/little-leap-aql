<template>
  <div v-if="!resolversReady && parentRecordsList.length" class="q-py-md text-center">
    <q-spinner-dots color="primary" size="24px" />
  </div>
  <template v-else>
    <div v-for="entry in parentResolvers" :key="entry.key">
      <component :is="entry.component" v-bind="entry.props" />
    </div>
  </template>
</template>

<script setup>
import { ref, computed, watch, markRaw, inject, useAttrs } from 'vue'
import { useAuthStore } from 'src/stores/auth'
import { useDataStore } from 'src/stores/data'
import {
  toPascalCase,
  humanizeString,
  singularize
} from 'src/utils/appHelpers'
import ViewRecord from 'components/contents/ViewRecord.vue'

/**
 * INVARIANT: ViewParent renders ONLY parent detail cards. It never renders
 * an audit trail (ViewAudit / ViewRecordWithAudit). Audit is emitted
 * exclusively by the top-level 'Audit' ordered section in View.vue.
 */
defineOptions({ name: 'ContentsViewParent', inheritAttrs: false })

const attrs = useAttrs()

// ─── Glob registry (Vite deduplicates identical globs) ─────────────────────────
const customUiModules = import.meta.glob('../../_ui/**/*.{vue,js}')
const customUiRegistry = {}
Object.keys(customUiModules).forEach((rawPath) => {
  const key = rawPath.replace(/^\.\.\/\.\.\//, '').toLowerCase()
  customUiRegistry[key] = customUiModules[rawPath]
})

const authStore = useAuthStore()
const dataStore = useDataStore()

const { scope, resourceName, resourceSlug, customUIName, additionalActions } = inject('resourceConfig')
const { record } = inject('resourceRecord')
const pageState = inject('pageState', null)
const resourceRecord = inject('resourceRecord', null)

function getResourceSlug(res) {
  if (res.slug) return res.slug
  const route = res.ui?.menus?.[0]?.route || res.Menu?.[0]?.route
  if (route) {
    const parts = route.split('/')
    return parts[parts.length - 1]
  }
  return (res.name || '')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase()
}

// Same resolution as _common/sections/Content/Parent.vue
const parentRecordsList = computed(() => {
  const pKeys = record.value?._Parents || []
  const relations = dataStore.getRelations(resourceName.value)
  const allResources = Array.isArray(authStore.resources) ? authStore.resources : []

  const list = []
  for (const key of pKeys) {
    const pRecord = record.value?.[key]
    if (!pRecord) continue

    const singular = key.slice(1).toLowerCase()

    let parentResName = null
    const parentMatch = relations.parents.find((p) => p.singular.toLowerCase() === singular)
    if (parentMatch) {
      parentResName = parentMatch.resourceName
    } else {
      for (const [, refResource] of Object.entries(relations.linkRefs)) {
        if (singularize(refResource).toLowerCase() === singular) {
          parentResName = refResource
          break
        }
      }
    }

    if (!parentResName) {
      parentResName = singular.endsWith('y') ? `${singular.slice(0, -1)}ies` : `${singular}s`
    }

    const pRes = allResources.find((r) => r.name.toLowerCase() === parentResName.toLowerCase())
    if (pRes) {
      list.push({ key, parentRecord: pRecord, parentResource: pRes })
    }
  }
  return list
})

function resolveTitle(item) {
  return humanizeString(singularize(item.parentResource.name || ''))
}

async function loadModule(loader) {
  try {
    const mod = await loader()
    const exported = mod.default ?? mod
    if (typeof exported === 'function' || (typeof exported === 'object' && exported !== null)) {
      return exported
    }
    return null
  } catch (err) {
    console.error('[ViewParent] Failed to load module:', err)
    return null
  }
}

async function resolveOverride(item) {
  const uiKey = (customUIName.value || '').toLowerCase()
  if (!uiKey) return null

  const currentScope = (scope.value || '').toLowerCase()
  // Normalized exactly like useContentResolver.js (toPascalCase then lowercase)
  // so a kebab-case slug (e.g. 'outlet-visits') matches the Vite glob registry
  // folder key ('outletvisits') instead of leaking hyphens into the path.
  const currentResourceSlug = toPascalCase(resourceSlug.value || resourceName.value || '').toLowerCase()
  const parentName = toPascalCase(item.parentResource.name).toLowerCase()
  const parentScope = (item.parentResource.scope || scope.value || '').toLowerCase()
  const parentResourceSlug = toPascalCase(getResourceSlug(item.parentResource)).toLowerCase()
  const uiBase = `_ui/${uiKey}/components`

  const candidates = [
    { path: `${uiBase}/${currentScope}/${currentResourceSlug}/viewparent${parentName}.vue`, isVue: true },
    { path: `${uiBase}/${currentScope}/${currentResourceSlug}/viewparent${parentName}.js`, isVue: false },
    { path: `${uiBase}/${parentScope}/${parentResourceSlug}/viewparent.vue`, isVue: true },
    { path: `${uiBase}/${parentScope}/${parentResourceSlug}/viewparent.js`, isVue: false }
  ]

  for (const { path, isVue } of candidates) {
    const loader = customUiRegistry[path]
    if (loader) {
      const exported = await loadModule(loader)
      if (exported) {
        return { exported, isVue }
      }
    }
  }

  return null
}

const parentResolvers = ref([])
const resolversReady = ref(false)

async function resolveParents() {
  resolversReady.value = false
  const resolvers = []

  for (const item of parentRecordsList.value) {
    const override = await resolveOverride(item)

    const baseProps = {
      skipEmpty: true,
      ...attrs,
      parentRecord: item.parentRecord,
      parentResource: item.parentResource,
      record: item.parentRecord,
      resolvedFields: null,
      resourceName: item.parentResource.name,
      resourceSlug: getResourceSlug(item.parentResource),
      scope: item.parentResource.scope || scope.value,
      uiName: customUIName.value,
      showCodeLink: true,
      detailsConfig: { title: resolveTitle(item) }
    }

    if (override) {
      if (override.isVue) {
        resolvers.push({
          key: item.key,
          component: markRaw(override.exported),
          props: baseProps
        })
        continue
      } else {
        // JS file modifier (function or object)
        const mod = override.exported
        let jsRes = null
        if (typeof mod === 'function') {
          try {
            jsRes = mod(item.parentRecord, item.parentResource, {
              pageState,
              resourceConfig: { scope, resourceName, resourceSlug, customUIName, additionalActions },
              resourceRecord
            })
          } catch (err) {
            console.error('[ViewParent] JS modifier function failed:', err)
          }
        } else if (typeof mod === 'object') {
          jsRes = mod
        }

        const mergedProps = (jsRes && typeof jsRes === 'object')
          ? { ...baseProps, ...jsRes }
          : baseProps

        resolvers.push({
          key: item.key,
          component: markRaw(ViewRecord),
          props: mergedProps
        })
        continue
      }
    }

    resolvers.push({
      key: item.key,
      component: markRaw(ViewRecord),
      props: baseProps
    })
  }

  parentResolvers.value = resolvers
  resolversReady.value = true
}

watch(
  () => [parentRecordsList.value, customUIName.value, scope.value],
  () => { resolveParents() },
  { immediate: true, deep: true }
)
</script>
