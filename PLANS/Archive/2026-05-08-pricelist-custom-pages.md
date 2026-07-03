# PLAN: PriceList Custom Index & Add Pages
**Status**: COMPLETED
**Created**: 2026-05-08
**Created By**: Brain Agent (claude)
**Executed By**: Build Agent (Codex)

## Objective

Create two entity-level custom pages for the PriceList master resource, plus two shared composables. The Index page shows expandable PriceList cards with inline-editable header fields and a per-section grouped product/SKU price table. The Add page shows a create form with the same full product/SKU listing. Both pages respect the `PriceListLookup` config key (INLINE vs ITEMS) for data persistence without any UI difference.

## Context

- PriceList resource is already defined in `GAS/syncAppResources.gs:144-176`. Route `/master/price-lists`, scope `master`, menu group `Product`.
- PriceListItems child resource (ParentResource: PriceList) at `GAS/syncAppResources.gs:177-208`. Composite unique on `PriceListCode + SKUCode`.
- `App.Config.PriceListLookup` key (`INLINE` or `ITEMS`) is present in `APP.Config` sheet and arrives in login response `data.result.appConfig`.
- Frontend reads config via `authStore.appConfigMap`.
- All master data is loaded into `dataStore` (Pinia) reactively. Composables read from store, never call APIs directly.
- Products IndexPage (`FRONTENT/src/pages/master/Products/IndexPage.vue`) is the closest reference pattern — it loads Products + SKUs, computes SKU counts, and has a FAB for add navigation.
- `ActionResolverPage.vue` auto-discovers entity-level pages via `import.meta.glob('./*/\*\*Page.vue')`. A new `PriceLists/IndexPage.vue` and `PriceLists/AddPage.vue` will be auto-resolved at tier 2 (entity-custom).
- **workflowStore** canonical mutation methods (verified from `FRONTENT/src/stores/workflow.js:92-108`):
  - `createResourceRecord(resourceName, record)` — create a single record
  - `updateResourceRecord(resourceName, code, record)` — update a single record by code
  - `saveComposite(payload)` — composite parent+children save
  - `uploadBulkRecords(resourceName, records)` — bulk upsert an array of `{ _action, data, _originalCode? }` records
- **dataStore** handles reading/loading/caching only. It does NOT have `createRecord` or `updateRecord`. All mutations go through `workflowStore`.

## Pre-Conditions

- [x] PriceList and PriceListItems sheets exist in the master spreadsheet (confirmed by user).
- [x] `syncAppResources.gs` has PriceList + PriceListItems resource definitions with correct headers.
- [x] User has login access that includes `canRead` + `canWrite` on PriceList resource.
- [x] `Documents/ARCHITECTURE RULES.md` reviewed (mandatory pre-read for frontend files).

## Steps

### Step 1: Create Composable `usePriceListEditor.js`

**File**: `FRONTENT/src/composables/master/priceLists/usePriceListEditor.js`

#### 1.1 Imports

Use EXACTLY these imports — do not add, remove, or rename:

```js
import { ref, computed } from 'vue'
import { useAuthStore } from 'src/stores/auth'
import { useDataStore } from 'src/stores/data'
import { useWorkflowStore } from 'src/stores/workflow'
import { parseVariantTypes } from 'src/composables/master/products/useProductVariants'
```

**Rule**: Composables MUST NOT import services directly. All API/IDB operations flow through stores.

#### 1.2 Export signature

```js
export function usePriceListEditor()
```

No parameters. The composable reads from stores autonomously.

#### 1.3 Reactive state — declare after store instances

```js
const expandedCode = ref('')
const editingHeader = ref(null)
const dirtyPrices = ref({})
const saving = ref(false)
const headerOriginal = ref({})
```

| Variable | Type | Purpose |
|---|---|---|
| `expandedCode` | `ref('')` | Currently expanded PriceList Code; empty = none |
| `editingHeader` | `ref(null)` | Live reference to the expanded PriceList store row object |
| `dirtyPrices` | `ref({})` | `{ 'SKU001': 12.50, 'SKU002': '' }` — user's in-progress price edits |
| `saving` | `ref(false)` | In-flight save flag |
| `headerOriginal` | `ref({})` | Snapshot at expand time for dirty detection |

#### 1.4 Store instances

```js
const authStore = useAuthStore()
const dataStore = useDataStore()
const workflowStore = useWorkflowStore()
```

#### 1.5 Config — read `PriceListLookup`

```js
const priceListLookupMode = computed(() => {
  const val = authStore.appConfigMap?.PriceListLookup
  return val === 'ITEMS' ? 'ITEMS' : 'INLINE'
})
```

#### 1.6 Data from Pinia store

```js
const priceListRecords = computed(() => dataStore.getRecords('PriceList'))
const priceListItemsRows = computed(() => dataStore.getRecords('PriceListItems'))
const productRows = computed(() => dataStore.getRecords('Products'))
const skuRows = computed(() => dataStore.getRecords('SKUs'))
```

**Rule**: The composable READS from the store only. It does NOT trigger data loads. The IndexPage triggers loads via `useResourceData`.

#### 1.7 Product lookup map

```js
const productByCode = computed(() => {
  const map = {}
  for (const p of productRows.value) {
    if (p.Status === 'Inactive') continue
    map[p.Code] = p
  }
  return map
})
```

#### 1.8 SKU lookup map

```js
const skusByProductCode = computed(() => {
  const map = {}
  for (const s of skuRows.value) {
    if (s.Status === 'Inactive') continue
    const pc = s.ProductCode
    if (!map[pc]) map[pc] = []
    map[pc].push(s)
  }
  return map
})
```

#### 1.9 Price lookup map — mode-aware

```js
const priceMapBySkuCode = computed(() => {
  const code = expandedCode.value
  if (!code) return {}

  if (priceListLookupMode.value === 'ITEMS') {
    const map = {}
    for (const item of priceListItemsRows.value) {
      if (item.PriceListCode !== code) continue
      if (item.Status === 'Inactive') continue
      const p = parseFloat(item.Price)
      map[item.SKUCode] = isNaN(p) ? '' : p
    }
    return map
  }

  // INLINE mode: parse SKUPrices JSON
  const pl = priceListRecords.value.find((r) => r.Code === code)
  if (!pl || !pl.SKUPrices) return {}
  try {
    const parsed = JSON.parse(pl.SKUPrices)
    const map = {}
    for (const [skuCode, price] of Object.entries(parsed)) {
      const p = parseFloat(price)
      map[skuCode] = isNaN(p) ? '' : p
    }
    return map
  } catch {
    return {}
  }
})
```

#### 1.10 Expanded SKU list — flat, sorted

```js
const expandedSkus = computed(() => {
  const result = []
  const products = Object.values(productByCode.value)
  products.sort((a, b) => (a.Name || '').localeCompare(b.Name || ''))

  for (const product of products) {
    const skus = skusByProductCode.value[product.Code] || []
    const variants = parseVariantTypes(product.VariantTypes || '')

    for (const sku of skus) {
      const variantParts = variants
        .map((v) => (sku[v.key] || '').toString().trim())
        .filter(Boolean)
      const variantLabel = variantParts.length ? variantParts.join(', ') : sku.Code

      result.push({
        productCode: product.Code,
        productName: product.Name || '(Unnamed)',
        skuCode: sku.Code,
        variantLabel,
        price: priceMapBySkuCode.value[sku.Code] ?? ''
      })
    }
  }
  return result
})
```

#### 1.11 Grouped for template rendering

```js
const groupedSkus = computed(() => {
  const groups = []
  let cur = null
  for (const e of expandedSkus.value) {
    if (!cur || cur.productCode !== e.productCode) {
      cur = { productCode: e.productCode, productName: e.productName, skus: [] }
      groups.push(cur)
    }
    cur.skus.push({ skuCode: e.skuCode, variantLabel: e.variantLabel, price: e.price })
  }
  return groups
})
```

#### 1.12 Header dirty detection

```js
const headerChanged = computed(() => {
  if (!editingHeader.value || !headerOriginal.value) return false
  const fields = ['Name', 'Description', 'Currency', 'IsDefault', 'Status']
  return fields.some((f) => {
    const cur = (editingHeader.value[f] ?? '').toString().trim()
    const orig = (headerOriginal.value[f] ?? '').toString().trim()
    return cur !== orig
  })
})
```

#### 1.13 Expand / Collapse / Toggle

```js
function expandPriceList(code) {
  const pl = priceListRecords.value.find((r) => r.Code === code)
  if (!pl) return

  headerOriginal.value = {
    Name: pl.Name || '',
    Description: pl.Description || '',
    Currency: pl.Currency || '',
    IsDefault: pl.IsDefault || 'FALSE',
    Status: pl.Status || 'Active'
  }
  editingHeader.value = pl
  expandedCode.value = code
  dirtyPrices.value = { ...priceMapBySkuCode.value }
  saving.value = false
}

function collapsePriceList() {
  expandedCode.value = ''
  editingHeader.value = null
  dirtyPrices.value = {}
  headerOriginal.value = {}
}

function togglePriceList(code) {
  if (expandedCode.value === code) collapsePriceList()
  else expandPriceList(code)
}
```

**Rule**: `editingHeader.value` directly references the store row object. Mutations via `updateHeaderField` are reactive against the store.

#### 1.14 Header field update

```js
function updateHeaderField(header, value) {
  if (!editingHeader.value) return
  editingHeader.value[header] = value
}
```

#### 1.15 Price field update (bound to input)

```js
function updatePriceField(skuCode, value) {
  if (!expandedCode.value) return
  if (value !== '' && value !== null && value !== undefined) {
    const num = parseFloat(value)
    if (isNaN(num)) return
    dirtyPrices.value = { ...dirtyPrices.value, [skuCode]: num }
  } else {
    dirtyPrices.value = { ...dirtyPrices.value, [skuCode]: '' }
  }
}

function getPrice(skuCode) {
  return dirtyPrices.value[skuCode] ?? ''
}
```

#### 1.16 Save section — mode-aware orchestration

```js
async function saveSection() {
  if (!expandedCode.value) return
  saving.value = true
  try {
    if (headerChanged.value && editingHeader.value) {
      await workflowStore.updateResourceRecord('PriceList', expandedCode.value, {
        Name: editingHeader.value.Name,
        Description: editingHeader.value.Description,
        Currency: editingHeader.value.Currency,
        IsDefault: editingHeader.value.IsDefault,
        Status: editingHeader.value.Status
      })
    }

    if (priceListLookupMode.value === 'ITEMS') {
      await _savePricesViaItems()
    } else {
      await _savePricesViaInline()
    }

    // Update snapshot
    if (editingHeader.value) {
      headerOriginal.value = {
        Name: editingHeader.value.Name || '',
        Description: editingHeader.value.Description || '',
        Currency: editingHeader.value.Currency || '',
        IsDefault: editingHeader.value.IsDefault || 'FALSE',
        Status: editingHeader.value.Status || 'Active'
      }
    }
  } finally {
    saving.value = false
  }
}
```

#### 1.17 `_savePricesViaItems()` — ITEMS mode

```js
async function _savePricesViaItems() {
  const code = expandedCode.value

  const existing = {}
  for (const item of priceListItemsRows.value) {
    if (item.PriceListCode !== code || item.Status === 'Inactive') continue
    existing[item.SKUCode] = item
  }

  const records = []
  for (const [skuCode, price] of Object.entries(dirtyPrices.value)) {
    if (price === '' || price === null || price === undefined) continue
    const ex = existing[skuCode]
    if (ex) {
      const num = parseFloat(price)
      const old = parseFloat(ex.Price)
      if (isNaN(num)) continue
      if (num !== old || isNaN(old)) {
        records.push({ _action: 'update', _originalCode: ex.Code, data: { Price: num } })
      }
    } else {
      const num = parseFloat(price)
      if (isNaN(num)) continue
      records.push({
        _action: 'create',
        data: { PriceListCode: code, SKUCode: skuCode, Price: num, Status: 'Active' }
      })
    }
  }

  if (!records.length) return
  await workflowStore.uploadBulkRecords('PriceListItems', records)
}
```

#### 1.18 `_savePricesViaInline()` — INLINE mode

```js
async function _savePricesViaInline() {
  const code = expandedCode.value
  const priceObj = {}
  for (const [skuCode, price] of Object.entries(dirtyPrices.value)) {
    const num = parseFloat(price)
    if (!isNaN(num)) priceObj[skuCode] = num
  }

  await workflowStore.updateResourceRecord('PriceList', code, {
    SKUPrices: JSON.stringify(priceObj)
  })
}
```

#### 1.19 Return

```js
return {
  expandedCode,
  editingHeader,
  dirtyPrices,
  headerChanged,
  saving,
  priceListLookupMode,
  groupedSkus,
  togglePriceList,
  expandPriceList,
  collapsePriceList,
  updateHeaderField,
  updatePriceField,
  getPrice,
  saveSection
}
```

**File size target**: ~220 lines max.

---

### Step 2: Create Composable `usePriceListCreateForm.js`

**File**: `FRONTENT/src/composables/master/priceLists/usePriceListCreateForm.js`

#### 2.1 Imports

```js
import { ref, computed, reactive } from 'vue'
import { useAuthStore } from 'src/stores/auth'
import { useDataStore } from 'src/stores/data'
import { useWorkflowStore } from 'src/stores/workflow'
import { parseVariantTypes } from 'src/composables/master/products/useProductVariants'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
```

#### 2.2 Export

```js
export function usePriceListCreateForm()
```

#### 2.3 Store instances

```js
const authStore = useAuthStore()
const dataStore = useDataStore()
const workflowStore = useWorkflowStore()
const nav = useResourceNav()
```

#### 2.4 Reactive state

```js
const form = reactive({ Name: '', Description: '', Currency: '', IsDefault: 'FALSE', Status: 'Active' })
const saving = ref(false)
const prices = reactive({})
```

**Rule**: `prices` is a plain reactive object `{}` keyed by SKUCode. When the user types a price, `prices[skuCode]` is set to the numeric value or `''`.

#### 2.5 Config

```js
const priceListLookupMode = computed(() => {
  const val = authStore.appConfigMap?.PriceListLookup
  return val === 'ITEMS' ? 'ITEMS' : 'INLINE'
})
```

#### 2.6 Data from store

```js
const productRows = computed(() => dataStore.getRecords('Products'))
const skuRows = computed(() => dataStore.getRecords('SKUs'))
```

#### 2.7 Product/SKU lookup maps

Copy the EXACT same logic from Step 1.7 and 1.8 — `productByCode` and `skusByProductCode`. Define them inline (do NOT import from `usePriceListEditor`).

#### 2.8 Grouped SKU listing

```js
const groupedSkus = computed(() => {
  const groups = []
  const products = Object.values(productByCode.value)
  products.sort((a, b) => (a.Name || '').localeCompare(b.Name || ''))

  for (const product of products) {
    const skus = skusByProductCode.value[product.Code] || []
    if (!skus.length) continue
    const variants = parseVariantTypes(product.VariantTypes || '')
    const skuEntries = skus.map((sku) => {
      const variantParts = variants
        .map((v) => (sku[v.key] || '').toString().trim())
        .filter(Boolean)
      const variantLabel = variantParts.length ? variantParts.join(', ') : sku.Code
      return { skuCode: sku.Code, variantLabel, price: prices[sku.Code] ?? '' }
    })
    groups.push({ productCode: product.Code, productName: product.Name || '(Unnamed)', skus: skuEntries })
  }
  return groups
})
```

**Rule**: Products with zero active SKUs are skipped (`if (!skus.length) continue`). This is different from the Index page where products with zero SKUs are still shown (no price input needed in add form for empty products).

#### 2.9 Helpers

```js
function updatePrice(skuCode, value) {
  if (value !== '' && value !== null && value !== undefined) {
    const num = parseFloat(value)
    if (isNaN(num)) return
    prices[skuCode] = num
  } else {
    prices[skuCode] = ''
  }
}

function navigateBack() {
  nav.goTo('list')
}

function getPrice(skuCode) {
  return prices[skuCode] ?? ''
}
```

#### 2.10 Validation

```js
function validateForm() {
  if (!(form.Name || '').trim()) return 'Name is required'
  if (!(form.Currency || '').trim()) return 'Currency is required'
  return null
}
```

**Rule**: Returns a string error message or `null`. The page handles notification display.

#### 2.11 Save orchestration

```js
async function handleSave() {
  const error = validateForm()
  if (error) return { success: false, error }

  saving.value = true
  try {
    if (priceListLookupMode.value === 'ITEMS') {
      return await _saveAsItems()
    }
    return await _saveAsInline()
  } finally {
    saving.value = false
  }
}
```

#### 2.12 `_saveAsItems()` — ITEMS mode (composite save)

```js
async function _saveAsItems() {
  const childRecords = []
  for (const [skuCode, price] of Object.entries(prices)) {
    const num = parseFloat(price)
    if (isNaN(num)) continue
    childRecords.push({
      _action: 'create',
      data: { SKUCode: skuCode, Price: num, Status: 'Active' }
    })
  }

  const payload = {
    action: 'compositeSave',
    scope: 'master',
    resource: 'PriceList',
    data: {
      Name: (form.Name || '').trim(),
      Description: (form.Description || '').trim(),
      Currency: (form.Currency || '').trim(),
      IsDefault: form.IsDefault || 'FALSE',
      Status: form.Status || 'Active'
    }
  }

  if (childRecords.length) {
    payload.children = [{ resource: 'PriceListItems', records: childRecords }]
  }

  const result = await workflowStore.saveComposite(payload)
  return result
}
```

**Rule**: Child `PriceListCode` is NOT set in child records — the backend compositeSave handler assigns the new parent Code to child records automatically (matching `useCompositeForm.buildPayload` pattern).

#### 2.13 `_saveAsInline()` — INLINE mode (single record create)

```js
async function _saveAsInline() {
  const priceObj = {}
  for (const [skuCode, price] of Object.entries(prices)) {
    const num = parseFloat(price)
    if (!isNaN(num)) priceObj[skuCode] = num
  }

  const record = {
    Name: (form.Name || '').trim(),
    Description: (form.Description || '').trim(),
    Currency: (form.Currency || '').trim(),
    IsDefault: form.IsDefault || 'FALSE',
    Status: form.Status || 'Active',
    SKUPrices: JSON.stringify(priceObj)
  }

  return await workflowStore.createResourceRecord('PriceList', record)
}
```

#### 2.14 Return

```js
return {
  form,
  saving,
  prices,
  priceListLookupMode,
  groupedSkus,
  updatePrice,
  getPrice,
  handleSave,
  navigateBack
}
```

**File size target**: ~160 lines max.

---

### Step 3: Create Page `PriceLists/IndexPage.vue`

**File**: `FRONTENT/src/pages/master/PriceLists/IndexPage.vue`

#### 3.1 Template structure (THIN — no business logic)

```html
<template>
  <div class="index-page">
    <!-- Header bar: title, count, reload -->
    <MasterListHeader
      :config="config"
      :filtered-count="displayedItems.length"
      :total-count="items.length"
      :loading="loading"
      :background-syncing="backgroundSyncing"
      @reload="reloadAll(true)"
    />

    <!-- Search toolbar -->
    <MasterListToolbar
      :search-term="searchTerm"
      @update:search-term="searchTerm = $event"
    />

    <!-- PriceList cards -->
    <q-card flat bordered class="records-card q-mt-sm">
      <!-- Loading spinner -->
      <q-card-section v-if="loading" class="q-py-xl text-center">
        <q-spinner-dots color="primary" size="32px" />
      </q-card-section>

      <!-- Empty state -->
      <q-card-section v-else-if="!displayedItems.length" class="q-py-xl text-center">
        <q-icon name="sell" size="48px" color="grey-5" />
        <div class="text-subtitle1 text-grey-7 q-mt-md">No price lists found</div>
      </q-card-section>

      <!-- PriceList list -->
      <q-card-section v-else class="q-pa-sm q-pa-md">
        <div class="column q-gutter-sm">
          <q-card
            v-for="row in displayedItems"
            :key="row.Code"
            flat bordered
            class="pl-card"
          >
            <!-- Collapsed row: clickable header -->
            <q-card-section
              class="q-pa-sm q-pa-md cursor-pointer"
              @click="editor.togglePriceList(row.Code)"
            >
              <div class="row items-center no-wrap">
                <div class="col">
                  <div class="text-caption text-grey-6">{{ row.Code }}</div>
                  <div class="text-subtitle1 text-weight-bold">{{ row.Name || '(Unnamed)' }}</div>
                  <div class="row q-gutter-xs q-mt-xs">
                    <q-badge outline :color="row.Status === 'Active' ? 'positive' : 'grey-6'">
                      {{ row.Status || 'Active' }}
                    </q-badge>
                    <q-badge v-if="row.Currency" outline color="primary">{{ row.Currency }}</q-badge>
                    <q-badge v-if="row.IsDefault === 'TRUE'" outline color="orange">Default</q-badge>
                  </div>
                </div>
                <q-icon
                  :name="editor.expandedCode.value === row.Code ? 'expand_less' : 'expand_more'"
                  color="grey-6"
                />
              </div>
            </q-card-section>

            <!-- Expanded section -->
            <q-slide-transition>
              <div v-if="editor.expandedCode.value === row.Code">
                <q-separator />
                <q-card-section class="q-pa-sm q-pa-md">
                  <!-- Editable header fields -->
                  <div class="text-subtitle2 text-weight-medium q-mb-sm">Price List Details</div>
                  <div class="row q-col-gutter-sm q-mb-md">
                    <div class="col-12 col-md-6">
                      <q-input v-model="editor.editingHeader.value.Name" outlined dense label="Name *" />
                    </div>
                    <div class="col-12 col-md-6">
                      <q-select
                        :model-value="editor.editingHeader.value.Status"
                        outlined dense emit-value map-options
                        :options="[{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }]"
                        label="Status"
                        @update:model-value="editor.updateHeaderField('Status', $event)"
                      />
                    </div>
                    <div class="col-12 col-md-6">
                      <q-input v-model="editor.editingHeader.value.Currency" outlined dense label="Currency *" />
                    </div>
                    <div class="col-12 col-md-6">
                      <q-select
                        :model-value="editor.editingHeader.value.IsDefault"
                        outlined dense emit-value map-options
                        :options="[{ label: 'Yes', value: 'TRUE' }, { label: 'No', value: 'FALSE' }]"
                        label="Is Default"
                        @update:model-value="editor.updateHeaderField('IsDefault', $event)"
                      />
                    </div>
                    <div class="col-12">
                      <q-input
                        v-model="editor.editingHeader.value.Description"
                        outlined dense type="textarea" autogrow label="Description"
                      />
                    </div>
                  </div>

                  <!-- Grouped SKU price table -->
                  <div class="text-subtitle2 text-weight-medium q-mb-sm">SKU Prices</div>
                  <div v-for="group in editor.groupedSkus.value" :key="group.productCode" class="q-mb-md">
                    <div class="text-weight-medium text-grey-8 q-mb-xs">{{ group.productName }}</div>
                    <div class="row q-col-gutter-sm">
                      <div
                        v-for="sku in group.skus"
                        :key="sku.skuCode"
                        class="col-12 col-md-6 col-lg-4"
                      >
                        <q-input
                          :model-value="editor.getPrice(sku.skuCode)"
                          outlined dense
                          type="number"
                          step="0.01"
                          :label="sku.variantLabel"
                          @update:model-value="editor.updatePriceField(sku.skuCode, $event)"
                        />
                      </div>
                    </div>
                  </div>

                  <!-- Per-section actions -->
                  <div class="row justify-end q-mt-sm q-gutter-sm">
                    <q-btn flat no-caps label="Cancel" @click="editor.collapsePriceList()" />
                    <q-btn
                      color="primary" unelevated no-caps
                      label="Save" :loading="editor.saving.value"
                      :disable="!editor.headerChanged.value"
                      @click="handleSave"
                    />
                  </div>
                </q-card-section>
              </div>
            </q-slide-transition>
          </q-card>
        </div>
      </q-card-section>
    </q-card>

    <!-- FAB -->
    <q-page-sticky position="bottom-right" :offset="[16, 22]" class="fab-sticky">
      <q-btn
        v-if="permissions.canWrite"
        round unelevated icon="add" color="primary" class="fab-btn"
        @click="navigateToAdd"
      >
        <q-tooltip>Add Price List</q-tooltip>
      </q-btn>
    </q-page-sticky>
  </div>
</template>
```

#### 3.2 Script

```js
<script setup>
import { computed, watch, ref } from 'vue'
import { useQuasar } from 'quasar'
import MasterListHeader from 'components/master/_common/MasterListHeader.vue'
import MasterListToolbar from 'components/master/_common/MasterListToolbar.vue'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useResourceData } from 'src/composables/resources/useResourceData'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { usePriceListEditor } from 'src/composables/master/priceLists/usePriceListEditor'

const $q = useQuasar()
const nav = useResourceNav()
const { config, resourceName, permissions } = useResourceConfig()
const { items, loading, backgroundSyncing, searchTerm, reload } = useResourceData(resourceName)

const editor = usePriceListEditor()

async function reloadAll(forceSync = false) {
  await reload(forceSync)
  // Also ensure Products, SKUs, PriceListItems are loaded (useResourceData for each)
}

// Trigger load on mount + ensure dependent resources are loaded
watch(() => resourceName.value, async (name) => {
  if (!name) return
  await reloadAll()
}, { immediate: true })

// Data loading for dependent resources (Products, SKUs, PriceListItems)
// Use useResourceData for each, call reload on mount
const productsResource = useResourceData(ref('Products'))
const skusResource = useResourceData(ref('SKUs'))
const priceListItemsResource = useResourceData(ref('PriceListItems'))

watch(() => resourceName.value, async (name) => {
  if (!name) return
  await Promise.all([
    productsResource.reload(),
    skusResource.reload(),
    priceListItemsResource.reload()
  ])
}, { immediate: true })

const displayedItems = computed(() => {
  const keyword = (searchTerm.value || '').toString().trim().toLowerCase()
  if (!keyword) return items.value
  return items.value.filter((row) => {
    const aggregate = Object.values(row || {})
      .map((v) => (v ?? '').toString().toLowerCase())
      .join(' ')
    return aggregate.includes(keyword)
  })
})

function navigateToAdd() {
  nav.goTo('add')
}

async function handleSave() {
  try {
    await editor.saveSection()
    $q.notify({ type: 'positive', message: 'Saved', timeout: 1800 })
  } catch (err) {
    $q.notify({ type: 'negative', message: `Save failed: ${err.message || 'Unknown error'}`, timeout: 3000 })
  }
}
</script>
```

#### 3.3 Styles

```css
<style scoped>
.index-page { display: grid; gap: 8px; }

.records-card {
  border-radius: 16px;
  border-color: var(--master-border);
  background: rgba(255, 255, 255, 0.92);
}

.pl-card {
  border-radius: 12px;
  border-color: #dce5ef;
  transition: box-shadow 200ms ease;
}

.pl-card:hover {
  box-shadow: 0 6px 16px rgba(15, 118, 110, 0.10);
}

.fab-btn {
  width: 58px; height: 58px;
  box-shadow: 0 12px 24px rgba(15, 118, 110, 0.35);
  background: linear-gradient(145deg, var(--master-primary), var(--master-primary-700));
}

.fab-sticky { z-index: 30; }
</style>
```

**Rule**: The page MUST NOT call services, stores, or APIs directly. It only uses composables (`useResourceConfig`, `useResourceData`, `useResourceNav`, `usePriceListEditor`). All business logic is in the composable.

**File size target**: ~160 lines max (template + script + style).

---

### Step 4: Create Page `PriceLists/AddPage.vue`

**File**: `FRONTENT/src/pages/master/PriceLists/AddPage.vue`

#### 4.1 Template

```html
<template>
  <div class="add-page">
    <!-- Header -->
    <q-card flat bordered class="page-card">
      <q-card-section class="q-pa-sm q-pa-md">
        <div class="text-h6 text-weight-bold">Create Price List</div>
        <div class="text-caption text-grey-6">Set header details and assign prices for products.</div>
      </q-card-section>
    </q-card>

    <!-- PriceList header fields -->
    <q-card flat bordered class="page-card q-mt-sm">
      <q-card-section class="q-pa-sm q-pa-md">
        <div class="text-subtitle2 text-weight-medium q-mb-sm">Price List Details</div>
        <div class="row q-col-gutter-sm">
          <div class="col-12 col-md-6">
            <q-input v-model="form.Name" outlined dense label="Name *" placeholder="e.g. Standard Retail" />
          </div>
          <div class="col-12 col-md-6">
            <q-input v-model="form.Currency" outlined dense label="Currency *" placeholder="e.g. AED" />
          </div>
          <div class="col-12 col-md-6">
            <q-select
              v-model="form.IsDefault" outlined dense emit-value map-options
              :options="[{ label: 'Yes', value: 'TRUE' }, { label: 'No', value: 'FALSE' }]"
              label="Is Default"
            />
          </div>
          <div class="col-12 col-md-6">
            <q-select
              v-model="form.Status" outlined dense emit-value map-options
              :options="[{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }]"
              label="Status"
            />
          </div>
          <div class="col-12">
            <q-input v-model="form.Description" outlined dense type="textarea" autogrow label="Description" />
          </div>
        </div>
      </q-card-section>
    </q-card>

    <!-- Grouped SKU price inputs -->
    <q-card flat bordered class="page-card q-mt-sm">
      <q-card-section class="q-pa-sm q-pa-md">
        <div class="text-subtitle2 text-weight-medium q-mb-sm">SKU Prices</div>
        <div class="text-caption text-grey-6 q-mb-md">
          Enter prices for the products below. Leave blank to skip.
        </div>

        <div v-for="group in groupedSkus" :key="group.productCode" class="q-mb-md">
          <div class="text-weight-medium text-grey-8 q-mb-xs">{{ group.productName }}</div>
          <div class="row q-col-gutter-sm">
            <div
              v-for="sku in group.skus"
              :key="sku.skuCode"
              class="col-12 col-md-6 col-lg-4"
            >
              <q-input
                :model-value="getPrice(sku.skuCode)"
                outlined dense
                type="number" step="0.01"
                :label="sku.variantLabel"
                @update:model-value="updatePrice(sku.skuCode, $event)"
              />
            </div>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <!-- Actions -->
    <q-card flat bordered class="page-card q-mt-sm">
      <q-card-section class="row justify-end q-gutter-sm">
        <q-btn flat no-caps label="Cancel" @click="navigateBack" />
        <q-btn color="primary" unelevated no-caps label="Create" :loading="saving" @click="handleCreate" />
      </q-card-section>
    </q-card>
  </div>
</template>
```

#### 4.2 Script

```js
<script setup>
import { watch, ref } from 'vue'
import { useQuasar } from 'quasar'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useResourceData } from 'src/composables/resources/useResourceData'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { usePriceListCreateForm } from 'src/composables/master/priceLists/usePriceListCreateForm'

const $q = useQuasar()
const nav = useResourceNav()
const { resourceName } = useResourceConfig()

const {
  form, saving, prices, groupedSkus,
  updatePrice, getPrice, handleSave, navigateBack
} = usePriceListCreateForm()

// Ensure Products + SKUs are loaded from store before rendering
const productsResource = useResourceData(ref('Products'))
const skusResource = useResourceData(ref('SKUs'))

watch(() => resourceName.value, async (name) => {
  if (!name) return
  await Promise.all([
    productsResource.reload(),
    skusResource.reload()
  ])
}, { immediate: true })

async function handleCreate() {
  const result = await handleSave()
  if (result.success) {
    const newCode = result.data?.code || ''
    $q.notify({ type: 'positive', message: 'Price list created', timeout: 1800 })
    if (newCode) {
      nav.goTo('view', { code: newCode })
    } else {
      navigateBack()
    }
  } else {
    $q.notify({ type: 'negative', message: result.error || 'Create failed', timeout: 3000 })
  }
}
</script>
```

#### 4.3 Styles

```css
<style scoped>
.add-page { display: grid; gap: 8px; }

.page-card {
  border-radius: 16px;
  border-color: var(--master-border);
  background: rgba(255, 255, 255, 0.95);
}
</style>
```

**File size target**: ~120 lines max.

---

## Files Summary

| File | Type | Purpose |
|---|---|---|
| `FRONTENT/src/composables/master/priceLists/usePriceListEditor.js` | Composable | Index page: data resolution, dirty tracking, mode-aware save |
| `FRONTENT/src/composables/master/priceLists/usePriceListCreateForm.js` | Composable | Add page: form state, mode-aware create |
| `FRONTENT/src/pages/master/PriceLists/IndexPage.vue` | Page | Expandable PriceList cards with inline editing |
| `FRONTENT/src/pages/master/PriceLists/AddPage.vue` | Page | Create form with full product/SKU listing |

**No changes needed** to: stores, services, router, menu config, GAS code, or `syncAppResources.gs`.

## Documentation Updates Required

- [ ] Update `Documents/CONTEXT_HANDOFF.md` — add note that PriceList custom pages exist with INLINE/ITEMS mode support.
- [ ] Update `Documents/AQL_MENU_ADMIN_GUIDE.md` if menu label/behavior changes (no changes expected; confirm).

## Acceptance Criteria

- [ ] Navigating to `/master/price-lists` renders the custom IndexPage with all PriceLists listed.
- [ ] Clicking a PriceList expands it, showing editable header fields (Name, Currency, IsDefault, Description, Status) and all active products grouped with their active SKUs and price inputs.
- [ ] "Save" button per expanded section persists header changes + price changes without collapsing.
- [ ] When `PriceListLookup = INLINE`, prices are saved to `PriceList.SKUPrices` JSON; when `ITEMS`, prices are saved as `PriceListItems` rows.
- [ ] FAB navigates to Add page.
- [ ] Add page shows all active products + SKUs with price inputs, creates a new PriceList with prices.
- [ ] Add page success navigates to the new PriceList's view page (generic ViewPage).
- [ ] No store/service/menu/router changes required.

## Execution Self-Check Protocol

### Progress Log
- [x] Step 1: `usePriceListEditor.js` created
- [x] Step 2: `usePriceListCreateForm.js` created
- [x] Step 3: `IndexPage.vue` created
- [x] Step 4: `AddPage.vue` created

### Deviations / Decisions
- [ ] `[?]` Decision needed:
- [ ] `[!]` Issue/blocker:

### Files Actually Changed
- `FRONTENT/src/composables/master/priceLists/usePriceListEditor.js`
- `FRONTENT/src/composables/master/priceLists/usePriceListCreateForm.js`
- `FRONTENT/src/pages/master/PriceLists/IndexPage.vue`
- `FRONTENT/src/pages/master/PriceLists/AddPage.vue`

### Validation Performed
- [x] Manual review of all 4 files for architecture compliance
- [x] Verify no store/service/router changes exist in diff
- [x] Acceptance criteria verified

### Manual Actions Required
- [ ] Restart Vite dev server (globs discovered at startup).
- [ ] Verify `PriceListLookup` key exists in `APP.Config` sheet (value: `INLINE` or `ITEMS`). If missing, add it via the spreadsheet.
- [x] Optional: run `npm run build` if changes are cross-cutting (~10+ files or equivalent risk � not needed here, 4 files).

## Post-Execution Notes
- Deviation: save gating on the edit page now includes `pricesChanged` so price-only edits are not blocked.
- Validation: frontend build completed successfully with the new pages and composables in place.



