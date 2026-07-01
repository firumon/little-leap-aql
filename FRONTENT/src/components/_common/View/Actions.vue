<template>
  <!-- Render custom template if resolved -->
  <component
    :is="resolvedComponent"
    v-if="resolvedComponent"
    v-bind="finalProps"
    @edit="navigateToEdit"
    @action-clicked="handleActionClicked"
  />

  <!-- Fallback template rendering ActionBar -->
  <ActionBar
    v-else
    :permissions="finalProps.permissions"
    :additional-actions="finalProps.additionalActions"
    @edit="navigateToEdit"
    @action-clicked="handleActionClicked"
  />
</template>

<script setup>
import { computed, inject } from 'vue'
import { useCommonSection } from 'src/composables/resources/useCommonSection'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import ActionBar from 'components/_common/Action/ActionBar.vue'

defineOptions({ name: 'ViewActions' })

const props = defineProps({
  page: { type: String, default: 'View' }
})

const nav = useResourceNav()
const { permissions, additionalActions } = inject('resourceConfig')
const { record } = inject('resourceRecord')

const preparedProps = computed(() => ({
  permissions: permissions.value,
  additionalActions: additionalActions.value,
  record: record.value
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
      nav.goTo(pageSlug)
    } else if (target === 'resource-page') {
      nav.goTo('index', {
        resourceSlug: action.navigate?.resourceSlug || nav.resourceSlug.value,
        scope: action.navigate?.scope || nav.scope.value
      })
    }
  } else {
    nav.goTo('action', { action: action.action })
  }
}
</script>
