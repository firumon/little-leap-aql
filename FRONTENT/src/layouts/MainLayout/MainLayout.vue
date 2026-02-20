<template>
  <q-layout view="lHh Lpr lFf" class="bg-grey-1">
    <q-header elevated class="bg-primary text-white" height-hint="64">
      <q-toolbar class="q-py-sm">
        <q-btn
          flat
          dense
          round
          icon="menu"
          aria-label="Menu"
          @click="toggleLeftDrawer"
        />

        <q-toolbar-title class="text-weight-bold row no-wrap items-center">
          <q-icon name="auto_graph" size="28px" class="q-mr-sm" />
          <span>Little Leap AQL</span>
        </q-toolbar-title>

        <q-space />

        <div class="q-gutter-sm row items-center no-wrap">
          <q-input
            dark
            dense
            standout
            v-model="search"
            input-class="text-right"
            class="q-ml-md desktop-only"
            placeholder="Search resources..."
            style="width: 250px"
          >
            <template v-slot:append>
              <q-icon v-if="search === ''" name="search" />
              <q-icon v-else name="clear" class="cursor-pointer" @click="search = ''" />
            </template>
          </q-input>

          <q-btn round flat icon="notifications">
            <q-badge floating color="red" rounded />
          </q-btn>
          
          <q-btn round flat>
            <q-avatar size="32px">
              <img :src="userAvatar">
            </q-avatar>
            <q-menu>
              <q-list style="min-width: 150px">
                <q-item-section class="q-pa-md text-grey-8 bg-grey-2">
                  <div class="text-weight-bold">{{ auth.userProfile?.name }}</div>
                  <div class="text-caption">{{ auth.userDesignation || auth.userRole }}</div>
                </q-item-section>
                <q-separator />
                <q-item clickable v-close-popup to="/profile">
                  <q-item-section avatar>
                    <q-icon name="person" />
                  </q-item-section>
                  <q-item-section>Profile</q-item-section>
                </q-item>
                <q-item clickable v-close-popup>
                  <q-item-section avatar>
                    <q-icon name="settings" />
                  </q-item-section>
                  <q-item-section>Settings</q-item-section>
                </q-item>
                <q-separator />
                <q-item clickable v-close-popup class="text-negative" @click="handleLogout">
                  <q-item-section avatar>
                    <q-icon name="logout" />
                  </q-item-section>
                  <q-item-section>Logout</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
        </div>
      </q-toolbar>
    </q-header>

    <q-drawer
      v-model="leftDrawerOpen"
      show-if-above
      bordered
      :width="260"
      class="bg-white"
    >
      <q-scroll-area class="fit">
        <q-list padding>
          <q-item to="/dashboard" active-class="bg-blue-1 text-primary" clickable v-ripple>
            <q-item-section avatar>
              <q-icon name="dashboard" />
            </q-item-section>
            <q-item-section>Dashboard</q-item-section>
          </q-item>

          <q-separator class="q-my-md" />

          <q-expansion-item
            v-for="group in visibleResourceMenuGroups"
            :key="group.key"
            :icon="group.icon"
            :label="group.label"
            header-class="text-weight-medium"
          >
            <q-list class="q-pl-lg">
              <q-item
                v-for="menuItem in group.items"
                :key="menuItem.resource"
                :to="menuItem.routePath"
                clickable
                v-ripple
              >
                <q-item-section avatar><q-icon :name="menuItem.navIcon" size="xs" /></q-item-section>
                <q-item-section>{{ menuItem.navLabel }}</q-item-section>
              </q-item>
            </q-list>
          </q-expansion-item>
          <q-item-label v-if="visibleResourceMenuGroups.length === 0" caption class="q-px-md q-py-sm text-grey-6">
            No master resources assigned for this role.
          </q-item-label>

          <q-separator class="q-my-md" />

          <q-item to="/settings" clickable v-ripple>
            <q-item-section avatar>
              <q-icon name="settings" />
            </q-item-section>
            <q-item-section>App Settings</q-item-section>
          </q-item>
        </q-list>
      </q-scroll-area>
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAuthStore } from 'src/stores/auth'

const auth = useAuthStore()
const leftDrawerOpen = ref(false)
const search = ref('')

const groupIconByName = {
  masters: 'admin_panel_settings',
  logistics: 'local_shipping',
  inventory: 'inventory',
  'sales & orders': 'receipt_long',
  reports: 'assessment',
  system: 'settings'
}

function normalizeText(value) {
  return (value || '').toString().trim().toLowerCase()
}

function resolveGroupIcon(groupLabel, resources) {
  const byName = groupIconByName[normalizeText(groupLabel)]
  if (byName) return byName

  const withIcon = (resources || []).find((entry) => entry?.navIcon)
  if (withIcon) return withIcon.navIcon

  return 'menu_open'
}

function isMasterRoute(routePath) {
  return typeof routePath === 'string' && /^\/masters\/[^/]+$/.test(routePath)
}

const userAvatar = computed(() => auth.userProfile?.avatar || 'https://cdn.quasar.dev/img/avatar.png')
const readableResources = computed(() => {
  const resources = Array.isArray(auth.resources) ? auth.resources : []
  return new Set(
    resources
      .filter((resource) => resource?.permissions?.canRead === true)
      .map((resource) => resource.name)
  )
})

const menuSearchQuery = computed(() => search.value.trim().toLowerCase())

const visibleResourceMenuGroups = computed(() => {
  const resources = Array.isArray(auth.resources) ? auth.resources : []
  const grouped = {}

  resources
    .filter((resource) => {
      const routePath = resource?.ui?.routePath || ''
      return resource?.scope === 'master' &&
        resource?.permissions?.canRead === true &&
        resource?.ui?.showInMenu !== false &&
        isMasterRoute(routePath) &&
        readableResources.value.has(resource.name)
    })
    .forEach((resource) => {
      const navLabel = resource.ui?.menuLabel || resource.name
      if (menuSearchQuery.value && !navLabel.toLowerCase().includes(menuSearchQuery.value)) {
        return
      }

      const groupLabel = resource.ui?.menuGroup || 'Masters'
      if (!grouped[groupLabel]) {
        grouped[groupLabel] = []
      }

      grouped[groupLabel].push({
        resource: resource.name,
        routePath: resource.ui?.routePath || `/masters/${resource.name.toLowerCase()}`,
        navLabel,
        navIcon: resource.ui?.menuIcon || 'list_alt',
        order: Number(resource.ui?.menuOrder || 9999)
      })
    })

  return Object.keys(grouped)
    .map((groupLabel) => {
      const items = grouped[groupLabel].sort((a, b) => a.order - b.order)
      return {
        key: normalizeText(groupLabel) || 'masters',
        label: groupLabel,
        icon: resolveGroupIcon(groupLabel, items),
        order: items.length ? items[0].order : 9999,
        items
      }
    })
    .sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order
      return a.label.localeCompare(b.label)
    })
})

function toggleLeftDrawer () {
  leftDrawerOpen.value = !leftDrawerOpen.value
}

function handleLogout() {
  auth.logout()
}
</script>

<style lang="scss">
.q-drawer {
  .q-item {
    border-radius: 0 24px 24px 0;
    margin-right: 12px;
    &.q-router-link--active {
      background: rgba($primary, 0.1);
      color: $primary;
      font-weight: bold;
    }
  }
}
</style>
