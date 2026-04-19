<template>
  <q-dialog :model-value="modelValue" position="bottom" @update:model-value="$emit('update:modelValue', $event)">
    <q-card class="add-item-dialog">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-subtitle1 text-weight-bold">Add Item</div>
        <q-space />
        <q-btn flat round dense icon="close" v-close-popup />
      </q-card-section>
      <q-card-section>
        <q-select
          v-model="newItem.SKU"
          :options="skuOptions"
          option-label="label"
          option-value="value"
          label="Select SKU *"
          outlined dense use-input input-debounce="200" clearable
          class="q-mb-sm"
          @filter="$emit('filter-skus', ...arguments)"
        >
          <template #option="scope">
            <q-item v-bind="scope.itemProps">
              <q-item-section>
                <q-item-label>{{ scope.opt.label }}</q-item-label>
                <q-item-label caption>
                  {{ scope.opt.sublabel }}{{ scope.opt.UOM ? ` · ${scope.opt.UOM}` : '' }}
                </q-item-label>
              </q-item-section>
            </q-item>
          </template>
          <template #no-option>
            <q-item>
              <q-item-section class="text-grey">No SKUs found</q-item-section>
            </q-item>
          </template>
        </q-select>
        <div class="row q-col-gutter-sm">
          <div class="col-6">
            <q-input v-model.number="newItem.Quantity" type="number" outlined dense label="Quantity *" min="1" />
          </div>
          <div class="col-6">
            <q-input v-model.number="newItem.EstimatedRate" type="number" outlined dense label="Est. Rate" min="0" step="0.01" />
          </div>
        </div>
        <div v-if="newItem.Quantity > 0" class="dialog-preview q-mt-sm">
          Est. Total: <strong>{{ formatCurrency(newItem.Quantity * newItem.EstimatedRate) }}</strong>
        </div>
      </q-card-section>
      <q-card-actions align="right" class="q-px-md q-pb-md">
        <q-btn flat label="Cancel" color="grey-7" v-close-popup />
        <q-btn
          unelevated label="Add to PR" color="primary" icon="add"
          :disable="!newItem.SKU || newItem.Quantity <= 0"
          @click="$emit('confirm-add-item')"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
defineProps({
  modelValue: { type: Boolean, required: true },
  newItem: { type: Object, required: true },
  skuOptions: { type: Array, required: true },
  formatCurrency: { type: Function, required: true }
})

defineEmits(['update:modelValue', 'filter-skus', 'confirm-add-item'])
</script>

