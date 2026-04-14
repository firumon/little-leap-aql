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
        <q-btn flat color="primary" label="Back to List" icon="arrow_back" class="q-mt-md" @click="navigateToList" />
      </q-card-section>
    </q-card>

    <!-- Record detail -->
    <template v-else-if="sectionsReady">
      <component
        :is="sections.ViewHeader"
        :record="record"
        :resolved-fields="resolvedFields"
      />

      <component
        :is="sections.ViewActionBar"
        :permissions="permissions"
        :additional-actions="additionalActions"
        :reports="config?.reports || []"
        :is-generating="isGenerating"
        @edit="navigateToEdit"
        @action-clicked="navigateToAction"
        @generate-report="(report) => initiateReport(report, record)"
      />

      <component
        :is="sections.ViewDetails"
        :record="record"
        :resolved-fields="resolvedFields"
      />

      <component
        :is="sections.ViewAudit"
        :record="record"
      />

      <component
        :is="sections.ViewChildren"
        :child-resources="childResources"
        :child-records="childRecords"
      />
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
import ReportInputDialog from 'src/components/Masters/ReportInputDialog.vue'
import MasterViewHeader from 'components/Masters/_common/MasterViewHeader.vue'
import MasterViewActionBar from 'components/Masters/_common/MasterViewActionBar.vue'
import MasterViewDetails from 'components/Masters/_common/MasterViewDetails.vue'
import MasterViewAudit from 'components/Masters/_common/MasterViewAudit.vue'
import MasterViewChildren from 'components/Masters/_common/MasterViewChildren.vue'
import { useSectionResolver } from 'src/composables/useSectionResolver'
import { useResourceConfig } from 'src/composables/useResourceConfig'
import { useResourceData } from 'src/composables/useResourceData'
import { useResourceRelations } from 'src/composables/useResourceRelations'
import { useReports } from 'src/composables/useReports'
import { fetchResourceRecords } from 'src/services/resourceRecords'
import { useResourceNav } from 'src/composables/useResourceNav'

const nav = useResourceNav()
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

const customUIName = computed(() => config.value?.ui?.customUIName || '')
const { sections, sectionsReady } = useSectionResolver({
  resourceSlug,
  customUIName,
  sectionDefs: {
    ViewHeader: MasterViewHeader,
    ViewActionBar: MasterViewActionBar,
    ViewDetails: MasterViewDetails,
    ViewAudit: MasterViewAudit,
    ViewChildren: MasterViewChildren
  }
})

const childRecords = ref({})

const record = computed(() => {
  if (!code.value || !items.value.length) return null
  return items.value.find((row) => row.Code === code.value) || null
})

function navigateToList() {
  nav.goTo('list')
}

function navigateToEdit() {
  nav.goTo('edit')
}

function navigateToAction(action) {
  nav.goTo('action', { action: action.action.toLowerCase() })
}

function findParentCodeField(childResource, parentResource) {
  const headers = Array.isArray(childResource.headers) ? childResource.headers : []
  if (headers.includes('ParentCode')) return 'ParentCode'
  const parentName = parentResource?.name || ''
  const singularParent = parentName.replace(/s$/, '')
  const candidate = `${singularParent}Code`
  if (headers.includes(candidate)) return candidate
  return 'ParentCode'
}

async function loadChildRecords() {
  if (!code.value || !childResources.value.length) return
  for (const child of childResources.value) {
    try {
      const response = await fetchResourceRecords(child.name, { includeInactive: true })
      if (response.success && response.records) {
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
@keyframes rise-in {
  0% { transform: translateY(10px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
</style>
