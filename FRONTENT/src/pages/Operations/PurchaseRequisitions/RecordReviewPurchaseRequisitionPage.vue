<template>
  <div class="pr-review-page">

    <!-- ── Loading ── -->
    <div v-if="loading" class="page-fullload column items-center justify-center">
      <q-spinner-dots color="primary" size="40px" />
      <div class="text-caption text-grey-5 q-mt-sm">Loading requisition…</div>
    </div>

    <!-- ── Not found ── -->
    <div v-else-if="!prForm.Code" class="page-fullload column items-center justify-center">
      <q-icon name="search_off" size="48px" color="grey-4" />
      <div class="text-subtitle2 text-grey-5 q-mt-sm">Requisition not found</div>
      <q-btn flat color="primary" label="Back to list" icon="arrow_back" class="q-mt-md" @click="nav.goTo('list')" />
    </div>

    <template v-else>

      <!-- ══════════ HERO CARD ══════════ -->
      <div class="hero-card q-mx-md q-mb-md">
        <div class="hero-card__gold-line" />
        <div class="hero-card__glow" />

        <!-- Top row: back | code + meta | status -->
        <div class="hero-card__toprow row items-start no-wrap">
          <button class="hero-back-btn" @click="nav.goTo('list')">
            <q-icon name="arrow_back" size="20px" />
          </button>
          <div class="col" style="min-width:0">
            <div class="hero-code">{{ prForm.Code }}</div>
            <div class="hero-meta row items-center">
              <span class="row items-center q-gutter-x-xs">
                <q-icon name="event" size="12px" />
                PR Date: {{ formatDate(prForm.PRDate) }}
              </span>
              <span v-if="prForm.RequestedBy" class="row items-center q-gutter-x-xs q-ml-md">
                <q-icon name="person" size="12px" />
                {{ prForm.RequestedBy }}
              </span>
            </div>
          </div>
          <div class="status-chip q-ml-sm" :style="statusChipStyle(prForm.Progress)">
            <span class="status-dot" :style="{ background: statusDotColor(prForm.Progress) }" />
            {{ prForm.Progress || 'Draft' }}
          </div>
        </div>

        <!-- Stat strip -->
        <div class="hero-stat-strip">
          <div class="hero-stat-cell">
            <div class="hero-stat-label">ITEMS</div>
            <div class="hero-stat-value">{{ items.length }}</div>
          </div>
          <div class="hero-stat-cell">
            <div class="hero-stat-label">TOTAL QTY</div>
            <div class="hero-stat-value">{{ totalQty }}</div>
          </div>
          <div class="hero-stat-cell">
            <div class="hero-stat-label">EST. VALUE</div>
            <div class="hero-stat-value hero-stat-value--gold">{{ formatCurrency(grandTotal) }}</div>
          </div>
        </div>

        <!-- Pinned details row (no "DETAILS" label) -->
        <div class="hero-details-strip row items-center no-wrap">
          <div class="hero-pin-row col row no-wrap">
            <div v-if="prForm.Type" class="pin-chip">
              <q-icon :name="typeIcon(prForm.Type)" size="12px" />
              {{ types.find(t => t.value === prForm.Type)?.label || prForm.Type }}
            </div>
            <div v-if="prForm.Priority" class="pin-chip">
              <span class="pin-dot" :style="{ background: priorityHexColor(prForm.Priority) }" />
              {{ prForm.Priority }}
            </div>
            <div v-if="selectedWarehouse" class="pin-chip">
              <q-icon name="warehouse" size="12px" />
              {{ selectedWarehouse.Name }}
            </div>
            <div
              v-if="prForm.RequiredDate"
              class="pin-chip"
              :class="{ 'pin-chip--warn': isOverdue(prForm.RequiredDate) }"
            >
              <q-icon name="event" size="12px" />
              {{ formatDate(prForm.RequiredDate) }}
            </div>
          </div>
          <button class="hero-edit-toggle" @click="headerExpanded = !headerExpanded">
            {{ headerExpanded ? 'Done' : 'Edit' }}
            <q-icon :name="headerExpanded ? 'expand_less' : 'tune'" size="13px" class="q-ml-xs" />
          </button>
        </div>

        <!-- Collapsible edit panel -->
        <q-slide-transition>
          <div v-show="headerExpanded" class="hero-edit-panel">

            <!-- Type — full-width 4-column grid -->
            <div class="edit-group">
              <div class="edit-group__label">Type</div>
              <div class="seg-grid seg-grid--4">
                <button
                  v-for="t in types" :key="t.value"
                  class="seg-btn"
                  :class="{ 'seg-btn--active': prForm.Type === t.value }"
                  @click="prForm.Type = t.value"
                >
                  <q-icon :name="t.icon" size="16px" />
                  <span>{{ t.label }}</span>
                </button>
              </div>
            </div>

            <!-- Priority -->
            <div class="edit-group">
              <div class="edit-group__label">Priority</div>
              <div class="row" style="gap:6px;flex-wrap:wrap">
                <button
                  v-for="p in priorities" :key="p.value"
                  class="seg-btn seg-btn--pill"
                  :class="{ 'seg-btn--active': prForm.Priority === p.value }"
                  @click="prForm.Priority = p.value"
                >
                  <span
                    class="seg-dot"
                    :style="{
                      background: p.color,
                      boxShadow: prForm.Priority === p.value ? `0 0 6px ${p.color}` : 'none'
                    }"
                  />
                  {{ p.value }}
                </button>
              </div>
            </div>

            <!-- Warehouse -->
            <div class="edit-group">
              <div class="edit-group__label">Warehouse</div>
              <div v-if="loadingWarehouses" class="row q-gutter-xs">
                <q-skeleton v-for="i in 3" :key="i" type="QBtn" width="100px" height="34px" dark />
              </div>
              <div v-else class="row" style="gap:6px;flex-wrap:wrap">
                <button
                  v-for="wh in warehouses" :key="wh.Code"
                  class="seg-btn seg-btn--pill"
                  :class="{ 'seg-btn--active': prForm.WarehouseCode === wh.Code }"
                  @click="prForm.WarehouseCode = prForm.WarehouseCode === wh.Code ? '' : wh.Code"
                >
                  <q-icon name="warehouse" size="13px" />
                  {{ wh.Name }}
                </button>
                <div v-if="!warehouses.length" class="text-caption" style="color:rgba(255,255,255,0.4)">
                  No warehouses available
                </div>
              </div>
            </div>

            <!-- Required Date — q-date picker -->
            <div class="edit-group">
              <div class="edit-group__label">Required Date</div>
              <div class="edit-field">
                <q-icon name="event" size="18px" style="color:var(--hero-secondary);flex-shrink:0" />
                <div class="edit-field__value">
                  <div class="edit-field__label">Date</div>
                  <div
                    class="edit-field__text"
                    :class="{ 'edit-field__text--placeholder': !prForm.RequiredDate }"
                  >
                    {{ prForm.RequiredDate ? formatDate(prForm.RequiredDate) : 'Select date…' }}
                  </div>
                </div>
                <q-icon
                  name="calendar_month"
                  size="18px"
                  style="color:rgba(255,255,255,0.55);flex-shrink:0;cursor:pointer"
                >
                  <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                    <q-date
                      v-model="prForm.RequiredDate"
                      mask="YYYY-MM-DD"
                      today-btn minimal
                    >
                      <div class="row items-center justify-end q-pa-sm">
                        <q-btn v-close-popup flat dense label="Close" color="primary" />
                      </div>
                    </q-date>
                  </q-popup-proxy>
                </q-icon>
                <span v-if="isOverdue(prForm.RequiredDate)" class="overdue-badge row items-center no-wrap q-ml-xs">
                  <q-icon name="warning" size="12px" class="q-mr-xs" /> overdue
                </span>
              </div>
            </div>

            <!-- Reference Code (PROJECT / SALES) -->
            <div v-if="['PROJECT', 'SALES'].includes(prForm.Type)" class="edit-group">
              <div class="edit-group__label">
                Reference Code <span style="color:var(--hero-secondary)">*</span>
              </div>
              <div class="edit-field">
                <q-icon name="tag" size="18px" style="color:var(--hero-secondary);flex-shrink:0" />
                <input
                  v-model="prForm.TypeReferenceCode"
                  type="text"
                  placeholder="e.g. PROJ-001"
                  class="edit-text-input"
                />
              </div>
            </div>

            <!-- Revision box -->
            <div v-if="isRevision" class="edit-group">
              <div class="revision-box">
                <div class="revision-header row items-center q-gutter-x-xs">
                  <q-icon name="rate_review" size="15px" />
                  Revision Required
                </div>
                <div class="revision-text q-mt-xs">
                  {{ prForm.ProgressReviewComment || 'No comments provided.' }}
                </div>
                <q-input
                  v-model="responseComment"
                  type="textarea"
                  dark outlined dense autogrow
                  label="Your Response (appended to thread)"
                  class="q-mt-sm"
                  :input-style="{ minHeight: '56px' }"
                />
              </div>
            </div>

          </div>
        </q-slide-transition>
      </div>

      <!-- ══════════ ITEMS CARD ══════════ -->
      <q-card flat class="items-card q-mx-md q-mb-md">

        <!-- Card header -->
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
            @click="openAddItemDialog"
          />
        </div>

        <q-separator />

        <!-- Search -->
        <div class="q-px-sm q-py-xs">
          <div class="search-wrap row items-center no-wrap">
            <q-icon name="search" size="18px" color="grey-6" class="q-mr-xs" />
            <input
              v-model="itemSearch"
              placeholder="Filter items, SKUs, variants…"
              class="search-input col"
            />
            <q-btn
              v-if="itemSearch"
              flat round dense icon="close" size="xs" color="grey-5"
              @click="itemSearch = ''"
            />
          </div>
        </div>

        <q-separator />

        <!-- Empty: no items -->
        <div v-if="filteredItems.length === 0 && !itemSearch" class="column items-center q-py-xl">
          <q-icon name="shopping_cart" size="40px" color="grey-4" />
          <div class="text-caption text-grey-5 q-mt-xs">No items added yet</div>
          <q-btn
            outline color="primary" icon="add" label="Add First Item"
            size="sm" class="q-mt-sm"
            @click="openAddItemDialog"
          />
        </div>

        <!-- Empty: search no match -->
        <div v-else-if="filteredItems.length === 0" class="column items-center q-py-lg">
          <q-icon name="search_off" size="32px" color="grey-4" />
          <div class="text-caption text-grey-5 q-mt-xs">No items match "{{ itemSearch }}"</div>
        </div>

        <!-- Item rows -->
        <div v-else>
          <div
            v-for="(item, idx) in filteredItems"
            :key="item._key || item.Code || idx"
            class="item-row"
            :class="{ 'item-row--border': idx < filteredItems.length - 1 }"
          >
            <!-- Row top: name + total + delete -->
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
                <q-btn flat round dense icon="delete" size="sm" color="negative" @click="removeItem(idx)">
                  <q-tooltip>Remove item</q-tooltip>
                </q-btn>
              </div>
            </div>

            <!-- Row bottom: qty + rate NumberFields -->
            <div class="row" style="gap:8px">
              <label
                class="num-field col"
                :class="{ 'num-field--focus': focusedField === `qty-${idx}` }"
              >
                <q-icon name="straighten" size="14px" :style="{ color: 'var(--hero-ink-3)', flexShrink: 0 }" />
                <div class="col" style="min-width:0">
                  <div class="nf-label">{{ item.UOM ? `Qty (${item.UOM})` : 'Qty' }}</div>
                  <input
                    v-model.number="item.Quantity"
                    type="number" min="1" step="1"
                    class="nf-input"
                    @focus="focusedField = `qty-${idx}`"
                    @blur="focusedField = null"
                  />
                </div>
              </label>
              <label
                class="num-field col"
                :class="{ 'num-field--focus': focusedField === `rate-${idx}` }"
              >
                <q-icon name="payments" size="14px" :style="{ color: 'var(--hero-ink-3)', flexShrink: 0 }" />
                <div class="col" style="min-width:0">
<!--                  <div class="nf-label">Est. Rate (AED)</div>-->
                  <input
                    v-model.number="item.EstimatedRate"
                    type="number" min="0" step="0.01"
                    class="nf-input"
                    @focus="focusedField = `rate-${idx}`"
                    @blur="focusedField = null"
                  />
                </div>
              </label>
            </div>
          </div>
        </div>
      </q-card>

      <!-- Bottom spacer -->
      <div style="height:140px" />

    </template>

    <!-- ══════════ ACTION BAR ══════════ -->
    <div v-if="!loading && prForm.Code" class="action-bar">
      <div class="row items-center justify-between q-mb-sm q-px-xs">
        <div class="action-bar__total-label">Estimated Total</div>
        <div class="action-bar__total-value">
          {{ formatCurrency(grandTotal) }}
<!--          <span class="action-bar__total-ccy">AED</span>-->
        </div>
      </div>
      <div class="pr-review-page__btn-grid">
        <q-btn
          outline color="primary"
          icon="save" label="Save Draft"
          style="height:48px;border-radius:12px;font-weight:700;font-size:14px"
          :loading="saving"
          @click="$emit('save-draft', buildPayload('Draft'))"
        />
        <q-btn
          unelevated icon-right="send" label="Submit PR"
          class="submit-btn"
          style="height:48px;border-radius:12px;font-weight:700;font-size:14px"
          :loading="submitting"
          :disable="items.length === 0"
          @click="$emit('submit', buildPayload('New'))"
        >
          <q-tooltip v-if="items.length === 0">Add at least one item to submit</q-tooltip>
        </q-btn>
      </div>
    </div>

    <!-- ══════════ ADD ITEM DIALOG ══════════ -->
    <q-dialog v-model="addDialog" position="bottom">
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
            @filter="filterSkus"
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
              <q-input
                v-model.number="newItem.Quantity"
                type="number" outlined dense label="Quantity *" min="1"
              />
            </div>
            <div class="col-6">
              <q-input
                v-model.number="newItem.EstimatedRate"
                type="number" outlined dense label="Est. Rate" min="0" step="0.01"
              />
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
            @click="confirmAddItem"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useQuasar } from 'quasar'
import { useResourceNav } from 'src/composables/useResourceNav'
import { useResourceData } from 'src/composables/useResourceData'
import { useStockMovements } from 'src/composables/useStockMovements'
import { useAuthStore } from 'src/stores/auth'

const emit = defineEmits(['save-draft', 'submit'])

const route = useRoute()
const $q = useQuasar()
const nav = useResourceNav()
const { loadWarehouses } = useStockMovements()
const auth = useAuthStore()

const prCode = route.params.code

// ── Data resources ───────────────────────────────────────────────────────────
const prResource       = useResourceData(ref('PurchaseRequisitions'))
const itemsResource    = useResourceData(ref('PurchaseRequisitionItems'))
const skusResource     = useResourceData(ref('SKUs'))
const productsResource = useResourceData(ref('Products'))

// ── Local state ──────────────────────────────────────────────────────────────
const loading    = ref(true)
const saving     = ref(false)
const submitting = ref(false)

const prForm           = ref({})
const items            = ref([])
const deletedItemCodes = ref([])
const responseComment  = ref('')

const warehouses        = ref([])
const loadingWarehouses = ref(false)

const allSkus       = ref([])
const allProducts   = ref([])
const skuInfoByCode = ref({})
const skuOptions    = ref([])
const itemSearch    = ref('')

const addDialog = ref(false)
const newItem   = ref({ SKU: null, Quantity: 1, EstimatedRate: 0 })

const headerExpanded = ref(false)
const focusedField   = ref(null)

// ── Static config ────────────────────────────────────────────────────────────
const TYPE_META = {
  STOCK:   { icon: 'inventory_2',  color: '#0F2B4A', bg: '#EEF3F9', ring: '#D0DEF0' },
  PROJECT: { icon: 'architecture',  color: '#1A6FAD', bg: '#E8F2FB', ring: '#BDD9F0' },
  SALES:   { icon: 'storefront',    color: '#1A7A4A', bg: '#E8F6EE', ring: '#B8E4CB' },
  ASSET:   { icon: 'build_circle',  color: '#C97B1A', bg: '#FDF3E3', ring: '#F5D9A0' },
}

const PRIORITY_META = {
  Low:    { icon: 'arrow_downward', color: '#1A7A4A', bg: '#E8F6EE' },
  Medium: { icon: 'remove',         color: '#C97B1A', bg: '#FDF3E3' },
  High:   { icon: 'arrow_upward',   color: '#C0362C', bg: '#FBE9E8' },
  Urgent: { icon: 'priority_high',  color: '#7B1FA2', bg: '#F5E5FB' },
}

const types = computed(() =>
  (auth.appOptionsMap['PurchaseRequisitionType'] || []).map(v => ({
    value: v,
    label: v.charAt(0) + v.slice(1).toLowerCase(),
    ...TYPE_META[v],
  }))
)

const priorities = computed(() =>
  (auth.appOptionsMap['PurchaseRequisitionPriority'] || []).map(v => ({
    value: v,
    label: v,
    ...PRIORITY_META[v],
  }))
)

// ── Computed ─────────────────────────────────────────────────────────────────
const isRevision = computed(() =>
  ['Review', 'Revision Required', 'Revision'].includes(prForm.value.Progress)
)

const filteredItems = computed(() => {
  const kw = (itemSearch.value || '').toLowerCase()
  if (!kw) return items.value
  return items.value.filter(i => {
    const info = skuInfoByCode.value[i.SKU] || {}
    return (i.SKU || '').toLowerCase().includes(kw)
      || (info.productName || '').toLowerCase().includes(kw)
      || (info.variantsCsv || '').toLowerCase().includes(kw)
  })
})

const totalQty   = computed(() => items.value.reduce((s, i) => s + (Number(i.Quantity) || 0), 0))
const grandTotal = computed(() => items.value.reduce((s, i) => s + (Number(i.Quantity) * Number(i.EstimatedRate) || 0), 0))

const headerComplete = computed(() => {
  const f = prForm.value
  if (!f.Type || !f.Priority) return false
  if (['PROJECT', 'SALES'].includes(f.Type) && !f.TypeReferenceCode) return false
  return true
})

// Warehouse name lookup for the pin chip
const selectedWarehouse = computed(() =>
  warehouses.value.find(w => w.Code === prForm.value.WarehouseCode) || null
)

// ── Status chip ──────────────────────────────────────────────────────────────
function statusChipStyle(p) {
  const map = {
    'Draft':             { bg: 'rgba(212,168,67,0.16)',  fg: '#F2D682' },
    'Review':            { bg: 'rgba(201,123,26,0.20)',  fg: '#FFC58F' },
    'Revision Required': { bg: 'rgba(201,123,26,0.20)',  fg: '#FFC58F' },
    'New':               { bg: 'rgba(26,122,74,0.20)',   fg: '#83E3B0' },
    'Submitted':         { bg: 'rgba(26,122,74,0.20)',   fg: '#83E3B0' },
    'Pending Approval':  { bg: 'rgba(3,105,161,0.20)',   fg: '#93C5FD' },
    'Approved':          { bg: 'rgba(26,122,74,0.20)',   fg: '#83E3B0' },
    'Rejected':          { bg: 'rgba(192,54,44,0.20)',   fg: '#FFA59A' },
    'Closed':            { bg: 'rgba(71,85,105,0.20)',   fg: '#CBD5E1' },
  }
  const m = map[p] || map['Draft']
  return `background:${m.bg};color:${m.fg};border:1px solid rgba(255,255,255,0.08)`
}
function statusDotColor(p) {
  const map = {
    'Draft':             '#D4A843',
    'Review':            '#FFB060',
    'Revision Required': '#FFB060',
    'New':               '#3DD584',
    'Submitted':         '#3DD584',
    'Pending Approval':  '#60A5FA',
    'Approved':          '#3DD584',
    'Rejected':          '#FF6B5C',
    'Closed':            '#94A3B8',
  }
  return map[p] || '#D4A843'
}

// ── Pin chip helpers ─────────────────────────────────────────────────────────
function typeIcon(v) {
  return types.value.find(t => t.value === v)?.icon || 'inventory_2'
}
function priorityHexColor(v) {
  return priorities.value.find(p => p.value === v)?.color || '#0F2B4A'
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(d) {
  if (!d) return ''
  try { return new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return d }
}
function formatCurrency(v) {
  const n = Number(v) || 0
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function isOverdue(d) {
  if (!d) return false
  return new Date(d) < new Date()
}

// ── Load data ────────────────────────────────────────────────────────────────
async function loadData() {
  loading.value = true
  try {
    await Promise.all([
      prResource.reload(),
      itemsResource.reload(),
      skusResource.reload(),
      productsResource.reload(),
      loadWarehouses().then(w => { warehouses.value = w }),
    ])

    const pr = prResource.items.value.find(r => r.Code === prCode)
    if (!pr) {
      $q.notify({ type: 'negative', message: 'PR not found' })
      loading.value = false
      return
    }

    prForm.value = { ...pr }

    items.value = itemsResource.items.value
      .filter(i => i.PurchaseRequisitionCode === prCode)
      .map((i, idx) => ({ ...i, _key: i.Code || `new-${idx}` }))

    allSkus.value     = skusResource.items.value.filter(s => s.Status === 'Active')
    allProducts.value = productsResource.items.value || []

    const productByCode = {}
    allProducts.value.forEach(p => { productByCode[p.Code] = p })

    const info = {}
    allSkus.value.forEach(s => {
      const variants = [s.Variant1, s.Variant2, s.Variant3, s.Variant4, s.Variant5]
        .filter(v => v != null && String(v).trim() !== '')
      info[s.Code] = {
        productName: productByCode[s.ProductCode]?.Name || s.ProductCode || s.Code,
        variantsCsv: variants.join(', '),
        uom: s.UOM || '',
      }
    })
    skuInfoByCode.value = info

    skuOptions.value = allSkus.value.map(s => ({
      label:    info[s.Code]?.productName || s.Code,
      sublabel: [s.Code, info[s.Code]?.variantsCsv].filter(Boolean).join(' — '),
      value:    s.Code,
      UOM:      s.UOM,
      ...s,
    }))

    headerExpanded.value = !headerComplete.value

  } catch (e) {
    $q.notify({ type: 'negative', message: 'Failed to load: ' + e.message })
  } finally {
    loading.value = false
  }
}

// ── Item management ──────────────────────────────────────────────────────────
function openAddItemDialog() {
  newItem.value = { SKU: null, Quantity: 1, EstimatedRate: 0 }
  addDialog.value = true
}

function filterSkus(val, update) {
  update(() => {
    const needle = val.toLowerCase()
    skuOptions.value = allSkus.value
      .filter(s => {
        const inf = skuInfoByCode.value[s.Code] || {}
        return s.Code.toLowerCase().includes(needle)
          || (inf.productName || '').toLowerCase().includes(needle)
          || (inf.variantsCsv || '').toLowerCase().includes(needle)
      })
      .map(s => {
        const inf = skuInfoByCode.value[s.Code] || {}
        return {
          label:    inf.productName || s.Code,
          sublabel: [s.Code, inf.variantsCsv].filter(Boolean).join(' — '),
          value:    s.Code,
          UOM:      s.UOM,
          ...s,
        }
      })
  })
}

function confirmAddItem() {
  if (!newItem.value.SKU || newItem.value.Quantity <= 0) {
    $q.notify({ type: 'warning', message: 'Select a SKU and enter a valid quantity' })
    return
  }
  const skuCode  = typeof newItem.value.SKU === 'object' ? newItem.value.SKU.value : newItem.value.SKU
  const skuObj   = allSkus.value.find(s => s.Code === skuCode)
  const existing = items.value.find(i => i.SKU === skuCode)
  if (existing) {
    existing.Quantity += newItem.value.Quantity
    $q.notify({ type: 'info', message: `Qty updated for ${skuCode}` })
  } else {
    items.value.push({
      _key:          `new-${Date.now()}`,
      SKU:           skuCode,
      UOM:           skuObj?.UOM || '',
      Quantity:      newItem.value.Quantity,
      EstimatedRate: newItem.value.EstimatedRate,
    })
  }
  addDialog.value = false
}

function removeItem(idx) {
  const real = items.value.indexOf(filteredItems.value[idx])
  const item = items.value[real]
  if (item?.Code) deletedItemCodes.value.push(item.Code)
  items.value.splice(real, 1)
}

// ── Payload builder ──────────────────────────────────────────────────────────
function buildPayload(targetProgress) {
  const updatedComment = isRevision.value && responseComment.value
    ? `${prForm.value.ProgressReviewComment || ''}\n[Response]: ${responseComment.value}`
    : prForm.value.ProgressReviewComment

  return {
    action:   'compositeSave',
    resource: 'PurchaseRequisitions',
    scope:    'operation',
    code:     prCode,
    data: {
      Type:               typeof prForm.value.Type === 'object' ? prForm.value.Type.value : prForm.value.Type,
      Priority:           typeof prForm.value.Priority === 'object' ? prForm.value.Priority.value : prForm.value.Priority,
      WarehouseCode:      typeof prForm.value.WarehouseCode === 'object' ? prForm.value.WarehouseCode.value : prForm.value.WarehouseCode,
      RequiredDate:       prForm.value.RequiredDate,
      TypeReferenceCode:  prForm.value.TypeReferenceCode || '',
      Progress:           targetProgress,
      ProgressReviewComment: updatedComment || '',
    },
    children: [{
      resource: 'PurchaseRequisitionItems',
      records: [
        ...items.value.map(item => ({
          _action:       item.Code ? 'update' : 'create',
          _originalCode: item.Code || '',
          data: {
            SKU:           item.SKU,
            UOM:           item.UOM,
            Quantity:      item.Quantity,
            EstimatedRate: item.EstimatedRate,
            Status:        'Active',
          },
        })),
        ...deletedItemCodes.value.map(code => ({
          _action:       'deactivate',
          _originalCode: code,
          data:          { Status: 'Inactive' },
        })),
      ],
    }],
  }
}

// ── Background polling ───────────────────────────────────────────────────────
const hasLocalEdits = ref(false)
let loadDone = false

watch([items, prForm], () => {
  if (loadDone) hasLocalEdits.value = true
}, { deep: true })

async function silentRefresh() {
  if (hasLocalEdits.value) return
  try {
    await Promise.all([
      prResource.reload(),
      itemsResource.reload(),
    ])
    const pr = prResource.items.value.find(r => r.Code === prCode)
    if (!pr) return
    prForm.value = { ...pr }
    items.value = itemsResource.items.value
      .filter(i => i.PurchaseRequisitionCode === prCode)
      .map((i, index) => ({ ...i, _key: i.Code || `new-${index}` }))
  } catch (_) { /* silent — do not disturb the user */ }
}

let pollTimer = null

defineExpose({ buildPayload, prForm, items })

onMounted(async () => {
  await loadData()
  await nextTick()
  loadDone = true
  pollTimer = setInterval(silentRefresh, 30000)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<style lang="scss" scoped>
// All hero, items-card, action-bar, num-field styles live in src/css/hero.scss.
// Only page-shell specifics belong here.

.pr-review-page {
  min-height: 100%;
  padding-bottom: 140px;
  // No background — inherits from Quasar layout so there's no canvas mismatch.
}

.page-fullload { min-height: 300px; }

.page-breadcrumbs {
  padding: 12px 16px 8px;
  font-size: 12px;
  color: $ink-muted;
}

// Button grid: Save Draft (1fr) | Submit PR (1.4fr)
.pr-review-page__btn-grid {
  display: grid;
  grid-template-columns: 1fr 1.4fr;
  gap: 8px;
}

.add-item-dialog {
  width: 100%;
  max-width: 480px;
  border-radius: 20px 20px 0 0 !important;
}

.dialog-preview {
  font-size: 13px;
  color: $ink-muted;
  text-align: right;
}
</style>
