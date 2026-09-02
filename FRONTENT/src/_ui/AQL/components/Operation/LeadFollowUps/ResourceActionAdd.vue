<template>
  <!-- `handler` is bound AFTER $attrs so it wins over anything drilled in, and it
       replaces the `click` emit — which is what suppresses `nav.goTo('add')`. -->
  <ResourceActionItem v-bind="$attrs" :handler="openDialog" />

  <AqlDialog
    v-model="dialogOpen"
    title="New Follow-Up"
    subtitle="Plan a follow-up on a lead"
    icon="follow_the_signs"
    persistent
    max-width="620px"
    confirm-label="Create Follow-Up"
    confirm-icon="check"
    :loading="submitting"
    loading-label="Creating follow-up…"
    @confirm="onConfirm"
    @cancel="closeDialog"
  >
    <!-- `fields` fixes both the SET and the ORDER, and it is an exclusive whitelist —
         Username, Progress, Status and RespondDate are never rendered because Layer 2
         already put them on the node. -->
    <FormRecord
      :resource="resourceName"
      :record="record"
      :card="false"
      :scope="scope"
      :resource-slug="resourceSlug"
      :ui-name="uiName"
      :fields="FIELDS"
      :field-props="fieldProps"
      @update:field="onField"
    />
  </AqlDialog>
</template>

<script setup>
// Add FAB override: opens a popup form instead of the `_add` route.
// Layer 2 seeds the node, so the form only collects what a human answers.
import { computed, inject, ref } from 'vue'
import ResourceActionItem from 'components/actions/ResourceActionItem.vue'
import FormRecord from 'components/contents/FormRecord.vue'
import AqlDialog from 'components/shared/AqlDialog.vue'
import { followUpSeedNode } from 'src/_resource/Operation/LeadFollowUps/composables/useFollowUpPayload'

defineOptions({ name: 'LeadFollowUpsResourceActionAdd', inheritAttrs: false })

// Module scope, not an inline literal: FormRecord watches `fields` by reference, so a
// fresh array each render would re-run its resolvers on every keystroke.
const FIELDS = ['LeadCode', 'Date', 'Purpose', 'PurposeDetail']

const FIELD_PROPS = {
  LeadCode: { label: 'Lead', required: true },
  Date: { required: true },
  Purpose: { required: true },
  PurposeDetail: { label: 'Purpose Detail', rows: 4 }
}

const resourceConfig = inject('resourceConfig', null)
const pageState = inject('pageState', null)

const dialogOpen = ref(false)

const resourceName = computed(() => resourceConfig?.resourceName?.value || 'LeadFollowUps')
const scope = computed(() => resourceConfig?.scope?.value || '')
const resourceSlug = computed(() => resourceConfig?.resourceSlug?.value || '')
const uiName = computed(() => resourceConfig?.customUIName?.value || '')

const primary = pageState?.useNode(() => resourceName.value) || null
const record = computed(() => primary?.record.value || {})

const submitting = computed(() => pageState?.meta.submitting === true)

const fieldProps = computed(() => FIELD_PROPS)

// `initResource` claims the address and the primary key; `applyNodes` then replaces the
// record with the domain-complete one from Layer 2 (Username, Date, Progress, Status).
// A node-shaped literal here would be Layer 3 inventing schema (UI_RESOURCE_DOMAIN_LOGIC §9.8).
function openDialog () {
  if (!pageState) return
  pageState.initResource(resourceName.value, { isPrimaryKey: true, reset: true })
  const applied = pageState.applyNodes(followUpSeedNode())
  if (applied.valid === false) return
  dialogOpen.value = true
}

function closeDialog () {
  dialogOpen.value = false
  pageState?.reset()
}

// Node record only, never controls — all four are real sheet columns.
// Gated on `dialogOpen` so the seeding watch cannot re-create the node closeDialog cleared.
function onField (header, value) {
  if (!dialogOpen.value || !pageState) return
  pageState.setRecord(header, value, resourceName.value)
}

async function onConfirm () {
  if (!pageState) return
  const { success } = await pageState.submit({ successMsg: 'Follow-up added.' })
  // A failed submit keeps the dialog open with the input intact; pageState.run()
  // has already notified the reason.
  if (success) closeDialog()
}
</script>
