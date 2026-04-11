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
          <span>AQL</span>
        </q-toolbar-title>

        <q-space />

        <div class="q-gutter-sm row items-center no-wrap">
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

          <MenuTreeNode
            v-for="node in visibleResourceMenuGroups"
            :key="node.key"
            :node="node"
          />
          <q-item-label v-if="visibleResourceMenuGroups.length === 0" caption class="q-px-md q-py-sm text-grey-6">
            No resources assigned for this role.
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
import { useMenuAccess } from 'src/composables/useMenuAccess'
import MenuTreeNode from 'src/components/MenuTreeNode.vue'

const auth = useAuthStore()
const { evaluateMenuAccess } = useMenuAccess()
const leftDrawerOpen = ref(false)

const groupIconByName = {
  masters: 'admin_panel_settings',
  operations: 'swap_horiz',
  procurement: 'shopping_cart',
  accounts: 'account_balance',
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

function isValidRoute(routePath) {
  return typeof routePath === 'string' && routePath.trim() !== ''
}

const userAvatar = computed(() => auth.userProfile?.avatar || 'https://cdn.quasar.dev/img/avatar.png')

const visibleResourceMenuGroups = computed(() => {
  const resources = Array.isArray(auth.resources) ? auth.resources : []
  const root = []
  const seenKeys = new Set()

  resources.forEach((resource) => {
    const menus = Array.isArray(resource?.ui?.menus) ? resource.ui.menus : []
    menus.forEach((menu) => {
      if (menu.show === false || !isValidRoute(menu.route)) return
      if (!evaluateMenuAccess(resource, menu)) return

      const navLabel = menu.label || resource.name
      const groupSegments = Array.isArray(menu.group) && menu.group.length > 0
        ? menu.group
        : ['General']
      const groupPath = groupSegments.join('/')
      const dedupeKey = `${groupPath}::${navLabel}::${menu.route}`

      if (seenKeys.has(dedupeKey)) return
      seenKeys.add(dedupeKey)

      // Walk / create group nodes along the path
      let currentChildren = root
      groupSegments.forEach((segment, idx) => {
        const pathKey = groupSegments.slice(0, idx + 1).join('/')
        let groupNode = currentChildren.find((n) => n.type === 'group' && n.key === pathKey)
        if (!groupNode) {
          groupNode = {
            type: 'group',
            key: pathKey,
            label: segment,
            icon: resolveGroupIcon(segment, []),
            order: 9999,
            children: []
          }
          currentChildren.push(groupNode)
        }
        currentChildren = groupNode.children
      })

      // Add leaf at the deepest level
      currentChildren.push({
        type: 'leaf',
        key: `${resource.name}::${menu.route}`,
        resource: resource.name,
        routePath: menu.route,
        navLabel,
        navIcon: menu.icon || 'list_alt',
        order: Number(menu.order || 9999)
      })
    })
  })

  // Sort each level: leaves and groups by order then label
  function sortNodes(nodes) {
    nodes.sort((a, b) => {
      const ao = a.order !== undefined ? a.order : 9999
      const bo = b.order !== undefined ? b.order : 9999
      if (ao !== bo) return ao - bo
      return (a.label || a.navLabel || '').localeCompare(b.label || b.navLabel || '')
    })
    nodes.forEach((n) => {
      if (n.type === 'group') {
        // Propagate min-order from children so group sorts correctly
        n.order = n.children.reduce((min, c) => Math.min(min, c.order !== undefined ? c.order : 9999), 9999)
        sortNodes(n.children)
      }
    })
  }
  sortNodes(root)

  return root
})

function toggleLeftDrawer () {
  leftDrawerOpen.value = !leftDrawerOpen.value
}

async function handleLogout() {
  await auth.logout()
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
