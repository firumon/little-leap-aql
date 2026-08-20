<template>
  <q-list
    :bordered="bordered"
    :separator="separator"
    class="relative-position"
    :class="[gutterClass, $attrs.class]"
    :style="$attrs.style"
  >
    <!-- TransitionGroup (no `tag`, so it renders no wrapper element and the q-items stay
         direct children of q-list, preserving separators/gutter). Items fade and slide into
         place on load/filter, and reorder via FLIP `-move` transitions. The loading spinner
         and empty state live inside the group as keyed children so switching between
         populated ⇄ empty ⇄ loading views cross-fades instead of unmounting abruptly.

         `appear` is unconditional rather than a prop: motion is a property of the list, not
         something a caller opts into. Without it the group skips its FIRST render, so a list
         that mounts fresh — which is what a `.vue` content override does, since it swaps the
         component identity at `contents/List.vue` instead of patching AppList in place —
         popped in with no animation at all. Vue falls the `-appear-*` classes back to the
         `-enter-*` ones, so transitions.scss needs no new rules and the existing
         prefers-reduced-motion guard already covers this. -->
    <TransitionGroup name="aql-list-item" appear>
      <!-- Loading State -->
      <q-item v-if="loading && !items.length" key="list-loading-state" class="flex flex-center q-pa-xl">
        <q-spinner color="primary" size="3em" />
      </q-item>

      <!-- Empty State — keyed wrapper so caller-provided #empty fragments (which may be
           unkeyed) still participate in the group transition -->
      <div v-else-if="!items.length" key="list-empty-state">
        <slot name="empty">
          <q-item class="empty-state-container q-py-xl text-center">
            <q-item-section>
              <q-icon :name="emptyIcon" size="48px" :color="emptyIconColor" class="q-mb-sm block q-mx-auto" />
              <q-item-label class="text-subtitle1 text-weight-bold text-grey-6">{{ emptyText }}</q-item-label>
            </q-item-section>
          </q-item>
        </slot>
      </div>

      <!-- Items List -->
      <q-item
        v-for="(item, index) in renderedItems"
        :key="resolveKey(item, index)"
        :clickable="isItemClickable"
        v-ripple="isItemClickable"
        @click="isItemClickable && emit('click', item)"
        :class="['interactive-list-card q-px-md', itemClass, { 'aql-list-highlight': isHighlighted, 'q-py-sm':dense, 'q-py-md q-px-md':!dense, 'item-bordered':itemBordered }]"
        :style="isHighlighted ? { '--aql-list-highlight-color': highlightColor(item) } : {}"
      >
        <!-- Dynamic Row Content slot -->
        <slot name="item" :item="item" :index="index">

          <!-- Left Side Icon / Avatar -->
          <q-item-section v-if="hasIcon(item) || slots.avatar" :top="align === 'top'" side>
            <slot name="avatar" :item="item">
              <q-avatar v-if="resolveProp(avatar, item)" :size="avatarSize">
                <img :src="resolveProp(avatar, item)" alt="" />
              </q-avatar>
              <q-avatar v-else-if="resolveProp(avatarLabel, item)" :size="avatarSize" :color="resolveProp(avatarColor, item)" text-color="white">
                {{ resolveProp(avatarLabel, item) }}
              </q-avatar>
              <q-avatar v-else :size="avatarSize" :icon="resolveProp(icon, item)" :text-color="iconColor(item)" :style="{ backgroundColor: iconBgColor(item) }" />
            </slot>
          </q-item-section>

          <!-- Main Content Area -->
          <q-item-section>
            <!-- We loop over the contentArray sequence. Renderable resolves each cell:
                 caller slot > component-valued prop > wrapped scalar. -->
            <Renderable
              v-for="(contentProp, contentIndex) in contentArray"
              :key="contentIndex"
              :slot-fn="slots['content' + contentIndex]"
              :value="contentProp"
              :item="item"
              :is="getComponentType(contentIndex)"
              :class="getContentClass(contentIndex)"
            />
          </q-item-section>

          <!-- Meta Section -->
          <q-item-section v-if="hasMeta(item)" side>
            <Renderable
              v-for="(metaProp, metaIndex) in metaArray"
              :key="metaIndex"
              :slot-fn="slots['meta' + metaIndex]"
              :value="metaProp"
              :item="item"
              :is="getMetaComponentType(metaIndex)"
              :color="colorMetaChip(metaIndex, item)"
              :outline="getMetaOutline(metaIndex)"
              :text-color="getMetaTextColor(metaIndex, item)"
            />
          </q-item-section>

          <!-- Action Section (Button) — `btn` carries an icon name rather than slot
               content, hence value-prop. -->
          <q-item-section v-if="hasBtn(item) || slots.btn" side>
            <Renderable
              :slot-fn="slots.btn"
              :value="btn"
              :item="item"
              :is="QBtn"
              value-prop="icon"
              flat round dense
              :color="btnColor(item)"
              @click.stop="onActionClick(item)"
            />
          </q-item-section>
        </slot>
      </q-item>
    </TransitionGroup>
    <q-pagination
      v-if="paginationLive"
      v-model="pageModel"
      :max="totalPages"
      :max-pages="7"
      boundary-numbers
      size="md"
      gutter="xs"
      padding="sm md"
      class="flex flex-center q-mt-md"
    />
  </q-list>
</template>

<script setup>
import { computed, useSlots, getCurrentInstance, ref, watch } from 'vue'
import { QBtn, colors } from 'quasar'
import Renderable, { isComponentDef } from 'components/abstract/Renderable.js'
import { MainLabel, MainCaption, MetaLabel, MetaCaption, MetaChip, MetaBadge } from 'components/abstract/ListRenderers.js'

// `inheritAttrs: false` because this is the end of the drill chain. AppList forwards
// its `$attrs` here wholesale, and page props now travel all the way down so any
// component can claim its own `Props<Identity>` block (src/utils/placeholderProps.js).
// With fallthrough on, every unconsumed key — object-valued `Props*` blocks included —
// would be written onto the root element as `propspageheader="[object Object]"`.
// `class`/`style` are re-bound explicitly below so callers keep styling this list.
defineOptions({ name: 'List', inheritAttrs: false })

const props = defineProps({
  items: { type: Array, default: () => [] },
  page: { type: Number, default: undefined },
  paginate: { type: Boolean, default: true },
  perPage: { type: Number, default: 25 },
  threshold: { type: Number, default: 35 },
  itemKey: { type: [String, Function], default: 'Code' },
  loading: { type: Boolean, default: false },
  emptyText: { type: String, default: 'No items found.' },
  // The empty state's icon and its tint. Both were hardcoded here, which made every empty
  // list in the app say the same thing in the same tone — and an empty state's MEANING is
  // not uniform: a queue that is clear is good news and a search that matched nothing is a
  // typo, and neither reads correctly under a generic grey box glyph
  // (UI_MODULE_DEVELOPER_GUIDE.md §10.4 — "empty is not always neutral"). The defaults are
  // the previously hardcoded values, so every existing caller is unchanged.
  emptyIcon: { type: String, default: 'inventory_2' },
  emptyIconColor: { type: String, default: 'grey-4' },
  bordered: { type: Boolean, default: false },
  // Vertical rhythm BETWEEN rows, as a Quasar spacing token (`none`/`xs`/`sm`/
  // `md`/`lg`/`xl`) — previously the hardcoded `q-gutter-y-xs` on the root.
  // Declared as a prop so it is fed by `pageProps.gutter`, which travels all the
  // way down through `$attrs` (see `inheritAttrs` note below): one page-level
  // setting now spaces Sections, Contents and list rows identically. `xs` is the
  // default because that is what was hardcoded, and it is also what
  // `usePageResolver` seeds `pageProps.gutter` with, so nothing shifts.
  // `false`/`'none'` turns the gutter off for a caller that owns its own spacing.
  gutter: { type: [String, Boolean], default: 'xs' },
  itemBordered: { type: Boolean, default: true },
  separator: { type: Boolean, default: false },
  dense: { type: Boolean, default: false },
  color: { type: [String, Function], default: 'primary' },
  highlight: { type: [Boolean, String], default: false },
  highlightColor: { type: [String, Function], default: null },
  clickable: { type: Boolean, default: null },
  itemClass: { type: [String, Array, Object], default: null },
  icon: { type: [String, Function], default: null },
  iconColor: { type: [String, Function], default: null },
  align: { type: String, default: 'center', validator: v => ['center', 'top'].includes(v) },
  avatar: { type: [String, Function], default: null },
  avatarLabel: { type: [String, Function], default: null },
  avatarColor: { type: [String, Function], default: 'primary' },
  avatarSize: { type: String, default: 'md' },
  layout: { type: Array, default: () => ['label', 'caption'] },
  // Array = per-item content column sequence. A String may arrive here when
  // $attrs forwards a content-resolver identity (e.g. Content.vue's `content:
  // "Create"`) down through AppList/FormChild — contentArray below already
  // ignores non-Array values and falls back to layout, so this is a pure
  // prop-validation widen, not a behavior change.
  content: { type: [Array, String], default: null },
  // Object is accepted on every prop routed through Renderable (label, caption, chip,
  // badge, metaLabel, metaCaption, btn) so a `_ui/` JS modifier can pass a component
  // definition instead of a value resolver — `metaCaption: OverduePill`. NOT widened on
  // icon/avatar/*Color, which still go through resolveProp directly and would break.
  label: { type: [String, Function, Object], default: 'Code' },
  labelClass: { type: [String, Array, Object], default: null },
  caption: { type: [String, Function, Object], default: null },
  captionClass: { type: [String, Array, Object], default: null },
  meta: { type: Array, default: null },
  metaLayout: { type: Array, default: () => ['chip', 'caption', 'label'] },
  metaColor: { type: [String, Function], default: null },
  metaLabel: { type: [String, Function, Object], default: null },
  metaCaption: { type: [String, Function, Object], default: null },
  chip: { type: [String, Function, Object], default: null },
  chipColor: { type: [String, Function], default: null },
  chipOutline: { type: Boolean, default: false },
  chipTextColor: { type: [String, Function], default: null },
  badge: { type: [String, Function, Object], default: null },
  badgeColor: { type: [String, Function], default: null },
  badgeTextColor: { type: [String, Function], default: 'white' },
  badgeOutline: { type: Boolean, default: false },
  btn: { type: [String, Function, Object], default: null },
  btnColor: { type: [String, Function], default: null },
})

const emit = defineEmits(['click', 'update:page'])
const slots = useSlots()
const instance = getCurrentInstance()
const currentPage = ref(1)

const pageModel = computed({
  get: () => props.page ?? currentPage.value,
  set: value => setPage(value)
})

// `q-gutter-y-none` is not a real Quasar class, so "no gutter" has to resolve to
// no class at all rather than to a token that silently does nothing.
const gutterClass = computed(() => {
  const token = props.gutter
  if (token === false || token === '' || token === 'none' || token == null) return null
  return `q-gutter-y-${token}`
})

const paginationLive = computed(() => props.paginate && props.items.length > props.threshold)
const pageSize = computed(() => Math.max(1, props.perPage || 25))
const totalPages = computed(() => Math.max(1, Math.ceil(props.items.length / pageSize.value)))
const renderedItems = computed(() => {
  if (!paginationLive.value) return props.items
  const start = (pageModel.value - 1) * pageSize.value
  return props.items.slice(start, start + pageSize.value)
})

watch(() => props.items, () => {
  setPage(1)
}, { deep: true })

watch([paginationLive, totalPages], () => {
  if (!paginationLive.value || pageModel.value > totalPages.value) setPage(1)
}, { immediate: true })

watch(() => props.page, value => {
  if (value !== undefined) currentPage.value = value
}, { immediate: true })

function setPage(value) {
  currentPage.value = value
  if (props.page !== undefined && props.page !== value) emit('update:page', value)
}

const hasClick = computed(() => {
  const props = instance?.vnode?.props
  return !!(props && (props.onClick || props['on-click'] || props.onClickOnce))
})

const isItemClickable = computed(() => {
  if (props.clickable !== null) {
    return props.clickable && !props.btn && !slots.btn
  }
  return hasClick.value && !props.btn && !slots.btn
})

const contentArray = computed(() => {
  if (props.content && Array.isArray(props.content)) {
    return props.content
  }
  return props.layout.map(rowType => {
    if (rowType === 'label') return props.label || false
    if (rowType === 'caption') return props.caption || false
    return false
  })
})

// A layout entry may also BE a component, in which case it wraps the resolved value in
// place of MainLabel/MainCaption — `layout: ['caption', MyRowWrapper]`. Distinct from a
// component-valued *content* entry, which replaces the cell entirely rather than wrapping it.
function getComponentType(contentIndex) {
  const rowType = props.layout[contentIndex]
  if (isComponentDef(rowType)) return rowType
  if (rowType === 'label') return MainLabel
  if (rowType === 'caption') return MainCaption
  return null
}

function resolveProp(prop, item) {
  if (prop === null || prop === undefined || prop === '') return ''
  // A component-valued prop is returned as-is. Rendering it is Renderable's job; the
  // callers left here (hasMeta/hasBtn/hasIcon) only need it to read as truthy, and the
  // `prop in item` branch below would otherwise stringify it into a bogus key lookup.
  if (isComponentDef(prop)) return prop
  if (typeof prop === 'function') return prop(item)
  return (item && typeof item === 'object' && prop in item) ? item[prop] : prop
}

function resolveKey(item, index) {
  return resolveProp(props.itemKey, item) || index || ('key-' + Math.random())
}

function hasIcon(item) {
  return !!(
    resolveProp(props.avatar, item) ||
    resolveProp(props.avatarLabel, item) ||
    resolveProp(props.icon, item)
  )
}

function getContentClass(contentIndex) {
  const rowType = props.layout[contentIndex]
  if (rowType === 'label') return props.labelClass || ''
  if (rowType === 'caption') return props.captionClass || ''
  return ''
}

function lighten(color) {
  if (!color) return ''
  try {
    let hexColor = colors.getPaletteColor(color)
    return colors.lighten(hexColor, 90)
  } catch (e) {
    return colors.getPaletteColor('grey-1')
  }
}

const iconColor = computed(() => (item) => {
  return resolveProp(props.iconColor || props.color, item) || 'primary'
})

const iconBgColor = computed(() => (item) => {
  return lighten(iconColor.value(item))
})

const isHighlighted = computed(() => {
  if (props.highlightColor && String(props.highlightColor).trim() !== "") return true
  const val = props.highlight
  if (val === undefined || val === null || val === false || String(val).toLowerCase().trim() === 'false') return false
  return val !== ''
})

const highlightColor = computed(() => (item) => {
  const col = isHighlighted.value ? resolveProp(props.highlightColor || props.color, item) : 'primary'
  try {
    return colors.getPaletteColor(col)
  } catch (e) {
    return col
  }
})


const btnColor = computed(() => (item) => {
  return resolveProp(props.btnColor || props.color, item) || 'primary'
})

function hasBtn(item) {
  return !!resolveProp(props.btn, item)
}

function onActionClick(item) {
  emit('click', item)
}

const metaArray = computed(() => {
  if (props.meta && Array.isArray(props.meta)) {
    return props.meta
  }
  return props.metaLayout.map(rowType => {
    if (rowType === 'chip') return props.chip || false
    if (rowType === 'badge') return props.badge || false
    if (rowType === 'label') return props.metaLabel || false
    if (rowType === 'caption') return props.metaCaption || false
    return false
  })
})

const metaColor = computed(() => (item) => {
  return resolveProp(props.metaColor || props.color, item) || 'grey-9'
})

const chipColor = computed(() => (item) => {
  return resolveProp(props.chipColor || props.metaColor || props.color, item) || 'primary'
})

const chipTextColor = computed(() => (item) => {
  return resolveProp(props.chipTextColor, item) || 'white'
})

const badgeColor = computed(() => (item) => {
  return resolveProp(props.badgeColor || props.metaColor || props.color, item) || 'primary'
})

const colorMetaChip = computed(() => (metaIndex, item) => {
  const rowType = props.metaLayout[metaIndex]
  if (rowType === 'chip') return chipColor.value(item)
  if (rowType === 'badge') return badgeColor.value(item)
  return metaColor.value(item)
})

function getMetaOutline(metaIndex) {
  const rowType = props.metaLayout[metaIndex]
  if (rowType === 'chip') return props.chipOutline
  if (rowType === 'badge') return props.badgeOutline
  return false
}

function getMetaTextColor(metaIndex, item) {
  const rowType = props.metaLayout[metaIndex]
  if (rowType === 'chip') return chipTextColor.value(item)
  if (rowType === 'badge') return resolveProp(props.badgeTextColor, item, 'white')
  return undefined
}

function hasMeta(item) {
  return metaArray.value.some(prop => !!resolveProp(prop, item))
}

function getMetaComponentType(metaIndex) {
  const rowType = props.metaLayout[metaIndex]
  if (isComponentDef(rowType)) return rowType
  if (rowType === 'label') return MetaLabel
  if (rowType === 'caption') return MetaCaption
  if (rowType === 'chip') return MetaChip
  if (rowType === 'badge') return MetaBadge
  return null
}
</script>
