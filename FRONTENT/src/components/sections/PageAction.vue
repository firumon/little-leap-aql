<template>
  <div class="aql-page-action-container">
    <!-- CRUD Actions FAB — visibility beyond this gate is driven reactively inside
         CrudActions.vue itself (record presence + edit-mode), or explicitly suppressed
         by a CrudActions JS modifier returning show:false / hide:true. -->
    <component
      :is="resolvedCrudActions"
      v-if="showCrudActions"
      :page="props.page"
      v-bind="crudActionsProps"
    />
  </div>
</template>

<script setup>
import { computed, inject, useAttrs } from 'vue'
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'
import CrudActions from './CrudActions.vue'

defineOptions({ name: 'SectionsPageAction', inheritAttrs: false })

const props = defineProps({
  page:     { type: String, required: true },
  scope:    { type: String, default: null },
  resource: { type: String, default: null },
  uiName:   { type: String, default: null }
})

const resourceConfig = inject('resourceConfig', null)
const attrs = useAttrs()

// Explicit props win; injected resourceConfig is only a fallback.
const resolvedScope    = computed(() => props.scope    ?? resourceConfig?.scope?.value        ?? 'master')
const resolvedResource = computed(() => props.resource ?? resourceConfig?.resourceSlug?.value ?? '')
const resolvedUiName   = computed(() => props.uiName   ?? resourceConfig?.customUIName?.value ?? 'AQL')

// ── Sub-section override resolution (mirrors ListSwitcher's per-item resolver) ──
const crudActionsResolverProps = computed(() => ({
  section:  'CrudActions',
  page:     props.page,
  scope:    resolvedScope.value,
  resource: resolvedResource.value,
  uiName:   resolvedUiName.value
}))

const { resolvedComponent: resolvedCrudActions, finalProps: resolvedCrudActionsProps } = useSectionResolver(crudActionsResolverProps, CrudActions)

// A CrudActions JS modifier can suppress the whole section (e.g. a tenant that hides
// CRUD FABs entirely on a given resource) by returning `show: false` / `hide: true`,
// either as a plain boolean or a function evaluated here.
function evalVisibility(val) {
  return typeof val === 'function' ? val() : val
}

const modifierVisible = computed(() => {
  const raw = resolvedCrudActionsProps.value || {}
  if ('show' in raw && evalVisibility(raw.show) === false) return false
  if ('hide' in raw && evalVisibility(raw.hide) === true) return false
  return true
})

// The FormAction sticky bar (a later phase) owns the Action-outcome page entirely;
// every other page defers to CrudActions' own record/edit-mode visibility logic.
const showCrudActions = computed(() =>
  props.page.toLowerCase() !== 'action' && modifierVisible.value
)

// Forward everything: inherited pageProps attrs (for a full Vue override that needs
// resource/scope/record context) plus whatever a JS modifier returned, minus the
// resolver's own internal lookup keys (section/scope/resource/uiName on `raw` — these
// are resolver bookkeeping, distinct from the same-named keys that may legitimately
// arrive via `attrs`).
const crudActionsProps = computed(() => {
  const raw = resolvedCrudActionsProps.value || {}
  const { section, scope, resource, uiName, show, hide, ...modifierProps } = raw
  return { ...attrs, ...modifierProps }
})
</script>
