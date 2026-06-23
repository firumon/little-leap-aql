<template>
  <div class="view-page">
    <!-- Loading state -->
    <div v-if="!sectionsReady" class="q-py-xl text-center">
      <q-spinner-dots color="primary" size="32px" />
    </div>
    <component v-else-if="loading" :is="sections.Loading" />
    <component v-else-if="!record" :is="sections.Empty" @back="navigateToList" />

    <!-- Record detail -->
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
        :permissions="permissions"
        :additional-actions="visibleActions"
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
        :is="sections.Audit"
        :record="record"
      />

      <component
        :is="sections.Children"
        :child-resources="childResources"
        :child-records-map="childRecords"
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
import { useResourceConfig, isActionVisible } from 'src/composables/resources/useResourceConfig'
import { useResourceData } from 'src/composables/resources/useResourceData'
import { useResourceRelationsData } from 'src/composables/resources/useResourceRelationsData'
import { useResourceNav } from 'src/composables/resources/useResourceNav'

const nav = useResourceNav()
const {
  scope, resourceSlug, code, config, resourceName,
  resolvedFields, additionalActions, permissions, customUIName
} = useResourceConfig()

const { items, loading, reload } = useResourceData(resourceName)
const { childResources, childRecordsByResource: childRecords, loadChildRecords: loadRelatedChildren } = useResourceRelationsData(resourceName)

const { sections, sectionsReady } = useSectionResolver({
  resourceSlug,
  customUIName,
  scope,
  sectionDefs: {
    Header: 'Header',
    ActionBar: 'ActionBar',
    Details: 'Details',
    Audit: 'Audit',
    Children: 'Children',
    Loading: 'Loading',
    Empty: 'Empty'
  }
})

const record = computed(() => {
  if (!code.value || !items.value.length) return null
  return items.value.find((row) => row.Code === code.value) || null
})

const visibleActions = computed(() =>
  additionalActions.value.filter((a) => isActionVisible(a, record.value))
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
  nav.goTo('action', { action: action.action.toLowerCase() })
}

async function loadChildRecords() {
  await loadRelatedChildren(code.value, config.value, {})
}

watch(() => resourceName.value, async (n) => { if (n) await reload() }, { immediate: true })
watch([() => code.value, () => items.value.length], () => { loadChildRecords() })

function navigateToChildView(childResource, childRecordCode) {
  nav.goTo('view', {
    scope: childResource.scope || 'masters',
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
