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
<!--          <q-icon name="auto_graph" size="28px" class="q-mr-sm" />-->
          <span>AQL</span>
        </q-toolbar-title>

        <q-space />

        <div class="q-gutter-sm row items-center no-wrap">

<!--          <q-btn round flat icon="notifications">
            <q-badge floating color="red" rounded />
          </q-btn>-->

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
                <q-item clickable v-close-popup to="/settings">
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
      dark
      style="background: #0B1622"
    >
      <q-scroll-area class="fit">
        <q-item dark class="q-pa-lg">
          <q-item-section avatar>
            <q-avatar rounded size="38px" style="background: linear-gradient(135deg, #D4A843 0%, #B68A2D 100%)">
              <q-icon name="auto_graph" size="20px" color="white" />
            </q-avatar>
          </q-item-section>
          <q-item-section>
            <q-item-label style="font-size: 18px; font-weight: 800; letter-spacing: 0.5px; color: #fff; line-height: 1.2">AQL</q-item-label>
            <q-item-label caption style="font-size: 11px; color: rgba(255,255,255,0.45); letter-spacing: 0.5px">Operations</q-item-label>
          </q-item-section>
        </q-item>
        <q-separator dark spaced />

        <q-list class="q-pt-sm">
          <q-item to="/dashboard" exact clickable v-ripple>
            <q-item-section avatar>
              <q-icon name="dashboard" />
            </q-item-section>
            <q-item-section>Dashboard</q-item-section>
          </q-item>

          <q-separator dark spaced class="q-my-sm" />

          <MenuTreeNode
            v-for="node in visibleResourceMenuGroups"
            :key="node.key"
            :node="node"
          />
          <q-item-label v-if="visibleResourceMenuGroups.length === 0" caption class="q-px-md q-py-sm" style="color: rgba(255,255,255,0.35); font-size: 11px;">
            No resources assigned for this role.
          </q-item-label>

          <q-separator dark spaced class="q-my-sm" />

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

    <!-- The single AdditionalActions input dialog. Mounted here rather than in
         Page.vue because a AdditionalActionsButtons trigger can live anywhere,
         including outside a resource page. One instance serves every trigger. -->
    <AdditionalActionsDialog />
  </q-layout>
</template>

<script setup>
import MenuTreeNode from 'src/components/MenuTreeNode.vue'
import AdditionalActionsDialog from 'components/app/AdditionalActionsDialog.vue'
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
.q-drawer {
  .q-item {
    &.q-router-link--active,
    &.router-link-exact-active {
      background: rgba($secondary, 0.14) !important;
      color: $secondary !important;
      font-weight: 600;
      border-right: 2px solid $secondary;

      .q-icon {
        color: $secondary !important;
      }
    }
  }
}
</style>

