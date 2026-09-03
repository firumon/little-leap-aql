<template>
  <!-- Strict hide rule: on an Index page a zero-row work list is not "nothing new",
       it is one more thing to read past. -->
  <div v-if="visibleRows.length">
    <SectionDividerLabel v-if="resolvedTitle" :label="resolvedTitle" />
    <WorkListWidget
      v-bind="rowProps"
      :items="visibleRows"
      :hidden-count="hiddenCount"
      :item-key="itemKey"
      @row-click="openRow"
    >
      <template v-for="(_, name) in $slots" #[name]="slotProps">
        <slot :name="name" v-bind="slotProps || {}" />
      </template>
    </WorkListWidget>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { evaluateProp } from 'src/composables/resources/useSectionResolver'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import WorkListWidget from 'components/_dashboard_widgets/WorkList.vue'

defineOptions({ name: 'SectionsWorkList', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: '' },
  items: { type: [Array, Function], default: null },

  limit: { type: [Number, Function], default: 5 },
  bufferPercent: { type: [Number, Function], default: 50 },

  // Where a tapped row goes. Blank scope/slug means this page's own resource.
  code: { type: [String, Function], default: 'Code' },
  scope: { type: String, default: '' },
  resourceSlug: { type: String, default: '' },

  layout: { type: Array, default: () => ['label', 'caption'] },
  content: { type: Array, default: null },
  label: { type: [String, Function, Object], default: 'Code' },
  caption: { type: [String, Function, Object], default: null },
  metaLayout: { type: Array, default: () => ['chip', 'caption', 'label'] },
  metaLabel: { type: [String, Function, Object], default: null },
  metaCaption: { type: [String, Function, Object], default: null },
  chip: { type: [String, Function, Object], default: null },
  badge: { type: [String, Function, Object], default: null },
  btn: { type: [String, Function, Object], default: null },
  chipColor: { type: [String, Function], default: null },
  chipOutline: { type: Boolean, default: false },
  badgeColor: { type: [String, Function], default: null },
  icon: { type: [String, Function], default: null },
  iconColor: { type: [String, Function], default: null },
  highlightColor: { type: [String, Function], default: null },
  dense: { type: Boolean, default: true }
})

const resourceConfig = inject('resourceConfig', null)
const resourceRecord = inject('resourceRecord', null)
const nav = useResourceNav()

const evaluate = (val) => evaluateProp(val, resourceRecord, resourceConfig)

const resolvedTitle = computed(() => evaluate(props.title) || '')

const visibleLimit = computed(() => Math.max(1, Math.floor(Number(evaluate(props.limit))) || 1))

const sourceCap = computed(() => {
  const percent = Number(evaluate(props.bufferPercent))
  return Math.ceil(visibleLimit.value * (1 + (Number.isFinite(percent) ? Math.max(0, percent) : 0) / 100))
})

function codeOf (row) {
  const raw = props.code
  if (typeof raw === 'function') return String(raw(row) ?? '').trim()
  if (row && typeof row === 'object' && raw in row) return String(row[raw] ?? '').trim()
  return String(raw ?? '').trim()
}

const itemKey = (row) => codeOf(row) || ''

// A row with no code cannot be opened, so it is never offered. The buffer above
// `limit` is what keeps the list full after these drops.
const sourceRows = computed(() => {
  const resolved = evaluate(props.items)
  if (!Array.isArray(resolved)) return []
  return resolved.slice(0, sourceCap.value).filter((row) => !!codeOf(row))
})

const visibleRows = computed(() => sourceRows.value.slice(0, visibleLimit.value))
const hiddenCount = computed(() => sourceRows.value.length - visibleRows.value.length)

const rowProps = computed(() => ({
  layout: props.layout,
  content: props.content,
  label: props.label,
  caption: props.caption,
  metaLayout: props.metaLayout,
  metaLabel: props.metaLabel,
  metaCaption: props.metaCaption,
  chip: props.chip,
  chipColor: props.chipColor,
  chipOutline: props.chipOutline,
  badge: props.badge,
  badgeColor: props.badgeColor,
  btn: props.btn,
  icon: props.icon,
  iconColor: props.iconColor,
  highlightColor: props.highlightColor,
  dense: props.dense
}))

function openRow (row) {
  const code = codeOf(row)
  if (!code) return
  const target = { code }
  if (props.scope) target.scope = props.scope
  if (props.resourceSlug) target.resourceSlug = props.resourceSlug
  nav.goTo('view', target)
}
</script>
