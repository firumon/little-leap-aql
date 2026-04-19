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
              <img :src="userAvatar" alt="User avatar">
            </q-avatar>
            <q-menu>
              <q-list style="min-width: 150px">
                <q-item-section class="q-pa-md text-grey-8 bg-grey-2">
                  <div class="text-weight-bold">{{ userName }}</div>
                  <div class="text-caption">{{ userRoleLabel }}</div>
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
      :width="260"
      class="nav-drawer"
    >
      <q-scroll-area class="fit">
        <!-- Logo block -->
        <div class="nav-logo">
          <div class="nav-logo__mark">
            <q-icon name="auto_graph" size="18px" color="white" />
          </div>
          <div>
            <div class="nav-logo__title">AQL</div>
            <div class="nav-logo__subtitle">Operations</div>
          </div>
        </div>

        <q-list padding class="q-pt-sm">
          <q-item to="/dashboard" exact clickable v-ripple>
            <q-item-section avatar>
              <q-icon name="dashboard" />
            </q-item-section>
            <q-item-section>Dashboard</q-item-section>
          </q-item>

          <q-separator class="q-my-sm" />

          <MenuTreeNode
            v-for="node in visibleResourceMenuGroups"
            :key="node.key"
            :node="node"
          />
          <q-item-label v-if="visibleResourceMenuGroups.length === 0" caption class="q-px-md q-py-sm" style="color: rgba(255,255,255,0.35); font-size: 11px;">
            No resources assigned for this role.
          </q-item-label>

          <q-separator class="q-my-sm" />

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
import MenuTreeNode from 'src/components/MenuTreeNode.vue'
import { useMainLayoutNavTree } from 'src/composables/layout/useMainLayoutNavTree'

const {
  leftDrawerOpen,
  userAvatar,
  userName,
  userRoleLabel,
  visibleResourceMenuGroups,
  toggleLeftDrawer,
  handleLogout
} = useMainLayoutNavTree()
</script>

<style lang="scss">
// Nav drawer global overrides — selectors must be non-scoped to reach q-drawer portal
.q-drawer--left .q-drawer__content {
  background: $primary;
}
</style>
