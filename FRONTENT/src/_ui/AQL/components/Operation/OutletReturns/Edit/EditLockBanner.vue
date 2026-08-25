<template>
  <div v-if="locked">
    <q-banner dense rounded class="bg-orange-1 text-body2">
      <template #avatar><q-icon name="lock" color="warning" /></template>
      {{ message }}
    </q-banner>
  </div>
</template>

<script setup>
/**
 * OutletReturns › Edit › EditLockBanner — Section (tier 1: resource + page).
 *
 * The Edit URL is directly reachable, so a return that has moved on since the link was
 * opened must say why nothing here will save — in a banner ABOVE the form, rather than
 * failing at the sticky bar after the user has typed (§13.4).
 *
 * Eligibility is the domain's `isEditable`, the same predicate that gates the Edit FAB
 * (`ResourceActionEdit.js`) and disables the submit button. Three consumers, one rule — a
 * banner that decided for itself would eventually disagree with the button beside it (§8.6).
 *
 * Renders nothing at all on an editable record, so it costs the top of the page nothing in
 * the ordinary case (§10.4).
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed } from 'vue'
import { useReturnFormContext } from 'src/_ui/AQL/composables/Operation/OutletReturns/useReturnFormContext'
import {
  isEditable,
  isCompleted,
  isCancelled
} from 'src/_resource/Operation/OutletReturns/composables/useReturnProgress'

defineOptions({ name: 'OutletReturnsEditLockBanner', inheritAttrs: false })

const { resourceRecord } = useReturnFormContext()

const record = computed(() => resourceRecord?.record?.value || null)

// Fails CLOSED on a record that has not loaded: showing the form as editable and
// discovering otherwise at the sticky bar is the failure this banner exists to prevent.
const locked = computed(() => !!record.value && !isEditable(record.value))

const message = computed(() => {
  const row = record.value
  if (!row) return ''
  if (isCompleted(row)) {
    return 'This return is completed — both of its tracks have been reconciled, so its details can no longer be changed.'
  }
  if (isCancelled(row)) {
    return 'This return was cancelled. Its details are kept as a record and cannot be changed.'
  }
  return 'This return can no longer be edited.'
})
</script>
