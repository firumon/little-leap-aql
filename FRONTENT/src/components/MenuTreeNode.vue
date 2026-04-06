<template>
  <template v-if="node.type === 'leaf'">
    <q-item
      :to="node.routePath"
      clickable
      v-ripple
      active-class="text-primary"
    >
      <q-item-section avatar>
        <q-icon :name="node.navIcon" size="xs" />
      </q-item-section>
      <q-item-section>{{ node.navLabel }}</q-item-section>
    </q-item>
  </template>
  <template v-else>
    <q-expansion-item
      :icon="node.icon"
      :label="node.label"
      header-class="text-weight-medium"
    >
      <q-list class="q-pl-lg">
        <MenuTreeNode
          v-for="child in node.children"
          :key="child.key"
          :node="child"
        />
      </q-list>
    </q-expansion-item>
  </template>
</template>

<script setup>
defineProps({
  node: {
    type: Object,
    required: true
  }
})
</script>
