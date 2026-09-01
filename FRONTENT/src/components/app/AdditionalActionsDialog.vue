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

      <template v-for="field in group.fields" :key="field.address">
        <!-- 1. Per-field custom UI override (ActionField<Address>.vue). It binds to
             pageState itself, so it can read its siblings' answers. -->
        <component
          :is="fieldOverrides[field.address]"
          v-if="fieldOverrides[field.address]"
          :action-name="actionName"
          :resource="dialog.resource"
          :field="field"
          :group-key="group.key"
          :record="dialog.record || {}"
          :config="field.config"
          :header="field.header"
        />
        <!-- 2. Base type component from `_fields/<type>/Add.vue`. -->
        <component
          v-else
          :is="field.component"
          :model-value="readField(group, field)"
          :record="dialog.record || {}"
          :config="field.config"
          :header="field.header"
          @update:model-value="(value) => writeField(group, field, value)"
        />
      </template>
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
import { computed, markRaw, provide, ref, watch } from 'vue'
import AqlDialog from 'components/shared/AqlDialog.vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useAdditionalActionsDialog } from 'src/composables/resources/useAdditionalActions'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { resolveRecordTemplate } from 'src/composables/resources/additionalActionsSchema'
import { toPascalCase } from 'src/utils/appHelpers'

defineOptions({ name: 'AppAdditionalActionsDialog' })

const {
  dialog, pageState, actionName, groups, isMultiOutcome, outcomeOptions,
  columnValue, readField, writeField,
  syncForm, submit, close, setOutcome
} = useAdditionalActionsDialog()

// The dialog owns its own pageState (see useAdditionalActions). Provided so a per-field
// override can bind with `useActions` / `useControls` like any other page component.
provide('pageState', pageState)

// ── Per-field `_ui/` overrides ────────────────────────────────────────────────
//
// Same contract as FormRecord's `FormField<Header>`: `_ui/*` only, no framework
// fallback — with no override the `_fields/<type>` base control renders as before.
//
// Keyed by the field's ADDRESS, not its name: a source field is `Date`, a target's is
// `nextVisit.Date`, and two targets may each carry a `Date`. The address is already the
// unique one, so `nextVisit.Date` resolves to `actionfieldnextvisitdate.vue`.
const customUiModules = import.meta.glob('../../_ui/**/*.vue')
const customUiRegistry = {}
Object.keys(customUiModules).forEach((rawPath) => {
  customUiRegistry[rawPath.replace(/^\.\.\/\.\.\//, '').toLowerCase()] = customUiModules[rawPath]
})

const fieldOverrides = ref({})

function overrideFileName (address) {
  const parts = String(address || '').split('.').filter(Boolean)
  if (!parts.length) return ''
  return `actionfield${parts.map((part) => toPascalCase(part)).join('')}`.toLowerCase()
}

async function resolveFieldOverrides () {
  fieldOverrides.value = {}
  const name = dialog.resource
  if (!name) return

  const { scope, resourceSlug, customUIName } = useResourceConfig(name)
  const uiKey = String(customUIName.value || '').toLowerCase()
  const scopeKey = String(scope.value || '').toLowerCase()
  const slugKey = toPascalCase(resourceSlug.value || name).toLowerCase()
  if (!uiKey || !scopeKey || !slugKey) return

  const resolved = {}
  for (const group of groups.value) {
    for (const field of group.fields) {
      const file = overrideFileName(field.address)
      if (!file) continue
      const path = `_ui/${uiKey}/components/${scopeKey}/${slugKey}/${file}.vue`
      const loader = customUiRegistry[path]
      if (!loader) continue
      try {
        const mod = await loader()
        resolved[field.address] = markRaw(mod.default || mod)
      } catch (err) {
        console.warn('[AdditionalActionsDialog] Failed to load field override:', path, err)
      }
    }
  }
  fieldOverrides.value = resolved
}

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
  () => {
    syncForm()
    resolveFieldOverrides()
  },
  { immediate: true }
)

function onDialogToggle (open) {
  if (!open) close()
}
</script>
