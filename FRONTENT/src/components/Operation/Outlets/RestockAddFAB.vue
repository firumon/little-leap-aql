<template>
  <div v-if="canCreate" class="fixed-bottom-right q-mr-lg q-mb-lg" style="z-index: 9999;">
    <!-- If user can direct restock, show a menu FAB -->
    <q-fab
      v-if="canDirect"
      color="primary"
      icon="add"
      direction="up"
      vertical-actions-align="right"
      label-position="left"
      class="shadow-5"
    >
      <q-fab-action
        color="secondary"
        icon="bolt"
        label="Direct Restock"
        label-position="left"
        @click="goToDirect"
      />
      <q-fab-action
        color="primary"
        icon="post_add"
        label="Standard Request"
        label-position="left"
        @click="goToNormal"
      />
    </q-fab>

    <!-- If user can only request normally, show a simple button -->
    <q-btn
      v-else
      round
      color="primary"
      size="lg"
      icon="add"
      class="shadow-5 clickable-scale"
      @click="goToNormal"
    >
      <q-tooltip anchor="top middle" self="bottom middle">New Restock Request</q-tooltip>
    </q-btn>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useResourceNav } from 'src/composables/resources/useResourceNav'

defineOptions({ name: 'RestockAddFAB' })

const { allowed } = useResourceConfig()
const nav = useResourceNav()

// Permissions gating
const canCreate = computed(() => {
  return allowed({ outletRestock: 'create' })
})

const canDirect = computed(() => {
  // Requires restock create/update permissions and stock/outlet movements capabilities
  return allowed({
    outletRestock: ['create', 'update'],
    stockMovement: 'create',
    outletMovement: 'create'
  })
})

function goToDirect() {
  nav.goTo('resource-page', { pageSlug: 'direct-restock' })
}

function goToNormal() {
  nav.goTo('add')
}
</script>

<style scoped>
.clickable-scale {
  transition: transform 0.15s ease;
}
.clickable-scale:active {
  transform: scale(0.95);
}
</style>
