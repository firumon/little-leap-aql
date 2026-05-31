<template>
  <q-page padding class="q-pb-xl">
    <!-- Header panel -->
    <div class="bg-white q-pa-md shadow-1 q-mb-md">
      <div class="row items-center q-gutter-x-sm">
        <q-btn flat round icon="arrow_back" color="dark" @click="cancel" />
        <div>
          <div class="text-h6 text-weight-bold text-primary">Log Outlet Return</div>
          <div class="text-caption text-grey-7">Observe stock changes and log returns.</div>
        </div>
      </div>
      <q-separator class="q-mt-sm" />
    </div>

    <!-- Scrollable Form Content -->
    <q-card flat bordered class="bg-white q-pa-md shadow-sm">
      <div class="q-gutter-y-lg">
        <!-- Step 1: Select Outlet -->
        <div>
          <div class="text-subtitle2 text-weight-bold text-dark q-mb-xs row items-center">
            <q-icon name="storefront" color="primary" size="18px" class="q-mr-xs" />
            <span>Select Outlet</span>
          </div>
          <div class="row q-col-gutter-sm">
            <div class="col-12">
              <q-select
                v-model="form.OutletCode"
                :options="outletOptions"
                emit-value
                map-options
                outlined
                label="Select Outlet *"
              />
            </div>
          </div>
        </div>

        <q-separator />

        <!-- Step 2: SKU and Qty -->
        <div>
          <div class="text-subtitle2 text-weight-bold text-dark q-mb-xs row items-center">
            <q-icon name="inventory_2" color="primary" size="18px" class="q-mr-xs" />
            <span>Item & Quantity</span>
          </div>
          <div class="row q-col-gutter-sm">
            <div class="col-12">
              <q-select
                v-model="form.SKU"
                :options="skuOptions"
                emit-value
                map-options
                outlined
                use-input
                fill-input
                hide-selected
                input-debounce="100"
                label="Select SKU *"
                class="full-width"
              />
            </div>
            <div class="col-12">
              <q-input
                v-model.number="form.Qty"
                type="number"
                outlined
                label="Returned Quantity *"
                min="1"
                :rules="[val => val > 0 || 'Quantity must be positive']"
              />
            </div>
          </div>
        </div>

        <q-separator />

        <!-- Step 3: Operational Flags -->
        <div>
          <div class="text-subtitle2 text-weight-bold text-dark q-mb-sm row items-center">
            <q-icon name="settings" color="primary" size="18px" class="q-mr-xs" />
            <span>Return Settings (Flags)</span>
          </div>

          <div class="q-gutter-y-md">
            <!-- Invoice Adjustment Toggle -->
            <q-card flat bordered class="bg-blue-1 q-pa-sm">
              <div class="row items-center justify-between no-wrap">
                <div class="column q-mr-sm">
                  <span class="text-subtitle2 text-weight-bold text-primary row items-center">
                    <q-icon name="receipt_long" class="q-mr-xs" />
                    Invoice Adjustment Required?
                  </span>
                  <span class="text-caption text-grey-8">
                    Select YES if this return requires a credit adjustment on the next outlet invoice (for stock already invoiced to the outlet).
                  </span>
                </div>
                <q-toggle
                  v-model="form.InvoiceAdjustmentRequired"
                  checked-icon="check"
                  unchecked-icon="clear"
                  color="primary"
                  size="lg"
                />
              </div>
            </q-card>

            <!-- Warehouse Action Toggle -->
            <q-card flat bordered class="bg-purple-1 q-pa-sm">
              <div class="row items-center justify-between no-wrap">
                <div class="column q-mr-sm">
                  <span class="text-subtitle2 text-weight-bold text-purple row items-center">
                    <q-icon name="local_shipping" class="q-mr-xs" />
                    Is Stock Leaving Outlet?
                  </span>
                  <span class="text-caption text-grey-8">
                    Select YES if the physical stock is removed from the outlet shelf (returned to central warehouse or written off).
                  </span>
                </div>
                <q-toggle
                  v-model="form.WarehouseActionRequired"
                  checked-icon="check"
                  unchecked-icon="clear"
                  color="purple"
                  size="lg"
                />
              </div>
            </q-card>
          </div>
        </div>

        <!-- Dynamic Warehouse Selector -->
        <transition
          enter-active-class="animated fadeIn"
          leave-active-class="animated fadeOut"
        >
          <div v-if="form.WarehouseActionRequired" class="q-mt-md">
            <div class="text-subtitle2 text-weight-bold text-dark q-mb-xs row items-center">
              <q-icon name="warehouse" color="purple" size="18px" class="q-mr-xs" />
              <span>Target Central Warehouse *</span>
            </div>
            <q-select
              v-model="form.WarehouseCode"
              :options="warehouseOptions"
              emit-value
              map-options
              outlined
              label="Select Central Warehouse *"
            />
          </div>
        </transition>

        <q-separator />

        <!-- Step 4: Reason -->
        <div>
          <div class="text-subtitle2 text-weight-bold text-dark q-mb-xs row items-center">
            <q-icon name="live_help" color="primary" size="18px" class="q-mr-xs" />
            <span>Reason for Return</span>
          </div>
          <div class="q-gutter-y-sm">
            <q-select
              v-model="form.Reason"
              :options="reasonOptions"
              emit-value
              map-options
              outlined
              label="Reason Category *"
            />
            <q-input
              v-model="form.ReasonComment"
              outlined
              type="textarea"
              placeholder="Describe details, condition, batch code, or other reasons..."
              label="Reason Description / Notes"
            />
          </div>
        </div>
      </div>
    </q-card>

    <!-- Bottom Submit Actions -->
    <q-separator />
    <div class="row items-center justify-between q-mt-lg q-pa-md bg-white shadow-up-1">
      <q-btn flat color="grey-7" label="Cancel" @click="cancel" />
      <q-btn
        unelevated
        color="primary"
        icon="check"
        label="Submit Return"
        :loading="saving"
        @click="saveReturn"
      />
    </div>
  </q-page>
</template>

<script setup>
import { onMounted } from 'vue'
import { useOutletReturns } from '../../../composables/operations/outlets/useOutletReturns.js'

defineOptions({ name: 'OutletReturnsAddPage' })

const flow = useOutletReturns()
const {
  saving,
  form,
  outletOptions,
  skuOptions,
  warehouseOptions,
  reasonOptions,
  reload,
  saveReturn,
  cancel
} = flow

onMounted(() => {
  reload()
})
</script>


