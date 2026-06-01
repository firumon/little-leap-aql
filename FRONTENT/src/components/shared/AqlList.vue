<template>
  <q-list :bordered="bordered" :separator="separator" class="q-gutter-y-xs">
    <!-- Loading State -->

    <q-item v-if="loading && !items.length" class="flex flex-center q-pa-xl">
      <q-spinner color="primary" size="3em" />
    </q-item>

    <!-- Empty State -->
    <slot v-else-if="!items.length" name="empty">
      <q-item class="empty-state-container q-py-xl text-center">
        <q-item-section>
          <q-icon name="inventory_2" size="48px" color="grey-4" class="q-mb-sm block q-mx-auto" />
          <q-item-label class="text-subtitle1 text-weight-bold text-grey-6">{{ emptyText }}</q-item-label>
        </q-item-section>
      </q-item>
    </slot>
    <!-- Items List -->
    <template v-else>
      <q-item
        class="interactive-list-card q-px-md"
        v-for="(item, index) in items"
        :key="resolveKey(item, index)"
        :clickable="isItemClickable"
        v-ripple="isItemClickable"
        @click="isItemClickable && emit('click', item)"
        :class="{ 'border': isHighlighted, 'q-py-sm':dense, 'q-py-md q-px-md':!dense }"
        :style="isHighlighted ? { '--border-color': highlightColor(item) } : {}"
      >
        <!-- Dynamic Row Content slot -->
        <slot name="item" :item="item" :index="index">

          <!-- Left Side Icon / Avatar -->
          <q-item-section v-if="hasIcon(item) || slots.avatar" :top="align === 'top'" side>
            <slot name="avatar" :item="item">
              <q-avatar
                size="md"
                :icon="resolveProp(icon,item)"
                :text-color="iconColor(item)"
                :style="{ backgroundColor: iconBgColor(item) }"
              />
            </slot>
          </q-item-section>

          <!-- Main Content Area -->
          <q-item-section>
            <!-- We loop over the contentArray sequence -->
            <template v-for="(contentProp, contentIndex) in contentArray" :key="contentIndex">
              <slot :name="'content' + contentIndex" :item="item">
                <component v-if="contentProp !== false" :is="getComponentType(contentIndex)">
                  <template #default>
                    {{ resolveProp(contentProp, item) }}
                  </template>
                </component>
              </slot>
            </template>
          </q-item-section>

          <!-- Meta Section -->
          <q-item-section v-if="hasMeta(item)" side>
            <template v-for="(metaProp, metaIndex) in metaArray" :key="metaIndex">
              <slot :name="'meta' + metaIndex" :item="item">
                <component
                  v-if="metaProp !== false"
                  :is="getMetaComponentType(metaIndex)"
                  :color="metaColor(item)"
                >
                  <template #default>
                    {{ resolveProp(metaProp, item) }}
                  </template>
                </component>
              </slot>
            </template>
          </q-item-section>

          <!-- Action Section (Button) -->
          <q-item-section v-if="hasBtn(item) || slots.btn" side>
            <slot name="btn" :item="item">
              <q-btn
                flat round dense
                :icon="resolveProp(btn, item)"
                :color="btnColor(item)"
                @click.stop="onActionClick(item)"
              />
            </slot>
          </q-item-section>
        </slot>
      </q-item>
    </template>
  </q-list>
</template>

<script setup>
import { computed, useSlots, h, defineComponent } from 'vue'
import { QItemLabel, colors } from 'quasar'

defineOptions({ name: 'AqlList' })

// Inline registered components
const MainLabel = defineComponent({
  name: 'MainLabel',
  setup(props, { slots }) {
    return () => h(
      QItemLabel,
      { class: 'text-weight-bold text-subtitle2 text-grey-9' },
      { default: () => slots.default ? slots.default() : null }
    )
  }
})

const MainCaption = defineComponent({
  name: 'MainCaption',
  setup(props, { slots }) {
    return () => h(
      QItemLabel,
      { caption: true, class: 'text-grey-6' },
      { default: () => slots.default ? slots.default() : null }
    )
  }
})

const MetaLabel = defineComponent({
  name: 'MetaLabel',
  props: { color: { type: String, default: 'grey-9' } },
  setup(props, { slots }) {
    return () => h(
      QItemLabel,
      { class: `text-subtitle2 text-weight-bold text-${props.color}` },
      { default: () => slots.default ? slots.default() : null }
    )
  }
})

const MetaCaption = defineComponent({
  name: 'MetaCaption',
  setup(props, { slots }) {
    return () => h(
      QItemLabel,
      { caption: true, class: 'text-weight-medium text-grey-6' },
      { default: () => slots.default ? slots.default() : null }
    )
  }
})

const props = defineProps({
  items: { type: Array, default: () => [] },
  itemKey: { type: [String, Function], default: 'Code' },
  loading: { type: Boolean, default: false },
  emptyText: { type: String, default: 'No items found.' },
  bordered: { type: Boolean, default: false },
  separator: { type: Boolean, default: false },
  dense: { type: Boolean, default: false },
  color: { type: [String, Function], default: 'primary' },
  icon: { type: [String, Function], default: null },
  iconColor: { type: [String, Function], default: null },
  highlight: { type: [Boolean, String], default: false },
  highlightColor: { type: [String, Function], default: null },
  align: { type: String, default: 'center', validator: v => ['center', 'top'].includes(v) },
  label: { type: [String, Function], default: 'Code' },
  caption: { type: [String, Function], default: null },
  layout: { type: Array, default: () => ['label', 'caption'] },
  content: { type: Array, default: null },
  btn: { type: [String, Function], default: null },
  btnColor: { type: [String, Function], default: null },
  meta: { type: Array, default: null },
  metaLayout: { type: Array, default: () => ['caption', 'label'] },
  metaColor: { type: [String, Function], default: null },
  metaLabel: { type: [String, Function], default: null },
  metaCaption: { type: [String, Function], default: null },
  clickable: { type: Boolean, default: false },
})

const emit = defineEmits(['click'])
const slots = useSlots()

const isItemClickable = computed(() => {
  return props.clickable && !props.btn && !slots.btn
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

function getComponentType(contentIndex) {
  const rowType = props.layout[contentIndex]
  if (rowType === 'label') return MainLabel
  if (rowType === 'caption') return MainCaption
  return null
}

function resolveProp(prop, item) {
  if (prop === null || prop === undefined || prop === '') return ''
  if (typeof prop === 'function') return prop(item)
  return (item && typeof item === 'object' && prop in item) ? item[prop] : prop
}

function resolveKey(item, index) {
  return resolveProp(props.itemKey, item) || index || ('key-' + Math.random())
}

function hasIcon(item) {
  return !!resolveProp(props.icon, item)
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
    if (rowType === 'label') return props.metaLabel || false
    if (rowType === 'caption') return props.metaCaption || false
    return false
  })
})

const metaColor = computed(() => (item) => {
  return resolveProp(props.metaColor, item) || 'grey-9'
})

function hasMeta(item) {
  return metaArray.value.some(prop => !!resolveProp(prop, item))
}

function getMetaComponentType(metaIndex) {
  const rowType = props.metaLayout[metaIndex]
  if (rowType === 'label') return MetaLabel
  if (rowType === 'caption') return MetaCaption
  return null
}
</script>

<style scoped>
.empty-state-container {
  padding: 4rem 1.5rem;
}
.border {
  border-left: 3px solid var(--border-color) !important;
}
</style>
