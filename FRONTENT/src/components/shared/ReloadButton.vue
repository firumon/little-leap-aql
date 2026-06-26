<template>
  <q-btn
    :icon="icon"
    flat
    round
    dense
    :loading="isAnyDependencySyncing"
    @click="reloadDependencies()"
  />
</template>

<script setup>
import { useResourceReload } from '../../composables/resources/useResourceReload.js'

defineProps({
  icon: { type: String, default: 'refresh' }
})

const { isAnyDependencySyncing, reloadDependencies } = useResourceReload()
</script>
