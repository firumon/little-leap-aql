<template>
  <div class="view-page">
    <!-- Loading state -->
    <div v-if="loading" class="q-py-xl text-center">
      <q-spinner-dots color="primary" size="32px" />
    </div>

    <!-- Record not found -->
    <q-card v-else-if="!record" flat bordered class="page-card">
      <q-card-section class="text-center q-py-xl">
        <q-icon name="search_off" size="48px" color="grey-5" />
        <div class="text-subtitle1 text-grey-7 q-mt-md">Record not found</div>
        <q-btn
          flat
          color="primary"
          label="Back to List"
          icon="arrow_back"
          class="q-mt-md"
          @click="navigateToList"
        />
      </q-card-section>
    </q-card>

    <!-- Record detail -->
    <template v-else>
      <!-- Header with code + status -->
      <q-card flat bordered class="page-card">
        <q-card-section>
          <div class="row items-center no-wrap">
            <div class="col">
              <div class="record-code-label">{{ record.Code }}</div>
              <div class="record-title">{{ resolvePrimaryText(record) }}</div>
            </div>
            <q-badge
              :color="record.Status === 'Active' ? 'positive' : 'grey-6'"
              class="status-badge"
            >
              {{ record.Status || 'Unknown' }}
            </q-badge>
          </div>
        </q-card-section>

        <!-- Action bar -->
        <q-separator />
        <q-card-section class="action-bar q-pa-sm">
          <div class="row items-center q-gutter-xs">
            <q-btn
              v-if="permissions.canUpdate"
              unelevated
              no-caps
              dense
              icon="edit"
              label="Edit"
              color="primary"
              class="action-btn"
              @click="navigateToEdit"
            />
            <q-btn
              v-for="action in visibleActions"
              :key="action.action"
              outline
              no-caps
              dense
              :icon="action.icon || 'play_arrow'"
              :label="action.label"
              :color="action.color || 'primary'"
              class="action-btn"
              @click="navigateToAction(action)"
            />
            <q-space />
            <q-btn
              v-for="report in recordReports"
              :key="report.name"
              unelevated
              no-caps
              dense
              :icon="report.icon || 'picture_as_pdf'"
              :label="report.label || report.name"
              color="deep-orange-7"
              class="action-btn"
              :loading="isGenerating"
              :disable="isGenerating"
              @click="initiateReport(report, record)"
            >
              <q-tooltip>{{ report.label || report.name }}</q-tooltip>
            </q-btn>
          </div>
        </q-card-section>
      </q-card>

      <!-- Fields -->
      <q-card flat bordered class="page-card q-mt-sm">
        <q-card-section>
          <div class="section-title">Details</div>
          <div class="detail-grid">
            <div v-for="field in detailFields" :key="field.header" class="detail-line">
              <span class="detail-key">{{ field.label }}</span>
              <span class="detail-val">{{ record[field.header] || '-' }}</span>
            </div>
          </div>
        </q-card-section>
      </q-card>

      <!-- Audit info -->
      <q-card v-if="record.CreatedAt || record.UpdatedAt" flat bordered class="page-card q-mt-sm">
        <q-card-section>
          <div class="section-title">Audit</div>
          <div class="detail-grid">
            <div v-if="record.CreatedAt" class="detail-line">
              <span class="detail-key">Created</span>
              <span class="detail-val">{{ formatDate(record.CreatedAt) }}</span>
            </div>
            <div v-if="record.UpdatedAt" class="detail-line">
              <span class="detail-key">Updated</span>
              <span class="detail-val">{{ formatDate(record.UpdatedAt) }}</span>
            </div>
          </div>
        </q-card-section>
      </q-card>

      <!-- Child resource tables -->
      <template v-for="childRes in childResources" :key="childRes.name">
        <q-card flat bordered class="page-card q-mt-sm">
          <q-card-section>
            <div class="section-title">{{ childRes.ui?.pageTitle || childRes.name }}</div>
            <div v-if="!childRecords[childRes.name]?.length" class="text-grey-6 text-center q-py-md">
              No {{ (childRes.ui?.pageTitle || childRes.name).toLowerCase() }} found
            </div>
            <q-markup-table v-else flat dense separator="horizontal" class="child-view-table">
              <thead>
                <tr>
                  <th class="text-left">Code</th>
                  <th
                    v-for="field in getChildFields(childRes)"
                    :key="field.header"
                    class="text-left"
                  >
                    {{ field.label }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="childRow in childRecords[childRes.name]" :key="childRow.Code">
                  <td class="text-primary text-weight-medium">{{ childRow.Code }}</td>
                  <td v-for="field in getChildFields(childRes)" :key="field.header">
                    {{ childRow[field.header] || '-' }}
                  </td>
                </tr>
              </tbody>
            </q-markup-table>
          </q-card-section>
        </q-card>
      </template>
    </template>

    <ReportInputDialog
      v-model="showReportDialog"
      :report="activeReport"
      :form-values="reportInputs"
      :is-generating="isGenerating"
      @update:form-values="reportInputs = $event"
      @confirm="confirmReportDialog"
      @cancel="cancelReportDialog"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import ReportInputDialog from 'src/components/Masters/ReportInputDialog.vue'
import { useResourceConfig } from 'src/composables/useResourceConfig'
import { useResourceData } from 'src/composables/useResourceData'
import { useResourceRelations } from 'src/composables/useResourceRelations'
import { useReports } from 'src/composables/useReports'
import { fetchMasterRecords } from 'src/services/masterRecords'

const router = useRouter()
const {
  scope, resourceSlug, code, config, resourceName,
  resolvedFields, additionalActions, permissions
} = useResourceConfig()

const { items, loading, reload } = useResourceData(resourceName)
const { childResources } = useResourceRelations(resourceName)
const {
  isGenerating, showReportDialog, activeReport, reportInputs,
  initiateReport, confirmReportDialog, cancelReportDialog
} = useReports(resourceName)

const childRecords = ref({})

const record = computed(() => {
  if (!code.value || !items.value.length) return null
  return items.value.find((row) => row.Code === code.value) || null
})

const detailFields = computed(() => resolvedFields.value.filter((f) => f.header !== 'Code'))

const recordReports = computed(() => {
  return (config.value?.reports || []).filter((r) => r.isRecordLevel)
})

const visibleActions = computed(() => {
  return additionalActions.value.filter((action) => {
    // Check if user has permission for this action
    const perm = permissions.value
    if (!perm) return false
    const actionKey = `can${action.action}`
    return perm[actionKey] !== false
  })
})

function resolvePrimaryText(row) {
  if (!row) return '-'
  if (row.Name) return row.Name
  const firstFilled = resolvedFields.value.find((f) => {
    const v = row[f.header]
    return v && v.toString().trim() && f.header !== 'Status'
  })
  return firstFilled ? row[firstFilled.header] : '-'
}

function getChildFields(childRes) {
  const uiFields = childRes?.ui?.fields
  if (Array.isArray(uiFields) && uiFields.length) {
    return uiFields.filter((f) => f.header !== 'Code' && f.header !== 'ParentCode')
  }
  const headers = Array.isArray(childRes?.headers) ? childRes.headers : []
  return headers
    .filter((h) => !['Code', 'ParentCode', 'CreatedAt', 'UpdatedAt', 'CreatedBy', 'UpdatedBy'].includes(h))
    .map((h) => ({
      header: h,
      label: h.replace(/([a-z])([A-Z])/g, '$1 $2'),
      type: 'text'
    }))
}

function formatDate(value) {
  if (!value) return '-'
  try {
    const d = new Date(typeof value === 'number' ? value : Number(value) || value)
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return String(value) }
}

function navigateToList() {
  router.push(`/${scope.value}/${resourceSlug.value}`)
}

function navigateToEdit() {
  router.push(`/${scope.value}/${resourceSlug.value}/${code.value}/edit`)
}

function navigateToAction(action) {
  router.push(`/${scope.value}/${resourceSlug.value}/${code.value}/${action.action.toLowerCase()}`)
}

async function loadChildRecords() {
  if (!code.value || !childResources.value.length) return
  for (const child of childResources.value) {
    try {
      const response = await fetchMasterRecords(child.name, { includeInactive: true })
      if (response.success && response.records) {
        // Filter child records by parent code
        const parentCodeField = findParentCodeField(child, config.value)
        childRecords.value[child.name] = response.records.filter((r) => {
          return r[parentCodeField] === code.value
        })
      }
    } catch {
      childRecords.value[child.name] = []
    }
  }
}

function findParentCodeField(childResource, parentResource) {
  // Convention: ParentCode, or {ParentName}Code (e.g., ProductCode)
  const headers = Array.isArray(childResource.headers) ? childResource.headers : []
  if (headers.includes('ParentCode')) return 'ParentCode'
  const parentName = parentResource?.name || ''
  const singularParent = parentName.replace(/s$/, '')
  const candidate = `${singularParent}Code`
  if (headers.includes(candidate)) return candidate
  return 'ParentCode'
}

watch(() => resourceName.value, async (n) => { if (n) await reload() }, { immediate: true })
watch([() => code.value, () => items.value.length], () => { loadChildRecords() })
</script>

<style scoped>
.page-card {
  border-radius: 16px;
  border-color: var(--master-border);
  background: rgba(255, 255, 255, 0.95);
  animation: rise-in 280ms ease-out both;
}

.record-code-label {
  font-size: 12px;
  color: var(--master-soft-ink);
  letter-spacing: 0.04em;
  font-weight: 500;
}

.record-title {
  font-size: 22px;
  font-weight: 800;
  color: var(--master-ink);
  margin-top: 2px;
}

.status-badge {
  border-radius: 8px;
  font-weight: 600;
  padding: 4px 12px;
  font-size: 12px;
}

.action-bar {
  background: #f8fafc;
}

.action-btn {
  border-radius: 10px;
  font-weight: 600;
  font-size: 12px;
  letter-spacing: 0.02em;
  padding: 4px 14px;
}

.section-title {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748b;
  margin-bottom: 12px;
}

.detail-grid { display: grid; gap: 0; }

.detail-line {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 2px;
  border-bottom: 1px dashed #e2e8f0;
}

.detail-line:last-child { border-bottom: none; }
.detail-key { color: #64748b; font-size: 13px; }
.detail-val { color: #1f2937; font-size: 13px; text-align: right; font-weight: 500; }

.child-view-table { font-size: 13px; }
.child-view-table th {
  font-size: 11px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.03em; color: #64748b; padding: 8px 12px;
}
.child-view-table td { padding: 6px 12px; }

@keyframes rise-in {
  0% { transform: translateY(10px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
</style>
