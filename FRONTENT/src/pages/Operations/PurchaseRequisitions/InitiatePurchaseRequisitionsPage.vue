<template>
  <q-page padding>


    <!-- ── Hero ─────────────────────────────────────────────────────────── -->
    <div class="hero-card">
      <div class="hero-card__gold-line" />
      <div class="hero-card__glow" />

      <div class="hero-card__toprow row items-center no-wrap q-gutter-x-sm">
        <button class="hero-back-btn" :disabled="currentStep === 1" @click="currentStep = Math.max(1, currentStep - 1)">
          <q-icon name="arrow_back" size="20px" />
        </button>
        <div class="col">
          <div class="hero-code">PR — New</div>
          <div class="hero-meta">
            <q-icon name="calendar_today" size="13px" />
            {{ todayFormatted }}
            <span class="row items-center q-ml-xs q-gutter-x-xs">
              <q-icon :name="selectedType.icon" size="12px" />
              {{ selectedType.label }}
            </span>
          </div>
        </div>
        <div class="status-chip" style="background: rgba(212,168,67,0.16); color: #F2D682; border: 1px solid rgba(255,255,255,0.08);">
          <span class="status-dot" style="background: #D4A843;" />
          New
        </div>
      </div>

      <!-- Stepper -->
      <div class="step-row">
        <template v-for="(s, i) in steps" :key="s.key">
          <div class="step-node" :class="{ 'is-active': currentStep === s.n, 'is-done': currentStep > s.n }">
            <div class="step-circle" :class="{ 'is-active': currentStep === s.n, 'is-done': currentStep > s.n }">
              <q-icon v-if="currentStep > s.n" name="check" size="14px" />
              <span v-else>{{ s.n }}</span>
            </div>
            <span class="step-label">{{ s.label }}</span>
          </div>
          <div v-if="i < steps.length - 1" class="step-line" :class="{ 'is-done': currentStep > s.n }" />
        </template>
      </div>

      <!-- Step 2 stats -->
      <div v-if="currentStep === 2" class="hero-stat-strip">
        <div class="hero-stat-cell">
          <div class="hero-stat-label">SKUs Selected</div>
          <div class="hero-stat-value">{{ selectedSkusCount }}</div>
        </div>
        <div class="hero-stat-cell">
          <div class="hero-stat-label">Total Qty</div>
          <div class="hero-stat-value">{{ totalQty }}</div>
        </div>
        <div class="hero-stat-cell">
          <div class="hero-stat-label">Warehouse</div>
          <div class="hero-stat-value" style="font-size: 12px; font-weight: 700;">{{ warehouseName || '—' }}</div>
        </div>
      </div>
    </div>

    <!-- ── Body ────────────────────────────────────────────────────────── -->
    <div class="pr-init-body">

      <!-- STEP 1 -->
      <transition name="step-fade" mode="out-in">
        <div v-if="currentStep === 1" key="step1">

          <div class="section-card">
            <div class="section-card__head">
              <div class="section-card__icon"><q-icon name="tune" size="18px" /></div>
              <span class="section-card__title">Requisition Details</span>
            </div>
            <div class="section-card__body">

              <div class="field-label">Type <span class="field-label__required">*</span></div>
              <div class="sel-grid sel-grid--4">
                <button
                  v-for="t in types" :key="t.value"
                  class="sel-btn"
                  :class="{ 'is-active': form.Type === t.value }"
                  :style="{ '--sel-color': t.color, '--sel-bg': t.bg, '--sel-ring': t.ring }"
                  @click="form.Type = t.value"
                >
                  <q-icon :name="t.icon" class="sel-btn__icon" />
                  {{ t.label }}
                </button>
              </div>

              <div class="field-label q-mt-md">Priority <span class="field-label__required">*</span></div>
              <div class="sel-grid sel-grid--4">
                <button
                  v-for="p in priorities" :key="p.value"
                  class="sel-btn"
                  :class="{ 'is-active': form.Priority === p.value }"
                  :style="{ '--sel-color': p.color, '--sel-bg': p.bg, '--sel-ring': p.bg }"
                  @click="form.Priority = p.value"
                >
                  {{ p.label }}
                </button>
              </div>

              <template v-if="needsRefCode">
                <div class="field-label q-mt-md">Reference Code <span class="field-label__required">*</span></div>
                <q-input
                  v-model="form.TypeReferenceCode"
                  outlined dense bg-color="white"
                  placeholder="e.g. PROJ-001"
                  class="q-mb-md"
                  :rules="[v => !!v || 'Required for Project / Sales']"
                  hide-bottom-space
                />
              </template>
            </div>
          </div>

          <div class="section-card">
            <div class="section-card__head">
              <div class="section-card__icon"><q-icon name="warehouse" size="18px" /></div>
              <span class="section-card__title">Location &amp; Schedule</span>
            </div>
            <div class="section-card__body">

              <div class="field-label">Warehouse <span class="text-grey-6 q-ml-xs">(Optional)</span></div>
              <div v-if="loadingWarehouses" class="flex flex-center q-pa-md">
                <q-spinner color="primary" size="2em" />
              </div>
              <div v-else class="row q-gutter-xs q-mb-md">
                <button
                  v-for="wh in warehouses" :key="wh.Code"
                  class="wh-chip"
                  :class="{ 'is-active': form.WarehouseCode === wh.Code }"
                  @click="form.WarehouseCode = form.WarehouseCode === wh.Code ? '' : wh.Code"
                >
                  <span class="wh-chip__name">{{ wh.Name }}</span>
                  <span class="wh-chip__code">{{ wh.Code }}</span>
                </button>
              </div>

              <div class="field-label">Required Date <span class="text-grey-6 q-ml-xs">(Optional)</span></div>
              <q-input :model-value="form.RequiredDate" readonly outlined dense label="Required Date">
                <template #append>
                  <q-icon name="event" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-date v-model="form.RequiredDate" mask="YYYY-MM-DD" :options="d => d >= today">
                        <div class="row items-center justify-end">
                          <q-btn v-close-popup label="Close" color="primary" flat />
                        </div>
                      </q-date>
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </div>
        </div>
      </transition>

      <!-- STEP 2 -->
      <transition name="step-fade" mode="out-in">
        <div v-if="currentStep === 2" key="step2">

          <q-input
            v-model="searchQuery"
            outlined dense clearable bg-color="white"
            placeholder="Search products, SKUs, variants…"
            class="q-mb-sm"
          >
            <template #prepend>
              <q-icon name="search" color="grey-6" size="18px" />
            </template>
          </q-input>


          <div class="row items-center justify-between no-wrap q-mb-sm">
            <q-btn-toggle
              v-model="itemSort"
              :options="[{ label: 'By Product Qty', value: 'product' }, { label: 'By SKU Qty', value: 'sku' }]"
              no-caps no-wrap
              color="white" text-color="grey-7"
              toggle-color="primary" toggle-text-color="white"
              style="font-size: 11px;"
            />
            <q-toggle
              v-model="showAllWh"
              label="All Warehouses"
              :disable="!!form.WarehouseCode"
              color="primary" dense
              class="q-ml-xs"
            />
          </div>

          <div class="section-card" style="padding: 0; overflow: hidden;">
            <div v-if="loadingItems" class="flex flex-center q-pa-xl">
              <q-spinner color="primary" size="3em" />
            </div>

            <div v-else-if="sortedItems.length === 0" class="column items-center q-pa-xl text-center text-grey-6">
              <q-icon name="search_off" size="32px" color="grey-4" />
              <span class="q-mt-sm">No items match "{{ searchQuery }}"</span>
            </div>

            <div v-else>
              <div v-for="group in sortedItems" :key="group.ProductCode">
                <div class="pick-group-head">
                  <span>{{ group.ProductName }}</span>
                  <span class="row items-center q-gutter-x-xs text-grey-6" style="font-size: 11px; font-weight: 600;">
                    <q-icon name="inventory_2" size="12px" />
                    {{ group.totalStock ?? '—' }}
                  </span>
                </div>
                <div
                  v-for="sku in group.skus" :key="sku.Code"
                  class="pick-row"
                  :class="{ 'is-selected': sku.requiredQuantity > 0 }"
                >
                  <div class="col" style="min-width: 0;">
                    <span class="sku-badge">{{ sku.Code }}</span>
                    <div class="text-grey-6" style="font-size: 11px;">{{ formatSkuVariants(sku) }}</div>
                    <div :class="stockClass(sku.Code)" style="font-size: 10px; margin-top: 1px;">
                      Stock: {{ getSkuStock(sku.Code) }} {{ sku.UOM || 'PCS' }}
                      <span v-if="getSkuStock(sku.Code) === 0"> · OUT</span>
                      <span v-else-if="getSkuStock(sku.Code) < 5"> · LOW</span>
                    </div>
                  </div>
                  <q-input
                    v-model.number="sku.requiredQuantity"
                    type="number" outlined dense bg-color="white"
                    :label="'Qty (' + (sku.UOM || 'PCS') + ')'"
                    min="0"
                    hide-bottom-space
                    style="width: 90px; flex-shrink: 0;"
                    @update:model-value="val => { if (val < 0) sku.requiredQuantity = 0 }"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </transition>

      <!-- STEP 3 -->
      <transition name="step-fade" mode="out-in">
        <div v-if="currentStep === 3" key="step3">
          <div class="section-card column items-center text-center q-pa-xl q-gutter-y-xs">
            <q-icon name="check_circle" size="48px" color="positive" class="q-mb-xs" />
            <div class="text-weight-bolder" style="font-size: 20px;">PR Created!</div>
            <div class="text-primary text-weight-bolder" style="font-family: var(--font-mono), monospace; font-size: 22px; letter-spacing: -0.4px;">{{ createdCode }}</div>
            <div class="text-grey-6" style="font-size: 12px;">Saved as Draft · {{ todayFormatted }}</div>
          </div>
        </div>
      </transition>
    </div>

    <!-- Spacer so fixed action bar doesn't obscure last content -->
    <div style="height: 88px;" />

    <!-- ── Action Bar ──────────────────────────────────────────────────── -->
    <div class="action-bar row q-gutter-x-sm">

      <q-btn v-if="currentStep === 1"
        unelevated color="primary"
        icon-right="arrow_forward"
        label="Proceed to Items"
        class="action-btn-lg"
        :disable="!isStep1Valid"
        @click="goToStep2"
      />

      <template v-if="currentStep === 2">
        <q-btn outline color="primary" icon="arrow_back" label="Back" class="action-btn-lg" @click="currentStep = 1" />
        <q-btn unelevated color="primary" icon-right="check" label="Create PR" class="action-btn-lg"
          :disable="selectedSkusCount === 0 || saving" :loading="saving" @click="savePR" />
      </template>

      <template v-if="currentStep === 3">
        <q-btn outline color="primary" icon="add" label="New PR" class="action-btn-lg" @click="currentStep = 1" />
        <q-btn unelevated color="primary" icon-right="open_in_new" label="View PR" class="action-btn-lg" @click="viewCreatedPR" />
      </template>

    </div>
  </q-page>
</template>

<script setup>
import { usePurchaseRequisitionCreateFlow } from 'src/composables/operations/purchaseRequisitions/usePurchaseRequisitionCreateFlow'
import { formatSkuVariants } from 'src/utils/appHelpers'

const {
  steps,
  currentStep,
  loadingWarehouses,
  warehouses,
  form,
  types,
  priorities,
  selectedType,
  needsRefCode,
  isStep1Valid,
  goToStep2,
  loadingItems,
  skus,
  searchQuery,
  itemSort,
  showAllWh,
  saving,
  sortedItems,
  selectedSkusCount,
  totalQty,
  warehouseName,
  today,
  todayFormatted,
  createdCode,
  getSkuStock,
  stockClass,
  viewCreatedPR,
  savePR
} = usePurchaseRequisitionCreateFlow()
</script>

<style scoped>
.pr-init-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 16px;
}
.pr-init-body :deep(.section-card) {
  margin-left: 0;
  margin-right: 0;
}
</style>
