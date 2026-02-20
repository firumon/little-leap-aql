<template>
    <q-page padding class="bg-grey-2">
        <!-- Header -->
        <div class="row items-center q-mb-md">
            <div class="text-h5 text-weight-bold">Admin Dashboard</div>
            <q-space />
            <div class="text-caption text-grey-7">Last updated: {{ new Date().toLocaleString() }}</div>
        </div>

        <!-- Stats Grid -->
        <div class="row q-col-gutter-md q-mb-lg">
            <div v-for="(stat, index) in stats" :key="index" class="col-12 col-sm-6 col-md-3">
                <StatCard :title="stat.title" :value="stat.value" :icon="stat.icon" :color="stat.color"
                    :trend="stat.trend" :trend-direction="stat.trendDirection" />
            </div>
        </div>

        <!-- Main Content -->
        <div class="row q-col-gutter-md">
            <!-- Recent Activities -->
            <div class="col-12 col-md-8">
                <RecentActivities :activities="activities" />
            </div>

            <!-- Quick Actions -->
            <div class="col-12 col-md-4">
                <q-card flat bordered class="full-height">
                    <q-card-section>
                        <div class="text-h6">Quick Actions</div>
                    </q-card-section>
                    <q-card-section>
                        <div class="row q-gutter-sm">
                            <q-btn v-for="action in quickActions" :key="action.label" :label="action.label"
                                :icon="action.icon" :color="action.color" :to="action.to" class="col-12" align="left"
                                flat size="md" />
                        </div>
                    </q-card-section>
                </q-card>
            </div>
        </div>
    </q-page>
</template>

<script setup>
import { onMounted, computed } from 'vue'
import { useDashboardStore } from 'src/stores/dashboard'
import StatCard from 'components/Dashboard/StatCard.vue'
import RecentActivities from 'components/Dashboard/RecentActivities.vue'

const dashboardStore = useDashboardStore()

const stats = computed(() => dashboardStore.stats)
const activities = computed(() => dashboardStore.recentActivities)

const quickActions = [
    { label: 'New Order', icon: 'add_shopping_cart', color: 'primary', to: '/sales/orders/create' },
    { label: 'Add Product', icon: 'add_box', color: 'secondary', to: '/masters/products' },
    { label: 'New Shipment', icon: 'local_shipping', color: 'accent', to: '/logistics/shipments/create' },
    { label: 'Create Invoice', icon: 'receipt', color: 'info', to: '/sales/invoices/create' }
]

onMounted(() => {
    dashboardStore.fetchDashboardData()
})
</script>

