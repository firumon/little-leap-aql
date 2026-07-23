<template>
  <q-page>
    <Breadcrumb />
    <router-view :key="path" />
  </q-page>
</template>

<script setup>
import Breadcrumb from 'components/app/Breadcrumb.vue'
import { useRouteConfig } from 'src/composables/resources/useRouteConfig'

defineOptions({ name: 'ResourcePageShell' })

const { path } = useRouteConfig()
</script>
