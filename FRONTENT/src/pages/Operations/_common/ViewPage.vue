<template>
  <div class="view-page">
    <div v-if="!sectionsReady" class="q-py-xl text-center">
      <q-spinner-dots color="primary" size="32px" />
    </div>
    <component v-else-if="loading" :is="sections.ViewLoading" />
    <component v-else-if="!record" :is="sections.ViewEmpty" @back="navigateToList" />

    <!-- View Content -->
    <template v-else>
      <component
        :is="sections.ViewHeader"
        :config="config"
        :record="record"
        :code="code"
        @edit="navigateToEdit"
      />

      <component
        :is="sections.ViewActionBar"
        :additional-actions="visibleActions"
        :permissions="permissions"
        @edit="navigateToEdit"
        @action-clicked="navigateToAction"
      />

      <component
        :is="sections.ViewDetails"
        :record="record"
        :resolved-fields="resolvedFields"
      />

      <component
        :is="sections.ViewParent"
        :parent-resource="parentResource"
        :parent-record="parentRecord"
        :additional-actions="visibleActions"
        :scope="scope"
        :resource-slug="resourceSlug"
        :custom-u-i-name="customUIName"
        :entity-name="resourceName"
      />

      <component
        :is="sections.ViewChildren"
        v-if="childResources.length"
        :child-resources="childResources"
        :child-records-map="childRecordsByResource"
        :parent-code="code"
        :resource-slug="resourceSlug"
        :custom-u-i-name="customUIName"
        :entity-name="resourceName"
        :additional-actions="visibleActions"
        @view-child="navigateToChildView"
      />
    </template>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import OperationViewHeader from 'components/Operations/_common/OperationViewHeader.vue'
import OperationViewActionBar from 'components/Operations/_common/OperationViewActionBar.vue'
import OperationViewDetails from 'components/Operations/_common/OperationViewDetails.vue'
import OperationViewParent from 'components/Operations/_common/OperationViewParent.vue'
import OperationViewChildren from 'components/Operations/_common/OperationViewChildren.vue'
import OperationViewLoading from 'components/Operations/_common/OperationViewLoading.vue'
import OperationViewEmpty from 'components/Operations/_common/OperationViewEmpty.vue'
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'
import { useResourceConfig, isActionVisible } from 'src/composables/resources/useResourceConfig'
import { useResourceData } from 'src/composables/resources/useResourceData'
import { useResourceRelationsData } from 'src/composables/resources/useResourceRelationsData'
import { useResourceNav } from 'src/composables/resources/useResourceNav'

const nav = useResourceNav()
const { scope, resourceSlug, code, config, resourceName, resolvedFields, additionalActions, permissions, customUIName } = useResourceConfig()
const { items, loading, reload } = useResourceData(resourceName)
const {
  parentResource,
  childResources,
  childRecordsByResource,
  parentRecord,
  loadRelations
} = useResourceRelationsData(resourceName)

const { sections, sectionsReady } = useSectionResolver({
  resourceSlug,
  customUIName,
  scope: 'operations',
  sectionDefs: {
    ViewHeader: OperationViewHeader,
    ViewActionBar: OperationViewActionBar,
    ViewDetails: OperationViewDetails,
    ViewParent: OperationViewParent,
    ViewChildren: OperationViewChildren,
    ViewLoading: OperationViewLoading,
    ViewEmpty: OperationViewEmpty
  }
})

const record = computed(() => {
  if (!code.value || !items.value.length) return null
  return items.value.find((r) => r.Code === code.value) || null
})

const visibleActions = computed(() =>
  additionalActions.value.filter((a) => isActionVisible(a, record.value))
)

watch(
  () => [resourceName.value, code.value],
  async ([nName, nCode]) => {
    if (nName && nCode) {
      await reload()
      await loadRelations(record.value, config.value, { includeInactive: true })
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
  if (action?.kind === 'navigate') {
    const n = action.navigate || {}
    const params = { pageSlug: n.pageSlug }
    if (n.resourceSlug) params.resourceSlug = n.resourceSlug
    if (n.scope) params.scope = n.scope
    nav.goTo(n.target || 'record-page', params)
    return
  }
  nav.goTo('action', { action: action.action })
}

function navigateToChildView(childResource, childRecordCode) {
  nav.goTo('view', {
    scope: childResource.scope || 'operations',
    resourceSlug: childResource.slug,
    code: childRecordCode
  })
}
</script>

<style scoped>
.view-page {
  display: grid;
  gap: 12px;
  padding-bottom: 32px;
}
</style>
