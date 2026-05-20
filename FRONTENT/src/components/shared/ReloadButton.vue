<template>
  <q-btn
    icon="refresh"
    flat
    round
    dense
    :loading="isAnyDependencySyncing"
    @click="reloadDependencies()"
  />
</template>

<script setup>
import { useResourceReload } from '../../composables/resources/useResourceReload.js'

const { isAnyDependencySyncing, reloadDependencies } = useResourceReload()
</script>
