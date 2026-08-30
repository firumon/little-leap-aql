<template>
  <AqlDialog
    :model-value="dialog.open"
    :title="dialogTitle"
    :subtitle="dialogSubtitle"
    :icon="dialog.action?.icon || 'bolt'"
    :variant="dialogVariant"
    persistent
    max-width="620px"
    :confirm-label="actionLabel"
    :confirm-icon="dialog.action?.icon || 'check'"
    :confirm-color="dialog.action?.color || 'primary'"
    :loading="dialog.submitting"
    :loading-label="`${actionLabel} in progress…`"
    :disable-confirm="isMultiOutcome && !columnValue"
    :message="dialog.error"
    message-icon="error"
    @update:model-value="onDialogToggle"
    @confirm="submit"
    @cancel="close"
  >
    <!-- Outcome picker — multi-outcome actions only. Choosing here re-derives
         every source field header, so it sits above the field groups. -->
    <q-select
      v-if="isMultiOutcome"
      :model-value="columnValue"
      :options="outcomeOptions"
      label="Outcome"
      outlined
      emit-value
      map-options
      @update:model-value="setOutcome"
    />

    <template v-for="(group, index) in groups" :key="group.key || 'source'">
      <!-- Target groups are labelled so it is obvious a second record is being
           written. The source group carries no label — those fields belong to
           the record the dialog is already titled with. -->
      <SectionDividerLabel v-if="group.label" :label="group.label" />

      <component
        :is="field.component"
        v-for="field in group.fields"
        :key="field.address"
        :model-value="readField(group, field)"
        :record="dialog.record || {}"
        :config="field.config"
        :header="field.header"
        @update:model-value="(value) => writeField(group, field, value)"
      />
    </template>
  </AqlDialog>
</template>

<script setup>
/**
 * The one AdditionalActions input dialog for the whole app.
 *
 * Mounted a SINGLE time in `MainLayout.vue` and driven by the shared state in
 * `useAdditionalActions`. Triggers render buttons only — an index page showing one
 * trigger per row would otherwise mount one dialog per row.
 *
 * Renders nothing type-specific itself: every control comes from `_fields/` via
 * the component the composable already resolved, so a config that asks for a
 * `file` or `currency` input works with no change here.
 *
 * Field values live in the composable's own `pageState`, not in a local form, so
 * the popup submits through the same build/run pipeline every page uses.
 *
 * On success the dialog closes immediately and does NOT refetch — GAS returns
 * write deltas for every resource the action touched, and `runBatchRequests`
 * hydrates them into the data store, so reactivity updates the page on its own.
 * On failure it stays open with the message inline, preserving what the user
 * typed.
 */
import { computed, watch } from 'vue'
import AqlDialog from 'components/shared/AqlDialog.vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useAdditionalActionsDialog } from 'src/composables/resources/useAdditionalActions'
import { resolveRecordTemplate } from 'src/composables/resources/additionalActionsSchema'

defineOptions({ name: 'AppAdditionalActionsDialog' })

const {
  dialog, groups, isMultiOutcome, outcomeOptions,
  columnValue, readField, writeField,
  syncForm, submit, close, setOutcome
} = useAdditionalActionsDialog()

// The confirm BUTTON always reads as the action itself ("Postpone"), never as the
// heading — a custom title must not change what the user is agreeing to.
const actionLabel = computed(() => dialog.action?.label || dialog.action?.action || 'Action')

// Heading templates resolve against the record: `"{$outlet.Name}"`, `"{Code} • {Date}"`.
// Both fall back to today's behaviour when the action declares nothing, so every
// existing config renders exactly as before.
const dialogTitle = computed(() =>
  resolveRecordTemplate(dialog.action?.title, dialog.record) || actionLabel.value
)

// `subtitle: ""` is a deliberate "no subtitle", so an explicitly-authored empty
// string must NOT fall back to the Code the way an absent key does.
const dialogSubtitle = computed(() => {
  const template = dialog.action?.subtitle
  if (template === undefined || template === null) return dialog.record?.Code || ''
  return resolveRecordTemplate(template, dialog.record)
})

// An action's own colour doubles as the dialog's severity tint. A failed submit
// overrides it so the error banner reads as an error rather than as chrome.
const dialogVariant = computed(() => {
  if (dialog.error) return 'negative'
  const color = dialog.action?.color || ''
  return ['warning', 'negative', 'positive', 'info'].includes(color) ? color : 'primary'
})

// Re-seed only when the FIELD SET genuinely changes: a different action, a
// different record, or a different outcome picked on a multi-outcome action.
//
// Deliberately NOT `watch(groups)`. `groups` also depends on data-store records
// (select fields resolve their options from there), so a background resource
// sync would rebuild it and wipe whatever the user was midway through typing.
// It must also not fire on submit failure — staying open is only useful if the
// input survives.
watch(
  () => `${dialog.action?.action ?? ''}::${dialog.record?.Code ?? ''}::${columnValue.value}`,
  syncForm,
  { immediate: true }
)

function onDialogToggle (open) {
  if (!open) close()
}
</script>
