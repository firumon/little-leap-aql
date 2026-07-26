<template>
  <div v-if="!resolversReady" class="q-py-md text-center">
    <q-spinner-dots color="primary" size="24px" />
  </div>
  <template v-else>
    <div v-for="group in childResolvers" :key="group.key">
      <SectionDividerLabel :label="group.title" />

      <!-- Empty -->
      <div v-if="group.mode === 'empty'" class="text-grey-7 text-center q-py-md">No records</div>

      <!-- Compact: one grid for the whole group -->
      <component
        v-else-if="group.mode === 'compact'"
        :is="group.component"
        v-bind="group.props"
        @view-child="handleViewChild"
      />

      <!-- Expanded: one card per record, each delegated to ViewRecord (or a per-record override) -->
      <template v-else>
        <div v-for="item in group.items" :key="item.key" class="q-mb-sm">
          <component
            :is="item.component"
            v-bind="item.props"
            @view-child="handleViewChild"
          />
        </div>
      </template>
    </div>
  </template>
</template>

<script setup>
import { ref, watch, markRaw, inject, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import {
  toPascalCase,
  resolveChildFields,
  resolveChildTitle
} from 'src/utils/appHelpers'
import ViewChildCompact from 'components/contents/ViewChildCompact.vue'
import ViewRecord from 'components/contents/ViewRecord.vue'

/**
 * INVARIANT: ViewChildren renders ONLY child-record grids (compact) or per-record
 * detail cards (expanded, delegated to ViewRecord or a per-child override). It
 * never renders an audit trail (ViewAudit / ViewRecordWithAudit). Audit is emitted
 * exclusively by the top-level 'Audit' ordered section in View.vue.
 */
defineOptions({ name: 'ContentsViewChildren', inheritAttrs: false })

const attrs = useAttrs()

// ─── Glob registry (Vite deduplicates identical globs) ─────────────────────────
const customUiModules = import.meta.glob('../../_ui/**/*.{vue,js}')
const customUiRegistry = {}
Object.keys(customUiModules).forEach((rawPath) => {
  const key = rawPath.replace(/^\.\.\/\.\.\//, '').toLowerCase()
  customUiRegistry[key] = customUiModules[rawPath]
})

const nav = useResourceNav()

const { scope, customUIName, additionalActions, resourceSlug, resourceName } = inject('resourceConfig')
const { childResources, childRecordsByResource } = inject('resourceRecord')
const pageState = inject('pageState', null)
const resourceRecord = inject('resourceRecord', null)

const childResolvers = ref([])
const resolversReady = ref(false)

function modifierContext() {
  return {
    pageState,
    resourceConfig: { scope, resourceName, resourceSlug, customUIName, additionalActions },
    resourceRecord
  }
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
    console.error('[ViewChildren] Failed to load module:', err)
    return null
  }
}

async function resolveOverride(childResource) {
  const uiKey = (customUIName.value || '').toLowerCase()
  if (!uiKey) return null

  const currentScope = (scope.value || '').toLowerCase()
  // Normalized exactly like useContentResolver.js (toPascalCase then lowercase)
  // so a kebab-case slug (e.g. 'outlet-visits') matches the Vite glob registry
  // folder key ('outletvisits') instead of leaking hyphens into the path.
  const currentResourceSlug = toPascalCase(resourceSlug.value || resourceName.value || '').toLowerCase()
  const childName = toPascalCase(childResource.name).toLowerCase()
  const childScope = (childResource.scope || scope.value || '').toLowerCase()
  const childResourceSlug = toPascalCase(childResource.slug || childResource.name || '').toLowerCase()
  const uiBase = `_ui/${uiKey}/components`

  const candidates = [
    { path: `${uiBase}/${currentScope}/${currentResourceSlug}/viewchild${childName}.vue`, isVue: true },
    { path: `${uiBase}/${currentScope}/${currentResourceSlug}/viewchild${childName}.js`, isVue: false },
    { path: `${uiBase}/${childScope}/${childResourceSlug}/viewchild.vue`, isVue: true },
    { path: `${uiBase}/${childScope}/${childResourceSlug}/viewchild.js`, isVue: false }
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

function childRecordsFor(childResource) {
  const map = childRecordsByResource.value || {}
  if (Array.isArray(map[childResource.name]) && map[childResource.name].length) {
    return map[childResource.name]
  }
  const match = Object.keys(map).find(
    (k) => k.toLowerCase() === String(childResource.name).toLowerCase()
  )
  return (match && Array.isArray(map[match])) ? map[match] : []
}

// Base props for a single child record delegated to ViewRecord.
function viewRecordPropsFor(childResource, childRecord, fields) {
  return {
    skipEmpty: true,
    ...attrs,
    record: childRecord,
    resolvedFields: fields,
    resourceName: childResource.name,
    resourceSlug: childResource.slug || toPascalCase(childResource.name).toLowerCase(),
    scope: childResource.scope || scope.value,
    uiName: customUIName.value,
    showCodeLink: true,
    detailsConfig: { title: '' } // suppresses section title inside card
  }
}

// Builds one card entry per child record for expanded mode.
function buildExpandedItems(childResource, childRecords, fields, override) {
  return childRecords.map((childRecord, index) => {
    const key = childRecord.Code ?? `${childResource.name}-${index}`

    // 1. Per-record Vue SFC override.
    if (override?.isVue) {
      return {
        key,
        component: markRaw(override.exported),
        props: { ...attrs, record: childRecord, childResource, childRecords }
      }
    }

    const baseProps = viewRecordPropsFor(childResource, childRecord, fields)

    // 2. Per-record JS modifier (function or object) merged into ViewRecord props.
    if (override && !override.isVue) {
      const mod = override.exported
      let jsRes = null
      if (typeof mod === 'function') {
        try {
          jsRes = mod(childRecord, childResource, modifierContext())
        } catch (err) {
          console.error('[ViewChildren] JS modifier function failed:', err)
        }
      } else if (typeof mod === 'object') {
        jsRes = mod
      }
      const props = (jsRes && typeof jsRes === 'object') ? { ...baseProps, ...jsRes } : baseProps
      return { key, component: markRaw(ViewRecord), props }
    }

    // 3. No override — plain ViewRecord delegation.
    return { key, component: markRaw(ViewRecord), props: baseProps }
  })
}

// Builds the single group-level entry for compact mode (optionally overridden).
function buildCompactGroup(childResource, childRecords, fields, title, override) {
  const baseProps = {
    ...attrs,
    childResource,
    childRecords,
    fields,
    additionalActions: additionalActions.value
  }

  if (override?.isVue) {
    return { key: childResource.name, title, mode: 'compact', component: markRaw(override.exported), props: baseProps }
  }

  if (override && !override.isVue) {
    const mod = override.exported
    let jsRes = null
    if (typeof mod === 'function') {
      try {
        jsRes = mod(childResource, childRecords, modifierContext())
      } catch (err) {
        console.error('[ViewChildren] JS modifier function failed:', err)
      }
    } else if (typeof mod === 'object') {
      jsRes = mod
    }
    const props = (jsRes && typeof jsRes === 'object') ? { ...baseProps, ...jsRes } : baseProps
    return { key: childResource.name, title, mode: 'compact', component: markRaw(ViewChildCompact), props }
  }

  return { key: childResource.name, title, mode: 'compact', component: markRaw(ViewChildCompact), props: baseProps }
}

async function resolveChildren() {
  resolversReady.value = false
  const resolvers = []

  // In master scope, only surface child resources that are themselves master-scoped.
  const targets = scope.value === 'master'
    ? childResources.value.filter((c) => c.scope === 'master')
    : childResources.value

  for (const childResource of targets) {
    const childRecords = childRecordsFor(childResource)
    const title = resolveChildTitle(childResource)

    if (!childRecords.length) {
      resolvers.push({ key: childResource.name, title, mode: 'empty' })
      continue
    }

    const fields = resolveChildFields(childResource)
    const override = await resolveOverride(childResource)

    if (fields.length <= 5) {
      resolvers.push(buildCompactGroup(childResource, childRecords, fields, title, override))
    } else {
      resolvers.push({
        key: childResource.name,
        title,
        mode: 'expanded',
        items: buildExpandedItems(childResource, childRecords, fields, override)
      })
    }
  }

  childResolvers.value = resolvers
  resolversReady.value = true
}

function handleViewChild(childResource, code) {
  nav.goTo('view', {
    scope: childResource.scope || scope.value,
    resourceSlug: childResource.slug,
    code
  })
}

watch(
  () => [childResources.value, childRecordsByResource.value, customUIName.value, scope.value],
  () => { resolveChildren() },
  { immediate: true, deep: true }
)
</script>
