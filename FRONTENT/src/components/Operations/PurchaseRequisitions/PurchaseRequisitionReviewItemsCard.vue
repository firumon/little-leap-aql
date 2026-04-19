<template>
  <q-card flat class="items-card q-mx-md q-mb-md">
    <div class="row items-center no-wrap q-pa-sm" style="gap:10px">
      <div class="items-icon-box">
        <q-icon name="inventory_2" size="18px" color="primary" />
      </div>
      <div class="col">
        <div class="items-title">
          Items <span class="items-count">· {{ items.length }}</span>
        </div>
        <div class="items-hint">Tap qty or rate to edit inline</div>
      </div>
      <q-btn
        unelevated icon="add" label="Add" color="primary"
        class="add-item-btn"
        @click="$emit('open-add-item')"
      />
    </div>

    <q-separator />

    <div class="q-px-sm q-py-xs">
      <div class="search-wrap row items-center no-wrap">
        <q-icon name="search" size="18px" color="grey-6" class="q-mr-xs" />
        <input
          :value="itemSearch"
          placeholder="Filter items, SKUs, variants…"
          class="search-input col"
          @input="$emit('update:itemSearch', $event.target.value)"
        />
        <q-btn
          v-if="itemSearch"
          flat round dense icon="close" size="xs" color="grey-5"
          @click="$emit('update:itemSearch', '')"
        />
      </div>
    </div>

    <q-separator />

    <div v-if="filteredItems.length === 0 && !itemSearch" class="column items-center q-py-xl">
      <q-icon name="shopping_cart" size="40px" color="grey-4" />
      <div class="text-caption text-grey-5 q-mt-xs">No items added yet</div>
      <q-btn
        outline color="primary" icon="add" label="Add First Item"
        size="sm" class="q-mt-sm"
        @click="$emit('open-add-item')"
      />
    </div>

    <div v-else-if="filteredItems.length === 0" class="column items-center q-py-lg">
      <q-icon name="search_off" size="32px" color="grey-4" />
      <div class="text-caption text-grey-5 q-mt-xs">No items match "{{ itemSearch }}"</div>
    </div>

    <div v-else>
      <div
        v-for="(item, idx) in filteredItems"
        :key="item._key || item.Code || idx"
        class="item-row"
        :class="{ 'item-row--border': idx < filteredItems.length - 1 }"
      >
        <div class="row items-start no-wrap q-mb-sm">
          <div class="col" style="min-width:0">
            <div class="item-name">
              {{ skuInfoByCode[item.SKU]?.productName || item.SKU }}
            </div>
            <div class="item-sub row items-center q-mt-xs" style="gap:6px;flex-wrap:wrap">
              <span class="sku-badge">{{ item.SKU }}</span>
              <span v-if="skuInfoByCode[item.SKU]?.variantsCsv" class="item-variants">
                · {{ skuInfoByCode[item.SKU].variantsCsv }}
              </span>
            </div>
          </div>
          <div class="row items-center" style="gap:4px;flex-shrink:0">
            <div class="item-total">
              {{ formatCurrency(item.Quantity * item.EstimatedRate) }}
            </div>
            <q-btn flat round dense icon="delete" size="sm" color="negative" @click="$emit('remove-item', idx)">
              <q-tooltip>Remove item</q-tooltip>
            </q-btn>
          </div>
        </div>

        <div class="row" style="gap:8px">
          <label class="num-field col" :class="{ 'num-field--focus': focusedField === `qty-${idx}` }">
            <q-icon name="straighten" size="14px" :style="{ color: 'var(--hero-ink-3)', flexShrink: 0 }" />
            <span class="col" style="min-width:0">
              <span class="nf-label">{{ item.UOM ? `Qty (${item.UOM})` : 'Qty' }}</span>
              <input
                v-model.number="item.Quantity"
                type="number" min="1" step="1"
                class="nf-input"
                @focus="$emit('update:focusedField', `qty-${idx}`)"
                @blur="$emit('update:focusedField', null)"
              />
            </span>
          </label>
          <label class="num-field col" :class="{ 'num-field--focus': focusedField === `rate-${idx}` }">
            <q-icon name="payments" size="14px" :style="{ color: 'var(--hero-ink-3)', flexShrink: 0 }" />
            <span class="col" style="min-width:0">
              <input
                v-model.number="item.EstimatedRate"
                type="number" min="0" step="0.01"
                class="nf-input"
                @focus="$emit('update:focusedField', `rate-${idx}`)"
                @blur="$emit('update:focusedField', null)"
              />
            </span>
          </label>
        </div>
      </div>
    </div>
  </q-card>
</template>

<script setup>
defineProps({
  items: { type: Array, required: true },
  filteredItems: { type: Array, required: true },
  itemSearch: { type: String, default: '' },
  skuInfoByCode: { type: Object, required: true },
  focusedField: { type: String, default: null },
  formatCurrency: { type: Function, required: true }
})

defineEmits(['open-add-item', 'update:itemSearch', 'update:focusedField', 'remove-item'])
</script>


