<template>
  <q-list separator class="q-py-none">
    <template v-for="node in nodes" :key="node.key">
      <q-item
        clickable
        :class="rowClass(node)"
        @click="onRowClick(node)"
      >
        <q-item-section side :style="indentStyle">
          <q-checkbox
            :model-value="stateOf(node)"
            :disable="node.locked"
            color="primary"
            @update:model-value="onCheckbox(node)"
            @click.stop
          />
        </q-item-section>

        <q-item-section v-if="!node.item" side class="q-pr-none">
          <q-icon :name="isOpen(node) ? 'expand_more' : 'chevron_right'" size="20px" color="grey-7" />
        </q-item-section>

        <q-item-section :class="ui.flexWrapTextClass">
          <q-item-label :class="node.item ? '' : 'text-weight-medium'">{{ node.label }}</q-item-label>
          <q-item-label v-if="node.caption" caption>{{ node.caption }}</q-item-label>
        </q-item-section>

        <q-item-section v-if="node.item" side>
          <q-chip
            square
            :color="node.locked ? 'positive' : 'primary'"
            text-color="white"
            :label="node.locked ? `${node.quantityLabel} Delivered` : node.quantityLabel"
          />
        </q-item-section>
      </q-item>

      <AllocationTree
        v-if="!node.item && isOpen(node)"
        :nodes="node.children"
        :depth="depth + 1"
        :open-keys="openKeys"
        :state-of="stateOf"
        @toggle="(...args) => $emit('toggle', ...args)"
        @toggle-open="(key) => $emit('toggle-open', key)"
      />
    </template>
  </q-list>
</template>

<script setup>
// Renders one level of the allocation tree and recurses into its children. It knows nothing
// about which grouping is active — every node has the same shape.
import { computed } from 'vue'
import { useDeliveryFormContext } from 'src/_ui/AQL/composables/Operation/OutletDeliveries/useDeliveryFormContext'

defineOptions({ name: 'OutletDeliveriesAllocationTree', inheritAttrs: false })

const props = defineProps({
  nodes: { type: Array, default: () => [] },
  depth: { type: Number, default: 0 },
  openKeys: { type: Object, required: true },
  stateOf: { type: Function, required: true }
})

const emit = defineEmits(['toggle', 'toggle-open'])

const { ui } = useDeliveryFormContext()

const indentStyle = computed(() => ({ paddingLeft: `${props.depth * 16}px` }))

const isOpen = (node) => props.openKeys.has(node.key)

const rowClass = (node) => (props.depth === 0 && !node.item ? 'bg-grey-2' : '')

// The emitted value is ignored on purpose. A parent sits at `null` when only some children
// are ticked, and Quasar's own next-value from there is `false` — which would clear a
// half-ticked group instead of completing it. Only a fully ticked node unticks.
const onCheckbox = (node) => emit('toggle', node, props.stateOf(node) !== true)

// Tapping the row body opens a group, or ticks a line — a phone target bigger than the box.
const onRowClick = (node) => {
  if (node.item) onCheckbox(node)
  else emit('toggle-open', node.key)
}
</script>
