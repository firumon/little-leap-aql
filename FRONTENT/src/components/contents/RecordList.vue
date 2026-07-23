<template>
  <component
    :is="activeViewName ? (resolvedComponent || AppList) : AppList"
    v-bind="activeViewName ? sanitizedResolvedProps : finalProps"
    @click="handleItemClick"
  />
</template>

<script setup>
import { computed, inject, useAttrs } from 'vue'
import { useRecordListStrategy } from 'src/composables/resources/useRecordListStrategy'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useContentResolver } from 'src/composables/resources/useContentResolver'
import { toPascalCase } from 'src/utils/appHelpers'
import AppList from 'components/app/AppList.vue'

defineOptions({ name: 'ContentsRecordList', inheritAttrs: false })

// Every prop below defaults to `undefined` so useRecordListStrategy stays authoritative
// unless a page contract, JS modifier, or custom UI override explicitly supplies one.
//
// Function-valued props (label, caption, chipColor, ...) are item resolvers consumed by
// abstract/List.vue — they are forwarded untouched and must NOT go through evaluateProp.
const props = defineProps({
  // Data / behaviour
  items: { type: Array, default: undefined },
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
  // String is accepted only because Content.vue binds the content identity ("RecordList")
  // under the same key; it is forwarded to the list solely when it is a real Array.
  content: { type: [Array, String], default: undefined },
  label: { type: [String, Function], default: undefined },
  labelClass: { type: [String, Array, Object], default: undefined },
  caption: { type: [String, Function], default: undefined },
  captionClass: { type: [String, Array, Object], default: undefined },

  // Meta side section
  meta: { type: Array, default: undefined },
  metaLayout: { type: Array, default: undefined },
  metaColor: { type: [String, Function], default: undefined },
  metaLabel: { type: [String, Function], default: undefined },
  metaCaption: { type: [String, Function], default: undefined },
  chip: { type: [String, Function], default: undefined },
  chipColor: { type: [String, Function], default: undefined },
  chipOutline: { type: Boolean, default: undefined },
  chipTextColor: { type: [String, Function], default: undefined },
  badge: { type: [String, Function], default: undefined },
  badgeColor: { type: [String, Function], default: undefined },
  badgeTextColor: { type: [String, Function], default: undefined },
  badgeOutline: { type: Boolean, default: undefined },

  // Row action button
  btn: { type: [String, Function], default: undefined },
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
// (SKUs, PriceListItems), or a primary-field/Code fallback — see useRecordListStrategy.
const strategy = useRecordListStrategy(resourceConfig, resourceRecord)

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
// look for a RecordList<ViewName> override (generic under components/contents/, or a
// tenant override/JS modifier under _ui/) before falling back to AppList.
//
// This is only consulted while a view IS active. `components/contents/RecordList.vue` is
// this very file's own registered content key — resolving the bare 'RecordList' identity
// through useContentResolver would match this file itself as the "base content" and mount
// it as its own child, recursing forever. Gating the render on `activeViewName` keeps the
// resolver reactive (it still runs and is available for per-view overrides) without ever
// rendering that self-referential result.
const activeViewName = computed(() => resourceRecord?.activeViewName?.value || '')

const preparedResolverProps = computed(() => ({
  ...finalProps.value,
  content: activeViewName.value ? `RecordList${toPascalCase(activeViewName.value)}` : 'RecordList',
  page: props.page || attrs.page || resourceConfig?.page?.value || 'index',
  scope: props.scope || attrs.scope || resourceConfig?.scope?.value,
  resource: props.resource || attrs.resource || resourceConfig?.resourceSlug?.value,
  uiName: props.uiName || attrs.uiName || resourceConfig?.customUIName?.value
}))

const { resolvedComponent, finalProps: resolvedContentProps } = useContentResolver(preparedResolverProps, AppList)

// useContentResolver runs an async watcher that transiently resets its finalProps to {}
// while it scans for a RecordList<ViewName> override. If we bound that raw output, the list
// would lose `items`/strategy props during every view switch and render empty until the
// async imports settle. Merging the synchronous `finalProps` baseline (which always carries
// `items` + strategy props) UNDER the resolver's output keeps the list populated continuously;
// once resolution completes, the resolver's props (incl. any per-view JS-modifier changes)
// still win on top, so override behaviour is unchanged.
//
// finalProps carries the content-identity string (e.g. "RecordListActive") used for override
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

function handleItemClick(item) {
  if (typeof props.onItemClick === 'function') return props.onItemClick(item)
  if (props.target) return nav.goTo('record-page', { code: item?.Code ?? item, pageSlug: props.target })
  nav.goTo('view', { code: item?.Code ?? item })
}
</script>
