<template>
  <!-- Render custom template if resolved -->
  <component
    :is="resolvedComponent"
    v-slot="{ record, visibleActions }"
    v-if="resolvedComponent"
    v-bind="finalProps"
    @edit="navigateToEdit"
    @action-clicked="handleActionClicked"
  />

  <div v-else class="view-actions">
    <!-- Reports FAB on bottom-left -->
    <Downloads :page="page" :record="record" />

    <!-- CRUD Actions FAB on bottom-right -->
    <CrudActions :page="page" @edit="navigateToEdit" />

    <!-- Additional Actions FAB on bottom-right (offset) -->
    <AdditionalActionSingle
      v-if="visibleActions.length === 1"
      :page="page"
      :action="visibleActions[0]"
      @action-clicked="handleActionClicked"
    />
    <AdditionalActionMultiple
      v-else-if="visibleActions.length > 1"
      :page="page"
      :actions="visibleActions"
      @action-clicked="handleActionClicked"
    />

    <!-- Action Dialog for Mutate Actions -->
    <ActionDialog
      v-model="showActionDialog"
      :action-config="selectedAction"
      :record="record"
    />
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import { useCommonSection } from 'src/composables/resources/useCommonSection'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { isActionVisible } from 'src/composables/resources/useResourceConfig'
import Downloads from 'components/_common/sections/Action/Downloads.vue'
import CrudActions from 'components/_common/sections/Action/CrudActions.vue'
import AdditionalActionSingle from 'components/_common/sections/Action/AdditionalActionSingle.vue'
import AdditionalActionMultiple from 'components/_common/sections/Action/AdditionalActionMultiple.vue'
import ActionDialog from 'components/_common/sections/Action/ActionDialog.vue'

defineOptions({ name: 'ViewActions' })

const props = defineProps({
  page: { type: String, default: 'View' }
})

const nav = useResourceNav()
const { permissions, additionalActions } = inject('resourceConfig')
const { record } = inject('resourceRecord')

const showActionDialog = ref(false)
const selectedAction = ref(null)

const visibleActions = computed(() => {
  const actions = additionalActions.value || []
  const rec = record.value
  return actions.filter((action) => {
    const perm = permissions.value
    if (!perm) return false
    const actionKey = `can${action.action}`
    if (perm[actionKey] === false) return false
    return isActionVisible(action, rec)
  })
})

const preparedProps = computed(() => ({
  permissions: permissions.value,
  additionalActions: additionalActions.value,
  record: record.value,
  visibleActions: visibleActions.value
}))

const { resolvedComponent, finalProps } = useCommonSection({
  sectionName: 'Actions',
  page: props.page,
  preparedProps
})

function navigateToEdit() {
  nav.goTo('edit')
}

function handleActionClicked(action) {
  if (action.kind === 'navigate') {
    const target = action.navigate?.target || 'record-page'
    const pageSlug = action.navigate?.pageSlug || ''

    if (target === 'record-page') {
      nav.goTo('record-page', {
        scope: action.navigate?.scope || nav.scope.value,
        resourceSlug: action.navigate?.resourceSlug || nav.resourceSlug.value,
        code: action.navigate?.code || nav.code.value,
        pageSlug: pageSlug
      })
    } else if (target === 'resource-page') {
      nav.goTo('resource-page', {
        scope: action.navigate?.scope || nav.scope.value,
        resourceSlug: action.navigate?.resourceSlug || nav.resourceSlug.value,
        pageSlug: pageSlug
      })
    }
  } else {
    // Open action dialog directly instead of navigating to page
    selectedAction.value = action
    showActionDialog.value = true
  }
}
</script>
