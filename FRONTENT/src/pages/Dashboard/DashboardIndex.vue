<template>
  <component :is="activeDashboard" />
</template>

<script setup>
import { computed } from 'vue'
import { useAuthStore } from 'src/stores/auth'
import AdminDashboard from './AdminDashboard.vue'
import ManagerDashboard from './ManagerDashboard.vue'
import StaffDashboard from './StaffDashboard.vue'
import UserDashboard from './UserDashboard.vue'

const authStore = useAuthStore()

const activeDashboard = computed(() => {
  const role = authStore.userRole?.toLowerCase() || 'user'

  switch (role) {
    case 'administrator':
      return AdminDashboard
    case 'manager':
      return ManagerDashboard
    case 'staff':
      return StaffDashboard
    default:
      return UserDashboard
  }
})
</script>
