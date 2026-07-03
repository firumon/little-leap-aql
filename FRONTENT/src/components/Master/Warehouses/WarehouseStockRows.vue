<template>
  <div>
    <q-card v-if="!rows.length" flat bordered class="q-mt-sm">
      <q-card-section class="text-center q-py-xl text-grey-7">
        <q-icon name="inventory_2" size="42px" color="grey-5" />
        <div class="text-subtitle1 q-mt-sm">No stock found</div>
      </q-card-section>
    </q-card>

    <q-card v-else flat bordered class="q-mt-sm">
      <q-card-section class="q-pa-sm">
        <q-table
          flat
          dense
          :rows="rows"
          :columns="columns"
          row-key="Code"
          :pagination="{ rowsPerPage: 0 }"
          hide-pagination
          class="gt-xs"
        />

        <q-list separator class="lt-sm">
          <q-item v-for="row in rows" :key="row.Code" class="q-px-none">
            <q-item-section>
              <q-item-label class="text-weight-medium">{{ row.SKU }}</q-item-label>
              <q-item-label caption>{{ row.ProductName }}</q-item-label>
              <q-item-label caption>{{ row.StorageLabel }} · {{ row.VariantCaption }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-chip dense square color="green-1" text-color="green-10">
                {{ row.QuantityValue }}
              </q-chip>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
defineProps({
  rows: {
    type: Array,
    default: () => []
  }
})

const columns = [
  { name: 'SKU', label: 'SKU', field: 'SKU', align: 'left', sortable: true },
  { name: 'ProductName', label: 'Product', field: 'ProductName', align: 'left', sortable: true },
  { name: 'VariantCaption', label: 'Variant', field: 'VariantCaption', align: 'left' },
  { name: 'StorageLabel', label: 'Storage', field: 'StorageLabel', align: 'left', sortable: true },
  { name: 'QuantityValue', label: 'Qty', field: 'QuantityValue', align: 'right', sortable: true }
]
</script>
