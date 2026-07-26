<template>
  <div>
    <div
      v-for="(section, index) in sectionsList"
      :key="section.key"
      :class="sectionClass"
      :style="{ animationDelay: `${index * sectionStagger}ms` }"
    >
      <FormRecord
        v-if="section.type === 'record'"
        v-bind="primaryFormProps"
        :title="section.title"
        @update:field="onPrimaryField"
      />
      <component
        v-else
        :is="section.component"
        v-bind="section.props"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, inject, ref, watch, markRaw, useAttrs } from 'vue'
import FormRecord from 'components/contents/FormRecord.vue'
import FormChild from 'components/contents/FormChild.vue'
import { singularize, toPascalCase } from 'src/utils/appHelpers'

/**
 * `Create` content (page contract `contents: ['Create']`) — renders the input
 * form for the primary resource plus one FormChild container per eligible child
 * resource (`ParentResource` === active resource). All input lands directly in
 * pageState (primary node record + child buckets); submit is owned by the
 * PageAction sections, never here. Parent-relation forms are never rendered.
 *
 * ZERO-HARDCODING CONTRACT: every default behaviour, title, and class below is
 * exposed as a prop; unhandled `$attrs` flow down to the primary FormRecord and
 * every FormChild section.
 */
defineOptions({ name: 'ContentsCreate', inheritAttrs: false })

const props = defineProps({
  // Master switch for child resource handling.
  withChildren: { type: Boolean, default: true },
  // Suppresses specific eligible child resources from rendering, matched by
  // resource name or slug (case-insensitive). Accepts a single string or an
  // array; hideChild/hideChildren are equivalent, both are checked.
  hideChild: { type: [String, Array], default: null },
  hideChildren: { type: [String, Array], default: null },
  // Forwarded to FormChild: 'inline' (default) | 'popup' | 'multi' | 'multiple'.
  childMode: { type: String, default: 'inline' },
  closeOnAdd: { type: Boolean, default: true },
  listPosition: { type: String, default: 'top' },
  // Extra headers to hide on top of FormRecord's own Code/Status/workflow-stamp
  // hiding.
  hideFields: { type: Array, default: () => [] },
  // Highest-precedence visibility switch — headers listed here render even if
  // hideFields/showCode/workflowFields/Status-default would have hidden them.
  showFields: { type: Array, default: () => [] },
  // Code is server-generated so it is hidden by default; true → renders it as
  // a normal editable control.
  showCode: { type: Boolean, default: false },
  // Parent-link columns hidden on child forms (filled by compositeSave). Set
  // false to render them, or supply extra names via childHideFields.
  hideParentLink: { type: Boolean, default: true },
  childHideFields: { type: Array, default: () => [] },
  // Workflow action-stamp hiding, forwarded to the primary FormRecord + children.
  workflowFields: { type: [String, Boolean], default: 'hide' },
  // Status visibility / seed value, forwarded to FormRecord.
  showStatus: { type: [Boolean, String], default: false },
  statusDefault: { type: String, default: 'Active' },
  // Explicit primary-field ordering, forwarded to FormRecord.
  fields: { type: Array, default: null },
  // Seed values for the primary node's record. Object, or (record, ctx) => Object;
  // individual values may themselves be (record, ctx) => value functions.
  defaultValues: { type: [Object, Function], default: () => ({}) },
  // Per-field control prop overrides keyed by header (Object, function, or
  // object of per-header functions) — forwarded to FormRecord + FormChild.
  fieldProps: { type: [Object, Function], default: () => ({}) },
  columns: { type: Number, default: 1 },
  // Primary section title. Falls back to `recordTitleFallback` when children exist.
  title: { type: String, default: '' },
  recordTitleFallback: { type: String, default: 'Details' },
  // Per-child section title overrides, keyed by child resource name.
  sectionTitles: { type: Object, default: () => ({}) },
  // Escape hatches merged last into the props of each rendered sub-component.
  formRecordProps: { type: Object, default: () => ({}) },
  formChildProps: { type: Object, default: () => ({}) },
  // Section layout / entrance.
  sectionClass: { type: [String, Array, Object], default: 'cf-section' },
  sectionStagger: { type: Number, default: 60 }
})

const attrs = useAttrs()

const resourceConfig = inject('resourceConfig', null)
const resourceRecord = inject('resourceRecord', null)
const pageState = inject('pageState', null)

const resourceName = computed(() => resourceConfig?.resourceName?.value || '')
const scope = computed(() => resourceConfig?.scope?.value || '')
const resourceSlug = computed(() => resourceConfig?.resourceSlug?.value || '')
const uiName = computed(() => resourceConfig?.customUIName?.value || '')

// Ensure the primary pageState node exists before any input binds to it, and
// flush any stale nodes left over from a previously-visited resource page
// (pageState is a single Page.vue-provided instance shared across navigations,
// so switching from e.g. Products/create to Warehouses/create must not carry
// over the old primary node or child buckets).
watch(
  resourceName,
  (name, prevName) => {
    if (!name || !pageState) return
    if (name !== prevName) {
      pageState.initResource(name, { isPrimaryKey: true, reset: true })
    } else if (!pageState.state.nodes.has(name)) {
      pageState.initResource(name, { isPrimaryKey: true })
    }
  },
  { immediate: true }
)

const primaryRecord = computed(
  () => pageState?.state?.nodes?.get(resourceName.value)?.record || {}
)

// Canonical schema headers -> node.record (submitted); non-schema custom
// headers (resolved by FormRecord's `custom: true` flag) -> node.controls,
// which defaultBuild never reads (see usePageState.js).
function onPrimaryField (header, value, meta) {
  if (!pageState || !resourceName.value) return
  if (meta?.custom) pageState.setControlField(resourceName.value, header, value)
  else pageState.setField(resourceName.value, header, value)
}

// Child resources whose ParentResource is the active resource. In master scope
// only master-scoped children are surfaced (mirrors ViewChildren).
const eligibleChildren = computed(() => {
  if (!props.withChildren) return []
  const name = resourceName.value
  if (!name) return []
  let list = (resourceRecord?.childResources?.value || [])
    .filter((c) => c?.parentResource === name)
  if (scope.value.toLowerCase() === 'master') {
    list = list.filter((c) => c.scope === 'master')
  }
  if (hiddenChildKeys.value.size) {
    list = list.filter((c) => {
      const keys = [c?.name, c?.slug].filter(Boolean).map((k) => String(k).toLowerCase())
      return !keys.some((k) => hiddenChildKeys.value.has(k))
    })
  }
  list = list.filter((c) => !isChildHiddenByDynamicFlag(c))
  return list
})

// Dynamic `hide<ResourceName>: true` (or `hide<Slug>` / `hide<PascalName>`) prop
// or $attrs flag — lets a caller suppress a specific child by name without
// needing hideChild/hideChildren, e.g. `hideGoodsReceipts` / `hidePOReceivingItems`.
function isChildHiddenByDynamicFlag (child) {
  const candidates = [child?.name, child?.slug, toPascalCase(child?.name || '')]
    .filter(Boolean)
    .map((v) => `hide${v}`.toLowerCase())
  const sources = [props, attrs]
  for (const source of sources) {
    for (const key of Object.keys(source)) {
      if (!candidates.includes(key.toLowerCase())) continue
      const value = source[key]
      if (value === true || value === 'true') return true
    }
  }
  return false
}

// hideChild/hideChildren merged into one case-insensitive lookup set — a
// child resource is suppressed if its name OR slug matches either prop.
const hiddenChildKeys = computed(() => {
  const raw = [
    ...(Array.isArray(props.hideChild) ? props.hideChild : props.hideChild ? [props.hideChild] : []),
    ...(Array.isArray(props.hideChildren) ? props.hideChildren : props.hideChildren ? [props.hideChildren] : [])
  ]
  return new Set(raw.filter(Boolean).map((v) => String(v).toLowerCase()))
})

// Code/Status/workflow action-stamp columns are hidden by FormRecord itself.
const primaryHideFields = computed(() => [...props.hideFields])

const childHideFieldsResolved = computed(() => [
  ...(props.hideParentLink
    ? ['ParentCode', `${singularize(resourceName.value)}Code`]
    : []),
  ...props.hideFields,
  ...props.childHideFields
])

// Unhandled attributes flow down first; explicit props win; caller escape-hatch last.
const primaryFormProps = computed(() => ({
  ...attrs,
  resource: resourceName.value,
  record: primaryRecord.value,
  hideFields: primaryHideFields.value,
  showFields: props.showFields,
  showCode: props.showCode,
  fields: props.fields,
  defaultValues: props.defaultValues,
  fieldProps: props.fieldProps,
  workflowFields: props.workflowFields,
  showStatus: props.showStatus,
  statusDefault: props.statusDefault,
  columns: props.columns,
  scope: scope.value,
  resourceSlug: resourceSlug.value,
  uiName: uiName.value,
  ...props.formRecordProps
}))

function defaultChildProps (child) {
  return {
    ...attrs,
    childResource: child,
    parentResource: resourceName.value,
    childMode: props.childMode,
    listPosition: props.listPosition,
    closeOnAdd: props.closeOnAdd,
    hideFields: childHideFieldsResolved.value,
    showFields: props.showFields,
    showCode: props.showCode,
    workflowFields: props.workflowFields,
    showStatus: props.showStatus,
    statusDefault: props.statusDefault,
    fieldProps: props.fieldProps,
    columns: props.columns,
    ...(props.sectionTitles[child.name] ? { title: props.sectionTitles[child.name] } : {}),
    ...props.formChildProps
  }
}

// ── Per-child FormChild override: formchild<ChildName>.(vue|js) ────────────
// Mirrors ViewChildren's per-child resolution:
//  1. _ui/{ui}/components/{scope}/{parentResourceSlug}/formchild{childName}.(vue|js)
//  2. _ui/{ui}/components/{childScope}/{childResourceSlug}/formchild.(vue|js)
const customUiModules = import.meta.glob('../../_ui/**/*.{vue,js}')
const customUiRegistry = {}
Object.keys(customUiModules).forEach((rawPath) => {
  const key = rawPath.replace(/^\.\.\/\.\.\//, '').toLowerCase()
  customUiRegistry[key] = customUiModules[rawPath]
})

async function loadModule (loader) {
  try {
    const mod = await loader()
    const exported = mod.default ?? mod
    if (typeof exported === 'function' || (typeof exported === 'object' && exported !== null)) {
      return exported
    }
    return null
  } catch (err) {
    console.error('[Create] Failed to load FormChild override module:', err)
    return null
  }
}

async function resolveChildOverride (child) {
  const uiKey = (uiName.value || '').toLowerCase()
  if (!uiKey) return null

  // Normalized exactly like useContentResolver.js (toPascalCase then lowercase)
  // so a kebab-case slug (e.g. 'outlet-visits') matches the Vite glob registry
  // folder key ('outletvisits') instead of leaking hyphens into the path.
  const parentSlug = toPascalCase(resourceSlug.value || resourceName.value || '').toLowerCase()
  const childName = toPascalCase(child.name).toLowerCase()
  const childScope = (child.scope || scope.value || '').toLowerCase()
  const childSlug = toPascalCase(child.slug || child.name).toLowerCase()
  const uiBase = `_ui/${uiKey}/components`
  const parentScope = scope.value.toLowerCase()

  const candidates = [
    { path: `${uiBase}/${parentScope}/${parentSlug}/formchild${childName}.vue`, isVue: true },
    { path: `${uiBase}/${parentScope}/${parentSlug}/formchild${childName}.js`, isVue: false },
    { path: `${uiBase}/${childScope}/${childSlug}/formchild.vue`, isVue: true },
    { path: `${uiBase}/${childScope}/${childSlug}/formchild.js`, isVue: false }
  ]

  for (const { path, isVue } of candidates) {
    const loader = customUiRegistry[path]
    if (!loader) continue
    const exported = await loadModule(loader)
    if (!exported) continue
    return { exported, isVue }
  }
  return null
}

const childEntries = ref([])

async function resolveChildEntries () {
  const entries = []
  for (const child of eligibleChildren.value) {
    const override = await resolveChildOverride(child)
    const baseProps = defaultChildProps(child)

    if (override?.isVue) {
      entries.push({ key: child.name, component: markRaw(override.exported), props: { ...baseProps } })
    } else if (override && !override.isVue) {
      const mod = override.exported
      let jsRes = null
      if (typeof mod === 'function') {
        try {
          jsRes = mod(child, { pageState, resourceConfig, resourceRecord })
        } catch (err) {
          console.error('[Create] FormChild JS modifier failed:', err)
        }
      } else if (typeof mod === 'object') {
        jsRes = mod
      }
      const mergedProps = (jsRes && typeof jsRes === 'object') ? { ...baseProps, ...jsRes } : baseProps
      entries.push({ key: child.name, component: markRaw(FormChild), props: mergedProps })
    } else {
      entries.push({ key: child.name, component: markRaw(FormChild), props: baseProps })
    }
  }
  childEntries.value = entries
}

watch(
  [eligibleChildren, uiName, scope],
  () => { resolveChildEntries() },
  { immediate: true, deep: true }
)

const sectionsList = computed(() => [
  {
    type: 'record',
    key: '__record__',
    title: props.title || (eligibleChildren.value.length ? props.recordTitleFallback : '')
  },
  ...childEntries.value.map((entry) => ({
    type: 'child',
    key: entry.key,
    component: entry.component,
    props: entry.props
  }))
])
</script>

<style scoped>
@keyframes cf-section-in {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
.cf-section {
  animation: cf-section-in 260ms ease-out both;
}
@media (prefers-reduced-motion: reduce) {
  .cf-section { animation: none; }
}
</style>
