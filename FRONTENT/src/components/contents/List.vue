<template>
  <!-- View-switch transition, keyed on component IDENTITY rather than on the active view
       name. A `.js` modifier keeps AppList mounted across view switches, so its key never
       changes, the wrapper is never recreated, and the TransitionGroup inside
       abstract/List.vue goes on animating rows individually (enter/leave + FLIP `-move`).
       Only a `.vue` override actually swaps the component — and a list being unmounted
       cannot animate its own rows — so the container fade is scoped to exactly that case.
       Keying on the view name instead would recreate the wrapper on EVERY switch and
       replace the per-row motion with a single block fade.

       `mode="out-in"` matters beyond aesthetics: useContentResolver resolves overrides
       asynchronously, so for ~2 frames after a switch the OLD component is still rendering
       the NEW view's items. Holding the new branch back until the leave finishes outlasts
       that gap, so the stale frames are never painted. The wrapper div is also always a
       single root, which keeps overrides free to declare multiple root nodes. -->
  <Transition name="aql-list-view" mode="out-in">
    <div :key="viewKey">
      <component
        :is="renderedComponent"
        v-bind="boundProps"
        :page="resourceRecord?.currentPage?.value"
        @click="handleItemClick"
        @update:page="handlePageUpdate"
      />
    </div>
  </Transition>
</template>

<script setup>
import { computed, inject, shallowRef, useAttrs, watchEffect } from 'vue'
import { useListStrategy } from 'src/composables/resources/useListStrategy'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useContentResolver } from 'src/composables/resources/useContentResolver'
import { toPascalCase } from 'src/utils/appHelpers'
import AppList from 'components/app/AppList.vue'

defineOptions({ name: 'ContentsList', inheritAttrs: false })

// Every prop below defaults to `undefined` so useListStrategy stays authoritative
// unless a page contract, JS modifier, or custom UI override explicitly supplies one.
//
// Function-valued props (label, caption, chipColor, ...) are item resolvers consumed by
// abstract/List.vue — they are forwarded untouched and must NOT go through evaluateProp.
const props = defineProps({
  // Data / behaviour
  items: { type: Array, default: undefined },
  paginate: { type: Boolean, default: undefined },
  perPage: { type: Number, default: undefined },
  threshold: { type: Number, default: undefined },
  onItemClick: { type: Function, default: undefined },
  // Navigates to a resource sub-route on click (`record-page`, code + pageSlug) instead of
  // the default `view` page — e.g. `target="stock-list"` → /{scope}/{resource}/{code}/stock-list.
  target: { type: String, default: undefined },

  // List container
  itemKey: { type: [String, Function], default: undefined },
  emptyText: { type: String, default: undefined },
  bordered: { type: Boolean, default: undefined },
  itemBordered: { type: Boolean, default: undefined },
  separator: { type: Boolean, default: undefined },
  dense: { type: Boolean, default: undefined },
  color: { type: [String, Function], default: undefined },
  highlight: { type: [Boolean, String], default: undefined },
  highlightColor: { type: [String, Function], default: undefined },
  clickable: { type: Boolean, default: undefined },
  itemClass: { type: [String, Array, Object], default: undefined },
  align: { type: String, default: undefined },

  // Leading icon / avatar
  icon: { type: [String, Function], default: undefined },
  iconColor: { type: [String, Function], default: undefined },
  avatar: { type: [String, Function], default: undefined },
  avatarLabel: { type: [String, Function], default: undefined },
  avatarColor: { type: [String, Function], default: undefined },
  avatarSize: { type: String, default: undefined },

  // Main content
  layout: { type: Array, default: undefined },
  // String is accepted only because Content.vue binds the content identity ("List")
  // under the same key; it is forwarded to the list solely when it is a real Array.
  content: { type: [Array, String], default: undefined },
  // Object widens these to accept a component definition — see the matching note in
  // abstract/List.vue. Mirrored here because a JS modifier's props land on THIS
  // component first and would fail validation before ever reaching the list.
  label: { type: [String, Function, Object], default: undefined },
  labelClass: { type: [String, Array, Object], default: undefined },
  caption: { type: [String, Function, Object], default: undefined },
  captionClass: { type: [String, Array, Object], default: undefined },

  // Meta side section
  meta: { type: Array, default: undefined },
  metaLayout: { type: Array, default: undefined },
  metaColor: { type: [String, Function], default: undefined },
  metaLabel: { type: [String, Function, Object], default: undefined },
  metaCaption: { type: [String, Function, Object], default: undefined },
  chip: { type: [String, Function, Object], default: undefined },
  chipColor: { type: [String, Function], default: undefined },
  chipOutline: { type: Boolean, default: undefined },
  chipTextColor: { type: [String, Function], default: undefined },
  badge: { type: [String, Function, Object], default: undefined },
  badgeColor: { type: [String, Function], default: undefined },
  badgeTextColor: { type: [String, Function], default: undefined },
  badgeOutline: { type: Boolean, default: undefined },

  // Row action button
  btn: { type: [String, Function, Object], default: undefined },
  btnColor: { type: [String, Function], default: undefined },

  // Content-resolver identity — explicit values here (or forwarded via attrs) take
  // priority over the ambient resourceConfig context.
  page: { type: String, default: undefined },
  scope: { type: String, default: undefined },
  resource: { type: String, default: undefined },
  uiName: { type: String, default: undefined }
})

const attrs = useAttrs()
const nav = useResourceNav()

// Page-level record state provided by Page.vue — never fetched here.
const resourceRecord = inject('resourceRecord', null)
const resourceConfig = inject('resourceConfig', null)

// Filtered view of the records (search term + active list view); plain records when
// the composable exposes no filtered projection.
const records = computed(() =>
  resourceRecord?.filteredRecords?.value ?? resourceRecord?.records?.value ?? []
)

const loading = computed(() => resourceRecord?.loading?.value ?? false)

// Resource-aware label/caption/meta resolvers: own Name column, borrowed parent name
// (SKUs, PriceListItems), or a primary-field/Code fallback — see useListStrategy.
const strategy = useListStrategy(resourceConfig, resourceRecord)

const strategyProps = computed(() => ({
  layout: strategy.layout.value,
  label: strategy.label.value,
  caption: strategy.caption.value,
  metaLayout: strategy.metaLayout.value,
  chip: strategy.chip.value,
  chipColor: strategy.chipColor.value,
  chipOutline: strategy.chipOutline.value,
  metaLabel: strategy.metaLabel.value,
  metaCaption: strategy.metaCaption.value,
  highlight: strategy.highlight.value,
  highlightColor: strategy.highlightColor.value,
  clickable: strategy.clickable.value
}))

// Keys handled locally rather than forwarded to the list renderer.
const LOCAL_KEYS = ['items', 'onItemClick', 'target', 'page', 'scope', 'resource', 'uiName']

const explicitProps = computed(() => {
  const out = {}
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || LOCAL_KEYS.includes(key)) continue
    // Guard the `content`/content-identity collision described above.
    if (key === 'content' && !Array.isArray(value)) continue
    out[key] = value
  }
  return out
})

const finalProps = computed(() => ({
  ...strategyProps.value,
  ...explicitProps.value,
  items: props.items ?? records.value,
  loading: loading.value
}))

// Active-view-aware override resolution: when a list view is selected (e.g. "Approved"),
// look for a List<ViewName> override (generic under components/contents/, or a
// tenant override/JS modifier under _ui/) before falling back to AppList.
//
// This is only consulted while a view IS active. `components/contents/List.vue` is
// this very file's own registered content key — resolving the bare 'List' identity
// through useContentResolver would match this file itself as the "base content" and mount
// it as its own child, recursing forever. Gating the render on `activeViewName` keeps the
// resolver reactive (it still runs and is available for per-view overrides) without ever
// rendering that self-referential result.
const activeViewName = computed(() => resourceRecord?.activeViewName?.value || '')

const preparedResolverProps = computed(() => ({
  ...finalProps.value,
  content: activeViewName.value ? `List${toPascalCase(activeViewName.value)}` : 'List',
  page: props.page || attrs.page || resourceConfig?.page?.value || 'index',
  scope: props.scope || attrs.scope || resourceConfig?.scope?.value,
  resource: props.resource || attrs.resource || resourceConfig?.resourceSlug?.value,
  uiName: props.uiName || attrs.uiName || resourceConfig?.customUIName?.value
}))

const { settled, resolvedComponent, finalProps: resolvedContentProps } = useContentResolver(preparedResolverProps, AppList)

// The component actually mounted, derived once so the template and the transition key
// can never disagree about what is on screen.
const renderedComponent = computed(() =>
  activeViewName.value ? (resolvedComponent.value || AppList) : AppList
)

// Stable per-component id backing the wrapper key. Identity is tracked in a WeakMap
// rather than read off `__name`, so two overrides that happen to share a component name
// still get distinct keys (and an unnamed one never collapses into a shared bucket).
const componentKeys = new WeakMap()
let nextComponentKey = 0

const viewKey = computed(() => {
  const component = renderedComponent.value
  if (!component) return '__none'
  if (!componentKeys.has(component)) componentKeys.set(component, ++nextComponentKey)
  return componentKeys.get(component)
})

// useContentResolver runs an async watcher that transiently resets its finalProps to {}
// while it scans for a List<ViewName> override. If we bound that raw output, the list
// would lose `items`/strategy props during every view switch and render empty until the
// async imports settle. Merging the synchronous `finalProps` baseline (which always carries
// `items` + strategy props) UNDER the resolver's output keeps the list populated continuously;
// once resolution completes, the resolver's props (incl. any per-view JS-modifier changes)
// still win on top, so override behaviour is unchanged.
//
// finalProps carries the content-identity string (e.g. "ListActive") used for override
// lookup; AppList/abstract/List.vue expect `content` as an Array, so strip it here unless a
// real Array was resolved.
const sanitizedResolvedProps = computed(() => {
  const merged = { ...finalProps.value, ...(resolvedContentProps.value || {}) }
  if (typeof merged.content === 'string') {
    const { content, ...rest } = merged
    return rest
  }
  return merged
})

// Props actually bound to the mounted component, held steady while the resolver scans.
//
// `sanitizedResolvedProps` updates SYNCHRONOUSLY on a view switch (its `items` baseline
// comes straight from resourceRecord), but `resolvedComponent` only updates when the async
// override lookup commits ~2 frames later. Binding the live props meant the OUTGOING
// component rendered the INCOMING view's records in that window — visible when moving to a
// `.vue` override as a foreign list animating in row by row, then being replaced wholesale
// a moment later. Holding the last committed props until `settled` makes the switch atomic:
// component and data change on the same tick, so exactly one animation runs.
const displayProps = shallowRef(null)

watchEffect(() => {
  // Reads `settled` first and bails before touching the props, so nothing re-triggers this
  // mid-scan; once settled it tracks the props normally and live data updates flow through.
  if (!settled.value) return
  displayProps.value = activeViewName.value ? sanitizedResolvedProps.value : finalProps.value
})

// Before the first commit there is nothing held yet — fall through to the live props so the
// initial render is never blank.
const boundProps = computed(() =>
  displayProps.value ?? (activeViewName.value ? sanitizedResolvedProps.value : finalProps.value)
)

function handleItemClick(item) {
  if (typeof props.onItemClick === 'function') return props.onItemClick(item)
  if (props.target) return nav.goTo('record-page', { code: item?.Code ?? item, pageSlug: props.target })
  nav.goTo('view', { code: item?.Code ?? item })
}

function handlePageUpdate(page) {
  if (resourceRecord?.currentPage) resourceRecord.currentPage.value = page
}
</script>
