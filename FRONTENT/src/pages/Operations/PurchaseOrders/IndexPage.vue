<template>
  <q-page padding>
    <div class="row items-center q-mb-md">
      <div class="text-h6">Purchase Orders</div>
      <q-space />
      <q-input
        v-model="searchTerm"
        dense
        outlined
        placeholder="Search POs..."
        class="q-mr-md"
        style="max-width: 300px"
      >
        <template v-slot:append>
          <q-icon name="search" />
        </template>
      </q-input>
      <q-btn icon="refresh" flat round color="primary" @click="reload" :loading="loading" />
    </div>

    <div v-if="loading && items.length === 0" class="flex flex-center q-py-xl">
      <q-spinner color="primary" size="3em" />
    </div>

    <div v-else-if="groups.length === 0" class="text-center q-pa-xl text-grey">
      <q-icon name="receipt_long" size="4em" color="grey-4" class="q-mb-sm" />
      <div class="text-h6 text-grey-6">No Purchase Orders Found</div>
      <div class="text-body2">Try adjusting your search or create a new one.</div>
    </div>

    <div v-else>
      <q-list class="q-gutter-y-sm">
        <q-expansion-item
          v-for="group in groups"
          :key="group.name"
          :label="group.name"
          :caption="`${group.items.length} items`"
          header-class="bg-grey-2 text-weight-bold"
          :default-opened="isGroupExpanded(group.name)"
          @update:model-value="toggleGroup(group.name)"
          class="shadow-1 rounded-borders overflow-hidden"
        >
          <q-card>
            <q-card-section class="q-pa-none">
              <q-list separator>
                <q-item
                  v-for="po in group.items"
                  :key="po.Code"
                  clickable
                  v-ripple
                  @click="navigateTo(po.Code)"
                >
                  <q-item-section>
                    <q-item-label class="text-weight-medium">{{ po.Code }}</q-item-label>
                    <q-item-label caption lines="1">
                      {{ supplierName(po.SupplierCode) }}
                    </q-item-label>
                    <q-item-label caption lines="1">
                      Quotation: {{ po.SupplierQuotationCode }} | Date: {{ formatDate(po.PODate) }}
                    </q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-item-label class="text-weight-bold text-primary">
                      {{ formatCurrency(po.TotalAmount, po.Currency) }}
                    </q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-card-section>
          </q-card>
        </q-expansion-item>
      </q-list>
    </div>

    <q-page-sticky position="bottom-right" :offset="[18, 18]">
      <q-btn v-if="permissions.canWrite" fab icon="add" color="primary" @click="navigateToAdd" />
    </q-page-sticky>
  </q-page>
</template>

<script>
import { defineComponent, onMounted } from 'vue';
import { usePurchaseOrderIndex } from '../../../composables/operations/purchaseOrders/usePurchaseOrderIndex.js';

export default defineComponent({
  name: 'PurchaseOrdersIndexPage',
  setup() {
    const poIndex = usePurchaseOrderIndex();

    onMounted(() => {
      poIndex.reload();
    });

    return {
      ...poIndex
    };
  }
});
</script>
