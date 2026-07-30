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

// `Create` content — primary FormRecord + one FormChild per eligible child; submit is owned by PageAction.
defineOptions({ name: 'ContentsCreate', inheritAttrs: false })

const props = defineProps({
  withChildren: { type: Boolean, default: true },
  // Suppress a child by resource name or slug (case-insensitive); both props are checked.
  hideChild: { type: [String, Array], default: null },
  hideChildren: { type: [String, Array], default: null },
  // 'inline' (default) | 'popup' | 'multi' | 'multiple'
  childMode: { type: String, default: 'inline' },
  closeOnAdd: { type: Boolean, default: true },
  listPosition: { type: String, default: 'top' },
  hideFields: { type: Array, default: () => [] },
  // Highest-precedence visibility switch — wins over hideFields/showCode/workflowFields/Status.
  showFields: { type: Array, default: () => [] },
  // Code is server-generated, so hidden by default.
  showCode: { type: Boolean, default: false },
  // Parent-link columns on child forms are filled by compositeSave, so hidden by default.
  hideParentLink: { type: Boolean, default: true },
  childHideFields: { type: Array, default: () => [] },
  workflowFields: { type: [String, Boolean], default: 'hide' },
  showStatus: { type: [Boolean, String], default: false },
  statusDefault: { type: String, default: 'Active' },
  fields: { type: Array, default: null },
  // Object, or (record, ctx) => Object; individual values may also be (record, ctx) => value.
  defaultValues: { type: [Object, Function], default: () => ({}) },
  // Per-header control overrides: Object, function, or object of per-header functions.
  fieldProps: { type: [Object, Function], default: () => ({}) },
  columns: { type: Number, default: 1 },
  title: { type: String, default: '' },
  recordTitleFallback: { type: String, default: 'Details' },
  sectionTitles: { type: Object, default: () => ({}) },
  // Escape hatches merged last into each rendered sub-component's props.
  formRecordProps: { type: Object, default: () => ({}) },
  formChildProps: { type: Object, default: () => ({}) },
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

// pageState is shared across navigations, so a resource switch must reset the node, not reuse it.
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

// Schema headers -> node.record (submitted); custom headers -> node.controls (never built).
function onPrimaryField (header, value, meta) {
  if (!pageState || !resourceName.value) return
  if (meta?.custom) pageState.setControlField(resourceName.value, header, value)
  else pageState.setField(resourceName.value, header, value)
}

// Children of the active resource; master scope surfaces only master-scoped children.
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

// Dynamic prop/$attrs flag, e.g. `hideGoodsReceipts` — matched against child name, slug, or PascalName.
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

// hideChild + hideChildren merged into one case-insensitive name/slug lookup set.
const hiddenChildKeys = computed(() => {
  const raw = [
    ...(Array.isArray(props.hideChild) ? props.hideChild : props.hideChild ? [props.hideChild] : []),
    ...(Array.isArray(props.hideChildren) ? props.hideChildren : props.hideChildren ? [props.hideChildren] : [])
  ]
  return new Set(raw.filter(Boolean).map((v) => String(v).toLowerCase()))
})

const primaryHideFields = computed(() => [...props.hideFields])

const childHideFieldsResolved = computed(() => [
  ...(props.hideParentLink
    ? ['ParentCode', `${singularize(resourceName.value)}Code`]
    : []),
  ...props.hideFields,
  ...props.childHideFields
])

// Precedence: $attrs, then explicit props, then the caller's escape hatch.
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

// Per-child FormChild override lookup; candidate paths are listed in resolveChildOverride below.
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

  // Normalized like useContentResolver.js so kebab-case slugs match the glob registry keys.
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
