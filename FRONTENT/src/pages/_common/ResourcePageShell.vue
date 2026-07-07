<template>
  <q-page>
    <ResourceBreadcrumb />
    <router-view :key="path" />
  </q-page>
</template>

<script setup>
import ResourceBreadcrumb from 'components/_common/sections/ResourceBreadcrumb.vue'
import { useRouteConfig } from 'src/composables/resources/useRouteConfig'

defineOptions({ name: 'ResourcePageShell' })

const { path } = useRouteConfig()
</script>
