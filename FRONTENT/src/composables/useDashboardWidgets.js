import { computed, defineAsyncComponent } from 'vue'
import { useAuthStore } from 'src/stores/auth'

const WidgetPendingPRs = defineAsyncComponent(() => import('src/pages/Dashboard/widgets/WidgetPendingPRs.vue').catch(() => import('src/pages/Dashboard/widgets/WidgetPlaceholder.vue')))
const WidgetAwaitingRFQs = defineAsyncComponent(() => import('src/pages/Dashboard/widgets/WidgetAwaitingRFQs.vue').catch(() => import('src/pages/Dashboard/widgets/WidgetPlaceholder.vue')))
const WidgetPendingGRN = defineAsyncComponent(() => import('src/pages/Dashboard/widgets/WidgetPendingGRN.vue').catch(() => import('src/pages/Dashboard/widgets/WidgetPlaceholder.vue')))
const WidgetPendingDuty = defineAsyncComponent(() => import('src/pages/Dashboard/widgets/WidgetPendingDuty.vue').catch(() => import('src/pages/Dashboard/widgets/WidgetPlaceholder.vue')))

const WIDGET_REGISTRY = [
  { id: 'pm_pending_prs', weight: 100, component: WidgetPendingPRs, roles: ['ProcurementManager', 'Admin'] },
  { id: 'pm_awaiting_rfqs', weight: 90, component: WidgetAwaitingRFQs, roles: ['ProcurementManager', 'Admin'] },
  { id: 'sk_pending_grn', weight: 100, component: WidgetPendingGRN, roles: ['StoreKeeper', 'Admin'] },
  { id: 'acc_pending_duty', weight: 100, component: WidgetPendingDuty, roles: ['Accountant', 'Admin'] }
]

export function useDashboardWidgets() {
  const authStore = useAuthStore()

  const activeWidgets = computed(() => {
    const userRoles = Array.isArray(authStore.userRoles)
      ? authStore.userRoles
      : (authStore.userRole || '').split(',').map((entry) => entry.trim()).filter(Boolean)

    return WIDGET_REGISTRY
      .filter((widget) => widget.roles.some((requiredRole) => userRoles.includes(requiredRole)))
      .sort((a, b) => b.weight - a.weight)
  })

  return {
    activeWidgets
  }
}

