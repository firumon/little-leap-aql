<template>
  <!-- The FAB itself stays the base item, so icon/color/label/visibility and the
       `asFabAction` geometry keep coming from ResourceActions. `handler` is bound
       AFTER $attrs so it wins over anything drilled in, and it replaces the
       `click` emit entirely — which is what suppresses the default `nav.goTo('add')`. -->
  <ResourceActionItem v-bind="$attrs" :handler="openDialog" />

  <AqlDialog
    v-model="dialogOpen"
    title="New Visit"
    subtitle="Schedule an outlet visit"
    icon="add_location_alt"
    persistent
    max-width="620px"
    confirm-label="Create Visit"
    confirm-icon="check"
    :loading="submitting"
    loading-label="Creating visit…"
    @confirm="onConfirm"
    @cancel="closeDialog"
  >
    <!-- `fields` fixes both the SET and the ORDER of the inputs. `showFields` is the
         highest-precedence visibility switch (§2.1b): ProgressPlannedComment ends in
         'Comment', so FormRecord's default `workflowFields: 'hide'` strips it —
         listing it here re-admits that ONE field without turning every workflow-stamp
         column on. `hideFields` keeps Progress/RespondDate out of the grid; both are
         seeded headlessly in `openDialog` instead. -->
    <FormRecord
      :resource="resourceName"
      :record="record"
      :card="false"
      :scope="scope"
      :resource-slug="resourceSlug"
      :ui-name="uiName"
      :fields="FIELDS"
      :show-fields="SHOW_FIELDS"
      :hide-fields="HIDE_FIELDS"
      :field-props="fieldProps"
      @update:field="onField"
    />
  </AqlDialog>
</template>

<script setup>
/**
 * OutletVisits › ResourceActionAdd — Vue override (tier 3: resource-level).
 *
 * Replaces the default "navigate to the `_add` route" behaviour of the Add FAB with
 * an inline popup form across all OutletVisits pages.
 */
import { computed, inject, ref } from 'vue'
import ResourceActionItem from 'components/actions/ResourceActionItem.vue'
import FormRecord from 'components/contents/FormRecord.vue'
import AqlDialog from 'components/shared/AqlDialog.vue'
import { usePageRecord } from 'src/composables/resources/usePageRecord'
import { useOutletResource } from 'src/_resource/Master/Outlets/composables/useOutletResource'
import { isPlanned } from 'src/_resource/Operation/OutletVisits/composables/useVisitProgress'

defineOptions({ name: 'OutletVisitsResourceActionAdd', inheritAttrs: false })

const FIELDS = ['OutletCode', 'Date', 'ProgressPlannedComment']
const SHOW_FIELDS = ['ProgressPlannedComment']
const HIDE_FIELDS = ['Progress', 'RespondDate']

const resourceConfig = inject('resourceConfig', null)
const resourceRecord = inject('resourceRecord', null)
const pageState = inject('pageState', null)

const { outletOptions } = useOutletResource()

// No store import: a `_ui/` component must reach data through the injected page
// context or a composable (ARCHITECTURE RULES §3).
const fallbackRecord = usePageRecord('OutletVisits')
const visitRecords = computed(() =>
  resourceRecord?.records?.value ?? fallbackRecord.records.value ?? []
)

const dialogOpen = ref(false)

const resourceName = computed(() => resourceConfig?.resourceName?.value || 'OutletVisits')
const scope = computed(() => resourceConfig?.scope?.value || '')
const resourceSlug = computed(() => resourceConfig?.resourceSlug?.value || '')
const uiName = computed(() => resourceConfig?.customUIName?.value || '')

const primary = pageState?.useNode(() => resourceName.value) || null
const record = computed(() => primary?.record.value || {})

const submitting = computed(() => pageState?.meta.submitting === true)

// Outlets that already hold an open (active + PLANNED) visit.
const bookedOutletCodes = computed(() => {
  const booked = new Set()
  for (const visit of visitRecords.value) {
    if (!visit || !isPlanned(visit)) continue
    if ((visit.Status || 'Active') !== 'Active') continue
    if (visit.OutletCode) booked.add(String(visit.OutletCode))
  }
  return booked
})

const availableOutletOptions = computed(() =>
  outletOptions.value.filter((o) => !bookedOutletCodes.value.has(o.value))
)

const fieldProps = computed(() => ({
  ProgressPlannedComment: { label: 'Comment' },
  Date: { required: true },
  OutletCode: {
    options: availableOutletOptions.value,
    hint: availableOutletOptions.value.length
      ? 'Only outlets without an open planned visit are listed.'
      : 'Every outlet already has an open planned visit.'
  }
}))

function openDialog () {
  if (!pageState) return
  pageState.initResource(resourceName.value, {
    isPrimaryKey: true,
    reset: true
  })
  dialogOpen.value = true
}

function closeDialog () {
  dialogOpen.value = false
  pageState?.reset()
}

function onField (header, value, meta) {
  if (!dialogOpen.value || !pageState) return
  if (meta?.custom) pageState.setControls(header, value, resourceName.value)
  else pageState.setRecord(header, value, resourceName.value)
}

async function onConfirm () {
  if (!pageState) return
  const { success } = await pageState.submit({ successMsg: 'Visit created.' })
  if (success) closeDialog()
}
</script>
