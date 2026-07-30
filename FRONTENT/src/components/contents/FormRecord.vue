<template>
  <div>
    <SectionDividerLabel v-if="title" :label="title" />

    <!-- Whole-form Vue SFC override (formrecord.vue) replaces the base grid entirely -->
    <component
      :is="resolvedFormOverride"
      v-if="resolvedFormOverride"
      v-bind="{ ...attrs, ...overrideProps }"
    />

    <component :is="wrapperComponent" v-else v-bind="wrapperProps">
      <component :is="sectionComponent">
        <div v-if="visibleFields.length" :class="gridClass">
          <div
            v-for="(field, index) in visibleFields"
            :key="field.header"
            :class="[fieldColClass, fieldClass]"
            :style="fieldDelay(index)"
          >
            <!-- 1. Field-level custom UI override (FormField<Header>.vue) -->
            <component
              :is="fieldResolvers[field.header]?.component"
              v-if="fieldResolvers[field.header]?.component"
              :model-value="record[field.header]"
              :field="field"
              :record="record"
              v-bind="fieldRenderProps(field)"
              @update:model-value="onFieldUpdate(field, $event)"
            />
            <!-- 2. Base control (schema-resolved, or a bare QInput for custom headers);
                 a resolved formfield<header>.js modifier merges into its props. -->
            <component
              v-else
              :is="fieldComponent(field)"
              :model-value="record[field.header]"
              v-bind="fieldRenderProps(field)"
              @update:model-value="onFieldUpdate(field, $event)"
            />
          </div>
        </div>
        <div v-else :class="emptyClass">
          {{ emptyText }}
        </div>
      </component>
    </component>
  </div>
</template>

<script setup>
import { computed, inject, ref, watch, markRaw, useAttrs } from 'vue'
import { QCard, QCardSection, QInput, QSelect, QToggle } from 'quasar'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useFormFields } from 'src/composables/resources/useFormFields'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { humanizeString, toPascalCase } from 'src/utils/appHelpers'

/**
 * Atomic bottom-layer form renderer (form counterpart of ViewRecord.vue), shared
 * unchanged by Create and the upcoming Update. Renders one input control per
 * resolved field of `resource`, reading values from `record` and emitting
 * `update:field(header, value, { custom })` — the caller (Create/FormChild,
 * later Update) decides where the value lands in pageState: canonical schema
 * headers go to `setField`, non-schema `custom` headers go to `setControlField`
 * (never `node.record` — see usePageState.js).
 *
 * ZERO-HARDCODING CONTRACT: every default behaviour, class, and label below is
 * exposed as a prop. Unhandled attributes flow through `$attrs` to the resolved
 * override / every field control.
 */
defineOptions({ name: 'ContentsFormRecord', inheritAttrs: false })

const props = defineProps({
  resource: { type: String, required: true },
  record: { type: Object, required: true },
  title: { type: String, default: '' },
  hideFields: { type: Array, default: () => [] },
  // HIGHEST-PRECEDENCE visibility switch — any header listed here is forced
  // visible even if hideFields, workflowFields, the Status default, or the
  // Code default hid it.
  showFields: { type: Array, default: () => [] },
  // Code is server-generated so it is hidden by default; true → rendered as a
  // normal editable control (see useFormFields — Code carries no `disable`).
  showCode: { type: Boolean, default: false },
  columns: { type: Number, default: 1 },
  // Explicit field ordering. Headers not found in the resource's resolved schema
  // are treated as custom/non-schema fields (see 3.4 of the Create init prompt).
  fields: { type: Array, default: null },
  // Workflow action-stamp columns (headers ending By/At/Comment) are hidden by
  // default. 'hide'/false → hide (default); 'show'/true → render them like any other field.
  workflowFields: { type: [String, Boolean], default: 'hide' },
  // Status visibility. false/'hide' (default) → hidden + seeded via defaultValues;
  // true/'show' → rendered as a normal editable control.
  showStatus: { type: [Boolean, String], default: false },
  // Value seeded for Status while it is hidden (ignored when showStatus is on and
  // an explicit defaultValues.Status is absent). Set null to skip seeding entirely.
  statusDefault: { type: String, default: 'Active' },
  // Seeded into `record` (via emitted update:field) for any header not already set.
  // May be an Object, or a function (record, ctx) => Object. Individual values may
  // themselves be functions (record, ctx) => value. ctx = { pageState, resourceConfig, resourceRecord }.
  defaultValues: { type: [Object, Function], default: () => ({}) },
  // Per-field control prop overrides, keyed by header. May be an Object, a
  // (record, ctx) => Object function, or an object whose per-header values are
  // (record, ctx) => Object functions. Merged OVER the useFormFields base props
  // and UNDER a resolved FormField<Header>.js modifier.
  fieldProps: { type: [Object, Function], default: () => ({}) },
  // Content-resolver identity for the per-resource `formrecord.(vue|js)` override
  // and the per-field `formfield<header>.(vue|js)` overrides below.
  scope: { type: String, default: '' },
  resourceSlug: { type: String, default: '' },
  uiName: { type: String, default: '' },
  // When false, the surrounding premium card is dropped so the fields can sit
  // inside a host container (popup dialog body, multi-mode row card, ...).
  card: { type: Boolean, default: true },
  // Card / layout styling — all overrideable.
  cardClass: { type: [String, Array, Object], default: 'aql-premium-gradient-form' },
  cardFlat: { type: Boolean, default: true },
  cardBordered: { type: Boolean, default: true },
  gridClass: { type: [String, Array, Object], default: 'row q-col-gutter-x-md' },
  fieldClass: { type: [String, Array, Object], default: 'fc-field q-py-xs' },
  // Column span classes for the 1-column and multi-column layouts.
  colClass: { type: String, default: 'col-12' },
  colClassMulti: { type: String, default: 'col-12 col-sm-6' },
  // Empty state.
  emptyText: { type: String, default: 'No fields configured for this resource.' },
  emptyClass: { type: [String, Array, Object], default: 'text-grey-6 text-center q-pa-md' },
  // Per-field entrance stagger (ms). 0 disables the offset.
  fieldStagger: { type: Number, default: 40 }
})

const emit = defineEmits(['update:field'])

const attrs = useAttrs()

const pageState = inject('pageState', null)
const resourceConfig = inject('resourceConfig', null)
const resourceRecord = inject('resourceRecord', null)

const { formFields } = useFormFields(() => props.resource)

// APP.Resources.DefaultValues — backend-authored seed values, resolved via
// useResourceConfig(resource) so this works identically whether FormRecord
// is rendering the primary resource or a child resource (both pass their
// own `resource` name as this same prop).
const { defaultValues: backendDefaultValues } = useResourceConfig(props.resource)

// Evaluation context handed to every function-valued prop (defaultValues, modifiers).
function modifierContext () {
  return { pageState, resourceConfig, resourceRecord }
}

// Normalizes a resource slug for glob-registry folder lookups exactly like
// useContentResolver.js does (toPascalCase then lowercase), so a kebab-case
// slug (e.g. 'outlet-visits') resolves to the same folder key Vite's glob
// registry uses ('outletvisits') instead of leaking hyphens into the path.
function normalizeSlug (slug) {
  return toPascalCase(slug || '').toLowerCase()
}

// ─── Glob registry (custom UI only) ─────────────────────────────────────────
// Per-field / whole-form overrides are ONLY resolved under _ui/*. There is NO
// framework `components/shared/FormField<Header>` fallback — when no _ui override
// exists, the standard useFormFields control is used directly.
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
    console.error('[FormRecord] Failed to load module:', err)
    return null
  }
}

// ── Whole-form override: _ui/{ui}/components/{scope}/{resourceSlug}/formrecord.(vue|js) ──
const resolvedFormOverride = ref(null)
const formModifier = ref(null)

async function resolveFormOverride () {
  resolvedFormOverride.value = null
  formModifier.value = null

  const uiKey = (props.uiName || '').toLowerCase()
  const scopeKey = (props.scope || '').toLowerCase()
  const slugKey = normalizeSlug(props.resourceSlug || props.resource)
  if (!uiKey || !scopeKey || !slugKey) return

  const uiBase = `_ui/${uiKey}/components`
  const candidates = [
    { path: `${uiBase}/${scopeKey}/${slugKey}/formrecord.vue`, isVue: true },
    { path: `${uiBase}/${scopeKey}/${slugKey}/formrecord.js`, isVue: false }
  ]

  for (const { path, isVue } of candidates) {
    const loader = customUiRegistry[path]
    if (!loader) continue
    const exported = await loadModule(loader)
    if (!exported) continue

    if (isVue) {
      resolvedFormOverride.value = markRaw(exported)
    } else if (typeof exported === 'function') {
      try {
        formModifier.value = exported(overrideProps.value, modifierContext())
      } catch (err) {
        console.error('[FormRecord] form modifier function failed:', err)
      }
    } else {
      formModifier.value = exported
    }
    return
  }
}

const baseOverrideProps = computed(() => ({ ...props }))

// A JS modifier's props win only when a Vue override did NOT match (a JS modifier
// keeps this file's own base grid, just adjusts the props feeding it).
const overrideProps = computed(() =>
  formModifier.value && typeof formModifier.value === 'object'
    ? { ...baseOverrideProps.value, ...formModifier.value }
    : baseOverrideProps.value
)

watch(
  [() => props.resourceSlug, () => props.scope, () => props.uiName],
  () => { resolveFormOverride() },
  { immediate: true }
)

// ── Field ordering + custom (non-schema) header detection ──────────────────
function customFieldEntry (header) {
  return { header, componentName: 'q-input', label: humanizeString(header), custom: true }
}

const orderedFields = computed(() => {
  if (Array.isArray(props.fields) && props.fields.length) {
    return props.fields.map((header) => {
      const found = formFields.value.find((f) => f.header === header)
      return found ? { ...found, custom: false } : customFieldEntry(header)
    })
  }
  return formFields.value.map((f) => ({ ...f, custom: false }))
})

// Workflow action-stamp headers: <Header><Outcome><By|At|Comment>
// (e.g. ProgressApprovedBy, StatusRejectedComment). Audit By/At columns are
// already stripped upstream by useFormFields' ignoredFields.
//
// Truth table: 'hide' or false -> hide all workflow stamp fields (default);
// 'show' or true -> show all workflow stamp fields.
const WORKFLOW_STAMP_RE = /(.+?)(By|At|Comment)$/
const hideWorkflow = computed(
  () => props.workflowFields === 'hide' || props.workflowFields === false
)

const statusVisible = computed(
  () => props.showStatus === true || props.showStatus === 'show'
)

const codeVisible = computed(() => props.showCode === true)

// Does the resource actually carry a Status column? (Only then do we hide/seed it.)
const hasStatus = computed(() => formFields.value.some((f) => f.header === 'Status'))

// ── Visibility precedence: showFields > hideFields > workflowFields ──────────
// Built as an explicit hidden-set so the chain is unambiguous:
//   1. workflowFields ('hide'/false, default) seeds the set with action-stamp
//      headers; ('show'/true) skips this step.
//   2. Status joins the set unless showStatus opts it back in.
//   3. Code joins the set unless showCode opts it back in.
//   4. hideFields adds its headers (applies even when workflowFields is 'show').
//   5. showFields REMOVES its headers from the set — highest precedence, so a
//      header listed there renders even if steps 1–4 all hid it.
const hiddenHeaders = computed(() => {
  const hidden = new Set()

  if (hideWorkflow.value) {
    for (const f of orderedFields.value) {
      if (WORKFLOW_STAMP_RE.test(f.header)) hidden.add(f.header)
    }
  }

  if (!statusVisible.value) hidden.add('Status')

  if (!codeVisible.value) hidden.add('Code')

  for (const header of props.hideFields) hidden.add(header)

  for (const header of props.showFields) hidden.delete(header)

  return hidden
})

const visibleFields = computed(() =>
  orderedFields.value.filter((f) => !hiddenHeaders.value.has(f.header))
)

// Effective Status visibility after the full chain — `showFields: ['Status']`
// renders it just like `showStatus`, and either way it is then NOT auto-seeded.
const statusRendered = computed(() => !hiddenHeaders.value.has('Status'))

const wrapperComponent = computed(() => (props.card ? QCard : 'div'))
const wrapperProps = computed(() =>
  props.card
    ? { ...attrs, flat: props.cardFlat, bordered: props.cardBordered, class: props.cardClass }
    : { ...attrs }
)
const sectionComponent = computed(() => (props.card ? QCardSection : 'div'))

const fieldColClass = computed(() =>
  props.columns > 1 ? props.colClassMulti : props.colClass
)

// mapField provides `component` for shared controls (AqlFileUpload, app/Date,
// AqlStatusToggle); Quasar-native controls arrive as componentName strings.
const QUASAR_CONTROLS = {
  'q-input': QInput,
  'q-select': QSelect,
  'q-toggle': QToggle
}

function fieldComponent (field) {
  return field.component || QUASAR_CONTROLS[field.componentName] || QInput
}

// Resolves the `fieldProps` prop into a plain { header: propsObject } map,
// evaluating a function-valued prop and any per-header function values.
const resolvedFieldProps = computed(() => {
  const raw = props.fieldProps
  const ctx = modifierContext()
  let resolved = raw

  if (typeof raw === 'function') {
    try {
      resolved = raw(props.record, ctx)
    } catch (err) {
      console.error('[FormRecord] fieldProps function failed:', err)
      resolved = {}
    }
  }
  if (!resolved || typeof resolved !== 'object') return {}

  const out = {}
  for (const [header, value] of Object.entries(resolved)) {
    if (typeof value === 'function') {
      try {
        const evaluated = value(props.record, ctx)
        if (evaluated && typeof evaluated === 'object') out[header] = evaluated
      } catch (err) {
        console.error(`[FormRecord] fieldProps["${header}"] function failed:`, err)
      }
    } else if (value && typeof value === 'object') {
      out[header] = value
    }
  }
  return out
})

// Merge order (lowest → highest):
//   1. $attrs
//   2. base field props from useFormFields (label, type, options, ...)
//   3. fieldProps[header] (prop-level per-field overrides)
//   4. FormField<Header>.js modifier output (custom UI, highest priority)
function fieldRenderProps (field) {
  const { header, component, componentName, custom, ...rest } = field
  let merged = { ...attrs, ...rest }

  const overrides = resolvedFieldProps.value[header]
  if (overrides) merged = { ...merged, ...overrides }

  const modifier = fieldResolvers.value[header]?.modifier
  if (!modifier) return merged

  let modRes = null
  if (typeof modifier === 'function') {
    try {
      modRes = modifier(props.record[header], props.record, field, modifierContext())
    } catch (err) {
      console.error(`[FormRecord] field modifier function failed for "${header}":`, err)
    }
  } else if (typeof modifier === 'object') {
    modRes = modifier
  }
  return modRes && typeof modRes === 'object' ? { ...merged, ...modRes } : merged
}

function onFieldUpdate (field, value) {
  emit('update:field', field.header, value, { custom: !!field.custom })
}

function fieldDelay (index) {
  return { animationDelay: `${index * props.fieldStagger}ms` }
}

// ── Per-field custom UI override: formfield<header>.(vue|js) — _ui ONLY ──────
// Strict rule: only _ui/{ui}/components/{scope}/{resourceSlug}/formfield{header}.(vue|js)
// resolves. No components/shared fallback — absent an override, the standard
// useFormFields control is used directly.
const fieldResolvers = ref({})

async function resolveFieldOverride (header) {
  const uiKey = (props.uiName || '').toLowerCase()
  const scopeKey = (props.scope || '').toLowerCase()
  const slugKey = normalizeSlug(props.resourceSlug || props.resource)
  if (!uiKey || !scopeKey || !slugKey) return null

  const headerKey = header.toLowerCase()
  const uiBase = `_ui/${uiKey}/components`

  const candidates = [
    { path: `${uiBase}/${scopeKey}/${slugKey}/formfield${headerKey}.vue`, isVue: true },
    { path: `${uiBase}/${scopeKey}/${slugKey}/formfield${headerKey}.js`, isVue: false }
  ]
  for (const { path, isVue } of candidates) {
    const loader = customUiRegistry[path]
    if (!loader) continue
    const exported = await loadModule(loader)
    if (!exported) continue
    if (isVue) return { component: markRaw(exported), modifier: null }
    return { component: null, modifier: exported }
  }
  return null
}

watch(
  [visibleFields, () => props.scope, () => props.resourceSlug, () => props.uiName],
  async () => {
    const map = {}
    for (const field of visibleFields.value) {
      const resolved = await resolveFieldOverride(field.header)
      if (resolved) map[field.header] = resolved
    }
    fieldResolvers.value = map
  },
  { immediate: true }
)

// ── Default value seeding (supports functions at both levels) ────────────────
// FormRecord stays purely presentational — it never writes to pageState itself.
// Any header present in the effective defaults but not yet set on `record` is
// emitted as a normal field update so the caller's existing setField/
// setControlField routing seeds it exactly like a user edit would.
//
//   defaultValues: { Status: 'Draft' }                       // plain object
//   defaultValues: (record, ctx) => ({ Status: 'Draft' })    // function prop
//   defaultValues: { Qty: (record, ctx) => record.Base * 2 } // function value
//
// Precedence (lowest → highest): APP.Resources.DefaultValues (backend schema
// metadata) < props `defaultValues` (Object/Function) < the hardcoded `Status`
// fallback (`statusDefault`, only applied when the key is still unset after
// both prior layers).
function resolveDefaultValues () {
  const raw = props.defaultValues
  const ctx = modifierContext()
  let resolved = raw

  if (typeof raw === 'function') {
    try {
      resolved = raw(props.record, ctx)
    } catch (err) {
      console.error('[FormRecord] defaultValues function failed:', err)
      resolved = {}
    }
  }
  if (!resolved || typeof resolved !== 'object') resolved = {}

  const out = { ...backendDefaultValues.value }
  for (const [header, value] of Object.entries(resolved)) {
    if (typeof value === 'function') {
      try {
        out[header] = value(props.record, ctx)
      } catch (err) {
        console.error(`[FormRecord] defaultValues["${header}"] function failed:`, err)
        continue
      }
    } else {
      out[header] = value
    }
  }

  if (
    hasStatus.value &&
    !statusRendered.value &&
    out.Status === undefined &&
    props.statusDefault !== null
  ) {
    out.Status = props.statusDefault
  }
  return out
}

function seedDefaults () {
  for (const [header, value] of Object.entries(resolveDefaultValues())) {
    if (props.record[header] !== undefined) continue
    const field = orderedFields.value.find((f) => f.header === header)
    emit('update:field', header, value, { custom: !!field?.custom })
  }
}

watch(
  // `() => props.record` tracks the record OBJECT's identity, not its contents —
  // a pageState reset (e.g. PageAction.vue's onReset) swaps in a brand-new blank
  // record object for the same resource, and this re-seeds defaults into it
  // exactly like the initial mount did. A same-reference in-place field edit
  // does not change identity, so this never re-runs on every keystroke.
  [() => props.resource, hasStatus, () => props.defaultValues, statusRendered, backendDefaultValues, () => props.record],
  seedDefaults,
  { immediate: true }
)
</script>

<style scoped>
@keyframes fc-rise-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.fc-field {
  animation: fc-rise-in 200ms ease-out both;
}
@media (prefers-reduced-motion: reduce) {
  .fc-field { animation: none; }
}
</style>
