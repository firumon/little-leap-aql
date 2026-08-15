<template>
  <div :class="gutterClass">
    <!-- The record has moved on since the link was opened. Said in a banner ABOVE the
         form rather than failing at the sticky bar after the user has typed a reason
         (§13.4). -->
    <q-banner v-if="!gate.allowed" dense rounded class="bg-orange-1 text-body2">
      <template #avatar><q-icon name="lock" color="warning" /></template>
      This audit can no longer be cancelled. {{ gate.reason }}
    </q-banner>

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <div class="text-subtitle1 text-weight-medium">Why is this being cancelled?</div>
        <div class="text-caption text-grey-8 q-pb-sm">
          The reason is stored on the record and copied onto everything cancelled with it.
        </div>
        <component
          :is="TextareaField"
          :model-value="reason"
          :record="{}"
          :config="{ label: 'Cancellation reason', required: true }"
          header="ProgressCancelledComment"
          :disable="!gate.allowed"
          @update:model-value="setReason"
        />
      </q-card-section>
    </q-card>

    <!-- The whole reason this is a route rather than a one-field dialog: the user sees
         what else this will take down BEFORE committing to it. -->
    <q-card v-if="cascade.length" flat bordered :class="ui.cardClass">
      <q-card-section>
        <SectionDividerLabel label="THIS WILL ALSO" />
        <q-list separator dense>
          <q-item v-for="entry in cascade" :key="entry.key">
            <q-item-section :class="ui.flexWrapTextClass">
              <q-item-label>{{ entry.label }}</q-item-label>
              <q-item-label caption>{{ entry.caption }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-badge rounded :color="entry.color" :label="entry.state" />
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
    </q-card>

    <q-banner dense rounded class="bg-grey-2 text-body2">
      Stock is not put back. The audit recorded what was physically on the shelf, and
      cancelling it does not change that — correct a miscount by recording a new audit.
    </q-banner>
  </div>
</template>

<script setup>
/**
 * CancelConsumption › the only card on the route — reason, cascade preview, consequences.
 *
 * THE HYDRATION POINT for this route (§5.5): calling the page composable is what loads the
 * record, its invoice and its restocks, since an action route's resolver fetches none of
 * them.
 *
 * The reason is written to a CONTROL field, not a record field. `ProgressCancelledComment`
 * is a workflow stamp column, and a stamp is never a form field in any state — it is set
 * by the submit handler that causes the transition, so it cannot be back-dated or
 * attributed to someone else (§13.3, §13.5). The control field is the working surface the
 * sticky bar reads back.
 *
 * The final banner states the consequence that surprises people: cancelling does not
 * restore stock. A banner rather than a card, because it is a fact ABOUT the action rather
 * than a fact of its own (§10.4).
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'
import { useConsumptionCancelContext } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/CancelConsumption/useConsumptionCancelContext'

defineOptions({ name: 'OutletConsumptionsCancelConsumptionCancelReason', inheritAttrs: false })

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const { pageState, ui, cascade, gate } = useConsumptionCancelContext()

const NODE = 'OutletConsumptions'
// `'add'`, because the mode follows the VALUE rather than the page: this reason does not
// exist yet and nothing is being amended. (An action route that pre-seeded an existing
// comment off the record would mount `'edit'` instead, even though the route creates
// rows.) Resolved, never deep-imported, so the type's aliases and prepared-props branches
// keep applying (§2.4).
const TextareaField = resolveFieldComponent('textarea', 'add')

const reason = computed(() => pageState?.getControlField(NODE, 'CancelReason') || '')
const setReason = (value) => pageState?.setControlField(NODE, 'CancelReason', value)
</script>
