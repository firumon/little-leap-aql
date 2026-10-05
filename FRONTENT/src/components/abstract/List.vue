<template>
  <q-list
    :bordered="bordered"
    :separator="separator"
    class="relative-position aql-stagger"
    :class="[gutterClass, $attrs.class]"
    :style="[staggerStyle, $attrs.style]"
  >
    <TransitionGroup name="aql-list-item" appear>
      <!-- Loading State -->
      <q-item v-if="loading && !items.length" key="list-loading-state" class="flex flex-center q-pa-xl">
        <q-spinner color="primary" size="3em" />
      </q-item>

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
        :tag="itemTag"
        :clickable="isItemClickable"
        v-ripple="isItemClickable"
        @click="isItemClickable && onItemClick(item)"
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

          <!-- Left Side Selectable Checkbox -->
          <q-item-section v-if="isSelectableLeft" :top="align === 'top'" side>
            <slot name="checkbox" :item="item" :index="index">
              <slot name="select" :item="item" :index="index">
                <component
                  :is="isComponentDef(checkbox) ? checkbox : ListCheckbox"
                  :item="item"
                  v-model="model"
                  :val="val"
                  :item-key="itemKey"
                  :true-value="trueValue"
                  :false-value="falseValue"
                  :color="resolveCheckboxColor(item)"
                  :dense="dense"
                />
              </slot>
            </slot>
          </q-item-section>

          <!-- Main Content Area -->
          <q-item-section>
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

          <!-- Right Side: 1. Input, 2. Checkbox, 3. Action Button -->
          <q-item-section v-if="isItemInput(item) || slots.input" side :top="align === 'top'">
            <slot name="input" :item="item" :index="index">
              <component
                :is="isComponentDef(input) ? input : ListInput"
                :item="item"
                v-model="model"
                :input="input"
                :input-props="inputProps"
                :input-label="inputLabel"
                :input-key="inputKey"
                :input-value="inputValue"
                :val="val"
                :item-key="itemKey"
                :dense="dense"
                @input-change="emit('input-change', $event)"
              />
            </slot>
          </q-item-section>
          <q-item-section v-else-if="isSelectableRight" :top="align === 'top'" side>
            <slot name="checkbox" :item="item" :index="index">
              <slot name="select" :item="item" :index="index">
                <component
                  :is="isComponentDef(checkbox) ? checkbox : ListCheckbox"
                  :item="item"
                  v-model="model"
                  :val="val"
                  :item-key="itemKey"
                  :true-value="trueValue"
                  :false-value="falseValue"
                  :color="resolveCheckboxColor(item)"
                  :dense="dense"
                />
              </slot>
            </slot>
          </q-item-section>
          <q-item-section v-else-if="hasBtn(item) || slots.btn" side>
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
import ListCheckbox, { toggleListItem } from 'components/abstract/ListCheckbox.vue'
import ListInput from 'components/abstract/ListInput.vue'

defineOptions({ name: 'List', inheritAttrs: false })

const model = defineModel({ default: undefined })

const props = defineProps({
  items: { type: Array, default: () => [] },
  page: { type: Number, default: undefined },
  paginate: { type: Boolean, default: true },
  perPage: { type: Number, default: 25 },
  threshold: { type: Number, default: 35 },
  itemKey: { type: [String, Function], default: 'Code' },
  input: { type: [Boolean, String, Object, Function], default: null },
  inputProps: { type: [Object, Function], default: () => ({}) },
  inputLabel: { type: [Number, String, Function], default: null },
  inputKey: { type: [Number, String, Function], default: null },
  inputValue: { type: [Number, String, Function], default: null },
  loading: { type: Boolean, default: false },
  emptyText: { type: String, default: 'No items found.' },
  emptyIcon: { type: String, default: 'inventory_2' },
  emptyIconColor: { type: String, default: 'grey-4' },
  bordered: { type: Boolean, default: false },
  gutter: { type: [String, Boolean], default: 'xs' },
  itemBordered: { type: Boolean, default: true },
  separator: { type: Boolean, default: false },
  dense: { type: Boolean, default: false },
  color: { type: [String, Function], default: 'primary' },
  highlight: { type: [Boolean, String], default: false },
  highlightColor: { type: [String, Function], default: null },
  clickable: { type: Boolean, default: null },
  selectable: { type: [Boolean, String], default: null, validator: v => v === null || [true, false, 'left', 'right'].includes(v) },
  checkbox: { type: [Boolean, String, Function, Object], default: null },
  val: { type: [String, Number, Function], default: null },
  trueValue: { default: true },
  falseValue: { default: false },
  checkboxColor: { type: [String, Function], default: null },
  itemClass: { type: [String, Array, Object], default: null },
  icon: { type: [String, Function], default: null },
  iconColor: { type: [String, Function], default: null },
  align: { type: String, default: 'center', validator: v => ['center', 'top'].includes(v) },
  avatar: { type: [String, Function], default: null },
  avatarLabel: { type: [String, Function], default: null },
  avatarColor: { type: [String, Function], default: 'primary' },
  avatarSize: { type: String, default: 'md' },
  layout: { type: Array, default: () => ['label', 'caption'] },
  content: { type: [Array, String], default: null },
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
  tag: { type: String, default: null },
})

const emit = defineEmits([
  'click',
  'update:page',
  'update:modelValue',
  'update:model-value',
  'update:selected',
  'input-change'
])
const slots = useSlots()
const instance = getCurrentInstance()
const currentPage = ref(1)

const pageModel = computed({
  get: () => props.page ?? currentPage.value,
  set: value => setPage(value)
})

const gutterClass = computed(() => {
  const token = props.gutter
  if (token === false || token === '' || token === 'none' || token == null) return null
  return `q-gutter-y-${token}`
})

const staggerStyle = {
  '--aql-stagger-enter-step': '35ms',
  '--aql-stagger-leave-step': '25ms'
}

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

const hasModel = computed(() => {
  if (model.value !== undefined) return true
  const vnodeProps = instance?.vnode?.props
  return !!(vnodeProps && ('modelValue' in vnodeProps || 'model-value' in vnodeProps || 'onUpdate:modelValue' in vnodeProps || 'onUpdate:model-value' in vnodeProps))
})


const hasInput = computed(() => !!(props.input || slots.input))

function isItemInput(item) {
  if (slots.input) return true
  if (props.input === false || props.input === null || props.input === undefined) return false
  if (typeof props.input === 'function') return !!props.input(item)
  return true
}

const isSelectable = computed(() => {
  if (props.selectable === false) return false
  if (props.selectable === true || props.selectable === 'left' || props.selectable === 'right') return true
  return !!(props.checkbox || slots.checkbox || slots.select)
})

const itemTag = computed(() => {
  if (props.tag) return props.tag
  if (isSelectable.value && !hasInput.value) return 'label'
  return 'div'
})

const isSelectableRight = computed(() => {
  return props.selectable === 'right'
})

const isSelectableLeft = computed(() => {
  return isSelectable.value && !isSelectableRight.value
})

function checkboxValue(item) {
  if (props.checkbox !== null && props.checkbox !== undefined) {
    return resolveProp(props.checkbox, item)
  }
  return !!isSelectable.value
}

function isItemSelectable(item) {
  return checkboxValue(item) !== false
}

const isItemClickable = computed(() => {
  if (hasInput.value) return false
  if (isSelectable.value) return true
  if (props.clickable !== null) {
    return props.clickable && !props.btn && !slots.btn
  }
  return hasClick.value && !props.btn && !slots.btn
})

function onItemClick(item) {
  if (isSelectable.value && itemTag.value !== 'label') {
    toggleItem(item)
  }
  if (hasClick.value) {
    emit('click', item)
  }
}

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
  if (isComponentDef(rowType)) return rowType
  if (rowType === 'label') return MainLabel
  if (rowType === 'caption') return MainCaption
  return null
}

function resolveProp(prop, item) {
  if (prop === null || prop === undefined || prop === '') return ''
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

const resolveCheckboxColor = computed(() => (item) => {
  return resolveProp(props.checkboxColor || props.color, item) || 'primary'
})

function toggleItem(item) {
  if (!isItemSelectable(item)) return
  model.value = toggleListItem(item, model.value, props.val, props.itemKey, props.trueValue, props.falseValue)
  emit('update:modelValue', model.value)
  emit('update:model-value', model.value)
  emit('update:selected', model.value)
}

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
