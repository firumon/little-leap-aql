<template>
  <div class="view-page">
    <div v-if="!sectionsReady" class="q-py-xl text-center">
      <q-spinner-dots color="primary" size="32px" />
    </div>
    <component v-else-if="loading" :is="sections.Loading" />
    <component v-else-if="!record" :is="sections.Empty" @back="navigateToList" />

    <!-- View Content -->
    <template v-else>
      <component
        :is="sections.Header"
        :config="config"
        :record="record"
        :code="code"
        :resolved-fields="resolvedFields"
        @edit="navigateToEdit"
      />

      <component
        :is="sections.ActionBar"
        :additional-actions="visibleActions"
        :permissions="permissions"
        @edit="navigateToEdit"
        @action-clicked="navigateToAction"
      />

      <component
        :is="sections.Details"
        :record="record"
        :resolved-fields="resolvedFields"
        :resource-name="config?.name"
      />

      <component
        :is="sections.Parent"
        :parent-resource="parentResource"
        :parent-record="parentRecord"
        :additional-actions="visibleActions"
        :scope="scope"
        :resource-slug="resourceSlug"
        :custom-u-i-name="customUIName"
        :entity-name="resourceName"
      />

      <component
        :is="sections.Children"
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
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'
import { useRecord } from 'src/composables/resources/useRecord'
import { useResourceNav } from 'src/composables/resources/useResourceNav'

const nav = useResourceNav()
const { scope, resourceSlug, code, config, resourceName, resolvedFields, additionalActions, permissions, customUIName } = useResourceConfig()
const {
  records: items, record, loading, reload,
  parentResource, childResources, childRecordsByResource,
  loadRelations
} = useRecord()

const parentRecord = computed(() => {
  const pKeys = record.value?._Parents || []
  if (pKeys.length) return record.value?.[pKeys[0]] || null
  return null
})

const { sections, sectionsReady } = useSectionResolver({
  resourceSlug,
  customUIName,
  scope,
  sectionDefs: {
    Header: 'Header',
    ActionBar: 'ActionBar',
    Details: 'Details',
    Parent: 'Parent',
    Children: 'Children',
    Loading: 'Loading',
    Empty: 'Empty'
  }
})

const visibleActions = computed(() =>
  additionalActions.value.filter((a) => isActionVisible(a, record.value))
)

watch(
  () => [resourceName.value, code.value],
  async ([nName, nCode]) => {
    if (nName && nCode) {
      await reload()
      await loadRelations()
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
