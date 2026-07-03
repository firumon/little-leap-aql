<template>
  <component :is="resolvedComponent" v-if="resolvedComponent" />
  <q-card v-else-if="notFound" flat bordered class="page-card">
    <q-card-section class="text-center q-py-xl">
      <q-icon name="search_off" size="48px" color="grey-5" />
      <div class="text-subtitle1 text-grey-7 q-mt-md">Page not found</div>
    </q-card-section>
  </q-card>
  <div v-else class="resolver-loading">
    <q-spinner-dots color="primary" size="32px" />
  </div>
</template>

<script setup>
import { usePageResolver } from 'src/composables/resources/usePageResolver'

const { resolvedComponent, notFound } = usePageResolver()
</script>

<style scoped>
.resolver-loading {
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}
</style>
