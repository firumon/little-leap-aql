<template>
  <!-- Default: premium pill/segment switcher -->
  <div
    v-if="finalAttrs.items && finalAttrs.items.length"
    class="aql-list-switcher"
    :class="finalAttrs.containerClass || ''"
    :style="finalAttrs.containerStyle || ''"
  >
    <!-- Visible Items -->
    <template v-for="item in visibleItems" :key="item.name">
      <component
        :is="resolvedItemComponent || ListSwitcherItem"
        v-bind="buildItemProps(item)"
        @click="handleItemClick(item.name)"
      />
    </template>

    <!-- Overflow Dropdown Button -->
    <template v-if="overflowItems.length > 0">
      <button
        class="aql-list-switcher-item aql-list-switcher-item--more"
        :class="moreButtonClasses"
        :style="moreButtonStyle"
      >
        <q-icon
          :name="moreButtonIcon"
          class="aql-list-switcher-item__icon"
          :style="finalAttrs.iconSize ? { fontSize: finalAttrs.iconSize } : {}"
        />
        <span class="aql-list-switcher-item__label">
          {{ moreButtonLabel }}
        </span>
        <q-icon name="arrow_drop_down" class="q-ml-xs" size="16px" />

        <!-- Active glow indicator if active item is inside the dropdown -->
        <span
          v-if="isOverflowActive"
          class="aql-list-switcher-item__dot"
          :style="activeDotStyle(activeOverflowItem)"
        />

        <!-- Native Quasar dropdown menu -->
        <q-menu auto-close transition-show="jump-down" transition-hide="jump-up">
          <q-list style="min-width: 140px; padding: 4px 0;">
            <q-item
              v-for="item in overflowItems"
              :key="item.name"
              clickable
              :active="finalAttrs.activeItem === item.name"
              active-class="text-weight-bold"
              :class="menuItemClasses(item)"
              @click="handleItemClick(item.name)"
            >
              <q-item-section avatar v-if="resolvedIcon(item)" style="min-width: auto; padding-right: 8px;">
                <q-icon :name="resolvedIcon(item)" size="18px" />
              </q-item-section>
              <q-item-section>{{ resolvedLabel(item) }}</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </button>
    </template>
  </div>
</template>

<script setup>
import { computed, inject, useAttrs } from 'vue'
import { evaluateProp, useSectionResolver } from 'src/composables/resources/useSectionResolver'
import { useQuasar } from 'quasar'
import ListSwitcherItem from 'components/sections/ListSwitcherItem.vue'

defineOptions({ name: 'SectionsListSwitcher', inheritAttrs: false })

const props = defineProps({
  page:            { type: String,             default: 'Index' },
  items:           { type: Array,              default: null }, // Default to null to check for explicit override
  activeItem:      { type: String,             default: null }, // Default to null to check for explicit override
  label:           { type: [String, Function],   default: null },
  icon:            { type: [String, Function],   default: null },
  iconSize:        { type: String,             default: '' },
  containerClass:  { type: [String, Function],   default: '' },
  containerStyle:  { type: [Object, String, Function], default: '' },
  itemClass:       { type: [String, Function],   default: '' },
  maxVisibleItems: { type: Number,             default: null }, // Maximum items to show directly before putting into "More" dropdown
})

const emit = defineEmits(['update:activeItem'])

const attrs = useAttrs()
const $q = useQuasar()

// ── Contexts ──
const resourceConfig = inject('resourceConfig', null)
const resourceRecord = inject('resourceRecord', null)

// ── Prop evaluation similar to PageHeader and FilterInput ──
const finalAttrs = computed(() => {
  let resolvedItems = evaluateProp(props.items, resourceRecord, resourceConfig)
  if (resolvedItems === null || resolvedItems === undefined) {
    resolvedItems = resourceRecord?.effectiveViews?.value ?? []
  }

  let resolvedActive = evaluateProp(props.activeItem, resourceRecord, resourceConfig)
  if (resolvedActive === null || resolvedActive === undefined || resolvedActive === '') {
    resolvedActive = resourceRecord?.activeViewName?.value ?? ''
  }

  let limit = evaluateProp(props.maxVisibleItems, resourceRecord, resourceConfig)
  // If no limit is explicitly set, default to 5 on desktop to activate the dropdown overflow,
  // but keep it null (unlimited) on mobile so it can scroll horizontally.
  if (limit === null && $q.screen.gt.sm) {
    limit = 5
  }

  return {
    ...attrs,
    items:          resolvedItems,
    activeItem:     resolvedActive,
    label:          props.label,
    icon:           props.icon,
    iconSize:       evaluateProp(props.iconSize, resourceRecord, resourceConfig)       ?? '',
    containerClass: props.containerClass,
    containerStyle: props.containerStyle,
    itemClass:      props.itemClass,
    maxVisibleItems: limit
  }
})

// ── Visible vs Overflow Items ──
const visibleItems = computed(() => {
  const all = finalAttrs.value.items || []
  const limit = finalAttrs.value.maxVisibleItems
  if (!limit || all.length <= limit) return all
  // Render limit - 1 items, last slot goes to "More" dropdown
  return all.slice(0, limit - 1)
})

const overflowItems = computed(() => {
  const all = finalAttrs.value.items || []
  const limit = finalAttrs.value.maxVisibleItems
  if (!limit || all.length <= limit) return []
  return all.slice(limit - 1)
})

// ── Overflow helper states ──
const activeOverflowItem = computed(() => {
  const activeName = finalAttrs.value.activeItem
  return overflowItems.value.find(item => item.name === activeName) || null
})

const isOverflowActive = computed(() => {
  return activeOverflowItem.value !== null
})

const moreButtonLabel = computed(() => {
  if (isOverflowActive.value) {
    return resolvedLabel(activeOverflowItem.value)
  }
  return 'More'
})

const moreButtonIcon = computed(() => {
  if (isOverflowActive.value) {
    return resolvedIcon(activeOverflowItem.value)
  }
  return 'more_horiz'
})

const moreButtonClasses = computed(() => {
  if (isOverflowActive.value) {
    const item = activeOverflowItem.value
    const color = item.color || 'primary'
    return {
      'aql-list-switcher-item--active': true,
      [`aql-list-switcher-item--active-${color}`]: true,
    }
  }
  return { 'aql-list-switcher-item--inactive': true }
})

const moreButtonStyle = computed(() => {
  if (!isOverflowActive.value) return {}
  const color = activeOverflowItem.value.color
  if (!color || color === 'primary') return {}
  return { '--aql-switcher-active-color': `var(--q-${color}, currentColor)` }
})

// ── Per-item resolution via useSectionResolver for 'ListSwitcherItem' ──
const itemResolverProps = computed(() => ({
  section:  'ListSwitcherItem',
  page:     props.page,
  scope:    resourceConfig?.scope?.value    ?? 'master',
  resource: resourceConfig?.resourceSlug?.value ?? '',
  uiName:   resourceConfig?.customUIName?.value ?? 'AQL',
}))

const { resolvedComponent: resolvedItemComponent } = useSectionResolver(itemResolverProps)

// ── Item Click Handler ──
function handleItemClick(itemName) {
  emit('update:activeItem', itemName)
  if (resourceRecord?.setActiveView) {
    resourceRecord.setActiveView(itemName)
  }
}

// ── Prop helpers ──
function evaluate(val, item) {
  if (typeof val === 'function') {
    return val(item, finalAttrs.value.items, resourceConfig?.config?.value ?? null)
  }
  return val
}

function resolvedLabel(item) {
  const v = finalAttrs.value.label
  const evaluated = evaluate(v, item)
  return evaluated !== null && evaluated !== undefined ? evaluated : item.label ?? item.name
}

function resolvedIcon(item) {
  const v = finalAttrs.value.icon
  const evaluated = evaluate(v, item)
  return evaluated !== null && evaluated !== undefined ? evaluated : (item.icon || null)
}

function buildItemProps(item) {
  return {
    ...item,
    item,
    active: finalAttrs.value.activeItem === item.name,
    label:  resolvedLabel(item),
    icon:   resolvedIcon(item),
    color:  item.color || 'primary',
  }
}

// ── Visual helpers ──
function menuItemClasses(item) {
  const isActive = finalAttrs.value.activeItem === item.name
  const color = item.color || 'primary'
  return {
    [`text-${color}`]: isActive,
    'bg-grey-2': isActive,
  }
}

// Active dot gets active color highlight
function activeDotStyle(item) {
  const color = item.color || 'primary'
  return { background: `var(--q-${color}, var(--q-primary))` }
}
</script>
