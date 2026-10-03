<template>
  <template v-if="node.type === 'leaf'">
    <q-item clickable v-ripple :to="node.routePath" :exact="isExact">
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
      dark
      header-class="text-weight-medium"
    >
      <q-list class="q-pl-md">
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
import { computed, inject } from 'vue'
import { useRoute } from 'vue-router'

const props = defineProps({
  node: {
    type: Object,
    required: true
  }
})

const route = useRoute()
const allMenuRoutes = inject('allMenuRoutes', null)

function stripTrailingSlash(path) {
  return (path || '').replace(/\/+$/, '')
}

const isExact = computed(() => {
  if (typeof props.node.exact === 'boolean') {
    return props.node.exact
  }

  const currentPath = stripTrailingSlash(route.path)
  const myPath = stripTrailingSlash(props.node.routePath)

  if (allMenuRoutes?.value) {
    for (const rawOther of allMenuRoutes.value) {
      const otherRoute = stripTrailingSlash(rawOther)
      if (otherRoute !== myPath && otherRoute.length > myPath.length) {
        if (currentPath === otherRoute || currentPath.startsWith(otherRoute + '/')) {
          return true
        }
      }
    }
  }

  return false
})
</script>
