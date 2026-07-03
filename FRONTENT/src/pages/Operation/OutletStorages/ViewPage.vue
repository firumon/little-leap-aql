<template>
  <q-page padding>
    <HeaderPanel
      :title="storage?.Code || 'Outlet Stock'"
      :subtitle="storage ? `${outletLabel(storage.OutletCode)} · ${skuLabel(storage.SKU)}` : ''"
      :stats="storage ? [
        { label: 'Storage', value: storage.StorageName || '_default' },
        { label: 'Quantity', value: storage.Quantity }
      ] : []"
      class="q-mb-md"
    />

    <q-card flat bordered class="rounded-borders shadow-1 bg-white">
      <q-card-section>
        <div class="text-subtitle1 text-weight-bold text-primary q-mb-sm">Movement Timeline</div>
        <OutletMovementTimeline
          :movements="movementTimeline.filter(row => !storage || (row.OutletCode === storage.OutletCode && row.SKU === storage.SKU && (row.StorageName || '_default') === (storage.StorageName || '_default')))"
        />
      </q-card-section>
    </q-card>
  </q-page>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useOutletStock } from '../../../composables/operation/outlets/useOutletStock.js'
import HeaderPanel from '../../../components/shared/HeaderPanel.vue'
import OutletMovementTimeline from '../../../components/operation/Outlets/OutletMovementTimeline.vue'

defineOptions({ name: 'OutletStoragesViewPage' })

const route = useRoute()
const flow = useOutletStock()

const { reload, getStorage, outletLabel, skuLabel, movementTimeline } = flow

const storage = computed(() => getStorage(route.params.code))

onMounted(() => {
  reload()
})
</script>


