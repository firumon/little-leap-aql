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
      :field-props="FIELD_PROPS"
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

defineOptions({ name: 'OutletVisitsResourceActionAdd', inheritAttrs: false })

// Module-scope constants, not inline object literals in the template: a literal in a
// binding allocates a new array/object on every render, and FormRecord watches
// `fields`/`defaultValues` by reference — a fresh identity each render would re-run
// its resolvers and default-seeding on every keystroke.
const FIELDS = ['OutletCode', 'Date', 'ProgressPlannedComment']
const SHOW_FIELDS = ['ProgressPlannedComment']
const HIDE_FIELDS = ['Progress', 'RespondDate']
const FIELD_PROPS = { ProgressPlannedComment: { label: 'Comment' }, Date: { required: true } }

const resourceConfig = inject('resourceConfig', null)
const pageState = inject('pageState', null)

const dialogOpen = ref(false)

const resourceName = computed(() => resourceConfig?.resourceName?.value || 'OutletVisits')
const scope = computed(() => resourceConfig?.scope?.value || '')
const resourceSlug = computed(() => resourceConfig?.resourceSlug?.value || '')
const uiName = computed(() => resourceConfig?.customUIName?.value || '')

const primary = pageState?.useNode(() => resourceName.value) || null
const record = computed(() => primary?.record.value || {})

const submitting = computed(() => pageState?.meta.submitting === true)

function openDialog () {
  if (!pageState) return
  // `fields` lands in node.record via Object.assign, so the hidden headers are part
  // of the submitted payload from the first render — no watcher, no second pass.
  pageState.initResource(resourceName.value, {
    isPrimaryKey: true,
    reset: true,
  })
  dialogOpen.value = true
}

function closeDialog () {
  dialogOpen.value = false
  pageState?.reset()
}

// Same routing rule as Create.vue: schema headers land in `node.record` (submitted),
// non-schema custom headers in `node.controls` (never built into a payload).
//
// Gated on `dialogOpen` on purpose. `closeDialog` drops the node while the dialog is
// still mid-hide-transition, which flips `record` back to pageState's shared empty
// node; FormRecord's default-seeding watch keys on the record object's IDENTITY and
// would fire on that swap, re-creating the node we just cleared.
function onField (header, value, meta) {
  if (!dialogOpen.value || !pageState) return
  if (meta?.custom) pageState.setControlField(resourceName.value, header, value)
  else pageState.setField(resourceName.value, header, value)
}

async function onConfirm () {
  if (!pageState) return
  const { success } = await pageState.submit({ successMsg: 'Visit created.' })
  // A failed submit keeps the dialog open with the user's input intact; the error
  // itself has already been notified by pageState.run().
  if (success) closeDialog()
}
</script>
