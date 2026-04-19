<template>
  <div class="hero-card q-mx-md q-mb-md">
    <div class="hero-card__gold-line" />
    <div class="hero-card__glow" />

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

    <div class="hero-stat-strip">
      <div class="hero-stat-cell">
        <div class="hero-stat-label">ITEMS</div>
        <div class="hero-stat-value">{{ itemsLength }}</div>
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

    <div class="hero-details-strip row items-center no-wrap">
      <div class="hero-pin-row col row no-wrap">
        <div v-if="prForm.Type" class="pin-chip">
          <q-icon :name="typeIcon(prForm.Type)" size="12px" />
          {{ types.find((type) => type.value === prForm.Type)?.label || prForm.Type }}
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
      <button class="hero-edit-toggle" @click="$emit('update:headerExpanded', !headerExpanded)">
        {{ headerExpanded ? 'Done' : 'Edit' }}
        <q-icon :name="headerExpanded ? 'expand_less' : 'tune'" size="13px" class="q-ml-xs" />
      </button>
    </div>

    <q-slide-transition>
      <div v-show="headerExpanded" class="hero-edit-panel">
        <div class="edit-group">
          <div class="edit-group__label">Type</div>
          <div class="seg-grid seg-grid--4">
            <button
              v-for="type in types" :key="type.value"
              class="seg-btn"
              :class="{ 'seg-btn--active': prForm.Type === type.value }"
              @click="prForm.Type = type.value"
            >
              <q-icon :name="type.icon" size="16px" />
              <span>{{ type.label }}</span>
            </button>
          </div>
        </div>

        <div class="edit-group">
          <div class="edit-group__label">Priority</div>
          <div class="row" style="gap:6px;flex-wrap:wrap">
            <button
              v-for="priority in priorities" :key="priority.value"
              class="seg-btn seg-btn--pill"
              :class="{ 'seg-btn--active': prForm.Priority === priority.value }"
              @click="prForm.Priority = priority.value"
            >
              <span
                class="seg-dot"
                :style="{ background: priority.color, boxShadow: prForm.Priority === priority.value ? `0 0 6px ${priority.color}` : 'none' }"
              />
              {{ priority.value }}
            </button>
          </div>
        </div>

        <div class="edit-group">
          <div class="edit-group__label">Warehouse</div>
          <div v-if="loadingWarehouses" class="row q-gutter-xs">
            <q-skeleton v-for="i in 3" :key="i" type="QBtn" width="100px" height="34px" dark />
          </div>
          <div v-else class="row" style="gap:6px;flex-wrap:wrap">
            <button
              v-for="warehouse in warehouses" :key="warehouse.Code"
              class="seg-btn seg-btn--pill"
              :class="{ 'seg-btn--active': prForm.WarehouseCode === warehouse.Code }"
              @click="prForm.WarehouseCode = prForm.WarehouseCode === warehouse.Code ? '' : warehouse.Code"
            >
              <q-icon name="warehouse" size="13px" />
              {{ warehouse.Name }}
            </button>
            <div v-if="!warehouses.length" class="text-caption" style="color:rgba(255,255,255,0.4)">
              No warehouses available
            </div>
          </div>
        </div>

        <div class="edit-group">
          <div class="edit-group__label">Required Date</div>
          <div class="edit-field">
            <q-icon name="event" size="18px" style="color:var(--hero-secondary);flex-shrink:0" />
            <div class="edit-field__value">
              <div class="edit-field__label">Date</div>
              <div class="edit-field__text" :class="{ 'edit-field__text--placeholder': !prForm.RequiredDate }">
                {{ prForm.RequiredDate ? formatDate(prForm.RequiredDate) : 'Select date…' }}
              </div>
            </div>
            <q-icon name="calendar_month" size="18px" style="color:rgba(255,255,255,0.55);flex-shrink:0;cursor:pointer">
              <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                <q-date v-model="prForm.RequiredDate" mask="YYYY-MM-DD" today-btn minimal>
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
              :model-value="responseComment"
              type="textarea"
              dark outlined dense autogrow
              label="Your Response (appended to thread)"
              class="q-mt-sm"
              :input-style="{ minHeight: '56px' }"
              @update:model-value="$emit('update:responseComment', $event)"
            />
          </div>
        </div>
      </div>
    </q-slide-transition>
  </div>
</template>

<script setup>
defineProps({
  nav: { type: Object, required: true },
  prForm: { type: Object, required: true },
  itemsLength: { type: Number, required: true },
  totalQty: { type: Number, required: true },
  grandTotal: { type: Number, required: true },
  types: { type: Array, required: true },
  priorities: { type: Array, required: true },
  selectedWarehouse: { type: Object, default: null },
  headerExpanded: { type: Boolean, required: true },
  loadingWarehouses: { type: Boolean, required: true },
  warehouses: { type: Array, required: true },
  isRevision: { type: Boolean, required: true },
  responseComment: { type: String, default: '' },
  formatDate: { type: Function, required: true },
  formatCurrency: { type: Function, required: true },
  statusChipStyle: { type: Function, required: true },
  statusDotColor: { type: Function, required: true },
  typeIcon: { type: Function, required: true },
  priorityHexColor: { type: Function, required: true },
  isOverdue: { type: Function, required: true }
})

defineEmits(['update:headerExpanded', 'update:responseComment'])
</script>

