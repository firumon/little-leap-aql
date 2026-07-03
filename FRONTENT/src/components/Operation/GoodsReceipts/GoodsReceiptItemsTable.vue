<template>
  <q-markup-table flat bordered class="rounded-borders overflow-hidden">
    <thead>
      <tr><th class="text-left">SKU</th><th class="text-left">Receiving Item</th><th class="text-right">Accepted Qty</th></tr>
    </thead>
    <tbody>
      <tr v-for="item in items" :key="item.Code">
        <td>{{ item.SKU }}</td>
        <td>{{ item.POReceivingItemCode }}</td>
        <td class="text-right text-weight-bold">{{ item.Qty }}</td>
      </tr>
    </tbody>
  </q-markup-table>
</template>

<script setup>
defineProps({ items: { type: Array, default: () => [] } })
</script>
