<template>
  <q-page class="q-pa-md bg-grey-1">
    <div class="row q-col-gutter-md">
      <div 
        v-for="widget in activeWidgets" 
        :key="widget.id"
        class="col-12 col-md-6 col-lg-4"
      >
        <component :is="widget.component" />
      </div>

      <div v-if="activeWidgets.length === 0" class="col-12 text-center q-pa-xl text-grey-6">
        <q-icon name="dashboard_customize" size="4rem" class="q-mb-md" />
        <div class="text-h6">No widgets assigned</div>
        <div>Your current role does not have any active dashboard widgets configured.</div>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { computed, defineAsyncComponent } from 'vue'
import { useAuthStore } from 'src/stores/auth'

const authStore = useAuthStore()

// Lazy load widget components (stubbed for now; to be built iteratively)
const WidgetPendingPRs = defineAsyncComponent(() => import('./widgets/WidgetPendingPRs.vue').catch(() => import('./widgets/WidgetPlaceholder.vue')))
const WidgetAwaitingRFQs = defineAsyncComponent(() => import('./widgets/WidgetAwaitingRFQs.vue').catch(() => import('./widgets/WidgetPlaceholder.vue')))
const WidgetPendingGRN = defineAsyncComponent(() => import('./widgets/WidgetPendingGRN.vue').catch(() => import('./widgets/WidgetPlaceholder.vue')))
const WidgetPendingDuty = defineAsyncComponent(() => import('./widgets/WidgetPendingDuty.vue').catch(() => import('./widgets/WidgetPlaceholder.vue')))

// Master definition of all possible widgets and their required roles + weight
const WIDGET_REGISTRY = [
  { id: 'pm_pending_prs', weight: 100, component: WidgetPendingPRs, roles: ['ProcurementManager', 'Admin'] },
  { id: 'pm_awaiting_rfqs', weight: 90, component: WidgetAwaitingRFQs, roles: ['ProcurementManager', 'Admin'] },
  { id: 'sk_pending_grn', weight: 100, component: WidgetPendingGRN, roles: ['StoreKeeper', 'Admin'] },
  { id: 'acc_pending_duty', weight: 100, component: WidgetPendingDuty, roles: ['Accountant', 'Admin'] }
]

const activeWidgets = computed(() => {
  // authStore.userRoles should be an array of roles e.g ['ProcurementManager', 'StoreKeeper']
  // If it's a string, we normalize it to array
  const rolesRaw = authStore.userRoles || authStore.userRole || ''
  const userRoles = Array.isArray(rolesRaw) ? rolesRaw : rolesRaw.split(',').map(r => r.trim())

  // Filter widgets where user has the required role
  const availableWidgets = WIDGET_REGISTRY.filter(widget => {
    return widget.roles.some(requiredRole => userRoles.includes(requiredRole))
  })

  // Sort by weight descending
  return availableWidgets.sort((a, b) => b.weight - a.weight)
})
</script>
