<template>
  <div class="pr-index">
    <q-card flat bordered class="pr-header-card q-mb-sm">
      <q-card-section class="q-pa-sm">
        <div class="row items-center no-wrap">
          <div class="col">
            <div class="pr-header-title">Purchase Requisitions</div>
            <div class="pr-header-sub">{{ totalVisible }} visible · {{ items.length }} total</div>
          </div>
          <q-btn
            flat round icon="refresh" color="primary" size="sm"
            :loading="loading"
            @click="reload(true)"
          >
            <q-tooltip>Sync from server</q-tooltip>
          </q-btn>
        </div>

        <q-input
          v-model="searchTerm"
          outlined dense clearable
          placeholder="Search requisitions…"
          class="q-mt-sm"
          bg-color="white"
        >
          <template #prepend>
            <q-icon name="search" color="grey-6" size="18px" />
          </template>
        </q-input>
      </q-card-section>
    </q-card>

    <div v-if="!loading || items.length">
      <div
        v-for="group in visibleGroups"
        :key="group.key"
        class="q-mb-sm"
      >
        <div
          class="group-header row items-center no-wrap q-px-sm q-py-xs cursor-pointer"
          :style="{ borderLeftColor: group.color }"
          @click="toggleGroup(group.key)"
        >
          <q-icon
            :name="group.icon"
            :style="{ color: group.color }"
            size="18px"
            class="q-mr-xs"
          />
          <div class="group-label col" :style="{ color: group.color }">
            {{ group.label }}
          </div>
          <q-badge
            :style="{ background: group.color }"
            text-color="white"
            class="q-mr-sm"
          >{{ group.records.length }}</q-badge>
          <q-icon
            :name="collapsedGroups[group.key] ? 'expand_more' : 'expand_less'"
            color="grey-6"
            size="18px"
          />
        </div>

        <transition name="group-collapse">
          <div v-if="!collapsedGroups[group.key]" class="group-records">
            <div
              v-for="row in group.records"
              :key="row.Code"
              class="pr-card"
              :class="['pr-card--' + group.key]"
              @click="navigateTo(row)"
            >
              <div class="pr-card__stripe" :style="{ background: group.color }" />

              <div class="pr-card__body row items-start no-wrap q-gutter-x-sm">
                <div class="col">
                  <div class="row items-center q-gutter-x-xs q-mb-xs">
                    <span class="pr-code">{{ row.Code }}</span>
                    <q-chip
                      dense
                      :style="{ background: group.color + '22', color: group.color, border: '1px solid ' + group.color + '55' }"
                      class="text-weight-bold pr-progress-chip"
                    >
                      {{ row.Progress || 'Draft' }}
                    </q-chip>
                    <q-chip
                      v-if="row.Priority"
                      dense
                      :color="priorityColor(row.Priority)"
                      text-color="white"
                      class="pr-priority-chip"
                    >{{ row.Priority }}</q-chip>
                  </div>

                  <div class="pr-type-line">
                    <q-icon name="inventory_2" size="13px" class="q-mr-xs" color="grey-6" />
                    <span>{{ row.Type || '—' }}</span>
                    <span v-if="row.TypeReferenceCode" class="q-ml-xs text-grey-6">
                      ({{ row.TypeReferenceCode }})
                    </span>
                  </div>

                  <div class="pr-meta-row row q-gutter-x-md q-mt-xs">
                    <span v-if="row.PRDate">
                      <q-icon name="event" size="12px" color="grey-5" />
                      {{ formatDate(row.PRDate) }}
                    </span>
                    <span v-if="row.RequiredDate" :class="isOverdue(row.RequiredDate) ? 'text-negative' : ''">
                      <q-icon name="schedule" size="12px" :color="isOverdue(row.RequiredDate) ? 'negative' : 'grey-5'" />
                      Need by {{ formatDate(row.RequiredDate) }}
                      <q-icon v-if="isOverdue(row.RequiredDate)" name="warning" size="12px" color="negative" />
                    </span>
                    <span v-if="row.WarehouseCode">
                      <q-icon name="warehouse" size="12px" color="grey-5" />
                      {{ row.WarehouseCode }}
                    </span>
                  </div>

                  <div v-if="row.ProgressReviewComment && group.key === 'revision'" class="pr-comment q-mt-xs">
                    <q-icon name="comment" size="13px" color="warning" class="q-mr-xs" />
                    <span class="text-caption ellipsis-2-lines">{{ row.ProgressReviewComment }}</span>
                  </div>
                </div>

                <div class="col-auto column items-center justify-center self-center q-pl-xs">
                  <q-icon
                    :name="group.actionIcon"
                    size="20px"
                    :style="{ color: group.color }"
                  />
                  <div class="pr-action-hint">{{ group.actionHint }}</div>
                </div>
              </div>
            </div>

            <div v-if="group.records.length === 0" class="q-pa-md text-center text-grey-5 text-caption">
              No records
            </div>
          </div>
        </transition>
      </div>
    </div>

    <div v-else class="pr-loading column items-center justify-center q-py-xl">
      <q-spinner-dots color="primary" size="36px" />
      <div class="text-caption text-grey-5 q-mt-sm">Loading requisitions…</div>
    </div>

    <div v-if="!loading && totalVisible === 0 && items.length === 0" class="pr-empty column items-center justify-center q-py-xl">
      <q-icon name="description" size="48px" color="grey-4" />
      <div class="text-subtitle2 text-grey-5 q-mt-sm">No purchase requisitions yet</div>
      <q-btn color="primary" icon="add" label="Create First PR" class="q-mt-md" @click="navigateToAdd" />
    </div>

    <q-page-sticky position="bottom-right" :offset="[16, 22]" style="z-index: 30">
      <q-btn
        v-if="permissions.canWrite"
        round unelevated
        icon="add"
        class="pr-fab"
        @click="navigateToAdd"
      >
        <q-tooltip>New Purchase Requisition</q-tooltip>
      </q-btn>
    </q-page-sticky>
  </div>
</template>

<script setup>
import { usePurchaseRequisitionIndex } from 'src/composables/operations/purchaseRequisitions/usePurchaseRequisitionIndex'

const {
  permissions,
  items,
  loading,
  reload,
  searchTerm,
  collapsedGroups,
  visibleGroups,
  totalVisible,
  priorityColor,
  formatDate,
  isOverdue,
  toggleGroup,
  navigateTo,
  navigateToAdd
} = usePurchaseRequisitionIndex()
</script>

<style scoped>
.pr-index {
  /* Add any necessary styles for the pr-index component */
}

.pr-header-card {
  /* Add any necessary styles for the pr-header-card class */
}

.pr-header-title {
  /* Add any necessary styles for the pr-header-title class */
}

.pr-header-sub {
  /* Add any necessary styles for the pr-header-sub class */
}

.q-mb-sm {
  margin-bottom: 0.5rem;
}

.q-pa-sm {
  padding: 0.5rem;
}

.q-mt-sm {
  margin-top: 0.5rem;
}

.bg-color {
  background-color: #fff;
}

.group-header {
  display: flex;
  align-items: center;
  padding: 0.5rem;
  cursor: pointer;
  transition: background 0.12s, box-shadow 0.12s;
}

.group-header:hover {
  background: #f8fafc;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.08);
}

.group-label {
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  line-height: 1.2;
}

/* ── Group records ── */
.group-records {
  display: grid;
  gap: 0.375rem;
  padding: 0.25rem 0 0.5rem 0.25rem;
}

/* ── Group expand/collapse animation ── */
.group-collapse-enter-active,
.group-collapse-leave-active {
  transition: max-height 240ms ease, opacity 200ms ease, transform 200ms ease;
  overflow: hidden;
  max-height: 2000px;
}

.group-collapse-enter-from,
.group-collapse-leave-to {
  max-height: 0;
  opacity: 0;
  transform: translateY(-4px);
}

.group-collapse-enter-to,
.group-collapse-leave-from {
  opacity: 1;
  transform: translateY(0);
}

/* ── PR Card ── */
.pr-card {
  position: relative;
  display: flex;
  align-items: stretch;
  border-radius: 0.75rem;
  border: 1px solid #e2e8f0;
  background: linear-gradient(175deg, #ffffff 0%, #f8fafc 100%);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);
  cursor: pointer;
  overflow: hidden;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}

.pr-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.11);
}

.pr-card:active {
  transform: scale(0.99);
}

/* priority stripe */
.pr-card__stripe {
  width: 0.25rem;
  flex-shrink: 0;
  border-radius: 0.75rem 0 0 0.75rem;
}

.pr-card__body {
  flex: 1;
  padding: 0.625rem 0.75rem 0.625rem 0.625rem;
}

/* text elements */
.pr-code {
  font-size: 0.6875rem;
  color: #64748b;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.pr-progress-chip {
  font-size: 0.625rem;
  height: 1.125rem;
  border-radius: 0.5rem;
}

.pr-priority-chip {
  font-size: 0.625rem;
  height: 1.125rem;
  border-radius: 0.5rem;
}

.pr-type-line {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #1e293b;
  display: flex;
  align-items: center;
}

.pr-meta-row {
  font-size: 0.6875rem;
  color: #64748b;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.pr-meta-row span {
  display: flex;
  align-items: center;
  gap: 0.125rem;
}

.pr-comment {
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 0.375rem;
  padding: 0.25rem 0.5rem;
  display: flex;
  align-items: flex-start;
  color: #9a3412;
  font-size: 0.6875rem;
}

.ellipsis-2-lines {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.pr-action-hint {
  font-size: 0.5625rem;
  color: #94a3b8;
  margin-top: 0.125rem;
  text-align: center;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

/* ── States ── */
.pr-loading,
.pr-empty {
  min-height: 12.5rem;
}

/* ── FAB ── */
.pr-fab {
  width: 3.625rem;
  height: 3.625rem;
  background: linear-gradient(145deg, #0f766e, #0b5d56);
  color: white;
  box-shadow: 0 12px 24px rgba(15, 118, 110, 0.35);
}

@keyframes rise-in {
  from { transform: translateY(10px); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}
</style>
