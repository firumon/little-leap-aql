<template>
  <div>
    <SectionDividerLabel v-if="activeConfig.title" :label="activeConfig.title" />

    <!-- Record-level custom UI override (viewrecord.vue) replaces the base grid -->
    <component
      :is="resolvedRecordOverride"
      v-if="resolvedRecordOverride"
      v-bind="recordProps"
    />

    <q-card v-else flat bordered class="page-card aql-premium-gradient-card">
      <q-card-section>
        <div class="aql-detail-grid" :style="gridStyle">
          <!-- Code row with optional navigation launch icon -->
          <div v-if="recordProps.showCodeLink && record?.Code" class="aql-detail-line items-center aql-detail-row" :style="rowDelay(0)">
            <span class="aql-detail-key">Code</span>
            <span class="aql-detail-val col overflow-hidden flex justify-end items-center">
              <span>{{ record.Code }}</span>
              <q-btn
                flat round dense color="primary" icon="open_in_new" size="sm" class="q-ml-sm"
                @click="openRecord"
              >
                <q-tooltip>Open {{ resourceName || 'record' }}</q-tooltip>
              </q-btn>
            </span>
          </div>

          <!-- Field rows -->
          <div
            v-for="(field, index) in visibleFields"
            :key="field.header"
            class="aql-detail-line items-center aql-detail-row"
            :style="rowDelay(index + (recordProps.showCodeLink && record?.Code ? 1 : 0))"
          >
            <span class="aql-detail-key">{{ field.label }}</span>
            <span class="aql-detail-val col overflow-hidden flex justify-end items-center">
              <!-- 1. Column-level custom UI Vue override -->
              <component
                :is="columnResolvers[field.header]?.component"
                v-if="columnResolvers[field.header]?.component"
                v-bind="getColProps(field)"
              />
              <!-- 2. Base type component from `_fields/<type>/View.vue` (falls
                   back to `_fields/text/View.vue`). `config` carries the fully
                   resolved column props, including any ViewColumn<Header>.js
                   modifier output (`displayValue`, `options`, ...). -->
              <component
                v-else
                :is="resolveFieldComponent(resolveFieldType(field), 'view')"
                :model-value="record?.[field.header]"
                :record="record"
                :config="getColProps(field)"
                :header="field.header"
              />
            </span>
          </div>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed, inject, ref, watch, useAttrs, markRaw } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { resolveFieldComponent, resolveFieldType } from 'components/_fields/useFieldResolver'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { resolveColumnOverride } from 'src/composables/resources/useViewColumnResolver'
import {
  deriveActionStampHeaders,
  filterDetailFields,
  filterParentFields,
  humanizeString,
  resolveDisplayValue,
  toPascalCase
} from 'src/utils/appHelpers'

defineOptions({ name: 'ContentsViewRecord', inheritAttrs: false })

const attrs = useAttrs()

// ─── Glob registry (Vite deduplicates identical globs) ─────────────────────────
const customUiModules = import.meta.glob('../../_ui/**/*.{vue,js}')
const customUiRegistry = {}
Object.keys(customUiModules).forEach((rawPath) => {
  const key = rawPath.replace(/^\.\.\/\.\.\//, '').toLowerCase()
  customUiRegistry[key] = customUiModules[rawPath]
})

const props = defineProps({
  record: { type: Object, required: true },
  resolvedFields: { type: Array, default: null },
  resourceName: { type: String, default: '' },
  resourceSlug: { type: String, default: '' },
  scope: { type: String, default: '' },
  uiName: { type: String, default: '' },
  detailsConfig: { type: Object, default: () => ({}) },
  showCodeLink: { type: Boolean, default: true },
  skipEmpty: { type: Boolean, default: false }
})

const nav = useResourceNav()

const resourceConfig = inject('resourceConfig', null)
const pageState = inject('pageState', null)
const resourceRecord = inject('resourceRecord', null)

// ── Record-level custom UI override (viewrecord.vue / viewrecord.js) ───────────
// A Vue override replaces the base q-card grid entirely; a JS modifier (function
// or object) merges into the props that drive the base grid.
const resolvedRecordOverride = ref(null)
const recordModifier = ref(null)

// Effective props that drive both the Vue override and the base q-card grid.
// Base = this component's own props; a JS record modifier is layered on top.
const recordProps = computed(() => {
  const base = {
    ...attrs,
    record: props.record,
    resolvedFields: props.resolvedFields,
    resourceName: props.resourceName,
    resourceSlug: props.resourceSlug,
    scope: props.scope,
    uiName: props.uiName,
    detailsConfig: props.detailsConfig,
    showCodeLink: props.showCodeLink,
    skipEmpty: props.skipEmpty
  }
  return recordModifier.value && typeof recordModifier.value === 'object'
    ? { ...base, ...recordModifier.value }
    : base
})

async function loadModule(loader) {
  try {
    const mod = await loader()
    const exported = mod.default ?? mod
    if (typeof exported === 'function' || (typeof exported === 'object' && exported !== null)) {
      return exported
    }
    return null
  } catch (err) {
    console.error('[ViewRecord] Failed to load record override module:', err)
    return null
  }
}

async function resolveRecordOverride() {
  resolvedRecordOverride.value = null
  recordModifier.value = null

  const uiKey = (props.uiName || '').toLowerCase()
  if (!uiKey) return

  const scopeKey = (props.scope || '').toLowerCase()
  // Normalized exactly like useContentResolver.js (toPascalCase then lowercase)
  // so a kebab-case slug (e.g. 'outlet-visits') matches the Vite glob registry
  // folder key ('outletvisits') instead of leaking hyphens into the path.
  const slugKey = toPascalCase(props.resourceSlug || props.resourceName || '').toLowerCase()
  const uiBase = `_ui/${uiKey}/components`

  const candidates = [
    { path: `${uiBase}/${scopeKey}/${slugKey}/viewrecord.vue`, isVue: true },
    { path: `${uiBase}/${scopeKey}/${slugKey}/viewrecord.js`, isVue: false },
    { path: `${uiBase}/${scopeKey}/viewrecord.vue`, isVue: true },
    { path: `${uiBase}/${scopeKey}/viewrecord.js`, isVue: false },
    { path: `${uiBase}/viewrecord.vue`, isVue: true },
    { path: `${uiBase}/viewrecord.js`, isVue: false }
  ]

  for (const { path, isVue } of candidates) {
    const loader = customUiRegistry[path]
    if (!loader) continue
    const exported = await loadModule(loader)
    if (!exported) continue

    if (isVue) {
      resolvedRecordOverride.value = markRaw(exported)
    } else if (typeof exported === 'function') {
      try {
        recordModifier.value = exported(props.record, { pageState, resourceConfig, resourceRecord })
      } catch (err) {
        console.error('[ViewRecord] record modifier function failed:', err)
      }
    } else if (typeof exported === 'object') {
      recordModifier.value = exported
    }
    return
  }
}

watch(
  [() => props.resourceSlug, () => props.scope, () => props.uiName, () => props.record],
  () => { resolveRecordOverride() },
  { immediate: true }
)

const actionStampHeaders = computed(() =>
  deriveActionStampHeaders(resourceConfig?.additionalActions?.value || [])
)

const activeConfig = computed(() => ({
  title: 'Details',
  fields: null,
  fieldLabels: {},
  columns: 1,
  ...(recordProps.value.detailsConfig || {})
}))

// Base fields: either the resolved field schema (filtered) or raw-key derivation.
const baseFields = computed(() => {
  if (recordProps.value.resolvedFields) {
    return filterDetailFields(recordProps.value.resolvedFields, actionStampHeaders.value)
  }
  const obj = filterParentFields(props.record, actionStampHeaders.value)
  return Object.keys(obj).map((key) => ({
    header: key,
    label: humanizeString(key),
    type: 'text'
  }))
})

const finalFields = computed(() => {
  let target = baseFields.value

  if (recordProps.value.resolvedFields && activeConfig.value.fields) {
    target = activeConfig.value.fields.map((key) => {
      const found = recordProps.value.resolvedFields.find((f) => f.header === key)
      return found || { header: key, label: humanizeString(key), type: 'text' }
    })
  }

  return target.map((f) => {
    const customLabel = activeConfig.value.fieldLabels[f.header]
    return { ...f, label: customLabel !== undefined ? customLabel : f.label }
  })
})

// When skipEmpty is on (default for related parent/child cards), drop rows whose
// value — raw or resolved display — is empty, so relation cards stay compact.
const visibleFields = computed(() =>
  recordProps.value.skipEmpty ? finalFields.value.filter((f) => !isFieldEmpty(f)) : finalFields.value
)

const gridStyle = computed(() => {
  const cols = activeConfig.value.columns || 1
  if (cols > 1) {
    return {
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
      gap: '0px 24px'
    }
  }
  return { display: 'grid', gap: '0' }
})

// ── Column-level custom UI overrides (batch-resolved in one pass) ──────────────
const columnResolvers = ref({})

watch(
  [finalFields, () => recordProps.value.resourceSlug, () => recordProps.value.scope, () => recordProps.value.uiName],
  async () => {
    const map = {}
    for (const field of finalFields.value) {
      map[field.header] = await resolveColumnOverride({
        columnName: field.header,
        resourceSlug: recordProps.value.resourceSlug,
        scope: recordProps.value.scope,
        uiName: recordProps.value.uiName
      })
    }
    columnResolvers.value = map
  },
  { immediate: true }
)

function defaultDisplayValue(field) {
  return resolveDisplayValue(props.record?.[field.header])
}

// A JS modifier's returned/exported object may carry function-valued properties
// (e.g. `{ displayValue: (record) => ... }`). Evaluate them lazily against the row.
function evaluateValue(propVal, val, record, field, context) {
  if (typeof propVal === 'function') {
    try {
      return propVal(record, val, field, context)
    } catch (err) {
      console.error('[ViewRecord] Failed to evaluate function property:', err)
      return '-'
    }
  }
  return propVal
}

function getColProps(field) {
  const base = {
    ...attrs,
    value: props.record?.[field.header],
    record: props.record,
    field,
    // Storage context needed by type components that address the backend by
    // column (e.g. `_fields/file/View.vue` -> AqlFilePreviewCard).
    resourceName: recordProps.value.resourceName,
    columnName: field.header,
    // Schema-authored option list so `_fields/select/View.vue` can resolve a
    // stored value back to its label.
    options: field.options
  }

  const entry = columnResolvers.value[field.header]
  if (!entry || !entry.modifier) {
    return { ...base, displayValue: defaultDisplayValue(field) }
  }

  const mod = entry.modifier
  let modRes = null

  if (typeof mod === 'function') {
    try {
      modRes = mod(props.record?.[field.header], props.record, field, {
        pageState,
        resourceConfig,
        resourceRecord
      })
    } catch (err) {
      console.error(`[ViewRecord] column modifier function failed for "${field.header}":`, err)
    }
  } else if (typeof mod === 'object' && mod !== null) {
    modRes = mod
  }

  if (modRes && typeof modRes === 'object') {
    const val = props.record?.[field.header]
    const context = { pageState, resourceConfig, resourceRecord }
    const evaluated = { ...modRes }
    if ('displayValue' in evaluated) {
      evaluated.displayValue = evaluateValue(evaluated.displayValue, val, props.record, field, context)
    }
    if ('value' in evaluated) {
      evaluated.value = evaluateValue(evaluated.value, val, props.record, field, context)
    }
    return {
      ...base,
      displayValue: evaluated.displayValue ?? evaluated.value ?? defaultDisplayValue(field),
      ...evaluated
    }
  } else if (modRes != null) {
    return {
      ...base,
      displayValue: String(modRes)
    }
  }

  return { ...base, displayValue: defaultDisplayValue(field) }
}

function isFieldEmpty(field) {
  const val = props.record?.[field.header]
  if (val == null) return true
  if (typeof val === 'string' && val.trim() === '') return true
  const colProps = getColProps(field)
  const display = colProps.displayValue ?? colProps.value
  if (display == null) return true
  if (typeof display === 'string' && (display.trim() === '' || display.trim() === '-')) return true
  return false
}

function rowDelay(index) {
  return { animationDelay: `${index * 40}ms` }
}

function openRecord() {
  if (!props.record?.Code) return
  nav.goTo('view', {
    scope: recordProps.value.scope,
    resourceSlug: recordProps.value.resourceSlug,
    code: props.record.Code
  })
}
</script>
