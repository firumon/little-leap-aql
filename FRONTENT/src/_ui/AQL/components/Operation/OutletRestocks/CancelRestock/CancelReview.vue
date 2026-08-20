<template>
  <div :class="gutterClass">
    <!-- The request has moved on since the link was opened. Said ABOVE the form rather than
         failing at the sticky bar after the driver has typed a reason. -->
    <q-banner v-if="!gate.allowed" dense rounded class="bg-orange-1 text-body2">
      <template #avatar><q-icon name="lock" color="warning" /></template>
      This restock request can no longer be cancelled. {{ gate.reason }}
    </q-banner>

    <!-- What physically moves. First card on the page, because it is the part of a
         cancellation people most often get wrong. -->
    <q-card v-if="preview.returning.length" flat bordered :class="ui.cardClass">
      <q-card-section>
        <SectionDividerLabel label="RETURNING TO WAREHOUSE" />
        <div class="text-caption text-grey-8 q-pb-sm">
          These units were committed out of the warehouse on approval. Cancelling puts them
          back on the same shelf they came off.
        </div>
        <q-list separator dense>
          <q-item v-for="line in preview.returning" :key="line.Code" class="q-py-sm">
            <q-item-section :class="ui.flexWrapTextClass">
              <q-item-label>{{ line.SKU }}</q-item-label>
              <q-item-label caption>{{ line.WarehouseCode || '—' }} | {{ line.StorageName || '_default' }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-chip dense outline color="positive" :label="`+${Math.abs(Number(line.Quantity) || 0)}`" />
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
    </q-card>

    <!-- Lines that never held stock. Stated separately so the card above cannot be read as
         promising a return for a line that took nothing out. -->
    <q-card v-if="preview.releasing.length" flat bordered :class="ui.cardClass">
      <q-card-section>
        <SectionDividerLabel label="CLOSED WITHOUT STOCK MOVEMENT" />
        <div class="text-caption text-grey-8 q-pb-sm">
          Never allocated, so nothing moves back for these.
        </div>
        <q-list separator dense>
          <q-item v-for="line in preview.releasing" :key="line.Code" class="q-py-sm">
            <q-item-section :class="ui.flexWrapTextClass">
              <q-item-label>{{ line.SKU }}</q-item-label>
              <q-item-label caption>Pending allocation</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-chip dense outline color="grey-7" :label="String(Math.abs(Number(line.Quantity) || 0))" />
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
    </q-card>

    <!-- Already at the outlet. Untouched, and said so explicitly. -->
    <q-card v-if="preview.delivered.length" flat bordered :class="ui.cardClass">
      <q-card-section>
        <SectionDividerLabel label="ALREADY DELIVERED — UNAFFECTED" />
        <div class="text-caption text-grey-8 q-pb-sm">
          These units are physically at the outlet. They stay there, and this cancellation
          does not touch them.
        </div>
        <q-list separator dense>
          <q-item v-for="line in preview.delivered" :key="line.Code" class="q-py-sm">
            <q-item-section :class="ui.flexWrapTextClass">
              <q-item-label>{{ line.SKU }}</q-item-label>
              <q-item-label caption>Delivered</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-chip dense outline color="info" :label="String(Math.abs(Number(line.Quantity) || 0))" />
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
    </q-card>

    <!-- Where the request lands. A part-delivered request settles as DELIVERED, because it
         DID happen — it just will not be completed. -->
    <q-banner dense rounded class="bg-grey-2 text-body2">
      <template #avatar><q-icon :name="outcomeIcon" :color="outcomeColor" /></template>
      This request will be closed as <strong>{{ outcomeLabel }}</strong>.
    </q-banner>

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <div class="text-subtitle1 text-weight-medium">Why is this being cancelled?</div>
        <div class="text-caption text-grey-8 q-pb-sm">
          The reason is stored on the request and on every line it closes.
        </div>
        <component
          :is="TextareaField"
          :model-value="reason"
          :record="{}"
          :config="reasonConfig"
          header="ProgressCancelledComment"
          :disable="!gate.allowed"
          @update:model-value="setReason"
        />
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
/**
 * CancelRestock › the only card on the route — stock review, outcome, reason.
 *
 * Everything shown is read from `restockCancellationPreview`, the one pure domain
 * derivation `CancelRestock/PageAction.js` also submits from. A second projection here
 * would be a second answer to "what does cancelling do", and the two would drift the first
 * time an item state was added.
 *
 * The reason is written to a CONTROL field, not a record field. `ProgressCancelledComment`
 * is a workflow stamp column, and a stamp is never a form field in any state — it is set by
 * the submit handler that causes the transition, so it cannot be back-dated or attributed
 * to someone else.
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'
import { progressColor, progressIcon, progressLabel } from 'src/_resource/Operation/OutletRestocks/composables/useRestockProgress'
import { useRestockCancelContext } from 'src/_ui/AQL/composables/Operation/OutletRestocks/CancelRestock/useRestockCancelContext'

defineOptions({ name: 'OutletRestocksCancelRestockCancelReview', inheritAttrs: false })

// Hoisted: an object literal inline in the template is a new prop identity every render.
const REASON_CONFIG = { label: 'Cancellation reason', required: true }

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const { ui, preview, gate, reason, setReason } = useRestockCancelContext()

const TextareaField = resolveFieldComponent('textarea', 'add')
const reasonConfig = computed(() => REASON_CONFIG)

const outcomeLabel = computed(() => progressLabel(preview.value.nextProgress))
const outcomeColor = computed(() => progressColor(preview.value.nextProgress))
const outcomeIcon = computed(() => progressIcon(preview.value.nextProgress))
</script>
