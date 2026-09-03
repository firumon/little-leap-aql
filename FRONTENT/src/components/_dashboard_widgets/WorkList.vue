<template>
  <div v-if="items.length">
    <AppList
      v-bind="rowProps"
      :items="items"
      :item-key="itemKey"
      :paginate="false"
      clickable
      @click="emit('row-click', $event)"
    >
      <template v-for="(_, name) in $slots" #[name]="slotProps">
        <slot :name="name" v-bind="slotProps || {}" />
      </template>
    </AppList>

    <div v-if="hiddenCount > 0" class="text-caption text-grey-6 q-px-md q-pt-xs">
      + {{ hiddenCount }} more
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import AppList from 'components/app/AppList.vue'

defineOptions({ name: 'DashboardWidgetWorkList', inheritAttrs: false })

const props = defineProps({
  // Already sliced by the caller. This widget draws what it is handed.
  items: { type: Array, default: () => [] },
  hiddenCount: { type: Number, default: 0 },
  itemKey: { type: [String, Function], default: 'Code' },

  // Row cells, forwarded verbatim to abstract/List.vue, which routes each one
  // through Renderable — so an Object here is a whole component.
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

  // Resolved as values by abstract/List.vue, so deliberately not widened.
  chipColor: { type: [String, Function], default: null },
  chipOutline: { type: Boolean, default: false },
  badgeColor: { type: [String, Function], default: null },
  icon: { type: [String, Function], default: null },
  iconColor: { type: [String, Function], default: null },
  highlightColor: { type: [String, Function], default: null },
  dense: { type: Boolean, default: true }
})

const emit = defineEmits(['row-click'])

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
</script>
