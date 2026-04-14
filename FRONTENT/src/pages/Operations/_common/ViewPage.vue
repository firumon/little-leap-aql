<template>
  <div class="view-page">
    <!-- Loading -->
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

    <!-- View Content -->
    <template v-else-if="sectionsReady">
      <component
        :is="sections.ViewHeader"
        :config="config"
        :record="record"
        :code="code"
        @edit="navigateToEdit"
      />

      <component
        :is="sections.ViewActionBar"
        :additional-actions="additionalActions"
        :record="record"
        @action="navigateToAction"
      />

      <component
        :is="sections.ViewDetails"
        :record="record"
        :resolved-fields="resolvedFields"
        :additional-actions="additionalActions"
      />

      <component
        :is="sections.ViewParent"
        :parent-resource="parentResource"
        :parent-record="parentRecord"
        :additional-actions="additionalActions"
        :scope="scope"
      />

      <component
        :is="sections.ViewChildren"
        v-if="childResources.length"
        :child-resources="childResources"
        :child-records-map="childRecordsByResource"
        :parent-code="code"
        @view-child="navigateToChildView"
      />
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import OperationViewHeader from 'components/Operations/_common/OperationViewHeader.vue'
import OperationViewActionBar from 'components/Operations/_common/OperationViewActionBar.vue'
import OperationViewDetails from 'components/Operations/_common/OperationViewDetails.vue'
import OperationViewParent from 'components/Operations/_common/OperationViewParent.vue'
import OperationViewChildren from 'components/Operations/_common/OperationViewChildren.vue'
import { useSectionResolver } from 'src/composables/useSectionResolver'
import { useResourceConfig } from 'src/composables/useResourceConfig'
import { useResourceData } from 'src/composables/useResourceData'
import { useResourceRelations } from 'src/composables/useResourceRelations'
import { fetchResourceRecords } from 'src/services/resourceRecords'
import { useResourceNav } from 'src/composables/useResourceNav'

const router = useRouter()
const nav = useResourceNav()
const { scope, resourceSlug, code, config, resourceName, resolvedFields, additionalActions } = useResourceConfig()
const { items, loading, reload } = useResourceData(resourceName)
const { parentResource, childResources } = useResourceRelations(resourceName)

const customUIName = computed(() => config.value?.ui?.customUIName || '')
const { sections, sectionsReady } = useSectionResolver({
  resourceSlug,
  customUIName,
  scope: 'operations',
  sectionDefs: {
    ViewHeader: OperationViewHeader,
    ViewActionBar: OperationViewActionBar,
    ViewDetails: OperationViewDetails,
    ViewParent: OperationViewParent,
    ViewChildren: OperationViewChildren
  }
})

const record = computed(() => {
  if (!code.value || !items.value.length) return null
  return items.value.find((r) => r.Code === code.value) || null
})

const childRecordsByResource = ref({})
const parentRecord = ref(null)

function findParentCodeField(childResourceConfig, parentResourceConfig) {
  const headers = Array.isArray(childResourceConfig?.headers) ? childResourceConfig.headers : []
  if (headers.includes('ParentCode')) return 'ParentCode'
  const parentName = parentResourceConfig?.name || ''
  const singularParent = parentName.replace(/s$/, '')
  const candidate = `${singularParent}Code`
  if (headers.includes(candidate)) return candidate
  return 'ParentCode'
}

async function fetchParentRecord() {
  if (!parentResource.value || !record.value) {
    parentRecord.value = null
    return
  }

  const parentCodeField = findParentCodeField(config.value, parentResource.value)
  const pCode = record.value[parentCodeField]
  if (!pCode) {
    parentRecord.value = null
    return
  }

  try {
    const response = await fetchResourceRecords(parentResource.value.name, { includeInactive: true })
    if (response.success && response.records) {
      parentRecord.value = response.records.find((r) => r.Code === pCode) || null
    } else {
      parentRecord.value = null
    }
  } catch {
    parentRecord.value = null
  }
}

async function fetchChildren() {
  const newMap = {}
  for (const child of childResources.value) {
    try {
      const response = await fetchResourceRecords(child.name, { includeInactive: true })
      if (response.success && response.records) {
        const parentCodeField = findParentCodeField(child, config.value)
        newMap[child.name] = response.records.filter((r) => r[parentCodeField] === code.value)
      } else {
        newMap[child.name] = []
      }
    } catch {
      newMap[child.name] = []
    }
  }
  childRecordsByResource.value = newMap
}

watch(
  () => [resourceName.value, code.value],
  async ([nName, nCode]) => {
    if (nName && nCode) {
      await reload()
      await Promise.all([
        fetchParentRecord(),
        fetchChildren()
      ])
    }
  },
  { immediate: true }
)

function navigateToList() {
  nav.goTo('list')
}

function navigateToEdit() {
  nav.goTo('edit')
}

function navigateToAction(action) {
  nav.goTo('action', { action: action.action })
}

function navigateToChildView(childResource, childRecordCode) {
  router.push({
    name: childResource.scope === 'operations' ? 'operations-view' : 'resource-view',
    params: { resourceSlug: childResource.slug, code: childRecordCode }
  })
}
</script>

<style scoped>
.view-page {
  display: grid;
  gap: 12px;
  padding-bottom: 32px;
}
.page-card {
  border-radius: 16px;
  border-color: var(--operation-border, #e2e8f0);
  background: rgba(255, 255, 255, 0.95);
  animation: rise-in 280ms ease-out both;
}
@keyframes rise-in {
  0% { transform: translateY(10px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
</style>
